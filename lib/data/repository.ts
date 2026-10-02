import type { ProgramAggregate, Session } from "@/lib/domain/types";

export type PublicProgramRead =
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "published"; program: ProgramAggregate };

export interface CompanionRepository {
  getPublicProgramBySlug(eventSlug: string): PublicProgramRead;
  getOrganizerProgram(eventId: string): ProgramAggregate | null;
}

export interface SessionWrite {
  session: Session;
  speakerIds: string[];
}
