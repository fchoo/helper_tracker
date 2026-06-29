import { beforeEach, describe, expect, it } from "vitest";
import {
  getCachedAppPreferences,
  getCachedSheetRecords,
  setCachedAppPreferences,
  setCachedSheetRecords,
} from "../../src/persistence/cacheDb";

describe("cacheDb", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores spreadsheet metadata and selected month preferences", () => {
    setCachedAppPreferences({
      spreadsheetId: "sheet_123",
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
      selectedMonth: "2026-06",
      payCycleStartDay: 26,
      googleClientId: "1234567890-valid.apps.googleusercontent.com",
    });

    expect(getCachedAppPreferences()).toEqual({
      spreadsheetId: "sheet_123",
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
      selectedMonth: "2026-06",
      payCycleStartDay: 26,
      googleClientId: "1234567890-valid.apps.googleusercontent.com",
    });
  });

  it("removes legacy local spreadsheet placeholders from cached preferences", () => {
    localStorage.setItem(
      "helper-tracker:preferences",
      JSON.stringify({
        spreadsheetId: "local_c4495524-5185-423e-92ac-62ddb0a5f275",
        selectedMonth: "2026-06",
      }),
    );

    expect(getCachedAppPreferences()).toEqual({
      selectedMonth: "2026-06",
    });
    expect(
      JSON.parse(localStorage.getItem("helper-tracker:preferences") ?? "{}"),
    ).toEqual({
      selectedMonth: "2026-06",
    });
  });

  it("derives a browser-local spreadsheet URL when only the id is cached", () => {
    setCachedAppPreferences({
      spreadsheetId: "sheet_123",
    });

    expect(getCachedAppPreferences()).toEqual({
      spreadsheetId: "sheet_123",
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
    });
  });

  it("does not keep mismatched spreadsheet URLs in browser preferences", () => {
    setCachedAppPreferences({
      spreadsheetId: "sheet_123",
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet_other/edit",
    });

    expect(getCachedAppPreferences()).toEqual({
      spreadsheetId: "sheet_123",
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
    });
  });

  it("does not persist legacy local spreadsheet placeholders", () => {
    setCachedAppPreferences({
      spreadsheetId: "local_c4495524-5185-423e-92ac-62ddb0a5f275",
      selectedMonth: "2026-06",
    });

    expect(getCachedAppPreferences()).toEqual({
      selectedMonth: "2026-06",
    });
  });

  it("rejects invalid Google OAuth client ids from browser preferences", () => {
    setCachedAppPreferences({
      googleClientId: "not-a-client-secret",
    });

    expect(getCachedAppPreferences()).toEqual({});
  });

  it("returns empty preferences when nothing is cached", () => {
    expect(getCachedAppPreferences()).toEqual({});
  });

  it("stores last synced sheet records by spreadsheet id", () => {
    setCachedSheetRecords("sheet_123", {
      salaryConfigs: [
        {
          id: "cfg_1",
          monthlySalary: 900,
          effectiveStartDate: "2026-08-01",
          otDayDivisor: 26,
          notes: "Cached salary",
          createdAt: "2026-06-28T12:00:00.000Z",
        },
      ],
      advances: [],
      advanceDeductions: [],
      timeRecords: [],
      publicHolidays: [],
    });

    expect(getCachedSheetRecords("sheet_123").salaryConfigs).toEqual([
      expect.objectContaining({
        id: "cfg_1",
        notes: "Cached salary",
      }),
    ]);
    expect(getCachedSheetRecords("sheet_other").salaryConfigs).toEqual([]);
  });
});
