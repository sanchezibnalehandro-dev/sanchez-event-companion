import { describe, expect, it } from "vitest";

import {
  authenticateOrganizer,
  authenticateOrganizerRequest,
} from "@/lib/auth/organizer-auth";

describe("organizer auth boundary", () => {
  it("denies access when no local token is configured", () => {
    expect(
      authenticateOrganizer({
        authorizationHeader: "Bearer anything",
        configuredToken: undefined,
        environment: "development",
        localDemoEnabled: false,
      }),
    ).toBeNull();
  });

  it("denies local demo mode in production", () => {
    expect(
      authenticateOrganizer({
        authorizationHeader: null,
        configuredToken: undefined,
        environment: "production",
        localDemoEnabled: true,
      }),
    ).toBeNull();
  });

  it("denies the development bearer token in production", () => {
    expect(
      authenticateOrganizer({
        authorizationHeader: "Bearer local-token",
        configuredToken: "local-token",
        environment: "production",
        localDemoEnabled: false,
      }),
    ).toBeNull();
  });

  it("does not grant access from a spoofed localhost Host header", () => {
    const requestHeaders = new Headers({ host: "localhost" });

    expect(
      authenticateOrganizerRequest({
        requestHeaders,
        configuredToken: undefined,
        environment: "development",
        localDemoEnabled: false,
      }),
    ).toBeNull();
  });

  it("allows explicitly enabled local demo mode in development", () => {
    expect(
      authenticateOrganizer({
        authorizationHeader: null,
        configuredToken: undefined,
        environment: "development",
        localDemoEnabled: true,
      }),
    ).toEqual({ id: "local-demo-organizer", source: "local-demo-mode" });
  });
});
