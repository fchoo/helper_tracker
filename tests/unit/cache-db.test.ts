import { beforeEach, describe, expect, it } from "vitest";
import {
  getCachedAppPreferences,
  setCachedAppPreferences,
} from "../../src/persistence/cacheDb";

describe("cacheDb", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores spreadsheet metadata and selected month preferences", () => {
    setCachedAppPreferences({
      spreadsheetId: "sheet_123",
      selectedMonth: "2026-06",
      payCycleStartDay: 26,
    });

    expect(getCachedAppPreferences()).toEqual({
      spreadsheetId: "sheet_123",
      selectedMonth: "2026-06",
      payCycleStartDay: 26,
    });
  });

  it("returns empty preferences when nothing is cached", () => {
    expect(getCachedAppPreferences()).toEqual({});
  });
});
