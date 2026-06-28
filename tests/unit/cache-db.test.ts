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
      googleClientId: "1234567890-valid.apps.googleusercontent.com",
    });

    expect(getCachedAppPreferences()).toEqual({
      spreadsheetId: "sheet_123",
      selectedMonth: "2026-06",
      payCycleStartDay: 26,
      googleClientId: "1234567890-valid.apps.googleusercontent.com",
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
});
