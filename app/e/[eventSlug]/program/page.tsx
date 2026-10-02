import Link from "next/link";
import { notFound } from "next/navigation";

import { ComingSoonCard } from "@/components/coming-soon-card";
import { SessionCard } from "@/components/session-card";
import { getRepository } from "@/lib/data/database";
import {
  formatEventTime,
  getSessionLocation,
  getSessionSpeakers,
} from "@/lib/domain/presentation";
import { buildProgramTimeline } from "@/lib/domain/program-timeline";
import { buildTodayView } from "@/lib/domain/today";

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
      <main className="guest-shell state-shell">
        <ComingSoonCard />
      </main>
    );
  }

  const { program } = result;
  const now = new Date();
  const timeline = buildProgramTimeline(program, now);
  const today = buildTodayView(program, now);
  const current = today.current;
  const currentLocation = current ? getSessionLocation(program, current.session) : null;
  const currentSpeakers = current ? getSessionSpeakers(program, current.session.id) : [];
  const remainingMinutes =
    current?.source === "planned" && new Date(current.session.endsAt).getTime() > now.getTime()
      ? Math.ceil((new Date(current.session.endsAt).getTime() - now.getTime()) / 60_000)
      : null;

  return (
    <main className="guest-shell program-shell">
      <Link className="guest-back-link" href={`/e/${eventSlug}`}>
        <span aria-hidden="true">←</span> Назад
      </Link>

      <header className="program-heading">
        <p className="guest-kicker">{program.event.title}</p>
        <h1>Программа дня</h1>
      </header>

      {current ? (
        <section className="current-session" aria-labelledby="current-session-title">
          <div className="current-session-accent" aria-hidden="true" />
          <div className="current-session-topline">
            <span className="current-label">Сейчас идёт</span>
            {remainingMinutes !== null ? (
              <span className="remaining-time">
                {remainingMinutes === 1 ? "Ещё 1 минута" : `Ещё ${remainingMinutes} мин`}
              </span>
            ) : null}
          </div>
          <h2 id="current-session-title">{current.session.title}</h2>
          <p className="current-session-meta">
            <time dateTime={current.session.startsAt}>
              {formatEventTime(current.session.startsAt, program.event.timezone)}
            </time>
            <span aria-hidden="true">—</span>
            <time dateTime={current.session.endsAt}>
              {formatEventTime(current.session.endsAt, program.event.timezone)}
            </time>
            {currentLocation ? <><span aria-hidden="true">·</span><span>{currentLocation}</span></> : null}
            {current.source === "manual" ? <span className="manual-context">Выбор организатора</span> : null}
          </p>
          {currentSpeakers.length > 0 ? (
            <ul className="current-speakers" aria-label="Спикеры текущей сессии">
              {currentSpeakers.map(({ speaker, sessionRole }) => (
                <li key={speaker.id}>
                  <strong>{speaker.name}</strong>
                  {[sessionRole, speaker.role, speaker.company].filter(Boolean).length > 0 ? (
                    <span>{[...new Set([sessionRole, speaker.role, speaker.company].filter(Boolean))].join(" · ")}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {current.session.summary ? <p className="current-summary">{current.session.summary}</p> : null}
        </section>
      ) : (
        <section className="program-no-current" aria-label="Нет текущей сессии">
          <span aria-hidden="true">◷</span>
          <div>
            <h2>Сейчас нет активной сессии</h2>
            <p>Полное расписание остаётся доступно ниже.</p>
          </div>
        </section>
      )}

      <section className="agenda" aria-label="Сессии программы">
        <div className="agenda-heading">
          <h2>Весь день</h2>
          <span>{program.event.timezone}</span>
        </div>
        {timeline.sessions.length > 0 ? (
          timeline.sessions.map(({ session, status }) => (
            <SessionCard
              key={session.id}
              program={program}
              session={session}
              status={status}
              isNext={today.next?.id === session.id}
            />
          ))
        ) : (
          <p className="quiet-note">В опубликованной программе пока нет сессий.</p>
        )}
      </section>
    </main>
  );
}
