import type { EventRuntime, Session } from "@/lib/domain/types";
import { toEpochMilliseconds } from "@/lib/domain/validation";

export type CurrentSessionSource = "manual" | "planned";

export interface EffectiveCurrentSession {
  session: Session;
  source: CurrentSessionSource;
}

function compareSessions(left: Session, right: Session): number {
  return (
    toEpochMilliseconds(left.startsAt) - toEpochMilliseconds(right.startsAt) ||
    left.sortOrder - right.sortOrder ||
    left.id.localeCompare(right.id)
  );
}

export function resolveEffectiveCurrentSession(options: {
  eventId: string;
  sessions: readonly Session[];
  runtime: EventRuntime | null;
  now: Date;
}): EffectiveCurrentSession | null {
  const sessions = options.sessions.filter((session) => session.eventId === options.eventId);
  const manualSession =
    options.runtime?.eventId === options.eventId && options.runtime.manualCurrentSessionId
      ? sessions.find((session) => session.id === options.runtime?.manualCurrentSessionId)
      : undefined;

  if (manualSession) {
    return { session: manualSession, source: "manual" };
  }

  const now = options.now.getTime();
  const plannedSession = sessions
    .filter(
      (session) =>
        toEpochMilliseconds(session.startsAt) <= now &&
        now < toEpochMilliseconds(session.endsAt),
    )
    .sort(compareSessions)[0];

  return plannedSession ? { session: plannedSession, source: "planned" } : null;
}

export function findNextSession(options: {
  eventId: string;
  sessions: readonly Session[];
  now: Date;
  currentSessionId?: string;
}): Session | null {
  const now = options.now.getTime();
  const next = options.sessions
    .filter(
      (session) =>
        session.eventId === options.eventId &&
        session.id !== options.currentSessionId &&
        toEpochMilliseconds(session.startsAt) > now,
    )
    .sort(compareSessions)[0];

  return next ?? null;
}
