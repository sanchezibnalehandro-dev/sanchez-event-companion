import { headers } from "next/headers";

import { authenticateOrganizer } from "@/lib/auth/organizer-auth";

export async function getRequestOrganizer() {
  const requestHeaders = await headers();
  return authenticateOrganizer({
    authorizationHeader: requestHeaders.get("authorization"),
    configuredToken: process.env.ORGANIZER_DEV_BEARER_TOKEN,
    nodeEnv: process.env.NODE_ENV,
  });
}
