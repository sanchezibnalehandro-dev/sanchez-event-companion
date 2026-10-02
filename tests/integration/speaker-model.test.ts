import { describe, expect, it } from "vitest";

import { getSessionSpeakers } from "@/lib/domain/presentation";
import { createTestRepository } from "@/tests/helpers/repository";
import { event, makeProgram, panel } from "@/tests/helpers/fixtures";

describe("session speaker many-to-many model", () => {
  it("persists multiple ordered speakers for a panel session", async () => {
    const repository = createTestRepository(makeProgram());
    const result = await repository.getPublicProgramBySlug(event.slug);

    expect(result.status).toBe("published");
    if (result.status === "published") {
      expect(getSessionSpeakers(result.program, panel.id)).toMatchObject([
        { speaker: { name: "Анна Орлова" }, sessionRole: "Модератор" },
        { speaker: { name: "Иван Петров" }, sessionRole: "Спикер" },
      ]);
    }
    repository.close();
  });
});
