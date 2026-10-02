import Link from "next/link";
import { notFound } from "next/navigation";

import { ComingSoonCard } from "@/components/coming-soon-card";
import { SessionCard } from "@/components/session-card";
import { getRepository } from "@/lib/data/database";
import { formatEventDate } from "@/lib/domain/presentation";
import { buildTodayView } from "@/lib/domain/today";
import { getSessionLiveDestination } from "@/lib/live/session-destination";

export const dynamic = "force-dynamic";

export default async function TodayPage({
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
  const now = new Date();
  const { current, next } = buildTodayView(program, now);
  const liveDestination = current
    ? getSessionLiveDestination(program, current.session.id)
    : null;

  return (
    <main className="shell">
      <nav className="event-nav" aria-label="Разделы события">
        <Link aria-current="page" href={`/e/${eventSlug}`}>
          Сегодня
        </Link>
        <Link href={`/e/${eventSlug}/program`}>Программа</Link>
      </nav>

      <header className="event-heading">
        <p className="eyebrow">{formatEventDate(now.toISOString(), program.event.timezone)}</p>
        <h1>{program.event.title}</h1>
        <p className="timezone-note">Ваш ориентир на событии · {program.event.timezone}</p>
      </header>

      <section className="now-stage" aria-labelledby="now-title">
        <div className="pulse-rail" aria-hidden="true">
          <span />
        </div>
        <div className="now-content">
          <p className="eyebrow" id="now-title">
            NOW
            {current
              ? current.source === "manual"
                ? " · выбор организатора"
                : " · по расписанию"
              : ""}
          </p>
          {current ? (
            <>
              <SessionCard program={program} session={current.session} showSummary />
              {liveDestination ? (
                <a className="live-cta" href={liveDestination.href}>
                  Задать вопрос <span aria-hidden="true">↗</span>
                </a>
              ) : null}
            </>
          ) : (
            <div className="empty-now">
              <h2>Сейчас нет активной сессии</h2>
              <p>Ориентируйтесь на следующую сессию или откройте полную программу.</p>
            </div>
          )}
        </div>
      </section>

      <section className="next-block" aria-labelledby="next-title">
        <div className="section-heading">
          <p className="eyebrow" id="next-title">
            NEXT
          </p>
          <Link href={`/e/${eventSlug}/program`}>Вся программа →</Link>
        </div>
        {next ? (
          <SessionCard program={program} session={next} label="Следующая сессия" />
        ) : (
          <p className="quiet-note">Следующих сессий пока нет.</p>
        )}
      </section>
    </main>
  );
}
