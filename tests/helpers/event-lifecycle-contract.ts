import { describe, expect, it } from "vitest";

import {
  type CompanionRepository,
  type CreateOrganizerEventInput,
} from "@/lib/data/repository";

export interface EventLifecycleHarness {
  repository: CompanionRepository;
  close(): Promise<void>;
}

export type EventLifecycleHarnessFactory = () => Promise<EventLifecycleHarness>;

const validEvent: CreateOrganizerEventInput = {
  title: "Organizer lifecycle event",
  slug: "organizer-lifecycle-event",
  timezone: "Europe/Moscow",
  startsAt: "2026-11-02T10:00:00+03:00",
  endsAt: "2026-11-02T12:00:00+03:00",
};

export function defineEventLifecycleContract(
  name: string,
  createHarness: EventLifecycleHarnessFactory,
): void {
  describe(`${name} organizer event lifecycle`, () => {
    it("creates drafts, lists them by start time, and opens them by stable ID", async () => {
      const harness = await createHarness();
      try {
        const later = await harness.repository.createOrganizerEvent(validEvent);
        const earlier = await harness.repository.createOrganizerEvent({
          ...validEvent,
          slug: "organizer-lifecycle-earlier",
          startsAt: "2026-11-01T10:00:00+03:00",
          endsAt: "2026-11-01T12:00:00+03:00",
        });

        expect(later).toMatchObject({
          title: validEvent.title,
          slug: validEvent.slug,
          programState: "draft",
          publishedAt: null,
        });
        expect(later.id).toEqual(expect.any(String));
        expect(later.id).not.toBe(earlier.id);
        expect(await harness.repository.getOrganizerEvent(later.id)).toEqual(later);
        expect(await harness.repository.getOrganizerEvent("missing-event")).toBeNull();
        expect((await harness.repository.listOrganizerEvents()).map((event) => event.id)).toEqual([
          earlier.id,
          later.id,
        ]);
      } finally {
        await harness.close();
      }
    });

    it("rejects invalid input without changing the event list", async () => {
      const harness = await createHarness();
      try {
        await expect(
          harness.repository.createOrganizerEvent({ ...validEvent, title: "   " }),
        ).rejects.toMatchObject({ code: "title" });
        await expect(
          harness.repository.createOrganizerEvent({ ...validEvent, slug: "Malformed slug" }),
        ).rejects.toMatchObject({ code: "slug" });
        await expect(
          harness.repository.createOrganizerEvent({ ...validEvent, timezone: "Mars/Olympus" }),
        ).rejects.toMatchObject({ code: "timezone" });
        await expect(
          harness.repository.createOrganizerEvent({
            ...validEvent,
            startsAt: "2026-11-02T10:00:00",
          }),
        ).rejects.toMatchObject({ code: "startsAt" });
        await expect(
          harness.repository.createOrganizerEvent({
            ...validEvent,
            endsAt: "2026-11-02T10:00:00+03:00",
          }),
        ).rejects.toMatchObject({ code: "endsAt" });

        expect(await harness.repository.listOrganizerEvents()).toEqual([]);
      } finally {
        await harness.close();
      }
    });

    it("normalizes a duplicate slug and leaves the original draft untouched", async () => {
      const harness = await createHarness();
      try {
        const original = await harness.repository.createOrganizerEvent(validEvent);
        await expect(
          harness.repository.createOrganizerEvent({ ...validEvent, title: "Duplicate attempt" }),
        ).rejects.toMatchObject({ code: "duplicate_slug" });

        expect(await harness.repository.listOrganizerEvents()).toEqual([original]);
      } finally {
        await harness.close();
      }
    });
  });
}
