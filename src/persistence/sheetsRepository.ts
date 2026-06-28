import type { Advance, AdvanceDeduction } from "../features/advances/types";
import type { PublicHoliday } from "../features/calendar/types";
import type { SalaryConfig } from "../features/config/types";
import type { TimeRecord } from "../features/time-records/types";
import { countInclusiveDays } from "../lib/dates";
import type { SheetsClientLike, GoogleValuesResponse } from "./repositoryTypes";

export class SheetsRepository {
  constructor(
    private readonly spreadsheetId: string,
    private readonly client: SheetsClientLike,
  ) {}

  async listSalaryConfigs(): Promise<SalaryConfig[]> {
    const rows = await this.getDataRows("Config!A:I");
    return rows.filter((row) => cellString(row[0])).map((row) => {
      const possiblePayCycleStartDay = cellNumber(row[4]);
      const hasPayCycleColumn = possiblePayCycleStartDay >= 1 && possiblePayCycleStartDay <= 31;
      const policyIndex = hasPayCycleColumn ? 5 : 4;
      const notesIndex = hasPayCycleColumn ? 7 : 6;
      const createdAtIndex = hasPayCycleColumn ? 8 : 7;
      const policy = cellString(row[policyIndex]);

      if (policy === "FIXED_COUNT" || policy === "ALL_SUNDAYS") {
        return {
          id: cellString(row[0]),
          monthlySalary: cellNumber(row[1]),
          effectiveStartDate: cellString(row[2]),
          otDayDivisor: cellNumber(row[3]),
          payCycleStartDay: hasPayCycleColumn ? possiblePayCycleStartDay : undefined,
          defaultSundayOffPolicy: "ALL_SUNDAYS",
          defaultSundayOffCount: undefined,
          notes: cellString(row[notesIndex]) || undefined,
          createdAt: cellString(row[createdAtIndex]),
        };
      }

      return {
        id: cellString(row[0]),
        monthlySalary: cellNumber(row[1]),
        effectiveStartDate: cellString(row[2]),
        otDayDivisor: cellNumber(row[3]),
        payCycleStartDay: undefined,
        defaultSundayOffPolicy: "ALL_SUNDAYS",
        defaultSundayOffCount: undefined,
        notes: cellString(row[4]) || undefined,
        createdAt: cellString(row[5]),
      };
    });
  }

  addSalaryConfig(config: SalaryConfig): Promise<unknown> {
    return this.client.appendValues(this.spreadsheetId, "Config!A:I", [
      [
        config.id,
        config.monthlySalary,
        config.effectiveStartDate,
        config.otDayDivisor,
        config.payCycleStartDay ?? 1,
        "ALL_SUNDAYS",
        "",
        config.notes ?? "",
        config.createdAt,
      ],
    ]);
  }

  async listAdvances(): Promise<Advance[]> {
    const rows = await this.getDataRows("Advances!A:E");
    return rows.filter((row) => cellString(row[0])).map((row) => ({
      id: cellString(row[0]),
      date: cellString(row[1]),
      amount: cellNumber(row[2]),
      description: cellString(row[3]) || undefined,
      createdAt: cellString(row[4]),
    }));
  }

  async listAdvanceDeductions(): Promise<AdvanceDeduction[]> {
    const rows = await this.getDataRows("Advance_Deductions!A:F");
    return rows.filter((row) => cellString(row[0])).map((row) => ({
      id: cellString(row[0]),
      advanceId: cellString(row[1]),
      month: cellString(row[2]),
      amount: cellNumber(row[3]),
      notes: cellString(row[4]) || undefined,
      createdAt: cellString(row[5]),
    }));
  }

  async addAdvance(
    advance: Advance,
    deductions: AdvanceDeduction[],
  ): Promise<void> {
    await this.client.appendValues(this.spreadsheetId, "Advances!A:E", [
      serializeAdvance(advance),
    ]);

    if (deductions.length) {
      await this.client.appendValues(
        this.spreadsheetId,
        "Advance_Deductions!A:F",
        deductions.map(serializeAdvanceDeduction),
      );
    }
  }

  async updateAdvance(
    advance: Advance,
    deductions: AdvanceDeduction[],
  ): Promise<void> {
    const advanceRowNumber = await this.findRowNumberById("Advances!A:E", advance.id);

    if (advanceRowNumber) {
      await this.client.updateValues(
        this.spreadsheetId,
        buildRowRange("Advances", "E", advanceRowNumber),
        [serializeAdvance(advance)],
      );
    } else {
      await this.client.appendValues(this.spreadsheetId, "Advances!A:E", [
        serializeAdvance(advance),
      ]);
    }

    await this.clearRows(
      "Advance_Deductions",
      "F",
      await this.findRowNumbersByColumnValue(
        "Advance_Deductions!A:F",
        1,
        advance.id,
      ),
    );

    if (deductions.length) {
      await this.client.appendValues(
        this.spreadsheetId,
        "Advance_Deductions!A:F",
        deductions.map(serializeAdvanceDeduction),
      );
    }
  }

  async listTimeRecords(): Promise<TimeRecord[]> {
    const rows = await this.getDataRows("Time_Records!A:H");
    return rows.filter((row) => cellString(row[0])).map((row) => ({
      id: cellString(row[0]),
      type: readTimeRecordType(row[1]),
      startDate: cellString(row[2]),
      endDate: cellString(row[3]),
      isPaidOffDay: cellBoolean(row[5]),
      notes: cellString(row[6]) || undefined,
      createdAt: cellString(row[7]),
    }));
  }

  async addTimeRecord(record: TimeRecord): Promise<unknown> {
    return this.client.appendValues(this.spreadsheetId, "Time_Records!A:H", [
      serializeTimeRecord(record),
    ]);
  }

  async updateTimeRecord(record: TimeRecord): Promise<void> {
    const rowNumber = await this.findRowNumberById("Time_Records!A:H", record.id);

    if (!rowNumber) {
      await this.addTimeRecord(record);
      return;
    }

    await this.client.updateValues(
      this.spreadsheetId,
      buildRowRange("Time_Records", "H", rowNumber),
      [serializeTimeRecord(record)],
    );
  }

  async listPublicHolidays(): Promise<PublicHoliday[]> {
    const rows = await this.getDataRows("Public_Holidays!A:G");
    return rows.filter((row) => cellString(row[0])).map((row) => ({
      id: cellString(row[0]),
      name: cellString(row[1]),
      date: cellString(row[2]),
      year: cellNumber(row[3]),
      source: readPublicHolidaySource(row[4]),
      notes: cellString(row[5]) || undefined,
      createdAt: cellString(row[6]),
    }));
  }

  async addPublicHoliday(holiday: PublicHoliday): Promise<unknown> {
    return this.client.appendValues(this.spreadsheetId, "Public_Holidays!A:G", [
      serializePublicHoliday(holiday),
    ]);
  }

  async upsertPublicHolidays(holidays: PublicHoliday[]): Promise<void> {
    if (!holidays.length) {
      return;
    }

    const existingRows = await this.getRowsById("Public_Holidays!A:G");
    const holidaysToAppend: PublicHoliday[] = [];

    for (const holiday of holidays) {
      const existingRow = existingRows.get(holiday.id);

      if (existingRow) {
        await this.client.updateValues(
          this.spreadsheetId,
          buildRowRange("Public_Holidays", "G", existingRow.rowNumber),
          [serializePublicHoliday(holiday)],
        );
      } else {
        holidaysToAppend.push(holiday);
      }
    }

    if (holidaysToAppend.length) {
      await this.client.appendValues(
        this.spreadsheetId,
        "Public_Holidays!A:G",
        holidaysToAppend.map(serializePublicHoliday),
      );
    }
  }

  async updatePublicHoliday(holiday: PublicHoliday): Promise<void> {
    const rowNumber = await this.findRowNumberById(
      "Public_Holidays!A:G",
      holiday.id,
    );

    if (!rowNumber) {
      await this.addPublicHoliday(holiday);
      return;
    }

    await this.client.updateValues(
      this.spreadsheetId,
      buildRowRange("Public_Holidays", "G", rowNumber),
      [serializePublicHoliday(holiday)],
    );
  }

  async deletePublicHoliday(holidayId: string): Promise<void> {
    await this.clearRows(
      "Public_Holidays",
      "G",
      await this.findRowNumbersByColumnValue("Public_Holidays!A:G", 0, holidayId),
    );
  }

  private async getDataRows(range: string): Promise<unknown[][]> {
    const response = (await this.client.getValues(
      this.spreadsheetId,
      range,
    )) as GoogleValuesResponse;
    return response.values?.slice(1) ?? [];
  }

  private async getRowsById(
    range: string,
  ): Promise<Map<string, { rowNumber: number; row: unknown[] }>> {
    const response = (await this.client.getValues(
      this.spreadsheetId,
      range,
    )) as GoogleValuesResponse;
    const rows = response.values ?? [];
    const rowsById = new Map<string, { rowNumber: number; row: unknown[] }>();

    rows.forEach((row, index) => {
      if (index === 0) {
        return;
      }

      const id = cellString(row[0]);

      if (id) {
        rowsById.set(id, {
          rowNumber: index + 1,
          row,
        });
      }
    });

    return rowsById;
  }

  private async findRowNumberById(
    range: string,
    id: string,
  ): Promise<number | undefined> {
    return (await this.getRowsById(range)).get(id)?.rowNumber;
  }

  private async findRowNumbersByColumnValue(
    range: string,
    columnIndex: number,
    value: string,
  ): Promise<number[]> {
    const response = (await this.client.getValues(
      this.spreadsheetId,
      range,
    )) as GoogleValuesResponse;
    return (response.values ?? []).flatMap((row, index) => {
      if (index === 0 || cellString(row[columnIndex]) !== value) {
        return [];
      }

      return [index + 1];
    });
  }

  private async clearRows(
    sheetName: string,
    lastColumn: string,
    rowNumbers: number[],
  ): Promise<void> {
    const emptyRow = Array.from({ length: columnLetterToNumber(lastColumn) }, () => "");

    await Promise.all(
      rowNumbers.map((rowNumber) =>
        this.client.updateValues(
          this.spreadsheetId,
          buildRowRange(sheetName, lastColumn, rowNumber),
          [emptyRow],
        ),
      ),
    );
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

function cellBoolean(value: unknown): boolean | undefined {
  const normalizedValue = cellString(value).toLowerCase();

  if (!normalizedValue) {
    return undefined;
  }

  if (["true", "yes", "1"].includes(normalizedValue)) {
    return true;
  }

  if (["false", "no", "0"].includes(normalizedValue)) {
    return false;
  }

  return undefined;
}

function serializeAdvance(advance: Advance): unknown[] {
  return [
    advance.id,
    advance.date,
    advance.amount,
    advance.description ?? "",
    advance.createdAt,
  ];
}

function serializeAdvanceDeduction(deduction: AdvanceDeduction): unknown[] {
  return [
    deduction.id,
    deduction.advanceId,
    deduction.month,
    deduction.amount,
    deduction.notes ?? "",
    deduction.createdAt,
  ];
}

function serializeTimeRecord(record: TimeRecord): unknown[] {
  return [
    record.id,
    record.type,
    record.startDate,
    record.endDate,
    countInclusiveDays(record.startDate, record.endDate),
    record.isPaidOffDay === undefined ? "" : record.isPaidOffDay,
    record.notes ?? "",
    record.createdAt,
  ];
}

function serializePublicHoliday(holiday: PublicHoliday): unknown[] {
  return [
    holiday.id,
    holiday.name,
    holiday.date,
    holiday.year,
    holiday.source,
    holiday.notes ?? "",
    holiday.createdAt,
  ];
}

function readTimeRecordType(value: unknown): TimeRecord["type"] {
  const recordType = cellString(value);

  if (
    recordType === "OFF_DAY" ||
    recordType === "SUNDAY_OT" ||
    recordType === "PUBLIC_HOLIDAY_WORK"
  ) {
    return recordType;
  }

  return "OFF_DAY";
}

function readPublicHolidaySource(value: unknown): PublicHoliday["source"] {
  return cellString(value) === "SINGAPORE_IMPORT" ? "SINGAPORE_IMPORT" : "MANUAL";
}

function buildRowRange(
  sheetName: string,
  lastColumn: string,
  rowNumber: number,
): string {
  return `${sheetName}!A${rowNumber}:${lastColumn}${rowNumber}`;
}

function columnLetterToNumber(columnLetter: string): number {
  return columnLetter
    .toUpperCase()
    .split("")
    .reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);
}
