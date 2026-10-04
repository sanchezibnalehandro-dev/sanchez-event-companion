import { expect, test, type Page } from "@playwright/test";

const eventStart = "2032-05-20T10:00";
const eventEnd = "2032-05-20T14:00";

async function createDraftEvent(page: Page, values: { title: string; slug: string }) {
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

async function addSession(
  page: Page,
  values: { title: string; slug: string; startsAt: string; endsAt: string },
) {
  await page.getByRole("button", { name: "+ Новая сессия" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Название").fill(values.title);
  await dialog.getByLabel("Slug").fill(values.slug);
  await dialog.getByLabel("Начало · Europe/Moscow").fill(values.startsAt);
  await dialog.getByLabel("Окончание · Europe/Moscow").fill(values.endsAt);
  await dialog.getByRole("button", { name: "Создать сессию" }).click();

  await expect(page).toHaveURL(/tone=success.*message=/);
  await expect(page.getByRole("heading", { name: values.title })).toBeVisible();
}

async function expectProtectedContentHidden(
  page: Page,
  values: { eventTitle: string; sessionTitle: string },
) {
  await expect(page.getByText(values.eventTitle, { exact: true })).toHaveCount(0);
  await expect(page.getByText(values.sessionTitle, { exact: true })).toHaveCount(0);
}

async function expectPreviewTodayShell(
  page: Page,
  values: {
    eventTitle: string;
    sessionTitle: string;
    todayUrl: string;
    programmeUrl: string;
  },
) {
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByText("Preview / Черновик", { exact: true })).toBeVisible();
  await expect(page.getByText(values.eventTitle, { exact: true })).toBeVisible();
  await expect(page.getByText("Для гостей", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Участвуйте" })).toBeVisible();

  const actions = page.getByRole("region", { name: "Действия гостя" });
  await expect(actions).toBeVisible();
  await expect(actions.getByText("Задать вопрос спикеру", { exact: true })).toBeVisible();
  await expect(actions.getByText("Программа дня", { exact: true })).toBeVisible();
  await expect(actions.getByText("Недоступно", { exact: true })).toBeVisible();

  await expect(actions.getByRole("link")).toHaveCount(0);
  await expect(page.locator(`a[href="${values.todayUrl}"]`)).toHaveCount(0);
  await expect(page.locator(`a[href="${values.programmeUrl}"]`)).toHaveCount(0);
  await expect(page.getByText(values.sessionTitle, { exact: true })).toHaveCount(0);
}

test("organizer preview stays protected across draft, publish, and unpublish", async ({
  page,
  browser,
}) => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const eventTitle = `Protected preview ${runId}`;
  const eventSlug = `protected-preview-${runId}`;
  const sessionTitle = `Preview session ${runId}`;
  const sessionSlug = `preview-session-${runId}`;
  const todayUrl = `/e/${eventSlug}`;
  const programmeUrl = `${todayUrl}/program`;

  const guestContext = await browser.newContext({ extraHTTPHeaders: {} });
  const guestPage = await guestContext.newPage();
  let anonymousContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;

  try {
    await createDraftEvent(page, { title: eventTitle, slug: eventSlug });
    await expect(page.getByLabel("Публикация и текущее состояние")).toContainText("Черновик");

    await addSession(page, {
      title: sessionTitle,
      slug: sessionSlug,
      startsAt: "2032-05-20T10:30",
      endsAt: "2032-05-20T11:15",
    });

    const previewLink = page.getByRole("link", { name: "Preview / Черновик ↗" });
    const previewHref = await previewLink.getAttribute("href");
    expect(previewHref).toMatch(/^\/organizer\/events\/[^/]+\/preview$/);

    const previewPopup = page.waitForEvent("popup");
    await previewLink.click();
    const previewPage = await previewPopup;
    await expect(previewPage).toHaveURL(previewHref!);
    await expectPreviewTodayShell(previewPage, {
      eventTitle,
      sessionTitle,
      todayUrl,
      programmeUrl,
    });

    const draftTodayResponse = await guestPage.goto(todayUrl);
    expect(draftTodayResponse?.status()).toBe(404);
    await expectProtectedContentHidden(guestPage, { eventTitle, sessionTitle });

    const draftProgrammeResponse = await guestPage.goto(programmeUrl);
    expect(draftProgrammeResponse?.status()).toBe(404);
    await expectProtectedContentHidden(guestPage, { eventTitle, sessionTitle });

    anonymousContext = await browser.newContext({ extraHTTPHeaders: {} });
    const anonymousPage = await anonymousContext.newPage();
    const anonymousResponse = await anonymousPage.goto(previewHref!);
    const redirectedFrom = anonymousResponse?.request().redirectedFrom();
    if (!redirectedFrom) throw new Error("Expected anonymous preview navigation to redirect");
    const redirectResponse = await redirectedFrom.response();
    expect(redirectResponse?.status()).toBeGreaterThanOrEqual(300);
    expect(redirectResponse?.status()).toBeLessThan(400);
    expect(new URL(redirectedFrom.url()).pathname).toBe(previewHref);

    await expect(anonymousPage).toHaveURL(/\/organizer\/login\?next=/);
    const loginUrl = new URL(anonymousPage.url());
    expect(loginUrl.pathname).toBe("/organizer/login");
    expect(loginUrl.searchParams.get("next")).toBe(previewHref);
    await expect(anonymousPage.getByRole("heading", { name: "Вход организатора" })).toBeVisible();
    await expectProtectedContentHidden(anonymousPage, { eventTitle, sessionTitle });

    await page.getByRole("button", { name: "Опубликовать программу" }).click();
    await expect(page).toHaveURL(/tone=success.*message=/);
    await expect(page.getByRole("status")).toHaveText("Программа опубликована");
    await expect(page.getByLabel("Публикация и текущее состояние")).toContainText("Опубликовано");

    await guestPage.goto(todayUrl);
    await expect(guestPage.getByText(eventTitle, { exact: true })).toBeVisible();
    await guestPage.goto(programmeUrl);
    await expect(guestPage.getByText(eventTitle, { exact: true })).toBeVisible();
    await expect(guestPage.getByRole("heading", { name: sessionTitle })).toBeVisible();

    await page.getByRole("button", { name: "Снять с публикации" }).click();
    await expect(page).toHaveURL(/tone=success.*message=/);
    await expect(page.getByRole("status")).toHaveText("Программа снята с публикации");
    await expect(page.getByLabel("Публикация и текущее состояние")).toContainText(
      "Снято с публикации",
    );

    await previewPage.reload();
    await expectPreviewTodayShell(previewPage, {
      eventTitle,
      sessionTitle,
      todayUrl,
      programmeUrl,
    });

    await guestPage.goto(todayUrl);
    await expect(guestPage.getByRole("heading", { name: "Скоро здесь появится расписание" })).toBeVisible();
    await expectProtectedContentHidden(guestPage, { eventTitle, sessionTitle });

    await guestPage.goto(programmeUrl);
    await expect(guestPage.getByRole("heading", { name: "Скоро здесь появится расписание" })).toBeVisible();
    await expectProtectedContentHidden(guestPage, { eventTitle, sessionTitle });
  } finally {
    await anonymousContext?.close();
    await guestContext.close();
  }
});
