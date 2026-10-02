import { describe, expect, it } from "vitest";

import { buildProgramTimeline } from "@/lib/domain/program-timeline";
import { buildTodayView } from "@/lib/domain/today";
import { getSessionLiveDestination } from "@/lib/live/session-destination";
import { event, makeProgram, opening, panel } from "@/tests/helpers/fixtures";

describe("TODAY read model", () => {
  it("uses manual current over the planned current", () => {
    const program = makeProgram({
      runtime: {
        eventId: event.id,
        manualCurrentSessionId: panel.id,
        overrideSetAt: "2026-10-02T07:30:00.000Z",
        overrideSetBy: "organizer-1",
      },
    });

    const today = buildTodayView(program, new Date("2026-10-02T07:30:00.000Z"));
    expect(today.current).toEqual({
      session: panel,
      source: "manual",
    });
    expect(today.next).toBeNull();
  });

  it("falls back to the planned current", () => {
    const today = buildTodayView(makeProgram({ runtime: null }), new Date("2026-10-02T07:30:00.000Z"));
    expect(today.current).toEqual({ session: opening, source: "planned" });
  });

  it("shows the next session during a schedule gap", () => {
    const today = buildTodayView(makeProgram({ runtime: null }), new Date("2026-10-02T08:05:00.000Z"));
    expect(today.current).toBeNull();
    expect(today.next?.id).toBe(panel.id);
  });

  it("allows a break to be current without a LIVE mapping", () => {
    const breakSession = {
      ...opening,
      id: "session-break",
      slug: "coffee-break",
      title: "Кофе-пауза",
    };
    const program = makeProgram({
      sessions: [breakSession],
      sessionSpeakers: [],
      liveSessionMappings: [],
      runtime: null,
    });
    const today = buildTodayView(program, new Date("2026-10-02T07:30:00.000Z"));

    expect(today.current?.session.id).toBe(breakSession.id);
    expect(getSessionLiveDestination(program, breakSession.id)).toBeNull();
  });
});

describe("PROGRAM timeline", () => {
  it("supports a gap without inventing a current session", () => {
    const program = makeProgram({ runtime: null });
    const timeline = buildProgramTimeline(program, new Date("2026-10-02T08:05:00.000Z"));

    expect(timeline.currentSessionId).toBeNull();
    expect(timeline.sessions.map((item) => item.status)).toEqual(["past", "upcoming"]);
  });

  it("selects one overlap deterministically and marks the other as concurrent", () => {
    const overlappingPanel = {
      ...panel,
      startsAt: "2026-10-02T07:15:00.000Z",
      endsAt: "2026-10-02T08:15:00.000Z",
    };
    const program = makeProgram({ sessions: [opening, overlappingPanel], runtime: null });
    const timeline = buildProgramTimeline(program, new Date("2026-10-02T07:30:00.000Z"));

    expect(timeline.currentSessionId).toBe(opening.id);
    expect(timeline.sessions).toMatchObject([
      { session: { id: opening.id }, status: "current" },
      { session: { id: panel.id }, status: "concurrent" },
    ]);
  });
});
