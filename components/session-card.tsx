import Link from "next/link";

import type { ProgramAggregate, Session } from "@/lib/domain/types";
import type { SessionTimelineStatus } from "@/lib/domain/program-timeline";
import {
  formatEventTime,
  getSessionLocation,
  getSessionSpeakers,
} from "@/lib/domain/presentation";

export function SessionCard({
  program,
  session,
  label,
  status,
  isNext = false,
  showSummary = false,
  navigationMode = "public",
}: {
  program: ProgramAggregate;
  session: Session;
  label?: string;
  status?: SessionTimelineStatus;
  isNext?: boolean;
  showSummary?: boolean;
  navigationMode?: "public" | "preview";
}) {
  const location = getSessionLocation(program, session);
  const speakers = getSessionSpeakers(program, session.id);

  return (
    <article className={`session-card${status ? ` session-${status}` : ""}`}>
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
        {status === "current" || status === "concurrent" || isNext ? (
          <div className="session-badges">
            {status === "current" ? <span className="timeline-status current">Сейчас</span> : null}
            {status === "concurrent" ? <span className="timeline-status concurrent">Параллельно</span> : null}
            {isNext ? <span className="timeline-status next">Следующий</span> : null}
          </div>
        ) : null}
        <h2>
          {navigationMode === "public" ? (
            <Link href={`/e/${program.event.slug}/sessions/${session.slug}`}>
              {session.title}
            </Link>
          ) : session.title}
        </h2>
        {location ? <p className="meta">{location}</p> : null}
        {speakers.length > 0 ? (
          <p className="meta">
            {speakers.map(({ speaker }) => speaker.name).join(" · ")}
          </p>
        ) : null}
        {showSummary && session.summary ? <p className="session-summary">{session.summary}</p> : null}
      </div>
    </article>
  );
}
