import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import { GOOGLE_DRIVE_APPDATA_SCOPE } from "../../src/integrations/google/auth";

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
    const createSpreadsheet = vi.fn().mockResolvedValue({ spreadsheetId: "sheet_online" });
    const getSpreadsheet = vi.fn().mockResolvedValue({
      sheets: [
        { properties: { title: "Config", sheetId: 1 } },
        { properties: { title: "Advances", sheetId: 2 } },
        { properties: { title: "Advance_Deductions", sheetId: 3 } },
        { properties: { title: "Time_Records", sheetId: 4 } },
        { properties: { title: "Public_Holidays", sheetId: 5 } },
        { properties: { title: "Monthly_Summary", sheetId: 6 } },
      ],
    });
    const batchUpdate = vi.fn().mockResolvedValue({ replies: [] });
    const createGoogleSheetsClient = vi.fn().mockReturnValue({
      batchUpdate,
      createSpreadsheet,
      getSpreadsheet,
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

    expect(createGoogleTokenClient).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "1234567890-valid.apps.googleusercontent.com",
      }),
    );
    expect(requestToken).toHaveBeenCalledWith({ prompt: "consent" });
    expect(createGoogleSheetsClient).toHaveBeenCalledWith({
      accessToken: "token_123",
    });
    expect(createSpreadsheet).toHaveBeenCalledWith(
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
    expect(createSpreadsheet.mock.calls[0][0].sheets[0]).not.toHaveProperty("data");
    expect(getSpreadsheet).toHaveBeenCalledWith("sheet_online");
    expect(batchUpdate).toHaveBeenCalledWith(
      "sheet_online",
      expect.arrayContaining([
        expect.objectContaining({
          updateCells: expect.objectContaining({
            range: expect.objectContaining({ sheetId: 1 }),
          }),
        }),
      ]),
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
    const getSpreadsheet = vi.fn().mockResolvedValue({
      sheets: requiredSheets.map((title, index) => ({
        properties: { title, sheetId: index + 1 },
      })),
    });
    const getValues = vi.fn((_: string, range: string) => {
      const sheetName = range.replace("!1:1", "") as keyof typeof requiredHeaderRows;
      return Promise.resolve({ values: [requiredHeaderRows[sheetName]] });
    });
    const createGoogleSheetsClient = vi.fn().mockReturnValue({
      batchUpdate: vi.fn(),
      createSpreadsheet: vi.fn(),
      getSpreadsheet,
      getValues,
    });

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
    expect(getSpreadsheet).toHaveBeenCalledWith("sheet_online");
    expect(getValues).toHaveBeenCalledWith("sheet_online", "Config!1:1");
    expect(getValues).toHaveBeenCalledTimes(requiredSheets.length);
    expect(await screen.findByText("Schema healthy")).toBeInTheDocument();
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

    render(
      <App
        googleClientId="1234567890-valid.apps.googleusercontent.com"
        createGoogleTokenClient={createGoogleTokenClient}
        createGoogleDriveAppDataClient={createGoogleDriveAppDataClient}
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
      batchUpdate: vi.fn(),
      createSpreadsheet,
      getSpreadsheet: vi.fn(),
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
    const createSpreadsheet = vi.fn().mockResolvedValue({ spreadsheetId: "sheet_online" });
    const createGoogleSheetsClient = vi.fn().mockReturnValue({
      batchUpdate: vi.fn().mockResolvedValue({ replies: [] }),
      createSpreadsheet,
      getSpreadsheet: vi.fn().mockResolvedValue({
        sheets: [
          { properties: { title: "Config", sheetId: 1 } },
          { properties: { title: "Advances", sheetId: 2 } },
          { properties: { title: "Advance_Deductions", sheetId: 3 } },
          { properties: { title: "Time_Records", sheetId: 4 } },
          { properties: { title: "Public_Holidays", sheetId: 5 } },
          { properties: { title: "Monthly_Summary", sheetId: 6 } },
        ],
      }),
    });

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
});
