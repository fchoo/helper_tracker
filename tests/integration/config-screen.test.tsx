import { render, screen } from "@testing-library/react";
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

    expect(screen.getByText("SGD 850.00")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Monthly salary"), "900");
    await userEvent.type(screen.getByLabelText("Effective start date"), "2026-06-01");
    await userEvent.clear(screen.getByLabelText("OT day divisor"));
    await userEvent.type(screen.getByLabelText("OT day divisor"), "26");
    await userEvent.type(screen.getByLabelText("Salary notes"), "June salary");
    await userEvent.click(screen.getByRole("button", { name: "Save salary plan" }));

    expect(onAddSalaryConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        monthlySalary: 900,
        effectiveStartDate: "2026-06-01",
        otDayDivisor: 26,
        defaultSundayOffPolicy: "ALL_SUNDAYS",
        defaultSundayOffCount: undefined,
        notes: "June salary",
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

    await userEvent.click(screen.getByRole("button", { name: "Save salary plan" }));

    expect(onAddSalaryConfig).not.toHaveBeenCalled();
    expect(screen.getByText("Monthly salary is required.")).toBeInTheDocument();
  });

  it("connects sheet setup when spreadsheet handlers are provided", async () => {
    const onConnectSpreadsheet = vi.fn().mockResolvedValue(undefined);

    render(
      <ConfigScreen
        selectedMonth="2026-06"
        spreadsheetId="sheet_existing"
        salaryConfigs={[]}
        onAddSalaryConfig={vi.fn()}
        onConnectSpreadsheet={onConnectSpreadsheet}
        onCreateSpreadsheet={vi.fn()}
      />,
    );

    expect(screen.getByText("Connected to sheet_existing")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Google Spreadsheet ID"), "sheet_next");
    await userEvent.click(screen.getByRole("button", { name: "Connect sheet" }));

    expect(onConnectSpreadsheet).toHaveBeenCalledWith("sheet_next");
  });

  it("imports and manages public holidays from config", async () => {
    const user = userEvent.setup();

    render(
      <ConfigScreen
        selectedMonth="2026-08"
        salaryConfigs={[]}
        publicHolidays={[]}
        onAddSalaryConfig={vi.fn()}
        onImportPublicHolidays={async () => [
          {
            id: "holiday_1",
            name: "National Day",
            date: "2026-08-09",
            year: 2026,
            source: "SINGAPORE_IMPORT",
            notes: "Sunday",
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

    await user.click(screen.getByRole("button", { name: "Import 2026 holidays" }));
    expect((await screen.findAllByText("National Day")).length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText("Holiday name"), "Family holiday");
    await user.type(screen.getByLabelText("Holiday date"), "2026-08-17");
    await user.click(screen.getByRole("button", { name: "Add public holiday" }));
    expect((await screen.findAllByText("Family holiday")).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Edit Family holiday" }));
    await user.clear(screen.getByLabelText("Holiday name"));
    await user.type(screen.getByLabelText("Holiday name"), "Family holiday updated");
    await user.click(screen.getByRole("button", { name: "Save public holiday" }));
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
