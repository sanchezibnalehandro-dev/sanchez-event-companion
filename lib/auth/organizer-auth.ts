import { timingSafeEqual } from "node:crypto";

export interface OrganizerActor {
  id: string;
  email: string | null;
  displayName: string | null;
  source: "local-development-bearer" | "local-demo-mode" | "postgres-session";
}

export function isLocalDemoMode(options: {
  environment: string | undefined;
  localDemoEnabled: boolean;
}): boolean {
  return options.environment !== "production" && options.localDemoEnabled;
}

export function authenticateOrganizer(options: {
  authorizationHeader: string | null;
  configuredToken: string | undefined;
  environment: string | undefined;
  localDemoEnabled: boolean;
}): OrganizerActor | null {
  if (options.environment === "production") {
    return null;
  }

  if (isLocalDemoMode(options)) {
    return {
      id: "local-demo-organizer",
      email: null,
      displayName: "Local demo organizer",
      source: "local-demo-mode",
    };
  }

  if (!options.configuredToken) return null;

  const prefix = "Bearer ";
  if (!options.authorizationHeader?.startsWith(prefix)) {
    return null;
  }

  const supplied = Buffer.from(options.authorizationHeader.slice(prefix.length));
  const expected = Buffer.from(options.configuredToken);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return null;
  }

  return {
    id: "local-development-organizer",
    email: null,
    displayName: "Local development organizer",
    source: "local-development-bearer",
  };
}

export function authenticateOrganizerRequest(options: {
  requestHeaders: Pick<Headers, "get">;
  configuredToken: string | undefined;
  environment: string | undefined;
  localDemoEnabled: boolean;
}): OrganizerActor | null {
  return authenticateOrganizer({
    authorizationHeader: options.requestHeaders.get("authorization"),
    configuredToken: options.configuredToken,
    environment: options.environment,
    localDemoEnabled: options.localDemoEnabled,
  });
}
