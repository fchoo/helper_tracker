import { describe, expect, it } from "vitest";
import {
  advanceDeductionSchema,
  advanceSchema,
  publicHolidaySchema,
  salaryConfigSchema,
  timeRecordSchema,
} from "../../src/lib/validation";

describe("domain validation schemas", () => {
  it("accepts a valid salary config", () => {
    const result = salaryConfigSchema.parse({
      id: "cfg_1",
      monthlySalary: 900,
      effectiveStartDate: "2026-06-01",
      otDayDivisor: 26,
      notes: "",
      createdAt: "2026-06-27T12:00:00.000Z",
    });

    expect(result.monthlySalary).toBe(900);
  });

  it("rejects a salary config with invalid money", () => {
    expect(() =>
      salaryConfigSchema.parse({
        id: "cfg_1",
        monthlySalary: 0,
        effectiveStartDate: "2026-06-01",
        otDayDivisor: 26,
        createdAt: "2026-06-27T12:00:00.000Z",
      }),
    ).toThrow();
  });

  it("accepts split advance deduction records", () => {
    expect(
      advanceDeductionSchema.parse({
        id: "ded_1",
        advanceId: "adv_1",
        month: "2026-06",
        amount: 100,
        notes: "First deduction",
        createdAt: "2026-06-27T12:00:00.000Z",
      }).month,
    ).toBe("2026-06");
  });

  it("accepts the core raw record shapes", () => {
    expect(
      advanceSchema.parse({
        id: "adv_1",
        date: "2026-06-27",
        amount: 200,
        description: "Advance",
        createdAt: "2026-06-27T12:00:00.000Z",
      }).id,
    ).toBe("adv_1");

    expect(
      timeRecordSchema.parse({
        id: "time_1",
        type: "SUNDAY_OT",
        startDate: "2026-06-07",
        endDate: "2026-06-07",
        notes: "Worked Sunday",
        createdAt: "2026-06-27T12:00:00.000Z",
      }).type,
    ).toBe("SUNDAY_OT");

    expect(
      publicHolidaySchema.parse({
        id: "holiday_1",
        name: "National Day",
        date: "2026-08-09",
        year: 2026,
        source: "SINGAPORE_IMPORT",
        createdAt: "2026-06-27T12:00:00.000Z",
      }).source,
    ).toBe("SINGAPORE_IMPORT");
  });
});
