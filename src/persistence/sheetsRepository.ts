import type { Advance, AdvanceDeduction } from "../features/advances/types";
import type { SalaryConfig } from "../features/config/types";
import type { SheetsClientLike, GoogleValuesResponse } from "./repositoryTypes";

export class SheetsRepository {
  constructor(
    private readonly spreadsheetId: string,
    private readonly client: SheetsClientLike,
  ) {}

  async listSalaryConfigs(): Promise<SalaryConfig[]> {
    const rows = await this.getDataRows("Config!A:H");
    return rows.map((row) => {
      const policy = cellString(row[4]);

      if (policy === "FIXED_COUNT" || policy === "ALL_SUNDAYS") {
        return {
          id: cellString(row[0]),
          monthlySalary: cellNumber(row[1]),
          effectiveStartDate: cellString(row[2]),
          otDayDivisor: cellNumber(row[3]),
          defaultSundayOffPolicy: "ALL_SUNDAYS",
          defaultSundayOffCount: undefined,
          notes: cellString(row[6]) || undefined,
          createdAt: cellString(row[7]),
        };
      }

      return {
        id: cellString(row[0]),
        monthlySalary: cellNumber(row[1]),
        effectiveStartDate: cellString(row[2]),
        otDayDivisor: cellNumber(row[3]),
        defaultSundayOffPolicy: "ALL_SUNDAYS",
        defaultSundayOffCount: undefined,
        notes: cellString(row[4]) || undefined,
        createdAt: cellString(row[5]),
      };
    });
  }

  addSalaryConfig(config: SalaryConfig): Promise<unknown> {
    return this.client.appendValues(this.spreadsheetId, "Config!A:H", [
      [
        config.id,
        config.monthlySalary,
        config.effectiveStartDate,
        config.otDayDivisor,
        "ALL_SUNDAYS",
        "",
        config.notes ?? "",
        config.createdAt,
      ],
    ]);
  }

  async listAdvances(): Promise<Advance[]> {
    const rows = await this.getDataRows("Advances!A:E");
    return rows.map((row) => ({
      id: cellString(row[0]),
      date: cellString(row[1]),
      amount: cellNumber(row[2]),
      description: cellString(row[3]) || undefined,
      createdAt: cellString(row[4]),
    }));
  }

  async listAdvanceDeductions(): Promise<AdvanceDeduction[]> {
    const rows = await this.getDataRows("Advance_Deductions!A:F");
    return rows.map((row) => ({
      id: cellString(row[0]),
      advanceId: cellString(row[1]),
      month: cellString(row[2]),
      amount: cellNumber(row[3]),
      notes: cellString(row[4]) || undefined,
      createdAt: cellString(row[5]),
    }));
  }

  private async getDataRows(range: string): Promise<unknown[][]> {
    const response = (await this.client.getValues(
      this.spreadsheetId,
      range,
    )) as GoogleValuesResponse;
    return response.values?.slice(1) ?? [];
  }
}

function cellString(value: unknown): string {
  return String(value ?? "").trim();
}

function cellNumber(value: unknown): number {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return number;
}
