"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  clearManualCurrentAction,
  createSessionAction,
  deleteSessionAction,
  publishProgramAction,
  reorderSessionsAction,
  setManualCurrentAction,
  unpublishProgramAction,
  updateSessionAction,
} from "@/app/organizer/events/[eventId]/program/actions";
import { formatDateTimeLocal, formatEventTime } from "@/lib/domain/presentation";
import type { ProgramAggregate, Session } from "@/lib/domain/types";

type EditorMode =
  | { type: "create" }
  | { type: "edit"; session: Session }
  | { type: "delete"; session: Session }
  | null;

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog ref={ref} className="editor-dialog" onCancel={onClose}>
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}

function SessionForm({
  program,
  session,
  onClose,
}: {
  program: ProgramAggregate;
  session?: Session;
  onClose: () => void;
}) {
  const assignedSpeakers = new Set(
    program.sessionSpeakers
      .filter((link) => link.sessionId === session?.id)
      .map((link) => link.speakerId),
  );
  const fallbackStart = program.sessions.at(-1)?.endsAt ?? program.event.startsAt;
  const fallbackEnd = new Date(new Date(fallbackStart).getTime() + 45 * 60_000).toISOString();
  const action = session ? updateSessionAction : createSessionAction;

  return (
    <form className="editor-form" action={action}>
      <input type="hidden" name="eventId" value={program.event.id} />
      {session ? <input type="hidden" name="sessionId" value={session.id} /> : null}
      <label>
        Название
        <input name="title" required maxLength={140} defaultValue={session?.title} autoFocus />
      </label>
      <label>
        Slug
        <input
          name="slug"
          required
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          placeholder="session-name"
          defaultValue={session?.slug}
        />
      </label>
      <div className="form-pair">
        <label>
          Начало · {program.event.timezone}
          <input
            type="datetime-local"
            name="startsAtLocal"
            required
            defaultValue={formatDateTimeLocal(
              session?.startsAt ?? fallbackStart,
              program.event.timezone,
            )}
          />
        </label>
        <label>
          Окончание · {program.event.timezone}
          <input
            type="datetime-local"
            name="endsAtLocal"
            required
            defaultValue={formatDateTimeLocal(
              session?.endsAt ?? fallbackEnd,
              program.event.timezone,
            )}
          />
        </label>
      </div>
      <label>
        Локация
        <select name="locationId" defaultValue={session?.locationId ?? ""}>
          <option value="">Без локации</option>
          {program.locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      </label>
      {session ? (
        <label className="auto-shift-option">
          <input type="checkbox" name="autoShiftFollowing" defaultChecked />
          <span>
            <strong>Сдвинуть последующие сессии в этом зале</strong>
            <small>Сохраняет интервалы между следующими сессиями.</small>
          </span>
        </label>
      ) : null}
      <label>
        Краткое описание
        <textarea name="summary" maxLength={1200} rows={4} defaultValue={session?.summary} />
      </label>
      <fieldset className="speaker-picker">
        <legend>Спикеры</legend>
        {program.speakers.length ? (
          program.speakers.map((speaker) => (
            <label key={speaker.id}>
              <input
                type="checkbox"
                name="speakerIds"
                value={speaker.id}
                defaultChecked={assignedSpeakers.has(speaker.id)}
              />
              <span>
                <strong>{speaker.name}</strong>
                {[speaker.role, speaker.company].filter(Boolean).join(" · ") ? (
                  <small>{[speaker.role, speaker.company].filter(Boolean).join(" · ")}</small>
                ) : null}
              </span>
            </label>
          ))
        ) : (
          <p className="quiet-note">В событии пока нет спикеров.</p>
        )}
      </fieldset>
      <div className="dialog-actions">
        <button className="button secondary-button" type="button" onClick={onClose}>
          Отмена
        </button>
        <button className="button primary-button" type="submit">
          {session ? "Сохранить изменения" : "Создать сессию"}
        </button>
      </div>
    </form>
  );
}

function moveItem(items: string[], index: number, direction: -1 | 1): string[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const result = [...items];
  [result[index], result[target]] = [result[target]!, result[index]!];
  return result;
}

export function OrganizerProgramEditor({
  program,
  currentSessionId,
  currentSource,
  feedback,
}: {
  program: ProgramAggregate;
  currentSessionId: string | null;
  currentSource: "manual" | "planned" | null;
  feedback?: { tone: "success" | "error"; message: string };
}) {
  const initialOrder = useMemo(() => program.sessions.map((session) => session.id), [program]);
  const [order, setOrder] = useState(initialOrder);
  const [mode, setMode] = useState<EditorMode>(null);
  const sessionsById = new Map(program.sessions.map((session) => [session.id, session]));
  const orderChanged = order.some((id, index) => id !== initialOrder[index]);
  const manualSessionId = program.runtime?.manualCurrentSessionId ?? null;

  return (
    <>
      {feedback ? (
        <p className={`feedback ${feedback.tone}`} role={feedback.tone === "error" ? "alert" : "status"}>
          {feedback.message}
        </p>
      ) : null}

      <section className="organizer-toolbar" aria-label="Публикация и текущее состояние">
        <div>
          <span className="toolbar-label">Публикация</span>
          <strong>{program.event.programState}</strong>
        </div>
        <div className="toolbar-actions">
          {program.event.programState === "published" ? (
            <form action={unpublishProgramAction}>
              <input type="hidden" name="eventId" value={program.event.id} />
              <button className="button secondary-button" type="submit">
                Снять с публикации
              </button>
            </form>
          ) : (
            <form action={publishProgramAction}>
              <input type="hidden" name="eventId" value={program.event.id} />
              <button className="button primary-button" type="submit">
                Опубликовать программу
              </button>
            </form>
          )}
          {manualSessionId ? (
            <form action={clearManualCurrentAction}>
              <input type="hidden" name="eventId" value={program.event.id} />
              <button className="button secondary-button" type="submit">
                Вернуться к расписанию
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <div className="editor-section-heading">
        <div>
          <p className="eyebrow">Программа · {program.sessions.length} сессий</p>
          <h2>Порядок и фактический NOW</h2>
        </div>
        <button className="button primary-button" type="button" onClick={() => setMode({ type: "create" })}>
          + Новая сессия
        </button>
      </div>

      <ol className="editor-session-list">
        {order.map((sessionId, index) => {
          const session = sessionsById.get(sessionId);
          if (!session) return null;
          const isManual = manualSessionId === session.id;
          const isCurrent = currentSessionId === session.id;
          const location = program.locations.find((item) => item.id === session.locationId);
          const speakerNames = program.sessionSpeakers
            .filter((link) => link.sessionId === session.id)
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .flatMap((link) => program.speakers.find((speaker) => speaker.id === link.speakerId)?.name ?? []);

          return (
            <li key={session.id} className={isCurrent ? "editor-session is-current" : "editor-session"}>
              <div className="reorder-controls" aria-label={`Порядок: ${session.title}`}>
                <button
                  type="button"
                  onClick={() => setOrder((items) => moveItem(items, index, -1))}
                  disabled={index === 0}
                  aria-label={`Поднять «${session.title}»`}
                >
                  ↑
                </button>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <button
                  type="button"
                  onClick={() => setOrder((items) => moveItem(items, index, 1))}
                  disabled={index === order.length - 1}
                  aria-label={`Опустить «${session.title}»`}
                >
                  ↓
                </button>
              </div>
              <div className="editor-session-copy">
                <div className="editor-session-status">
                  {isManual ? <span className="status-chip manual">NOW · вручную</span> : null}
                  {isCurrent && currentSource === "planned" ? (
                    <span className="status-chip scheduled">NOW · расписание</span>
                  ) : null}
                </div>
                <h3>{session.title}</h3>
                <p>
                  {formatEventTime(session.startsAt, program.event.timezone)}—
                  {formatEventTime(session.endsAt, program.event.timezone)}
                  {location ? ` · ${location.name}` : ""}
                </p>
                {speakerNames.length ? <p>{speakerNames.join(" · ")}</p> : null}
              </div>
              <div className="editor-session-actions">
                {!isManual ? (
                  <form action={setManualCurrentAction}>
                    <input type="hidden" name="eventId" value={program.event.id} />
                    <input type="hidden" name="sessionId" value={session.id} />
                    <button className="text-button" type="submit">
                      Сделать текущей
                    </button>
                  </form>
                ) : null}
                <button className="text-button" type="button" onClick={() => setMode({ type: "edit", session })}>
                  Изменить
                </button>
                <button className="text-button danger" type="button" onClick={() => setMode({ type: "delete", session })}>
                  Удалить
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <form className="save-order" action={reorderSessionsAction}>
        <input type="hidden" name="eventId" value={program.event.id} />
        <input type="hidden" name="orderedSessionIds" value={JSON.stringify(order)} />
        <button className="button primary-button" type="submit" disabled={!orderChanged}>
          Сохранить порядок
        </button>
        <span>{orderChanged ? "Порядок изменён" : "Порядок сохранён"}</span>
      </form>

      {mode?.type === "create" ? (
        <Modal title="Новая сессия" onClose={() => setMode(null)}>
          <SessionForm program={program} onClose={() => setMode(null)} />
        </Modal>
      ) : null}
      {mode?.type === "edit" ? (
        <Modal title="Изменить сессию" onClose={() => setMode(null)}>
          <SessionForm program={program} session={mode.session} onClose={() => setMode(null)} />
        </Modal>
      ) : null}
      {mode?.type === "delete" ? (
        <Modal title="Удалить сессию?" onClose={() => setMode(null)}>
          <form className="delete-confirmation" action={deleteSessionAction}>
            <input type="hidden" name="eventId" value={program.event.id} />
            <input type="hidden" name="sessionId" value={mode.session.id} />
            <p>
              «{mode.session.title}» исчезнет из программы. Это действие нельзя отменить
              внутри редактора.
            </p>
            {manualSessionId === mode.session.id ? (
              <p className="feedback error">
                Сначала снимите ручной NOW кнопкой «Вернуться к расписанию».
              </p>
            ) : null}
            <div className="dialog-actions">
              <button className="button secondary-button" type="button" onClick={() => setMode(null)}>
                Отмена
              </button>
              <button
                className="button danger-button"
                type="submit"
                disabled={manualSessionId === mode.session.id}
              >
                Удалить сессию
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
