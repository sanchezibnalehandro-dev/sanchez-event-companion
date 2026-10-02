import type {
  CompanionEvent,
  LiveIntegration,
  LiveSessionMapping,
  ProgramAggregate,
  Session,
} from "@/lib/domain/types";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PROVIDER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OFFSET_TIMESTAMP_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/;

export function toEpochMilliseconds(value: string): number {
  if (!OFFSET_TIMESTAMP_PATTERN.test(value)) {
    throw new Error(`Timestamp must include a timezone offset: ${value}`);
  }

  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) {
    throw new Error(`Invalid timestamp: ${value}`);
  }

  return epoch;
}

export function normalizeInstant(value: string): string {
  return new Date(toEpochMilliseconds(value)).toISOString();
}

export function isIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return value.includes("/") || value === "UTC";
  } catch {
    return false;
  }
}

export function validateEvent(event: CompanionEvent): void {
  if (!SLUG_PATTERN.test(event.slug)) {
    throw new Error("Event slug must use lowercase URL-safe words");
  }
  if (!event.title.trim()) {
    throw new Error("Event title is required");
  }
  if (!isIanaTimeZone(event.timezone)) {
    throw new Error(`Invalid IANA timezone: ${event.timezone}`);
  }
  if (toEpochMilliseconds(event.endsAt) <= toEpochMilliseconds(event.startsAt)) {
    throw new Error("Event endsAt must be later than startsAt");
  }
  if (event.programState === "published" && event.publishedAt === null) {
    throw new Error("Published events require publishedAt");
  }
}

export function validateSession(session: Session): void {
  if (!SLUG_PATTERN.test(session.slug)) {
    throw new Error("Session slug must use lowercase URL-safe words");
  }
  if (!session.title.trim()) {
    throw new Error("Session title is required");
  }
  if (toEpochMilliseconds(session.endsAt) <= toEpochMilliseconds(session.startsAt)) {
    throw new Error("Session endsAt must be later than startsAt");
  }
}

export function validateLiveIntegration(integration: LiveIntegration): void {
  if (!PROVIDER_PATTERN.test(integration.provider)) {
    throw new Error("LIVE provider must use a stable lowercase identifier");
  }
  if (!integration.externalEventKey.trim()) {
    throw new Error("LIVE external event key is required");
  }
}

export function validateLiveSessionMapping(mapping: LiveSessionMapping): void {
  if (!mapping.externalRoomSlug.trim()) {
    throw new Error("LIVE external room slug is required");
  }
}

export function validateProgramAggregate(program: ProgramAggregate): void {
  validateEvent(program.event);

  const locationIds = new Set(
    program.locations
      .filter((location) => location.eventId === program.event.id)
      .map((location) => location.id),
  );
  const sessionSlugs = new Set<string>();
  const sessionIds = new Set<string>();

  for (const session of program.sessions) {
    validateSession(session);
    if (session.eventId !== program.event.id) {
      throw new Error("Session belongs to another event");
    }
    if (sessionSlugs.has(session.slug)) {
      throw new Error(`Duplicate session slug inside event: ${session.slug}`);
    }
    if (session.locationId !== null && !locationIds.has(session.locationId)) {
      throw new Error("Session location must belong to the same event");
    }
    sessionSlugs.add(session.slug);
    sessionIds.add(session.id);
  }

  const speakerIds = new Set(
    program.speakers
      .filter((speaker) => speaker.eventId === program.event.id)
      .map((speaker) => speaker.id),
  );
  for (const link of program.sessionSpeakers) {
    if (!sessionIds.has(link.sessionId) || !speakerIds.has(link.speakerId)) {
      throw new Error("Session speaker link must stay inside one event");
    }
  }

  const integrationIds = new Set<string>();
  for (const integration of program.liveIntegrations) {
    validateLiveIntegration(integration);
    if (integration.eventId !== program.event.id) {
      throw new Error("LIVE integration belongs to another event");
    }
    integrationIds.add(integration.id);
  }
  for (const mapping of program.liveSessionMappings) {
    validateLiveSessionMapping(mapping);
    if (!sessionIds.has(mapping.sessionId) || !integrationIds.has(mapping.integrationId)) {
      throw new Error("LIVE session mapping must stay inside one event");
    }
  }
}
