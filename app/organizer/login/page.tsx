import { redirect } from "next/navigation";

import { loginOrganizerAction } from "@/app/organizer/actions";
import { safeOrganizerNext } from "@/lib/auth/organizer-next";
import { getRequestOrganizer } from "@/lib/auth/request-organizer";

export const dynamic = "force-dynamic";

export default async function OrganizerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const query = await searchParams;
  const next = safeOrganizerNext(query.next);
  if (await getRequestOrganizer()) redirect(next);

  return (
    <main className="shell narrow-shell">
      <section className="state-card organizer-login" aria-labelledby="organizer-login-title">
        <p className="eyebrow">Organizer Console</p>
        <h1 id="organizer-login-title">Вход организатора</h1>
        {query.error === "1" ? (
          <p className="feedback error" role="alert">
            Неверный email или пароль
          </p>
        ) : null}
        <form className="organizer-login-form" action={loginOrganizerAction}>
          <input type="hidden" name="next" value={next} />
          <label>
            Email
            <input name="email" type="email" autoComplete="username" required autoFocus />
          </label>
          <label>
            Пароль
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="button primary-button" type="submit">
            Войти
          </button>
        </form>
      </section>
    </main>
  );
}
