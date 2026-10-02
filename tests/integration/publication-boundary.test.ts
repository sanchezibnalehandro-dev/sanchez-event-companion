import { describe, expect, it } from "vitest";

import { createTestRepository } from "@/tests/helpers/repository";
import { event, makeProgram } from "@/tests/helpers/fixtures";

describe("public publication boundary", () => {
  it("does not expose a draft event or any draft payload", async () => {
    const repository = createTestRepository(
      makeProgram({
        event: { ...event, programState: "draft", publishedAt: null },
      }),
    );

    await expect(repository.getPublicProgramBySlug(event.slug)).resolves.toEqual({
      status: "not_found",
    });
    repository.close();
  });

  it("exposes a published program", async () => {
    const repository = createTestRepository(makeProgram());
    const result = await repository.getPublicProgramBySlug(event.slug);

    expect(result.status).toBe("published");
    if (result.status === "published") {
      expect(result.program.sessions).toHaveLength(2);
      expect(result.program.event.title).toBe(event.title);
    }
    repository.close();
  });

  it("returns a payload-free unavailable state after unpublish", async () => {
    const repository = createTestRepository(
      makeProgram({
        event: { ...event, programState: "unpublished" },
      }),
    );

    await expect(repository.getPublicProgramBySlug(event.slug)).resolves.toEqual({
      status: "unavailable",
    });
    repository.close();
  });

  it("returns unavailable without a program payload after publication changes", async () => {
    const repository = createTestRepository(makeProgram());
    expect((await repository.getPublicProgramBySlug(event.slug)).status).toBe("published");

    await repository.setProgramUnpublished(event.id);

    await expect(repository.getPublicProgramBySlug(event.slug)).resolves.toEqual({
      status: "unavailable",
    });
    repository.close();
  });
});
