import Link from "next/link";
import { notFound } from "next/navigation";

import { ComingSoonCard } from "@/components/coming-soon-card";
import { SessionCard } from "@/components/session-card";
import { getRepository } from "@/lib/data/database";
import { buildProgramTimeline } from "@/lib/domain/program-timeline";

export const dynamic = "force-dynamic";

export default async function ProgramPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;
  const result = getRepository().getPublicProgramBySlug(eventSlug);

  if (result.status === "not_found") notFound();
  if (result.status === "unavailable") {
    return (
      <main className="shell narrow-shell">
        <ComingSoonCard />
      </main>
    );
  }

  const { program } = result;
  const timeline = buildProgramTimeline(program, new Date());
  return (
    <main className="shell">
      <nav className="event-nav" aria-label="Разделы события">
        <Link href={`/e/${eventSlug}`}>Сегодня</Link>
        <Link aria-current="page" href={`/e/${eventSlug}/program`}>
          Программа
        </Link>
      </nav>
      <header className="event-heading compact-heading">
        <p className="eyebrow">Опубликованная программа</p>
        <h1>{program.event.title}</h1>
        <p className="timezone-note">Все времена · {program.event.timezone}</p>
      </header>
      <section className="agenda" aria-label="Сессии программы">
        {timeline.sessions.length > 0 ? (
          timeline.sessions.map(({ session, status }) => (
            <SessionCard
              key={session.id}
              program={program}
              session={session}
              status={status}
            />
          ))
        ) : (
          <p className="quiet-note">В опубликованной программе пока нет сессий.</p>
        )}
      </section>
    </main>
  );
}
