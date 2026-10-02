import { describe, expect, it } from "vitest";

import { authenticateOrganizer } from "@/lib/auth/organizer-auth";

describe("organizer auth boundary", () => {
  it("denies access when no local token is configured", () => {
    expect(
      authenticateOrganizer({
        authorizationHeader: "Bearer anything",
        configuredToken: undefined,
        nodeEnv: "development",
      }),
    ).toBeNull();
  });

  it("always disables the development placeholder in production", () => {
    expect(
      authenticateOrganizer({
        authorizationHeader: "Bearer local-token",
        configuredToken: "local-token",
        nodeEnv: "production",
      }),
    ).toBeNull();
  });
});
