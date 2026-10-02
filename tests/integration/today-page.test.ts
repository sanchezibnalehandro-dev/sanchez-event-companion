import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeProgram } from "@/tests/helpers/fixtures";

const repositoryMock = vi.hoisted(() => ({
  getPublicProgramBySlug: vi.fn(),
}));

vi.mock("@/lib/data/database", () => ({
  getRepository: () => repositoryMock,
}));

import TodayPage from "@/app/e/[eventSlug]/page";

describe("TODAY page", () => {
  beforeEach(() => {
    repositoryMock.getPublicProgramBySlug.mockReset();
  });

  it("uses a neutral NOW label when there is no current session", async () => {
    repositoryMock.getPublicProgramBySlug.mockReturnValue({
      status: "published",
      program: makeProgram({ sessions: [], sessionSpeakers: [], runtime: null }),
    });

    const page = await TodayPage({ params: Promise.resolve({ eventSlug: "industry-day" }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('id="now-title">NOW</p>');
    expect(markup).not.toContain("по расписанию");
  });
});
