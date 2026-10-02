export type ProgramState = "draft" | "published" | "unpublished";

export interface CompanionEvent {
  id: string;
  slug: string;
  title: string;
  timezone: string;
  startsAt: string;
  endsAt: string;
  programState: ProgramState;
  publishedAt: string | null;
}

export interface Location {
  id: string;
  eventId: string;
  name: string;
  sortOrder: number;
}

export interface Session {
  id: string;
  eventId: string;
  slug: string;
  title: string;
  summary: string;
  startsAt: string;
  endsAt: string;
  locationId: string | null;
  sortOrder: number;
}

export interface Speaker {
  id: string;
  eventId: string;
  name: string;
  role: string | null;
  company: string | null;
  bio: string | null;
  photoUrl: string | null;
}

export interface SessionSpeaker {
  sessionId: string;
  speakerId: string;
  sortOrder: number;
  sessionRole: string | null;
}

export interface EventRuntime {
  eventId: string;
  manualCurrentSessionId: string | null;
  overrideSetAt: string | null;
  overrideSetBy: string | null;
}

export interface LiveIntegration {
  id: string;
  eventId: string;
  provider: string;
  externalEventKey: string;
  enabled: boolean;
}

export interface LiveSessionMapping {
  sessionId: string;
  integrationId: string;
  externalRoomSlug: string;
}

export interface ProgramAggregate {
  event: CompanionEvent;
  locations: Location[];
  sessions: Session[];
  speakers: Speaker[];
  sessionSpeakers: SessionSpeaker[];
  runtime: EventRuntime | null;
  liveIntegrations: LiveIntegration[];
  liveSessionMappings: LiveSessionMapping[];
}
