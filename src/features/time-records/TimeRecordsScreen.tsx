import { FormEvent, useMemo, useState } from "react";
import type { TimeRecord, TimeRecordType } from "./types";
import { countTimeRecordsForMonth } from "./timeRecordMath";

export type NewTimeRecordInput = Omit<TimeRecord, "id" | "createdAt">;

export type TimeRecordsScreenProps = {
  selectedMonth: string;
  timeRecords: TimeRecord[];
  onAddTimeRecord: (record: NewTimeRecordInput) => Promise<void> | void;
};

export function TimeRecordsScreen({
  selectedMonth,
  timeRecords,
  onAddTimeRecord,
}: TimeRecordsScreenProps) {
  const counts = useMemo(
    () => countTimeRecordsForMonth(timeRecords, selectedMonth),
    [timeRecords, selectedMonth],
  );

  return (
    <section aria-labelledby="time-records-title" className="screen">
      <header className="screen-header">
        <h2 id="time-records-title">Time Records</h2>
        <p>Sunday OT: {counts.sundayOtDays}</p>
        <p>Unpaid off days: {counts.unpaidOffDays}</p>
      </header>
      <TimeRecordForm onSubmit={onAddTimeRecord} />
      <TimeRecordList timeRecords={timeRecords} />
    </section>
  );
}

function TimeRecordForm({
  onSubmit,
}: {
  onSubmit: TimeRecordsScreenProps["onAddTimeRecord"];
}) {
  const [type, setType] = useState<TimeRecordType>("OFF_DAY");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isPaidOffDay, setIsPaidOffDay] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!startDate) {
      setError("Start date is required.");
      return;
    }

    const resolvedEndDate = endDate || startDate;

    if (resolvedEndDate < startDate) {
      setError("End date must be on or after start date.");
      return;
    }

    setError("");
    await onSubmit({
      type,
      startDate,
      endDate: resolvedEndDate,
      isPaidOffDay: type === "OFF_DAY" ? isPaidOffDay : undefined,
      notes: notes.trim(),
    });

    setStartDate("");
    setEndDate("");
    setIsPaidOffDay(false);
    setNotes("");
  }

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      <label>
        Record type
        <select
          value={type}
          onChange={(event) => setType(event.target.value as TimeRecordType)}
        >
          <option value="OFF_DAY">Off day</option>
          <option value="SUNDAY_OT">Sunday OT</option>
          <option value="PUBLIC_HOLIDAY_WORK">Public holiday work</option>
        </select>
      </label>
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
      {type === "OFF_DAY" ? (
        <label>
          <input
            type="checkbox"
            checked={isPaidOffDay}
            onChange={(event) => setIsPaidOffDay(event.target.checked)}
          />
          Paid off day
        </label>
      ) : null}
      <label>
        Notes
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit">Save time record</button>
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

function formatRecordType(type: TimeRecordType): string {
  if (type === "SUNDAY_OT") {
    return "Sunday OT";
  }

  if (type === "PUBLIC_HOLIDAY_WORK") {
    return "Public holiday work";
  }

  return "Off day";
}
