import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionCard } from "@/components/session-card";
import { event, makeProgram, opening, panel } from "@/tests/helpers/fixtures";

const repositoryMock = vi.hoisted(() => ({
  getPublicProgramBySlug: vi.fn(),
}));
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);

vi.mock("@/lib/data/database", () => ({
  getRepository: () => repositoryMock,
}));
vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

import TodayPage from "@/app/e/[eventSlug]/page";

describe("guest hub page", () => {
  beforeEach(() => {
    repositoryMock.getPublicProgramBySlug.mockReset();
    notFoundMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows only real guest actions and disables Q&A without a current mapping", async () => {
    repositoryMock.getPublicProgramBySlug.mockResolvedValue({
      status: "published",
      program: makeProgram({ sessions: [], sessionSpeakers: [], runtime: null }),
    });

    const page = await TodayPage({ params: Promise.resolve({ eventSlug: "industry-day" }) });
    const markup = renderToStaticMarkup(page);

    expect(repositoryMock.getPublicProgramBySlug).toHaveBeenCalledOnce();
    expect(repositoryMock.getPublicProgramBySlug).toHaveBeenCalledWith("industry-day");
    expect(markup).toContain(event.title);
    expect(markup).toContain("Участвуйте");
    expect(markup).toContain("Задать вопрос спикеру");
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain("Программа дня");
    expect(markup).toContain('href="/e/industry-day/program"');
    expect(markup).not.toContain("Preview / Черновик");
    expect(markup).not.toContain("guest-preview-marker");
    expect(markup).not.toContain("People");
    expect(markup).not.toContain("PHASE 2");
  });

  it("links to the existing LIVE destination without claiming an open status", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T07:30:00.000Z"));
    repositoryMock.getPublicProgramBySlug.mockResolvedValue({
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

  it("preserves missing and unavailable publication behavior", async () => {
    repositoryMock.getPublicProgramBySlug.mockResolvedValueOnce({ status: "not_found" });

    await expect(
      TodayPage({ params: Promise.resolve({ eventSlug: "missing-event" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledOnce();
    expect(repositoryMock.getPublicProgramBySlug).toHaveBeenCalledWith("missing-event");

    repositoryMock.getPublicProgramBySlug.mockResolvedValueOnce({ status: "unavailable" });
    const page = await TodayPage({ params: Promise.resolve({ eventSlug: "industry-day" }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain("Скоро здесь появится расписание");
    expect(markup).not.toContain(event.title);
    expect(markup).not.toContain("Участвуйте");
    expect(markup).not.toContain("Preview / Черновик");
  });

  it("keeps public session links by default and disables them only in preview mode", () => {
    const program = makeProgram();
    const publicMarkup = renderToStaticMarkup(SessionCard({ program, session: opening }));
    const previewMarkup = renderToStaticMarkup(
      SessionCard({ program, session: opening, navigationMode: "preview" }),
    );

    expect(publicMarkup).toContain(
      `href="/e/${program.event.slug}/sessions/${opening.slug}"`,
    );
    expect(previewMarkup).toContain(opening.title);
    expect(previewMarkup).not.toContain("href=");
  });
});
