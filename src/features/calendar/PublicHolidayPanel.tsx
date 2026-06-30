import { FormEvent, useEffect, useRef, useState } from "react";
import { isIsoDate } from "../../lib/dates";
import type { NewPublicHolidayInput, PublicHoliday } from "./types";

export type PublicHolidayPanelProps = {
  holidays: PublicHoliday[];
  selectedYear: number;
  onImportPublicHolidays?: (year: number) => Promise<PublicHoliday[]>;
  onAddPublicHoliday?: (
    holiday: NewPublicHolidayInput,
  ) => Promise<PublicHoliday> | PublicHoliday;
  onUpdatePublicHoliday?: (
    holiday: PublicHoliday,
  ) => Promise<PublicHoliday> | PublicHoliday;
  onDeletePublicHoliday?: (holidayId: string) => Promise<void> | void;
};

export function PublicHolidayPanel({
  holidays,
  selectedYear,
  onImportPublicHolidays,
  onAddPublicHoliday,
  onUpdatePublicHoliday,
  onDeletePublicHoliday,
}: PublicHolidayPanelProps) {
  const [localHolidays, setLocalHolidays] = useState({
    sourceHolidays: holidays,
    holidays,
  });
  const [holidayDialog, setHolidayDialog] = useState<HolidayDialogState>(null);
  const [error, setError] = useState("");
  const [isImportingHolidays, setIsImportingHolidays] = useState(false);
  const [deletingHolidayId, setDeletingHolidayId] = useState("");

  if (localHolidays.sourceHolidays !== holidays) {
    setLocalHolidays({
      sourceHolidays: holidays,
      holidays,
    });
  }

  const visibleHolidays = localHolidays.holidays;
  const sortedHolidays = [...visibleHolidays].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  async function handleImport() {
    if (!onImportPublicHolidays) {
      return;
    }

    try {
      setError("");
      setIsImportingHolidays(true);
      const importedHolidays = await onImportPublicHolidays(selectedYear);
      setVisibleHolidays(mergeHolidays(visibleHolidays, importedHolidays));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to import public holidays.",
      );
    } finally {
      setIsImportingHolidays(false);
    }
  }

  async function handleDelete(holidayId: string) {
    try {
      setError("");
      setDeletingHolidayId(holidayId);

      if (onDeletePublicHoliday) {
        await onDeletePublicHoliday(holidayId);
      }

      setVisibleHolidays(
        visibleHolidays.filter((holiday) => holiday.id !== holidayId),
      );

      setHolidayDialog((currentDialog) =>
        currentDialog?.mode === "edit" && currentDialog.holiday.id === holidayId
          ? null
          : currentDialog,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to delete public holiday.",
      );
    } finally {
      setDeletingHolidayId("");
    }
  }

  function handleEdit(holiday: PublicHoliday) {
    setHolidayDialog({ mode: "edit", holiday });
    setError("");
  }

  function setVisibleHolidays(nextHolidays: PublicHoliday[]) {
    setLocalHolidays({
      sourceHolidays: holidays,
      holidays: nextHolidays,
    });
  }

  async function handleDialogSubmit(input: NewPublicHolidayInput) {
    const savedHoliday =
      holidayDialog?.mode === "edit"
        ? await saveEditedHoliday(
            holidayDialog.holiday,
            input,
            onUpdatePublicHoliday,
          )
        : await onAddPublicHoliday?.(input);

    if (!savedHoliday) {
      return;
    }

    setVisibleHolidays(mergeHolidays(visibleHolidays, [savedHoliday]));
    setHolidayDialog(null);
  }

  return (
    <section
      aria-labelledby="public-holidays-title"
      className="panel-section public-holiday-panel"
    >
      <div className="panel-header">
        <div>
          <h3 id="public-holidays-title">Public holidays</h3>
          <p>Expected work days by default; add extra pay only from Time & Calendar.</p>
        </div>
        <div className="button-row">
          {onAddPublicHoliday ? (
            <button
              type="button"
              className="mobile-floating-action"
              onClick={() => setHolidayDialog({ mode: "add" })}
            >
              Add public holiday
            </button>
          ) : null}
          {onImportPublicHolidays ? (
            <button
              type="button"
              className="secondary-button"
              onClick={handleImport}
              disabled={isImportingHolidays}
            >
              {isImportingHolidays
                ? `Importing ${selectedYear} and ${selectedYear + 1}...`
                : `Import ${selectedYear} and ${selectedYear + 1} holidays`}
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      {sortedHolidays.length ? (
        <ul className="record-list scroll-list public-holiday-list">
          {sortedHolidays.map((holiday) => (
            <li key={holiday.id}>
              <strong>{holiday.name}</strong>
              <span>{holiday.date}</span>
              {holiday.notes ? <span>{holiday.notes}</span> : null}
              <div className="record-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handleEdit(holiday)}
                  aria-label={`Edit ${holiday.name}`}
                  disabled={Boolean(deletingHolidayId)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void handleDelete(holiday.id)}
                  aria-label={`Delete ${holiday.name}`}
                  disabled={Boolean(deletingHolidayId)}
                >
                  {deletingHolidayId === holiday.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>No public holidays saved yet.</p>
      )}
      {holidayDialog ? (
        <PublicHolidayDialog
          mode={holidayDialog.mode}
          holiday={holidayDialog.mode === "edit" ? holidayDialog.holiday : null}
          onClose={() => setHolidayDialog(null)}
          onSubmit={handleDialogSubmit}
        />
      ) : null}
    </section>
  );
}

type HolidayDialogState =
  | { mode: "add"; holiday?: undefined }
  | { mode: "edit"; holiday: PublicHoliday }
  | null;

function PublicHolidayDialog({
  mode,
  holiday,
  onClose,
  onSubmit,
}: {
  mode: "add" | "edit";
  holiday: PublicHoliday | null;
  onClose: () => void;
  onSubmit: (holiday: NewPublicHolidayInput) => Promise<void> | void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const title = mode === "edit" ? "Edit public holiday" : "Add public holiday";

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
        aria-labelledby="public-holiday-dialog-title"
        aria-modal="true"
        className="modal-panel"
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="modal-header">
          <div>
            <h3 id="public-holiday-dialog-title">{title}</h3>
          </div>
          <button
            type="button"
            className="secondary-button icon-button"
            aria-label="Close public holiday form"
            onClick={onClose}
          >
            X
          </button>
        </div>
        <PublicHolidayForm
          mode={mode}
          holiday={holiday}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}

function PublicHolidayForm({
  mode,
  holiday,
  onSubmit,
}: {
  mode: "add" | "edit";
  holiday: PublicHoliday | null;
  onSubmit: (holiday: NewPublicHolidayInput) => Promise<void> | void;
}) {
  const [name, setName] = useState(holiday?.name ?? "");
  const [date, setDate] = useState(holiday?.date ?? "");
  const [notes, setNotes] = useState(holiday?.notes ?? "");
  const [error, setError] = useState("");
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Holiday name is required.");
      return;
    }

    if (!isIsoDate(date)) {
      setError("Holiday date must use YYYY-MM-DD format.");
      return;
    }

    try {
      setError("");
      setIsSavingHoliday(true);
      await onSubmit({
        name: name.trim(),
        date,
        notes: notes.trim(),
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to save public holiday.",
      );
    } finally {
      setIsSavingHoliday(false);
    }
  }

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      <label>
        Holiday name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={isSavingHoliday}
        />
      </label>
      <label>
        Holiday date
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          disabled={isSavingHoliday}
        />
      </label>
      <label>
        Holiday notes
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          disabled={isSavingHoliday}
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={isSavingHoliday}>
        {isSavingHoliday
          ? "Saving public holiday..."
          : mode === "edit"
            ? "Save public holiday"
            : "Add public holiday"}
      </button>
    </form>
  );
}

async function saveEditedHoliday(
  holiday: PublicHoliday,
  input: NewPublicHolidayInput,
  onUpdatePublicHoliday?: PublicHolidayPanelProps["onUpdatePublicHoliday"],
): Promise<PublicHoliday> {
  const editedHoliday: PublicHoliday = {
    ...holiday,
    ...input,
    year: Number(input.date.slice(0, 4)),
  };

  if (onUpdatePublicHoliday) {
    return onUpdatePublicHoliday(editedHoliday);
  }

  return editedHoliday;
}

function mergeHolidays(
  currentHolidays: PublicHoliday[],
  nextHolidays: PublicHoliday[],
): PublicHoliday[] {
  const byId = new Map<string, PublicHoliday>();

  for (const holiday of currentHolidays) {
    byId.set(holiday.id, holiday);
  }

  for (const holiday of nextHolidays) {
    byId.set(holiday.id, holiday);
  }

  return [...byId.values()];
}
