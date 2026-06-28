import { z } from "zod";
import { isIsoDate, isMonthKey } from "./dates";

const isoDateSchema = z.string().refine(isIsoDate, {
  message: "Date must use YYYY-MM-DD format.",
});

const isoDateTimeSchema = z.string().datetime();

const monthKeySchema = z.string().refine(isMonthKey, {
  message: "Month must use YYYY-MM format.",
});

const positiveMoneySchema = z.number().finite().positive();

const optionalTextSchema = z.string().optional();

export const salaryConfigSchema = z.object({
  id: z.string().min(1),
  monthlySalary: positiveMoneySchema,
  effectiveStartDate: isoDateSchema,
  otDayDivisor: z.number().int().positive(),
  defaultSundayOffPolicy: z.enum(["FIXED_COUNT", "ALL_SUNDAYS"]).optional(),
  defaultSundayOffCount: z.number().int().min(0).max(5).optional(),
  notes: optionalTextSchema,
  createdAt: isoDateTimeSchema,
});

export const advanceSchema = z.object({
  id: z.string().min(1),
  date: isoDateSchema,
  amount: positiveMoneySchema,
  description: optionalTextSchema,
  createdAt: isoDateTimeSchema,
});

export const advanceDeductionSchema = z.object({
  id: z.string().min(1),
  advanceId: z.string().min(1),
  month: monthKeySchema,
  amount: positiveMoneySchema,
  notes: optionalTextSchema,
  createdAt: isoDateTimeSchema,
});

export const timeRecordSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(["OFF_DAY", "SUNDAY_OT", "PUBLIC_HOLIDAY_WORK"]),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    isPaidOffDay: z.boolean().optional(),
    notes: optionalTextSchema,
    createdAt: isoDateTimeSchema,
  })
  .refine((record) => record.endDate >= record.startDate, {
    path: ["endDate"],
    message: "End date must be on or after start date.",
  });

export const publicHolidaySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  date: isoDateSchema,
  year: z.number().int().min(1900).max(2200),
  source: z.enum(["SINGAPORE_IMPORT", "MANUAL"]),
  notes: optionalTextSchema,
  createdAt: isoDateTimeSchema,
});

export type SalaryConfigInput = z.infer<typeof salaryConfigSchema>;
export type AdvanceInput = z.infer<typeof advanceSchema>;
export type AdvanceDeductionInput = z.infer<typeof advanceDeductionSchema>;
export type TimeRecordInput = z.infer<typeof timeRecordSchema>;
export type PublicHolidayInput = z.infer<typeof publicHolidaySchema>;
