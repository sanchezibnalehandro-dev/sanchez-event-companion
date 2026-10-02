import { describe, expect, it } from "vitest";

import {
  eventLocalDateTimeToInstant,
  formatDateTimeLocal,
} from "@/lib/domain/presentation";

describe("event-local date fields", () => {
  it("round-trips a Moscow local time without using the operator machine timezone", () => {
    const instant = eventLocalDateTimeToInstant("2026-10-02T12:30", "Europe/Moscow");
    expect(instant).toBe("2026-10-02T09:30:00.000Z");
    expect(formatDateTimeLocal(instant, "Europe/Moscow")).toBe("2026-10-02T12:30");
  });
});
