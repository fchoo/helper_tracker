import { describe, expect, it } from "vitest";
import { buildTimeRecordInput } from "../../src/features/time-records/dayEntry";

describe("buildTimeRecordInput", () => {
  it("records Sunday work as Sunday paid work", () => {
    expect(
      buildTimeRecordInput({
        action: "WORKED",
        startDate: "2026-08-09",
        endDate: "2026-08-09",
        publicHolidayDates: new Set(["2026-08-09"]),
        notes: "Worked Sunday",
      }),
    ).toEqual({
      type: "SUNDAY_OT",
      startDate: "2026-08-09",
      endDate: "2026-08-09",
      notes: "Worked Sunday",
    });
  });

  it("does not overcount mixed ranges as Sunday work", () => {
    expect(
      buildTimeRecordInput({
        action: "WORKED",
        startDate: "2026-08-09",
        endDate: "2026-08-10",
        publicHolidayDates: new Set(),
        notes: "Mixed range",
      }),
    ).toBeNull();
  });

  it("does not create extra pay for normal public holiday work", () => {
    expect(
      buildTimeRecordInput({
        action: "WORKED",
        startDate: "2026-08-10",
        endDate: "2026-08-10",
        publicHolidayDates: new Set(["2026-08-10"]),
        notes: "Worked as usual",
      }),
    ).toBeNull();
  });

  it("records public holiday extra pay only when explicitly selected", () => {
    expect(
      buildTimeRecordInput({
        action: "EXTRA_PH_PAY",
        startDate: "2026-08-10",
        endDate: "2026-08-10",
        publicHolidayDates: new Set(["2026-08-10"]),
        notes: "Paid extra",
      }),
    ).toEqual({
      type: "PUBLIC_HOLIDAY_WORK",
      startDate: "2026-08-10",
      endDate: "2026-08-10",
      notes: "Paid extra",
    });
  });

  it("records extra unpaid days off as deductions", () => {
    expect(
      buildTimeRecordInput({
        action: "UNPAID_OFF",
        startDate: "2026-08-11",
        endDate: "2026-08-11",
        publicHolidayDates: new Set(),
        notes: "Unpaid leave",
      }),
    ).toEqual({
      type: "OFF_DAY",
      startDate: "2026-08-11",
      endDate: "2026-08-11",
      isPaidOffDay: false,
      notes: "Unpaid leave",
    });
  });
});
