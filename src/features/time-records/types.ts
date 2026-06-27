export type TimeRecordType = "OFF_DAY" | "SUNDAY_OT" | "PUBLIC_HOLIDAY_WORK";

export type TimeRecord = {
  id: string;
  type: TimeRecordType;
  startDate: string;
  endDate: string;
  isPaidOffDay?: boolean;
  notes?: string;
  createdAt: string;
};
