import { FormEvent, useState } from "react";
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
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [editingHolidayId, setEditingHolidayId] = useState("");
  const [error, setError] = useState("");
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);
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
  const editingHoliday = visibleHolidays.find(
    (holiday) => holiday.id === editingHolidayId,
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

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!onAddPublicHoliday && !editingHoliday) {
      return;
    }

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
      const input = {
        name: name.trim(),
        date,
        notes: notes.trim(),
      };
      const savedHoliday = editingHoliday
        ? await saveEditedHoliday(editingHoliday, input, onUpdatePublicHoliday)
        : await onAddPublicHoliday?.(input);

      if (!savedHoliday) {
        return;
      }

      setVisibleHolidays(mergeHolidays(visibleHolidays, [savedHoliday]));
      resetForm();
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

      if (editingHolidayId === holidayId) {
        resetForm();
      }
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
    setEditingHolidayId(holiday.id);
    setName(holiday.name);
    setDate(holiday.date);
    setNotes(holiday.notes ?? "");
    setError("");
  }

  function resetForm() {
    setName("");
    setDate("");
    setNotes("");
    setEditingHolidayId("");
  }

  function setVisibleHolidays(nextHolidays: PublicHoliday[]) {
    setLocalHolidays({
      sourceHolidays: holidays,
      holidays: nextHolidays,
    });
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
        {onImportPublicHolidays ? (
          <button
            type="button"
            onClick={handleImport}
            disabled={isImportingHolidays}
          >
            {isImportingHolidays
              ? `Importing ${selectedYear}...`
              : `Import ${selectedYear} holidays`}
          </button>
        ) : null}
      </div>
      <form className="stack-form" onSubmit={handleAdd}>
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
        {onAddPublicHoliday || editingHoliday ? (
          <button type="submit" disabled={isSavingHoliday}>
            {isSavingHoliday
              ? "Saving public holiday..."
              : editingHoliday
                ? "Save public holiday"
                : "Add public holiday"}
          </button>
        ) : null}
      </form>
      {sortedHolidays.length ? (
        <ul className="record-list">
          {sortedHolidays.map((holiday) => (
            <li key={holiday.id}>
              <strong>{holiday.name}</strong>
              <span>{holiday.date}</span>
              {holiday.notes ? <span>{holiday.notes}</span> : null}
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
            </li>
          ))}
        </ul>
      ) : (
        <p>No public holidays saved yet.</p>
      )}
    </section>
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
