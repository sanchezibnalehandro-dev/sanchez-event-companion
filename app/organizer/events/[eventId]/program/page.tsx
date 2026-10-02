import { notFound } from "next/navigation";

import { OrganizerLocked } from "@/components/organizer-locked";
import { getRequestOrganizer } from "@/lib/auth/request-organizer";
import { getRepository } from "@/lib/data/database";

export const dynamic = "force-dynamic";

export default async function OrganizerProgramPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const organizer = await getRequestOrganizer();
  if (!organizer) return <OrganizerLocked />;

  const { eventId } = await params;
  const program = getRepository().getOrganizerProgram(eventId);
  if (!program) notFound();

  return (
    <main className="shell organizer-shell">
      <p className="eyebrow">Organizer · program boundary</p>
      <h1>{program.event.title}</h1>
      <div className="organizer-summary">
        <p>
          Состояние <strong>{program.event.programState}</strong>
        </p>
        <p>
          Сессий <strong>{program.sessions.length}</strong>
        </p>
        <p>
          Спикеров <strong>{program.speakers.length}</strong>
        </p>
      </div>
      <p className="quiet-note">
        CRUD и редактор программы намеренно отложены до Phase 2. Этот маршрут доказывает
        отдельный защищённый server-side read path.
      </p>
    </main>
  );
}
