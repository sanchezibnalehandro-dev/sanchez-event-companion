import { timingSafeEqual } from "node:crypto";

export interface OrganizerActor {
  id: string;
  source: "local-development-bearer" | "local-demo-mode";
}

export function authenticateOrganizer(options: {
  authorizationHeader: string | null;
  configuredToken: string | undefined;
  isLoopbackRequest: boolean;
  localDemoEnabled: boolean;
}): OrganizerActor | null {
  if (!options.isLoopbackRequest) {
    return null;
  }

  if (options.localDemoEnabled) {
    return { id: "local-demo-organizer", source: "local-demo-mode" };
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

  return { id: "local-development-organizer", source: "local-development-bearer" };
}

export function isLoopbackHost(host: string | null): boolean {
  if (!host) return false;
  const hostname = host.startsWith("[") ? host.slice(1, host.indexOf("]")) : host.split(":")[0];
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}
