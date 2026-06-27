import type { Advance, AdvanceDeduction } from "./types";
import { roundMoney } from "../../lib/money";
import { isMonthKey } from "../../lib/dates";

export type ParsedAdvanceDeduction = {
  month: string;
  amount: number;
  notes: string;
};

export function validateAdvanceDeductionTotals(
  advances: Advance[],
  deductions: AdvanceDeduction[],
): void {
  const deductionTotals = new Map<string, number>();

  for (const deduction of deductions) {
    deductionTotals.set(
      deduction.advanceId,
      roundMoney((deductionTotals.get(deduction.advanceId) ?? 0) + deduction.amount),
    );
  }

  for (const advance of advances) {
    const total = deductionTotals.get(advance.id) ?? 0;
    if (roundMoney(total) !== roundMoney(advance.amount)) {
      throw new Error("Advance deductions must sum to the advance amount.");
    }
  }
}

export function sumDeductionsForMonth(
  deductions: AdvanceDeduction[],
  month: string,
): number {
  return roundMoney(
    deductions
      .filter((deduction) => deduction.month === month)
      .reduce((total, deduction) => total + deduction.amount, 0),
  );
}

export function parseAdvanceScheduleText(
  scheduleText: string,
  totalAmount: number,
): ParsedAdvanceDeduction[] {
  const lines = scheduleText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error("Deduction schedule is required.");
  }

  const deductions = lines.map((line) => {
    const [left, notes = ""] = line.split("|").map((part) => part.trim());
    const [month = "", amountText = ""] = left.split(":").map((part) => part.trim());
    const amount = Number(amountText);

    if (!isMonthKey(month) || !Number.isFinite(amount) || amount <= 0) {
      throw new Error("Each deduction line must follow YYYY-MM: amount.");
    }

    return {
      month,
      amount: roundMoney(amount),
      notes,
    };
  });

  const scheduleTotal = roundMoney(
    deductions.reduce((total, deduction) => total + deduction.amount, 0),
  );

  if (scheduleTotal !== roundMoney(totalAmount)) {
    throw new Error("Deduction schedule total must match the advance amount.");
  }

  return deductions;
}
