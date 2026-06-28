import { FormEvent, useMemo, useState } from "react";
import {
  buildTimeRecordInput,
  formatRecordType,
  getDayContext,
  type DayEntryAction,
} from "../time-records/dayEntry";
import type { TimeRecord } from "../time-records/types";
import {
  countTimeRecordsForMonth,
  timeRecordOverlapsMonth,
} from "../time-records/timeRecordMath";
import type { PublicHoliday } from "./types";
import { getMonthDateRange, isIsoDate, isMonthKey } from "../../lib/dates";

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
  onAddTimeRecord?: (record: NewTimeRecordInput) => Promise<void> | void;
};

export type NewPublicHolidayInput = {
  name: string;
  date: string;
  notes?: string;
};

export type NewTimeRecordInput = Omit<TimeRecord, "id" | "createdAt">;

export function CalendarScreen({
  selectedMonth,
  publicHolidays,
  timeRecords,
  onImportPublicHolidays,
  onAddPublicHoliday,
  onUpdatePublicHoliday,
  onDeletePublicHoliday,
  onAddTimeRecord,
}: CalendarScreenProps) {
  const days = useMemo(() => buildCalendarDays(selectedMonth), [selectedMonth]);
  const counts = useMemo(
    () => countTimeRecordsForMonth(timeRecords, selectedMonth),
    [timeRecords, selectedMonth],
  );
  const [managedHolidayState, setManagedHolidayState] = useState({
    sourceHolidays: publicHolidays,
    holidays: publicHolidays,
  });

  if (managedHolidayState.sourceHolidays !== publicHolidays) {
    setManagedHolidayState({
      sourceHolidays: publicHolidays,
      holidays: publicHolidays,
    });
  }

  const setManagedHolidays = (holidays: PublicHoliday[]) => {
    setManagedHolidayState({
      sourceHolidays: publicHolidays,
      holidays,
    });
  };
  const visibleHolidays =
    onImportPublicHolidays ||
    onAddPublicHoliday ||
    onUpdatePublicHoliday ||
    onDeletePublicHoliday
      ? managedHolidayState.holidays
      : publicHolidays;
  const publicHolidayDates = useMemo(
    () => new Set(visibleHolidays.map((holiday) => holiday.date)),
    [visibleHolidays],
  );

  return (
    <section aria-labelledby="calendar-title" className="screen">
      <header className="screen-header">
        <div>
          <h2 id="calendar-title">Time & Calendar</h2>
          <p>{selectedMonth}</p>
        </div>
      </header>
      <section className="summary-grid" aria-label="Monthly time summary">
        <SummaryItem label="Worked Sundays" value={String(counts.sundayOtDays)} />
        <SummaryItem
          label="Extra PH pay"
          value={String(counts.publicHolidayWorkDays)}
        />
        <SummaryItem
          label="Extra unpaid days off"
          value={String(counts.unpaidOffDays)}
        />
        <SummaryItem
          label="Public holidays"
          value={String(
            visibleHolidays.filter((holiday) =>
              holiday.date.startsWith(selectedMonth),
            ).length,
          )}
        />
      </section>
      <div className="calendar-workspace">
        <section className="calendar-tools" aria-label="Time and holiday entry">
          {onAddTimeRecord ? (
            <TimeRecordForm
              publicHolidayDates={publicHolidayDates}
              onSubmit={onAddTimeRecord}
            />
          ) : null}
          <TimeRecordList selectedMonth={selectedMonth} timeRecords={timeRecords} />
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
        </section>
        <section aria-labelledby="month-board-title" className="month-board">
          <div className="panel-header">
            <h3 id="month-board-title">Month view</h3>
          </div>
          <div className="calendar-grid" role="list" aria-label="Monthly calendar">
            {days.map((date) => {
              const holidays = visibleHolidays.filter(
                (holiday) => holiday.date === date,
              );
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
      </div>
    </section>
  );
}

function TimeRecordForm({
  publicHolidayDates,
  onSubmit,
}: {
  publicHolidayDates: Set<string>;
  onSubmit: NonNullable<CalendarScreenProps["onAddTimeRecord"]>;
}) {
  const [action, setAction] = useState<DayEntryAction>("WORKED");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const dayContext = getDayContext(startDate, publicHolidayDates);
  const isPublicHoliday = publicHolidayDates.has(startDate);
  const isSunday = startDate
    ? new Date(`${startDate}T00:00:00.000Z`).getUTCDay() === 0
    : false;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!startDate) {
      setError("Start date is required.");
      return;
    }

    const resolvedEndDate = endDate || startDate;

    if (resolvedEndDate < startDate) {
      setError("End date must be on or after start date.");
      setStatus("");
      return;
    }

    const record = buildTimeRecordInput({
      action,
      startDate,
      endDate: resolvedEndDate,
      publicHolidayDates,
      notes,
    });

    if (!record) {
      setError("");
      setStatus("No payroll change to save.");
      return;
    }

    setError("");
    setStatus("");
    await onSubmit(record);

    setStartDate("");
    setEndDate("");
    setAction("WORKED");
    setNotes("");
  }

  return (
    <form className="stack-form compact-form" onSubmit={handleSubmit}>
      <h3>Add day</h3>
      <div className="form-grid">
        <label>
          Start date
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </label>
        <label>
          End date
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </label>
      </div>
      <p>{dayContext}</p>
      <fieldset className="field-group">
        <legend>What happened?</legend>
        <label className="choice-row">
          <input
            type="radio"
            name="day-entry-action"
            value="WORKED"
            checked={action === "WORKED"}
            onChange={() => setAction("WORKED")}
          />
          Worked
        </label>
        <label className="choice-row">
          <input
            type="radio"
            name="day-entry-action"
            value="RESTED"
            checked={action === "RESTED"}
            onChange={() => setAction("RESTED")}
          />
          Rested / off day
        </label>
        <label className="choice-row">
          <input
            type="radio"
            name="day-entry-action"
            value="UNPAID_OFF"
            checked={action === "UNPAID_OFF"}
            onChange={() => setAction("UNPAID_OFF")}
          />
          Extra unpaid day off
        </label>
        {isPublicHoliday && !isSunday ? (
          <label className="choice-row">
            <input
              type="radio"
              name="day-entry-action"
              value="EXTRA_PH_PAY"
              checked={action === "EXTRA_PH_PAY"}
              onChange={() => setAction("EXTRA_PH_PAY")}
            />
            Pay extra for PH work
          </label>
        ) : null}
      </fieldset>
      <label>
        Time notes
        <input value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      {status ? <p role="status">{status}</p> : null}
      <button type="submit">Save day</button>
    </form>
  );
}

function TimeRecordList({
  selectedMonth,
  timeRecords,
}: {
  selectedMonth: string;
  timeRecords: TimeRecord[];
}) {
  const visibleRecords = timeRecords.filter(
    (record) => timeRecordOverlapsMonth(record, selectedMonth),
  );

  return (
    <section aria-labelledby="time-record-list-title" className="history-panel">
      <div className="panel-header">
        <h3 id="time-record-list-title">Time records</h3>
      </div>
      {visibleRecords.length ? (
        <ul className="record-list scroll-list">
          {visibleRecords.map((record) => (
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
          Holiday notes
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
  if (!isMonthKey(month)) {
    return [];
  }

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
