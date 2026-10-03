import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOrganizer: vi.fn(),
  createOrganizerEvent: vi.fn(),
  listOrganizerEvents: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
  logout: vi.fn(),
}));
const repositoryMock = {
  createOrganizerEvent: mocks.createOrganizerEvent,
  listOrganizerEvents: mocks.listOrganizerEvents,
};

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/request-organizer", () => ({ requireOrganizer: mocks.requireOrganizer }));
vi.mock("@/lib/data/database", () => ({ getRepository: () => repositoryMock }));
vi.mock("@/app/organizer/actions", () => ({ logoutOrganizerAction: mocks.logout }));

import { OrganizerEventError } from "@/lib/data/repository";
import { createOrganizerEventAction } from "@/app/organizer/events/actions";
import OrganizerPage from "@/app/organizer/page";

const form = (values: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
};
const validForm = () => form({
  title: "Осенняя конференция",
  slug: "autumn-conf",
  timezone: "Europe/Moscow",
  startsAt: "2026-11-02T10:00",
  endsAt: "2026-11-02T12:00",
  ignored: "not forwarded",
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireOrganizer.mockResolvedValue({ id: "organizer-1", email: "organizer@example.test" });
  mocks.createOrganizerEvent.mockResolvedValue({ id: "event/id", title: "Осенняя конференция" });
  mocks.listOrganizerEvents.mockResolvedValue([]);
});

describe("organizer event lifecycle entrypoints", () => {
  it("guards create before repository access", async () => {
    mocks.requireOrganizer.mockRejectedValueOnce(new Error("unauthenticated organizer"));

    await expect(createOrganizerEventAction(validForm())).rejects.toThrow("unauthenticated organizer");
    expect(mocks.createOrganizerEvent).not.toHaveBeenCalled();
  });

  it("forwards only the create payload and encodes the stable-ID route", async () => {
    await expect(createOrganizerEventAction(validForm())).rejects.toThrow(
      "redirect:/organizer/events/event%2Fid/program",
    );
    expect(mocks.createOrganizerEvent).toHaveBeenCalledWith({
      title: "Осенняя конференция",
      slug: "autumn-conf",
      timezone: "Europe/Moscow",
      startsAt: "2026-11-02T07:00:00.000Z",
      endsAt: "2026-11-02T09:00:00.000Z",
    });
  });

  it("maps conflicts and malformed input to safe field feedback without invalid writes", async () => {
    mocks.createOrganizerEvent.mockRejectedValueOnce(
      new OrganizerEventError("duplicate_slug", "raw database detail"),
    );

    await expect(createOrganizerEventAction(validForm())).rejects.toThrow(/error_slug=/);
    await expect(createOrganizerEventAction(form({
      title: "", slug: "bad slug", timezone: "Mars/Olympus", startsAt: "bad", endsAt: "bad",
    }))).rejects.toThrow(/error_title=/);
    expect(mocks.createOrganizerEvent).toHaveBeenCalledTimes(1);
  });

  it("renders five associated create controls, field errors, and encoded open links", async () => {
    mocks.listOrganizerEvents.mockResolvedValue([
      { id: "event/id", title: "Существующее", slug: "existing" },
    ]);

    const page = await OrganizerPage({
      searchParams: Promise.resolve({ title: "Сохранено", error_slug: "Некорректный slug" }),
    });
    const markup = renderToStaticMarkup(page);

    for (const field of ["title", "slug", "timezone", "startsAt", "endsAt"]) {
      expect(markup).toContain(`name="${field}"`);
    }
    expect(markup).toContain('aria-describedby="event-slug-error"');
    expect(markup).toContain("Некорректный slug");
    expect(markup).toContain("Сохранено");
    expect(markup).toContain("/organizer/events/event%2Fid/program");
  });
});
