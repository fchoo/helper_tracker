export type SheetsClientLike = {
  getValues: (spreadsheetId: string, range: string) => Promise<unknown>;
  appendValues: (
    spreadsheetId: string,
    range: string,
    values: unknown[][],
  ) => Promise<unknown>;
  updateValues: (
    spreadsheetId: string,
    range: string,
    values: unknown[][],
  ) => Promise<unknown>;
};

export type GoogleValuesResponse = {
  values?: unknown[][];
};
