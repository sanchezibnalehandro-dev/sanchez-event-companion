import { notFound } from "next/navigation";

import { logoutOrganizerAction } from "@/app/organizer/actions";
import { OrganizerProgramEditor } from "@/components/organizer-program-editor";
import { requireOrganizer } from "@/lib/auth/request-organizer";
import { getRepository } from "@/lib/data/database";
import { buildTodayView } from "@/lib/domain/today";

export const dynamic = "force-dynamic";

export default async function OrganizerProgramPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ tone?: string; message?: string }>;
}) {
  const { eventId } = await params;
  await requireOrganizer(`/organizer/events/${encodeURIComponent(eventId)}/program`);
  const program = await getRepository().getOrganizerProgram(eventId);
  if (!program) notFound();
  const today = buildTodayView(program, new Date());
  const query = await searchParams;
  const feedback: { tone: "success" | "error"; message: string } | undefined =
    query.message && query.tone === "success"
      ? { tone: "success", message: query.message }
      : query.message && query.tone === "error"
        ? { tone: "error", message: query.message }
        : undefined;

  return (
    <main className="shell organizer-shell">
      <header className="organizer-heading">
        <p className="eyebrow">Event control · {program.event.timezone}</p>
        <h1>{program.event.title}</h1>
        <div className="organizer-links">
          <a href={`/e/${program.event.slug}`} target="_blank" rel="noreferrer">
            Открыть TODAY ↗
          </a>
          <a href={`/e/${program.event.slug}/program`} target="_blank" rel="noreferrer">
            Открыть программу ↗
          </a>
          <form action={logoutOrganizerAction}>
            <button className="text-button" type="submit">Выйти</button>
          </form>
        </div>
      </header>
      <OrganizerProgramEditor
        program={program}
        currentSessionId={today.current?.session.id ?? null}
        currentSource={today.current?.source ?? null}
        feedback={feedback}
      />
    </main>
  );
}
