import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfigScreen } from "../../src/features/config/ConfigScreen";

describe("ConfigScreen", () => {
  it("creates a salary config and shows existing config history", async () => {
    const onAddSalaryConfig = vi.fn().mockResolvedValue(undefined);

    render(
      <ConfigScreen
        selectedMonth="2026-06"
        salaryConfigs={[
          {
            id: "cfg_existing",
            monthlySalary: 850,
            effectiveStartDate: "2026-01-01",
            otDayDivisor: 26,
            notes: "Existing",
            createdAt: "2026-06-27T12:00:00.000Z",
          },
        ]}
        onAddSalaryConfig={onAddSalaryConfig}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Salary plan" }));
    expect(screen.getByText("$850.00")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Add salary plan" }));
    const dialog = screen.getByRole("dialog", { name: "Add salary plan" });

    await userEvent.type(within(dialog).getByLabelText("Monthly salary"), "900");
    await userEvent.type(
      within(dialog).getByLabelText("Effective start date"),
      "2026-06-01",
    );
    await userEvent.clear(within(dialog).getByLabelText("OT day divisor"));
    await userEvent.type(within(dialog).getByLabelText("OT day divisor"), "26");
    await userEvent.clear(within(dialog).getByLabelText("Pay date day"));
    await userEvent.type(within(dialog).getByLabelText("Pay date day"), "26");
    await userEvent.type(within(dialog).getByLabelText("Salary notes"), "June salary");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add salary plan" }),
    );

    expect(onAddSalaryConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        monthlySalary: 900,
        effectiveStartDate: "2026-06-01",
        otDayDivisor: 26,
        payCycleStartDay: 26,
        defaultSundayOffPolicy: "ALL_SUNDAYS",
        defaultSundayOffCount: undefined,
        notes: "June salary",
      }),
    );
  });

  it("edits a salary config from history", async () => {
    const user = userEvent.setup();
    const onUpdateSalaryConfig = vi.fn().mockResolvedValue(undefined);

    render(
      <ConfigScreen
        selectedMonth="2026-06"
        salaryConfigs={[
          {
            id: "cfg_existing",
            monthlySalary: 850,
            effectiveStartDate: "2026-01-01",
            otDayDivisor: 26,
            payCycleStartDay: 1,
            notes: "Existing",
            createdAt: "2026-06-27T12:00:00.000Z",
          },
        ]}
        onAddSalaryConfig={vi.fn()}
        onUpdateSalaryConfig={onUpdateSalaryConfig}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Salary plan" }));
    await user.click(
      screen.getByRole("button", {
        name: "Edit salary plan effective 2026-01-01",
      }),
    );
    const dialog = screen.getByRole("dialog", { name: "Edit salary plan" });

    await user.clear(within(dialog).getByLabelText("Monthly salary"));
    await user.type(within(dialog).getByLabelText("Monthly salary"), "920");
    await user.clear(within(dialog).getByLabelText("Salary notes"));
    await user.type(within(dialog).getByLabelText("Salary notes"), "Updated plan");
    await user.click(
      within(dialog).getByRole("button", { name: "Save salary plan" }),
    );

    expect(onUpdateSalaryConfig).toHaveBeenCalledWith(
      "cfg_existing",
      expect.objectContaining({
        monthlySalary: 920,
        effectiveStartDate: "2026-01-01",
        otDayDivisor: 26,
        payCycleStartDay: 1,
        notes: "Updated plan",
      }),
    );
  });

  it("blocks invalid salary config input before saving", async () => {
    const onAddSalaryConfig = vi.fn();

    render(
      <ConfigScreen
        selectedMonth="2026-06"
        salaryConfigs={[]}
        onAddSalaryConfig={onAddSalaryConfig}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Salary plan" }));
    await userEvent.click(screen.getByRole("button", { name: "Add salary plan" }));
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Add salary plan" })).getByRole(
        "button",
        { name: "Add salary plan" },
      ),
    );

    expect(onAddSalaryConfig).not.toHaveBeenCalled();
    expect(screen.getByText("Monthly salary is required.")).toBeInTheDocument();
  });

  it("keeps salary form values visible when saving fails", async () => {
    const onAddSalaryConfig = vi
      .fn()
      .mockRejectedValue(new Error("Google Sheets write failed."));

    render(
      <ConfigScreen
        selectedMonth="2026-06"
        salaryConfigs={[]}
        onAddSalaryConfig={onAddSalaryConfig}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Salary plan" }));
    await userEvent.click(screen.getByRole("button", { name: "Add salary plan" }));
    const dialog = screen.getByRole("dialog", { name: "Add salary plan" });

    await userEvent.type(within(dialog).getByLabelText("Monthly salary"), "900");
    await userEvent.type(
      within(dialog).getByLabelText("Effective start date"),
      "2026-06-01",
    );
    await userEvent.type(within(dialog).getByLabelText("Salary notes"), "June salary");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add salary plan" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Google Sheets write failed.",
    );
    expect(within(dialog).getByLabelText("Monthly salary")).toHaveValue("900");
    expect(within(dialog).getByLabelText("Effective start date")).toHaveValue("2026-06-01");
    expect(within(dialog).getByLabelText("Salary notes")).toHaveValue("June salary");
  });

  it("connects sheet setup when spreadsheet handlers are provided", async () => {
    const onConnectSpreadsheet = vi.fn().mockResolvedValue(undefined);
    const onPickDriveSpreadsheet = vi.fn().mockResolvedValue(
      {
        id: "sheet_next",
        name: "Next helper tracker",
        webViewLink: "https://docs.google.com/spreadsheets/d/sheet_next/edit",
      },
    );

    render(
      <ConfigScreen
        selectedMonth="2026-06"
        spreadsheetId="sheet_existing"
        spreadsheetName="Existing helper tracker"
        spreadsheetUrl="https://docs.google.com/spreadsheets/d/sheet_existing/edit"
        salaryConfigs={[]}
        onAddSalaryConfig={vi.fn()}
        onConnectSpreadsheet={onConnectSpreadsheet}
        onCreateSpreadsheet={vi.fn().mockReturnValue({
          id: "sheet_created",
          name: "Created helper tracker",
        })}
        onPickDriveSpreadsheet={onPickDriveSpreadsheet}
      />,
    );

    expect(
      screen.getByRole("link", {
        name: "Existing helper tracker (sheet_existing)",
      }),
    ).toHaveAttribute(
      "href",
      "https://docs.google.com/spreadsheets/d/sheet_existing/edit",
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose from Drive" }));

    expect(onPickDriveSpreadsheet).toHaveBeenCalledTimes(1);
    expect(onConnectSpreadsheet).toHaveBeenCalledWith({
      id: "sheet_next",
      name: "Next helper tracker",
      webViewLink: "https://docs.google.com/spreadsheets/d/sheet_next/edit",
    });
  });

  it("imports and manages public holidays from config", async () => {
    const user = userEvent.setup();

    render(
      <ConfigScreen
        selectedMonth="2026-08"
        salaryConfigs={[]}
        publicHolidays={[]}
        onAddSalaryConfig={vi.fn()}
        onImportPublicHolidays={async (year) => [
          {
            id: "holiday_1",
            name: "National Day",
            date: "2026-08-09",
            year: 2026,
            source: "SINGAPORE_IMPORT",
            notes: "Sunday",
            createdAt: "2026-06-27T12:00:00.000Z",
          },
          {
            id: "holiday_2",
            name: `New Year's Day ${year + 1}`,
            date: `${year + 1}-01-01`,
            year: year + 1,
            source: "SINGAPORE_IMPORT",
            notes: "Thursday",
            createdAt: "2026-06-27T12:00:00.000Z",
          },
        ]}
        onAddPublicHoliday={async (holiday) => ({
          ...holiday,
          id: "manual_1",
          year: Number(holiday.date.slice(0, 4)),
          source: "MANUAL",
          createdAt: "2026-06-27T12:00:00.000Z",
        })}
        onDeletePublicHoliday={async () => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Public holidays" }));
    await user.click(
      screen.getByRole("button", { name: "Import 2026 and 2027 holidays" }),
    );
    expect((await screen.findAllByText("National Day")).length).toBeGreaterThan(0);
    expect(await screen.findByText("New Year's Day 2027")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add public holiday" }));
    let dialog = screen.getByRole("dialog", { name: "Add public holiday" });
    await user.type(within(dialog).getByLabelText("Holiday name"), "Family holiday");
    await user.type(within(dialog).getByLabelText("Holiday date"), "2026-08-17");
    await user.click(
      within(dialog).getByRole("button", { name: "Add public holiday" }),
    );
    expect((await screen.findAllByText("Family holiday")).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Edit Family holiday" }));
    dialog = screen.getByRole("dialog", { name: "Edit public holiday" });
    await user.clear(within(dialog).getByLabelText("Holiday name"));
    await user.type(
      within(dialog).getByLabelText("Holiday name"),
      "Family holiday updated",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Save public holiday" }),
    );
    expect(
      (await screen.findAllByText("Family holiday updated")).length,
    ).toBeGreaterThan(0);

    await user.click(
      screen.getByRole("button", { name: "Delete Family holiday updated" }),
    );
    expect(screen.queryByText("Family holiday updated")).not.toBeInTheDocument();
  });

  it("does not show Sunday rest-day configuration", () => {
    render(
      <ConfigScreen
        selectedMonth="2026-08"
        salaryConfigs={[]}
        publicHolidays={[]}
        onAddSalaryConfig={vi.fn()}
      />,
    );

    expect(screen.queryByText("Sunday rest days")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("4 Sundays")).not.toBeInTheDocument();
  });
});
