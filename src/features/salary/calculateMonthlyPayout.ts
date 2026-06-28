import type { Advance, AdvanceDeduction } from "../advances/types";
import {
  sumDeductionsForMonth,
  validateAdvanceDeductionTotals as validateScheduleTotals,
} from "../advances/advanceSchedule";
import type { SalaryConfig } from "../config/types";
import { countTimeRecordsForDateRange } from "../time-records/timeRecordMath";
import type { MonthlyPayoutInput, MonthlySummary } from "./types";
import {
  type DateRange,
  getCycleDateRange,
  isMonthKey,
  parseValidatedIsoDate,
} from "../../lib/dates";
import { roundMoney } from "../../lib/money";

export function selectEffectiveSalaryConfig(
  configs: SalaryConfig[],
  month: string,
): SalaryConfig | undefined {
  const monthEnd = `${month}-31`;

  return configs
    .filter((config) => config.effectiveStartDate <= monthEnd)
    .sort((a, b) => b.effectiveStartDate.localeCompare(a.effectiveStartDate))[0];
}

export function validateAdvanceDeductionTotals(
  advances: Advance[],
  deductions: AdvanceDeduction[],
): void {
  validateScheduleTotals(advances, deductions);
}

export function calculateMonthlyPayout(
  input: MonthlyPayoutInput,
): MonthlySummary {
  validateAdvanceDeductionTotals(input.advances, input.advanceDeductions);

  if (!isMonthKey(input.month)) {
    return buildEmptyMonthlySummary(input.month);
  }

  const config = selectEffectiveSalaryConfig(input.salaryConfigs, input.month);
  const baseSalary = config?.monthlySalary ?? 0;
  const otDayDivisor = config?.otDayDivisor ?? 26;
  const payCycleStartDay =
    input.payCycleStartDay ?? config?.payCycleStartDay ?? 1;
  const payCycleRange = getCycleDateRange(input.month, payCycleStartDay);
  const payDate = getNextDay(payCycleRange.endDate);
  const dailyRate = roundMoney(baseSalary / otDayDivisor);
  const sundayCount = countSundaysInRange(payCycleRange);
  const defaultSundayOffDays = resolveDefaultSundayOffDays(config, sundayCount);
  const extraSundayCount = Math.max(0, sundayCount - defaultSundayOffDays);
  const counts = countTimeRecordsForDateRange(input.timeRecords, payCycleRange);
  const sundayOtAmount = roundMoney(counts.sundayOtDays * dailyRate);
  const publicHolidayWorkAmount = roundMoney(
    counts.publicHolidayWorkDays * dailyRate,
  );
  const unpaidOffDayDeduction = roundMoney(counts.unpaidOffDays * dailyRate);
  const totalAdvanceDeductions = sumDeductionsForMonth(
    input.advanceDeductions,
    input.month,
  );
  const finalPayout = roundMoney(
    baseSalary +
      sundayOtAmount +
      publicHolidayWorkAmount -
      unpaidOffDayDeduction -
      totalAdvanceDeductions,
  );

  return {
    month: input.month,
    payCycleStartDate: payCycleRange.startDate,
    payCycleEndDate: payCycleRange.endDate,
    payDate,
    payCycleStartDay,
    baseSalary,
    dailyRate,
    sundayCount,
    defaultSundayOffDays,
    extraSundayCount,
    sundayOtDays: counts.sundayOtDays,
    publicHolidayWorkDays: counts.publicHolidayWorkDays,
    unpaidOffDays: counts.unpaidOffDays,
    sundayOtAmount,
    publicHolidayWorkAmount,
    unpaidOffDayDeduction,
    totalAdvanceDeductions,
    finalPayout,
    configEffectiveStartDate: config?.effectiveStartDate,
    calculatedAt: new Date().toISOString(),
  };
}

function buildEmptyMonthlySummary(month: string): MonthlySummary {
  return {
    month,
    payCycleStartDate: "Select a month",
    payCycleEndDate: "Select a month",
    payDate: "Select a month",
    payCycleStartDay: 1,
    baseSalary: 0,
    dailyRate: 0,
    sundayCount: 0,
    defaultSundayOffDays: 0,
    extraSundayCount: 0,
    sundayOtDays: 0,
    publicHolidayWorkDays: 0,
    unpaidOffDays: 0,
    sundayOtAmount: 0,
    publicHolidayWorkAmount: 0,
    unpaidOffDayDeduction: 0,
    totalAdvanceDeductions: 0,
    finalPayout: 0,
    calculatedAt: new Date().toISOString(),
  };
}

function resolveDefaultSundayOffDays(
  _config: SalaryConfig | undefined,
  sundayCount: number,
): number {
  return sundayCount;
}

function countSundaysInRange(range: DateRange): number {
  const current = parseValidatedIsoDate(range.startDate);
  const end = parseValidatedIsoDate(range.endDate);
  let count = 0;

  while (current <= end) {
    if (current.getUTCDay() === 0) {
      count += 1;
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return count;
}

function getNextDay(date: string): string {
  const nextDate = parseValidatedIsoDate(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  return nextDate.toISOString().slice(0, 10);
}
