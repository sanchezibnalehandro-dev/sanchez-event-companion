import type {
  CompanionEvent,
  EventRuntime,
  LiveIntegration,
  LiveSessionMapping,
  Location,
  ProgramAggregate,
  Session,
  SessionSpeaker,
  Speaker,
} from "@/lib/domain/types";

export const event: CompanionEvent = {
  id: "event-1",
  slug: "industry-day",
  title: "Цифровизация промышленности",
  timezone: "Europe/Moscow",
  startsAt: "2026-10-02T06:00:00.000Z",
  endsAt: "2026-10-02T16:00:00.000Z",
  programState: "published",
  publishedAt: "2026-10-01T09:00:00.000Z",
};

export const location: Location = {
  id: "location-main",
  eventId: event.id,
  name: "Главный зал",
  sortOrder: 0,
};

export const opening: Session = {
  id: "session-opening",
  eventId: event.id,
  slug: "opening",
  title: "Открытие",
  summary: "Старт события",
  startsAt: "2026-10-02T07:00:00.000Z",
  endsAt: "2026-10-02T08:00:00.000Z",
  locationId: location.id,
  sortOrder: 0,
};

export const panel: Session = {
  id: "session-panel",
  eventId: event.id,
  slug: "industry-panel",
  title: "Промышленная панель",
  summary: "Разговор с практиками",
  startsAt: "2026-10-02T08:15:00.000Z",
  endsAt: "2026-10-02T09:30:00.000Z",
  locationId: location.id,
  sortOrder: 1,
};

export const speakerOne: Speaker = {
  id: "speaker-1",
  eventId: event.id,
  name: "Анна Орлова",
  role: "Директор",
  company: "Завод 1",
  bio: null,
  photoUrl: null,
};

export const speakerTwo: Speaker = {
  id: "speaker-2",
  eventId: event.id,
  name: "Иван Петров",
  role: "CTO",
  company: "Технопарк",
  bio: null,
  photoUrl: null,
};

export const panelLinks: SessionSpeaker[] = [
  { sessionId: panel.id, speakerId: speakerOne.id, sortOrder: 0, sessionRole: "Модератор" },
  { sessionId: panel.id, speakerId: speakerTwo.id, sortOrder: 1, sessionRole: "Спикер" },
];

export const liveIntegration: LiveIntegration = {
  id: "live-1",
  eventId: event.id,
  provider: "sanchez-live-qna",
  externalEventKey: "industry-2026",
  enabled: true,
};

export const panelLiveMapping: LiveSessionMapping = {
  sessionId: panel.id,
  integrationId: liveIntegration.id,
  externalRoomSlug: "panel-room",
};

export function makeProgram(overrides: Partial<ProgramAggregate> = {}): ProgramAggregate {
  const runtime: EventRuntime = {
    eventId: event.id,
    manualCurrentSessionId: null,
    overrideSetAt: null,
    overrideSetBy: null,
  };

  return {
    event,
    locations: [location],
    sessions: [opening, panel],
    speakers: [speakerOne, speakerTwo],
    sessionSpeakers: panelLinks,
    runtime,
    liveIntegrations: [liveIntegration],
    liveSessionMappings: [panelLiveMapping],
    ...overrides,
  };
}
