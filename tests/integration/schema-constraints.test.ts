import { describe, expect, it } from "vitest";

import { createTestRepository } from "@/tests/helpers/repository";
import { makeProgram, opening } from "@/tests/helpers/fixtures";

describe("persistence constraints", () => {
  it("rejects a duplicate session slug inside one event", () => {
    const repository = createTestRepository(makeProgram());

    expect(() =>
      repository.saveSession({
        ...opening,
        id: "another-session",
        startsAt: "2026-10-02T10:00:00.000Z",
        endsAt: "2026-10-02T11:00:00.000Z",
      }),
    ).toThrow();
    repository.close();
  });

  it("rejects session timestamps without a timezone", () => {
    const repository = createTestRepository(makeProgram());

    expect(() =>
      repository.saveSession({
        ...opening,
        id: "timezone-less",
        slug: "timezone-less",
        startsAt: "2026-10-02T10:00:00",
        endsAt: "2026-10-02T11:00:00",
      }),
    ).toThrow("Timestamp must include a timezone offset");
    repository.close();
  });
});
