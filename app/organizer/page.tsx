import Link from "next/link";

import { logoutOrganizerAction } from "@/app/organizer/actions";
import { createOrganizerEventAction } from "@/app/organizer/events/actions";
import { requireOrganizer } from "@/lib/auth/request-organizer";
import { getRepository } from "@/lib/data/database";
import { CURRENT_PRODUCT_TIMEZONE } from "@/lib/domain/validation";

export const dynamic = "force-dynamic";

type OrganizerSearchParams = Record<string, string | string[] | undefined>;
const fields = ["title", "slug", "timezone", "startsAt", "endsAt"] as const;
type Field = (typeof fields)[number];

function first(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function OrganizerPage({
  searchParams,
}: {
  searchParams?: Promise<OrganizerSearchParams>;
}) {
  const organizer = await requireOrganizer("/organizer");
  const events = await getRepository().listOrganizerEvents();
  const params = (await searchParams) ?? {};
  const name = organizer.email ?? "Организатор";
  const values: Record<Field, string> = {
    title: first(params.title),
    slug: first(params.slug),
    timezone: first(params.timezone) || CURRENT_PRODUCT_TIMEZONE,
    startsAt: first(params.startsAt),
    endsAt: first(params.endsAt),
  };
  const errors = Object.fromEntries(
    fields.map((field) => [field, first(params[`error_${field}`])]),
  ) as Record<Field, string>;
  const formError = first(params.error_form);

  return (
    <main className="shell organizer-dashboard">
      <header className="organizer-heading">
        <p className="eyebrow">Organizer Console</p>
        <h1>События</h1>
        <p className="quiet-note">{name}</p>
      </header>

      <section className="organizer-event-create" aria-labelledby="create-event-title">
        <h2 id="create-event-title">Создать черновик события</h2>
        <p className="quiet-note">Черновик не публикуется автоматически.</p>
        {formError ? <p className="feedback error" role="alert">{formError}</p> : null}
        <form action={createOrganizerEventAction} className="organizer-event-form" noValidate>
          <label htmlFor="event-title">Название события
            <input id="event-title" name="title" required defaultValue={values.title} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "event-title-error" : undefined} />
          </label>
          {errors.title ? <p id="event-title-error" className="field-error">{errors.title}</p> : null}
          <label htmlFor="event-slug">Slug
            <input id="event-slug" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={values.slug} aria-invalid={Boolean(errors.slug)} aria-describedby={errors.slug ? "event-slug-error" : undefined} />
          </label>
          {errors.slug ? <p id="event-slug-error" className="field-error">{errors.slug}</p> : null}
          <label htmlFor="event-timezone">Часовой пояс
            <input id="event-timezone" name="timezone" required defaultValue={values.timezone} aria-invalid={Boolean(errors.timezone)} aria-describedby={errors.timezone ? "event-timezone-error" : undefined} />
          </label>
          {errors.timezone ? <p id="event-timezone-error" className="field-error">{errors.timezone}</p> : null}
          <div className="form-pair">
            <label htmlFor="event-starts-at">Начало
              <input id="event-starts-at" name="startsAt" type="datetime-local" required defaultValue={values.startsAt} aria-invalid={Boolean(errors.startsAt)} aria-describedby={errors.startsAt ? "event-starts-at-error" : undefined} />
            </label>
            <label htmlFor="event-ends-at">Окончание
              <input id="event-ends-at" name="endsAt" type="datetime-local" required defaultValue={values.endsAt} aria-invalid={Boolean(errors.endsAt)} aria-describedby={errors.endsAt ? "event-ends-at-error" : undefined} />
            </label>
          </div>
          {errors.startsAt ? <p id="event-starts-at-error" className="field-error">{errors.startsAt}</p> : null}
          {errors.endsAt ? <p id="event-ends-at-error" className="field-error">{errors.endsAt}</p> : null}
          <button className="button primary-button" type="submit">Создать черновик</button>
        </form>
      </section>

      <section className="organizer-event-list" aria-labelledby="event-list-title">
        <h2 id="event-list-title">Все события</h2>
        {events.length === 0 ? <p className="quiet-note">Событий пока нет. Создайте первый черновик.</p> : (
          <ul>{events.map((event) => (
            <li key={event.id}><Link href={`/organizer/events/${encodeURIComponent(event.id)}/program`}><strong>{event.title}</strong><span>{event.slug}</span></Link></li>
          ))}</ul>
        )}
      </section>
      <form action={logoutOrganizerAction}><button className="button secondary-button" type="submit">Выйти</button></form>
    </main>
  );
}
