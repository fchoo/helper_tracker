import { FormEvent, useMemo, useState } from "react";
import type { Advance, AdvanceDeduction } from "./types";
import {
  parseAdvanceScheduleText,
  sumDeductionsForMonth,
  type ParsedAdvanceDeduction,
} from "./advanceSchedule";
import { formatSgd, parseMoneyInput } from "../../lib/money";

export type NewAdvancePayload = {
  advance: Omit<Advance, "id" | "createdAt">;
  deductions: ParsedAdvanceDeduction[];
};

export type AdvancesScreenProps = {
  advances: Advance[];
  deductions: AdvanceDeduction[];
  selectedMonth: string;
  onAddAdvance: (payload: NewAdvancePayload) => Promise<void> | void;
};

export function AdvancesScreen({
  advances,
  deductions,
  selectedMonth,
  onAddAdvance,
}: AdvancesScreenProps) {
  const selectedMonthTotal = useMemo(
    () => sumDeductionsForMonth(deductions, selectedMonth),
    [deductions, selectedMonth],
  );

  return (
    <section aria-labelledby="advances-title" className="screen">
      <header className="screen-header">
        <h2 id="advances-title">Advances</h2>
        <p>Selected month deductions: {formatSgd(selectedMonthTotal)}</p>
      </header>
      <AdvanceForm onSubmit={onAddAdvance} />
      <AdvanceList advances={advances} />
    </section>
  );
}

function AdvanceForm({
  onSubmit,
}: {
  onSubmit: AdvancesScreenProps["onAddAdvance"];
}) {
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [scheduleText, setScheduleText] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!date) {
      setError("Advance date is required.");
      return;
    }

    if (!amount.trim()) {
      setError("Amount is required.");
      return;
    }

    try {
      const parsedAmount = parseMoneyInput(amount);
      const parsedDeductions = parseAdvanceScheduleText(
        scheduleText,
        parsedAmount,
      );

      setError("");
      await onSubmit({
        advance: {
          date,
          amount: parsedAmount,
          description: description.trim(),
        },
        deductions: parsedDeductions,
      });

      setDate("");
      setAmount("");
      setDescription("");
      setScheduleText("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to save advance.",
      );
    }
  }

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      <label>
        Advance date
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      <label>
        Amount
        <input
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>
      <label>
        Description
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label>
        Deduction schedule
        <textarea
          value={scheduleText}
          onChange={(event) => setScheduleText(event.target.value)}
          placeholder="2026-06: 100"
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit">Save advance</button>
    </form>
  );
}

function AdvanceList({ advances }: { advances: Advance[] }) {
  if (!advances.length) {
    return <p>No advances saved yet.</p>;
  }

  return (
    <ul className="record-list">
      {advances.map((advance) => (
        <li key={advance.id}>
          <strong>{formatSgd(advance.amount)}</strong>
          <span>{advance.date}</span>
          {advance.description ? <span>{advance.description}</span> : null}
        </li>
      ))}
    </ul>
  );
}
