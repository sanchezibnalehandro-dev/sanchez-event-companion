import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { event, makeProgram, panel } from "@/tests/helpers/fixtures";

const repositoryMock = vi.hoisted(() => ({
  getPublicProgramBySlug: vi.fn(),
}));

vi.mock("@/lib/data/database", () => ({
  getRepository: () => repositoryMock,
}));

import TodayPage from "@/app/e/[eventSlug]/page";

describe("guest hub page", () => {
  beforeEach(() => {
    repositoryMock.getPublicProgramBySlug.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows only real guest actions and disables Q&A without a current mapping", async () => {
    repositoryMock.getPublicProgramBySlug.mockReturnValue({
      status: "published",
      program: makeProgram({ sessions: [], sessionSpeakers: [], runtime: null }),
    });

    const page = await TodayPage({ params: Promise.resolve({ eventSlug: "industry-day" }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain("Участвуйте");
    expect(markup).toContain("Задать вопрос спикеру");
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain("Программа дня");
    expect(markup).not.toContain("People");
    expect(markup).not.toContain("PHASE 2");
  });

  it("links to the existing LIVE destination without claiming an open status", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T07:30:00.000Z"));
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

    const page = await TodayPage({ params: Promise.resolve({ eventSlug: event.slug }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain("https://sanchez-live-qna.vercel.app/ask.html?event=industry-2026");
    expect(markup).not.toContain("Открыто");
    expect(markup).not.toContain("iframe");
  });
});
