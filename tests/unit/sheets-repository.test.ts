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
            "pay_cycle_start_day",
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
        payCycleStartDay: 26,
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
      payCycleStartDay: 26,
      defaultSundayOffPolicy: "FIXED_COUNT",
      defaultSundayOffCount: 4,
      notes: "Initial",
      createdAt: "2026-06-27T12:00:00.000Z",
    });

    expect(client.appendValues).toHaveBeenCalledWith("sheet_123", "Config!A:I", [
      [
        "cfg_1",
        900,
        "2026-06-01",
        26,
        26,
        "ALL_SUNDAYS",
        "",
        "Initial",
        "2026-06-27T12:00:00.000Z",
      ],
    ]);
  });

  it("updates salary configs in place by id", async () => {
    const client = {
      getValues: vi.fn().mockResolvedValue({
        values: [
          [
            "config_id",
            "monthly_salary",
            "effective_start_date",
            "ot_day_divisor",
            "pay_cycle_start_day",
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
            "26",
            "ALL_SUNDAYS",
            "",
            "Initial",
            "2026-06-27T12:00:00.000Z",
          ],
        ],
      }),
      appendValues: vi.fn().mockResolvedValue({}),
      updateValues: vi.fn().mockResolvedValue({}),
    };
    const repository = new SheetsRepository("sheet_123", client);

    await repository.updateSalaryConfig({
      id: "cfg_1",
      monthlySalary: 920,
      effectiveStartDate: "2026-06-01",
      otDayDivisor: 26,
      payCycleStartDay: 26,
      notes: "Updated",
      createdAt: "2026-06-27T12:00:00.000Z",
    });

    expect(client.updateValues).toHaveBeenCalledWith("sheet_123", "Config!A2:I2", [
      [
        "cfg_1",
        920,
        "2026-06-01",
        26,
        26,
        "ALL_SUNDAYS",
        "",
        "Updated",
        "2026-06-27T12:00:00.000Z",
      ],
    ]);
    expect(client.appendValues).not.toHaveBeenCalled();
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

  it("writes and replaces advances with their deduction schedule", async () => {
    const client = {
      getValues: vi
        .fn()
        .mockResolvedValueOnce({
          values: [
            ["advance_id", "date", "amount", "description", "created_at"],
            ["adv_1", "2026-06-01", "300", "Loan", "2026-06-27T12:00:00.000Z"],
          ],
        })
        .mockResolvedValueOnce({
          values: [
            ["advance_deduction_id", "advance_id", "year_month", "amount", "notes", "created_at"],
            ["ded_old", "adv_1", "2026-06", "300", "Old", "2026-06-27T12:00:00.000Z"],
          ],
        }),
      appendValues: vi.fn().mockResolvedValue({}),
      updateValues: vi.fn().mockResolvedValue({}),
    };
    const repository = new SheetsRepository("sheet_123", client);

    await repository.updateAdvance(
      {
        id: "adv_1",
        date: "2026-06-02",
        amount: 250,
        description: "Updated loan",
        createdAt: "2026-06-27T12:00:00.000Z",
      },
      [
        {
          id: "ded_new",
          advanceId: "adv_1",
          month: "2026-07",
          amount: 250,
          notes: "New",
          createdAt: "2026-06-28T12:00:00.000Z",
        },
      ],
    );

    expect(client.updateValues).toHaveBeenCalledWith("sheet_123", "Advances!A2:E2", [
      [
        "adv_1",
        "2026-06-02",
        250,
        "Updated loan",
        "2026-06-27T12:00:00.000Z",
      ],
    ]);
    expect(client.updateValues).toHaveBeenCalledWith(
      "sheet_123",
      "Advance_Deductions!A2:F2",
      [["", "", "", "", "", ""]],
    );
    expect(client.appendValues).toHaveBeenCalledWith(
      "sheet_123",
      "Advance_Deductions!A:F",
      [
        [
          "ded_new",
          "adv_1",
          "2026-07",
          250,
          "New",
          "2026-06-28T12:00:00.000Z",
        ],
      ],
    );
  });

  it("reads and writes time records", async () => {
    const client = {
      getValues: vi.fn().mockResolvedValue({
        values: [
          [
            "time_record_id",
            "record_type",
            "start_date",
            "end_date",
            "quantity",
            "is_paid_off_day",
            "notes",
            "created_at",
          ],
          [
            "time_1",
            "OFF_DAY",
            "2026-06-10",
            "2026-06-11",
            "2",
            "FALSE",
            "Unpaid leave",
            "2026-06-27T12:00:00.000Z",
          ],
        ],
      }),
      appendValues: vi.fn().mockResolvedValue({}),
      updateValues: vi.fn().mockResolvedValue({}),
    };
    const repository = new SheetsRepository("sheet_123", client);

    await expect(repository.listTimeRecords()).resolves.toEqual([
      {
        id: "time_1",
        type: "OFF_DAY",
        startDate: "2026-06-10",
        endDate: "2026-06-11",
        isPaidOffDay: false,
        notes: "Unpaid leave",
        createdAt: "2026-06-27T12:00:00.000Z",
      },
    ]);

    await repository.addTimeRecord({
      id: "time_2",
      type: "SUNDAY_OT",
      startDate: "2026-06-14",
      endDate: "2026-06-14",
      notes: "Worked Sunday",
      createdAt: "2026-06-28T12:00:00.000Z",
    });

    expect(client.appendValues).toHaveBeenCalledWith("sheet_123", "Time_Records!A:H", [
      [
        "time_2",
        "SUNDAY_OT",
        "2026-06-14",
        "2026-06-14",
        1,
        "",
        "Worked Sunday",
        "2026-06-28T12:00:00.000Z",
      ],
    ]);
  });

  it("upserts and deletes public holidays", async () => {
    const client = {
      getValues: vi
        .fn()
        .mockResolvedValueOnce({
          values: [
            ["holiday_id", "holiday_name", "date", "year", "source", "notes", "created_at"],
            ["holiday_1", "Old name", "2026-08-09", "2026", "MANUAL", "", "2026-06-27T12:00:00.000Z"],
          ],
        })
        .mockResolvedValueOnce({
          values: [
            ["holiday_id", "holiday_name", "date", "year", "source", "notes", "created_at"],
            ["holiday_1", "National Day", "2026-08-09", "2026", "MANUAL", "", "2026-06-27T12:00:00.000Z"],
          ],
        }),
      appendValues: vi.fn().mockResolvedValue({}),
      updateValues: vi.fn().mockResolvedValue({}),
    };
    const repository = new SheetsRepository("sheet_123", client);

    await repository.upsertPublicHolidays([
      {
        id: "holiday_1",
        name: "National Day",
        date: "2026-08-09",
        year: 2026,
        source: "SINGAPORE_IMPORT",
        notes: "Sunday",
        createdAt: "2026-06-28T12:00:00.000Z",
      },
      {
        id: "holiday_2",
        name: "Observed holiday",
        date: "2026-08-10",
        year: 2026,
        source: "MANUAL",
        createdAt: "2026-06-28T12:00:00.000Z",
      },
    ]);
    await repository.deletePublicHoliday("holiday_1");

    expect(client.updateValues).toHaveBeenCalledWith(
      "sheet_123",
      "Public_Holidays!A2:G2",
      [
        [
          "holiday_1",
          "National Day",
          "2026-08-09",
          2026,
          "SINGAPORE_IMPORT",
          "Sunday",
          "2026-06-28T12:00:00.000Z",
        ],
      ],
    );
    expect(client.appendValues).toHaveBeenCalledWith(
      "sheet_123",
      "Public_Holidays!A:G",
      [
        [
          "holiday_2",
          "Observed holiday",
          "2026-08-10",
          2026,
          "MANUAL",
          "",
          "2026-06-28T12:00:00.000Z",
        ],
      ],
    );
    expect(client.updateValues).toHaveBeenCalledWith(
      "sheet_123",
      "Public_Holidays!A2:G2",
      [["", "", "", "", "", "", ""]],
    );
  });
});
