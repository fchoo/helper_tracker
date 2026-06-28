import { useMemo } from "react";
import type { Advance, AdvanceDeduction } from "../advances/types";
import type { PublicHoliday } from "../calendar/types";
import type { SalaryConfig } from "../config/types";
import { formatRecordType } from "../time-records/dayEntry";
import type { TimeRecord } from "../time-records/types";
import { timeRecordOverlapsMonth } from "../time-records/timeRecordMath";
import { calculateMonthlyPayout } from "./calculateMonthlyPayout";
import { SalaryPlanHistory } from "../config/SalaryPlanHistory";
import { isMonthKey } from "../../lib/dates";
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
  const includedDeductions = advanceDeductions.filter(
    (deduction) => deduction.month === selectedMonth,
  );
  const includedTimeRecords = timeRecords.filter((record) =>
    timeRecordOverlapsMonth(record, selectedMonth),
  );
  const expectedPayDate = getExpectedPayDate(selectedMonth);

  return (
    <section aria-labelledby="salary-title" className="screen">
      <header className="screen-header">
        <div>
          <h2 id="salary-title">Salary</h2>
          <p>Review {selectedMonth} and pay by {expectedPayDate}</p>
        </div>
      </header>
      <section className="pay-panel" aria-label="Pay decision">
        <div>
          <span>Amount to pay</span>
          <strong>{formatSgd(summary.finalPayout)}</strong>
        </div>
        <dl>
          <div>
            <dt>Pay by</dt>
            <dd>{expectedPayDate}</dd>
          </div>
          <div>
            <dt>Salary version</dt>
            <dd>{summary.configEffectiveStartDate ?? "Not configured"}</dd>
          </div>
          <div>
            <dt>Sunday rest days</dt>
            <dd>
              {summary.defaultSundayOffDays} of {summary.sundayCount}
              {summary.extraSundayCount
                ? `, ${summary.extraSundayCount} extra Sunday to decide`
                : ""}
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
      <section aria-labelledby="salary-breakdown-title" className="breakdown-panel">
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
        aria-labelledby="salary-plan-history-title"
        className="salary-history-panel"
      >
        <div className="panel-header">
          <div>
            <h3 id="salary-plan-history-title">Salary plan history</h3>
            <p>Plans are ordered by effective date, with the plan used for this month marked active.</p>
          </div>
        </div>
        <SalaryPlanHistory
          salaryConfigs={salaryConfigs}
          activeEffectiveStartDate={summary.configEffectiveStartDate}
          emptyMessage="No salary plans saved yet. Add one in Config before payroll review."
        />
      </section>
      <section aria-labelledby="included-advances-title">
        <h3 id="included-advances-title">Advance deductions this month</h3>
        {includedAdvances.length ? (
          <ul className="record-list">
            {includedAdvances.map((advance) => (
              <li key={advance.id}>
                <strong>{formatSgd(advance.amount)}</strong>
                <span>{advance.date}</span>
                {advance.description ? <span>{advance.description}</span> : null}
                {includedDeductions
                  .filter((deduction) => deduction.advanceId === advance.id)
                  .map((deduction) => (
                    <span key={deduction.id}>
                      Deduct {formatSgd(deduction.amount)} in {deduction.month}
                    </span>
                  ))}
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

function getExpectedPayDate(month: string): string {
  if (!isMonthKey(month)) {
    return "Select a month";
  }

  const [year, monthNumber] = month.split("-").map(Number);
  const payDate = new Date(Date.UTC(year, monthNumber, 0));
  return payDate.toISOString().slice(0, 10);
}
