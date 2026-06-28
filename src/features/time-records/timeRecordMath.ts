import {
  clampDateRangeToMonth,
  countInclusiveDays,
  isMonthKey,
} from "../../lib/dates";
import type { TimeRecord } from "./types";

export type TimeRecordCounts = {
  sundayOtDays: number;
  publicHolidayWorkDays: number;
  unpaidOffDays: number;
};

export function countTimeRecordsForMonth(
  timeRecords: TimeRecord[],
  month: string,
): TimeRecordCounts {
  if (!isMonthKey(month)) {
    return {
      sundayOtDays: 0,
      publicHolidayWorkDays: 0,
      unpaidOffDays: 0,
    };
  }

  return timeRecords.reduce<TimeRecordCounts>(
    (counts, record) => {
      const overlap = clampDateRangeToMonth(
        record.startDate,
        record.endDate,
        month,
      );

      if (!overlap) {
        return counts;
      }

      const quantity = countInclusiveDays(overlap.startDate, overlap.endDate);

      if (record.type === "SUNDAY_OT") {
        counts.sundayOtDays += quantity;
      }

      if (record.type === "PUBLIC_HOLIDAY_WORK") {
        counts.publicHolidayWorkDays += quantity;
      }

      if (record.type === "OFF_DAY" && record.isPaidOffDay === false) {
        counts.unpaidOffDays += quantity;
      }

      return counts;
    },
    {
      sundayOtDays: 0,
      publicHolidayWorkDays: 0,
      unpaidOffDays: 0,
    },
  );
}

export function timeRecordOverlapsMonth(
  record: TimeRecord,
  month: string,
): boolean {
  if (!isMonthKey(month)) {
    return false;
  }

  return clampDateRangeToMonth(record.startDate, record.endDate, month) !== null;
}
