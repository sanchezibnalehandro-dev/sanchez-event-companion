"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getRequestOrganizer } from "@/lib/auth/request-organizer";
import { getRepository } from "@/lib/data/database";
import { eventLocalDateTimeToInstant } from "@/lib/domain/presentation";
import type { ProgramAggregate, Session } from "@/lib/domain/types";

function value(formData: FormData, name: string): string {
  const field = formData.get(name);
  return typeof field === "string" ? field.trim() : "";
}

function feedbackUrl(eventId: string, tone: "success" | "error", message: string): string {
  return `/organizer/events/${encodeURIComponent(eventId)}/program?tone=${tone}&message=${encodeURIComponent(message)}`;
}

function revalidateProgram(program: ProgramAggregate): void {
  revalidatePath(`/organizer/events/${program.event.id}/program`);
  revalidatePath(`/organizer/events/${program.event.id}/settings`);
  revalidatePath(`/e/${program.event.slug}`);
  revalidatePath(`/e/${program.event.slug}/program`);
  for (const session of program.sessions) {
    revalidatePath(`/e/${program.event.slug}/sessions/${session.slug}`);
  }
}

async function runOrganizerAction(
  eventId: string,
  successMessage: string,
  operation: (program: ProgramAggregate, actorId: string) => void,
): Promise<never> {
  const actor = await getRequestOrganizer();
  if (!actor) redirect(feedbackUrl(eventId, "error", "Доступ организатора закрыт"));

  const repository = getRepository();
  const program = repository.getOrganizerProgram(eventId);
  if (!program) redirect(feedbackUrl(eventId, "error", "Событие не найдено"));

  let outcome: { tone: "success" | "error"; message: string };
  try {
    operation(program, actor.id);
    revalidateProgram(program);
    outcome = { tone: "success", message: successMessage };
  } catch (error) {
    outcome = {
      tone: "error",
      message: error instanceof Error ? error.message : "Не удалось сохранить изменения",
    };
  }
  redirect(feedbackUrl(eventId, outcome.tone, outcome.message));
}

function sessionFromForm(
  formData: FormData,
  program: ProgramAggregate,
  options: { id: string; sortOrder: number },
): { session: Session; speakerIds: string[] } {
  const title = value(formData, "title");
  const slug = value(formData, "slug");
  const summary = value(formData, "summary");
  if (title.length > 140) throw new Error("Название не должно превышать 140 символов");
  if (summary.length > 1200) throw new Error("Описание не должно превышать 1200 символов");

  const locationId = value(formData, "locationId") || null;
  const speakerIds = formData
    .getAll("speakerIds")
    .filter((item): item is string => typeof item === "string" && item.length > 0);

  return {
    session: {
      id: options.id,
      eventId: program.event.id,
      slug,
      title,
      summary,
      startsAt: eventLocalDateTimeToInstant(
        value(formData, "startsAtLocal"),
        program.event.timezone,
      ),
      endsAt: eventLocalDateTimeToInstant(
        value(formData, "endsAtLocal"),
        program.event.timezone,
      ),
      locationId,
      sortOrder: options.sortOrder,
    },
    speakerIds,
  };
}

export async function createSessionAction(formData: FormData): Promise<never> {
  const eventId = value(formData, "eventId");
  return runOrganizerAction(eventId, "Сессия создана", (program) => {
    const nextSortOrder =
      Math.max(-1, ...program.sessions.map((session) => session.sortOrder)) + 1;
    getRepository().createSession(
      sessionFromForm(formData, program, { id: randomUUID(), sortOrder: nextSortOrder }),
    );
  });
}

export async function updateSessionAction(formData: FormData): Promise<never> {
  const eventId = value(formData, "eventId");
  const sessionId = value(formData, "sessionId");
  return runOrganizerAction(eventId, "Сессия обновлена", (program) => {
    const existing = program.sessions.find((session) => session.id === sessionId);
    if (!existing) throw new Error("Сессия не найдена");
    getRepository().updateSession(
      sessionFromForm(formData, program, {
        id: existing.id,
        sortOrder: existing.sortOrder,
      }),
    );
  });
}

export async function deleteSessionAction(formData: FormData): Promise<never> {
  const eventId = value(formData, "eventId");
  const sessionId = value(formData, "sessionId");
  return runOrganizerAction(eventId, "Сессия удалена", () => {
    getRepository().deleteSession(eventId, sessionId);
  });
}

export async function reorderSessionsAction(formData: FormData): Promise<never> {
  const eventId = value(formData, "eventId");
  return runOrganizerAction(eventId, "Новый порядок сохранён", () => {
    const parsed: unknown = JSON.parse(value(formData, "orderedSessionIds"));
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
      throw new Error("Некорректный набор сессий для сортировки");
    }
    getRepository().reorderSessions(eventId, parsed);
  });
}

export async function publishProgramAction(formData: FormData): Promise<never> {
  const eventId = value(formData, "eventId");
  return runOrganizerAction(eventId, "Программа опубликована", () => {
    getRepository().setProgramPublished(eventId, new Date().toISOString());
  });
}

export async function unpublishProgramAction(formData: FormData): Promise<never> {
  const eventId = value(formData, "eventId");
  return runOrganizerAction(eventId, "Программа снята с публикации", () => {
    getRepository().setProgramUnpublished(eventId);
  });
}

export async function setManualCurrentAction(formData: FormData): Promise<never> {
  const eventId = value(formData, "eventId");
  const sessionId = value(formData, "sessionId");
  return runOrganizerAction(eventId, "Текущая сессия выбрана вручную", (_, actorId) => {
    getRepository().setManualCurrentSession(
      eventId,
      sessionId,
      actorId,
      new Date().toISOString(),
    );
  });
}

export async function clearManualCurrentAction(formData: FormData): Promise<never> {
  const eventId = value(formData, "eventId");
  return runOrganizerAction(eventId, "Ручной выбор снят — действует расписание", () => {
    getRepository().clearManualCurrentSession(eventId);
  });
}
