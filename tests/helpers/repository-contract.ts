import { describe, expect, it } from "vitest";

import type { CompanionRepository } from "@/lib/data/repository";
import type { ProgramAggregate, Session } from "@/lib/domain/types";
import {
  event,
  location,
  makeProgram,
  opening,
  panel,
  speakerOne,
  speakerTwo,
} from "@/tests/helpers/fixtures";

export interface RepositoryHarness {
  repository: CompanionRepository;
  close(): Promise<void>;
}

export type RepositoryHarnessFactory = (
  program: ProgramAggregate,
) => Promise<RepositoryHarness>;

export function defineRepositoryBehaviorContract(
  name: string,
  createHarness: RepositoryHarnessFactory,
): void {
  describe(`${name} repository behavior`, () => {
    it("reads the complete published aggregate", async () => {
      const harness = await createHarness(makeProgram());
      try {
        const result = await harness.repository.getPublicProgramBySlug(event.slug);
        expect(result.status).toBe("published");
        if (result.status === "published") {
          expect(result.program.sessions).toEqual([opening, panel]);
          expect(result.program.sessionSpeakers).toHaveLength(2);
          expect(result.program.liveSessionMappings).toHaveLength(1);
        }
      } finally {
        await harness.close();
      }
    });

    it("ripples one lane and replaces speakers atomically", async () => {
      const harness = await createHarness(makeProgram());
      try {
        await harness.repository.updateSession({
          session: { ...opening, endsAt: "2026-10-02T08:15:00.000Z" },
          speakerIds: [speakerOne.id, speakerTwo.id],
          autoShiftFollowing: true,
        });

        const updated = await harness.repository.getOrganizerProgram(event.id);
        expect(updated?.sessions.find((session) => session.id === panel.id)).toMatchObject({
          startsAt: "2026-10-02T08:30:00.000Z",
          endsAt: "2026-10-02T09:45:00.000Z",
        });
        expect(
          updated?.sessionSpeakers
            .filter((link) => link.sessionId === opening.id)
            .map((link) => link.speakerId),
        ).toEqual([speakerOne.id, speakerTwo.id]);
      } finally {
        await harness.close();
      }
    });

    it("cuts a session from its source lane and inserts it into another lane", async () => {
      const hallTwo = {
        id: "contract-location-hall-two",
        eventId: event.id,
        name: "Hall 2",
        sortOrder: 1,
      };
      const destinationNext: Session = {
        ...panel,
        id: "contract-session-hall-two-next",
        slug: "contract-hall-two-next",
        startsAt: "2026-10-02T08:45:00.000Z",
        endsAt: "2026-10-02T09:45:00.000Z",
        locationId: hallTwo.id,
      };
      const harness = await createHarness(
        makeProgram({
          locations: [location, hallTwo],
          sessions: [opening, panel, destinationNext],
        }),
      );
      try {
        await harness.repository.updateSession({
          session: {
            ...opening,
            startsAt: "2026-10-02T08:30:00.000Z",
            endsAt: "2026-10-02T09:00:00.000Z",
            locationId: hallTwo.id,
          },
          speakerIds: [],
          autoShiftFollowing: true,
        });

        const updated = await harness.repository.getOrganizerProgram(event.id);
        expect(updated?.sessions.find((session) => session.id === panel.id)).toMatchObject({
          startsAt: "2026-10-02T07:15:00.000Z",
          endsAt: "2026-10-02T08:30:00.000Z",
        });
        expect(
          updated?.sessions.find((session) => session.id === destinationNext.id),
        ).toMatchObject({
          startsAt: "2026-10-02T09:00:00.000Z",
          endsAt: "2026-10-02T10:00:00.000Z",
        });
      } finally {
        await harness.close();
      }
    });

    it("rolls back a destination collision", async () => {
      const hallTwo = {
        id: "contract-location-collision",
        eventId: event.id,
        name: "Collision hall",
        sortOrder: 1,
      };
      const occupied: Session = {
        ...panel,
        id: "contract-session-occupied",
        slug: "contract-occupied",
        startsAt: "2026-10-02T10:00:00.000Z",
        endsAt: "2026-10-02T11:00:00.000Z",
        locationId: hallTwo.id,
      };
      const initial = makeProgram({
        locations: [location, hallTwo],
        sessions: [opening, panel, occupied],
      });
      const harness = await createHarness(initial);
      try {
        await expect(
          harness.repository.updateSession({
            session: {
              ...opening,
              startsAt: "2026-10-02T10:30:00.000Z",
              endsAt: "2026-10-02T11:15:00.000Z",
              locationId: hallTwo.id,
            },
            speakerIds: [],
            autoShiftFollowing: true,
          }),
        ).rejects.toThrow("destination time is already occupied");
        expect((await harness.repository.getOrganizerProgram(event.id))?.sessions).toEqual(
          initial.sessions,
        );
      } finally {
        await harness.close();
      }
    });

    it("supports organizer lifecycle commands through the shared interface", async () => {
      const harness = await createHarness(
        makeProgram({ event: { ...event, programState: "draft", publishedAt: null } }),
      );
      const added: Session = {
        ...opening,
        id: "contract-session-added",
        slug: "contract-added",
        startsAt: "2026-10-02T10:00:00.000Z",
        endsAt: "2026-10-02T11:00:00.000Z",
        locationId: null,
        sortOrder: 2,
      };
      try {
        await harness.repository.createSession({ session: added, speakerIds: [speakerOne.id] });
        await harness.repository.reorderSessions(event.id, [added.id, opening.id, panel.id]);
        await harness.repository.setManualCurrentSession(
          event.id,
          added.id,
          "contract-organizer",
          "2026-10-02T09:30:00.000Z",
        );
        await harness.repository.setProgramPublished(event.id, "2026-10-02T06:30:00.000Z");

        const program = await harness.repository.getOrganizerProgram(event.id);
        expect(program?.sessions.map((session) => session.id)).toEqual([
          added.id,
          opening.id,
          panel.id,
        ]);
        expect(program?.runtime?.manualCurrentSessionId).toBe(added.id);
        expect((await harness.repository.getPublicProgramBySlug(event.slug)).status).toBe(
          "published",
        );

        await harness.repository.clearManualCurrentSession(event.id);
        await harness.repository.deleteSession(event.id, added.id);
        await harness.repository.setProgramUnpublished(event.id);
        await expect(harness.repository.getPublicProgramBySlug(event.slug)).resolves.toEqual({
          status: "unavailable",
        });
      } finally {
        await harness.close();
      }
    });
  });
}
