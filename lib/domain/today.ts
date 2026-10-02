import {
  compareSessionsByProgramOrder,
  findNextSession,
  resolveEffectiveCurrentSession,
  type EffectiveCurrentSession,
} from "@/lib/domain/effective-current";
import type { ProgramAggregate, Session } from "@/lib/domain/types";

export interface TodayView {
  current: EffectiveCurrentSession | null;
  next: Session | null;
}

export function buildTodayView(program: ProgramAggregate, now: Date): TodayView {
  const current = resolveEffectiveCurrentSession({
    eventId: program.event.id,
    sessions: program.sessions,
    runtime: program.runtime,
    now,
  });
  const orderedSessions = [...program.sessions].sort(compareSessionsByProgramOrder);
  const manualIndex =
    current?.source === "manual"
      ? orderedSessions.findIndex((session) => session.id === current.session.id)
      : -1;
  const next =
    manualIndex >= 0
      ? (orderedSessions[manualIndex + 1] ?? null)
      : findNextSession({
          eventId: program.event.id,
          sessions: program.sessions,
          currentSessionId: current?.session.id,
          now,
        });

  return { current, next };
}
