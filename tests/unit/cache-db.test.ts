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
});
