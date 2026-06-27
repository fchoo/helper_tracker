import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SalaryScreen } from "../../src/features/salary/SalaryScreen";

const createdAt = "2026-06-27T12:00:00.000Z";

describe("SalaryScreen", () => {
  it("shows a monthly salary summary and related records", () => {
    render(
      <SalaryScreen
        selectedMonth="2026-06"
        salaryConfigs={[
          {
            id: "cfg_1",
            monthlySalary: 900,
            effectiveStartDate: "2026-01-01",
            otDayDivisor: 26,
            createdAt,
          },
        ]}
        advances={[
          {
            id: "adv_1",
            date: "2026-06-01",
            amount: 300,
            description: "Loan",
            createdAt,
          },
        ]}
        advanceDeductions={[
          {
            id: "ded_1",
            advanceId: "adv_1",
            month: "2026-06",
            amount: 100,
            createdAt,
          },
          {
            id: "ded_2",
            advanceId: "adv_1",
            month: "2026-07",
            amount: 200,
            createdAt,
          },
        ]}
        timeRecords={[
          {
            id: "time_1",
            type: "SUNDAY_OT",
            startDate: "2026-06-07",
            endDate: "2026-06-07",
            notes: "Worked Sunday",
            createdAt,
          },
        ]}
        publicHolidays={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Salary" })).toBeInTheDocument();
    expect(screen.getByText("Final payout")).toBeInTheDocument();
    expect(screen.getByText("SGD 834.62")).toBeInTheDocument();
    expect(screen.getByText("Sunday OT days")).toBeInTheDocument();
    expect(screen.getByText("Loan")).toBeInTheDocument();
    expect(screen.getByText("Worked Sunday")).toBeInTheDocument();
  });
});
