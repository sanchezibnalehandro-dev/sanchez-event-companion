import { notFound } from "next/navigation";

import { OrganizerLocked } from "@/components/organizer-locked";
import { getRequestOrganizer } from "@/lib/auth/request-organizer";
import { getRepository } from "@/lib/data/database";

export const dynamic = "force-dynamic";

export default async function OrganizerSettingsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const organizer = await getRequestOrganizer();
  if (!organizer) return <OrganizerLocked />;

  const { eventId } = await params;
  const program = await getRepository().getOrganizerProgram(eventId);
  if (!program) notFound();

  return (
    <main className="shell organizer-shell">
      <p className="eyebrow">Organizer · settings boundary</p>
      <h1>{program.event.title}</h1>
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
      <p className="quiet-note">
        Production-аутентификация и формы настроек не входят в Phase 1.
      </p>
    </main>
  );
}
