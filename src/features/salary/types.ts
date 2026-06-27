import type { Advance, AdvanceDeduction } from "../advances/types";
import type { PublicHoliday } from "../calendar/types";
import type { SalaryConfig } from "../config/types";
import type { TimeRecord } from "../time-records/types";

export type MonthlySummary = {
  month: string;
  baseSalary: number;
  dailyRate: number;
  sundayOtDays: number;
  publicHolidayWorkDays: number;
  unpaidOffDays: number;
  sundayOtAmount: number;
  publicHolidayWorkAmount: number;
  unpaidOffDayDeduction: number;
  totalAdvanceDeductions: number;
  finalPayout: number;
  configEffectiveStartDate?: string;
  calculatedAt: string;
};

export type MonthlyPayoutInput = {
  month: string;
  salaryConfigs: SalaryConfig[];
  advances: Advance[];
  advanceDeductions: AdvanceDeduction[];
  timeRecords: TimeRecord[];
  publicHolidays: PublicHoliday[];
};
