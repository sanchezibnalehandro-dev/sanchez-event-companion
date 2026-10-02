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

export function formatEventDate(instant: string, timezone: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(instant));
}

function dateTimeParts(instant: Date, timezone: string): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

export function formatDateTimeLocal(instant: string, timezone: string): string {
  const parts = dateTimeParts(new Date(instant), timezone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function eventLocalDateTimeToInstant(value: string, timezone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Date and time must use YYYY-MM-DDTHH:mm");

  const desired = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
  const desiredEpoch = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
  );
  let candidate = desiredEpoch;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = dateTimeParts(new Date(candidate), timezone);
    const actualAsUtc = Date.UTC(
      Number(actual.year),
      Number(actual.month) - 1,
      Number(actual.day),
      Number(actual.hour),
      Number(actual.minute),
    );
    candidate += desiredEpoch - actualAsUtc;
  }

  const verified = dateTimeParts(new Date(candidate), timezone);
  if (
    Number(verified.year) !== desired.year ||
    Number(verified.month) !== desired.month ||
    Number(verified.day) !== desired.day ||
    Number(verified.hour) !== desired.hour ||
    Number(verified.minute) !== desired.minute
  ) {
    throw new Error(`Local time does not exist in ${timezone}`);
  }

  return new Date(candidate).toISOString();
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
