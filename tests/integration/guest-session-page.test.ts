import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  event,
  liveIntegration,
  makeProgram,
  opening,
  panel,
} from "@/tests/helpers/fixtures";

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
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

import SessionPage from "@/app/e/[eventSlug]/sessions/[sessionSlug]/page";

const stableLiveHref =
  "https://sanchez-live-qna.vercel.app/ask.html?event=industry-2026";

async function renderSession(sessionSlug: string): Promise<string> {
  const page = await SessionPage({
    params: Promise.resolve({ eventSlug: event.slug, sessionSlug }),
  });
  return renderToStaticMarkup(page);
}

describe("guest session page", () => {
  beforeEach(() => {
    repositoryMock.getPublicProgramBySlug.mockReset();
    notFoundMock.mockClear();
  });

  it("renders the stable external LIVE handoff as a link without embedding or inferred state", async () => {
    repositoryMock.getPublicProgramBySlug.mockResolvedValue({
      status: "published",
      program: makeProgram(),
    });

    const markup = await renderSession(panel.slug);

    expect(markup).toContain(panel.title);
    expect(markup).toContain(`href="${stableLiveHref}"`);
    expect(markup).toContain("Открыть LIVE Q&amp;A");
    expect(markup).not.toContain("<iframe");
    expect(markup).not.toContain("Открыто");
    expect(markup).not.toContain("LIVE сейчас");
    expect(repositoryMock.getPublicProgramBySlug).toHaveBeenCalledOnce();
  });

  it("keeps a mapped session valid but omits LIVE when the integration is disabled", async () => {
    repositoryMock.getPublicProgramBySlug.mockResolvedValue({
      status: "published",
      program: makeProgram({
        liveIntegrations: [{ ...liveIntegration, enabled: false }],
      }),
    });

    const markup = await renderSession(panel.slug);

    expect(markup).toContain(panel.title);
    expect(markup).not.toContain("live-cta");
    expect(markup).not.toContain(stableLiveHref);
  });

  it("keeps a valid unmapped Companion session without inventing a LIVE destination", async () => {
    repositoryMock.getPublicProgramBySlug.mockResolvedValue({
      status: "published",
      program: makeProgram(),
    });

    const markup = await renderSession(opening.slug);

    expect(markup).toContain(opening.title);
    expect(markup).toContain(opening.summary);
    expect(markup).not.toContain("live-cta");
    expect(markup).not.toContain(stableLiveHref);
  });

  it("renders only generic copy for unavailable unpublished content", async () => {
    repositoryMock.getPublicProgramBySlug.mockResolvedValue({ status: "unavailable" });

    const markup = await renderSession(panel.slug);

    expect(markup).toContain("Скоро здесь появится расписание");
    expect(markup).not.toContain(event.title);
    expect(markup).not.toContain(opening.title);
    expect(markup).not.toContain(panel.title);
    expect(markup).not.toContain("LIVE Q&amp;A");
    expect(markup).not.toContain("sanchez-live-qna.vercel.app");
  });

  it("terminates missing public content before rendering session or LIVE payload", async () => {
    repositoryMock.getPublicProgramBySlug.mockResolvedValue({ status: "not_found" });

    await expect(
      SessionPage({
        params: Promise.resolve({ eventSlug: event.slug, sessionSlug: panel.slug }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledOnce();
  });
});
