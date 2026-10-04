import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const LIVE_QNA_ORIGIN = "https://sanchez-live-qna.vercel.app";

function moscowDateTimeLocal(value: Date): string {
  const moscowOffsetMilliseconds = 3 * 60 * 60 * 1_000;
  return new Date(value.getTime() + moscowOffsetMilliseconds).toISOString().slice(0, 16);
}

async function createDraftEvent(
  page: Page,
  values: { title: string; slug: string; startsAt: string; endsAt: string },
) {
  await page.goto("/organizer");
  await page.getByLabel("Название события").fill(values.title);
  await page.getByLabel("Slug").fill(values.slug);
  await page.getByLabel("Часовой пояс").fill("Europe/Moscow");
  await page.getByLabel("Начало").fill(values.startsAt);
  await page.getByLabel("Окончание").fill(values.endsAt);
  await page.getByRole("button", { name: "Создать черновик" }).click();

  await expect(page).toHaveURL(/\/organizer\/events\/[^/]+\/program$/);
  await expect(page.getByRole("heading", { name: values.title })).toBeVisible();
}

async function addSession(
  page: Page,
  values: {
    title: string;
    slug: string;
    summary: string;
    startsAt: string;
    endsAt: string;
  },
) {
  await page.getByRole("button", { name: "+ Новая сессия" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Название").fill(values.title);
  await dialog.getByLabel("Slug").fill(values.slug);
  await dialog.getByLabel("Начало · Europe/Moscow").fill(values.startsAt);
  await dialog.getByLabel("Окончание · Europe/Moscow").fill(values.endsAt);
  await dialog.getByLabel("Краткое описание").fill(values.summary);
  await dialog.getByRole("button", { name: "Создать сессию" }).click();

  await expect(page).toHaveURL(/tone=success.*message=/);
  await expect(page.getByRole("heading", { name: values.title })).toBeVisible();
}

async function editSessionTitle(page: Page, currentTitle: string, nextTitle: string) {
  const sessionItem = page.getByRole("listitem").filter({ hasText: currentTitle });
  await sessionItem.getByRole("button", { name: "Изменить", exact: true }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Название").fill(nextTitle);
  await dialog.getByRole("button", { name: "Сохранить изменения" }).click();

  await expect(page).toHaveURL(/tone=success.*message=/);
  await expect(page.getByRole("heading", { name: nextTitle })).toBeVisible();
  await expect(page.getByText(currentTitle, { exact: true })).toHaveCount(0);
}

function addCompanionLiveMappingFixture(values: {
  eventSlug: string;
  sessionSlug: string;
  integrationId: string;
  externalEventKey: string;
  externalRoomSlug: string;
}) {
  const databasePath = resolve(
    process.cwd(),
    process.env.EVENT_COMPANION_DATABASE_PATH ?? ".data/event-companion.sqlite",
  );
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON;");

  try {
    const eventRow = database
      .prepare("SELECT id FROM events WHERE slug = ?")
      .get(values.eventSlug) as { id: string } | undefined;
    if (!eventRow) throw new Error(`E2E event not found: ${values.eventSlug}`);

    const sessionRow = database
      .prepare("SELECT id FROM sessions WHERE event_id = ? AND slug = ?")
      .get(eventRow.id, values.sessionSlug) as { id: string } | undefined;
    if (!sessionRow) throw new Error(`E2E session not found: ${values.sessionSlug}`);

    database.exec("BEGIN IMMEDIATE");
    database
      .prepare(
        `INSERT INTO live_integrations (
          id, event_id, provider, external_event_key, enabled
        ) VALUES (?, ?, 'sanchez-live-qna', ?, 1)`,
      )
      .run(values.integrationId, eventRow.id, values.externalEventKey);
    database
      .prepare(
        `INSERT INTO live_session_mappings (
          session_id, integration_id, external_room_slug
        ) VALUES (?, ?, ?)`,
      )
      .run(sessionRow.id, values.integrationId, values.externalRoomSlug);
    database.exec("COMMIT");
  } catch (error) {
    if (database.isTransaction) database.exec("ROLLBACK");
    throw error;
  } finally {
    database.close();
  }
}

async function expectDraftRouteClosed(
  page: Page,
  url: string,
  protectedContent: readonly string[],
) {
  const response = await page.goto(url);
  expect(response?.status()).toBe(404);
  for (const content of protectedContent) {
    await expect(page.getByText(content, { exact: true })).toHaveCount(0);
  }
}

async function expectUnpublishedRouteClosed(
  page: Page,
  url: string,
  protectedContent: readonly string[],
) {
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Скоро здесь появится расписание" })).toBeVisible();
  for (const content of protectedContent) {
    await expect(page.getByText(content, { exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole("link", { name: /LIVE Q&A|Задать вопрос спикеру/ })).toHaveCount(0);
}

test("organizer publishes, operates NOW, and preserves the passive LIVE handoff boundary", async ({
  page,
  browser,
}) => {
  test.setTimeout(60_000);

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const eventTitle = `LIVE operations ${runId}`;
  const eventSlug = `live-operations-${runId}`;
  const mappedDraftTitle = `Mapped draft ${runId}`;
  const mappedTitle = `Mapped session ${runId}`;
  const mappedSlug = `mapped-session-${runId}`;
  const unmappedTitle = `Unmapped session ${runId}`;
  const unmappedSlug = `unmapped-session-${runId}`;
  const externalEventKey = `live-operations-${runId}`;
  const externalRoomSlug = `mapped-room-${runId}`;
  const liveHref = `${LIVE_QNA_ORIGIN}/ask.html?event=${externalEventKey}`;
  const todayUrl = `/e/${eventSlug}`;
  const programmeUrl = `${todayUrl}/program`;
  const mappedSessionUrl = `${todayUrl}/sessions/${mappedSlug}`;
  const unmappedSessionUrl = `${todayUrl}/sessions/${unmappedSlug}`;
  const protectedContent = [eventTitle, mappedTitle, unmappedTitle];

  const anchor = new Date();
  anchor.setUTCSeconds(0, 0);
  const at = (minutes: number) =>
    moscowDateTimeLocal(new Date(anchor.getTime() + minutes * 60_000));

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  const liveRequests: string[] = [];
  guestPage.on("request", (request) => {
    if (request.url().startsWith(LIVE_QNA_ORIGIN)) liveRequests.push(request.url());
  });

  try {
    await createDraftEvent(page, {
      title: eventTitle,
      slug: eventSlug,
      startsAt: at(-120),
      endsAt: at(240),
    });
    await expect(page.getByLabel("Публикация и текущее состояние")).toContainText("Черновик");

    await addSession(page, {
      title: mappedDraftTitle,
      slug: mappedSlug,
      summary: "Mapped Companion session",
      startsAt: at(-30),
      endsAt: at(60),
    });
    await editSessionTitle(page, mappedDraftTitle, mappedTitle);
    await addSession(page, {
      title: unmappedTitle,
      slug: unmappedSlug,
      summary: "Valid Companion session without a LIVE mapping",
      startsAt: at(90),
      endsAt: at(150),
    });

    addCompanionLiveMappingFixture({
      eventSlug,
      sessionSlug: mappedSlug,
      integrationId: `live-integration-${runId}`,
      externalEventKey,
      externalRoomSlug,
    });

    const scheduledItem = page.getByRole("listitem").filter({ hasText: mappedTitle });
    await expect(scheduledItem.getByText("NOW · расписание", { exact: true })).toBeVisible();

    const previewPopup = page.waitForEvent("popup");
    await page.getByRole("link", { name: "Preview / Черновик ↗" }).click();
    const previewPage = await previewPopup;
    await expect(previewPage).toHaveURL(/\/organizer\/events\/[^/]+\/preview$/);
    await expect(previewPage.getByText("Preview / Черновик", { exact: true })).toBeVisible();
    await expect(previewPage.getByText(eventTitle, { exact: true })).toBeVisible();
    await expect(previewPage.getByRole("heading", { name: "Участвуйте" })).toBeVisible();
    await expect(previewPage.getByRole("region", { name: "Действия гостя" }).getByRole("link")).toHaveCount(0);
    await previewPage.close();

    await expectDraftRouteClosed(guestPage, todayUrl, protectedContent);
    await expectDraftRouteClosed(guestPage, programmeUrl, protectedContent);
    await expectDraftRouteClosed(guestPage, mappedSessionUrl, protectedContent);
    await expectDraftRouteClosed(guestPage, unmappedSessionUrl, protectedContent);

    await page.getByRole("button", { name: "Опубликовать программу" }).click();
    await expect(page).toHaveURL(/tone=success.*message=/);
    await expect(page.getByRole("status")).toHaveText("Программа опубликована");
    await expect(page.getByLabel("Публикация и текущее состояние")).toContainText("Опубликовано");

    await guestPage.goto(todayUrl);
    await expect(guestPage.getByText(eventTitle, { exact: true })).toBeVisible();
    const todayLiveLink = guestPage.getByRole("link", { name: /Задать вопрос спикеру/ });
    await expect(todayLiveLink).toHaveAttribute("href", liveHref);
    await expect(guestPage.getByText("Открыто", { exact: true })).toHaveCount(0);
    await expect(guestPage.locator("iframe")).toHaveCount(0);

    await guestPage.goto(programmeUrl);
    await expect(guestPage.getByText(eventTitle, { exact: true })).toBeVisible();
    const agenda = guestPage.getByRole("region", { name: "Сессии программы" });
    await expect(agenda.getByRole("heading", { name: mappedTitle, exact: true })).toBeVisible();
    await expect(agenda.getByRole("heading", { name: unmappedTitle, exact: true })).toBeVisible();
    const scheduledCurrent = guestPage.locator("section.current-session");
    await expect(
      scheduledCurrent.getByRole("heading", { name: mappedTitle, exact: true }),
    ).toBeVisible();
    await expect(scheduledCurrent.getByText("Выбор организатора", { exact: true })).toHaveCount(0);

    await guestPage.goto(mappedSessionUrl);
    await expect(guestPage.getByRole("heading", { name: mappedTitle, exact: true })).toBeVisible();
    const sessionLiveLink = guestPage.getByRole("link", { name: /Открыть LIVE Q&A/ });
    await expect(sessionLiveLink).toHaveAttribute("href", liveHref);
    expect(await sessionLiveLink.getAttribute("href")).not.toContain(externalRoomSlug);
    await expect(guestPage.locator("iframe")).toHaveCount(0);

    await guestPage.goto(unmappedSessionUrl);
    await expect(guestPage.getByRole("heading", { name: unmappedTitle, exact: true })).toBeVisible();
    await expect(guestPage.getByRole("link", { name: /Открыть LIVE Q&A/ })).toHaveCount(0);
    await expect(guestPage.getByText("Valid Companion session without a LIVE mapping")).toBeVisible();

    const unmappedItem = page.getByRole("listitem").filter({ hasText: unmappedTitle });
    await unmappedItem.getByRole("button", { name: "Сделать текущей" }).click();
    await expect(page).toHaveURL(/tone=success.*message=/);
    await expect(page.getByRole("status")).toHaveText("Текущая сессия выбрана вручную");
    await expect(
      page.getByRole("listitem").filter({ hasText: unmappedTitle }).getByText("NOW · вручную", { exact: true }),
    ).toBeVisible();

    await guestPage.goto(programmeUrl);
    const manualCurrent = guestPage.locator("section.current-session");
    await expect(
      manualCurrent.getByRole("heading", { name: unmappedTitle, exact: true }),
    ).toBeVisible();
    await expect(manualCurrent.getByText("Выбор организатора", { exact: true })).toBeVisible();

    await guestPage.goto(todayUrl);
    await expect(guestPage.getByRole("link", { name: /Задать вопрос спикеру/ })).toHaveCount(0);
    await expect(guestPage.getByText("Недоступно", { exact: true })).toBeVisible();
    await expect(guestPage.locator(`a[href="${liveHref}"]`)).toHaveCount(0);

    await page.getByRole("button", { name: "Вернуться к расписанию" }).click();
    await expect(page).toHaveURL(/tone=success.*message=/);
    await expect(page.getByRole("status")).toHaveText("Ручной выбор снят — действует расписание");
    await expect(
      page.getByRole("listitem").filter({ hasText: mappedTitle }).getByText("NOW · расписание", { exact: true }),
    ).toBeVisible();

    await guestPage.goto(programmeUrl);
    const restoredCurrent = guestPage.locator("section.current-session");
    await expect(
      restoredCurrent.getByRole("heading", { name: mappedTitle, exact: true }),
    ).toBeVisible();
    await expect(restoredCurrent.getByText("Выбор организатора", { exact: true })).toHaveCount(0);

    await guestPage.goto(todayUrl);
    await expect(guestPage.getByRole("link", { name: /Задать вопрос спикеру/ })).toHaveAttribute(
      "href",
      liveHref,
    );

    await page.getByRole("button", { name: "Снять с публикации" }).click();
    await expect(page).toHaveURL(/tone=success.*message=/);
    await expect(page.getByRole("status")).toHaveText("Программа снята с публикации");

    await expectUnpublishedRouteClosed(guestPage, todayUrl, protectedContent);
    await expectUnpublishedRouteClosed(guestPage, programmeUrl, protectedContent);
    await expectUnpublishedRouteClosed(guestPage, mappedSessionUrl, protectedContent);
    await expectUnpublishedRouteClosed(guestPage, unmappedSessionUrl, protectedContent);

    expect(liveRequests).toEqual([]);
  } finally {
    await guestContext.close();
  }
});
