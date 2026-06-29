import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleDriveClient } from "../../src/integrations/google/driveClient";

describe("GoogleDriveClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists Google Sheets files from Google Drive metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      files: [
        {
          id: "sheet_123",
          name: "Domestic Helper Tracker",
          webViewLink: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
          modifiedTime: "2026-06-29T10:00:00.000Z",
        },
      ],
    }));
    const client = new GoogleDriveClient({
      accessToken: "token_123",
      fetch: fetchMock,
    });

    await expect(client.listSpreadsheets()).resolves.toEqual([
      {
        id: "sheet_123",
        name: "Domestic Helper Tracker",
        webViewLink: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
        modifiedTime: "2026-06-29T10:00:00.000Z",
      },
    ]);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://www.googleapis.com/drive/v3/files?fields=files%28id%2Cname%2CwebViewLink%2CmodifiedTime%29&orderBy=modifiedTime+desc&pageSize=20&q=mimeType+%3D+%27application%2Fvnd.google-apps.spreadsheet%27+and+trashed+%3D+false&spaces=drive",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token_123",
        }),
      }),
    );
  });

  it("uses a custom page size when listing Google Sheets", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ files: [] }));
    const client = new GoogleDriveClient({
      accessToken: "token_123",
      fetch: fetchMock,
    });

    await client.listSpreadsheets({ pageSize: 5 });

    expect(fetchMock.mock.calls[0][0]).toContain("pageSize=5");
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}
