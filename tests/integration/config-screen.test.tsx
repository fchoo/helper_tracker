import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfigScreen } from "../../src/features/config/ConfigScreen";

describe("ConfigScreen", () => {
  it("creates a salary config and shows existing config history", async () => {
    const onAddSalaryConfig = vi.fn().mockResolvedValue(undefined);

    render(
      <ConfigScreen
        salaryConfigs={[
          {
            id: "cfg_existing",
            monthlySalary: 850,
            effectiveStartDate: "2026-01-01",
            otDayDivisor: 26,
            defaultSundayOffPolicy: "FIXED_COUNT",
            defaultSundayOffCount: 4,
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
    await userEvent.type(screen.getByLabelText("Notes"), "June salary");
    await userEvent.click(screen.getByRole("button", { name: "Save salary plan" }));

    expect(onAddSalaryConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        monthlySalary: 900,
        effectiveStartDate: "2026-06-01",
        otDayDivisor: 26,
        defaultSundayOffPolicy: "FIXED_COUNT",
        defaultSundayOffCount: 4,
        notes: "June salary",
      }),
    );
  });

  it("allows all Sundays off as the default monthly policy", async () => {
    const onAddSalaryConfig = vi.fn().mockResolvedValue(undefined);

    render(<ConfigScreen salaryConfigs={[]} onAddSalaryConfig={onAddSalaryConfig} />);

    await userEvent.type(screen.getByLabelText("Monthly salary"), "900");
    await userEvent.type(screen.getByLabelText("Effective start date"), "2026-06-01");
    await userEvent.click(screen.getByLabelText("All Sundays"));
    await userEvent.click(screen.getByRole("button", { name: "Save salary plan" }));

    expect(onAddSalaryConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultSundayOffPolicy: "ALL_SUNDAYS",
        defaultSundayOffCount: undefined,
      }),
    );
  });

  it("blocks invalid salary config input before saving", async () => {
    const onAddSalaryConfig = vi.fn();

    render(<ConfigScreen salaryConfigs={[]} onAddSalaryConfig={onAddSalaryConfig} />);

    await userEvent.click(screen.getByRole("button", { name: "Save salary plan" }));

    expect(onAddSalaryConfig).not.toHaveBeenCalled();
    expect(screen.getByText("Monthly salary is required.")).toBeInTheDocument();
  });

  it("connects sheet setup when spreadsheet handlers are provided", async () => {
    const onConnectSpreadsheet = vi.fn().mockResolvedValue(undefined);

    render(
      <ConfigScreen
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

  it("uses preset Sunday off choices for fixed five-Sunday months", async () => {
    const onAddSalaryConfig = vi.fn().mockResolvedValue(undefined);

    render(<ConfigScreen salaryConfigs={[]} onAddSalaryConfig={onAddSalaryConfig} />);

    await userEvent.type(screen.getByLabelText("Monthly salary"), "900");
    await userEvent.type(screen.getByLabelText("Effective start date"), "2026-06-01");
    await userEvent.click(screen.getByLabelText("5 Sundays"));
    await userEvent.click(screen.getByRole("button", { name: "Save salary plan" }));

    expect(onAddSalaryConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultSundayOffPolicy: "FIXED_COUNT",
        defaultSundayOffCount: 5,
      }),
    );
  });
});
