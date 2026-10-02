import { describe, expect, it } from "vitest";

import { authenticateOrganizer } from "@/lib/auth/organizer-auth";

describe("organizer auth boundary", () => {
  it("denies access when no local token is configured", () => {
    expect(
      authenticateOrganizer({
        authorizationHeader: "Bearer anything",
        configuredToken: undefined,
        isLoopbackRequest: true,
        localDemoEnabled: false,
      }),
    ).toBeNull();
  });

  it("always disables the development placeholder away from loopback", () => {
    expect(
      authenticateOrganizer({
        authorizationHeader: "Bearer local-token",
        configuredToken: "local-token",
        isLoopbackRequest: false,
        localDemoEnabled: true,
      }),
    ).toBeNull();
  });

  it("allows explicitly enabled local demo mode on loopback", () => {
    expect(
      authenticateOrganizer({
        authorizationHeader: null,
        configuredToken: undefined,
        isLoopbackRequest: true,
        localDemoEnabled: true,
      }),
    ).toEqual({ id: "local-demo-organizer", source: "local-demo-mode" });
  });
});
