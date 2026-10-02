import { mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const configuredPath = process.env.EVENT_COMPANION_DATABASE_PATH ?? ".data/event-companion.sqlite";
const databasePath = isAbsolute(configuredPath)
  ? configuredPath
  : resolve(process.cwd(), configuredPath);
mkdirSync(dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec("PRAGMA foreign_keys = ON;");
database.exec(readFileSync(join(process.cwd(), "db", "migrations", "0001_initial.sql"), "utf8"));

const eventId = "demo-event-2026";
const existing = database.prepare("SELECT id FROM events WHERE id = ?").get(eventId);
if (existing) {
  console.log("Demo event already exists; no data was overwritten.");
  console.log("Guest:     /e/future-industry-day");
  console.log(`Organizer: /organizer/events/${eventId}/program`);
  database.close();
  process.exit(0);
}

const anchor = new Date();
anchor.setUTCSeconds(0, 0);
const at = (minutes) => new Date(anchor.getTime() + minutes * 60_000).toISOString();

const event = {
  id: eventId,
  slug: "future-industry-day",
  title: "Future Industry Day",
  timezone: "Europe/Moscow",
  startsAt: at(-180),
  endsAt: at(330),
};

const locations = [
  ["demo-location-main", event.id, "Главный зал", 0],
  ["demo-location-lab", event.id, "Лаборатория 2", 1],
];
const speakers = [
  ["demo-speaker-anna", event.id, "Анна Ветрова", "Директор по инновациям", "Nova Works"],
  ["demo-speaker-mark", event.id, "Марк Левин", "Инженер данных", "Northline"],
  ["demo-speaker-lina", event.id, "Лина Азарова", "Исследователь", "Open Factory Lab"],
  ["demo-speaker-pavel", event.id, "Павел Миронов", "Модератор", "Industry Notes"],
];
const sessions = [
  ["demo-session-welcome", event.id, "welcome", "Открытие и ориентиры дня", "Короткое открытие: как устроен день и где искать главное.", at(-120), at(-80), locations[0][0], 0],
  ["demo-session-keynote", event.id, "industrial-data", "Данные как производственный контур", "Практический разговор о данных, которые помогают цеху принимать решения быстрее.", at(-60), at(15), locations[0][0], 1],
  ["demo-session-panel", event.id, "human-machine-panel", "Панель: человек и автономные системы", "Четыре взгляда на то, как автоматизация меняет роли, ответственность и темп работы.", at(30), at(90), locations[0][0], 2],
  ["demo-session-break", event.id, "coffee-and-connections", "Кофе и знакомства", "Пауза без LIVE Q&A: время перейти в холл и продолжить разговор лично.", at(90), at(120), locations[1][0], 3],
  ["demo-session-workshop", event.id, "prototype-workshop", "Воркшоп: прототип за 60 минут", "Командная практика по превращению производственной гипотезы в проверяемый сценарий.", at(150), at(210), locations[1][0], 4],
  ["demo-session-closing", event.id, "closing-reflection", "Финальная рефлексия", "Что участники забирают в работу после события.", at(225), at(270), locations[0][0], 5],
];

database.exec("BEGIN IMMEDIATE");
try {
  database
    .prepare(
      `INSERT INTO events (
        id, slug, title, timezone, starts_at, ends_at, program_state, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'published', ?)`,
    )
    .run(event.id, event.slug, event.title, event.timezone, event.startsAt, event.endsAt, at(-240));

  const insertLocation = database.prepare(
    "INSERT INTO locations (id, event_id, name, sort_order) VALUES (?, ?, ?, ?)",
  );
  locations.forEach((location) => insertLocation.run(...location));

  const insertSpeaker = database.prepare(
    `INSERT INTO speakers (id, event_id, name, role, company, bio, photo_url)
     VALUES (?, ?, ?, ?, ?, NULL, NULL)`,
  );
  speakers.forEach((speaker) => insertSpeaker.run(...speaker));

  const insertSession = database.prepare(
    `INSERT INTO sessions (
      id, event_id, slug, title, summary, starts_at, ends_at, location_id, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  sessions.forEach((session) => insertSession.run(...session));

  const insertSessionSpeaker = database.prepare(
    `INSERT INTO session_speakers (session_id, speaker_id, sort_order, session_role)
     VALUES (?, ?, ?, ?)`,
  );
  [
    [sessions[0][0], speakers[3][0], 0, "Ведущий"],
    [sessions[1][0], speakers[0][0], 0, "Спикер"],
    [sessions[2][0], speakers[3][0], 0, "Модератор"],
    [sessions[2][0], speakers[0][0], 1, "Участник панели"],
    [sessions[2][0], speakers[1][0], 2, "Участник панели"],
    [sessions[2][0], speakers[2][0], 3, "Участник панели"],
    [sessions[4][0], speakers[1][0], 0, "Фасилитатор"],
    [sessions[4][0], speakers[2][0], 1, "Фасилитатор"],
    [sessions[5][0], speakers[3][0], 0, "Ведущий"],
  ].forEach((link) => insertSessionSpeaker.run(...link));

  database
    .prepare(
      `INSERT INTO live_integrations (
        id, event_id, provider, external_event_key, enabled
      ) VALUES (?, ?, 'sanchez-live-qna', 'companion-demo', 1)`,
    )
    .run("demo-live-integration", event.id);

  const insertMapping = database.prepare(
    `INSERT INTO live_session_mappings (
      session_id, integration_id, external_room_slug
    ) VALUES (?, 'demo-live-integration', ?)`,
  );
  insertMapping.run(sessions[1][0], "industrial-data-room");
  insertMapping.run(sessions[2][0], "human-machine-panel-room");
  insertMapping.run(sessions[4][0], "prototype-workshop-room");

  database
    .prepare(
      `INSERT INTO event_runtime (
        event_id, manual_current_session_id, override_set_at, override_set_by
      ) VALUES (?, ?, ?, 'demo-seed')`,
    )
    .run(event.id, sessions[2][0], anchor.toISOString());

  database.exec("COMMIT");
} catch (error) {
  database.exec("ROLLBACK");
  throw error;
} finally {
  database.close();
}

console.log(`Demo event seeded at ${databasePath}`);
console.log("Guest:     /e/future-industry-day");
console.log(`Organizer: /organizer/events/${eventId}/program`);
