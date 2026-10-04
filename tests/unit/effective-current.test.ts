import { describe, expect, it } from "vitest";

import { resolveEffectiveCurrentSession } from "@/lib/domain/effective-current";
import { event, opening, panel } from "@/tests/helpers/fixtures";

describe("resolveEffectiveCurrentSession", () => {
  it("lets a valid manual override win over the planned schedule", () => {
    const result = resolveEffectiveCurrentSession({
      eventId: event.id,
      sessions: [opening, panel],
      runtime: {
        eventId: event.id,
        manualCurrentSessionId: panel.id,
        overrideSetAt: "2026-10-02T07:30:00.000Z",
        overrideSetBy: "organizer-1",
      },
      now: new Date("2026-10-02T07:30:00.000Z"),
    });

    expect(result).toEqual({ session: panel, source: "manual" });
  });

  it("falls back to the planned schedule for an invalid override", () => {
    const result = resolveEffectiveCurrentSession({
      eventId: event.id,
      sessions: [opening, panel],
      runtime: {
        eventId: event.id,
        manualCurrentSessionId: "missing-session",
        overrideSetAt: "2026-10-02T07:30:00.000Z",
        overrideSetBy: "organizer-1",
      },
      now: new Date("2026-10-02T07:30:00.000Z"),
    });

    expect(result).toEqual({ session: opening, source: "planned" });
  });

  it("returns to the planned schedule when the manual override is cleared", () => {
    const result = resolveEffectiveCurrentSession({
      eventId: event.id,
      sessions: [opening, panel],
      runtime: {
        eventId: event.id,
        manualCurrentSessionId: null,
        overrideSetAt: null,
        overrideSetBy: null,
      },
      now: new Date("2026-10-02T07:30:00.000Z"),
    });

    expect(result).toEqual({ session: opening, source: "planned" });
  });

  it("returns null when no planned session matches", () => {
    const result = resolveEffectiveCurrentSession({
      eventId: event.id,
      sessions: [opening, panel],
      runtime: null,
      now: new Date("2026-10-02T10:00:00.000Z"),
    });

    expect(result).toBeNull();
  });

  it("selects a scheduled current only inside the inclusive-start exclusive-end window", () => {
    const beforeStart = resolveEffectiveCurrentSession({
      eventId: event.id,
      sessions: [opening],
      runtime: null,
      now: new Date("2026-10-02T06:59:59.999Z"),
    });
    const atStart = resolveEffectiveCurrentSession({
      eventId: event.id,
      sessions: [opening],
      runtime: null,
      now: new Date(opening.startsAt),
    });
    const beforeEnd = resolveEffectiveCurrentSession({
      eventId: event.id,
      sessions: [opening],
      runtime: null,
      now: new Date("2026-10-02T07:59:59.999Z"),
    });
    const atEnd = resolveEffectiveCurrentSession({
      eventId: event.id,
      sessions: [opening],
      runtime: null,
      now: new Date(opening.endsAt),
    });

    expect(beforeStart).toBeNull();
    expect(atStart).toEqual({ session: opening, source: "planned" });
    expect(beforeEnd).toEqual({ session: opening, source: "planned" });
    expect(atEnd).toBeNull();
  });

  it("compares Europe/Moscow offset windows as absolute instants", () => {
    const moscowWindow = {
      ...opening,
      startsAt: "2026-10-02T10:00:00+03:00",
      endsAt: "2026-10-02T11:00:00+03:00",
    };

    const result = resolveEffectiveCurrentSession({
      eventId: event.id,
      sessions: [moscowWindow],
      runtime: null,
      now: new Date("2026-10-02T07:30:00.000Z"),
    });

    expect(result).toEqual({ session: moscowWindow, source: "planned" });
  });
});
