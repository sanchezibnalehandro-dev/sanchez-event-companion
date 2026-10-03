import { logoutOrganizerAction } from "@/app/organizer/actions";
import { requireOrganizer } from "@/lib/auth/request-organizer";

export const dynamic = "force-dynamic";

export default async function OrganizerPage() {
  const organizer = await requireOrganizer("/organizer");
  const name = organizer.displayName ?? organizer.email ?? "Организатор";

  return (
    <main className="shell narrow-shell">
      <section className="state-card" aria-labelledby="organizer-title">
        <p className="eyebrow">Organizer Console</p>
        <h1 id="organizer-title">Вход выполнен</h1>
        <p>{name}</p>
        <p className="quiet-note">
          Это корневая точка будущей Organizer Console. Список событий появится в отдельной фазе.
        </p>
        <form action={logoutOrganizerAction}>
          <button className="button secondary-button" type="submit">
            Выйти
          </button>
        </form>
      </section>
    </main>
  );
}
