import type { LiveIntegration, LiveSessionMapping } from "@/lib/domain/types";
import { validateLiveIntegration, validateLiveSessionMapping } from "@/lib/domain/validation";
import type { LiveGuestDestination, LiveProviderAdapter } from "@/lib/live/contract";

export const SANCHEZ_LIVE_QNA_PROVIDER = "sanchez-live-qna";
export const SANCHEZ_LIVE_QNA_GUEST_URL =
  "https://sanchez-live-qna.vercel.app/ask.html";

export class SanchezLiveQnaAdapter implements LiveProviderAdapter {
  readonly provider = SANCHEZ_LIVE_QNA_PROVIDER;

  createGuestDestination(
    integration: LiveIntegration,
    mapping: LiveSessionMapping,
  ): LiveGuestDestination {
    validateLiveIntegration(integration);
    validateLiveSessionMapping(mapping);
    if (integration.provider !== this.provider) {
      throw new Error(`Unsupported LIVE provider: ${integration.provider}`);
    }
    if (mapping.integrationId !== integration.id) {
      throw new Error("LIVE mapping does not belong to the supplied integration");
    }
    if (!integration.enabled) {
      throw new Error("LIVE integration is disabled");
    }

    const url = new URL(SANCHEZ_LIVE_QNA_GUEST_URL);
    url.searchParams.set("event", integration.externalEventKey);

    return {
      provider: integration.provider,
      eventKey: integration.externalEventKey,
      roomSlug: mapping.externalRoomSlug,
      href: url.toString(),
    };
  }
}
