import { expect, test, type Page } from "@playwright/test";

const eventStart = "2032-05-20T10:00";
const eventEnd = "2032-05-20T14:00";

async function createEvent(page: Page, values: { title: string; slug: string }) {
  await page.goto("/organizer");
  await page.getByLabel("Название события").fill(values.title);
  await page.getByLabel("Slug").fill(values.slug);
  await page.getByLabel("Часовой пояс").fill("Europe/Moscow");
  await page.getByLabel("Начало").fill(eventStart);
  await page.getByLabel("Окончание").fill(eventEnd);
  await page.getByRole("button", { name: "Создать черновик" }).click();

  await expect(page).toHaveURL(/\/organizer\/events\/[^/]+\/program$/);
  await expect(page.getByRole("heading", { name: values.title })).toBeVisible();
}

async function fillSession(
  page: Page,
  values: { title: string; slug: string; startsAt: string; endsAt: string },
) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Название").fill(values.title);
  await dialog.getByLabel("Slug").fill(values.slug);
  await dialog.getByLabel("Начало · Europe/Moscow").fill(values.startsAt);
  await dialog.getByLabel("Окончание · Europe/Moscow").fill(values.endsAt);
}

test("organizer explicitly publishes live programme edits and closes guest access on unpublish", async ({
  page,
  browser,
}) => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const eventTitle = `Publication workflow ${runId}`;
  const eventSlug = `publication-workflow-${runId}`;
  const originalTitle = `Initial session ${runId}`;
  const updatedTitle = `Updated session ${runId}`;
  const sessionSlug = `session-${runId}`;
  const programmeUrl = `/e/${eventSlug}/program`;
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();

  try {
    await createEvent(page, { title: eventTitle, slug: eventSlug });
    await expect(page.getByLabel("Публикация и текущее состояние")).toContainText("Черновик");

    await page.getByRole("button", { name: "+ Новая сессия" }).click();
    await fillSession(page, {
      title: originalTitle,
      slug: sessionSlug,
      startsAt: "2032-05-20T10:30",
      endsAt: "2032-05-20T11:15",
    });
    await page.getByRole("button", { name: "Создать сессию" }).click();
    await expect(page).toHaveURL(/tone=success.*message=/);
    await expect(page.getByRole("heading", { name: originalTitle })).toBeVisible();
    await expect(page.getByLabel("Публикация и текущее состояние")).toContainText("Черновик");

    const draftResponse = await guestPage.goto(programmeUrl);
    expect(draftResponse?.status()).toBe(404);
    await expect(guestPage.getByText(eventTitle, { exact: true })).toHaveCount(0);
    await expect(guestPage.getByText(originalTitle, { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Опубликовать программу" }).click();
    await expect(page).toHaveURL(/tone=success.*message=/);
    await expect(page.getByRole("status")).toHaveText("Программа опубликована");
    await expect(page.getByLabel("Публикация и текущее состояние")).toContainText("Опубликовано");
    await expect(page.getByRole("link", { name: "Открыть гостевую программу" })).toHaveAttribute(
      "href",
      programmeUrl,
    );

    await guestPage.goto(programmeUrl);
    await expect(guestPage.getByText(eventTitle, { exact: true })).toBeVisible();
    await expect(guestPage.getByText(originalTitle, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Изменить", exact: true }).click();
    await fillSession(page, {
      title: updatedTitle,
      slug: sessionSlug,
      startsAt: "2032-05-20T11:30",
      endsAt: "2032-05-20T12:15",
    });
    await page.getByRole("button", { name: "Сохранить изменения" }).click();
    await expect(page).toHaveURL(/tone=success.*message=/);
    await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
    await expect(page.getByLabel("Публикация и текущее состояние")).toContainText("Опубликовано");

    await guestPage.goto(programmeUrl);
    await expect(guestPage.getByText(eventTitle, { exact: true })).toBeVisible();
    await expect(guestPage.getByText(updatedTitle, { exact: true })).toBeVisible();
    await expect(guestPage.getByText(originalTitle, { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Снять с публикации" }).click();
    await expect(page).toHaveURL(/tone=success.*message=/);
    await expect(page.getByRole("status")).toHaveText("Программа снята с публикации");
    await expect(page.getByLabel("Публикация и текущее состояние")).toContainText("Снято с публикации");
    await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();

    await guestPage.goto(programmeUrl);
    await expect(guestPage.getByRole("heading", { name: "Скоро здесь появится расписание" })).toBeVisible();
    await expect(guestPage.getByText(eventTitle, { exact: true })).toHaveCount(0);
    await expect(guestPage.getByText(originalTitle, { exact: true })).toHaveCount(0);
    await expect(guestPage.getByText(updatedTitle, { exact: true })).toHaveCount(0);
  } finally {
    await guestContext.close();
  }
});
