import Link from "next/link";

import { formatEventDate } from "@/lib/domain/presentation";
import type { ProgramAggregate } from "@/lib/domain/types";

function ProgramActionContent() {
  return (
    <>
      <span className={'hub-action-icon'} aria-hidden={'true'}>
        <svg viewBox={'0 0 24 24'}><path d={'M6 3v3M18 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z'}/><path d={'M8 12h3M8 16h3M14 12h2M14 16h2'}/></svg>
      </span>
      <span className={'hub-action-copy'}>
        <strong>Программа дня</strong>
        <span>Расписание, спикеры и площадки</span>
      </span>
      <span className={'hub-action-arrow'} aria-hidden={'true'}>→</span>
    </>
  );
}

export function GuestEventHub({
  program,
  programHref,
  liveQuestionHref,
  previewLabel,
}: {
  program: ProgramAggregate;
  programHref: string | null;
  liveQuestionHref: string | null;
  previewLabel?: string;
}) {
  return (
    <main className={'guest-shell hub-shell'}>
      {previewLabel ? <p className={'guest-preview-marker'}>{previewLabel}</p> : null}
      <header className={'hub-event-header'}>
        <div className={'guest-brand'} aria-label={'SANCHEZ'}>
          <span className={'guest-brand-mark'} aria-hidden={'true'}>S</span>
          <span className={'guest-brand-name'}>SANCHEZ</span>
        </div>
        <p className={'hub-event-date'}>
          {formatEventDate(program.event.startsAt, program.event.timezone)}
        </p>
        <p className={'hub-event-title'}>{program.event.title}</p>
      </header>
      <section className={'hub-intro'} aria-labelledby={'participate-title'}>
        <p className={'guest-kicker'}>Для гостей</p>
        <h1 id={'participate-title'}>Участвуйте</h1>
        <p>Выберите, что хотите сделать прямо сейчас.</p>
      </section>
      <section className={'hub-actions'} aria-label={'Действия гостя'}>
        {liveQuestionHref ? (
          <a className={'hub-action-card'} href={liveQuestionHref}>
            <span className={'hub-action-icon'} aria-hidden={'true'}>
              <svg viewBox={'0 0 24 24'}><path d={'M7 18.5 3.5 21v-4.7A8.5 8.5 0 1 1 7 18.5Z'}/><path d={'M8 10h8M8 14h5'}/></svg>
            </span>
            <span className={'hub-action-copy'}>
              <strong>Задать вопрос спикеру</strong>
              <span>Перейти в SANCHEZ LIVE Q&amp;A</span>
            </span>
            <span className={'hub-action-arrow'} aria-hidden={'true'}>↗</span>
          </a>
        ) : (
          <div className={'hub-action-card is-unavailable'} aria-disabled={'true'}>
            <span className={'hub-action-icon'} aria-hidden={'true'}>
              <svg viewBox={'0 0 24 24'}><path d={'M7 18.5 3.5 21v-4.7A8.5 8.5 0 1 1 7 18.5Z'}/><path d={'M8 10h8M8 14h5'}/></svg>
            </span>
            <span className={'hub-action-copy'}>
              <strong>Задать вопрос спикеру</strong>
              <span>Для текущей сессии ссылка пока недоступна</span>
            </span>
            <span className={'hub-action-status'}>Недоступно</span>
          </div>
        )}
        {programHref ? (
          <Link className={'hub-action-card'} href={programHref}>
            <ProgramActionContent />
          </Link>
        ) : (
          <div className={'hub-action-card is-unavailable'} aria-disabled={'true'}>
            <ProgramActionContent />
          </div>
        )}
      </section>
    </main>
  );
}
