import { describe, expect, it, vi } from "vitest";
import {
  DATA_GOV_SG_PUBLIC_HOLIDAY_RESOURCE_ID,
  buildPublicHolidayUrl,
  fetchSingaporePublicHolidays,
  normalizeDataGovHolidayRows,
} from "../../src/integrations/singapore/publicHolidays";

describe("Singapore public holiday import", () => {
  it("uses the official MOM data.gov.sg consolidated resource", () => {
    expect(DATA_GOV_SG_PUBLIC_HOLIDAY_RESOURCE_ID).toBe(
      "d_8ef23381f9417e4d4254ee8b4dcdb176",
    );
    expect(buildPublicHolidayUrl()).toContain(
      "resource_id=d_8ef23381f9417e4d4254ee8b4dcdb176",
    );
  });

  it("normalizes data.gov.sg rows and trims whitespace", () => {
    expect(
      normalizeDataGovHolidayRows([
        {
          _id: 2,
          date: "2020-01-25",
          day: "Saturday\n ",
          holiday: "Chinese New Year\n",
        },
      ]),
    ).toEqual([
      {
        id: "sg-holiday-2020-01-25-chinese-new-year",
        name: "Chinese New Year",
        date: "2020-01-25",
        year: 2020,
        source: "SINGAPORE_IMPORT",
        notes: "Saturday",
        createdAt: "2020-01-25T00:00:00.000Z",
      },
    ]);
  });

  it("filters normalized rows by selected year", () => {
    expect(
      normalizeDataGovHolidayRows(
        [
          { date: "2025-01-01", day: "Wednesday", holiday: "New Year's Day" },
          { date: "2026-01-01", day: "Thursday", holiday: "New Year's Day" },
        ],
        2026,
      ),
    ).toHaveLength(1);
  });

  it("filters normalized rows by selected and next year", () => {
    expect(
      normalizeDataGovHolidayRows(
        [
          { date: "2025-01-01", day: "Wednesday", holiday: "New Year's Day" },
          { date: "2026-01-01", day: "Thursday", holiday: "New Year's Day" },
          { date: "2027-01-01", day: "Friday", holiday: "New Year's Day" },
        ],
        [2026, 2027],
      ).map((holiday) => holiday.year),
    ).toEqual([2026, 2027]);
  });

  it("fetches official rows and returns normalized holidays for the selected year", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          records: [
            { date: "2026-08-09", day: "Sunday", holiday: "National Day" },
            { date: "2025-08-09", day: "Saturday", holiday: "National Day" },
          ],
        },
      }),
    });

    await expect(fetchSingaporePublicHolidays(2026, fetchMock)).resolves.toEqual([
      expect.objectContaining({
        name: "National Day",
        date: "2026-08-09",
        year: 2026,
        source: "SINGAPORE_IMPORT",
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(buildPublicHolidayUrl());
  });

  it("fetches official rows and returns selected plus next year when requested", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          records: [
            { date: "2026-08-09", day: "Sunday", holiday: "National Day" },
            { date: "2027-01-01", day: "Friday", holiday: "New Year's Day" },
            { date: "2028-01-01", day: "Saturday", holiday: "New Year's Day" },
          ],
        },
      }),
    });

    await expect(fetchSingaporePublicHolidays([2026, 2027], fetchMock)).resolves.toEqual([
      expect.objectContaining({ date: "2026-08-09", year: 2026 }),
      expect.objectContaining({ date: "2027-01-01", year: 2027 }),
    ]);
  });
});
