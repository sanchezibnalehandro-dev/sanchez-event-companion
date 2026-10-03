import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  authenticateOrganizerRequest,
  type OrganizerActor,
} from "@/lib/auth/organizer-auth";
import { OrganizerAuthService } from "@/lib/auth/organizer-auth-service";
import { safeOrganizerNext } from "@/lib/auth/organizer-next";
import {
  PostgresOrganizerAuthStore,
  requirePostgresDatabaseUrl,
} from "@/lib/auth/postgres-organizer-auth-store";

export const ORGANIZER_SESSION_COOKIE = "event_companion_organizer_session";

let authService: OrganizerAuthService | undefined;

export function getPostgresOrganizerAuthService(): OrganizerAuthService | null {
  const production = process.env.NODE_ENV === "production";
  const postgresConfigured = process.env.EVENT_COMPANION_DATABASE_DRIVER === "postgres";
  if (!production && !postgresConfigured) return null;
  if (!authService) {
    const databaseUrl = requirePostgresDatabaseUrl(process.env.DATABASE_URL);
    authService = new OrganizerAuthService(PostgresOrganizerAuthStore.open(databaseUrl));
  }
  return authService;
}

export async function getRequestOrganizer(): Promise<OrganizerActor | null> {
  if (process.env.NODE_ENV !== "production") {
    const requestHeaders = await headers();
    const localOrganizer = authenticateOrganizerRequest({
      requestHeaders,
      configuredToken: process.env.ORGANIZER_DEV_BEARER_TOKEN,
      environment: process.env.NODE_ENV,
      localDemoEnabled: process.env.EVENT_COMPANION_LOCAL_DEMO === "true",
    });
    if (localOrganizer) return localOrganizer;
  }

  const service = getPostgresOrganizerAuthService();
  if (!service) return null;
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(ORGANIZER_SESSION_COOKIE)?.value ?? "";
  const organizer = await service.authenticateSession(rawToken);
  return organizer ? { ...organizer, source: "postgres-session" } : null;
}

export async function requireOrganizer(nextPath: string): Promise<OrganizerActor> {
  const organizer = await getRequestOrganizer();
  if (organizer) return organizer;
  const next = safeOrganizerNext(nextPath);
  redirect(`/organizer/login?next=${encodeURIComponent(next)}`);
}
