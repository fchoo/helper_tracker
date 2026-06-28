import { FormEvent, useState } from "react";
import type { SalaryConfig, SundayOffPolicy } from "./types";
import { parseMoneyInput } from "../../lib/money";
import { SalaryPlanHistory } from "./SalaryPlanHistory";
import { SpreadsheetSetup } from "./SpreadsheetSetup";
import type { SpreadsheetHealthCheck } from "./spreadsheetHealth";

export type NewSalaryConfigInput = Omit<SalaryConfig, "id" | "createdAt">;

export type ConfigScreenProps = {
  salaryConfigs: SalaryConfig[];
  spreadsheetId?: string;
  onAddSalaryConfig: (config: NewSalaryConfigInput) => Promise<void> | void;
  onConnectSpreadsheet?: (spreadsheetId: string) => Promise<void> | void;
  onCreateSpreadsheet?: () => Promise<void> | void;
  onCheckSpreadsheetHealth?: (spreadsheetId: string) => Promise<SpreadsheetHealthCheck> | SpreadsheetHealthCheck;
};

export function ConfigScreen({
  salaryConfigs,
  spreadsheetId,
  onAddSalaryConfig,
  onConnectSpreadsheet,
  onCreateSpreadsheet,
  onCheckSpreadsheetHealth,
}: ConfigScreenProps) {
  return (
    <section aria-labelledby="config-title" className="screen">
      <header className="screen-header">
        <div>
          <h2 id="config-title">Configuration</h2>
          <p>Set up the Google Sheet, salary plan, and default off-day rules.</p>
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
  const [defaultSundayOffPolicy, setDefaultSundayOffPolicy] =
    useState<SundayOffPolicy>("FIXED_COUNT");
  const [defaultSundayOffCount, setDefaultSundayOffCount] = useState("4");
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

    const sundayOffCount = Number(defaultSundayOffCount);

    if (
      defaultSundayOffPolicy === "FIXED_COUNT" &&
      (!Number.isInteger(sundayOffCount) || sundayOffCount < 0 || sundayOffCount > 5)
    ) {
      setError("Default Sunday off count must be between 0 and 5.");
      return;
    }

    setError("");
    await onSubmit({
      monthlySalary: parseMoneyInput(monthlySalary),
      effectiveStartDate,
      otDayDivisor: divisor,
      defaultSundayOffPolicy,
      defaultSundayOffCount:
        defaultSundayOffPolicy === "FIXED_COUNT" ? sundayOffCount : undefined,
      notes: notes.trim(),
    });

    setMonthlySalary("");
    setEffectiveStartDate("");
    setOtDayDivisor("26");
    setDefaultSundayOffPolicy("FIXED_COUNT");
    setDefaultSundayOffCount("4");
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
      <label>
        OT day divisor
        <input
          inputMode="numeric"
          value={otDayDivisor}
          onChange={(event) => setOtDayDivisor(event.target.value)}
        />
      </label>
      <fieldset className="field-group sunday-selector">
        <legend>Default Sunday off days</legend>
        <div className="choice-card-grid">
          {[4, 5].map((count) => (
            <label className="choice-card" key={count}>
              <input
                type="radio"
                aria-label={`${count} Sundays`}
                name="default-sunday-off-policy"
                value={`FIXED_COUNT_${count}`}
                checked={
                  defaultSundayOffPolicy === "FIXED_COUNT" &&
                  defaultSundayOffCount === String(count)
                }
                onChange={() => {
                  setDefaultSundayOffPolicy("FIXED_COUNT");
                  setDefaultSundayOffCount(String(count));
                }}
              />
              <span>{count} Sundays</span>
              <small>
                {count === 4
                  ? "Usual monthly default"
                  : "Use when a month has five Sundays"}
              </small>
            </label>
          ))}
          <label className="choice-card">
            <input
              type="radio"
              aria-label="All Sundays"
              name="default-sunday-off-policy"
              value="ALL_SUNDAYS"
              checked={defaultSundayOffPolicy === "ALL_SUNDAYS"}
              onChange={() => setDefaultSundayOffPolicy("ALL_SUNDAYS")}
            />
            <span>All Sundays</span>
            <small>Automatically adapts to each month</small>
          </label>
        </div>
      </fieldset>
      <label>
        Notes
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
