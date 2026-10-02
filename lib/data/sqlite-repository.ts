import { mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

import type {
  CompanionRepository,
  PublicProgramRead,
  SessionWrite,
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

type Row = Record<string, SQLInputValue>;

function text(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string") {
    throw new Error(`Expected text column ${key}`);
  }
  return value;
}

function nullableText(row: Row, key: string): string | null {
  const value = row[key];
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error(`Expected nullable text column ${key}`);
  }
  return value;
}

function integer(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== "number") {
    throw new Error(`Expected integer column ${key}`);
  }
  return value;
}

function mapEvent(row: Row): CompanionEvent {
  return {
    id: text(row, "id"),
    slug: text(row, "slug"),
    title: text(row, "title"),
    timezone: text(row, "timezone"),
    startsAt: text(row, "starts_at"),
    endsAt: text(row, "ends_at"),
    programState: text(row, "program_state") as CompanionEvent["programState"],
    publishedAt: nullableText(row, "published_at"),
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
    startsAt: text(row, "starts_at"),
    endsAt: text(row, "ends_at"),
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
    overrideSetAt: nullableText(row, "override_set_at"),
    overrideSetBy: nullableText(row, "override_set_by"),
  };
}

function mapLiveIntegration(row: Row): LiveIntegration {
  return {
    id: text(row, "id"),
    eventId: text(row, "event_id"),
    provider: text(row, "provider"),
    externalEventKey: text(row, "external_event_key"),
    enabled: integer(row, "enabled") === 1,
  };
}

function mapLiveSessionMapping(row: Row): LiveSessionMapping {
  return {
    sessionId: text(row, "session_id"),
    integrationId: text(row, "integration_id"),
    externalRoomSlug: text(row, "external_room_slug"),
  };
}

export class SqliteCompanionRepository implements CompanionRepository {
  constructor(private readonly database: DatabaseSync, migrate = true) {
    this.database.exec("PRAGMA foreign_keys = ON;");
    if (migrate) {
      const migrationPath = join(process.cwd(), "db", "migrations", "0001_initial.sql");
      this.database.exec(readFileSync(migrationPath, "utf8"));
    }
  }

  static open(databasePath: string): SqliteCompanionRepository {
    const resolvedPath =
      databasePath === ":memory:"
        ? databasePath
        : isAbsolute(databasePath)
          ? databasePath
          : resolve(/* turbopackIgnore: true */ process.cwd(), databasePath);
    if (resolvedPath !== ":memory:") {
      mkdirSync(dirname(resolvedPath), { recursive: true });
    }
    return new SqliteCompanionRepository(new DatabaseSync(resolvedPath));
  }

  close(): void {
    this.database.close();
  }

  private transaction<T>(operation: () => T): T {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  saveEvent(event: CompanionEvent): void {
    validateEvent(event);
    this.database
      .prepare(
        `INSERT INTO events (
          id, slug, title, timezone, starts_at, ends_at, program_state, published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        event.slug,
        event.title,
        event.timezone,
        normalizeInstant(event.startsAt),
        normalizeInstant(event.endsAt),
        event.programState,
        event.publishedAt ? normalizeInstant(event.publishedAt) : null,
      );
  }

  saveLocation(location: Location): void {
    this.database
      .prepare(
        "INSERT INTO locations (id, event_id, name, sort_order) VALUES (?, ?, ?, ?)",
      )
      .run(location.id, location.eventId, location.name, location.sortOrder);
  }

  saveSession(session: Session): void {
    validateSession(session);
    this.database
      .prepare(
        `INSERT INTO sessions (
          id, event_id, slug, title, summary, starts_at, ends_at, location_id, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        session.id,
        session.eventId,
        session.slug,
        session.title,
        session.summary,
        normalizeInstant(session.startsAt),
        normalizeInstant(session.endsAt),
        session.locationId,
        session.sortOrder,
      );
  }

  saveSpeaker(speaker: Speaker): void {
    this.database
      .prepare(
        `INSERT INTO speakers (
          id, event_id, name, role, company, bio, photo_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        speaker.id,
        speaker.eventId,
        speaker.name,
        speaker.role,
        speaker.company,
        speaker.bio,
        speaker.photoUrl,
      );
  }

  saveSessionSpeaker(link: SessionSpeaker): void {
    this.database
      .prepare(
        `INSERT INTO session_speakers (
          session_id, speaker_id, sort_order, session_role
        ) VALUES (?, ?, ?, ?)`,
      )
      .run(link.sessionId, link.speakerId, link.sortOrder, link.sessionRole);
  }

  saveRuntime(runtime: EventRuntime): void {
    this.database
      .prepare(
        `INSERT INTO event_runtime (
          event_id, manual_current_session_id, override_set_at, override_set_by
        ) VALUES (?, ?, ?, ?)`,
      )
      .run(
        runtime.eventId,
        runtime.manualCurrentSessionId,
        runtime.overrideSetAt ? normalizeInstant(runtime.overrideSetAt) : null,
        runtime.overrideSetBy,
      );
  }

  saveLiveIntegration(integration: LiveIntegration): void {
    validateLiveIntegration(integration);
    this.database
      .prepare(
        `INSERT INTO live_integrations (
          id, event_id, provider, external_event_key, enabled
        ) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        integration.id,
        integration.eventId,
        integration.provider,
        integration.externalEventKey,
        integration.enabled ? 1 : 0,
      );
  }

  saveLiveSessionMapping(mapping: LiveSessionMapping): void {
    validateLiveSessionMapping(mapping);
    this.database
      .prepare(
        `INSERT INTO live_session_mappings (
          session_id, integration_id, external_room_slug
        ) VALUES (?, ?, ?)`,
      )
      .run(mapping.sessionId, mapping.integrationId, mapping.externalRoomSlug);
  }

  createSession(write: SessionWrite): void {
    validateSession(write.session);
    this.transaction(() => {
      this.saveSession(write.session);
      this.replaceSessionSpeakers(write.session.eventId, write.session.id, write.speakerIds);
    });
  }

  updateSession(write: SessionWrite): void {
    validateSession(write.session);
    this.transaction(() => {
      const result = this.database
        .prepare(
          `UPDATE sessions SET
            slug = ?, title = ?, summary = ?, starts_at = ?, ends_at = ?,
            location_id = ?, sort_order = ?
           WHERE id = ? AND event_id = ?`,
        )
        .run(
          write.session.slug,
          write.session.title,
          write.session.summary,
          normalizeInstant(write.session.startsAt),
          normalizeInstant(write.session.endsAt),
          write.session.locationId,
          write.session.sortOrder,
          write.session.id,
          write.session.eventId,
        );
      if (result.changes !== 1) throw new Error("Session was not found");
      this.replaceSessionSpeakers(write.session.eventId, write.session.id, write.speakerIds);
    });
  }

  deleteSession(eventId: string, sessionId: string): void {
    this.transaction(() => {
      const runtime = this.database
        .prepare(
          `SELECT manual_current_session_id FROM event_runtime
           WHERE event_id = ? AND manual_current_session_id = ?`,
        )
        .get(eventId, sessionId);
      if (runtime) {
        throw new Error("Clear the manual current override before deleting this session");
      }
      const result = this.database
        .prepare("DELETE FROM sessions WHERE id = ? AND event_id = ?")
        .run(sessionId, eventId);
      if (result.changes !== 1) throw new Error("Session was not found");
    });
  }

  reorderSessions(eventId: string, orderedSessionIds: readonly string[]): void {
    this.transaction(() => {
      const rows = this.database
        .prepare("SELECT id FROM sessions WHERE event_id = ? ORDER BY id")
        .all(eventId) as Row[];
      const existing = rows.map((row) => text(row, "id")).sort();
      const requested = [...orderedSessionIds].sort();
      if (
        existing.length !== requested.length ||
        new Set(requested).size !== requested.length ||
        existing.some((id, index) => id !== requested[index])
      ) {
        throw new Error("Reorder must contain every event session exactly once");
      }

      const statement = this.database.prepare(
        "UPDATE sessions SET sort_order = ? WHERE id = ? AND event_id = ?",
      );
      orderedSessionIds.forEach((sessionId, sortOrder) => {
        const result = statement.run(sortOrder, sessionId, eventId);
        if (result.changes !== 1) throw new Error("Reorder failed");
      });
    });
  }

  setProgramPublished(eventId: string, publishedAt: string): void {
    const result = this.database
      .prepare(
        "UPDATE events SET program_state = 'published', published_at = ? WHERE id = ?",
      )
      .run(normalizeInstant(publishedAt), eventId);
    if (result.changes !== 1) throw new Error("Event was not found");
  }

  setProgramUnpublished(eventId: string): void {
    const result = this.database
      .prepare("UPDATE events SET program_state = 'unpublished' WHERE id = ?")
      .run(eventId);
    if (result.changes !== 1) throw new Error("Event was not found");
  }

  setManualCurrentSession(
    eventId: string,
    sessionId: string,
    actorId: string,
    setAt: string,
  ): void {
    const result = this.database
      .prepare("SELECT id FROM sessions WHERE id = ? AND event_id = ?")
      .get(sessionId, eventId);
    if (!result) throw new Error("Manual current session must belong to the event");

    this.database
      .prepare(
        `INSERT INTO event_runtime (
          event_id, manual_current_session_id, override_set_at, override_set_by
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(event_id) DO UPDATE SET
          manual_current_session_id = excluded.manual_current_session_id,
          override_set_at = excluded.override_set_at,
          override_set_by = excluded.override_set_by`,
      )
      .run(eventId, sessionId, normalizeInstant(setAt), actorId);
  }

  clearManualCurrentSession(eventId: string): void {
    this.database
      .prepare(
        `INSERT INTO event_runtime (
          event_id, manual_current_session_id, override_set_at, override_set_by
        ) VALUES (?, NULL, NULL, NULL)
        ON CONFLICT(event_id) DO UPDATE SET
          manual_current_session_id = NULL,
          override_set_at = NULL,
          override_set_by = NULL`,
      )
      .run(eventId);
  }

  getPublicProgramBySlug(eventSlug: string): PublicProgramRead {
    const visibility = this.database
      .prepare("SELECT id, program_state FROM events WHERE slug = ?")
      .get(eventSlug) as Row | undefined;

    if (!visibility || text(visibility, "program_state") === "draft") {
      return { status: "not_found" };
    }
    if (text(visibility, "program_state") === "unpublished") {
      return { status: "unavailable" };
    }

    const program = this.getProgramByEventId(text(visibility, "id"));
    if (!program || program.event.programState !== "published") {
      throw new Error("Published program changed while it was being read");
    }
    validateProgramAggregate(program);
    return { status: "published", program };
  }

  getOrganizerProgram(eventId: string): ProgramAggregate | null {
    const program = this.getProgramByEventId(eventId);
    if (program) validateProgramAggregate(program);
    return program;
  }

  private replaceSessionSpeakers(
    eventId: string,
    sessionId: string,
    speakerIds: readonly string[],
  ): void {
    if (new Set(speakerIds).size !== speakerIds.length) {
      throw new Error("A speaker can only be assigned once");
    }
    const session = this.database
      .prepare("SELECT id FROM sessions WHERE id = ? AND event_id = ?")
      .get(sessionId, eventId);
    if (!session) throw new Error("Session was not found");

    const validSpeakers = this.database
      .prepare("SELECT id FROM speakers WHERE event_id = ?")
      .all(eventId) as Row[];
    const validIds = new Set(validSpeakers.map((row) => text(row, "id")));
    if (speakerIds.some((speakerId) => !validIds.has(speakerId))) {
      throw new Error("Every assigned speaker must belong to the event");
    }

    this.database
      .prepare("DELETE FROM session_speakers WHERE session_id = ?")
      .run(sessionId);
    const insert = this.database.prepare(
      `INSERT INTO session_speakers (
        session_id, speaker_id, sort_order, session_role
      ) VALUES (?, ?, ?, NULL)`,
    );
    speakerIds.forEach((speakerId, sortOrder) => insert.run(sessionId, speakerId, sortOrder));
  }

  private getProgramByEventId(eventId: string): ProgramAggregate | null {
    const eventRow = this.database
      .prepare("SELECT * FROM events WHERE id = ?")
      .get(eventId) as Row | undefined;
    if (!eventRow) return null;

    const all = (sql: string): Row[] => this.database.prepare(sql).all(eventId) as Row[];
    const runtimeRow = this.database
      .prepare("SELECT * FROM event_runtime WHERE event_id = ?")
      .get(eventId) as Row | undefined;

    return {
      event: mapEvent(eventRow),
      locations: all("SELECT * FROM locations WHERE event_id = ? ORDER BY sort_order, id").map(
        mapLocation,
      ),
      sessions: all(
        "SELECT * FROM sessions WHERE event_id = ? ORDER BY sort_order, starts_at, id",
      ).map(mapSession),
      speakers: all("SELECT * FROM speakers WHERE event_id = ? ORDER BY name, id").map(
        mapSpeaker,
      ),
      sessionSpeakers: all(
        `SELECT link.* FROM session_speakers AS link
         JOIN sessions AS session ON session.id = link.session_id
         WHERE session.event_id = ?
         ORDER BY link.session_id, link.sort_order, link.speaker_id`,
      ).map(mapSessionSpeaker),
      runtime: runtimeRow ? mapRuntime(runtimeRow) : null,
      liveIntegrations: all(
        "SELECT * FROM live_integrations WHERE event_id = ? ORDER BY provider, id",
      ).map(mapLiveIntegration),
      liveSessionMappings: all(
        `SELECT mapping.* FROM live_session_mappings AS mapping
         JOIN sessions AS session ON session.id = mapping.session_id
         WHERE session.event_id = ?
         ORDER BY mapping.session_id, mapping.integration_id`,
      ).map(mapLiveSessionMapping),
    };
  }
}
