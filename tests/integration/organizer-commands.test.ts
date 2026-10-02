import { describe, expect, it } from "vitest";

import type { Session } from "@/lib/domain/types";
import {
  event,
  location,
  makeProgram,
  opening,
  panel,
  speakerOne,
  speakerTwo,
} from "@/tests/helpers/fixtures";
import { createTestRepository } from "@/tests/helpers/repository";

const addedSession: Session = {
  id: "session-added",
  eventId: event.id,
  slug: "added-session",
  title: "Добавленная сессия",
  summary: "Тестовый блок",
  startsAt: "2026-10-02T10:00:00.000Z",
  endsAt: "2026-10-02T11:00:00.000Z",
  locationId: null,
  sortOrder: 2,
};

describe("organizer program commands", () => {
  it("shifts only following sessions in the same location and preserves their gaps", () => {
    const hallTwo = {
      id: "location-hall-two",
      eventId: event.id,
      name: "Hall 2",
      sortOrder: 1,
    };
    const parallelSession: Session = {
      ...panel,
      id: "session-hall-two",
      slug: "hall-two-session",
      title: "Hall 2 session",
      locationId: hallTwo.id,
    };
    const repository = createTestRepository(
      makeProgram({
        locations: [location, hallTwo],
        sessions: [opening, panel, parallelSession],
      }),
    );

    repository.updateSession({
      session: { ...opening, endsAt: "2026-10-02T08:15:00.000Z" },
      speakerIds: [],
      autoShiftFollowing: true,
    });

    const updated = repository.getOrganizerProgram(event.id);
    expect(updated?.sessions.find((session) => session.id === opening.id)?.endsAt).toBe(
      "2026-10-02T08:15:00.000Z",
    );
    expect(updated?.sessions.find((session) => session.id === panel.id)).toMatchObject({
      startsAt: "2026-10-02T08:30:00.000Z",
      endsAt: "2026-10-02T09:45:00.000Z",
    });
    expect(updated?.sessions.find((session) => session.id === parallelSession.id)).toMatchObject({
      startsAt: parallelSession.startsAt,
      endsAt: parallelSession.endsAt,
    });
    expect(updated?.runtime).toEqual(makeProgram().runtime);
    expect(updated?.liveSessionMappings).toEqual(makeProgram().liveSessionMappings);
    repository.close();
  });

  it("updates only the edited session when auto-shift is disabled", () => {
    const program = makeProgram();
    const repository = createTestRepository(program);

    repository.updateSession({
      session: { ...opening, endsAt: "2026-10-02T08:15:00.000Z" },
      speakerIds: [],
      autoShiftFollowing: false,
    });

    const updated = repository.getOrganizerProgram(event.id);
    expect(updated?.sessions.find((session) => session.id === panel.id)).toMatchObject({
      startsAt: panel.startsAt,
      endsAt: panel.endsAt,
    });
    expect(updated?.runtime).toEqual(program.runtime);
    expect(updated?.liveSessionMappings).toEqual(program.liveSessionMappings);
    repository.close();
  });

  it("cuts a moved session from its old lane and minimally ripples its destination lane", () => {
    const hallTwo = {
      id: "location-hall-two",
      eventId: event.id,
      name: "Hall 2",
      sortOrder: 1,
    };
    const destinationNext: Session = {
      ...panel,
      id: "session-hall-two-next",
      slug: "hall-two-next",
      title: "Hall 2 next",
      startsAt: "2026-10-02T08:45:00.000Z",
      endsAt: "2026-10-02T09:45:00.000Z",
      locationId: hallTwo.id,
    };
    const destinationLater: Session = {
      ...destinationNext,
      id: "session-hall-two-later",
      slug: "hall-two-later",
      title: "Hall 2 later",
      startsAt: "2026-10-02T10:00:00.000Z",
      endsAt: "2026-10-02T11:00:00.000Z",
      sortOrder: 3,
    };
    const repository = createTestRepository(
      makeProgram({
        locations: [location, hallTwo],
        sessions: [opening, panel, destinationNext, destinationLater],
      }),
    );

    repository.updateSession({
      session: {
        ...opening,
        startsAt: "2026-10-02T08:30:00.000Z",
        endsAt: "2026-10-02T09:00:00.000Z",
        locationId: hallTwo.id,
      },
      speakerIds: [],
      autoShiftFollowing: true,
    });

    const sessions = repository.getOrganizerProgram(event.id)?.sessions ?? [];
    expect(sessions.find((session) => session.id === panel.id)).toMatchObject({
      startsAt: "2026-10-02T07:15:00.000Z",
      endsAt: "2026-10-02T08:30:00.000Z",
    });
    expect(sessions.find((session) => session.id === destinationNext.id)).toMatchObject({
      startsAt: "2026-10-02T09:00:00.000Z",
      endsAt: "2026-10-02T10:00:00.000Z",
    });
    expect(sessions.find((session) => session.id === destinationLater.id)).toMatchObject({
      startsAt: "2026-10-02T10:15:00.000Z",
      endsAt: "2026-10-02T11:15:00.000Z",
    });
    repository.close();
  });

  it("does not ripple a destination lane when the moved session fits its gap", () => {
    const hallTwo = {
      id: "location-hall-two",
      eventId: event.id,
      name: "Hall 2",
      sortOrder: 1,
    };
    const destinationNext: Session = {
      ...panel,
      id: "session-hall-two-next",
      slug: "hall-two-next",
      startsAt: "2026-10-02T09:15:00.000Z",
      endsAt: "2026-10-02T10:15:00.000Z",
      locationId: hallTwo.id,
    };
    const repository = createTestRepository(
      makeProgram({
        locations: [location, hallTwo],
        sessions: [opening, panel, destinationNext],
      }),
    );

    repository.updateSession({
      session: {
        ...opening,
        startsAt: "2026-10-02T08:30:00.000Z",
        endsAt: "2026-10-02T09:00:00.000Z",
        locationId: hallTwo.id,
      },
      speakerIds: [],
      autoShiftFollowing: true,
    });

    expect(
      repository
        .getOrganizerProgram(event.id)
        ?.sessions.find((session) => session.id === destinationNext.id),
    ).toMatchObject({ startsAt: destinationNext.startsAt, endsAt: destinationNext.endsAt });
    repository.close();
  });

  it("rejects a move into an occupied destination interval without changing either lane", () => {
    const hallTwo = {
      id: "location-hall-two",
      eventId: event.id,
      name: "Hall 2",
      sortOrder: 1,
    };
    const occupied: Session = {
      ...panel,
      id: "session-hall-two-occupied",
      slug: "hall-two-occupied",
      startsAt: "2026-10-02T10:00:00.000Z",
      endsAt: "2026-10-02T11:00:00.000Z",
      locationId: hallTwo.id,
    };
    const initialProgram = makeProgram({
      locations: [location, hallTwo],
      sessions: [opening, panel, occupied],
    });
    const repository = createTestRepository(initialProgram);

    expect(() =>
      repository.updateSession({
        session: {
          ...opening,
          startsAt: "2026-10-02T10:30:00.000Z",
          endsAt: "2026-10-02T11:15:00.000Z",
          locationId: hallTwo.id,
        },
        speakerIds: [],
        autoShiftFollowing: true,
      }),
    ).toThrow("destination time is already occupied");

    expect(repository.getOrganizerProgram(event.id)?.sessions).toEqual(initialProgram.sessions);
    repository.close();
  });

  it("treats sessions without a location as one auto-shift lane", () => {
    const first = { ...opening, locationId: null };
    const following = { ...panel, locationId: null };
    const repository = createTestRepository(makeProgram({ sessions: [first, following] }));

    repository.updateSession({
      session: { ...first, endsAt: "2026-10-02T08:15:00.000Z" },
      speakerIds: [],
      autoShiftFollowing: true,
    });

    expect(
      repository.getOrganizerProgram(event.id)?.sessions.find((session) => session.id === panel.id),
    ).toMatchObject({
      startsAt: "2026-10-02T08:30:00.000Z",
      endsAt: "2026-10-02T09:45:00.000Z",
    });
    repository.close();
  });

  it("creates, edits and deletes a session", () => {
    const repository = createTestRepository(makeProgram());

    repository.createSession({ session: addedSession, speakerIds: [speakerOne.id] });
    expect(repository.getOrganizerProgram(event.id)?.sessions).toHaveLength(3);

    repository.updateSession({
      session: { ...addedSession, title: "Обновлённая сессия" },
      speakerIds: [speakerOne.id],
      autoShiftFollowing: false,
    });
    expect(
      repository
        .getOrganizerProgram(event.id)
        ?.sessions.find((session) => session.id === addedSession.id)?.title,
    ).toBe("Обновлённая сессия");

    repository.deleteSession(event.id, addedSession.id);
    expect(repository.getOrganizerProgram(event.id)?.sessions).toHaveLength(2);
    repository.close();
  });

  it("assigns multiple speakers through the organizer command", () => {
    const repository = createTestRepository(makeProgram());
    repository.createSession({
      session: addedSession,
      speakerIds: [speakerOne.id, speakerTwo.id],
    });

    const program = repository.getOrganizerProgram(event.id);
    expect(
      program?.sessionSpeakers.filter((link) => link.sessionId === addedSession.id),
    ).toEqual([
      { sessionId: addedSession.id, speakerId: speakerOne.id, sortOrder: 0, sessionRole: null },
      { sessionId: addedSession.id, speakerId: speakerTwo.id, sortOrder: 1, sessionRole: null },
    ]);
    repository.close();
  });

  it("preserves retained speaker roles when ordinary session fields change", () => {
    const roleLinks = [
      { sessionId: panel.id, speakerId: speakerOne.id, sortOrder: 0, sessionRole: "Moderator" },
      {
        sessionId: panel.id,
        speakerId: speakerTwo.id,
        sortOrder: 1,
        sessionRole: "Panel participant",
      },
    ];
    const repository = createTestRepository(makeProgram({ sessionSpeakers: roleLinks }));

    repository.updateSession({
      session: {
        ...panel,
        title: "Updated panel",
        startsAt: "2026-10-02T08:30:00.000Z",
        endsAt: "2026-10-02T09:45:00.000Z",
        locationId: null,
      },
      speakerIds: [speakerOne.id, speakerTwo.id],
      autoShiftFollowing: false,
    });

    const updated = repository.getOrganizerProgram(event.id);
    expect(updated?.sessions.find((session) => session.id === panel.id)).toMatchObject({
      title: "Updated panel",
      startsAt: "2026-10-02T08:30:00.000Z",
      endsAt: "2026-10-02T09:45:00.000Z",
      locationId: null,
    });
    expect(updated?.sessionSpeakers.filter((link) => link.sessionId === panel.id)).toEqual(
      roleLinks,
    );
    repository.close();
  });

  it("persists reorder atomically and rejects partial sets", () => {
    const repository = createTestRepository(makeProgram());
    repository.reorderSessions(event.id, [panel.id, opening.id]);
    expect(repository.getOrganizerProgram(event.id)?.sessions.map((session) => session.id)).toEqual([
      panel.id,
      opening.id,
    ]);

    expect(() => repository.reorderSessions(event.id, [opening.id])).toThrow(
      "every event session exactly once",
    );
    expect(repository.getOrganizerProgram(event.id)?.sessions.map((session) => session.id)).toEqual([
      panel.id,
      opening.id,
    ]);
    repository.close();
  });

  it("publishes and unpublishes through the server persistence boundary", () => {
    const repository = createTestRepository(
      makeProgram({ event: { ...event, programState: "draft", publishedAt: null } }),
    );
    expect(repository.getPublicProgramBySlug(event.slug)).toEqual({ status: "not_found" });

    repository.setProgramPublished(event.id, "2026-10-02T06:30:00.000Z");
    expect(repository.getPublicProgramBySlug(event.slug).status).toBe("published");

    repository.setProgramUnpublished(event.id);
    expect(repository.getPublicProgramBySlug(event.slug)).toEqual({ status: "unavailable" });
    repository.close();
  });

  it("sets and clears a manual current session", () => {
    const repository = createTestRepository(makeProgram());
    repository.setManualCurrentSession(
      event.id,
      panel.id,
      "organizer-1",
      "2026-10-02T07:30:00.000Z",
    );
    expect(repository.getOrganizerProgram(event.id)?.runtime).toMatchObject({
      manualCurrentSessionId: panel.id,
      overrideSetBy: "organizer-1",
    });

    repository.clearManualCurrentSession(event.id);
    expect(repository.getOrganizerProgram(event.id)?.runtime).toEqual({
      eventId: event.id,
      manualCurrentSessionId: null,
      overrideSetAt: null,
      overrideSetBy: null,
    });
    repository.close();
  });
});
