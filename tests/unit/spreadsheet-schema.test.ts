import { describe, expect, it } from "vitest";
import {
  buildEnsureSchemaRequests,
  getRequiredSheetSchemas,
  headersMatch,
  normalizeHeaderRow,
} from "../../src/integrations/google/spreadsheetSchema";

describe("spreadsheet schema", () => {
  it("defines required sheets and headers from the spec", () => {
    expect(getRequiredSheetSchemas()).toMatchObject({
      Config: [
        "config_id",
        "monthly_salary",
        "effective_start_date",
        "ot_day_divisor",
        "notes",
        "created_at",
      ],
      Advance_Deductions: [
        "advance_deduction_id",
        "advance_id",
        "year_month",
        "amount",
        "notes",
        "created_at",
      ],
    });
  });

  it("normalizes header rows by trimming whitespace", () => {
    expect(normalizeHeaderRow([" config_id ", "monthly_salary\n"])).toEqual([
      "config_id",
      "monthly_salary",
    ]);
  });

  it("detects matching headers after normalization", () => {
    expect(headersMatch([" config_id ", "monthly_salary"], ["config_id", "monthly_salary"])).toBe(true);
  });

  it("builds add-sheet requests for missing sheets only", () => {
    const requests = buildEnsureSchemaRequests({
      sheets: [{ properties: { title: "Config", sheetId: 1 } }],
    });

    expect(requests.some((request) => "addSheet" in request && request.addSheet.properties.title === "Config")).toBe(false);
    expect(requests.some((request) => "addSheet" in request && request.addSheet.properties.title === "Advances")).toBe(true);
  });

  it("builds header update requests for sheets with missing or mismatched headers", () => {
    const requests = buildEnsureSchemaRequests({
      sheets: [
        { properties: { title: "Config", sheetId: 1 }, headerValues: ["wrong"] },
      ],
    });

    expect(
      requests.some(
        (request) =>
          "updateCells" in request &&
          request.updateCells.range.sheetId === 1 &&
          request.updateCells.rows[0].values[0].userEnteredValue.stringValue === "config_id",
      ),
    ).toBe(true);
  });
});
