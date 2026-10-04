import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProgramState } from "@/lib/domain/types";
import { event, makeProgram } from "@/tests/helpers/fixtures";

const mocks = vi.hoisted(() => {
  const getOrganizerProgram = vi.fn();
  const getPublicProgramBySlug = vi.fn();
  const repository = { getOrganizerProgram, getPublicProgramBySlug };

  return {
    getOrganizerProgram,
    getPublicProgramBySlug,
    getRepository: vi.fn(() => repository),
    notFound: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
    repository,
    requireOrganizer: vi.fn(),
  };
});

vi.mock("@/lib/auth/request-organizer", () => ({
  requireOrganizer: mocks.requireOrganizer,
}));
vi.mock("@/lib/data/database", () => ({
  getRepository: mocks.getRepository,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import OrganizerEventPreviewPage from "@/app/organizer/events/[eventId]/preview/page";

describe("organizer guest preview boundary", () => {
  beforeEach(() => {
    mocks.requireOrganizer.mockReset();
    mocks.requireOrganizer.mockResolvedValue({
      id: "organizer-1",
      email: "organizer@example.test",
    });
    mocks.getRepository.mockReset();
    mocks.getRepository.mockReturnValue(mocks.repository);
    mocks.getOrganizerProgram.mockReset();
    mocks.getOrganizerProgram.mockResolvedValue(makeProgram());
    mocks.getPublicProgramBySlug.mockReset();
    mocks.notFound.mockReset();
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  it("authenticates the safely encoded pathname before the organizer repository read", async () => {
    const eventId = "event/id?draft#1";

    await OrganizerEventPreviewPage({ params: Promise.resolve({ eventId }) });

    expect(mocks.requireOrganizer).toHaveBeenCalledWith(
      "/organizer/events/event%2Fid%3Fdraft%231/preview",
    );
    expect(mocks.getOrganizerProgram).toHaveBeenCalledWith(eventId);
    expect(mocks.requireOrganizer.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.getRepository.mock.invocationCallOrder[0]!,
    );
    expect(mocks.getRepository.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.getOrganizerProgram.mock.invocationCallOrder[0]!,
    );
    expect(mocks.getPublicProgramBySlug).not.toHaveBeenCalled();
  });

  it.each(["draft", "published", "unpublished"] satisfies ProgramState[])(
    "renders a marked, navigation-safe %s organizer aggregate",
    async (programState) => {
      const program = makeProgram({
        event: {
          ...event,
          programState,
          publishedAt: programState === "published" ? event.publishedAt : null,
        },
      });
      mocks.getOrganizerProgram.mockResolvedValue(program);

      const page = await OrganizerEventPreviewPage({
        params: Promise.resolve({ eventId: program.event.id }),
      });
      const markup = renderToStaticMarkup(page);

      expect(markup).toContain("Preview / Черновик");
      expect(markup).toContain("guest-preview-marker");
      expect(markup).toContain(program.event.title);
      expect(markup).not.toContain(`/e/${program.event.slug}/sessions/`);
      expect(markup).not.toContain(`href="/e/${program.event.slug}`);
      expect(markup).not.toContain("sanchez-live-qna");
      expect(mocks.getPublicProgramBySlug).not.toHaveBeenCalled();
    },
  );

  it("terminates a missing organizer event with notFound and no public fallback", async () => {
    mocks.getOrganizerProgram.mockResolvedValue(null);

    await expect(
      OrganizerEventPreviewPage({
        params: Promise.resolve({ eventId: "missing-event" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.getOrganizerProgram).toHaveBeenCalledWith("missing-event");
    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.getPublicProgramBySlug).not.toHaveBeenCalled();
  });

  it("performs no repository access when the organizer guard rejects", async () => {
    mocks.requireOrganizer.mockRejectedValue(new Error("unauthenticated organizer"));

    await expect(
      OrganizerEventPreviewPage({
        params: Promise.resolve({ eventId: "event-1" }),
      }),
    ).rejects.toThrow("unauthenticated organizer");

    expect(mocks.getRepository).not.toHaveBeenCalled();
    expect(mocks.getOrganizerProgram).not.toHaveBeenCalled();
    expect(mocks.getPublicProgramBySlug).not.toHaveBeenCalled();
  });
});
