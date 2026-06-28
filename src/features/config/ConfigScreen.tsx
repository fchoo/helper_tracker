import { FormEvent, useState } from "react";
import { PublicHolidayPanel } from "../calendar/PublicHolidayPanel";
import type { NewPublicHolidayInput, PublicHoliday } from "../calendar/types";
import type { SalaryConfig } from "./types";
import { parseMoneyInput } from "../../lib/money";
import { SalaryPlanHistory } from "./SalaryPlanHistory";
import { SpreadsheetSetup } from "./SpreadsheetSetup";
import type { SpreadsheetHealthCheck } from "./spreadsheetHealth";

export type NewSalaryConfigInput = Omit<SalaryConfig, "id" | "createdAt">;

export type ConfigScreenProps = {
  selectedMonth: string;
  salaryConfigs: SalaryConfig[];
  publicHolidays?: PublicHoliday[];
  spreadsheetId?: string;
  onAddSalaryConfig: (config: NewSalaryConfigInput) => Promise<void> | void;
  onConnectSpreadsheet?: (spreadsheetId: string) => Promise<void> | void;
  onCreateSpreadsheet?: () => Promise<void> | void;
  onCheckSpreadsheetHealth?: (spreadsheetId: string) => Promise<SpreadsheetHealthCheck> | SpreadsheetHealthCheck;
  onImportPublicHolidays?: (year: number) => Promise<PublicHoliday[]>;
  onAddPublicHoliday?: (
    holiday: NewPublicHolidayInput,
  ) => Promise<PublicHoliday> | PublicHoliday;
  onUpdatePublicHoliday?: (
    holiday: PublicHoliday,
  ) => Promise<PublicHoliday> | PublicHoliday;
  onDeletePublicHoliday?: (holidayId: string) => Promise<void> | void;
};

export function ConfigScreen({
  selectedMonth,
  salaryConfigs,
  publicHolidays = [],
  spreadsheetId,
  onAddSalaryConfig,
  onConnectSpreadsheet,
  onCreateSpreadsheet,
  onCheckSpreadsheetHealth,
  onImportPublicHolidays,
  onAddPublicHoliday,
  onUpdatePublicHoliday,
  onDeletePublicHoliday,
}: ConfigScreenProps) {
  return (
    <section aria-labelledby="config-title" className="screen">
      <header className="screen-header">
        <div>
          <h2 id="config-title">Configuration</h2>
          <p>Set up the Google Sheet, salary plan, and public holidays.</p>
        </div>
      </header>
      {onConnectSpreadsheet && onCreateSpreadsheet ? (
        <SpreadsheetSetup
          spreadsheetId={spreadsheetId}
          onConnect={onConnectSpreadsheet}
          onCreate={onCreateSpreadsheet}
          onHealthCheck={onCheckSpreadsheetHealth}
        />
      ) : null}
      <div className="config-layout">
        <SalaryConfigForm onSubmit={onAddSalaryConfig} />
        <SalaryConfigList salaryConfigs={salaryConfigs} />
        <PublicHolidayPanel
          holidays={publicHolidays}
          selectedYear={Number(selectedMonth.slice(0, 4))}
          onImportPublicHolidays={onImportPublicHolidays}
          onAddPublicHoliday={onAddPublicHoliday}
          onUpdatePublicHoliday={onUpdatePublicHoliday}
          onDeletePublicHoliday={onDeletePublicHoliday}
        />
      </div>
    </section>
  );
}

function SalaryConfigForm({
  onSubmit,
}: {
  onSubmit: ConfigScreenProps["onAddSalaryConfig"];
}) {
  const [monthlySalary, setMonthlySalary] = useState("");
  const [effectiveStartDate, setEffectiveStartDate] = useState("");
  const [otDayDivisor, setOtDayDivisor] = useState("26");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!monthlySalary.trim()) {
      setError("Monthly salary is required.");
      return;
    }

    if (!effectiveStartDate) {
      setError("Effective start date is required.");
      return;
    }

    const divisor = Number(otDayDivisor);

    if (!Number.isInteger(divisor) || divisor <= 0) {
      setError("OT day divisor must be a positive whole number.");
      return;
    }

    setError("");
    await onSubmit({
      monthlySalary: parseMoneyInput(monthlySalary),
      effectiveStartDate,
      otDayDivisor: divisor,
      defaultSundayOffPolicy: "ALL_SUNDAYS",
      defaultSundayOffCount: undefined,
      notes: notes.trim(),
    });

    setMonthlySalary("");
    setEffectiveStartDate("");
    setOtDayDivisor("26");
    setNotes("");
  }

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      <label>
        Monthly salary
        <input
          inputMode="decimal"
          value={monthlySalary}
          onChange={(event) => setMonthlySalary(event.target.value)}
        />
      </label>
      <label>
        Effective start date
        <input
          type="date"
          value={effectiveStartDate}
          onChange={(event) => setEffectiveStartDate(event.target.value)}
        />
      </label>
      <details className="advanced-settings">
        <summary>Advanced pay settings</summary>
        <label>
          OT day divisor
          <input
            inputMode="numeric"
            value={otDayDivisor}
            onChange={(event) => setOtDayDivisor(event.target.value)}
          />
        </label>
      </details>
      <label>
        Salary notes
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit">Save salary plan</button>
    </form>
  );
}

function SalaryConfigList({
  salaryConfigs,
}: {
  salaryConfigs: SalaryConfig[];
}) {
  return (
    <section aria-labelledby="salary-history-title" className="salary-history-panel">
      <div className="panel-header">
        <div>
          <h3 id="salary-history-title">Salary plan history</h3>
          <p>Each saved plan stays as an audit trail for future payroll checks.</p>
        </div>
      </div>
      <SalaryPlanHistory
        salaryConfigs={salaryConfigs}
        emptyMessage="No salary plans saved yet."
      />
    </section>
  );
}
