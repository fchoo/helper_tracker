import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
  await page.goto("/");
});

test("tracks a monthly helper payout from setup through salary review", async ({
  page,
}) => {
  await expect(page.getByRole("heading", { name: "Domestic Helper Tracker" })).toBeVisible();

  await page.getByLabel("Selected month").fill("2026-08");
  await page.getByRole("button", { name: "Config" }).click();

  await page.getByLabel("Google Spreadsheet ID").fill("sheet_e2e");
  await page.getByRole("button", { name: "Connect sheet" }).click();
  await expect(page.getByText("Connected to sheet_e2e")).toBeVisible();

  await page.getByLabel("Monthly salary").fill("900");
  await page.getByLabel("Effective start date").fill("2026-01-01");
  await page.getByLabel("OT day divisor").fill("26");
  await page.getByLabel("Notes").fill("Current contract");
  await page.getByRole("button", { name: "Save salary version" }).click();
  await expect(page.getByText("SGD 900.00")).toBeVisible();

  await page.getByRole("button", { name: "Advances" }).click();
  await page.getByLabel("Advance date").fill("2026-08-02");
  await page.getByLabel("Amount").fill("300");
  await page.getByLabel("Description").fill("School expense");
  await page.getByLabel("Deduction schedule").fill("2026-08: 100\n2026-09: 200");
  await page.getByRole("button", { name: "Save advance" }).click();
  await expect(page.getByText("Selected month deductions: SGD 100.00")).toBeVisible();

  await page.getByRole("button", { name: "Time" }).click();
  await page.getByLabel("Record type").selectOption("SUNDAY_OT");
  await page.getByLabel("Start date").fill("2026-08-09");
  await page.getByLabel("End date").fill("2026-08-09");
  await page.getByLabel("Notes").fill("Worked Sunday");
  await page.getByRole("button", { name: "Save time record" }).click();
  await expect(page.getByText("Sunday OT: 1")).toBeVisible();

  await page.getByLabel("Record type").selectOption("PUBLIC_HOLIDAY_WORK");
  await page.getByLabel("Start date").fill("2026-08-10");
  await page.getByLabel("End date").fill("2026-08-10");
  await page.getByLabel("Notes").fill("Worked public holiday");
  await page.getByRole("button", { name: "Save time record" }).click();
  await expect(
    page.getByRole("list").getByText("Public holiday work"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Calendar" }).click();
  await page.getByLabel("Holiday name").fill("National Day");
  await page.getByLabel("Holiday date").fill("2026-08-09");
  await page.getByRole("button", { name: "Add public holiday" }).click();
  const calendar = page.getByRole("list", { name: "Monthly calendar" });
  await expect(calendar.getByRole("listitem").filter({ hasText: "National Day" })).toBeVisible();
  await expect(calendar.getByRole("listitem").filter({ hasText: "Sunday OT" })).toBeVisible();

  await page.getByRole("button", { name: "Salary" }).click();
  await expect(summaryItem(page, "Base salary")).toContainText("SGD 900.00");
  await expect(summaryItem(page, "Sunday OT days")).toContainText("1");
  await expect(summaryItem(page, "Sunday OT amount")).toContainText("SGD 34.62");
  await expect(summaryItem(page, "Public holiday work")).toContainText("SGD 34.62");
  await expect(summaryItem(page, "Advance deductions")).toContainText("SGD 100.00");
  await expect(summaryItem(page, "Final payout")).toContainText("SGD 869.24");
  await expect(page.getByText("School expense")).toBeVisible();
  await expect(page.getByText("Worked Sunday")).toBeVisible();
});

test("keeps navigation usable on desktop and Android-sized viewports", async ({
  page,
}) => {
  await assertResponsiveShell(page, { width: 1280, height: 720 }, "sticky");
  await assertResponsiveShell(page, { width: 375, height: 812 }, "fixed");
});

function summaryItem(page: Page, label: string) {
  return page.locator(".summary-item").filter({ hasText: label });
}

async function assertResponsiveShell(
  page: Page,
  viewport: { width: number; height: number },
  expectedNavPosition: "sticky" | "fixed",
) {
  await page.setViewportSize(viewport);
  await page.reload();
  await page.getByRole("button", { name: "Calendar" }).click();

  const navPosition = await page.locator(".primary-nav").evaluate((element) =>
    getComputedStyle(element).position,
  );
  expect(navPosition).toBe(expectedNavPosition);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
}
