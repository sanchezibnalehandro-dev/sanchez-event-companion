import { describe, expect, it } from "vitest";

import { validateProgramAggregate } from "@/lib/domain/validation";
import { getSessionLiveDestination } from "@/lib/live/session-destination";
import {
  liveIntegration,
  makeProgram,
  opening,
  panel,
  panelLiveMapping,
} from "@/tests/helpers/fixtures";

describe("LIVE adapter", () => {
  it("builds the SANCHEZ guest URL from event_key, never room_slug", () => {
    const destination = getSessionLiveDestination(makeProgram(), panel.id);

    expect(destination?.href).toBe(
      "https://sanchez-live-qna.vercel.app/ask.html?event=industry-2026",
    );
    expect(destination?.href).not.toContain(panelLiveMapping.externalRoomSlug);
    expect(destination?.eventKey).toBe(liveIntegration.externalEventKey);
  });

  it("keeps a session without a LIVE mapping valid", () => {
    const program = makeProgram();

    expect(() => validateProgramAggregate(program)).not.toThrow();
    expect(getSessionLiveDestination(program, opening.id)).toBeNull();
  });
});
