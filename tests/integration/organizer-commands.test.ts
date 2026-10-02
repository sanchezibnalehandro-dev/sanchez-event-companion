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
  it("rejects a same-lane move into a non-rippled session without changing program state", async () => {
    const sessionA: Session = {
      ...opening,
      startsAt: "2026-10-02T10:00:00.000Z",
      endsAt: "2026-10-02T11:00:00.000Z",
    };
    const sessionB: Session = {
      ...panel,
      startsAt: "2026-10-02T11:00:00.000Z",
      endsAt: "2026-10-02T12:00:00.000Z",
    };
    const sessionC: Session = {
      ...addedSession,
      startsAt: "2026-10-02T12:00:00.000Z",
      endsAt: "2026-10-02T13:00:00.000Z",
      locationId: location.id,
    };
    const initialProgram = makeProgram({ sessions: [sessionA, sessionB, sessionC] });
    const repository = createTestRepository(initialProgram);

    await expect(
      repository.updateSession({
        session: {
          ...sessionB,
          startsAt: "2026-10-02T10:30:00.000Z",
          endsAt: "2026-10-02T11:30:00.000Z",
        },
        speakerIds: [speakerOne.id],
        autoShiftFollowing: true,
      }),
    ).rejects.toThrow("session time is already occupied in this location");

    const after = await repository.getOrganizerProgram(event.id);
    expect(after?.sessions).toEqual(initialProgram.sessions);
    expect(after?.sessionSpeakers).toEqual(initialProgram.sessionSpeakers);
    expect(after?.runtime).toEqual(initialProgram.runtime);
    expect(after?.liveSessionMappings).toEqual(initialProgram.liveSessionMappings);
    repository.close();
  });

  it("allows a back-to-back same-lane edit and shifts downstream by the end delta", async () => {
    const sessionA: Session = {
      ...opening,
      startsAt: "2026-10-02T10:00:00.000Z",
      endsAt: "2026-10-02T11:00:00.000Z",
    };
    const sessionB: Session = {
      ...panel,
      startsAt: "2026-10-02T11:00:00.000Z",
      endsAt: "2026-10-02T12:00:00.000Z",
    };
    const sessionC: Session = {
      ...addedSession,
      startsAt: "2026-10-02T12:00:00.000Z",
      endsAt: "2026-10-02T13:00:00.000Z",
      locationId: location.id,
    };
    const repository = createTestRepository(
      makeProgram({ sessions: [sessionA, sessionB, sessionC] }),
    );

    await repository.updateSession({
      session: { ...sessionB, endsAt: "2026-10-02T12:30:00.000Z" },
      speakerIds: [speakerOne.id, speakerTwo.id],
      autoShiftFollowing: true,
    });

    const sessions = (await repository.getOrganizerProgram(event.id))?.sessions ?? [];
    expect(sessions.find((session) => session.id === sessionA.id)).toMatchObject({
      startsAt: "2026-10-02T10:00:00.000Z",
      endsAt: "2026-10-02T11:00:00.000Z",
    });
    expect(sessions.find((session) => session.id === sessionB.id)).toMatchObject({
      startsAt: "2026-10-02T11:00:00.000Z",
      endsAt: "2026-10-02T12:30:00.000Z",
    });
    expect(sessions.find((session) => session.id === sessionC.id)).toMatchObject({
      startsAt: "2026-10-02T12:30:00.000Z",
      endsAt: "2026-10-02T13:30:00.000Z",
    });
    repository.close();
  });

  it("shifts only following sessions in the same location and preserves their gaps", async () => {
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

    await repository.updateSession({
      session: { ...opening, endsAt: "2026-10-02T08:15:00.000Z" },
      speakerIds: [],
      autoShiftFollowing: true,
    });

    const updated = await repository.getOrganizerProgram(event.id);
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

  it("updates only the edited session when auto-shift is disabled", async () => {
    const program = makeProgram();
    const repository = createTestRepository(program);

    await repository.updateSession({
      session: { ...opening, endsAt: "2026-10-02T08:15:00.000Z" },
      speakerIds: [],
      autoShiftFollowing: false,
    });

    const updated = await repository.getOrganizerProgram(event.id);
    expect(updated?.sessions.find((session) => session.id === panel.id)).toMatchObject({
      startsAt: panel.startsAt,
      endsAt: panel.endsAt,
    });
    expect(updated?.runtime).toEqual(program.runtime);
    expect(updated?.liveSessionMappings).toEqual(program.liveSessionMappings);
    repository.close();
  });

  it("cuts a moved session from its old lane and minimally ripples its destination lane", async () => {
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

    await repository.updateSession({
      session: {
        ...opening,
        startsAt: "2026-10-02T08:30:00.000Z",
        endsAt: "2026-10-02T09:00:00.000Z",
        locationId: hallTwo.id,
      },
      speakerIds: [],
      autoShiftFollowing: true,
    });

    const sessions = (await repository.getOrganizerProgram(event.id))?.sessions ?? [];
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

  it("does not ripple a destination lane when the moved session fits its gap", async () => {
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

    await repository.updateSession({
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
      (await repository
        .getOrganizerProgram(event.id))
        ?.sessions.find((session) => session.id === destinationNext.id),
    ).toMatchObject({ startsAt: destinationNext.startsAt, endsAt: destinationNext.endsAt });
    repository.close();
  });

  it("rejects a move into an occupied destination interval without changing either lane", async () => {
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

    await expect(
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
    ).rejects.toThrow("destination time is already occupied");

    expect((await repository.getOrganizerProgram(event.id))?.sessions).toEqual(
      initialProgram.sessions,
    );
    repository.close();
  });

  it("treats sessions without a location as one auto-shift lane", async () => {
    const first = { ...opening, locationId: null };
    const following = { ...panel, locationId: null };
    const repository = createTestRepository(makeProgram({ sessions: [first, following] }));

    await repository.updateSession({
      session: { ...first, endsAt: "2026-10-02T08:15:00.000Z" },
      speakerIds: [],
      autoShiftFollowing: true,
    });

    expect(
      (await repository.getOrganizerProgram(event.id))?.sessions.find(
        (session) => session.id === panel.id,
      ),
    ).toMatchObject({
      startsAt: "2026-10-02T08:30:00.000Z",
      endsAt: "2026-10-02T09:45:00.000Z",
    });
    repository.close();
  });

  it("creates, edits and deletes a session", async () => {
    const repository = createTestRepository(makeProgram());

    await repository.createSession({ session: addedSession, speakerIds: [speakerOne.id] });
    expect((await repository.getOrganizerProgram(event.id))?.sessions).toHaveLength(3);

    await repository.updateSession({
      session: { ...addedSession, title: "Обновлённая сессия" },
      speakerIds: [speakerOne.id],
      autoShiftFollowing: false,
    });
    expect(
      (await repository
        .getOrganizerProgram(event.id))
        ?.sessions.find((session) => session.id === addedSession.id)?.title,
    ).toBe("Обновлённая сессия");

    await repository.deleteSession(event.id, addedSession.id);
    expect((await repository.getOrganizerProgram(event.id))?.sessions).toHaveLength(2);
    repository.close();
  });

  it("assigns multiple speakers through the organizer command", async () => {
    const repository = createTestRepository(makeProgram());
    await repository.createSession({
      session: addedSession,
      speakerIds: [speakerOne.id, speakerTwo.id],
    });

    const program = await repository.getOrganizerProgram(event.id);
    expect(
      program?.sessionSpeakers.filter((link) => link.sessionId === addedSession.id),
    ).toEqual([
      { sessionId: addedSession.id, speakerId: speakerOne.id, sortOrder: 0, sessionRole: null },
      { sessionId: addedSession.id, speakerId: speakerTwo.id, sortOrder: 1, sessionRole: null },
    ]);
    repository.close();
  });

  it("preserves retained speaker roles when ordinary session fields change", async () => {
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

    await repository.updateSession({
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

    const updated = await repository.getOrganizerProgram(event.id);
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

  it("persists reorder atomically and rejects partial sets", async () => {
    const repository = createTestRepository(makeProgram());
    await repository.reorderSessions(event.id, [panel.id, opening.id]);
    expect(
      (await repository.getOrganizerProgram(event.id))?.sessions.map((session) => session.id),
    ).toEqual([panel.id, opening.id]);

    await expect(repository.reorderSessions(event.id, [opening.id])).rejects.toThrow(
      "every event session exactly once",
    );
    expect(
      (await repository.getOrganizerProgram(event.id))?.sessions.map((session) => session.id),
    ).toEqual([panel.id, opening.id]);
    repository.close();
  });

  it("publishes and unpublishes through the server persistence boundary", async () => {
    const repository = createTestRepository(
      makeProgram({ event: { ...event, programState: "draft", publishedAt: null } }),
    );
    await expect(repository.getPublicProgramBySlug(event.slug)).resolves.toEqual({
      status: "not_found",
    });

    await repository.setProgramPublished(event.id, "2026-10-02T06:30:00.000Z");
    expect((await repository.getPublicProgramBySlug(event.slug)).status).toBe("published");

    await repository.setProgramUnpublished(event.id);
    await expect(repository.getPublicProgramBySlug(event.slug)).resolves.toEqual({
      status: "unavailable",
    });
    repository.close();
  });

  it("sets and clears a manual current session", async () => {
    const repository = createTestRepository(makeProgram());
    await repository.setManualCurrentSession(
      event.id,
      panel.id,
      "organizer-1",
      "2026-10-02T07:30:00.000Z",
    );
    expect((await repository.getOrganizerProgram(event.id))?.runtime).toMatchObject({
      manualCurrentSessionId: panel.id,
      overrideSetBy: "organizer-1",
    });

    await repository.clearManualCurrentSession(event.id);
    expect((await repository.getOrganizerProgram(event.id))?.runtime).toEqual({
      eventId: event.id,
      manualCurrentSessionId: null,
      overrideSetAt: null,
      overrideSetBy: null,
    });
    repository.close();
  });
});
