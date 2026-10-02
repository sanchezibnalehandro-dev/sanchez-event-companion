import type { ProgramAggregate, Session, Speaker } from "@/lib/domain/types";

export function formatEventTime(
  instant: string,
  timezone: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  }).format(new Date(instant));
}

export function getSessionSpeakers(
  program: ProgramAggregate,
  sessionId: string,
): Array<{ speaker: Speaker; sessionRole: string | null }> {
  return program.sessionSpeakers
    .filter((link) => link.sessionId === sessionId)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .flatMap((link) => {
      const speaker = program.speakers.find((item) => item.id === link.speakerId);
      return speaker ? [{ speaker, sessionRole: link.sessionRole }] : [];
    });
}

export function getSessionLocation(
  program: ProgramAggregate,
  session: Session,
): string | null {
  return program.locations.find((location) => location.id === session.locationId)?.name ?? null;
}
