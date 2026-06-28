import { isMonthKey } from "../lib/dates";

export type CachedAppPreferences = {
  spreadsheetId?: string;
  selectedMonth?: string;
  payCycleStartDay?: number;
};

const cacheKey = "helper-tracker:preferences";

export function getCachedAppPreferences(): CachedAppPreferences {
  const rawValue = localStorage.getItem(cacheKey);

  if (!rawValue) {
    return {};
  }

  const parsed = JSON.parse(rawValue) as CachedAppPreferences;
  return sanitizePreferences(parsed);
}

export function setCachedAppPreferences(preferences: CachedAppPreferences): void {
  localStorage.setItem(cacheKey, JSON.stringify(sanitizePreferences(preferences)));
}

function sanitizePreferences(
  preferences: CachedAppPreferences,
): CachedAppPreferences {
  return {
    ...(preferences.spreadsheetId ? { spreadsheetId: preferences.spreadsheetId } : {}),
    ...(preferences.selectedMonth && isMonthKey(preferences.selectedMonth)
      ? { selectedMonth: preferences.selectedMonth }
      : {}),
    ...(isPayCycleStartDay(preferences.payCycleStartDay)
      ? { payCycleStartDay: preferences.payCycleStartDay }
      : {}),
  };
}

function isPayCycleStartDay(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 31;
}
