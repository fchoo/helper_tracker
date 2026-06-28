import { describe, expect, it } from "vitest";
import {
  clampDateRangeToMonth,
  clampDateRangeToRange,
  countInclusiveDays,
  getCycleDateRange,
  getMonthDateRange,
  getPayCycleDateRangeForPayMonth,
  getPayDateForPayMonth,
  isDateInMonth,
  toMonthKey,
} from "../../src/lib/dates";
import { formatSgd, parseMoneyInput, roundMoney } from "../../src/lib/money";

describe("date helpers", () => {
  it("normalizes dates to month keys", () => {
    expect(toMonthKey("2026-06-27")).toBe("2026-06");
  });

  it("builds a calendar month date range", () => {
    expect(getMonthDateRange("2026-02")).toEqual({
      startDate: "2026-02-01",
      endDate: "2026-02-28",
    });
  });

  it("builds a pay cycle date range from the configured start day", () => {
    expect(getCycleDateRange("2026-06", 26)).toEqual({
      startDate: "2026-06-26",
      endDate: "2026-07-25",
    });
  });

  it("clamps pay cycle boundaries to the end of short months", () => {
    expect(getCycleDateRange("2026-02", 31)).toEqual({
      startDate: "2026-02-28",
      endDate: "2026-03-30",
    });
  });

  it("builds a pay date from the selected pay month", () => {
    expect(getPayDateForPayMonth("2026-08", 26)).toBe("2026-08-26");
  });

  it("builds the pay cycle ending before the pay date month", () => {
    expect(getPayCycleDateRangeForPayMonth("2026-08", 26)).toEqual({
      startDate: "2026-07-26",
      endDate: "2026-08-25",
    });
  });

  it("clamps pay-month cycle boundaries to short months", () => {
    expect(getPayCycleDateRangeForPayMonth("2026-03", 31)).toEqual({
      startDate: "2026-02-28",
      endDate: "2026-03-30",
    });
    expect(getPayDateForPayMonth("2026-02", 31)).toBe("2026-02-28");
  });

  it("counts inclusive days across a valid range", () => {
    expect(countInclusiveDays("2026-06-01", "2026-06-03")).toBe(3);
  });

  it("clamps an overlapping date range to the selected month", () => {
    expect(clampDateRangeToMonth("2026-05-30", "2026-06-02", "2026-06")).toEqual({
      startDate: "2026-06-01",
      endDate: "2026-06-02",
    });
  });

  it("clamps an overlapping date range to a custom pay cycle", () => {
    expect(
      clampDateRangeToRange("2026-06-25", "2026-06-27", {
        startDate: "2026-06-26",
        endDate: "2026-07-25",
      }),
    ).toEqual({
      startDate: "2026-06-26",
      endDate: "2026-06-27",
    });
  });

  it("returns null when a date range does not overlap the selected month", () => {
    expect(clampDateRangeToMonth("2026-05-01", "2026-05-31", "2026-06")).toBeNull();
  });

  it("detects whether a date is inside a month", () => {
    expect(isDateInMonth("2026-06-27", "2026-06")).toBe(true);
    expect(isDateInMonth("2026-07-01", "2026-06")).toBe(false);
  });
});

describe("money helpers", () => {
  it("rounds money to two decimals", () => {
    expect(roundMoney(123.456)).toBe(123.46);
  });

  it("parses numeric input as money", () => {
    expect(parseMoneyInput(" 42.50 ")).toBe(42.5);
  });

  it("rejects invalid money input", () => {
    expect(() => parseMoneyInput("abc")).toThrow("Enter a valid amount.");
  });

  it("formats SGD currency consistently", () => {
    expect(formatSgd(1234.5)).toBe("SGD 1,234.50");
  });
});
