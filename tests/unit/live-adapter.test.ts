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

  it("returns no destination for a mapped session when the LIVE integration is disabled", () => {
    const program = makeProgram({
      liveIntegrations: [{ ...liveIntegration, enabled: false }],
    });

    expect(getSessionLiveDestination(program, panel.id)).toBeNull();
  });

  it("returns no destination when the session mapping is missing", () => {
    const program = makeProgram({ liveSessionMappings: [] });

    expect(getSessionLiveDestination(program, panel.id)).toBeNull();
  });

  it("keeps a session without a LIVE mapping valid", () => {
    const program = makeProgram();

    expect(() => validateProgramAggregate(program)).not.toThrow();
    expect(getSessionLiveDestination(program, opening.id)).toBeNull();
  });

  it("exposes a passive link contract without inferred LIVE state", () => {
    const destination = getSessionLiveDestination(makeProgram(), panel.id);

    expect(destination).toEqual({
      provider: "sanchez-live-qna",
      eventKey: "industry-2026",
      roomSlug: "panel-room",
      href: "https://sanchez-live-qna.vercel.app/ask.html?event=industry-2026",
    });
    expect(destination).not.toHaveProperty("status");
    expect(destination).not.toHaveProperty("isLive");
    expect(destination).not.toHaveProperty("embed");
  });
});
