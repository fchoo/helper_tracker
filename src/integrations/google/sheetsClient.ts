const sheetsBaseUrl = "https://sheets.googleapis.com/v4/spreadsheets";

export type GoogleSheetsClientOptions = {
  accessToken: string;
  fetch?: typeof fetch;
};

export class GoogleSheetsClient {
  private readonly accessToken: string;
  private readonly fetchImpl: typeof fetch;

  constructor({ accessToken, fetch: fetchImpl = fetch }: GoogleSheetsClientOptions) {
    if (!accessToken) {
      throw new Error("Google Sheets access token is required.");
    }

    this.accessToken = accessToken;
    this.fetchImpl = fetchImpl;
  }

  getValues(spreadsheetId: string, range: string): Promise<unknown> {
    return this.request(
      `${sheetsBaseUrl}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
      { method: "GET" },
    );
  }

  appendValues(
    spreadsheetId: string,
    range: string,
    values: unknown[][],
  ): Promise<unknown> {
    const params = new URLSearchParams({
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
    });

    return this.request(
      `${sheetsBaseUrl}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?${params.toString()}`,
      {
        method: "POST",
        body: JSON.stringify({ values }),
      },
    );
  }

  updateValues(
    spreadsheetId: string,
    range: string,
    values: unknown[][],
  ): Promise<unknown> {
    const params = new URLSearchParams({
      valueInputOption: "USER_ENTERED",
    });

    return this.request(
      `${sheetsBaseUrl}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?${params.toString()}`,
      {
        method: "PUT",
        body: JSON.stringify({ values }),
      },
    );
  }

  batchUpdate(spreadsheetId: string, requests: unknown[]): Promise<unknown> {
    return this.request(
      `${sheetsBaseUrl}/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      {
        method: "POST",
        body: JSON.stringify({ requests }),
      },
    );
  }

  private async request(url: string, init: RequestInit): Promise<unknown> {
    const response = await this.fetchImpl(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Google Sheets request failed with ${response.status}: ${body}`,
      );
    }

    return response.json();
  }
}
