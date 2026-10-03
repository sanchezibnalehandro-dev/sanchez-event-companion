import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { event, makeProgram, opening } from "@/tests/helpers/fixtures";

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

import TodayPage from "@/app/e/[eventSlug]/page";
import ProgramPage from "@/app/e/[eventSlug]/program/page";
import SessionPage from "@/app/e/[eventSlug]/sessions/[sessionSlug]/page";

const routes = [
  {
    name: "guest hub",
    publishedContent: [event.title],
    render: () => TodayPage({ params: Promise.resolve({ eventSlug: event.slug }) }),
  },
  {
    name: "programme",
    publishedContent: [event.title, opening.title],
    render: () => ProgramPage({ params: Promise.resolve({ eventSlug: event.slug }) }),
  },
  {
    name: "session",
    publishedContent: [opening.title],
    render: () =>
      SessionPage({
        params: Promise.resolve({ eventSlug: event.slug, sessionSlug: opening.slug }),
      }),
  },
];

describe("public route publication boundary", () => {
  beforeEach(() => {
    repositoryMock.getPublicProgramBySlug.mockReset();
    notFoundMock.mockClear();
  });

  it.each(routes)("terminates $name without payload for missing or draft programs", async ({ render }) => {
    repositoryMock.getPublicProgramBySlug.mockResolvedValue({ status: "not_found" });

    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledOnce();
    expect(repositoryMock.getPublicProgramBySlug).toHaveBeenCalledWith(event.slug);
  });

  it.each(routes)("renders only generic unavailable copy for unpublished programs", async ({ render }) => {
    repositoryMock.getPublicProgramBySlug.mockResolvedValue({ status: "unavailable" });

    const markup = renderToStaticMarkup(await render());
    expect(markup).toContain("Скоро здесь появится расписание");
    expect(markup).not.toContain(event.title);
    expect(markup).not.toContain(event.slug);
    expect(markup).not.toContain(opening.title);
    expect(markup).not.toContain(opening.slug);
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it.each(routes)("renders the current published aggregate", async ({ render, publishedContent }) => {
    repositoryMock.getPublicProgramBySlug.mockResolvedValue({
      status: "published",
      program: makeProgram(),
    });

    const markup = renderToStaticMarkup(await render());
    publishedContent.forEach((content) => expect(markup).toContain(content));
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("terminates a missing session after receiving a published aggregate", async () => {
    repositoryMock.getPublicProgramBySlug.mockResolvedValue({
      status: "published",
      program: makeProgram(),
    });

    await expect(
      SessionPage({
        params: Promise.resolve({ eventSlug: event.slug, sessionSlug: "missing-session" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledOnce();
  });
});
