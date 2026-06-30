import type { PublicHoliday } from "../../features/calendar/types";
import { isIsoDate } from "../../lib/dates";

export const DATA_GOV_SG_PUBLIC_HOLIDAY_RESOURCE_ID =
  "d_8ef23381f9417e4d4254ee8b4dcdb176";

export type DataGovHolidayRow = {
  _id?: number;
  date: string;
  day: string;
  holiday: string;
};

type DataGovHolidayResponse = {
  result?: {
    records?: DataGovHolidayRow[];
  };
};

export function buildPublicHolidayUrl(limit = 500): string {
  const params = new URLSearchParams({
    resource_id: DATA_GOV_SG_PUBLIC_HOLIDAY_RESOURCE_ID,
    limit: String(limit),
  });
  return `https://data.gov.sg/api/action/datastore_search?${params.toString()}`;
}

export async function fetchSingaporePublicHolidays(
  year: number | number[],
  fetchImpl: typeof fetch = fetch,
): Promise<PublicHoliday[]> {
  const response = await fetchImpl(buildPublicHolidayUrl());

  if (!response.ok) {
    throw new Error(
      `Singapore public holidays request failed with ${response.status}.`,
    );
  }

  const body = (await response.json()) as DataGovHolidayResponse;
  return normalizeDataGovHolidayRows(body.result?.records ?? [], year);
}

export function normalizeDataGovHolidayRows(
  rows: DataGovHolidayRow[],
  year?: number | number[],
): PublicHoliday[] {
  const yearSet = Array.isArray(year) ? new Set(year) : undefined;

  return rows
    .filter((row) => isIsoDate(row.date))
    .map((row) => ({
      id: buildHolidayId(row.date, cleanText(row.holiday)),
      name: cleanText(row.holiday),
      date: row.date,
      year: Number(row.date.slice(0, 4)),
      source: "SINGAPORE_IMPORT" as const,
      notes: cleanText(row.day),
      createdAt: `${row.date}T00:00:00.000Z`,
    }))
    .filter((holiday) => {
      if (yearSet) {
        return yearSet.has(holiday.year);
      }

      return year ? holiday.year === year : true;
    });
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildHolidayId(date: string, holiday: string): string {
  return `sg-holiday-${date}-${holiday
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}
