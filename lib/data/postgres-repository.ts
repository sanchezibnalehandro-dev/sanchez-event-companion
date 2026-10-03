import { Pool, type PoolClient, type QueryResultRow } from "pg";

import { createPostgresPoolConfig } from "./postgres-connection.ts";
import {
  OrganizerEventError,
  prepareOrganizerEvent,
  type CompanionRepository,
  type PublicProgramRead,
  type SessionUpdate,
  type SessionWrite,
} from "@/lib/data/repository";
import type {
  CompanionEvent,
  EventRuntime,
  LiveIntegration,
  LiveSessionMapping,
  Location,
  ProgramAggregate,
  Session,
  SessionSpeaker,
  Speaker,
} from "@/lib/domain/types";
import {
  normalizeInstant,
  validateEvent,
  validateLiveIntegration,
  validateLiveSessionMapping,
  validateProgramAggregate,
  validateSession,
} from "@/lib/domain/validation";

type Row = QueryResultRow;

function text(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Expected text column ${key}`);
  return value;
}

function nullableText(row: Row, key: string): string | null {
  const value = row[key];
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(`Expected nullable text column ${key}`);
  return value;
}

function instant(row: Row, key: string): string {
  const value = row[key];
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return normalizeInstant(value);
  throw new Error(`Expected timestamp column ${key}`);
}

function nullableInstant(row: Row, key: string): string | null {
  if (row[key] === null) return null;
  return instant(row, key);
}

function integer(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== "number") throw new Error(`Expected integer column ${key}`);
  return value;
}

function boolean(row: Row, key: string): boolean {
  const value = row[key];
  if (typeof value !== "boolean") throw new Error(`Expected boolean column ${key}`);
  return value;
}

function isDuplicateSlugError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function mapEvent(row: Row): CompanionEvent {
  return {
    id: text(row, "id"),
    slug: text(row, "slug"),
    title: text(row, "title"),
    timezone: text(row, "timezone"),
    startsAt: instant(row, "starts_at"),
    endsAt: instant(row, "ends_at"),
    programState: text(row, "program_state") as CompanionEvent["programState"],
    publishedAt: nullableInstant(row, "published_at"),
  };
}

function mapLocation(row: Row): Location {
  return {
    id: text(row, "id"),
    eventId: text(row, "event_id"),
    name: text(row, "name"),
    sortOrder: integer(row, "sort_order"),
  };
}

function mapSession(row: Row): Session {
  return {
    id: text(row, "id"),
    eventId: text(row, "event_id"),
    slug: text(row, "slug"),
    title: text(row, "title"),
    summary: text(row, "summary"),
    startsAt: instant(row, "starts_at"),
    endsAt: instant(row, "ends_at"),
    locationId: nullableText(row, "location_id"),
    sortOrder: integer(row, "sort_order"),
  };
}

function mapSpeaker(row: Row): Speaker {
  return {
    id: text(row, "id"),
    eventId: text(row, "event_id"),
    name: text(row, "name"),
    role: nullableText(row, "role"),
    company: nullableText(row, "company"),
    bio: nullableText(row, "bio"),
    photoUrl: nullableText(row, "photo_url"),
  };
}

function mapSessionSpeaker(row: Row): SessionSpeaker {
  return {
    sessionId: text(row, "session_id"),
    speakerId: text(row, "speaker_id"),
    sortOrder: integer(row, "sort_order"),
    sessionRole: nullableText(row, "session_role"),
  };
}

function mapRuntime(row: Row): EventRuntime {
  return {
    eventId: text(row, "event_id"),
    manualCurrentSessionId: nullableText(row, "manual_current_session_id"),
    overrideSetAt: nullableInstant(row, "override_set_at"),
    overrideSetBy: nullableText(row, "override_set_by"),
  };
}

function mapLiveIntegration(row: Row): LiveIntegration {
  return {
    id: text(row, "id"),
    eventId: text(row, "event_id"),
    provider: text(row, "provider"),
    externalEventKey: text(row, "external_event_key"),
    enabled: boolean(row, "enabled"),
  };
}

function mapLiveSessionMapping(row: Row): LiveSessionMapping {
  return {
    sessionId: text(row, "session_id"),
    integrationId: text(row, "integration_id"),
    externalRoomSlug: text(row, "external_room_slug"),
  };
}

export class PostgresCompanionRepository implements CompanionRepository {
  constructor(private readonly pool: Pool) {}

  static open(connectionString: string): PostgresCompanionRepository {
    return new PostgresCompanionRepository(
      new Pool(createPostgresPoolConfig(connectionString)),
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async readTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async lockEvent(client: PoolClient, eventId: string): Promise<void> {
    const result = await client.query("SELECT id FROM events WHERE id = $1 FOR UPDATE", [eventId]);
    if (result.rowCount !== 1) throw new Error("Event was not found");
  }

  async saveEvent(event: CompanionEvent): Promise<void> {
    validateEvent(event);
    await this.pool.query(
      `INSERT INTO events (
        id, slug, title, timezone, starts_at, ends_at, program_state, published_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        event.id,
        event.slug,
        event.title,
        event.timezone,
        normalizeInstant(event.startsAt),
        normalizeInstant(event.endsAt),
        event.programState,
        event.publishedAt ? normalizeInstant(event.publishedAt) : null,
      ],
    );
  }

  async saveLocation(location: Location): Promise<void> {
    await this.pool.query(
      "INSERT INTO locations (id, event_id, name, sort_order) VALUES ($1, $2, $3, $4)",
      [location.id, location.eventId, location.name, location.sortOrder],
    );
  }

  async saveSession(session: Session): Promise<void> {
    validateSession(session);
    await this.pool.query(
      `INSERT INTO sessions (
        id, event_id, slug, title, summary, starts_at, ends_at, location_id, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        session.id,
        session.eventId,
        session.slug,
        session.title,
        session.summary,
        normalizeInstant(session.startsAt),
        normalizeInstant(session.endsAt),
        session.locationId,
        session.sortOrder,
      ],
    );
  }

  async saveSpeaker(speaker: Speaker): Promise<void> {
    await this.pool.query(
      `INSERT INTO speakers (
        id, event_id, name, role, company, bio, photo_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        speaker.id,
        speaker.eventId,
        speaker.name,
        speaker.role,
        speaker.company,
        speaker.bio,
        speaker.photoUrl,
      ],
    );
  }

  async saveSessionSpeaker(link: SessionSpeaker): Promise<void> {
    await this.pool.query(
      `INSERT INTO session_speakers (
        session_id, speaker_id, sort_order, session_role
      ) VALUES ($1, $2, $3, $4)`,
      [link.sessionId, link.speakerId, link.sortOrder, link.sessionRole],
    );
  }

  async saveRuntime(runtime: EventRuntime): Promise<void> {
    await this.pool.query(
      `INSERT INTO event_runtime (
        event_id, manual_current_session_id, override_set_at, override_set_by
      ) VALUES ($1, $2, $3, $4)`,
      [
        runtime.eventId,
        runtime.manualCurrentSessionId,
        runtime.overrideSetAt ? normalizeInstant(runtime.overrideSetAt) : null,
        runtime.overrideSetBy,
      ],
    );
  }

  async saveLiveIntegration(integration: LiveIntegration): Promise<void> {
    validateLiveIntegration(integration);
    await this.pool.query(
      `INSERT INTO live_integrations (
        id, event_id, provider, external_event_key, enabled
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        integration.id,
        integration.eventId,
        integration.provider,
        integration.externalEventKey,
        integration.enabled,
      ],
    );
  }

  async saveLiveSessionMapping(mapping: LiveSessionMapping): Promise<void> {
    validateLiveSessionMapping(mapping);
    await this.pool.query(
      `INSERT INTO live_session_mappings (
        session_id, integration_id, external_room_slug
      ) VALUES ($1, $2, $3)`,
      [mapping.sessionId, mapping.integrationId, mapping.externalRoomSlug],
    );
  }

  async createSession(write: SessionWrite): Promise<void> {
    validateSession(write.session);
    await this.transaction(async (client) => {
      await this.lockEvent(client, write.session.eventId);
      await client.query(
        `INSERT INTO sessions (
          id, event_id, slug, title, summary, starts_at, ends_at, location_id, sort_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          write.session.id,
          write.session.eventId,
          write.session.slug,
          write.session.title,
          write.session.summary,
          normalizeInstant(write.session.startsAt),
          normalizeInstant(write.session.endsAt),
          write.session.locationId,
          write.session.sortOrder,
        ],
      );
      await this.replaceSessionSpeakers(client, write.session.eventId, write.session.id, write.speakerIds);
    });
  }

  async updateSession(write: SessionUpdate): Promise<void> {
    validateSession(write.session);
    await this.transaction(async (client) => {
      await this.lockEvent(client, write.session.eventId);
      const locked = await client.query(
        `SELECT id, starts_at, ends_at, location_id, sort_order
         FROM sessions WHERE event_id = $1 ORDER BY id FOR UPDATE`,
        [write.session.eventId],
      );
      const existingRow = locked.rows.find((row) => text(row, "id") === write.session.id);
      if (!existingRow) throw new Error("Session was not found");

      const existingLocationId = nullableText(existingRow, "location_id");
      const locationUnchanged = existingLocationId === write.session.locationId;
      const oldStart = instant(existingRow, "starts_at");
      const oldEnd = instant(existingRow, "ends_at");
      const laneRows = (locationId: string | null, threshold: string): Row[] =>
        locked.rows
          .filter((row) => text(row, "id") !== write.session.id)
          .filter((row) => nullableText(row, "location_id") === locationId)
          .filter((row) => instant(row, "starts_at") >= threshold)
          .sort((a, b) => {
            const byStart = instant(a, "starts_at").localeCompare(instant(b, "starts_at"));
            if (byStart !== 0) return byStart;
            const byOrder = integer(a, "sort_order") - integer(b, "sort_order");
            return byOrder !== 0 ? byOrder : text(a, "id").localeCompare(text(b, "id"));
          });
      const shiftRows = async (rows: readonly Row[], delta: number): Promise<void> => {
        if (delta === 0) return;
        for (const row of rows) {
          await client.query(
            `UPDATE sessions SET starts_at = $1, ends_at = $2
             WHERE id = $3 AND event_id = $4`,
            [
              new Date(new Date(instant(row, "starts_at")).getTime() + delta).toISOString(),
              new Date(new Date(instant(row, "ends_at")).getTime() + delta).toISOString(),
              text(row, "id"),
              write.session.eventId,
            ],
          );
        }
      };

      if (write.autoShiftFollowing && locationUnchanged) {
        const followingRows = laneRows(existingLocationId, oldEnd);
        const followingIds = new Set(followingRows.map((row) => text(row, "id")));
        const newStartEpoch = new Date(write.session.startsAt).getTime();
        const newEndEpoch = new Date(write.session.endsAt).getTime();
        const conflictsWithNonRippledSession = laneRows(
          existingLocationId,
          "0000-01-01T00:00:00.000Z",
        )
          .filter((row) => !followingIds.has(text(row, "id")))
          .some((row) => {
            const startsAt = new Date(instant(row, "starts_at")).getTime();
            const endsAt = new Date(instant(row, "ends_at")).getTime();
            return startsAt < newEndEpoch && newStartEpoch < endsAt;
          });
        if (conflictsWithNonRippledSession) {
          throw new Error("session time is already occupied in this location");
        }

        const delta = new Date(write.session.endsAt).getTime() - new Date(oldEnd).getTime();
        await shiftRows(followingRows, delta);
      } else if (write.autoShiftFollowing) {
        const destinationRows = laneRows(
          write.session.locationId,
          "0000-01-01T00:00:00.000Z",
        );
        const newStartEpoch = new Date(write.session.startsAt).getTime();
        const destinationOccupied = destinationRows.some((row) => {
          const startsAt = new Date(instant(row, "starts_at")).getTime();
          const endsAt = new Date(instant(row, "ends_at")).getTime();
          return startsAt < newStartEpoch && newStartEpoch < endsAt;
        });
        if (destinationOccupied) throw new Error("destination time is already occupied");

        const oldDuration = new Date(oldEnd).getTime() - new Date(oldStart).getTime();
        const destinationFollowing = destinationRows.filter(
          (row) => new Date(instant(row, "starts_at")).getTime() >= newStartEpoch,
        );
        const nextStart = destinationFollowing[0]
          ? new Date(instant(destinationFollowing[0], "starts_at")).getTime()
          : null;
        const overlap =
          nextStart === null
            ? 0
            : Math.max(0, new Date(write.session.endsAt).getTime() - nextStart);

        await shiftRows(laneRows(existingLocationId, oldEnd), -oldDuration);
        await shiftRows(destinationFollowing, overlap);
      }

      const result = await client.query(
        `UPDATE sessions SET
          slug = $1, title = $2, summary = $3, starts_at = $4, ends_at = $5,
          location_id = $6, sort_order = $7
         WHERE id = $8 AND event_id = $9`,
        [
          write.session.slug,
          write.session.title,
          write.session.summary,
          normalizeInstant(write.session.startsAt),
          normalizeInstant(write.session.endsAt),
          write.session.locationId,
          write.session.sortOrder,
          write.session.id,
          write.session.eventId,
        ],
      );
      if (result.rowCount !== 1) throw new Error("Session was not found");
      await this.replaceSessionSpeakers(client, write.session.eventId, write.session.id, write.speakerIds);
    });
  }

  async deleteSession(eventId: string, sessionId: string): Promise<void> {
    await this.transaction(async (client) => {
      await this.lockEvent(client, eventId);
      await client.query("SELECT id FROM sessions WHERE event_id = $1 ORDER BY id FOR UPDATE", [eventId]);
      const runtime = await client.query(
        `SELECT manual_current_session_id FROM event_runtime
         WHERE event_id = $1 AND manual_current_session_id = $2`,
        [eventId, sessionId],
      );
      if (runtime.rowCount) {
        throw new Error("Clear the manual current override before deleting this session");
      }
      const result = await client.query("DELETE FROM sessions WHERE id = $1 AND event_id = $2", [
        sessionId,
        eventId,
      ]);
      if (result.rowCount !== 1) throw new Error("Session was not found");
    });
  }

  async reorderSessions(eventId: string, orderedSessionIds: readonly string[]): Promise<void> {
    await this.transaction(async (client) => {
      await this.lockEvent(client, eventId);
      const rows = await client.query(
        "SELECT id FROM sessions WHERE event_id = $1 ORDER BY id FOR UPDATE",
        [eventId],
      );
      const existing = rows.rows.map((row) => text(row, "id")).sort();
      const requested = [...orderedSessionIds].sort();
      if (
        existing.length !== requested.length ||
        new Set(requested).size !== requested.length ||
        existing.some((id, index) => id !== requested[index])
      ) {
        throw new Error("Reorder must contain every event session exactly once");
      }
      for (const [sortOrder, sessionId] of orderedSessionIds.entries()) {
        const result = await client.query(
          "UPDATE sessions SET sort_order = $1 WHERE id = $2 AND event_id = $3",
          [sortOrder, sessionId, eventId],
        );
        if (result.rowCount !== 1) throw new Error("Reorder failed");
      }
    });
  }

  async setProgramPublished(eventId: string, publishedAt: string): Promise<void> {
    await this.transaction(async (client) => {
      await this.lockEvent(client, eventId);
      await client.query(
        "UPDATE events SET program_state = 'published', published_at = $1 WHERE id = $2",
        [normalizeInstant(publishedAt), eventId],
      );
    });
  }

  async setProgramUnpublished(eventId: string): Promise<void> {
    await this.transaction(async (client) => {
      await this.lockEvent(client, eventId);
      await client.query("UPDATE events SET program_state = 'unpublished' WHERE id = $1", [eventId]);
    });
  }

  async setManualCurrentSession(
    eventId: string,
    sessionId: string,
    actorId: string,
    setAt: string,
  ): Promise<void> {
    await this.transaction(async (client) => {
      await this.lockEvent(client, eventId);
      const session = await client.query("SELECT id FROM sessions WHERE id = $1 AND event_id = $2", [
        sessionId,
        eventId,
      ]);
      if (session.rowCount !== 1) {
        throw new Error("Manual current session must belong to the event");
      }
      await client.query(
        `INSERT INTO event_runtime (
          event_id, manual_current_session_id, override_set_at, override_set_by
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT(event_id) DO UPDATE SET
          manual_current_session_id = EXCLUDED.manual_current_session_id,
          override_set_at = EXCLUDED.override_set_at,
          override_set_by = EXCLUDED.override_set_by`,
        [eventId, sessionId, normalizeInstant(setAt), actorId],
      );
    });
  }

  async clearManualCurrentSession(eventId: string): Promise<void> {
    await this.transaction(async (client) => {
      await this.lockEvent(client, eventId);
      await client.query(
        `INSERT INTO event_runtime (
          event_id, manual_current_session_id, override_set_at, override_set_by
        ) VALUES ($1, NULL, NULL, NULL)
        ON CONFLICT(event_id) DO UPDATE SET
          manual_current_session_id = NULL,
          override_set_at = NULL,
          override_set_by = NULL`,
        [eventId],
      );
    });
  }

  async getPublicProgramBySlug(eventSlug: string): Promise<PublicProgramRead> {
    return this.readTransaction(async (client) => {
      const visibility = await client.query(
        "SELECT id, program_state FROM events WHERE slug = $1",
        [eventSlug],
      );
      const row = visibility.rows[0];
      if (!row || text(row, "program_state") === "draft") return { status: "not_found" };
      if (text(row, "program_state") === "unpublished") return { status: "unavailable" };

      const program = await this.getProgramByEventId(client, text(row, "id"));
      if (!program || program.event.programState === "draft") return { status: "not_found" };
      if (program.event.programState === "unpublished") return { status: "unavailable" };
      validateProgramAggregate(program);
      return { status: "published", program };
    });
  }

  async getOrganizerProgram(eventId: string): Promise<ProgramAggregate | null> {
    return this.readTransaction(async (client) => {
      const program = await this.getProgramByEventId(client, eventId);
      if (program) validateProgramAggregate(program);
      return program;
    });
  }

  async listOrganizerEvents(): Promise<CompanionEvent[]> {
    const result = await this.pool.query("SELECT * FROM events ORDER BY starts_at ASC, id ASC");
    return result.rows.map(mapEvent);
  }

  async getOrganizerEvent(eventId: string): Promise<CompanionEvent | null> {
    const result = await this.pool.query("SELECT * FROM events WHERE id = $1", [eventId]);
    return result.rows[0] ? mapEvent(result.rows[0]) : null;
  }

  async createOrganizerEvent(input: Parameters<typeof prepareOrganizerEvent>[0]): Promise<CompanionEvent> {
    const event = prepareOrganizerEvent(input);
    try {
      await this.transaction(async (client) => {
        await client.query(
          `INSERT INTO events (
            id, slug, title, timezone, starts_at, ends_at, program_state, published_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 'draft', NULL)`,
          [
            event.id,
            event.slug,
            event.title,
            event.timezone,
            normalizeInstant(event.startsAt),
            normalizeInstant(event.endsAt),
          ],
        );
      });
    } catch (error) {
      if (isDuplicateSlugError(error)) {
        throw new OrganizerEventError("duplicate_slug", "An event with this slug already exists");
      }
      throw error;
    }
    return { ...event, startsAt: normalizeInstant(event.startsAt), endsAt: normalizeInstant(event.endsAt) };
  }

  private async replaceSessionSpeakers(
    client: PoolClient,
    eventId: string,
    sessionId: string,
    speakerIds: readonly string[],
  ): Promise<void> {
    if (new Set(speakerIds).size !== speakerIds.length) {
      throw new Error("A speaker can only be assigned once");
    }
    const session = await client.query("SELECT id FROM sessions WHERE id = $1 AND event_id = $2", [
      sessionId,
      eventId,
    ]);
    if (session.rowCount !== 1) throw new Error("Session was not found");

    const validSpeakers = await client.query("SELECT id FROM speakers WHERE event_id = $1", [eventId]);
    const validIds = new Set(validSpeakers.rows.map((row) => text(row, "id")));
    if (speakerIds.some((speakerId) => !validIds.has(speakerId))) {
      throw new Error("Every assigned speaker must belong to the event");
    }

    const existingLinks = await client.query(
      `SELECT speaker_id, session_role FROM session_speakers
       WHERE session_id = $1`,
      [sessionId],
    );
    const existingRoles = new Map(
      existingLinks.rows.map((row) => [text(row, "speaker_id"), nullableText(row, "session_role")]),
    );

    await client.query("DELETE FROM session_speakers WHERE session_id = $1", [sessionId]);
    for (const [sortOrder, speakerId] of speakerIds.entries()) {
      await client.query(
        `INSERT INTO session_speakers (
          session_id, speaker_id, sort_order, session_role
        ) VALUES ($1, $2, $3, $4)`,
        [sessionId, speakerId, sortOrder, existingRoles.get(speakerId) ?? null],
      );
    }
  }

  private async getProgramByEventId(
    client: PoolClient,
    eventId: string,
  ): Promise<ProgramAggregate | null> {
    const eventResult = await client.query("SELECT * FROM events WHERE id = $1", [eventId]);
    if (!eventResult.rows[0]) return null;

    const locations = await client.query(
      "SELECT * FROM locations WHERE event_id = $1 ORDER BY sort_order, id",
      [eventId],
    );
    const sessions = await client.query(
      "SELECT * FROM sessions WHERE event_id = $1 ORDER BY sort_order, starts_at, id",
      [eventId],
    );
    const speakers = await client.query(
      "SELECT * FROM speakers WHERE event_id = $1 ORDER BY name, id",
      [eventId],
    );
    const sessionSpeakers = await client.query(
      `SELECT link.* FROM session_speakers AS link
       JOIN sessions AS session ON session.id = link.session_id
       WHERE session.event_id = $1
       ORDER BY link.session_id, link.sort_order, link.speaker_id`,
      [eventId],
    );
    const runtime = await client.query("SELECT * FROM event_runtime WHERE event_id = $1", [eventId]);
    const liveIntegrations = await client.query(
      "SELECT * FROM live_integrations WHERE event_id = $1 ORDER BY provider, id",
      [eventId],
    );
    const liveSessionMappings = await client.query(
      `SELECT mapping.* FROM live_session_mappings AS mapping
       JOIN sessions AS session ON session.id = mapping.session_id
       WHERE session.event_id = $1
       ORDER BY mapping.session_id, mapping.integration_id`,
      [eventId],
    );

    return {
      event: mapEvent(eventResult.rows[0]),
      locations: locations.rows.map(mapLocation),
      sessions: sessions.rows.map(mapSession),
      speakers: speakers.rows.map(mapSpeaker),
      sessionSpeakers: sessionSpeakers.rows.map(mapSessionSpeaker),
      runtime: runtime.rows[0] ? mapRuntime(runtime.rows[0]) : null,
      liveIntegrations: liveIntegrations.rows.map(mapLiveIntegration),
      liveSessionMappings: liveSessionMappings.rows.map(mapLiveSessionMapping),
    };
  }
}
