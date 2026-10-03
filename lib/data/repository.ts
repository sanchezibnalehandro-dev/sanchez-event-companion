import { randomUUID } from "node:crypto";

import type { CompanionEvent, ProgramAggregate, Session } from "@/lib/domain/types";
import { CURRENT_PRODUCT_TIMEZONE, toEpochMilliseconds, validateEvent } from "@/lib/domain/validation";

export type PublicProgramRead =
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "published"; program: ProgramAggregate };

export interface CompanionRepository {
  getPublicProgramBySlug(eventSlug: string): Promise<PublicProgramRead>;
  getOrganizerProgram(eventId: string): Promise<ProgramAggregate | null>;
  listOrganizerEvents(): Promise<CompanionEvent[]>;
  getOrganizerEvent(eventId: string): Promise<CompanionEvent | null>;
  createOrganizerEvent(input: CreateOrganizerEventInput): Promise<CompanionEvent>;
  createSession(write: SessionWrite): Promise<void>;
  updateSession(write: SessionUpdate): Promise<void>;
  deleteSession(eventId: string, sessionId: string): Promise<void>;
  reorderSessions(eventId: string, orderedSessionIds: readonly string[]): Promise<void>;
  setProgramPublished(eventId: string, publishedAt: string): Promise<void>;
  setProgramUnpublished(eventId: string): Promise<void>;
  setManualCurrentSession(
    eventId: string,
    sessionId: string,
    actorId: string,
    setAt: string,
  ): Promise<void>;
  clearManualCurrentSession(eventId: string): Promise<void>;
}

export interface CreateOrganizerEventInput {
  title: string;
  slug: string;
  timezone: string;
  startsAt: string;
  endsAt: string;
}

export type OrganizerEventErrorCode =
  | "title"
  | "slug"
  | "timezone"
  | "startsAt"
  | "endsAt"
  | "duplicate_slug";

export class OrganizerEventError extends Error {
  constructor(
    public readonly code: OrganizerEventErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OrganizerEventError";
  }
}

const ORGANIZER_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Validates untrusted organizer input before either persistence backend is touched. */
export function prepareOrganizerEvent(input: CreateOrganizerEventInput): CompanionEvent {
  if (!input.title.trim()) {
    throw new OrganizerEventError("title", "Event title is required");
  }
  if (!ORGANIZER_SLUG_PATTERN.test(input.slug)) {
    throw new OrganizerEventError("slug", "Event slug must use lowercase URL-safe words");
  }
  if (input.timezone !== CURRENT_PRODUCT_TIMEZONE) {
    throw new OrganizerEventError("timezone", "Unsupported event timezone");
  }

  let startsAt: number;
  try {
    startsAt = toEpochMilliseconds(input.startsAt);
  } catch {
    throw new OrganizerEventError("startsAt", "Event start must include a valid timezone offset");
  }
  let endsAt: number;
  try {
    endsAt = toEpochMilliseconds(input.endsAt);
  } catch {
    throw new OrganizerEventError("endsAt", "Event end must include a valid timezone offset");
  }
  if (endsAt <= startsAt) {
    throw new OrganizerEventError("endsAt", "Event end must be later than start");
  }

  const event: CompanionEvent = {
    id: randomUUID(),
    title: input.title.trim(),
    slug: input.slug,
    timezone: input.timezone,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    programState: "draft",
    publishedAt: null,
  };
  validateEvent(event);
  return event;
}

export interface SessionWrite {
  session: Session;
  speakerIds: string[];
}

export interface SessionUpdate extends SessionWrite {
  autoShiftFollowing: boolean;
}
