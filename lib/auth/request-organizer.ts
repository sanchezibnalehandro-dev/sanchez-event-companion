import { headers } from "next/headers";

import { authenticateOrganizer, isLoopbackHost } from "@/lib/auth/organizer-auth";

export async function getRequestOrganizer() {
  const requestHeaders = await headers();
  return authenticateOrganizer({
    authorizationHeader: requestHeaders.get("authorization"),
    configuredToken: process.env.ORGANIZER_DEV_BEARER_TOKEN,
    isLoopbackRequest: isLoopbackHost(requestHeaders.get("host")),
    localDemoEnabled: process.env.EVENT_COMPANION_LOCAL_DEMO === "true",
  });
}
