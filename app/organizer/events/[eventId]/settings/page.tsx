import { notFound } from "next/navigation";

import { logoutOrganizerAction } from "@/app/organizer/actions";
import { requireOrganizer } from "@/lib/auth/request-organizer";
import { getRepository } from "@/lib/data/database";

export const dynamic = "force-dynamic";

export default async function OrganizerSettingsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  await requireOrganizer(`/organizer/events/${encodeURIComponent(eventId)}/settings`);
  const program = await getRepository().getOrganizerProgram(eventId);
  if (!program) notFound();

  return (
    <main className="shell organizer-shell">
      <p className="eyebrow">Organizer · settings boundary</p>
      <h1>{program.event.title}</h1>
      <form action={logoutOrganizerAction}>
        <button className="button secondary-button" type="submit">Выйти</button>
      </form>
      <dl className="settings-list">
        <div>
          <dt>Timezone</dt>
          <dd>{program.event.timezone}</dd>
        </div>
        <div>
          <dt>Manual current session</dt>
          <dd>{program.runtime?.manualCurrentSessionId ?? "не задана"}</dd>
        </div>
        <div>
          <dt>LIVE integrations</dt>
          <dd>{program.liveIntegrations.length}</dd>
        </div>
      </dl>
      <p className="quiet-note">Формы настроек появятся в отдельной фазе.</p>
    </main>
  );
}
