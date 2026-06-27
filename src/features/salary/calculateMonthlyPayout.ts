import type { Advance, AdvanceDeduction } from "../advances/types";
import {
  sumDeductionsForMonth,
  validateAdvanceDeductionTotals as validateScheduleTotals,
} from "../advances/advanceSchedule";
import type { SalaryConfig } from "../config/types";
import { countTimeRecordsForMonth } from "../time-records/timeRecordMath";
import type { MonthlyPayoutInput, MonthlySummary } from "./types";
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

  const config = selectEffectiveSalaryConfig(input.salaryConfigs, input.month);
  const baseSalary = config?.monthlySalary ?? 0;
  const otDayDivisor = config?.otDayDivisor ?? 26;
  const dailyRate = roundMoney(baseSalary / otDayDivisor);
  const counts = countTimeRecordsForMonth(input.timeRecords, input.month);
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
    baseSalary,
    dailyRate,
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
