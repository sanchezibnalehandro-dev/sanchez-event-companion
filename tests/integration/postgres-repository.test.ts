import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresCompanionRepository } from "@/lib/data/postgres-repository";
import type { ProgramAggregate, Session } from "@/lib/domain/types";
import {
  event,
  location,
  makeProgram,
  opening,
  panel,
} from "@/tests/helpers/fixtures";
import { defineRepositoryBehaviorContract } from "@/tests/helpers/repository-contract";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const postgresDescribe = testDatabaseUrl ? describe : describe.skip;

postgresDescribe("PostgreSQL repository integration", () => {
  const schema = `event_companion_${process.pid}_${Date.now()}_${randomUUID().slice(0, 8)}`;
  let adminPool: Pool;
  let scopedPool: Pool;
  let repository: PostgresCompanionRepository;

  beforeAll(async () => {
    if (!testDatabaseUrl) return;
    adminPool = new Pool({ connectionString: testDatabaseUrl });
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    scopedPool = new Pool({
      connectionString: testDatabaseUrl,
      options: `-c search_path=${schema}`,
    });
    const migration = readFileSync(
      join(process.cwd(), "db", "migrations", "postgres", "0001_initial.sql"),
      "utf8",
    );
    await scopedPool.query(migration);
    repository = new PostgresCompanionRepository(scopedPool);
  });

  afterAll(async () => {
    if (!testDatabaseUrl) return;
    await scopedPool.end();
    await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await adminPool.end();
  });

  async function seedProgram(program: ProgramAggregate): Promise<void> {
    await repository.saveEvent(program.event);
    for (const item of program.locations) await repository.saveLocation(item);
    for (const item of program.sessions) await repository.saveSession(item);
    for (const item of program.speakers) await repository.saveSpeaker(item);
    for (const item of program.sessionSpeakers) await repository.saveSessionSpeaker(item);
    if (program.runtime) await repository.saveRuntime(program.runtime);
    for (const item of program.liveIntegrations) await repository.saveLiveIntegration(item);
    for (const item of program.liveSessionMappings) {
      await repository.saveLiveSessionMapping(item);
    }
  }

  async function createHarness(program: ProgramAggregate) {
    await scopedPool.query("TRUNCATE events CASCADE");
    await seedProgram(program);
    return {
      repository,
      close: async () => undefined,
    };
  }

  defineRepositoryBehaviorContract("PostgreSQL", createHarness);

  it("enforces same-event integrity across every cross-event relation", async () => {
    await createHarness(makeProgram());
    const otherEvent = {
      ...event,
      id: "postgres-other-event",
      slug: "postgres-other-event",
    };
    const otherLocation = {
      ...location,
      id: "postgres-other-location",
      eventId: otherEvent.id,
    };
    const otherSession = {
      ...opening,
      id: "postgres-other-session",
      eventId: otherEvent.id,
      slug: "postgres-other-session",
      locationId: otherLocation.id,
    };
    const otherSpeaker = {
      id: "postgres-other-speaker",
      eventId: otherEvent.id,
      name: "Other speaker",
      role: null,
      company: null,
      bio: null,
      photoUrl: null,
    };
    const otherIntegration = {
      id: "postgres-other-integration",
      eventId: otherEvent.id,
      provider: "other-provider",
      externalEventKey: "other-event-key",
      enabled: true,
    };

    await repository.saveEvent(otherEvent);
    await repository.saveLocation(otherLocation);
    await repository.saveSession(otherSession);
    await repository.saveSpeaker(otherSpeaker);
    await repository.saveLiveIntegration(otherIntegration);

    await expect(
      repository.saveSession({
        ...opening,
        id: "postgres-cross-location",
        slug: "postgres-cross-location",
        locationId: otherLocation.id,
      }),
    ).rejects.toThrow();
    await expect(
      repository.saveSessionSpeaker({
        sessionId: opening.id,
        speakerId: otherSpeaker.id,
        sortOrder: 0,
        sessionRole: null,
      }),
    ).rejects.toThrow("same event");
    await expect(
      repository.saveRuntime({
        eventId: otherEvent.id,
        manualCurrentSessionId: opening.id,
        overrideSetAt: "2026-10-02T07:30:00.000Z",
        overrideSetBy: "postgres-test",
      }),
    ).rejects.toThrow();
    await expect(
      repository.saveLiveSessionMapping({
        sessionId: opening.id,
        integrationId: otherIntegration.id,
        externalRoomSlug: "cross-event-room",
      }),
    ).rejects.toThrow("same event");
  });

  it("serializes concurrent destination writes and rolls back the collision", async () => {
    const hallTwo = {
      id: "postgres-concurrency-hall-two",
      eventId: event.id,
      name: "Hall 2",
      sortOrder: 1,
    };
    const destination = {
      id: "postgres-concurrency-destination",
      eventId: event.id,
      name: "Destination",
      sortOrder: 2,
    };
    const sourceA: Session = {
      ...opening,
      startsAt: "2026-10-02T10:00:00.000Z",
      endsAt: "2026-10-02T11:00:00.000Z",
    };
    const sourceB: Session = {
      ...panel,
      startsAt: "2026-10-02T10:00:00.000Z",
      endsAt: "2026-10-02T11:00:00.000Z",
      locationId: hallTwo.id,
    };
    await createHarness(
      makeProgram({
        locations: [location, hallTwo, destination],
        sessions: [sourceA, sourceB],
      }),
    );

    const blocker = await scopedPool.connect();
    const writerAName = `event_companion_writer_a_${process.pid}`;
    const writerBName = `event_companion_writer_b_${process.pid}`;
    const writerAPool = new Pool({
      connectionString: testDatabaseUrl,
      application_name: writerAName,
      options: `-c search_path=${schema}`,
    });
    const writerBPool = new Pool({
      connectionString: testDatabaseUrl,
      application_name: writerBName,
      options: `-c search_path=${schema}`,
    });
    const writerA = new PostgresCompanionRepository(writerAPool);
    const writerB = new PostgresCompanionRepository(writerBPool);

    const waitUntilBlocked = async (applicationName: string): Promise<void> => {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const activity = await adminPool.query(
          `SELECT 1 FROM pg_stat_activity
           WHERE datname = current_database()
             AND application_name = $1
             AND wait_event_type = 'Lock'`,
          [applicationName],
        );
        if (activity.rowCount) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error(`Writer ${applicationName} did not wait for the event lock`);
    };

    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT id FROM events WHERE id = $1 FOR UPDATE", [event.id]);

      const firstWrite = writerA.updateSession({
        session: {
          ...sourceA,
          startsAt: "2026-10-02T12:00:00.000Z",
          endsAt: "2026-10-02T13:00:00.000Z",
          locationId: destination.id,
        },
        speakerIds: [],
        autoShiftFollowing: true,
      });
      await waitUntilBlocked(writerAName);

      const secondWrite = writerB.updateSession({
        session: {
          ...sourceB,
          startsAt: "2026-10-02T12:30:00.000Z",
          endsAt: "2026-10-02T13:30:00.000Z",
          locationId: destination.id,
        },
        speakerIds: [],
        autoShiftFollowing: true,
      });
      await waitUntilBlocked(writerBName);
      await blocker.query("COMMIT");

      const [first, second] = await Promise.allSettled([firstWrite, secondWrite]);
      expect(first.status).toBe("fulfilled");
      expect(second.status).toBe("rejected");
      if (second.status === "rejected") {
        expect(second.reason).toMatchObject({
          message: "destination time is already occupied",
        });
      }

      const program = await repository.getOrganizerProgram(event.id);
      expect(program?.sessions.find((session) => session.id === sourceA.id)).toMatchObject({
        startsAt: "2026-10-02T12:00:00.000Z",
        endsAt: "2026-10-02T13:00:00.000Z",
        locationId: destination.id,
      });
      expect(program?.sessions.find((session) => session.id === sourceB.id)).toMatchObject(sourceB);
    } finally {
      await blocker.query("ROLLBACK").catch(() => undefined);
      blocker.release();
      await writerA.close();
      await writerB.close();
    }
  });
});
