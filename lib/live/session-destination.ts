import type { ProgramAggregate } from "@/lib/domain/types";
import type { LiveGuestDestination, LiveProviderAdapter } from "@/lib/live/contract";
import {
  SANCHEZ_LIVE_QNA_PROVIDER,
  SanchezLiveQnaAdapter,
} from "@/lib/live/sanchez-live-qna";

const adapters: ReadonlyMap<string, LiveProviderAdapter> = new Map([
  [SANCHEZ_LIVE_QNA_PROVIDER, new SanchezLiveQnaAdapter()],
]);

export function getSessionLiveDestination(
  program: ProgramAggregate,
  sessionId: string,
): LiveGuestDestination | null {
  const mapping = program.liveSessionMappings.find((item) => item.sessionId === sessionId);
  if (!mapping) return null;

  const integration = program.liveIntegrations.find(
    (item) => item.id === mapping.integrationId && item.enabled,
  );
  if (!integration) return null;

  const adapter = adapters.get(integration.provider);
  if (!adapter) return null;

  return adapter.createGuestDestination(integration, mapping);
}
