import { useMemo } from "react";
import type { Advance, AdvanceDeduction } from "../advances/types";
import type { PublicHoliday } from "../calendar/types";
import type { SalaryConfig } from "../config/types";
import type { TimeRecord } from "../time-records/types";
import { calculateMonthlyPayout } from "./calculateMonthlyPayout";
import { formatSgd } from "../../lib/money";

export type SalaryScreenProps = {
  selectedMonth: string;
  salaryConfigs: SalaryConfig[];
  advances: Advance[];
  advanceDeductions: AdvanceDeduction[];
  timeRecords: TimeRecord[];
  publicHolidays: PublicHoliday[];
};

export function SalaryScreen({
  selectedMonth,
  salaryConfigs,
  advances,
  advanceDeductions,
  timeRecords,
  publicHolidays,
}: SalaryScreenProps) {
  const summary = useMemo(
    () =>
      calculateMonthlyPayout({
        month: selectedMonth,
        salaryConfigs,
        advances,
        advanceDeductions,
        timeRecords,
        publicHolidays,
      }),
    [
      advanceDeductions,
      advances,
      publicHolidays,
      salaryConfigs,
      selectedMonth,
      timeRecords,
    ],
  );
  const includedAdvanceIds = new Set(
    advanceDeductions
      .filter((deduction) => deduction.month === selectedMonth)
      .map((deduction) => deduction.advanceId),
  );
  const includedAdvances = advances.filter((advance) =>
    includedAdvanceIds.has(advance.id),
  );
  const includedTimeRecords = timeRecords.filter((record) =>
    record.startDate.startsWith(selectedMonth) || record.endDate.startsWith(selectedMonth),
  );

  return (
    <section aria-labelledby="salary-title" className="screen">
      <header className="screen-header">
        <h2 id="salary-title">Salary</h2>
        <p>{selectedMonth}</p>
      </header>
      <section className="summary-grid" aria-label="Monthly salary summary">
        <SummaryItem label="Final payout" value={formatSgd(summary.finalPayout)} />
        <SummaryItem label="Base salary" value={formatSgd(summary.baseSalary)} />
        <SummaryItem label="Daily rate" value={formatSgd(summary.dailyRate)} />
        <SummaryItem label="Sunday OT days" value={String(summary.sundayOtDays)} />
        <SummaryItem
          label="Sunday OT amount"
          value={formatSgd(summary.sundayOtAmount)}
        />
        <SummaryItem
          label="Advance deductions"
          value={formatSgd(summary.totalAdvanceDeductions)}
        />
      </section>
      <section aria-labelledby="included-advances-title">
        <h3 id="included-advances-title">Included advances</h3>
        {includedAdvances.length ? (
          <ul className="record-list">
            {includedAdvances.map((advance) => (
              <li key={advance.id}>
                <strong>{formatSgd(advance.amount)}</strong>
                <span>{advance.date}</span>
                {advance.description ? <span>{advance.description}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>No advances deducted this month.</p>
        )}
      </section>
      <section aria-labelledby="included-time-title">
        <h3 id="included-time-title">Included time records</h3>
        {includedTimeRecords.length ? (
          <ul className="record-list">
            {includedTimeRecords.map((record) => (
              <li key={record.id}>
                <strong>{record.type}</strong>
                <span>{record.startDate}</span>
                {record.notes ? <span>{record.notes}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>No time records this month.</p>
        )}
      </section>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
