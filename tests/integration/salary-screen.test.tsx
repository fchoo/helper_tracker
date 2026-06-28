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
          {
            id: "cfg_2",
            monthlySalary: 980,
            effectiveStartDate: "2026-09-01",
            otDayDivisor: 26,
            defaultSundayOffPolicy: "ALL_SUNDAYS",
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
            startDate: "2026-05-03",
            endDate: "2026-05-03",
            notes: "Worked Sunday",
            createdAt,
          },
          {
            id: "time_2",
            type: "OFF_DAY",
            startDate: "2026-05-30",
            endDate: "2026-06-02",
            isPaidOffDay: false,
            notes: "Overlapping off day",
            createdAt,
          },
        ]}
        publicHolidays={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Salary" })).toBeInTheDocument();
    expect(screen.getByText("Final payout")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Salary plan history" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
    expect(screen.queryByText("Salary version")).not.toBeInTheDocument();
    expect(screen.queryByText("Sunday rest days")).not.toBeInTheDocument();
    expect(screen.getAllByText("SGD 765.38").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Worked Sundays").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Total advance deducted this pay month")).toHaveTextContent("SGD 100.00");
    expect(screen.getByText("From Loan")).toBeInTheDocument();
    expect(
      screen.getByText("Advance given 2026-06-01, original SGD 300.00"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Worked Sunday").length).toBeGreaterThan(0);
    expect(screen.getByText("Overlapping off day")).toBeInTheDocument();
  });

  it("shows the configured pay cycle range and pay date", () => {
    render(
      <SalaryScreen
        selectedMonth="2026-06"
        salaryConfigs={[
          {
            id: "cfg_1",
            monthlySalary: 900,
            effectiveStartDate: "2026-01-01",
            otDayDivisor: 26,
            payCycleStartDay: 26,
            createdAt,
          },
        ]}
        advances={[]}
        advanceDeductions={[]}
        timeRecords={[
          {
            id: "time_1",
            type: "SUNDAY_OT",
            startDate: "2026-06-07",
            endDate: "2026-06-07",
            notes: "Inside configured cycle",
            createdAt,
          },
        ]}
        publicHolidays={[]}
      />,
    );

    expect(screen.getByText("Pay month 2026-06")).toBeInTheDocument();
    expect(screen.getByText("2026-05-26 to 2026-06-25")).toBeInTheDocument();
    expect(screen.getByText("2026-06-26")).toBeInTheDocument();
    expect(screen.getByText("Inside configured cycle")).toBeInTheDocument();
  });
});
