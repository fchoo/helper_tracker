import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Advance, AdvanceDeduction } from "./types";
import {
  sumDeductionsForMonth,
  type ParsedAdvanceDeduction,
  validateStructuredAdvanceSchedule,
} from "./advanceSchedule";
import { formatSgd, parseMoneyInput } from "../../lib/money";

export type NewAdvancePayload = {
  advance: Omit<Advance, "id" | "createdAt">;
  deductions: ParsedAdvanceDeduction[];
};

export type EditAdvancePayload = NewAdvancePayload & {
  advanceId: string;
};

export type AdvancesScreenProps = {
  advances: Advance[];
  deductions: AdvanceDeduction[];
  selectedMonth: string;
  onAddAdvance: (payload: NewAdvancePayload) => Promise<void> | void;
  onUpdateAdvance: (payload: EditAdvancePayload) => Promise<void> | void;
};

export function AdvancesScreen({
  advances,
  deductions,
  selectedMonth,
  onAddAdvance,
  onUpdateAdvance,
}: AdvancesScreenProps) {
  const selectedMonthTotal = useMemo(
    () => sumDeductionsForMonth(deductions, selectedMonth),
    [deductions, selectedMonth],
  );
  const [filter, setFilter] = useState("all");
  const [dialogMode, setDialogMode] = useState<"add" | "edit" | null>(null);
  const [editingAdvanceId, setEditingAdvanceId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const editingAdvance =
    editingAdvanceId === null
      ? null
      : advances.find((advance) => advance.id === editingAdvanceId) ?? null;
  const editingDeductions =
    editingAdvanceId === null
      ? []
      : deductions.filter((deduction) => deduction.advanceId === editingAdvanceId);
  const isDialogOpen =
    dialogMode === "add" || (dialogMode === "edit" && editingAdvance !== null);

  useEffect(() => {
    if (!toastMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setToastMessage(""), 3600);
    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  return (
    <section aria-labelledby="advances-title" className="screen">
      <header className="screen-header">
        <div>
          <h2 id="advances-title">Advances</h2>
          <p>Deducted in {selectedMonth}: {formatSgd(selectedMonthTotal)}</p>
        </div>
        <button type="button" onClick={openAddDialog}>
          Add advance
        </button>
      </header>
      <AdvanceHistory
        advances={advances}
        deductions={deductions}
        selectedMonth={selectedMonth}
        filter={filter}
        onFilterChange={setFilter}
        onEditAdvance={openEditDialog}
      />
      {isDialogOpen ? (
        <AdvanceDialog
          mode={dialogMode}
          advance={editingAdvance}
          deductions={editingDeductions}
          onClose={closeDialog}
          onSubmit={handleDialogSubmit}
        />
      ) : null}
      <Toast message={toastMessage} />
    </section>
  );

  function openAddDialog() {
    setEditingAdvanceId(null);
    setDialogMode("add");
  }

  function openEditDialog(advanceId: string) {
    setEditingAdvanceId(advanceId);
    setDialogMode("edit");
  }

  function closeDialog() {
    setDialogMode(null);
    setEditingAdvanceId(null);
  }

  async function handleDialogSubmit(payload: NewAdvancePayload) {
    if (dialogMode === "edit" && editingAdvanceId) {
      await onUpdateAdvance({
        ...payload,
        advanceId: editingAdvanceId,
      });
      closeDialog();
      setToastMessage("Advance updated.");
      return;
    }

    await onAddAdvance(payload);
    closeDialog();
    setToastMessage("Advance saved.");
  }
}

type ScheduleRow = {
  id: string;
  month: string;
  amount: string;
  notes: string;
};

function AdvanceForm({
  mode,
  initialAdvance,
  initialDeductions,
  onSubmit,
}: {
  mode: "add" | "edit";
  initialAdvance?: Advance | null;
  initialDeductions?: AdvanceDeduction[];
  onSubmit: AdvancesScreenProps["onAddAdvance"];
}) {
  const [date, setDate] = useState(initialAdvance?.date ?? "");
  const [amount, setAmount] = useState(
    initialAdvance ? String(initialAdvance.amount) : "",
  );
  const [description, setDescription] = useState(
    initialAdvance?.description ?? "",
  );
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>(
    initialDeductions?.length
      ? initialDeductions
          .slice()
          .sort((a, b) => a.month.localeCompare(b.month))
          .map((deduction) => ({
            id: deduction.id,
            month: deduction.month,
            amount: String(deduction.amount),
            notes: deduction.notes ?? "",
          }))
      : [createScheduleRow()],
  );
  const [error, setError] = useState("");
  const isEditing = mode === "edit";
  const scheduleTotal = useMemo(
    () =>
      scheduleRows.reduce((total, row) => {
        const parsedAmount = Number(row.amount);
        return Number.isFinite(parsedAmount) ? total + parsedAmount : total;
      }, 0),
    [scheduleRows],
  );

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
      const parsedDeductions = validateStructuredAdvanceSchedule(
        scheduleRows.map((row) => ({
          month: row.month,
          amount: Number(row.amount),
          notes: row.notes,
        })),
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
      setScheduleRows([createScheduleRow()]);
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
        Advance amount
        <input
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>
      <label>
        Description
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <fieldset className="field-group">
        <legend>Deduction schedule</legend>
        <div className="schedule-list">
          {scheduleRows.map((row, index) => (
            <div className="schedule-row" key={row.id}>
              <label>
                Month
                <input
                  aria-label={`Deduction month ${index + 1}`}
                  type="month"
                  value={row.month}
                  onChange={(event) =>
                    updateScheduleRow(row.id, "month", event.target.value)
                  }
                />
              </label>
              <label>
                Amount
                <input
                  aria-label={`Deduction amount ${index + 1}`}
                  inputMode="decimal"
                  value={row.amount}
                  onChange={(event) =>
                    updateScheduleRow(row.id, "amount", event.target.value)
                  }
                />
              </label>
              <label>
                Notes
                <input
                  aria-label={`Deduction notes ${index + 1}`}
                  value={row.notes}
                  onChange={(event) =>
                    updateScheduleRow(row.id, "notes", event.target.value)
                  }
                />
              </label>
              <button
                type="button"
                className="secondary-button"
                onClick={() => removeScheduleRow(row.id)}
                disabled={scheduleRows.length === 1}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="inline-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setScheduleRows((rows) => [...rows, createScheduleRow()])}
          >
            Add deduction month
          </button>
          <span>Schedule total: {formatSgd(scheduleTotal)}</span>
        </div>
      </fieldset>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit">{isEditing ? "Update advance" : "Save advance"}</button>
    </form>
  );

  function updateScheduleRow(
    rowId: string,
    field: keyof Omit<ScheduleRow, "id">,
    value: string,
  ) {
    setScheduleRows((rows) =>
      rows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    );
  }

  function removeScheduleRow(rowId: string) {
    setScheduleRows((rows) => rows.filter((row) => row.id !== rowId));
  }
}

function AdvanceDialog({
  mode,
  advance,
  deductions,
  onClose,
  onSubmit,
}: {
  mode: "add" | "edit" | null;
  advance: Advance | null;
  deductions: AdvanceDeduction[];
  onClose: () => void;
  onSubmit: AdvancesScreenProps["onAddAdvance"];
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const title = mode === "edit" ? "Edit advance" : "Add advance";

  useEffect(() => {
    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        aria-labelledby="advance-dialog-title"
        aria-modal="true"
        className="modal-panel"
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="modal-header">
          <div>
            <h3 id="advance-dialog-title">{title}</h3>
          </div>
          <button
            type="button"
            className="secondary-button icon-button"
            aria-label="Close advance form"
            onClick={onClose}
          >
            X
          </button>
        </div>
        <AdvanceForm
          key={advance?.id ?? "new-advance"}
          mode={mode === "edit" ? "edit" : "add"}
          initialAdvance={advance}
          initialDeductions={deductions}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}

function AdvanceHistory({
  advances,
  deductions,
  selectedMonth,
  filter,
  onFilterChange,
  onEditAdvance,
}: {
  advances: Advance[];
  deductions: AdvanceDeduction[];
  selectedMonth: string;
  filter: string;
  onFilterChange: (filter: string) => void;
  onEditAdvance: (advanceId: string) => void;
}) {
  const sortedAdvances = [...advances].sort((a, b) => b.date.localeCompare(a.date));
  const filteredAdvances = sortedAdvances.filter((advance) => {
    if (filter === "selected") {
      return deductions.some(
        (deduction) =>
          deduction.advanceId === advance.id && deduction.month === selectedMonth,
      );
    }

    return true;
  });

  return (
    <section
      aria-labelledby="advance-history-title"
      className="panel-section history-panel"
    >
      <div className="panel-header">
        <h3 id="advance-history-title">Advance history</h3>
        <label className="compact-filter">
          Filter
          <select
            value={filter}
            onChange={(event) => onFilterChange(event.target.value)}
          >
            <option value="all">All advances</option>
            <option value="selected">Deducted this month</option>
          </select>
        </label>
      </div>
      {filteredAdvances.length ? (
        <ul className="record-list scroll-list">
          {filteredAdvances.map((advance) => (
            <AdvanceHistoryItem
              key={advance.id}
              advance={advance}
              deductions={deductions.filter(
                (deduction) => deduction.advanceId === advance.id,
              )}
              onEditAdvance={onEditAdvance}
            />
          ))}
        </ul>
      ) : (
        <p>No advances match this filter.</p>
      )}
    </section>
  );
}

function AdvanceHistoryItem({
  advance,
  deductions,
  onEditAdvance,
}: {
  advance: Advance;
  deductions: AdvanceDeduction[];
  onEditAdvance: (advanceId: string) => void;
}) {
  const paidBack = deductions.reduce((total, deduction) => total + deduction.amount, 0);
  const remaining = Math.max(0, advance.amount - paidBack);

  return (
    <li>
      <div>
        <strong>{formatSgd(advance.amount)}</strong>
        <span>{advance.date}</span>
      </div>
      <span>{remaining > 0 ? `${formatSgd(remaining)} remaining` : "Fully scheduled"}</span>
      {advance.description ? <span>{advance.description}</span> : null}
      <button
        type="button"
        className="secondary-button"
        onClick={() => onEditAdvance(advance.id)}
      >
        Edit
      </button>
      {deductions.length ? (
        <dl className="mini-breakdown">
          {deductions
            .slice()
            .sort((a, b) => a.month.localeCompare(b.month))
            .map((deduction) => (
              <div key={deduction.id}>
                <dt>{deduction.month}</dt>
                <dd>{formatSgd(deduction.amount)}</dd>
              </div>
            ))}
        </dl>
      ) : null}
    </li>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div className="toast-region" aria-live="polite" aria-atomic="true">
      {message ? (
        <div className="toast-message" role="status">
          {message}
        </div>
      ) : null}
    </div>
  );
}

function createScheduleRow(): ScheduleRow {
  return {
    id: crypto.randomUUID(),
    month: "",
    amount: "",
    notes: "",
  };
}

export function AdvanceList({ advances }: { advances: Advance[] }) {
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
