import type { LiveIntegration, LiveSessionMapping } from "@/lib/domain/types";

export interface LiveGuestDestination {
  provider: string;
  eventKey: string;
  roomSlug: string;
  href: string;
}

export interface LiveProviderAdapter {
  readonly provider: string;
  createGuestDestination(
    integration: LiveIntegration,
    mapping: LiveSessionMapping,
  ): LiveGuestDestination;
}
