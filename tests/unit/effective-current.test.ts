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

  it("returns null when no planned session matches", () => {
    const result = resolveEffectiveCurrentSession({
      eventId: event.id,
      sessions: [opening, panel],
      runtime: null,
      now: new Date("2026-10-02T10:00:00.000Z"),
    });

    expect(result).toBeNull();
  });

  it("uses inclusive start and exclusive end boundaries", () => {
    const atStart = resolveEffectiveCurrentSession({
      eventId: event.id,
      sessions: [opening],
      runtime: null,
      now: new Date(opening.startsAt),
    });
    const atEnd = resolveEffectiveCurrentSession({
      eventId: event.id,
      sessions: [opening],
      runtime: null,
      now: new Date(opening.endsAt),
    });

    expect(atStart?.session.id).toBe(opening.id);
    expect(atEnd).toBeNull();
  });
});
