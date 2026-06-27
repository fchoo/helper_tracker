import { FormEvent, useMemo, useState } from "react";
import type { TimeRecord } from "../time-records/types";
import type { PublicHoliday } from "./types";
import { getMonthDateRange, isIsoDate } from "../../lib/dates";

export type CalendarScreenProps = {
  selectedMonth: string;
  publicHolidays: PublicHoliday[];
  timeRecords: TimeRecord[];
  onImportPublicHolidays?: (year: number) => Promise<PublicHoliday[]>;
  onAddPublicHoliday?: (
    holiday: NewPublicHolidayInput,
  ) => Promise<PublicHoliday> | PublicHoliday;
  onUpdatePublicHoliday?: (
    holiday: PublicHoliday,
  ) => Promise<PublicHoliday> | PublicHoliday;
  onDeletePublicHoliday?: (holidayId: string) => Promise<void> | void;
};

export type NewPublicHolidayInput = {
  name: string;
  date: string;
  notes?: string;
};

export function CalendarScreen({
  selectedMonth,
  publicHolidays,
  timeRecords,
  onImportPublicHolidays,
  onAddPublicHoliday,
  onUpdatePublicHoliday,
  onDeletePublicHoliday,
}: CalendarScreenProps) {
  const days = useMemo(() => buildCalendarDays(selectedMonth), [selectedMonth]);
  const [managedHolidays, setManagedHolidays] =
    useState<PublicHoliday[]>(publicHolidays);
  const visibleHolidays =
    onImportPublicHolidays ||
    onAddPublicHoliday ||
    onUpdatePublicHoliday ||
    onDeletePublicHoliday
      ? managedHolidays
      : publicHolidays;

  return (
    <section aria-labelledby="calendar-title" className="screen">
      <header className="screen-header">
        <h2 id="calendar-title">Calendar</h2>
        <p>{selectedMonth}</p>
      </header>
      {onImportPublicHolidays ||
      onAddPublicHoliday ||
      onUpdatePublicHoliday ||
      onDeletePublicHoliday ? (
        <PublicHolidayPanel
          holidays={visibleHolidays}
          selectedYear={Number(selectedMonth.slice(0, 4))}
          onImportPublicHolidays={onImportPublicHolidays}
          onAddPublicHoliday={onAddPublicHoliday}
          onUpdatePublicHoliday={onUpdatePublicHoliday}
          onDeletePublicHoliday={onDeletePublicHoliday}
          onHolidaysChange={setManagedHolidays}
        />
      ) : null}
      <div className="calendar-grid" role="list" aria-label="Monthly calendar">
        {days.map((date) => {
          const holidays = visibleHolidays.filter((holiday) => holiday.date === date);
          const records = timeRecords.filter(
            (record) => record.startDate <= date && record.endDate >= date,
          );
          const isSunday = new Date(`${date}T00:00:00.000Z`).getUTCDay() === 0;

          return (
            <article className="calendar-day" key={date} role="listitem">
              <strong>{date.slice(8)}</strong>
              {isSunday ? <span>Sunday</span> : null}
              {holidays.map((holiday) => (
                <span key={holiday.id}>{holiday.name}</span>
              ))}
              {records.map((record) => (
                <span key={record.id}>{formatRecordType(record.type)}</span>
              ))}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PublicHolidayPanel({
  holidays,
  selectedYear,
  onImportPublicHolidays,
  onAddPublicHoliday,
  onUpdatePublicHoliday,
  onDeletePublicHoliday,
  onHolidaysChange,
}: {
  holidays: PublicHoliday[];
  selectedYear: number;
  onImportPublicHolidays?: CalendarScreenProps["onImportPublicHolidays"];
  onAddPublicHoliday?: CalendarScreenProps["onAddPublicHoliday"];
  onUpdatePublicHoliday?: CalendarScreenProps["onUpdatePublicHoliday"];
  onDeletePublicHoliday?: CalendarScreenProps["onDeletePublicHoliday"];
  onHolidaysChange: (holidays: PublicHoliday[]) => void;
}) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [editingHolidayId, setEditingHolidayId] = useState("");
  const [error, setError] = useState("");
  const sortedHolidays = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
  const editingHoliday = holidays.find(
    (holiday) => holiday.id === editingHolidayId,
  );

  async function handleImport() {
    if (!onImportPublicHolidays) {
      return;
    }

    try {
      setError("");
      const importedHolidays = await onImportPublicHolidays(selectedYear);
      onHolidaysChange(mergeHolidays(holidays, importedHolidays));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to import public holidays.",
      );
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

      onHolidaysChange(mergeHolidays(holidays, [savedHoliday]));
      setName("");
      setDate("");
      setNotes("");
      setEditingHolidayId("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to save public holiday.",
      );
    }
  }

  async function handleDelete(holidayId: string) {
    if (onDeletePublicHoliday) {
      await onDeletePublicHoliday(holidayId);
    }

    onHolidaysChange(holidays.filter((holiday) => holiday.id !== holidayId));

    if (editingHolidayId === holidayId) {
      setEditingHolidayId("");
      setName("");
      setDate("");
      setNotes("");
    }
  }

  function handleEdit(holiday: PublicHoliday) {
    setEditingHolidayId(holiday.id);
    setName(holiday.name);
    setDate(holiday.date);
    setNotes(holiday.notes ?? "");
    setError("");
  }

  return (
    <section aria-labelledby="public-holidays-title" className="calendar-panel">
      <div className="panel-header">
        <h3 id="public-holidays-title">Public holidays</h3>
        {onImportPublicHolidays ? (
          <button type="button" onClick={handleImport}>
            Import {selectedYear} holidays
          </button>
        ) : null}
      </div>
      <form className="stack-form" onSubmit={handleAdd}>
        <label>
          Holiday name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Holiday date
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label>
          Notes
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        {onAddPublicHoliday || editingHoliday ? (
          <button type="submit">
            {editingHoliday ? "Save public holiday" : "Add public holiday"}
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
                onClick={() => handleEdit(holiday)}
                aria-label={`Edit ${holiday.name}`}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(holiday.id)}
                aria-label={`Delete ${holiday.name}`}
              >
                Delete
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
  onUpdatePublicHoliday?: CalendarScreenProps["onUpdatePublicHoliday"],
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

function buildCalendarDays(month: string): string[] {
  const range = getMonthDateRange(month);
  const days: string[] = [];
  const current = new Date(`${range.startDate}T00:00:00.000Z`);
  const end = new Date(`${range.endDate}T00:00:00.000Z`);

  while (current <= end) {
    days.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return days;
}

function formatRecordType(type: TimeRecord["type"]): string {
  if (type === "SUNDAY_OT") {
    return "Sunday OT";
  }

  if (type === "PUBLIC_HOLIDAY_WORK") {
    return "Public holiday work";
  }

  return "Off day";
}
