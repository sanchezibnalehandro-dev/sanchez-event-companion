import { describe, expect, it } from "vitest";

import { createTestRepository } from "@/tests/helpers/repository";
import type { ProgramAggregate } from "@/lib/domain/types";
import { event, makeProgram } from "@/tests/helpers/fixtures";

describe("public publication boundary", () => {
  it("does not expose a draft event or any draft payload", () => {
    const repository = createTestRepository(
      makeProgram({
        event: { ...event, programState: "draft", publishedAt: null },
      }),
    );

    expect(repository.getPublicProgramBySlug(event.slug)).toEqual({ status: "not_found" });
    repository.close();
  });

  it("exposes a published program", () => {
    const repository = createTestRepository(makeProgram());
    const result = repository.getPublicProgramBySlug(event.slug);

    expect(result.status).toBe("published");
    if (result.status === "published") {
      expect(result.program.sessions).toHaveLength(2);
      expect(result.program.event.title).toBe(event.title);
    }
    repository.close();
  });

  it("returns a payload-free unavailable state after unpublish", () => {
    const repository = createTestRepository(
      makeProgram({
        event: { ...event, programState: "unpublished" },
      }),
    );

    expect(repository.getPublicProgramBySlug(event.slug)).toEqual({ status: "unavailable" });
    repository.close();
  });

  it("returns unavailable instead of throwing when publication changes during a public read", () => {
    const repository = createTestRepository(makeProgram());
    const internalRepository = repository as unknown as {
      getProgramByEventId(eventId: string): ProgramAggregate | null;
    };
    const readAggregate = internalRepository.getProgramByEventId.bind(repository);

    internalRepository.getProgramByEventId = (eventId) => {
      repository.setProgramUnpublished(eventId);
      return readAggregate(eventId);
    };

    expect(repository.getPublicProgramBySlug(event.slug)).toEqual({ status: "unavailable" });
    repository.close();
  });
});
