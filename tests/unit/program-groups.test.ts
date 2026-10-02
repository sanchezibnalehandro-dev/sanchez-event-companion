import { describe, expect, it } from "vitest";

import { buildProgramTimeline } from "@/lib/domain/program-timeline";
import { groupProgramTimeline } from "@/lib/domain/program-groups";
import type { Location, Session } from "@/lib/domain/types";
import { event, location, makeProgram, opening, panel } from "@/tests/helpers/fixtures";

const hallTwo: Location = {
  id: "location-hall-two",
  eventId: event.id,
  name: "Hall 2",
  sortOrder: 1,
};

describe("parallel program groups", () => {
  it("groups simultaneous and partially overlapping sessions by location", () => {
    const simultaneous: Session = {
      ...opening,
      id: "session-simultaneous",
      slug: "simultaneous",
      title: "Simultaneous",
      endsAt: "2026-10-02T07:45:00.000Z",
      locationId: hallTwo.id,
    };
    const partialOverlap: Session = {
      ...panel,
      id: "session-partial-overlap",
      slug: "partial-overlap",
      title: "Partial overlap",
      startsAt: "2026-10-02T07:30:00.000Z",
      endsAt: "2026-10-02T08:30:00.000Z",
      locationId: hallTwo.id,
    };
    const program = makeProgram({
      locations: [location, hallTwo],
      sessions: [opening, simultaneous, partialOverlap],
      runtime: null,
    });

    const groups = groupProgramTimeline(
      program,
      buildProgramTimeline(program, new Date("2026-10-02T07:15:00.000Z")).sessions,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      startsAt: "2026-10-02T07:00:00.000Z",
      endsAt: "2026-10-02T08:30:00.000Z",
    });
    expect(
      groups[0]?.lanes.map((lane) => ({
        name: lane.name,
        ids: lane.sessions.map((item) => item.session.id),
      })),
    ).toEqual([
      { name: "Главный зал", ids: [opening.id] },
      { name: "Hall 2", ids: [simultaneous.id, partialOverlap.id] },
    ]);
  });

  it("keeps back-to-back sessions in separate time groups", () => {
    const next = { ...panel, startsAt: opening.endsAt };
    const program = makeProgram({ sessions: [opening, next], runtime: null });

    const groups = groupProgramTimeline(
      program,
      buildProgramTimeline(program, new Date("2026-10-02T06:00:00.000Z")).sessions,
    );

    expect(groups.map((group) => group.sessions.map((item) => item.session.id))).toEqual([
      [opening.id],
      [panel.id],
    ]);
  });
});
