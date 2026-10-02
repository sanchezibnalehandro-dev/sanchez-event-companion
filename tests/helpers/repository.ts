import { SqliteCompanionRepository } from "@/lib/data/sqlite-repository";
import type { ProgramAggregate } from "@/lib/domain/types";

export function createTestRepository(program: ProgramAggregate): SqliteCompanionRepository {
  const repository = SqliteCompanionRepository.open(":memory:");
  repository.saveEvent(program.event);
  program.locations.forEach((item) => repository.saveLocation(item));
  program.sessions.forEach((item) => repository.saveSession(item));
  program.speakers.forEach((item) => repository.saveSpeaker(item));
  program.sessionSpeakers.forEach((item) => repository.saveSessionSpeaker(item));
  if (program.runtime) repository.saveRuntime(program.runtime);
  program.liveIntegrations.forEach((item) => repository.saveLiveIntegration(item));
  program.liveSessionMappings.forEach((item) => repository.saveLiveSessionMapping(item));
  return repository;
}
