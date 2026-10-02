import { SqliteCompanionRepository } from "@/lib/data/sqlite-repository";

let repository: SqliteCompanionRepository | undefined;

export function getRepository(): SqliteCompanionRepository {
  if (!repository) {
    repository = SqliteCompanionRepository.open(
      process.env.EVENT_COMPANION_DATABASE_PATH ?? ".data/event-companion.sqlite",
    );
  }
  return repository;
}
