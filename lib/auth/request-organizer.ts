import { headers } from "next/headers";

import { authenticateOrganizerRequest } from "@/lib/auth/organizer-auth";

export async function getRequestOrganizer() {
  const requestHeaders = await headers();
  return authenticateOrganizerRequest({
    requestHeaders,
    configuredToken: process.env.ORGANIZER_DEV_BEARER_TOKEN,
    environment: process.env.NODE_ENV,
    localDemoEnabled: process.env.EVENT_COMPANION_LOCAL_DEMO === "true",
  });
}
