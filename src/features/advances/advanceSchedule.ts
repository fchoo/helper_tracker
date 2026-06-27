import type { Advance, AdvanceDeduction } from "./types";
import { roundMoney } from "../../lib/money";

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
