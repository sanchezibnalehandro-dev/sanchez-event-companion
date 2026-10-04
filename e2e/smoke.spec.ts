import { expect, test } from "@playwright/test";

test("demo organizer dashboard renders", async ({ page }) => {
  await page.goto("/organizer");

  await expect(page.getByRole("heading", { name: "События", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Создать черновик события" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Создать черновик" })).toBeVisible();
  await expect(page.getByText(/Application error/i)).toHaveCount(0);
});
