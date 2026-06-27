export type DateRange = {
  startDate: string;
  endDate: string;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const monthPattern = /^\d{4}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!datePattern.test(value)) {
    return false;
  }

  const date = parseIsoDate(value);
  return formatIsoDate(date) === value;
}

export function isMonthKey(value: string): boolean {
  if (!monthPattern.test(value)) {
    return false;
  }

  const [, month] = value.split("-").map(Number);
  return month >= 1 && month <= 12;
}

export function toMonthKey(date: string): string {
  assertIsoDate(date);
  return date.slice(0, 7);
}

export function getMonthDateRange(monthKey: string): DateRange {
  assertMonthKey(monthKey);
  const [year, month] = monthKey.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));

  return {
    startDate: formatIsoDate(startDate),
    endDate: formatIsoDate(endDate),
  };
}

export function countInclusiveDays(startDate: string, endDate: string): number {
  const start = parseValidatedIsoDate(startDate);
  const end = parseValidatedIsoDate(endDate);

  if (end < start) {
    throw new Error("End date must be on or after start date.");
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
}

export function clampDateRangeToMonth(
  startDate: string,
  endDate: string,
  monthKey: string,
): DateRange | null {
  const start = parseValidatedIsoDate(startDate);
  const end = parseValidatedIsoDate(endDate);
  const monthRange = getMonthDateRange(monthKey);
  const monthStart = parseIsoDate(monthRange.startDate);
  const monthEnd = parseIsoDate(monthRange.endDate);

  if (end < start) {
    throw new Error("End date must be on or after start date.");
  }

  const clampedStart = start > monthStart ? start : monthStart;
  const clampedEnd = end < monthEnd ? end : monthEnd;

  if (clampedEnd < clampedStart) {
    return null;
  }

  return {
    startDate: formatIsoDate(clampedStart),
    endDate: formatIsoDate(clampedEnd),
  };
}

export function isDateInMonth(date: string, monthKey: string): boolean {
  assertIsoDate(date);
  assertMonthKey(monthKey);
  return toMonthKey(date) === monthKey;
}

export function parseValidatedIsoDate(value: string): Date {
  assertIsoDate(value);
  return parseIsoDate(value);
}

export function assertIsoDate(value: string): void {
  if (!isIsoDate(value)) {
    throw new Error("Date must use YYYY-MM-DD format.");
  }
}

export function assertMonthKey(value: string): void {
  if (!isMonthKey(value)) {
    throw new Error("Month must use YYYY-MM format.");
  }
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
