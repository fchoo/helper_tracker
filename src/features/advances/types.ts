export type Advance = {
  id: string;
  date: string;
  amount: number;
  description?: string;
  createdAt: string;
};

export type AdvanceDeduction = {
  id: string;
  advanceId: string;
  month: string;
  amount: number;
  notes?: string;
  createdAt: string;
};
