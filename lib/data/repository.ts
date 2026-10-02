import type { ProgramAggregate } from "@/lib/domain/types";

export type PublicProgramRead =
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "published"; program: ProgramAggregate };

export interface CompanionRepository {
  getPublicProgramBySlug(eventSlug: string): PublicProgramRead;
  getOrganizerProgram(eventId: string): ProgramAggregate | null;
}
