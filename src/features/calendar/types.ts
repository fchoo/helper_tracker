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

export type NewPublicHolidayInput = {
  name: string;
  date: string;
  notes?: string;
};
