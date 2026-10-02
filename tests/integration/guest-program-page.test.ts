import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { event, makeProgram, panel } from "@/tests/helpers/fixtures";

const repositoryMock = vi.hoisted(() => ({
  getPublicProgramBySlug: vi.fn(),
}));

vi.mock("@/lib/data/database", () => ({
  getRepository: () => repositoryMock,
}));

import ProgramPage from "@/app/e/[eventSlug]/program/page";

describe("guest program page", () => {
  beforeEach(() => {
    repositoryMock.getPublicProgramBySlug.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T07:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a manual current hero with all speakers and no false LIVE or countdown", async () => {
    repositoryMock.getPublicProgramBySlug.mockReturnValue({
      status: "published",
      program: makeProgram({
        runtime: {
          eventId: event.id,
          manualCurrentSessionId: panel.id,
          overrideSetAt: "2026-10-02T07:25:00.000Z",
          overrideSetBy: "organizer-1",
        },
      }),
    });

    const page = await ProgramPage({ params: Promise.resolve({ eventSlug: event.slug }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain("Сейчас идёт");
    expect(markup).toContain("Анна Орлова");
    expect(markup).toContain("Иван Петров");
    expect(markup).toContain("Разговор с практиками");
    expect(markup).toContain("Выбор организатора");
    expect(markup).not.toContain('class="remaining-time"');
    expect(markup).not.toContain(">LIVE<");
  });

  it("keeps a real schedule gap and marks the actual next session", async () => {
    repositoryMock.getPublicProgramBySlug.mockReturnValue({
      status: "published",
      program: makeProgram({ runtime: null }),
    });
    vi.setSystemTime(new Date("2026-10-02T08:05:00.000Z"));

    const page = await ProgramPage({ params: Promise.resolve({ eventSlug: event.slug }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain("Сейчас нет активной сессии");
    expect(markup).toContain("Следующий");
    expect(markup).not.toContain('class="current-session"');
  });
});
