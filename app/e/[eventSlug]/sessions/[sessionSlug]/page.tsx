import Link from "next/link";
import { notFound } from "next/navigation";

import { ComingSoonCard } from "@/components/coming-soon-card";
import { getRepository } from "@/lib/data/database";
import {
  formatEventTime,
  getSessionLocation,
  getSessionSpeakers,
} from "@/lib/domain/presentation";
import { getSessionLiveDestination } from "@/lib/live/session-destination";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ eventSlug: string; sessionSlug: string }>;
}) {
  const { eventSlug, sessionSlug } = await params;
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
  const session = program.sessions.find((item) => item.slug === sessionSlug);
  if (!session) notFound();

  const location = getSessionLocation(program, session);
  const speakers = getSessionSpeakers(program, session.id);
  const liveDestination = getSessionLiveDestination(program, session.id);

  return (
    <main className="shell narrow-shell">
      <Link className="back-link" href={`/e/${eventSlug}/program`}>
        ← К программе
      </Link>
      <article className="session-detail">
        <p className="eyebrow">
          <time dateTime={session.startsAt}>
            {formatEventTime(session.startsAt, program.event.timezone)}
          </time>
          {" — "}
          <time dateTime={session.endsAt}>
            {formatEventTime(session.endsAt, program.event.timezone)}
          </time>
          {location ? ` · ${location}` : ""}
        </p>
        <h1>{session.title}</h1>
        {session.summary ? <p className="lede">{session.summary}</p> : null}

        {speakers.length > 0 ? (
          <section className="speaker-list" aria-labelledby="speakers-title">
            <h2 id="speakers-title">Участники</h2>
            {speakers.map(({ speaker, sessionRole }) => (
              <article key={speaker.id}>
                <h3>{speaker.name}</h3>
                <p>
                  {[sessionRole, speaker.role, speaker.company].filter(Boolean).join(" · ")}
                </p>
                {speaker.bio ? <p>{speaker.bio}</p> : null}
              </article>
            ))}
          </section>
        ) : null}

        {liveDestination ? (
          <a className="live-cta" href={liveDestination.href}>
            Перейти в LIVE Q&amp;A <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <p className="quiet-note">LIVE Q&amp;A для этой сессии не предусмотрен.</p>
        )}
      </article>
    </main>
  );
}
