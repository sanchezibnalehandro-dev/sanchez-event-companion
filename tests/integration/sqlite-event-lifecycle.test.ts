import { SqliteCompanionRepository } from "@/lib/data/sqlite-repository";
import { defineEventLifecycleContract } from "@/tests/helpers/event-lifecycle-contract";

defineEventLifecycleContract("SQLite", async () => {
  const repository = SqliteCompanionRepository.open(":memory:");
  return {
    repository,
    close: async () => repository.close(),
  };
});
