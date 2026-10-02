import { compareSessionsBySchedule } from "@/lib/domain/effective-current";
import type { TimelineSession } from "@/lib/domain/program-timeline";
import type { ProgramAggregate } from "@/lib/domain/types";
import { toEpochMilliseconds } from "@/lib/domain/validation";

export interface ProgramLane {
  locationId: string | null;
  name: string;
  sessions: TimelineSession[];
}

export interface ProgramTimeGroup {
  startsAt: string;
  endsAt: string;
  sessions: TimelineSession[];
  lanes: ProgramLane[];
}

export function groupProgramTimeline(
  program: ProgramAggregate,
  timeline: readonly TimelineSession[],
): ProgramTimeGroup[] {
  const ordered = [...timeline].sort((left, right) =>
    compareSessionsBySchedule(left.session, right.session),
  );
  const grouped: Array<{ startsAt: string; endsAt: string; sessions: TimelineSession[] }> = [];

  for (const item of ordered) {
    const current = grouped.at(-1);
    if (
      current &&
      toEpochMilliseconds(item.session.startsAt) < toEpochMilliseconds(current.endsAt)
    ) {
      current.sessions.push(item);
      if (toEpochMilliseconds(item.session.endsAt) > toEpochMilliseconds(current.endsAt)) {
        current.endsAt = item.session.endsAt;
      }
    } else {
      grouped.push({
        startsAt: item.session.startsAt,
        endsAt: item.session.endsAt,
        sessions: [item],
      });
    }
  }

  const locationsById = new Map(program.locations.map((location) => [location.id, location]));
  return grouped.map((group) => {
    const lanesByLocation = new Map<string | null, TimelineSession[]>();
    group.sessions.forEach((item) => {
      const lane = lanesByLocation.get(item.session.locationId) ?? [];
      lane.push(item);
      lanesByLocation.set(item.session.locationId, lane);
    });
    const lanes = [...lanesByLocation.entries()]
      .map(([locationId, sessions]) => ({
        locationId,
        name: locationId ? (locationsById.get(locationId)?.name ?? "Без локации") : "Без локации",
        sessions,
      }))
      .sort((left, right) => {
        if (left.locationId === null) return right.locationId === null ? 0 : 1;
        if (right.locationId === null) return -1;
        return (
          (locationsById.get(left.locationId)?.sortOrder ?? Number.MAX_SAFE_INTEGER) -
            (locationsById.get(right.locationId)?.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
          left.name.localeCompare(right.name)
        );
      });

    return { ...group, lanes };
  });
}
