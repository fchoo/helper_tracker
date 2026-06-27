export type PublicHolidaySource = "SINGAPORE_IMPORT" | "MANUAL";

export type PublicHoliday = {
  id: string;
  name: string;
  date: string;
  year: number;
  source: PublicHolidaySource;
  notes?: string;
  createdAt: string;
};
