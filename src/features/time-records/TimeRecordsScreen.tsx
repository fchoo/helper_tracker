import { FormEvent, useMemo, useState } from "react";
import type { PublicHoliday } from "../calendar/types";
import {
  buildTimeRecordInput,
  formatRecordType,
  getDayContext,
  type DayEntryAction,
} from "./dayEntry";
import type { TimeRecord } from "./types";
import { countTimeRecordsForMonth } from "./timeRecordMath";

export type NewTimeRecordInput = Omit<TimeRecord, "id" | "createdAt">;

export type TimeRecordsScreenProps = {
  selectedMonth: string;
  publicHolidays?: PublicHoliday[];
  timeRecords: TimeRecord[];
  onAddTimeRecord: (record: NewTimeRecordInput) => Promise<void> | void;
};

export function TimeRecordsScreen({
  selectedMonth,
  publicHolidays = [],
  timeRecords,
  onAddTimeRecord,
}: TimeRecordsScreenProps) {
  const counts = useMemo(
    () => countTimeRecordsForMonth(timeRecords, selectedMonth),
    [timeRecords, selectedMonth],
  );
  const publicHolidayDates = useMemo(
    () => new Set(publicHolidays.map((holiday) => holiday.date)),
    [publicHolidays],
  );

  return (
    <section aria-labelledby="time-records-title" className="screen">
      <header className="screen-header">
        <h2 id="time-records-title">Time Records</h2>
        <p>Worked Sundays: {counts.sundayOtDays}</p>
        <p>Extra unpaid days off: {counts.unpaidOffDays}</p>
      </header>
      <TimeRecordForm
        publicHolidayDates={publicHolidayDates}
        onSubmit={onAddTimeRecord}
      />
      <TimeRecordList timeRecords={timeRecords} />
    </section>
  );
}

function TimeRecordForm({
  publicHolidayDates,
  onSubmit,
}: {
  publicHolidayDates: Set<string>;
  onSubmit: TimeRecordsScreenProps["onAddTimeRecord"];
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
    <form className="stack-form" onSubmit={handleSubmit}>
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
        <label>
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
        Notes
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      {status ? <p role="status">{status}</p> : null}
      <button type="submit">Save day</button>
    </form>
  );
}

function TimeRecordList({ timeRecords }: { timeRecords: TimeRecord[] }) {
  if (!timeRecords.length) {
    return <p>No time records saved yet.</p>;
  }

  return (
    <ul className="record-list">
      {timeRecords.map((record) => (
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
  );
}
