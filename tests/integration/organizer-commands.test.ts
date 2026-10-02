import { describe, expect, it } from "vitest";

import type { Session } from "@/lib/domain/types";
import {
  event,
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
  it("creates, edits and deletes a session", () => {
    const repository = createTestRepository(makeProgram());

    repository.createSession({ session: addedSession, speakerIds: [speakerOne.id] });
    expect(repository.getOrganizerProgram(event.id)?.sessions).toHaveLength(3);

    repository.updateSession({
      session: { ...addedSession, title: "Обновлённая сессия" },
      speakerIds: [speakerOne.id],
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
