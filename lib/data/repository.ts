import type { ProgramAggregate, Session } from "@/lib/domain/types";

export type PublicProgramRead =
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "published"; program: ProgramAggregate };

export interface CompanionRepository {
  getPublicProgramBySlug(eventSlug: string): Promise<PublicProgramRead>;
  getOrganizerProgram(eventId: string): Promise<ProgramAggregate | null>;
  createSession(write: SessionWrite): Promise<void>;
  updateSession(write: SessionUpdate): Promise<void>;
  deleteSession(eventId: string, sessionId: string): Promise<void>;
  reorderSessions(eventId: string, orderedSessionIds: readonly string[]): Promise<void>;
  setProgramPublished(eventId: string, publishedAt: string): Promise<void>;
  setProgramUnpublished(eventId: string): Promise<void>;
  setManualCurrentSession(
    eventId: string,
    sessionId: string,
    actorId: string,
    setAt: string,
  ): Promise<void>;
  clearManualCurrentSession(eventId: string): Promise<void>;
}

export interface SessionWrite {
  session: Session;
  speakerIds: string[];
}

export interface SessionUpdate extends SessionWrite {
  autoShiftFollowing: boolean;
}
