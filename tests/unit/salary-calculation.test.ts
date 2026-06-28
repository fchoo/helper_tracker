import { describe, expect, it } from "vitest";
import type { Advance, AdvanceDeduction } from "../../src/features/advances/types";
import type { SalaryConfig } from "../../src/features/config/types";
import type { TimeRecord } from "../../src/features/time-records/types";
import {
  calculateMonthlyPayout,
  selectEffectiveSalaryConfig,
  validateAdvanceDeductionTotals,
} from "../../src/features/salary/calculateMonthlyPayout";

const createdAt = "2026-06-27T12:00:00.000Z";

describe("selectEffectiveSalaryConfig", () => {
  it("selects the latest salary config effective on or before the month", () => {
    const configs: SalaryConfig[] = [
      config("cfg_1", 800, "2026-01-01"),
      config("cfg_2", 900, "2026-06-15"),
      config("cfg_3", 1000, "2026-08-01"),
    ];

    expect(selectEffectiveSalaryConfig(configs, "2026-07")?.id).toBe("cfg_2");
  });

  it("returns undefined when no salary config is effective yet", () => {
    expect(selectEffectiveSalaryConfig([config("cfg_1", 900, "2026-07-01")], "2026-06")).toBeUndefined();
  });
});

describe("validateAdvanceDeductionTotals", () => {
  it("accepts split deduction lines that sum to the parent advance", () => {
    expect(() =>
      validateAdvanceDeductionTotals(
        [advance("adv_1", 300)],
        [deduction("ded_1", "adv_1", "2026-06", 100), deduction("ded_2", "adv_1", "2026-07", 200)],
      ),
    ).not.toThrow();
  });

  it("rejects split deduction lines that do not sum to the parent advance", () => {
    expect(() =>
      validateAdvanceDeductionTotals(
        [advance("adv_1", 300)],
        [deduction("ded_1", "adv_1", "2026-06", 100)],
      ),
    ).toThrow("Advance deductions must sum to the advance amount.");
  });
});

describe("calculateMonthlyPayout", () => {
  it("calculates salary with Sunday OT, public holiday work, unpaid off days, and selected-month deductions", () => {
    const summary = calculateMonthlyPayout({
      month: "2026-06",
      salaryConfigs: [config("cfg_1", 900, "2026-01-01")],
      advances: [advance("adv_1", 300)],
      advanceDeductions: [
        deduction("ded_1", "adv_1", "2026-06", 100),
        deduction("ded_2", "adv_1", "2026-07", 200),
      ],
      timeRecords: [
        timeRecord("time_1", "SUNDAY_OT", "2026-06-07", "2026-06-07"),
        timeRecord("time_2", "PUBLIC_HOLIDAY_WORK", "2026-06-01", "2026-06-01"),
        timeRecord("time_3", "OFF_DAY", "2026-06-10", "2026-06-11", false),
      ],
      publicHolidays: [],
    });

    expect(summary).toMatchObject({
      month: "2026-06",
      baseSalary: 900,
      dailyRate: 34.62,
      sundayCount: 4,
      defaultSundayOffDays: 4,
      extraSundayCount: 0,
      sundayOtDays: 1,
      publicHolidayWorkDays: 1,
      unpaidOffDays: 2,
      sundayOtAmount: 34.62,
      publicHolidayWorkAmount: 34.62,
      unpaidOffDayDeduction: 69.24,
      totalAdvanceDeductions: 100,
      finalPayout: 800,
      configEffectiveStartDate: "2026-01-01",
    });
  });

  it("keeps default Sundays as rest-day context without reducing base salary", () => {
    const summary = calculateMonthlyPayout({
      month: "2026-06",
      salaryConfigs: [config("cfg_1", 900, "2026-01-01")],
      advances: [],
      advanceDeductions: [],
      timeRecords: [],
      publicHolidays: [],
    });

    expect(summary.unpaidOffDays).toBe(0);
    expect(summary.unpaidOffDayDeduction).toBe(0);
    expect(summary.finalPayout).toBe(900);
  });

  it("surfaces five-Sunday months when only four Sundays are default off days", () => {
    const summary = calculateMonthlyPayout({
      month: "2026-08",
      salaryConfigs: [config("cfg_1", 900, "2026-01-01")],
      advances: [],
      advanceDeductions: [],
      timeRecords: [],
      publicHolidays: [],
    });

    expect(summary.sundayCount).toBe(5);
    expect(summary.defaultSundayOffDays).toBe(4);
    expect(summary.extraSundayCount).toBe(1);
  });

  it("can treat all Sundays in the month as default off days", () => {
    const summary = calculateMonthlyPayout({
      month: "2026-08",
      salaryConfigs: [
        {
          ...config("cfg_1", 900, "2026-01-01"),
          defaultSundayOffPolicy: "ALL_SUNDAYS",
        },
      ],
      advances: [],
      advanceDeductions: [],
      timeRecords: [],
      publicHolidays: [],
    });

    expect(summary.sundayCount).toBe(5);
    expect(summary.defaultSundayOffDays).toBe(5);
    expect(summary.extraSundayCount).toBe(0);
  });

  it("counts only the portion of a time range that overlaps the selected month", () => {
    const summary = calculateMonthlyPayout({
      month: "2026-06",
      salaryConfigs: [config("cfg_1", 900, "2026-01-01")],
      advances: [],
      advanceDeductions: [],
      timeRecords: [timeRecord("time_1", "OFF_DAY", "2026-05-31", "2026-06-02", false)],
      publicHolidays: [],
    });

    expect(summary.unpaidOffDays).toBe(2);
    expect(summary.unpaidOffDayDeduction).toBe(69.24);
    expect(summary.finalPayout).toBe(830.76);
  });
});

function config(id: string, monthlySalary: number, effectiveStartDate: string): SalaryConfig {
  return {
    id,
    monthlySalary,
    effectiveStartDate,
    otDayDivisor: 26,
    createdAt,
  };
}

function advance(id: string, amount: number): Advance {
  return {
    id,
    date: "2026-06-01",
    amount,
    createdAt,
  };
}

function deduction(
  id: string,
  advanceId: string,
  month: string,
  amount: number,
): AdvanceDeduction {
  return {
    id,
    advanceId,
    month,
    amount,
    createdAt,
  };
}

function timeRecord(
  id: string,
  type: TimeRecord["type"],
  startDate: string,
  endDate: string,
  isPaidOffDay?: boolean,
): TimeRecord {
  return {
    id,
    type,
    startDate,
    endDate,
    isPaidOffDay,
    createdAt,
  };
}
