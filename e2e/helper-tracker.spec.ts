import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://accounts.google.com/gsi/client", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: `
        window.google = {
          accounts: {
            oauth2: {
              initTokenClient: ({ callback }) => ({
                requestAccessToken: () => callback({ access_token: "token_e2e" }),
              }),
            },
          },
        };
      `,
    });
  });
  await page.addInitScript(() => {
    localStorage.clear();
  });
  await page.route("https://sheets.googleapis.com/v4/spreadsheets/sheet_e2e?**", async (route) => {
    await route.fulfill({
      json: {
        spreadsheetId: "sheet_e2e",
        sheets: requiredSheets.map((title, index) => ({
          properties: { title, sheetId: index + 1 },
        })),
      },
    });
  });
  await page.route("https://sheets.googleapis.com/v4/spreadsheets/sheet_e2e/values/**", async (route) => {
    const encodedRange = route.request().url().split("/values/")[1] ?? "";
    const range = decodeURIComponent(encodedRange);
    const sheetName = range.replace("!1:1", "") as keyof typeof requiredHeaderRows;

    await route.fulfill({
      json: {
        values: [requiredHeaderRows[sheetName] ?? []],
      },
    });
  });
  await page.goto("/");
});

test("tracks a monthly helper payout from setup through salary review", async ({
  page,
}) => {
  await expect(page.getByRole("heading", { name: "Salary" })).toBeVisible();

  await setPayMonth(page, "2026-08");
  await page.getByRole("button", { name: "Config" }).click();

  await page
    .getByLabel("OAuth Client ID")
    .fill("1234567890-e2e.apps.googleusercontent.com");
  await page.getByRole("button", { name: "Save OAuth ID" }).click();
  await page.getByLabel("Google Spreadsheet ID").fill("sheet_e2e");
  await page.getByRole("button", { name: "Connect sheet" }).click();
  await expect(page.getByText("Connected to sheet_e2e")).toBeVisible();
  await page.getByRole("button", { name: "Run health check" }).click();
  await expect(page.getByText("Schema healthy")).toBeVisible();

  await page.getByLabel("Monthly salary").fill("900");
  await page.getByLabel("Effective start date").fill("2026-01-01");
  await page.getByText("Advanced pay settings").click();
  await page.getByLabel("Pay date day").fill("26");
  await page.getByLabel("Salary notes").fill("Current contract");
  await page.getByRole("button", { name: "Save salary plan" }).click();
  await expect(page.getByText("SGD 900.00")).toBeVisible();
  await page.getByLabel("Holiday name").fill("National Day observed");
  await page.getByLabel("Holiday date").fill("2026-08-10");
  await page.getByRole("button", { name: "Add public holiday" }).click();
  await page.getByLabel("Holiday name").fill("National Day");
  await page.getByLabel("Holiday date").fill("2026-08-09");
  await page.getByRole("button", { name: "Add public holiday" }).click();

  await page.getByRole("button", { name: "Advances" }).click();
  await page.getByRole("button", { name: "Add advance" }).click();
  await page.getByLabel("Advance date").fill("2026-08-02");
  await page.getByLabel("Advance amount").fill("300");
  await page.getByLabel("Description").fill("School expense");
  await page.getByLabel("Deduction pay month 1").fill("2026-08");
  await page.getByLabel("Deduction amount 1").fill("100");
  await page.getByRole("button", { name: "Add deduction pay month" }).click();
  await page.getByLabel("Deduction pay month 2").fill("2026-09");
  await page.getByLabel("Deduction amount 2").fill("200");
  await page.getByRole("button", { name: "Save advance" }).click();
  await expect(page.getByRole("status")).toContainText("Advance saved.");
  await expect(
    page.getByText("Deducted in pay month 2026-08: SGD 100.00"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Time & Calendar" }).click();
  await page.getByRole("button", { name: "Add time" }).click();
  await page.getByLabel("Start date").fill("2026-08-09");
  await page.getByLabel("Worked").check();
  await page.getByLabel("Time notes").fill("Worked Sunday");
  await page.getByRole("button", { name: "Save day" }).click();
  await expect(summaryItem(page, "Worked Sundays")).toContainText("1");

  await page.getByRole("button", { name: "Add time" }).click();
  await page.getByLabel("Start date").fill("2026-08-10");
  await page.getByLabel("Worked").check();
  await page.getByRole("button", { name: "Save day" }).click();
  await expect(page.getByRole("status")).toContainText("No payroll change to save.");

  await page.getByLabel("Pay extra for PH work").check();
  await page.getByLabel("Time notes").fill("Paid extra for public holiday");
  await page.getByRole("button", { name: "Save day" }).click();
  await expect(page.getByLabel("Time records").getByText("Extra PH pay")).toBeVisible();

  const calendar = page.getByRole("list", { name: "Pay cycle calendar" });
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
  await expect(
    page.getByRole("heading", { name: "Salary plan history" }),
  ).not.toBeVisible();
  await expect(page.getByLabel("Total advance deducted this pay month")).toContainText(
    "SGD 100.00",
  );
  await expect(page.getByText("From School expense")).toBeVisible();
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
  await assertResponsiveShell(page, { width: 1280, height: 720 }, "desktop");
  await assertResponsiveShell(page, { width: 375, height: 812 }, "mobile");
});

function summaryItem(page: Page, label: string) {
  return page.locator(".summary-item").filter({ hasText: label });
}

async function setPayMonth(page: Page, month: string) {
  const mobileMonthButton = page.getByRole("button", {
    name: /Change pay month, current/,
  });

  if (await mobileMonthButton.isVisible()) {
    await mobileMonthButton.click();
    await page.getByLabel("Select pay month").fill(month);
    await page.getByRole("button", { name: "Apply month" }).click();
    await expect(
      page.getByRole("button", { name: `Change pay month, current ${month}` }),
    ).toBeVisible();
    return;
  }

  await page.getByRole("textbox", { name: "Pay month" }).fill(month);
}

const requiredSheets = [
  "Config",
  "Advances",
  "Advance_Deductions",
  "Time_Records",
  "Public_Holidays",
  "Monthly_Summary",
] as const;

const requiredHeaderRows: Record<(typeof requiredSheets)[number], string[]> = {
  Config: [
    "config_id",
    "monthly_salary",
    "effective_start_date",
    "ot_day_divisor",
    "pay_cycle_start_day",
    "default_sunday_off_policy",
    "default_sunday_off_count",
    "notes",
    "created_at",
  ],
  Advances: ["advance_id", "date", "amount", "description", "created_at"],
  Advance_Deductions: [
    "advance_deduction_id",
    "advance_id",
    "year_month",
    "amount",
    "notes",
    "created_at",
  ],
  Time_Records: [
    "time_record_id",
    "record_type",
    "start_date",
    "end_date",
    "quantity",
    "is_paid_off_day",
    "notes",
    "created_at",
  ],
  Public_Holidays: [
    "holiday_id",
    "holiday_name",
    "date",
    "year",
    "source",
    "notes",
    "created_at",
  ],
  Monthly_Summary: [
    "year_month",
    "base_salary",
    "sunday_ot_days",
    "public_holiday_work_days",
    "unpaid_off_days",
    "ot_day_rate",
    "sunday_ot_amount",
    "public_holiday_work_amount",
    "unpaid_off_day_deduction",
    "total_advance_deductions",
    "final_payout",
    "config_effective_start_date",
    "calculated_at",
  ],
};

async function assertResponsiveShell(
  page: Page,
  viewport: { width: number; height: number },
  expectedMode: "desktop" | "mobile",
) {
  await page.setViewportSize(viewport);
  await page.reload();
  await page.getByRole("button", { name: "Time & Calendar" }).click();

  const navPosition = await page.locator(".primary-nav").evaluate((element) =>
    getComputedStyle(element).position,
  );
  expect(navPosition).toBe(expectedMode === "desktop" ? "sticky" : "fixed");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  await expect(
    page.getByRole("heading", { name: "Time & Calendar" }),
  ).toBeVisible();

  const appHeaderVisible = await page
    .getByRole("heading", { name: "Domestic Helper Tracker" })
    .isVisible();
  const mobileMonthButton = page.getByRole("button", {
    name: /Change pay month, current/,
  });

  if (expectedMode === "mobile") {
    expect(appHeaderVisible).toBe(false);
    await expect(mobileMonthButton).toBeVisible();
    await expect(page.getByRole("button", { name: "Add time" })).toBeVisible();

    const floatingPositions = await page.evaluate(() => {
      const monthButton = document.querySelector(".mobile-month-fab");
      const addButton = document.querySelector(".mobile-floating-action");

      if (!monthButton || !addButton) {
        return null;
      }

      const monthStyle = getComputedStyle(monthButton);
      const addStyle = getComputedStyle(addButton);
      const monthRect = monthButton.getBoundingClientRect();
      const addRect = addButton.getBoundingClientRect();

      return {
        monthPosition: monthStyle.position,
        addPosition: addStyle.position,
        monthRightGap: Math.round(window.innerWidth - monthRect.right),
        addRightGap: Math.round(window.innerWidth - addRect.right),
        addAboveMonth: addRect.bottom <= monthRect.top,
      };
    });

    expect(floatingPositions).toEqual(
      expect.objectContaining({
        monthPosition: "fixed",
        addPosition: "fixed",
        monthRightGap: 16,
        addRightGap: 16,
        addAboveMonth: true,
      }),
    );
    return;
  }

  expect(appHeaderVisible).toBe(true);
  await expect(mobileMonthButton).not.toBeVisible();
}
