"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOrganizer } from "@/lib/auth/request-organizer";
import { getRepository } from "@/lib/data/database";
import type { CompanionRepository } from "@/lib/data/repository";
import { eventLocalDateTimeToInstant } from "@/lib/domain/presentation";
import type { ProgramAggregate, Session } from "@/lib/domain/types";

type OperationId =
  | "program.create-session"
  | "program.update-session"
  | "program.delete-session"
  | "program.reorder-sessions"
  | "program.publish"
  | "program.unpublish"
  | "program.set-manual-current"
  | "program.clear-manual-current";

class CorrectableProgramInputError extends Error {}

function value(formData: FormData, name: string): string {
  const field = formData.get(name);
  return typeof field === "string" ? field.trim() : "";
}

function checked(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
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

function logProgramActionFailure(operationId: OperationId, eventId: string): void {
  console.error({ operationId, eventId, errorClass: "repository_failure" });
}

async function runOrganizerAction(
  eventId: string,
  operationId: OperationId,
  successMessage: string,
  operation: (
    repository: CompanionRepository,
    program: ProgramAggregate,
    actorId: string,
  ) => Promise<void>,
): Promise<never> {
  const actor = await requireOrganizer(`/organizer/events/${encodeURIComponent(eventId)}/program`);

  let repository: CompanionRepository;
  let program: ProgramAggregate | null;
  try {
    repository = getRepository();
    program = await repository.getOrganizerProgram(eventId);
  } catch {
    logProgramActionFailure(operationId, eventId);
    redirect(feedbackUrl(eventId, "error", "Не удалось сохранить изменения. Повторите попытку."));
  }
  if (!program) redirect(feedbackUrl(eventId, "error", "Событие не найдено"));

  try {
    await operation(repository, program, actor.id);
    revalidateProgram(program);
  } catch (error) {
    if (error instanceof CorrectableProgramInputError) {
      redirect(feedbackUrl(eventId, "error", error.message));
    }
    logProgramActionFailure(operationId, eventId);
    redirect(feedbackUrl(eventId, "error", "Не удалось сохранить изменения. Повторите попытку."));
  }
  redirect(feedbackUrl(eventId, "success", successMessage));
}

function sessionFromForm(
  formData: FormData,
  program: ProgramAggregate,
  options: { id: string; sortOrder: number },
): { session: Session; speakerIds: string[] } {
  const title = value(formData, "title");
  const slug = value(formData, "slug");
  const summary = value(formData, "summary");
  if (!title) throw new CorrectableProgramInputError("Укажите название сессии");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new CorrectableProgramInputError("Используйте корректный slug сессии");
  }
  if (title.length > 140) {
    throw new CorrectableProgramInputError("Название не должно превышать 140 символов");
  }
  if (summary.length > 1200) {
    throw new CorrectableProgramInputError("Описание не должно превышать 1200 символов");
  }

  let startsAt: string;
  let endsAt: string;
  try {
    startsAt = eventLocalDateTimeToInstant(value(formData, "startsAtLocal"), program.event.timezone);
    endsAt = eventLocalDateTimeToInstant(value(formData, "endsAtLocal"), program.event.timezone);
  } catch {
    throw new CorrectableProgramInputError("Укажите корректные дату и время сессии");
  }

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
      startsAt,
      endsAt,
      locationId,
      sortOrder: options.sortOrder,
    },
    speakerIds,
  };
}

export async function createSessionAction(formData: FormData): Promise<never> {
  const eventId = value(formData, "eventId");
  return runOrganizerAction(eventId, "program.create-session", "Сессия создана", async (repository, program) => {
    const nextSortOrder =
      Math.max(-1, ...program.sessions.map((session) => session.sortOrder)) + 1;
    await repository.createSession(
      sessionFromForm(formData, program, { id: randomUUID(), sortOrder: nextSortOrder }),
    );
  });
}

export async function updateSessionAction(formData: FormData): Promise<never> {
  const eventId = value(formData, "eventId");
  const sessionId = value(formData, "sessionId");
  return runOrganizerAction(eventId, "program.update-session", "Сессия обновлена", async (repository, program) => {
    const existing = program.sessions.find((session) => session.id === sessionId);
    if (!existing) throw new CorrectableProgramInputError("Сессия не найдена");
    await repository.updateSession({
      ...sessionFromForm(formData, program, {
        id: existing.id,
        sortOrder: existing.sortOrder,
      }),
      autoShiftFollowing: checked(formData, "autoShiftFollowing"),
    });
  });
}

export async function deleteSessionAction(formData: FormData): Promise<never> {
  const eventId = value(formData, "eventId");
  const sessionId = value(formData, "sessionId");
  return runOrganizerAction(eventId, "program.delete-session", "Сессия удалена", async (repository) => {
    await repository.deleteSession(eventId, sessionId);
  });
}

export async function reorderSessionsAction(formData: FormData): Promise<never> {
  const eventId = value(formData, "eventId");
  return runOrganizerAction(eventId, "program.reorder-sessions", "Новый порядок сохранён", async (repository) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value(formData, "orderedSessionIds"));
    } catch {
      throw new CorrectableProgramInputError("Некорректный набор сессий для сортировки");
    }
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
      throw new CorrectableProgramInputError("Некорректный набор сессий для сортировки");
    }
    await repository.reorderSessions(eventId, parsed);
  });
}

export async function publishProgramAction(formData: FormData): Promise<never> {
  const eventId = value(formData, "eventId");
  return runOrganizerAction(eventId, "program.publish", "Программа опубликована", async (repository) => {
    await repository.setProgramPublished(eventId, new Date().toISOString());
  });
}

export async function unpublishProgramAction(formData: FormData): Promise<never> {
  const eventId = value(formData, "eventId");
  return runOrganizerAction(eventId, "program.unpublish", "Программа снята с публикации", async (repository) => {
    await repository.setProgramUnpublished(eventId);
  });
}

export async function setManualCurrentAction(formData: FormData): Promise<never> {
  const eventId = value(formData, "eventId");
  const sessionId = value(formData, "sessionId");
  return runOrganizerAction(
    eventId,
    "program.set-manual-current",
    "Текущая сессия выбрана вручную",
    async (repository, _, actorId) => {
      await repository.setManualCurrentSession(eventId, sessionId, actorId, new Date().toISOString());
    },
  );
}

export async function clearManualCurrentAction(formData: FormData): Promise<never> {
  const eventId = value(formData, "eventId");
  return runOrganizerAction(
    eventId,
    "program.clear-manual-current",
    "Ручной выбор снят — действует расписание",
    async (repository) => {
      await repository.clearManualCurrentSession(eventId);
    },
  );
}
