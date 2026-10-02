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
import { groupProgramTimeline } from "@/lib/domain/program-groups";
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
  const timeGroups = groupProgramTimeline(program, timeline.sessions);
  const today = buildTodayView(program, now);
  const current = today.current;
  const concurrentSessions = timeline.sessions.filter((item) => item.status === "concurrent");
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
          <div className="current-session-layout">
            <div className="current-session-primary">
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
            </div>
            {concurrentSessions.length > 0 ? (
              <aside className="concurrent-now" aria-label="Параллельные сессии">
                <p className="concurrent-now-label">Параллельно</p>
                {concurrentSessions.map(({ session, status }) => (
                  <SessionCard
                    key={session.id}
                    program={program}
                    session={session}
                    status={status}
                  />
                ))}
              </aside>
            ) : null}
          </div>
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
          <span>Время по Москве</span>
        </div>
        {timeGroups.length > 0 ? (
          timeGroups.map((group) => (
            <section className="program-time-group" key={`${group.startsAt}-${group.endsAt}`}>
              <p className="program-time-context" aria-label="Общий временной диапазон">
                <time dateTime={group.startsAt}>
                  {formatEventTime(group.startsAt, program.event.timezone)}
                </time>
                <span aria-hidden="true">—</span>
                <time dateTime={group.endsAt}>
                  {formatEventTime(group.endsAt, program.event.timezone)}
                </time>
              </p>
              <div className="program-lanes">
                {group.lanes.map((lane) => (
                  <section className="program-lane" key={lane.locationId ?? "no-location"}>
                    <h3>{lane.name}</h3>
                    {lane.sessions.map(({ session, status }) => (
                      <SessionCard
                        key={session.id}
                        program={program}
                        session={session}
                        status={status}
                        isNext={today.next?.id === session.id}
                      />
                    ))}
                  </section>
                ))}
              </div>
            </section>
          ))
        ) : (
          <p className="quiet-note">В опубликованной программе пока нет сессий.</p>
        )}
      </section>
    </main>
  );
}
