import type { TimeRecord } from "./types";

export type DayEntryAction =
  | "WORKED"
  | "RESTED"
  | "UNPAID_OFF"
  | "EXTRA_PH_PAY";

export type DayEntryInput = {
  action: DayEntryAction;
  startDate: string;
  endDate: string;
  publicHolidayDates: Set<string>;
  notes: string;
};

export function buildTimeRecordInput(
  input: DayEntryInput,
): Omit<TimeRecord, "id" | "createdAt"> | null {
  const notes = input.notes.trim();
  const baseRecord = {
    startDate: input.startDate,
    endDate: input.endDate,
    notes,
  };

  if (input.action === "EXTRA_PH_PAY") {
    return {
      ...baseRecord,
      type: "PUBLIC_HOLIDAY_WORK",
    };
  }

  if (input.action === "UNPAID_OFF") {
    return {
      ...baseRecord,
      type: "OFF_DAY",
      isPaidOffDay: false,
    };
  }

  if (input.action === "RESTED") {
    if (rangeIsOnlySundays(input.startDate, input.endDate)) {
      return null;
    }

    return {
      ...baseRecord,
      type: "OFF_DAY",
      isPaidOffDay: true,
    };
  }

  if (rangeIsOnlySundays(input.startDate, input.endDate)) {
    return {
      ...baseRecord,
      type: "SUNDAY_OT",
    };
  }

  return null;
}

export function getDayContext(
  startDate: string,
  publicHolidayDates: Set<string>,
): string {
  if (!startDate) {
    return "Select a date to see the default work/rest assumption.";
  }

  const isSunday = isSundayDate(startDate);
  const isPublicHoliday = publicHolidayDates.has(startDate);

  if (isSunday) {
    return isPublicHoliday
      ? "Sunday rest day. Public holiday is noted, but Sunday rest takes priority."
      : "Sunday rest day by default.";
  }

  if (isPublicHoliday) {
    return "Public holiday, expected to work by default.";
  }

  return "Expected to work by default.";
}

export function formatRecordType(type: TimeRecord["type"]): string {
  if (type === "SUNDAY_OT") {
    return "Worked Sunday";
  }

  if (type === "PUBLIC_HOLIDAY_WORK") {
    return "Extra PH pay";
  }

  return "Off day";
}

function rangeIsOnlySundays(startDate: string, endDate: string): boolean {
  const dates = walkDateRange(startDate, endDate);
  return dates.length > 0 && dates.every(isSundayDate);
}

function walkDateRange(startDate: string, endDate: string): string[] {
  const current = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const dates: string[] = [];

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

function isSundayDate(date: string): boolean {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay() === 0;
}
