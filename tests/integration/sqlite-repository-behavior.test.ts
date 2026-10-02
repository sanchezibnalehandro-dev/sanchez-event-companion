import { defineRepositoryBehaviorContract } from "@/tests/helpers/repository-contract";
import { createTestRepository } from "@/tests/helpers/repository";

defineRepositoryBehaviorContract("SQLite", async (program) => {
  const repository = createTestRepository(program);
  return {
    repository,
    close: async () => repository.close(),
  };
});
