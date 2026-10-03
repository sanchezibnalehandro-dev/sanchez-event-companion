"use server";

import { redirect } from "next/navigation";

import { requireOrganizer } from "@/lib/auth/request-organizer";
import { getRepository } from "@/lib/data/database";
import {
  OrganizerEventError,
  type CreateOrganizerEventInput,
} from "@/lib/data/repository";
import { eventLocalDateTimeToInstant } from "@/lib/domain/presentation";
import { CURRENT_PRODUCT_TIMEZONE } from "@/lib/domain/validation";

type EventField = keyof CreateOrganizerEventInput;
type EventFormValues = Record<EventField, string>;

const fields: readonly EventField[] = ["title", "slug", "timezone", "startsAt", "endsAt"];
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function value(formData: FormData, name: EventField): string {
  const field = formData.get(name);
  return typeof field === "string" ? field : "";
}

function feedbackUrl(
  values: EventFormValues,
  errors: Partial<Record<EventField | "form", string>>,
): string {
  const search = new URLSearchParams();
  for (const field of fields) {
    if (values[field]) search.set(field, values[field]);
  }
  for (const [field, message] of Object.entries(errors)) {
    if (message) search.set(`error_${field}`, message);
  }
  return `/organizer?${search.toString()}`;
}

function validateForm(values: EventFormValues): {
  errors: Partial<Record<EventField, string>>;
  payload?: CreateOrganizerEventInput;
} {
  const errors: Partial<Record<EventField, string>> = {};
  if (!values.title.trim()) errors.title = "Укажите название события.";
  if (!slugPattern.test(values.slug)) errors.slug = "Используйте строчные латинские слова через дефис.";
  if (values.timezone !== CURRENT_PRODUCT_TIMEZONE) {
    errors.timezone = "Поддерживается только Europe/Moscow.";
  }

  let startsAt: string | undefined;
  let endsAt: string | undefined;
  if (!errors.timezone) {
    try {
      startsAt = eventLocalDateTimeToInstant(values.startsAt, values.timezone);
    } catch {
      errors.startsAt = "Укажите корректные дату и время начала.";
    }
    try {
      endsAt = eventLocalDateTimeToInstant(values.endsAt, values.timezone);
    } catch {
      errors.endsAt = "Укажите корректные дату и время окончания.";
    }
  }
  if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    errors.endsAt = "Окончание должно быть позже начала.";
  }
  if (Object.keys(errors).length || !startsAt || !endsAt) return { errors };
  return { errors, payload: { ...values, title: values.title.trim(), startsAt, endsAt } };
}

/** Creates a draft only after the organizer guard and local transport validation. */
export async function createOrganizerEventAction(formData: FormData): Promise<never> {
  await requireOrganizer("/organizer");
  const values = Object.fromEntries(fields.map((field) => [field, value(formData, field)])) as EventFormValues;
  const { errors, payload } = validateForm(values);
  if (Object.keys(errors).length || !payload) redirect(feedbackUrl(values, errors));

  let event;
  try {
    event = await getRepository().createOrganizerEvent(payload);
  } catch (error) {
    if (error instanceof OrganizerEventError) {
      const field: EventField = error.code === "duplicate_slug" ? "slug" : error.code;
      redirect(feedbackUrl(values, { [field]: "Проверьте значение этого поля." }));
    }
    redirect(feedbackUrl(values, { form: "Не удалось создать событие. Повторите попытку." }));
  }
  redirect(`/organizer/events/${encodeURIComponent(event.id)}/program`);
}
