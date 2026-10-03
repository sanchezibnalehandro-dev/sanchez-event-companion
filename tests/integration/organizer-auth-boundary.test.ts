import { beforeEach, describe, expect, it, vi } from "vitest";

const getRepository = vi.fn();
const requireOrganizer = vi.fn(async () => {
  throw new Error("unauthenticated organizer");
});

vi.mock("@/lib/auth/request-organizer", () => ({ requireOrganizer }));
vi.mock("@/lib/data/database", () => ({ getRepository }));

describe("organizer mutation auth boundary", () => {
  beforeEach(() => {
    getRepository.mockClear();
    requireOrganizer.mockClear();
  });

  it("rejects an unauthenticated mutation before repository access", async () => {
    const { publishProgramAction } = await import(
      "@/app/organizer/events/[eventId]/program/actions"
    );
    const form = new FormData();
    form.set("eventId", "event-1");

    await expect(publishProgramAction(form)).rejects.toThrow("unauthenticated organizer");
    expect(requireOrganizer).toHaveBeenCalledWith("/organizer/events/event-1/program");
    expect(getRepository).not.toHaveBeenCalled();
  });
});
