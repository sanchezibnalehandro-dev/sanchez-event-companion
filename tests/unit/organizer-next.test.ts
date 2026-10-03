import { describe, expect, it } from "vitest";

import { safeOrganizerNext } from "@/lib/auth/organizer-next";

describe("organizer return paths", () => {
  it("accepts only internal organizer paths", () => {
    expect(safeOrganizerNext("/organizer")).toBe("/organizer");
    expect(safeOrganizerNext("/organizer/events/event-1/program?tone=success")).toBe(
      "/organizer/events/event-1/program?tone=success",
    );
  });

  it.each([
    undefined,
    "https://evil.example/organizer",
    "//evil.example/organizer",
    "javascript:alert(1)",
    "/organizer/login",
    "/organizer/login?next=/organizer",
    "/organizer\\..\\evil",
    "/organizer/%2f%2fevil.example",
    "/organizer#fragment",
    "/guest",
  ])("falls back safely for %s", (candidate) => {
    expect(safeOrganizerNext(candidate)).toBe("/organizer");
  });
});
