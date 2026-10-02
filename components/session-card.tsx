import Link from "next/link";

import type { ProgramAggregate, Session } from "@/lib/domain/types";
import {
  formatEventTime,
  getSessionLocation,
  getSessionSpeakers,
} from "@/lib/domain/presentation";

export function SessionCard({
  program,
  session,
  label,
}: {
  program: ProgramAggregate;
  session: Session;
  label?: string;
}) {
  const location = getSessionLocation(program, session);
  const speakers = getSessionSpeakers(program, session.id);

  return (
    <article className="session-card">
      <div className="session-time">
        {label ? <span className="session-label">{label}</span> : null}
        <time dateTime={session.startsAt}>
          {formatEventTime(session.startsAt, program.event.timezone)}
        </time>
        <span aria-hidden="true">—</span>
        <time dateTime={session.endsAt}>
          {formatEventTime(session.endsAt, program.event.timezone)}
        </time>
      </div>
      <div className="session-copy">
        <h2>
          <Link href={`/e/${program.event.slug}/sessions/${session.slug}`}>
            {session.title}
          </Link>
        </h2>
        {location ? <p className="meta">{location}</p> : null}
        {speakers.length > 0 ? (
          <p className="meta">
            {speakers.map(({ speaker }) => speaker.name).join(" · ")}
          </p>
        ) : null}
      </div>
    </article>
  );
}
