export type RequiredSheetName =
  | "Config"
  | "Advances"
  | "Advance_Deductions"
  | "Time_Records"
  | "Public_Holidays"
  | "Monthly_Summary";

export type RequiredSheetSchemas = Record<RequiredSheetName, string[]>;

export type SpreadsheetSheetMetadata = {
  properties: {
    title: string;
    sheetId: number;
  };
  headerValues?: string[];
};

export type SpreadsheetMetadata = {
  sheets?: SpreadsheetSheetMetadata[];
};

export type AddSheetRequest = {
  addSheet: {
    properties: {
      title: string;
    };
  };
};

export type UpdateCellsRequest = {
  updateCells: {
    range: {
      sheetId: number;
      startRowIndex: 0;
      endRowIndex: 1;
      startColumnIndex: 0;
      endColumnIndex: number;
    };
    rows: Array<{
      values: Array<{
        userEnteredValue: {
          stringValue: string;
        };
      }>;
    }>;
    fields: "userEnteredValue";
  };
};

export type EnsureSchemaRequest = AddSheetRequest | UpdateCellsRequest;

const requiredSheetSchemas: RequiredSheetSchemas = {
  Config: [
    "config_id",
    "monthly_salary",
    "effective_start_date",
    "ot_day_divisor",
    "default_sunday_off_policy",
    "default_sunday_off_count",
    "notes",
    "created_at",
  ],
  Advances: ["advance_id", "date", "amount", "description", "created_at"],
  Advance_Deductions: [
    "advance_deduction_id",
    "advance_id",
    "year_month",
    "amount",
    "notes",
    "created_at",
  ],
  Time_Records: [
    "time_record_id",
    "record_type",
    "start_date",
    "end_date",
    "quantity",
    "is_paid_off_day",
    "notes",
    "created_at",
  ],
  Public_Holidays: [
    "holiday_id",
    "holiday_name",
    "date",
    "year",
    "source",
    "notes",
    "created_at",
  ],
  Monthly_Summary: [
    "year_month",
    "base_salary",
    "sunday_ot_days",
    "public_holiday_work_days",
    "unpaid_off_days",
    "ot_day_rate",
    "sunday_ot_amount",
    "public_holiday_work_amount",
    "unpaid_off_day_deduction",
    "total_advance_deductions",
    "final_payout",
    "config_effective_start_date",
    "calculated_at",
  ],
};

export function getRequiredSheetSchemas(): RequiredSheetSchemas {
  return { ...requiredSheetSchemas };
}

export function normalizeHeaderRow(headers: string[]): string[] {
  return headers.map((header) => header.trim());
}

export function headersMatch(actual: string[], expected: string[]): boolean {
  const normalizedActual = normalizeHeaderRow(actual);
  return (
    normalizedActual.length >= expected.length &&
    expected.every((header, index) => normalizedActual[index] === header)
  );
}

export function buildEnsureSchemaRequests(
  metadata: SpreadsheetMetadata,
): EnsureSchemaRequest[] {
  const existingSheets = new Map(
    (metadata.sheets ?? []).map((sheet) => [sheet.properties.title, sheet]),
  );
  const requests: EnsureSchemaRequest[] = [];

  for (const [sheetName, headers] of Object.entries(requiredSheetSchemas)) {
    const existingSheet = existingSheets.get(sheetName);

    if (!existingSheet) {
      requests.push({
        addSheet: {
          properties: {
            title: sheetName,
          },
        },
      });
      continue;
    }

    if (!headersMatch(existingSheet.headerValues ?? [], headers)) {
      requests.push(buildHeaderUpdateRequest(existingSheet.properties.sheetId, headers));
    }
  }

  return requests;
}

function buildHeaderUpdateRequest(
  sheetId: number,
  headers: string[],
): UpdateCellsRequest {
  return {
    updateCells: {
      range: {
        sheetId,
        startRowIndex: 0,
        endRowIndex: 1,
        startColumnIndex: 0,
        endColumnIndex: headers.length,
      },
      rows: [
        {
          values: headers.map((header) => ({
            userEnteredValue: {
              stringValue: header,
            },
          })),
        },
      ],
      fields: "userEnteredValue",
    },
  };
}
