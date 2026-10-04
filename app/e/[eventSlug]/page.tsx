import { notFound } from "next/navigation";

import { ComingSoonCard } from "@/components/coming-soon-card";
import { GuestEventHub } from "@/components/guest-event-hub";
import { getRepository } from "@/lib/data/database";
import { buildTodayView } from "@/lib/domain/today";
import { getSessionLiveDestination } from "@/lib/live/session-destination";

export const dynamic = "force-dynamic";

export default async function TodayPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;
  const result = await getRepository().getPublicProgramBySlug(eventSlug);

  if (result.status === "not_found") notFound();
  if (result.status === "unavailable") {
    return (
      <main className="guest-shell state-shell">
        <ComingSoonCard />
      </main>
    );
  }

  const { program } = result;
  const { current } = buildTodayView(program, new Date());
  const liveDestination = current
    ? getSessionLiveDestination(program, current.session.id)
    : null;

  return (
    <GuestEventHub
      program={program}
      programHref={`/e/${eventSlug}/program`}
      liveQuestionHref={liveDestination?.href ?? null}
    />
  );
}
