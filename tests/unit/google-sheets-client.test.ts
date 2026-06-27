import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGoogleTokenClient } from "../../src/integrations/google/auth";
import { GoogleSheetsClient } from "../../src/integrations/google/sheetsClient";

describe("GoogleSheetsClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("reads values with an in-memory bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ values: [["id"]] }));
    const client = new GoogleSheetsClient({
      accessToken: "token_123",
      fetch: fetchMock,
    });

    await client.getValues("sheet_123", "Config!A1:F");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://sheets.googleapis.com/v4/spreadsheets/sheet_123/values/Config!A1%3AF",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token_123",
        }),
      }),
    );
  });

  it("appends rows using USER_ENTERED input", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ updates: {} }));
    const client = new GoogleSheetsClient({
      accessToken: "token_123",
      fetch: fetchMock,
    });

    await client.appendValues("sheet_123", "Config!A:F", [["cfg_1", 900]]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://sheets.googleapis.com/v4/spreadsheets/sheet_123/values/Config!A%3AF:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ values: [["cfg_1", 900]] }),
      }),
    );
  });

  it("updates rows using USER_ENTERED input", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ updatedRows: 1 }));
    const client = new GoogleSheetsClient({
      accessToken: "token_123",
      fetch: fetchMock,
    });

    await client.updateValues("sheet_123", "Config!A2:F2", [["cfg_1", 900]]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://sheets.googleapis.com/v4/spreadsheets/sheet_123/values/Config!A2%3AF2?valueInputOption=USER_ENTERED",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ values: [["cfg_1", 900]] }),
      }),
    );
  });

  it("sends spreadsheet batch updates", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ replies: [] }));
    const client = new GoogleSheetsClient({
      accessToken: "token_123",
      fetch: fetchMock,
    });

    await client.batchUpdate("sheet_123", [{ addSheet: { properties: { title: "Config" } } }]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://sheets.googleapis.com/v4/spreadsheets/sheet_123:batchUpdate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          requests: [{ addSheet: { properties: { title: "Config" } } }],
        }),
      }),
    );
  });

  it("throws a useful error when Google returns a non-OK response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    });
    const client = new GoogleSheetsClient({
      accessToken: "token_123",
      fetch: fetchMock,
    });

    await expect(client.getValues("sheet_123", "Config!A1:F")).rejects.toThrow(
      "Google Sheets request failed with 403: Forbidden",
    );
  });
});

describe("createGoogleTokenClient", () => {
  it("requests an access token with the configured client id and scopes", async () => {
    let callback: ((response: { access_token: string }) => void) | undefined;
    const requestAccessToken = vi.fn(() => {
      callback?.({ access_token: "token_123" });
    });
    const initTokenClient = vi.fn((config) => {
      callback = config.callback;
      return { requestAccessToken };
    });

    const tokenClient = createGoogleTokenClient({
      clientId: "client_123",
      scope: "https://www.googleapis.com/auth/spreadsheets",
      googleAccounts: {
        oauth2: {
          initTokenClient,
        },
      },
    });

    await expect(tokenClient.requestToken()).resolves.toBe("token_123");

    expect(initTokenClient).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "client_123",
        scope: "https://www.googleapis.com/auth/spreadsheets",
      }),
    );
    expect(requestAccessToken).toHaveBeenCalledWith({ prompt: "" });
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}
