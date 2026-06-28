import { describe, expect, it, vi } from "vitest";
import type { SalaryConfig } from "../../src/features/config/types";
import { SheetsRepository } from "../../src/persistence/sheetsRepository";

describe("SheetsRepository", () => {
  it("reads salary configs from the Config sheet", async () => {
    const client = {
      getValues: vi.fn().mockResolvedValue({
        values: [
          [
            "config_id",
            "monthly_salary",
            "effective_start_date",
            "ot_day_divisor",
            "default_sunday_off_policy",
            "default_sunday_off_count",
            "notes",
            "created_at",
          ],
          [
            "cfg_1",
            "900",
            "2026-06-01",
            "26",
            "FIXED_COUNT",
            "4",
            "Initial",
            "2026-06-27T12:00:00.000Z",
          ],
        ],
      }),
      appendValues: vi.fn(),
      updateValues: vi.fn(),
    };
    const repository = new SheetsRepository("sheet_123", client);

    const expected: SalaryConfig[] = [
      {
        id: "cfg_1",
        monthlySalary: 900,
        effectiveStartDate: "2026-06-01",
        otDayDivisor: 26,
        defaultSundayOffPolicy: "ALL_SUNDAYS",
        defaultSundayOffCount: undefined,
        notes: "Initial",
        createdAt: "2026-06-27T12:00:00.000Z",
      },
    ];

    await expect(repository.listSalaryConfigs()).resolves.toEqual(expected);
  });

  it("appends salary configs using the spec header order", async () => {
    const client = {
      getValues: vi.fn(),
      appendValues: vi.fn().mockResolvedValue({}),
      updateValues: vi.fn(),
    };
    const repository = new SheetsRepository("sheet_123", client);

    await repository.addSalaryConfig({
      id: "cfg_1",
      monthlySalary: 900,
      effectiveStartDate: "2026-06-01",
      otDayDivisor: 26,
      defaultSundayOffPolicy: "FIXED_COUNT",
      defaultSundayOffCount: 4,
      notes: "Initial",
      createdAt: "2026-06-27T12:00:00.000Z",
    });

    expect(client.appendValues).toHaveBeenCalledWith("sheet_123", "Config!A:H", [
      [
        "cfg_1",
        900,
        "2026-06-01",
        26,
        "ALL_SUNDAYS",
        "",
        "Initial",
        "2026-06-27T12:00:00.000Z",
      ],
    ]);
  });

  it("reads advances and split deductions", async () => {
    const client = {
      getValues: vi
        .fn()
        .mockResolvedValueOnce({
          values: [
            ["advance_id", "date", "amount", "description", "created_at"],
            ["adv_1", "2026-06-01", "300", "Advance", "2026-06-27T12:00:00.000Z"],
          ],
        })
        .mockResolvedValueOnce({
          values: [
            ["advance_deduction_id", "advance_id", "year_month", "amount", "notes", "created_at"],
            ["ded_1", "adv_1", "2026-06", "100", "Part 1", "2026-06-27T12:00:00.000Z"],
          ],
        }),
      appendValues: vi.fn(),
      updateValues: vi.fn(),
    };
    const repository = new SheetsRepository("sheet_123", client);

    await expect(repository.listAdvances()).resolves.toHaveLength(1);
    await expect(repository.listAdvanceDeductions()).resolves.toEqual([
      {
        id: "ded_1",
        advanceId: "adv_1",
        month: "2026-06",
        amount: 100,
        notes: "Part 1",
        createdAt: "2026-06-27T12:00:00.000Z",
      },
    ]);
  });
});
