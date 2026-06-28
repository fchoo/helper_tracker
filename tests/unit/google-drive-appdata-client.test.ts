import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleDriveAppDataClient } from "../../src/integrations/google/driveAppDataClient";

describe("GoogleDriveAppDataClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("reads a JSON file from Google Drive appDataFolder", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ files: [{ id: "file_123" }] }))
      .mockResolvedValueOnce(jsonResponse({ spreadsheetId: "sheet_123" }));
    const client = new GoogleDriveAppDataClient({
      accessToken: "token_123",
      fetch: fetchMock,
    });

    await expect(client.readJsonFile("helper-tracker-preferences.json")).resolves.toEqual({
      spreadsheetId: "sheet_123",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files%28id%2Cname%29&pageSize=10&q=name+%3D+%27helper-tracker-preferences.json%27+and+trashed+%3D+false",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token_123",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://www.googleapis.com/drive/v3/files/file_123?alt=media",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("creates a JSON file in appDataFolder when no existing file is found", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ files: [] }))
      .mockResolvedValueOnce(textResponse("{}"));
    const client = new GoogleDriveAppDataClient({
      accessToken: "token_123",
      fetch: fetchMock,
    });

    await client.writeJsonFile("helper-tracker-preferences.json", {
      spreadsheetId: "sheet_123",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"parents":["appDataFolder"]'),
        headers: expect.objectContaining({
          "Content-Type": expect.stringContaining("multipart/related"),
        }),
      }),
    );
  });

  it("updates an existing appDataFolder JSON file", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ files: [{ id: "file_123" }] }))
      .mockResolvedValueOnce(textResponse("{}"));
    const client = new GoogleDriveAppDataClient({
      accessToken: "token_123",
      fetch: fetchMock,
    });

    await client.writeJsonFile("helper-tracker-preferences.json", {
      spreadsheetId: "sheet_123",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://www.googleapis.com/upload/drive/v3/files/file_123?uploadType=multipart",
      expect.objectContaining({
        method: "PATCH",
        body: expect.not.stringContaining('"parents"'),
      }),
    );
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    text: async () => JSON.stringify(body),
  } as Response;
}

function textResponse(body: string): Response {
  return {
    ok: true,
    text: async () => body,
  } as Response;
}
