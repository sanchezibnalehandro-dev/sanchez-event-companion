import {
  compareSessionsByProgramOrder,
  resolveEffectiveCurrentSession,
} from "@/lib/domain/effective-current";
import type { ProgramAggregate, Session } from "@/lib/domain/types";
import { toEpochMilliseconds } from "@/lib/domain/validation";

export type SessionTimelineStatus = "past" | "current" | "concurrent" | "upcoming";

export interface TimelineSession {
  session: Session;
  status: SessionTimelineStatus;
}

export function buildProgramTimeline(
  program: ProgramAggregate,
  now: Date,
): { currentSessionId: string | null; sessions: TimelineSession[] } {
  const current = resolveEffectiveCurrentSession({
    eventId: program.event.id,
    sessions: program.sessions,
    runtime: program.runtime,
    now,
  });
  const nowEpoch = now.getTime();

  const sessions = [...program.sessions].sort(compareSessionsByProgramOrder).map((session) => {
    let status: SessionTimelineStatus;
    if (session.id === current?.session.id) {
      status = "current";
    } else if (toEpochMilliseconds(session.endsAt) <= nowEpoch) {
      status = "past";
    } else if (
      toEpochMilliseconds(session.startsAt) <= nowEpoch &&
      nowEpoch < toEpochMilliseconds(session.endsAt)
    ) {
      status = "concurrent";
    } else {
      status = "upcoming";
    }
    return { session, status };
  });

  return { currentSessionId: current?.session.id ?? null, sessions };
}
