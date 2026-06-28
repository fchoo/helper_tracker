import { isMonthKey } from "../lib/dates";
import { normalizeGoogleClientId } from "../integrations/google/clientId";
import { normalizeGoogleSpreadsheetId } from "../integrations/google/spreadsheetId";

export type CachedAppPreferences = {
  spreadsheetId?: string;
  selectedMonth?: string;
  payCycleStartDay?: number;
  googleClientId?: string;
};

const cacheKey = "helper-tracker:preferences";

export function getCachedAppPreferences(): CachedAppPreferences {
  const rawValue = localStorage.getItem(cacheKey);

  if (!rawValue) {
    return {};
  }

  const parsed = JSON.parse(rawValue) as CachedAppPreferences;
  const sanitizedPreferences = sanitizePreferences(parsed);

  if (JSON.stringify(sanitizedPreferences) !== rawValue) {
    localStorage.setItem(cacheKey, JSON.stringify(sanitizedPreferences));
  }

  return sanitizedPreferences;
}

export function setCachedAppPreferences(preferences: CachedAppPreferences): void {
  localStorage.setItem(cacheKey, JSON.stringify(sanitizePreferences(preferences)));
}

function sanitizePreferences(
  preferences: CachedAppPreferences,
): CachedAppPreferences {
  const spreadsheetId = normalizeGoogleSpreadsheetId(preferences.spreadsheetId);
  const googleClientId = normalizeGoogleClientId(preferences.googleClientId);

  return {
    ...(spreadsheetId ? { spreadsheetId } : {}),
    ...(preferences.selectedMonth && isMonthKey(preferences.selectedMonth)
      ? { selectedMonth: preferences.selectedMonth }
      : {}),
    ...(isPayCycleStartDay(preferences.payCycleStartDay)
      ? { payCycleStartDay: preferences.payCycleStartDay }
      : {}),
    ...(googleClientId ? { googleClientId } : {}),
  };
}

function isPayCycleStartDay(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 31;
}
