import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { getMonthDateRange, isMonthKey } from "../../lib/dates";

export type CalendarScreenProps = {
  selectedMonth: string;
  publicHolidays: PublicHoliday[];
  timeRecords: TimeRecord[];
  onAddTimeRecord?: (record: NewTimeRecordInput) => Promise<void> | void;
  onUpdateTimeRecord?: (record: TimeRecord) => Promise<void> | void;
};

export type NewTimeRecordInput = Omit<TimeRecord, "id" | "createdAt">;

type TimeDialogState =
  | { mode: "add"; record?: undefined }
  | { mode: "edit"; record: TimeRecord }
  | null;

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarScreen({
  selectedMonth,
  publicHolidays,
  timeRecords,
  onAddTimeRecord,
  onUpdateTimeRecord,
}: CalendarScreenProps) {
  const days = useMemo(() => buildCalendarDays(selectedMonth), [selectedMonth]);
  const counts = useMemo(
    () => countTimeRecordsForMonth(timeRecords, selectedMonth),
    [timeRecords, selectedMonth],
  );
  const [timeDialog, setTimeDialog] = useState<TimeDialogState>(null);
  const publicHolidayDates = useMemo(
    () => new Set(publicHolidays.map((holiday) => holiday.date)),
    [publicHolidays],
  );

  return (
    <section aria-labelledby="calendar-title" className="screen">
      <header className="screen-header">
        <div>
          <h2 id="calendar-title">Time & Calendar</h2>
          <p>{selectedMonth}</p>
        </div>
        {onAddTimeRecord ? (
          <button type="button" onClick={() => setTimeDialog({ mode: "add" })}>
            Add time
          </button>
        ) : null}
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
            publicHolidays.filter((holiday) => holiday.date.startsWith(selectedMonth))
              .length,
          )}
        />
      </section>
      <div className="calendar-workspace">
        <section
          aria-labelledby="time-record-list-title"
          className="panel-section history-panel"
        >
          <TimeRecordList
            selectedMonth={selectedMonth}
            timeRecords={timeRecords}
            onEditTimeRecord={onUpdateTimeRecord ? openEditDialog : undefined}
          />
        </section>
        <section
          aria-labelledby="month-board-title"
          className="panel-section month-board"
        >
          <div className="panel-header">
            <h3 id="month-board-title">Month view</h3>
          </div>
          <div className="weekday-header" aria-hidden="true">
            {weekdayLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="calendar-grid" role="list" aria-label="Monthly calendar">
            {days.map((date) => {
              const holidays = publicHolidays.filter(
                (holiday) => holiday.date === date,
              );
              const records = timeRecords.filter(
                (record) => record.startDate <= date && record.endDate >= date,
              );
              const isSunday = new Date(`${date}T00:00:00.000Z`).getUTCDay() === 0;

              return (
                <article
                  className={`calendar-day${date.endsWith("-01") ? ` calendar-start-${getWeekdayColumn(date)}` : ""}`}
                  key={date}
                  role="listitem"
                >
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
      {timeDialog ? (
        <TimeRecordDialog
          mode={timeDialog.mode}
          record={timeDialog.mode === "edit" ? timeDialog.record : null}
          publicHolidayDates={publicHolidayDates}
          onClose={() => setTimeDialog(null)}
          onSubmit={handleTimeDialogSubmit}
        />
      ) : null}
    </section>
  );

  function openEditDialog(record: TimeRecord) {
    setTimeDialog({ mode: "edit", record });
  }

  async function handleTimeDialogSubmit(recordInput: NewTimeRecordInput) {
    if (timeDialog?.mode === "edit" && timeDialog.record && onUpdateTimeRecord) {
      await onUpdateTimeRecord({
        ...timeDialog.record,
        ...recordInput,
      });
      setTimeDialog(null);
      return;
    }

    if (onAddTimeRecord) {
      await onAddTimeRecord(recordInput);
      setTimeDialog(null);
    }
  }
}

function TimeRecordDialog({
  mode,
  record,
  publicHolidayDates,
  onClose,
  onSubmit,
}: {
  mode: "add" | "edit";
  record: TimeRecord | null;
  publicHolidayDates: Set<string>;
  onClose: () => void;
  onSubmit: (record: NewTimeRecordInput) => Promise<void> | void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const title = mode === "edit" ? "Edit time" : "Add time";

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
        aria-labelledby="time-dialog-title"
        aria-modal="true"
        className="modal-panel"
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="modal-header">
          <div>
            <h3 id="time-dialog-title">{title}</h3>
          </div>
          <button
            type="button"
            className="secondary-button icon-button"
            aria-label="Close time form"
            onClick={onClose}
          >
            X
          </button>
        </div>
        <TimeRecordForm
          key={record?.id ?? "new-time-record"}
          mode={mode}
          record={record}
          publicHolidayDates={publicHolidayDates}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}

function TimeRecordForm({
  mode,
  record,
  publicHolidayDates,
  onSubmit,
}: {
  mode: "add" | "edit";
  record: TimeRecord | null;
  publicHolidayDates: Set<string>;
  onSubmit: (record: NewTimeRecordInput) => Promise<void> | void;
}) {
  const [action, setAction] = useState<DayEntryAction>(() =>
    actionFromRecord(record),
  );
  const [startDate, setStartDate] = useState(record?.startDate ?? "");
  const [endDate, setEndDate] = useState(record?.endDate ?? "");
  const [notes, setNotes] = useState(record?.notes ?? "");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const dayContext = getDayContext(startDate, publicHolidayDates);
  const isPublicHoliday = publicHolidayDates.has(startDate);
  const isSunday = startDate
    ? new Date(`${startDate}T00:00:00.000Z`).getUTCDay() === 0
    : false;
  const resolvedEndDate = endDate || startDate;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!startDate) {
      setError("Start date is required.");
      return;
    }

    if (resolvedEndDate < startDate) {
      setError("End date must be on or after start date.");
      setStatus("");
      return;
    }

    const nextRecord = buildTimeRecordInput({
      action,
      startDate,
      endDate: resolvedEndDate,
      publicHolidayDates,
      notes,
    });

    if (!nextRecord) {
      setError("");
      setStatus("No payroll change to save.");
      return;
    }

    try {
      setError("");
      setStatus("");
      await onSubmit(nextRecord);

      if (mode === "add") {
        setStartDate("");
        setEndDate("");
        setAction("WORKED");
        setNotes("");
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Failed to save day.",
      );
    }
  }

  function handleStartDateChange(value: string) {
    setStartDate(value);
    if (!endDate || endDate === startDate) {
      setEndDate(value);
    }
  }

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          Start date
          <input
            type="date"
            value={startDate}
            onChange={(event) => handleStartDateChange(event.target.value)}
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
        <div className="choice-card-grid day-action-grid">
          <label className="choice-card">
            <input
              type="radio"
              name="day-entry-action"
              value="WORKED"
              checked={action === "WORKED"}
              onChange={() => setAction("WORKED")}
            />
            <span>Worked</span>
          </label>
          <label className="choice-card">
            <input
              type="radio"
              name="day-entry-action"
              value="RESTED"
              checked={action === "RESTED"}
              onChange={() => setAction("RESTED")}
            />
            <span>Rested / off day</span>
          </label>
          <label className="choice-card">
            <input
              type="radio"
              name="day-entry-action"
              value="UNPAID_OFF"
              checked={action === "UNPAID_OFF"}
              onChange={() => setAction("UNPAID_OFF")}
            />
            <span>Extra unpaid day off</span>
          </label>
          {isPublicHoliday && !isSunday ? (
            <label className="choice-card">
              <input
                type="radio"
                name="day-entry-action"
                value="EXTRA_PH_PAY"
                checked={action === "EXTRA_PH_PAY"}
                onChange={() => setAction("EXTRA_PH_PAY")}
              />
              <span>Pay extra for PH work</span>
            </label>
          ) : null}
        </div>
      </fieldset>
      <label>
        Time notes
        <input value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      {status ? <p role="status">{status}</p> : null}
      <button type="submit">{mode === "edit" ? "Update day" : "Save day"}</button>
    </form>
  );
}

function TimeRecordList({
  selectedMonth,
  timeRecords,
  onEditTimeRecord,
}: {
  selectedMonth: string;
  timeRecords: TimeRecord[];
  onEditTimeRecord?: (record: TimeRecord) => void;
}) {
  const visibleRecords = timeRecords.filter((record) =>
    timeRecordOverlapsMonth(record, selectedMonth),
  );

  return (
    <>
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
              {onEditTimeRecord ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onEditTimeRecord(record)}
                  aria-label="Edit time record"
                >
                  Edit
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>No time records this month.</p>
      )}
    </>
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

function actionFromRecord(record: TimeRecord | null): DayEntryAction {
  if (!record) {
    return "WORKED";
  }

  if (record.type === "PUBLIC_HOLIDAY_WORK") {
    return "EXTRA_PH_PAY";
  }

  if (record.type === "OFF_DAY" && record.isPaidOffDay === false) {
    return "UNPAID_OFF";
  }

  if (record.type === "OFF_DAY") {
    return "RESTED";
  }

  return "WORKED";
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

function getWeekdayColumn(date: string): number {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}
