import { isMonthKey } from "../lib/dates";
import type { Advance, AdvanceDeduction } from "../features/advances/types";
import type { PublicHoliday } from "../features/calendar/types";
import type { SalaryConfig } from "../features/config/types";
import type { TimeRecord } from "../features/time-records/types";
import { normalizeGoogleClientId } from "../integrations/google/clientId";
import { normalizeGoogleSpreadsheetId } from "../integrations/google/spreadsheetId";

export type CachedAppPreferences = {
  spreadsheetId?: string;
  selectedMonth?: string;
  payCycleStartDay?: number;
  googleClientId?: string;
};

export type CachedSheetRecords = {
  salaryConfigs: SalaryConfig[];
  advances: Advance[];
  advanceDeductions: AdvanceDeduction[];
  timeRecords: TimeRecord[];
  publicHolidays: PublicHoliday[];
  cachedAt?: string;
};

const cacheKey = "helper-tracker:preferences";
const recordsCacheKey = "helper-tracker:sheet-records";

export function getCachedAppPreferences(): CachedAppPreferences {
  const rawValue = localStorage.getItem(cacheKey);

  if (!rawValue) {
    return {};
  }

  const parsed = JSON.parse(rawValue) as CachedAppPreferences;
  const sanitizedPreferences = sanitizeCachedAppPreferences(parsed);

  if (JSON.stringify(sanitizedPreferences) !== rawValue) {
    localStorage.setItem(cacheKey, JSON.stringify(sanitizedPreferences));
  }

  return sanitizedPreferences;
}

export function setCachedAppPreferences(preferences: CachedAppPreferences): void {
  localStorage.setItem(cacheKey, JSON.stringify(sanitizeCachedAppPreferences(preferences)));
}

export function getCachedSheetRecords(
  spreadsheetId?: string,
): CachedSheetRecords {
  const normalizedSpreadsheetId = normalizeGoogleSpreadsheetId(spreadsheetId);

  if (!normalizedSpreadsheetId) {
    return createEmptyCachedSheetRecords();
  }

  const recordsBySpreadsheetId = readCachedSheetRecordsStore();
  return sanitizeCachedSheetRecords(recordsBySpreadsheetId[normalizedSpreadsheetId]);
}

export function setCachedSheetRecords(
  spreadsheetId: string | undefined,
  records: CachedSheetRecords,
): void {
  const normalizedSpreadsheetId = normalizeGoogleSpreadsheetId(spreadsheetId);

  if (!normalizedSpreadsheetId) {
    return;
  }

  const recordsBySpreadsheetId = readCachedSheetRecordsStore();
  recordsBySpreadsheetId[normalizedSpreadsheetId] = sanitizeCachedSheetRecords({
    ...records,
    cachedAt: new Date().toISOString(),
  });
  localStorage.setItem(recordsCacheKey, JSON.stringify(recordsBySpreadsheetId));
}

export function sanitizeCachedAppPreferences(
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

function readCachedSheetRecordsStore(): Record<string, unknown> {
  const rawValue = localStorage.getItem(recordsCacheKey);

  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue);
    return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function sanitizeCachedSheetRecords(value: unknown): CachedSheetRecords {
  if (typeof value !== "object" || value === null) {
    return createEmptyCachedSheetRecords();
  }

  const records = value as Partial<CachedSheetRecords>;

  return {
    salaryConfigs: Array.isArray(records.salaryConfigs)
      ? records.salaryConfigs
      : [],
    advances: Array.isArray(records.advances) ? records.advances : [],
    advanceDeductions: Array.isArray(records.advanceDeductions)
      ? records.advanceDeductions
      : [],
    timeRecords: Array.isArray(records.timeRecords) ? records.timeRecords : [],
    publicHolidays: Array.isArray(records.publicHolidays)
      ? records.publicHolidays
      : [],
    ...(typeof records.cachedAt === "string" ? { cachedAt: records.cachedAt } : {}),
  };
}

function createEmptyCachedSheetRecords(): CachedSheetRecords {
  return {
    salaryConfigs: [],
    advances: [],
    advanceDeductions: [],
    timeRecords: [],
    publicHolidays: [],
  };
}
