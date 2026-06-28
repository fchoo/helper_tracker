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
  await page.getByRole("button", { name: "Run health check" }).click();
  await expect(page.getByText("Schema template ready")).toBeVisible();

  await page.getByLabel("Monthly salary").fill("900");
  await page.getByLabel("Effective start date").fill("2026-01-01");
  await page.getByLabel("Notes").fill("Current contract");
  await page.getByRole("button", { name: "Save salary plan" }).click();
  await expect(page.getByText("SGD 900.00")).toBeVisible();

  await page.getByRole("button", { name: "Advances" }).click();
  await page.getByRole("button", { name: "Add advance" }).click();
  await page.getByLabel("Advance date").fill("2026-08-02");
  await page.getByLabel("Advance amount").fill("300");
  await page.getByLabel("Description").fill("School expense");
  await page.getByLabel("Deduction month 1").fill("2026-08");
  await page.getByLabel("Deduction amount 1").fill("100");
  await page.getByRole("button", { name: "Add deduction month" }).click();
  await page.getByLabel("Deduction month 2").fill("2026-09");
  await page.getByLabel("Deduction amount 2").fill("200");
  await page.getByRole("button", { name: "Save advance" }).click();
  await expect(page.getByRole("status")).toContainText("Advance saved.");
  await expect(page.getByText("Deducted in 2026-08: SGD 100.00")).toBeVisible();

  await page.getByRole("button", { name: "Time & Calendar" }).click();
  await page.getByLabel("Start date").fill("2026-08-09");
  await page.getByLabel("Worked").check();
  await page.getByLabel("Time notes").fill("Worked Sunday");
  await page.getByRole("button", { name: "Save day" }).click();
  await expect(summaryItem(page, "Worked Sundays")).toContainText("1");

  await page.getByLabel("Holiday name").fill("National Day observed");
  await page.getByLabel("Start date").fill("2026-08-10");
  await page.getByLabel("Holiday date").fill("2026-08-10");
  await page.getByRole("button", { name: "Add public holiday" }).click();

  await page.getByLabel("Start date").fill("2026-08-10");
  await page.getByLabel("Worked").check();
  await page.getByRole("button", { name: "Save day" }).click();
  await expect(page.getByRole("status")).toContainText("No payroll change to save.");

  await page.getByLabel("Pay extra for PH work").check();
  await page.getByLabel("Time notes").fill("Paid extra for public holiday");
  await page.getByRole("button", { name: "Save day" }).click();
  await expect(page.getByLabel("Time records").getByText("Extra PH pay")).toBeVisible();

  await page.getByLabel("Holiday name").fill("National Day");
  await page.getByLabel("Holiday date").fill("2026-08-09");
  await page.getByRole("button", { name: "Add public holiday" }).click();
  const calendar = page.getByRole("list", { name: "Monthly calendar" });
  const sundayHoliday = calendar
    .getByRole("listitem")
    .filter({ hasText: "09" })
    .filter({ hasText: "National Day" });
  await expect(sundayHoliday).toBeVisible();
  await expect(sundayHoliday).toContainText("Worked Sunday");

  await page.getByRole("button", { name: "Salary" }).click();
  await expect(summaryItem(page, "Base salary")).toContainText("SGD 900.00");
  await expect(summaryItem(page, "Worked Sundays")).toContainText("1 days");
  await expect(summaryItem(page, "Worked Sundays")).toContainText("SGD 34.62");
  await expect(summaryItem(page, "Extra PH pay")).toContainText("SGD 34.62");
  await expect(summaryItem(page, "Advance deductions")).toContainText("SGD 100.00");
  await expect(page.getByLabel("Pay decision")).toContainText("SGD 869.24");
  await expect(page.getByText("Final payout")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Salary plan history" })).toBeVisible();
  await expect(page.getByText("School expense")).toBeVisible();
  await expect(
    page
      .getByRole("list")
      .filter({ hasText: "Worked Sunday" })
      .filter({ hasText: "2026-08-09" }),
  ).toBeVisible();
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
  await page.getByRole("button", { name: "Time & Calendar" }).click();

  const navPosition = await page.locator(".primary-nav").evaluate((element) =>
    getComputedStyle(element).position,
  );
  expect(navPosition).toBe(expectedNavPosition);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  await expect(
    page.getByRole("heading", { name: "Time & Calendar" }),
  ).toBeVisible();
}
