import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import {
  GOOGLE_APP_SCOPES,
  GOOGLE_DRIVE_APPDATA_SCOPE,
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
    expect(screen.getByLabelText("Selected month")).toBeInTheDocument();
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
    expect(screen.getByRole("heading", { name: "Configuration" })).toBeInTheDocument();
  });

  it("shares the selected month across screens", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.clear(screen.getByLabelText("Selected month"));
    await user.type(screen.getByLabelText("Selected month"), "2026-08");
    await user.click(screen.getByRole("button", { name: "Time & Calendar" }));

    expect(screen.getByText("2026-08")).toBeInTheDocument();
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
        scope: GOOGLE_APP_SCOPES,
      }),
    );
    expect(requestToken).toHaveBeenCalledWith({ prompt: "consent" });
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
    expect(await screen.findByText("Connected to sheet_online")).toBeInTheDocument();
  });

  it("checks the connected Google Sheet against live tabs and headers", async () => {
    localStorage.setItem(
      "helper-tracker:preferences",
      JSON.stringify({
        spreadsheetId: "sheet_online",
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
          "950",
          "2026-08-01",
          "26",
          "15",
          "ALL_SUNDAYS",
          "",
          "Loaded salary",
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
    await user.click(screen.getByRole("button", { name: "Run health check" }));

    expect(requestToken).toHaveBeenCalledWith({ prompt: "consent" });
    expect(sheetsClient.getSpreadsheet).toHaveBeenCalledWith("sheet_online");
    expect(sheetsClient.getValues).toHaveBeenCalledWith("sheet_online", "Config!1:1");
    expect(sheetsClient.getValues).toHaveBeenCalledWith("sheet_online", "Config!A:I");
    expect(await screen.findByText("Schema healthy")).toBeInTheDocument();
    expect(await screen.findByText("Loaded salary")).toBeInTheDocument();
  });

  it("stores and restores setup from Google account app data", async () => {
    const user = userEvent.setup();
    const requestToken = vi.fn().mockResolvedValue("token_123");
    const createGoogleTokenClient = vi.fn().mockReturnValue({ requestToken });
    const readJsonFile = vi.fn().mockResolvedValue({
      spreadsheetId: "sheet_from_account",
      selectedMonth: "2026-08",
      payCycleStartDay: 15,
      googleClientId: "should-not-persist.apps.googleusercontent.com",
    });
    const writeJsonFile = vi.fn().mockResolvedValue(undefined);
    const createGoogleDriveAppDataClient = vi.fn().mockReturnValue({
      readJsonFile,
      writeJsonFile,
    });
    const sheetsClient = createMockGoogleSheetsClient({
      "Config!A:I": [
        requiredHeaderRows.Config,
        [
          "cfg_from_account",
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
        createGoogleTokenClient={createGoogleTokenClient}
        createGoogleDriveAppDataClient={createGoogleDriveAppDataClient}
        createGoogleSheetsClient={createGoogleSheetsClient}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Config" }));
    await user.click(screen.getByRole("button", { name: "Restore setup" }));

    expect(createGoogleTokenClient).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "1234567890-valid.apps.googleusercontent.com",
        scope: GOOGLE_DRIVE_APPDATA_SCOPE,
      }),
    );
    expect(readJsonFile).toHaveBeenCalledWith("helper-tracker-preferences.json");
    expect(
      await screen.findByText("Connected to sheet_from_account"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Selected month")).toHaveValue("2026-08");
    expect(await screen.findByText("Restored salary")).toBeInTheDocument();
    expect(createGoogleTokenClient).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "1234567890-valid.apps.googleusercontent.com",
        scope: GOOGLE_SHEETS_SCOPE,
      }),
    );
    expect(sheetsClient.getValues).toHaveBeenCalledWith(
      "sheet_from_account",
      "Config!A:I",
    );

    await user.click(screen.getByRole("button", { name: "Save setup" }));

    expect(writeJsonFile).toHaveBeenCalledWith(
      "helper-tracker-preferences.json",
      {
        spreadsheetId: "sheet_from_account",
        selectedMonth: "2026-08",
        payCycleStartDay: 15,
      },
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
    expect(screen.queryByText(/Connected to local_c4495524/)).not.toBeInTheDocument();
  });

  it("lets the user add a browser-local OAuth client id before creating a sheet", async () => {
    const user = userEvent.setup();
    const requestToken = vi.fn().mockResolvedValue("token_123");
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

    expect(screen.getByRole("button", { name: "Create new sheet" })).toBeDisabled();

    await user.type(
      screen.getByLabelText("OAuth Client ID"),
      "1234567890-local.apps.googleusercontent.com",
    );
    await user.click(screen.getByRole("button", { name: "Save OAuth ID" }));
    await user.click(screen.getByRole("button", { name: "Create new sheet" }));

    expect(createGoogleTokenClient).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "1234567890-local.apps.googleusercontent.com",
      }),
    );
    expect(await screen.findByText("Connected to sheet_online")).toBeInTheDocument();
  });

  it("loads connected sheet records into every page after a health check", async () => {
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
          "1",
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
    await user.click(screen.getByRole("button", { name: "Run health check" }));

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
    await user.type(screen.getByLabelText("Monthly salary"), "900");
    await user.type(screen.getByLabelText("Effective start date"), "2026-08-01");
    await user.type(screen.getByLabelText("Salary notes"), "Saved salary");
    await user.click(screen.getByRole("button", { name: "Save salary plan" }));

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
    await user.type(screen.getByLabelText("Deduction month 1"), "2026-08");
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
    await user.type(screen.getByLabelText("Holiday name"), "Saved holiday");
    await user.type(screen.getByLabelText("Holiday date"), "2026-08-10");
    await user.click(screen.getByRole("button", { name: "Add public holiday" }));

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
});
