import { FormEvent, useState } from "react";
import type { SalaryConfig } from "./types";
import { formatSgd, parseMoneyInput } from "../../lib/money";
import { SpreadsheetSetup } from "./SpreadsheetSetup";

export type NewSalaryConfigInput = Omit<SalaryConfig, "id" | "createdAt">;

export type ConfigScreenProps = {
  salaryConfigs: SalaryConfig[];
  spreadsheetId?: string;
  onAddSalaryConfig: (config: NewSalaryConfigInput) => Promise<void> | void;
  onConnectSpreadsheet?: (spreadsheetId: string) => Promise<void> | void;
  onCreateSpreadsheet?: () => Promise<void> | void;
};

export function ConfigScreen({
  salaryConfigs,
  spreadsheetId,
  onAddSalaryConfig,
  onConnectSpreadsheet,
  onCreateSpreadsheet,
}: ConfigScreenProps) {
  return (
    <section aria-labelledby="config-title" className="screen">
      <header className="screen-header">
        <h2 id="config-title">Configuration</h2>
      </header>
      {onConnectSpreadsheet && onCreateSpreadsheet ? (
        <SpreadsheetSetup
          spreadsheetId={spreadsheetId}
          onConnect={onConnectSpreadsheet}
          onCreate={onCreateSpreadsheet}
        />
      ) : null}
      <SalaryConfigForm onSubmit={onAddSalaryConfig} />
      <SalaryConfigList salaryConfigs={salaryConfigs} />
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
      <label>
        OT day divisor
        <input
          inputMode="numeric"
          value={otDayDivisor}
          onChange={(event) => setOtDayDivisor(event.target.value)}
        />
      </label>
      <label>
        Notes
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit">Save salary version</button>
    </form>
  );
}

function SalaryConfigList({
  salaryConfigs,
}: {
  salaryConfigs: SalaryConfig[];
}) {
  if (!salaryConfigs.length) {
    return <p>No salary configurations saved yet.</p>;
  }

  const sortedConfigs = [...salaryConfigs].sort((a, b) =>
    b.effectiveStartDate.localeCompare(a.effectiveStartDate),
  );

  return (
    <section aria-labelledby="salary-history-title">
      <h3 id="salary-history-title">Salary version history</h3>
      <ul className="record-list">
        {sortedConfigs.map((config) => (
          <li key={config.id}>
            <strong>{formatSgd(config.monthlySalary)}</strong>
            <span>Effective {config.effectiveStartDate}</span>
            <span>Divisor {config.otDayDivisor}</span>
            {config.notes ? <span>{config.notes}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
