import { expect, test, type Page } from "@playwright/test";

const validStart = "2032-05-20T10:00";
const validEnd = "2032-05-20T12:00";

async function fillEventForm(
  page: Page,
  values: { title: string; slug: string; timezone: string; startsAt: string; endsAt: string },
) {
  await page.getByLabel("Название события").fill(values.title);
  await page.getByLabel("Slug").fill(values.slug);
  await page.getByLabel("Часовой пояс").fill(values.timezone);
  await page.getByLabel("Начало").fill(values.startsAt);
  await page.getByLabel("Окончание").fill(values.endsAt);
}

test("organizer creates, opens, and safely rejects invalid drafts", async ({ page }) => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const title = `Playwright draft ${runId}`;
  const slug = `playwright-draft-${runId}`;
  const listItems = page.locator(".organizer-event-list").getByRole("listitem");

  await page.goto("/organizer");
  const initialCount = await listItems.count();

  await fillEventForm(page, {
    title,
    slug,
    timezone: "Europe/Moscow",
    startsAt: validStart,
    endsAt: validEnd,
  });
  await page.getByRole("button", { name: "Создать черновик" }).click();

  await expect(page).toHaveURL(/\/organizer\/events\/[^/]+\/program$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await page.goto("/organizer");
  await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await expect(listItems).toHaveCount(initialCount + 1);

  await fillEventForm(page, {
    title: `Invalid bounds ${runId}`,
    slug: `invalid-bounds-${runId}`,
    timezone: "Europe/Moscow",
    startsAt: validEnd,
    endsAt: validStart,
  });
  await page.getByRole("button", { name: "Создать черновик" }).click();
  await expect(page).toHaveURL(/\/organizer\?/);
  await expect(page.getByText("Окончание должно быть позже начала.")).toBeVisible();
  await expect(page.getByLabel("Окончание")).toHaveAttribute("aria-invalid", "true");
  await expect(listItems).toHaveCount(initialCount + 1);

  await fillEventForm(page, {
    title: `Invalid timezone ${runId}`,
    slug: `invalid-timezone-${runId}`,
    timezone: "UTC",
    startsAt: validStart,
    endsAt: validEnd,
  });
  await page.getByRole("button", { name: "Создать черновик" }).click();
  await expect(page.getByText("Поддерживается только Europe/Moscow.")).toBeVisible();
  await expect(page.getByLabel("Часовой пояс")).toHaveAttribute("aria-invalid", "true");
  await expect(listItems).toHaveCount(initialCount + 1);

  await fillEventForm(page, {
    title: `Duplicate slug ${runId}`,
    slug,
    timezone: "Europe/Moscow",
    startsAt: validStart,
    endsAt: validEnd,
  });
  await page.getByRole("button", { name: "Создать черновик" }).click();
  await expect(page.getByText("Проверьте значение этого поля.")).toBeVisible();
  await expect(page.getByLabel("Slug")).toHaveAttribute("aria-invalid", "true");
  await expect(listItems).toHaveCount(initialCount + 1);
});
