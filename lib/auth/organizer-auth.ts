import { timingSafeEqual } from "node:crypto";

export interface OrganizerActor {
  id: string;
  source: "local-development-bearer";
}

export function authenticateOrganizer(options: {
  authorizationHeader: string | null;
  configuredToken: string | undefined;
  nodeEnv: string | undefined;
}): OrganizerActor | null {
  if (options.nodeEnv === "production" || !options.configuredToken) {
    return null;
  }

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
