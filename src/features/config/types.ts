export type SundayOffPolicy = "FIXED_COUNT" | "ALL_SUNDAYS";

export type SalaryConfig = {
  id: string;
  monthlySalary: number;
  effectiveStartDate: string;
  otDayDivisor: number;
  defaultSundayOffPolicy?: SundayOffPolicy;
  defaultSundayOffCount?: number;
  notes?: string;
  createdAt: string;
};
