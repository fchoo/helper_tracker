import { useMemo } from "react";
import type { Advance, AdvanceDeduction } from "../advances/types";
import type { PublicHoliday } from "../calendar/types";
import type { SalaryConfig } from "../config/types";
import { formatRecordType } from "../time-records/dayEntry";
import type { TimeRecord } from "../time-records/types";
import { timeRecordOverlapsDateRange } from "../time-records/timeRecordMath";
import { calculateMonthlyPayout } from "./calculateMonthlyPayout";
import { getPayCycleDateRangeForPayMonth, isMonthKey } from "../../lib/dates";
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
        payCycleStartDay: resolvePayCycleStartDay(salaryConfigs, selectedMonth),
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
  const advanceById = new Map(
    advances.map((advance) => [advance.id, advance] as const),
  );
  const includedDeductions = advanceDeductions.filter(
    (deduction) => deduction.month === selectedMonth,
  );
  const deductionRows = includedDeductions.map((deduction) => ({
    deduction,
    advance: advanceById.get(deduction.advanceId),
  }));
  const visiblePayCycleRange = isMonthKey(selectedMonth)
    ? getPayCycleDateRangeForPayMonth(selectedMonth, summary.payCycleStartDay)
    : undefined;
  const includedTimeRecords = timeRecords.filter((record) =>
    visiblePayCycleRange
      ? timeRecordOverlapsDateRange(record, visiblePayCycleRange)
      : false,
  );

  return (
    <section aria-labelledby="salary-title" className="screen">
      <h2 id="salary-title" className="visually-hidden">
        Salary
      </h2>
      <span className="visually-hidden">Pay month {selectedMonth}</span>
      <section className="pay-panel" aria-label="Pay decision">
        <div>
          <span>Amount to pay</span>
          <strong>{formatSgd(summary.finalPayout)}</strong>
        </div>
        <dl>
          <div>
            <dt>Pay by</dt>
            <dd>{summary.payDate}</dd>
          </div>
          <div>
            <dt>Pay cycle</dt>
            <dd>
              {summary.payCycleStartDate} to {summary.payCycleEndDate}
            </dd>
          </div>
        </dl>
      </section>
      <section className="summary-grid" aria-label="Monthly salary summary">
        <SummaryItem label="Base salary" value={formatSgd(summary.baseSalary)} />
        <SummaryItem label="Daily rate" value={formatSgd(summary.dailyRate)} />
        <SummaryItem
          label="Worked Sundays"
          value={`${summary.sundayOtDays} days, ${formatSgd(summary.sundayOtAmount)}`}
        />
        <SummaryItem
          label="Extra PH pay"
          value={`${summary.publicHolidayWorkDays} days, ${formatSgd(summary.publicHolidayWorkAmount)}`}
        />
        <SummaryItem
          label="Extra unpaid day deduction"
          value={`${summary.unpaidOffDays} days, ${formatSgd(summary.unpaidOffDayDeduction)}`}
        />
        <SummaryItem
          label="Advance deductions"
          value={formatSgd(summary.totalAdvanceDeductions)}
        />
      </section>
      <section
        aria-labelledby="salary-breakdown-title"
        className="panel-section breakdown-panel"
      >
        <h3 id="salary-breakdown-title">Payout breakdown</h3>
        <dl className="line-items">
          <LineItem label="Base monthly salary" value={summary.baseSalary} />
          <LineItem label="Worked Sundays" value={summary.sundayOtAmount} />
          <LineItem label="Extra PH pay" value={summary.publicHolidayWorkAmount} />
          <LineItem
            label="Extra unpaid day deduction"
            value={-summary.unpaidOffDayDeduction}
          />
          <LineItem label="Advance deductions" value={-summary.totalAdvanceDeductions} />
          <LineItem label="Final payout" value={summary.finalPayout} strong />
        </dl>
      </section>
      <section
        aria-labelledby="included-advances-title"
        className="panel-section deduction-panel"
      >
        <div>
          <h3 id="included-advances-title">Advance deductions this pay month</h3>
          <p>Scheduled deductions included in this payout.</p>
        </div>
        <div
          className="deduction-total"
          aria-label="Total advance deducted this pay month"
        >
          <span>Total deducted</span>
          <strong>{formatSgd(summary.totalAdvanceDeductions)}</strong>
        </div>
        {deductionRows.length ? (
          <ul className="record-list deduction-list">
            {deductionRows.map(({ deduction, advance }) => (
              <li key={deduction.id}>
                <strong>{formatSgd(deduction.amount)}</strong>
                <span>
                  {advance?.description
                    ? `From ${advance.description}`
                    : "Advance deduction"}
                </span>
                <span>
                  {advance
                    ? `Advance given ${advance.date}, original ${formatSgd(advance.amount)}`
                    : "Advance details unavailable"}
                </span>
                {deduction.notes ? <span>{deduction.notes}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>No advances deducted this pay month.</p>
        )}
      </section>
      <section aria-labelledby="included-time-title" className="panel-section">
        <h3 id="included-time-title">Included time records</h3>
        {includedTimeRecords.length ? (
          <ul className="record-list">
            {includedTimeRecords.map((record) => (
              <li key={record.id}>
                <strong>{formatRecordType(record.type)}</strong>
                <span>
                  {record.startDate}
                  {record.endDate !== record.startDate ? ` to ${record.endDate}` : ""}
                </span>
                {record.notes ? <span>{record.notes}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>No time records in this pay cycle.</p>
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

function LineItem({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  const displayValue = Object.is(value, -0) ? 0 : value;

  return (
    <div className={strong ? "strong-line" : undefined}>
      <dt>{label}</dt>
      <dd>{formatSgd(displayValue)}</dd>
    </div>
  );
}

function resolvePayCycleStartDay(
  salaryConfigs: SalaryConfig[],
  month: string,
): number {
  if (!isMonthKey(month)) {
    return 1;
  }

  const monthEnd = `${month}-31`;
  return (
    salaryConfigs
      .filter((config) => config.effectiveStartDate <= monthEnd)
      .sort((a, b) => b.effectiveStartDate.localeCompare(a.effectiveStartDate))[0]
      ?.payCycleStartDay ?? 1
  );
}
