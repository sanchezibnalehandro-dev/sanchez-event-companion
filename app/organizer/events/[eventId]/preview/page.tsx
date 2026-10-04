import { notFound } from "next/navigation";

import { GuestEventHub } from "@/components/guest-event-hub";
import { requireOrganizer } from "@/lib/auth/request-organizer";
import { getRepository } from "@/lib/data/database";

export const dynamic = "force-dynamic";

export default async function OrganizerEventPreviewPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const pathname = `/organizer/events/${encodeURIComponent(eventId)}/preview`;

  await requireOrganizer(pathname);

  const program = await getRepository().getOrganizerProgram(eventId);
  if (!program) notFound();

  return (
    <GuestEventHub
      program={program}
      programHref={null}
      liveQuestionHref={null}
      previewLabel="Preview / Черновик"
    />
  );
}
