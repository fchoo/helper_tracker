import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import {
  GOOGLE_DRIVE_METADATA_SCOPE,
  GOOGLE_SHEETS_SCOPE,
} from "../../src/integrations/google/auth";

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

function createMockGoogleSheetsClient(
  values: Record<string, unknown[][]> = {},
) {
  const getValues = vi.fn((_: string, range: string) => {
    if (range in values) {
      return Promise.resolve({ values: values[range] });
    }

    if (range.endsWith("!1:1")) {
      const sheetName = range.replace("!1:1", "") as keyof typeof requiredHeaderRows;
      return Promise.resolve({ values: [requiredHeaderRows[sheetName]] });
    }

    const sheetName = range.split("!")[0] as keyof typeof requiredHeaderRows;
    return Promise.resolve({ values: [requiredHeaderRows[sheetName]] });
  });

  return {
    appendValues: vi.fn().mockResolvedValue({}),
    batchUpdate: vi.fn().mockResolvedValue({ replies: [] }),
    createSpreadsheet: vi.fn().mockResolvedValue({ spreadsheetId: "sheet_online" }),
    getSpreadsheet: vi.fn().mockResolvedValue({
      sheets: requiredSheets.map((title, index) => ({
        properties: { title, sheetId: index + 1 },
      })),
    }),
    getValues,
    updateValues: vi.fn().mockResolvedValue({}),
  };
}

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the application shell and default salary screen", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Domestic Helper Tracker" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Salary" })).toBeInTheDocument();
    expect(screen.getByLabelText("Pay month")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
  });

  it("navigates between feature screens", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Advances" }));
    expect(screen.getByRole("heading", { name: "Advances" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Time & Calendar" }));
    expect(
      screen.getByRole("heading", { name: "Time & Calendar" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Config" }));
    expect(
      screen.getByRole("navigation", { name: "Configuration pages" }),
    ).toBeInTheDocument();
  });

  it("shares the pay month across screens", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.clear(screen.getByLabelText("Pay month"));
    await user.type(screen.getByLabelText("Pay month"), "2026-08");
    await user.click(screen.getByRole("button", { name: "Time & Calendar" }));

    expect(screen.getByText("Pay month 2026-08")).toBeInTheDocument();
  });

  it("changes the pay month from the mobile month action", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(
      screen.getByRole("button", { name: /Change pay month, current/ }),
    );
    expect(
      screen.getByRole("dialog", { name: "Change pay month" }),
    ).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Select pay month"));
    await user.type(screen.getByLabelText("Select pay month"), "2026-08");
    await user.click(screen.getByRole("button", { name: "Apply month" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Pay month 2026-08")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Change pay month, current 2026-08" }),
    ).toBeInTheDocument();
  });

  it("creates an online Google Sheet through OAuth and connects the returned spreadsheet id", async () => {
    const user = userEvent.setup();
    const requestToken = vi.fn().mockResolvedValue("token_123");
    const createGoogleTokenClient = vi.fn().mockReturnValue({ requestToken });
    const sheetsClient = createMockGoogleSheetsClient();
    const createGoogleSheetsClient = vi.fn().mockReturnValue(sheetsClient);

    render(
      <App
        googleClientId="1234567890-valid.apps.googleusercontent.com"
        createGoogleTokenClient={createGoogleTokenClient}
        createGoogleSheetsClient={createGoogleSheetsClient}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Config" }));
    await user.click(screen.getByRole("button", { name: "Create new sheet" }));

    expect(createGoogleTokenClient).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "1234567890-valid.apps.googleusercontent.com",
        scope: GOOGLE_SHEETS_SCOPE,
      }),
    );
    expect(requestToken).toHaveBeenCalledWith({ prompt: "" });
    expect(createGoogleSheetsClient).toHaveBeenCalledWith({
      accessToken: "token_123",
    });
    expect(sheetsClient.createSpreadsheet).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({
          title: expect.stringContaining("Domestic Helper Tracker"),
        }),
        sheets: expect.arrayContaining([
          expect.objectContaining({
            properties: expect.objectContaining({ title: "Config" }),
          }),
        ]),
      }),
    );
    expect(sheetsClient.createSpreadsheet.mock.calls[0][0].sheets[0]).not.toHaveProperty("data");
    expect(sheetsClient.getSpreadsheet).toHaveBeenCalledWith("sheet_online");
    expect(sheetsClient.batchUpdate).toHaveBeenCalledWith(
      "sheet_online",
      expect.arrayContaining([
        expect.objectContaining({
          updateCells: expect.objectContaining({
            range: expect.objectContaining({ sheetId: 1 }),
          }),
        }),
      ]),
    );
    expect(sheetsClient.getValues).toHaveBeenCalledWith("sheet_online", "Config!A:I");
    expect(sheetsClient.getValues).toHaveBeenCalledWith(
      "sheet_online",
      "Public_Holidays!A:G",
    );
    expect(
      await screen.findByRole("link", {
        name: /Domestic Helper Tracker .* \(sheet_online\)/,
      }),
    ).toBeInTheDocument();
  });

  it("loads cached connected sheet records without starting OAuth on page load", async () => {
    localStorage.setItem(
      "helper-tracker:preferences",
      JSON.stringify({
        spreadsheetId: "sheet_online",
      }),
    );
    localStorage.setItem(
      "helper-tracker:sheet-records",
      JSON.stringify({
        sheet_online: {
          salaryConfigs: [
            {
              id: "cfg_loaded",
              monthlySalary: 950,
              effectiveStartDate: "2026-08-01",
              otDayDivisor: 26,
              payCycleStartDay: 15,
              defaultSundayOffPolicy: "ALL_SUNDAYS",
              notes: "Loaded salary",
              createdAt: "2026-06-28T12:00:00.000Z",
            },
          ],
          advances: [],
          advanceDeductions: [],
          timeRecords: [],
          publicHolidays: [],
        },
      }),
    );
    const user = userEvent.setup();
    const requestToken = vi.fn();
    const createGoogleTokenClient = vi.fn().mockReturnValue({ requestToken });
    const sheetsClient = createMockGoogleSheetsClient();
    const createGoogleSheetsClient = vi.fn().mockReturnValue(sheetsClient);

    render(
      <App
        googleClientId="1234567890-valid.apps.googleusercontent.com"
        createGoogleTokenClient={createGoogleTokenClient}
        createGoogleSheetsClient={createGoogleSheetsClient}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Config" }));
    await user.click(screen.getByRole("button", { name: "Salary plan" }));

    expect(await screen.findByText("Loaded salary")).toBeInTheDocument();
    expect(createGoogleTokenClient).not.toHaveBeenCalled();
    expect(requestToken).not.toHaveBeenCalled();
    expect(sheetsClient.getValues).not.toHaveBeenCalled();
  });

  it("selects a Google Sheet from Drive and stores the connection locally", async () => {
    const user = userEvent.setup();
    const requestToken = vi.fn().mockResolvedValue("token_123");
    const createGoogleTokenClient = vi.fn().mockReturnValue({ requestToken });
    const pickGoogleSpreadsheet = vi.fn().mockResolvedValue(
      {
        id: "sheet_from_drive",
        name: "Domestic Helper Tracker",
        webViewLink: "https://docs.google.com/spreadsheets/d/sheet_from_drive/edit",
      },
    );
    const sheetsClient = createMockGoogleSheetsClient({
      "Config!A:I": [
        requiredHeaderRows.Config,
        [
          "cfg_from_drive",
          "880",
          "2026-01-01",
          "26",
          "15",
          "ALL_SUNDAYS",
          "",
          "Restored salary",
          "2026-06-28T12:00:00.000Z",
        ],
      ],
    });
    const createGoogleSheetsClient = vi.fn().mockReturnValue(sheetsClient);

    render(
      <App
        googleClientId="1234567890-valid.apps.googleusercontent.com"
        googlePickerDeveloperKey="picker_key"
        googlePickerAppId="1234567890"
        createGoogleTokenClient={createGoogleTokenClient}
        pickGoogleSpreadsheet={pickGoogleSpreadsheet}
        createGoogleSheetsClient={createGoogleSheetsClient}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Config" }));
    await user.click(screen.getByRole("button", { name: "Choose from Drive" }));

    expect(createGoogleTokenClient).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "1234567890-valid.apps.googleusercontent.com",
        scope: GOOGLE_DRIVE_METADATA_SCOPE,
      }),
    );
    expect(pickGoogleSpreadsheet).toHaveBeenCalledWith({
      accessToken: "token_123",
      appId: "1234567890",
      developerKey: "picker_key",
    });
    expect(
      await screen.findByRole("link", {
        name: "Domestic Helper Tracker (sheet_from_drive)",
      }),
    ).toHaveAttribute("href", "https://docs.google.com/spreadsheets/d/sheet_from_drive/edit");
    await user.click(screen.getByRole("button", { name: "Salary plan" }));
    expect(await screen.findByText("Restored salary")).toBeInTheDocument();
    expect(createGoogleTokenClient).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "1234567890-valid.apps.googleusercontent.com",
        scope: GOOGLE_SHEETS_SCOPE,
      }),
    );
    expect(sheetsClient.getValues).toHaveBeenCalledWith(
      "sheet_from_drive",
      "Config!A:I",
    );
    expect(
      JSON.parse(localStorage.getItem("helper-tracker:preferences") ?? "{}"),
    ).toEqual(
      expect.objectContaining({
        spreadsheetId: "sheet_from_drive",
        spreadsheetName: "Domestic Helper Tracker",
        spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet_from_drive/edit",
        payCycleStartDay: 15,
      }),
    );
  });

  it("does not connect legacy local ids returned by stale creation code", async () => {
    const user = userEvent.setup();
    const requestToken = vi.fn().mockResolvedValue("token_123");
    const createGoogleTokenClient = vi.fn().mockReturnValue({ requestToken });
    const createSpreadsheet = vi.fn().mockResolvedValue({
      spreadsheetId: "local_c4495524-5185-423e-92ac-62ddb0a5f275",
    });
    const createGoogleSheetsClient = vi.fn().mockReturnValue({
      appendValues: vi.fn(),
      batchUpdate: vi.fn(),
      createSpreadsheet,
      getSpreadsheet: vi.fn(),
      getValues: vi.fn(),
      updateValues: vi.fn(),
    });

    render(
      <App
        googleClientId="1234567890-valid.apps.googleusercontent.com"
        createGoogleTokenClient={createGoogleTokenClient}
        createGoogleSheetsClient={createGoogleSheetsClient}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Config" }));
    await user.click(screen.getByRole("button", { name: "Create new sheet" }));

    expect(
      await screen.findByText("Google Sheets did not return a spreadsheet ID."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/local_c4495524/)).not.toBeInTheDocument();
  });

  it("hides browser-local OAuth setup and blocks sheet actions when deployment config is missing", async () => {
    const user = userEvent.setup();
    const requestToken = vi.fn();
    const createGoogleTokenClient = vi.fn().mockReturnValue({ requestToken });
    const sheetsClient = createMockGoogleSheetsClient();
    const createGoogleSheetsClient = vi.fn().mockReturnValue(sheetsClient);

    render(
      <App
        createGoogleTokenClient={createGoogleTokenClient}
        createGoogleSheetsClient={createGoogleSheetsClient}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Config" }));

    expect(screen.queryByLabelText("OAuth Client ID")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create new sheet" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Choose from Drive" })).toBeDisabled();
    expect(createGoogleTokenClient).not.toHaveBeenCalled();
  });

  it("syncs connected sheet records into every page from the config action", async () => {
    localStorage.setItem(
      "helper-tracker:preferences",
      JSON.stringify({
        spreadsheetId: "sheet_online",
        selectedMonth: "2026-08",
      }),
    );
    const user = userEvent.setup();
    const requestToken = vi.fn().mockResolvedValue("token_123");
    const createGoogleTokenClient = vi.fn().mockReturnValue({ requestToken });
    const sheetsClient = createMockGoogleSheetsClient({
      "Config!A:I": [
        requiredHeaderRows.Config,
        [
          "cfg_loaded",
          "920",
          "2026-01-01",
          "26",
          "26",
          "ALL_SUNDAYS",
          "",
          "Loaded plan",
          "2026-06-28T12:00:00.000Z",
        ],
      ],
      "Advances!A:E": [
        requiredHeaderRows.Advances,
        [
          "adv_loaded",
          "2026-08-01",
          "300",
          "Loaded advance",
          "2026-06-28T12:00:00.000Z",
        ],
      ],
      "Advance_Deductions!A:F": [
        requiredHeaderRows.Advance_Deductions,
        [
          "ded_loaded",
          "adv_loaded",
          "2026-08",
          "300",
          "Loaded deduction",
          "2026-06-28T12:00:00.000Z",
        ],
      ],
      "Time_Records!A:H": [
        requiredHeaderRows.Time_Records,
        [
          "time_loaded",
          "SUNDAY_OT",
          "2026-08-09",
          "2026-08-09",
          "1",
          "",
          "Loaded time",
          "2026-06-28T12:00:00.000Z",
        ],
      ],
      "Public_Holidays!A:G": [
        requiredHeaderRows.Public_Holidays,
        [
          "holiday_loaded",
          "Loaded holiday",
          "2026-08-10",
          "2026",
          "MANUAL",
          "Observed",
          "2026-06-28T12:00:00.000Z",
        ],
      ],
    });
    const createGoogleSheetsClient = vi.fn().mockReturnValue(sheetsClient);

    render(
      <App
        googleClientId="1234567890-valid.apps.googleusercontent.com"
        createGoogleTokenClient={createGoogleTokenClient}
        createGoogleSheetsClient={createGoogleSheetsClient}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Config" }));
    await user.click(screen.getByRole("button", { name: "Sync from sheet" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Google Sheet synced.",
    );
    await user.click(screen.getByRole("button", { name: "Salary plan" }));

    expect(requestToken).toHaveBeenCalledWith({ prompt: "" });
    expect(await screen.findByText("Loaded plan")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Advances" }));
    expect(screen.getByText("Loaded advance")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Time & Calendar" }));
    expect(screen.getByText("Loaded time")).toBeInTheDocument();
    expect(screen.getByText("Loaded holiday")).toBeInTheDocument();
  });

  it("saves salary plans, advances, time records, and holidays to the connected sheet", async () => {
    localStorage.setItem(
      "helper-tracker:preferences",
      JSON.stringify({
        spreadsheetId: "sheet_online",
        selectedMonth: "2026-08",
      }),
    );
    const user = userEvent.setup();
    const requestToken = vi.fn().mockResolvedValue("token_123");
    const createGoogleTokenClient = vi.fn().mockReturnValue({ requestToken });
    const sheetsClient = createMockGoogleSheetsClient();
    const createGoogleSheetsClient = vi.fn().mockReturnValue(sheetsClient);

    render(
      <App
        googleClientId="1234567890-valid.apps.googleusercontent.com"
        createGoogleTokenClient={createGoogleTokenClient}
        createGoogleSheetsClient={createGoogleSheetsClient}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Config" }));
    await user.click(screen.getByRole("button", { name: "Salary plan" }));
    await user.click(screen.getByRole("button", { name: "Add salary plan" }));
    let dialog = screen.getByRole("dialog", { name: "Add salary plan" });
    await user.type(within(dialog).getByLabelText("Monthly salary"), "900");
    await user.type(
      within(dialog).getByLabelText("Effective start date"),
      "2026-08-01",
    );
    await user.type(within(dialog).getByLabelText("Salary notes"), "Saved salary");
    await user.click(
      within(dialog).getByRole("button", { name: "Add salary plan" }),
    );

    expect(sheetsClient.appendValues).toHaveBeenCalledWith(
      "sheet_online",
      "Config!A:I",
      [
        expect.arrayContaining([
          expect.stringMatching(/^cfg_/),
          900,
          "2026-08-01",
          26,
          1,
          "ALL_SUNDAYS",
          "",
          "Saved salary",
        ]),
      ],
    );

    await user.click(screen.getByRole("button", { name: "Advances" }));
    await user.click(screen.getByRole("button", { name: "Add advance" }));
    await user.type(screen.getByLabelText("Advance date"), "2026-08-01");
    await user.type(screen.getByLabelText("Advance amount"), "200");
    await user.type(screen.getByLabelText("Description"), "Saved advance");
    await user.type(screen.getByLabelText("Deduction pay month 1"), "2026-08");
    await user.type(screen.getByLabelText("Deduction amount 1"), "200");
    await user.click(screen.getByRole("button", { name: "Save advance" }));

    expect(sheetsClient.appendValues).toHaveBeenCalledWith(
      "sheet_online",
      "Advances!A:E",
      [
        expect.arrayContaining([
          expect.stringMatching(/^adv_/),
          "2026-08-01",
          200,
          "Saved advance",
        ]),
      ],
    );
    expect(sheetsClient.appendValues).toHaveBeenCalledWith(
      "sheet_online",
      "Advance_Deductions!A:F",
      [
        expect.arrayContaining([
          expect.stringMatching(/^ded_/),
          expect.stringMatching(/^adv_/),
          "2026-08",
          200,
        ]),
      ],
    );

    await user.click(screen.getByRole("button", { name: "Time & Calendar" }));
    await user.click(screen.getByRole("button", { name: "Add time" }));
    await user.type(screen.getByLabelText("Start date"), "2026-08-09");
    await user.click(screen.getByRole("button", { name: "Save day" }));

    expect(sheetsClient.appendValues).toHaveBeenCalledWith(
      "sheet_online",
      "Time_Records!A:H",
      [
        expect.arrayContaining([
          expect.stringMatching(/^time_/),
          "SUNDAY_OT",
          "2026-08-09",
          "2026-08-09",
          1,
        ]),
      ],
    );

    await user.click(screen.getByRole("button", { name: "Config" }));
    await user.click(screen.getByRole("button", { name: "Public holidays" }));
    await user.click(screen.getByRole("button", { name: "Add public holiday" }));
    dialog = screen.getByRole("dialog", { name: "Add public holiday" });
    await user.type(within(dialog).getByLabelText("Holiday name"), "Saved holiday");
    await user.type(within(dialog).getByLabelText("Holiday date"), "2026-08-10");
    await user.click(
      within(dialog).getByRole("button", { name: "Add public holiday" }),
    );

    expect(sheetsClient.appendValues).toHaveBeenCalledWith(
      "sheet_online",
      "Public_Holidays!A:G",
      [
        expect.arrayContaining([
          expect.stringMatching(/^holiday_/),
          "Saved holiday",
          "2026-08-10",
          2026,
          "MANUAL",
        ]),
      ],
    );
  });

  it("tries silent Google Sheets auth before opening consent for a user save", async () => {
    localStorage.setItem(
      "helper-tracker:preferences",
      JSON.stringify({
        spreadsheetId: "sheet_online",
        selectedMonth: "2026-08",
      }),
    );
    const user = userEvent.setup();
    const requestToken = vi
      .fn()
      .mockRejectedValueOnce(new Error("Google sign-in could not finish. Try again."))
      .mockResolvedValueOnce("token_123");
    const createGoogleTokenClient = vi.fn().mockReturnValue({ requestToken });
    const sheetsClient = createMockGoogleSheetsClient();
    const createGoogleSheetsClient = vi.fn().mockReturnValue(sheetsClient);

    render(
      <App
        googleClientId="1234567890-valid.apps.googleusercontent.com"
        createGoogleTokenClient={createGoogleTokenClient}
        createGoogleSheetsClient={createGoogleSheetsClient}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Config" }));
    await user.click(screen.getByRole("button", { name: "Salary plan" }));
    await user.click(screen.getByRole("button", { name: "Add salary plan" }));
    const dialog = screen.getByRole("dialog", { name: "Add salary plan" });
    await user.type(within(dialog).getByLabelText("Monthly salary"), "900");
    await user.type(
      within(dialog).getByLabelText("Effective start date"),
      "2026-08-01",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Add salary plan" }),
    );

    expect(requestToken).toHaveBeenNthCalledWith(1, { prompt: "" });
    expect(requestToken).toHaveBeenNthCalledWith(2, { prompt: "consent" });
    expect(createGoogleSheetsClient).toHaveBeenLastCalledWith({
      accessToken: "token_123",
    });
    expect(sheetsClient.appendValues).toHaveBeenCalledWith(
      "sheet_online",
      "Config!A:I",
      [
        expect.arrayContaining([
          expect.stringMatching(/^cfg_/),
          900,
          "2026-08-01",
        ]),
      ],
    );
  });

  it("keeps last synced records visible after reload without starting OAuth", async () => {
    localStorage.setItem(
      "helper-tracker:preferences",
      JSON.stringify({
        spreadsheetId: "sheet_online",
        selectedMonth: "2026-08",
      }),
    );
    const user = userEvent.setup();
    const requestToken = vi.fn().mockResolvedValueOnce("token_123");
    const createGoogleTokenClient = vi.fn().mockReturnValue({ requestToken });
    const sheetsClient = createMockGoogleSheetsClient();
    const createGoogleSheetsClient = vi.fn().mockReturnValue(sheetsClient);

    render(
      <App
        googleClientId="1234567890-valid.apps.googleusercontent.com"
        createGoogleTokenClient={createGoogleTokenClient}
        createGoogleSheetsClient={createGoogleSheetsClient}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Config" }));
    await user.click(screen.getByRole("button", { name: "Salary plan" }));
    await user.click(screen.getByRole("button", { name: "Add salary plan" }));
    const dialog = screen.getByRole("dialog", { name: "Add salary plan" });
    await user.type(within(dialog).getByLabelText("Monthly salary"), "900");
    await user.type(
      within(dialog).getByLabelText("Effective start date"),
      "2026-08-01",
    );
    await user.type(within(dialog).getByLabelText("Salary notes"), "Refresh salary");
    await user.click(
      within(dialog).getByRole("button", { name: "Add salary plan" }),
    );
    expect(await screen.findByText("Refresh salary")).toBeInTheDocument();

    cleanup();
    createGoogleTokenClient.mockClear();
    render(
      <App
        googleClientId="1234567890-valid.apps.googleusercontent.com"
        createGoogleTokenClient={createGoogleTokenClient}
        createGoogleSheetsClient={createGoogleSheetsClient}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Config" }));
    await user.click(screen.getByRole("button", { name: "Salary plan" }));

    expect(await screen.findByText("Refresh salary")).toBeInTheDocument();
    expect(createGoogleTokenClient).not.toHaveBeenCalled();
    expect(requestToken).toHaveBeenCalledTimes(1);
  });

  it("syncs connected sheet records from Google Sheets after a browser refresh", async () => {
    localStorage.setItem(
      "helper-tracker:preferences",
      JSON.stringify({
        spreadsheetId: "sheet_online",
        selectedMonth: "2026-08",
      }),
    );
    localStorage.setItem(
      "helper-tracker:sheet-records",
      JSON.stringify({
        sheet_online: {
          salaryConfigs: [
            {
              id: "cfg_stale",
              monthlySalary: 800,
              effectiveStartDate: "2026-01-01",
              otDayDivisor: 26,
              notes: "Stale cached salary",
              createdAt: "2026-06-27T12:00:00.000Z",
            },
          ],
          advances: [],
          advanceDeductions: [],
          timeRecords: [],
          publicHolidays: [],
        },
      }),
    );
    const requestToken = vi.fn().mockResolvedValue("token_123");
    const createGoogleTokenClient = vi.fn().mockReturnValue({ requestToken });
    const sheetsClient = createMockGoogleSheetsClient({
      "Config!A:I": [
        requiredHeaderRows.Config,
        [
          "cfg_fresh",
          "940",
          "2026-08-01",
          "26",
          "1",
          "ALL_SUNDAYS",
          "",
          "Fresh sheet salary",
          "2026-06-28T12:00:00.000Z",
        ],
      ],
    });
    const createGoogleSheetsClient = vi.fn().mockReturnValue(sheetsClient);

    render(
      <App
        googleClientId="1234567890-valid.apps.googleusercontent.com"
        createGoogleTokenClient={createGoogleTokenClient}
        createGoogleSheetsClient={createGoogleSheetsClient}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Config" }));
    await userEvent.click(screen.getByRole("button", { name: "Salary plan" }));
    expect(screen.getByText("Stale cached salary")).toBeInTheDocument();
    expect(requestToken).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Google Sheet" }));
    await userEvent.click(screen.getByRole("button", { name: "Sync from sheet" }));
    await userEvent.click(screen.getByRole("button", { name: "Salary plan" }));

    expect(await screen.findByText("Fresh sheet salary")).toBeInTheDocument();
    expect(screen.queryByText("Stale cached salary")).not.toBeInTheDocument();
    expect(requestToken).toHaveBeenCalledWith({ prompt: "" });
    expect(sheetsClient.getValues).toHaveBeenCalledWith("sheet_online", "Config!A:I");
  });
});
