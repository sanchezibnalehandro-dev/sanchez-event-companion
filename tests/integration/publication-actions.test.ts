import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { event, makeProgram } from "@/tests/helpers/fixtures";

const mocks = vi.hoisted(() => ({
  requireOrganizer: vi.fn(),
  getRepository: vi.fn(),
  getOrganizerProgram: vi.fn(),
  setProgramPublished: vi.fn(),
  setProgramUnpublished: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

const repository = {
  getOrganizerProgram: mocks.getOrganizerProgram,
  setProgramPublished: mocks.setProgramPublished,
  setProgramUnpublished: mocks.setProgramUnpublished,
};

vi.mock("@/lib/auth/request-organizer", () => ({ requireOrganizer: mocks.requireOrganizer }));
vi.mock("@/lib/data/database", () => ({ getRepository: mocks.getRepository }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  publishProgramAction,
  unpublishProgramAction,
} from "@/app/organizer/events/[eventId]/program/actions";
import { OrganizerProgramEditor } from "@/components/organizer-program-editor";

const eventForm = (): FormData => {
  const form = new FormData();
  form.set("eventId", event.id);
  return form;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireOrganizer.mockResolvedValue({ id: "organizer-1" });
  mocks.getRepository.mockReturnValue(repository);
  mocks.getOrganizerProgram.mockResolvedValue(makeProgram());
  mocks.setProgramPublished.mockResolvedValue(undefined);
  mocks.setProgramUnpublished.mockResolvedValue(undefined);
});

describe("programme publication actions", () => {
  it("authenticates publish and unpublish before any repository access", async () => {
    mocks.requireOrganizer.mockRejectedValue(new Error("unauthenticated organizer"));

    await expect(publishProgramAction(eventForm())).rejects.toThrow("unauthenticated organizer");
    await expect(unpublishProgramAction(eventForm())).rejects.toThrow("unauthenticated organizer");

    expect(mocks.getRepository).not.toHaveBeenCalled();
    expect(mocks.getOrganizerProgram).not.toHaveBeenCalled();
    expect(mocks.setProgramPublished).not.toHaveBeenCalled();
    expect(mocks.setProgramUnpublished).not.toHaveBeenCalled();
  });

  it("publishes through its sole repository command and invalidates organizer and guest routes", async () => {
    await expect(publishProgramAction(eventForm())).rejects.toThrow("tone=success");

    expect(mocks.setProgramPublished).toHaveBeenCalledOnce();
    expect(mocks.setProgramPublished).toHaveBeenCalledWith(event.id, expect.any(String));
    expect(mocks.setProgramUnpublished).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/organizer/events/${event.id}/program`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/organizer/events/${event.id}/settings`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/e/${event.slug}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/e/${event.slug}/program`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/e/${event.slug}/sessions/opening`);
  });

  it("unpublishes through its sole repository command", async () => {
    await expect(unpublishProgramAction(eventForm())).rejects.toThrow("tone=success");

    expect(mocks.setProgramUnpublished).toHaveBeenCalledOnce();
    expect(mocks.setProgramUnpublished).toHaveBeenCalledWith(event.id);
    expect(mocks.setProgramPublished).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });

  it("hides unknown repository details, logs safe context, and skips revalidation", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.setProgramPublished.mockRejectedValueOnce(
      new Error("postgres://organizer:secret@host:5432/companion failed"),
    );

    await expect(publishProgramAction(eventForm())).rejects.toThrow(
      encodeURIComponent("Не удалось сохранить изменения. Повторите попытку."),
    );

    expect(consoleError).toHaveBeenCalledWith({
      operationId: "program.publish",
      eventId: event.id,
      errorClass: "repository_failure",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("programme publication toolbar", () => {
  it.each([
    ["draft", "Черновик"],
    ["unpublished", "Снято с публикации"],
  ] as const)("does not expose a guest link for %s", (programState, label) => {
    const markup = renderToStaticMarkup(
      createElement(OrganizerProgramEditor, {
        program: makeProgram({ event: { ...event, programState, publishedAt: null } }),
        currentSessionId: null,
        currentSource: null,
      }),
    );

    expect(markup).toContain(label);
    expect(markup).toContain("Обычный публичный URL закрыт до явной публикации программы.");
    expect(markup).not.toContain(`/e/${event.slug}/program`);
  });

  it("explains immediate visibility and exposes the canonical guest programme only when published", () => {
    const markup = renderToStaticMarkup(
      createElement(OrganizerProgramEditor, {
        program: makeProgram(),
        currentSessionId: null,
        currentSource: null,
      }),
    );

    expect(markup).toContain("Опубликовано");
    expect(markup).toContain("Изменения программы сразу видны гостям.");
    expect(markup).toContain(`href="/e/${event.slug}/program"`);
  });
});
