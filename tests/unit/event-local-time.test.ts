import { describe, expect, it } from "vitest";

import {
  eventLocalDateTimeToInstant,
  formatDateTimeLocal,
} from "@/lib/domain/presentation";

describe("event-local date fields", () => {
  it("converts Moscow local time to an absolute instant", () => {
    expect(eventLocalDateTimeToInstant("2026-10-02T10:00", "Europe/Moscow")).toBe(
      "2026-10-02T07:00:00.000Z",
    );
  });

  it("round-trips an unchanged Moscow edit without changing the instant", () => {
    const originalInstant = "2026-10-02T07:00:00.000Z";
    const unchangedFieldValue = formatDateTimeLocal(originalInstant, "Europe/Moscow");

    expect(unchangedFieldValue).toBe("2026-10-02T10:00");
    expect(eventLocalDateTimeToInstant(unchangedFieldValue, "Europe/Moscow")).toBe(
      originalInstant,
    );
  });
});
