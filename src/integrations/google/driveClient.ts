const driveFilesBaseUrl = "https://www.googleapis.com/drive/v3/files";
const spreadsheetMimeType = "application/vnd.google-apps.spreadsheet";

export type GoogleDriveClientOptions = {
  accessToken: string;
  fetch?: typeof fetch;
};

export type GoogleDriveSpreadsheet = {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
};

export class GoogleDriveClient {
  private readonly accessToken: string;
  private readonly fetchImpl: typeof fetch;

  constructor({
    accessToken,
    fetch: fetchImpl = globalThis.fetch.bind(globalThis),
  }: GoogleDriveClientOptions) {
    if (!accessToken) {
      throw new Error("Google Drive access token is required.");
    }

    this.accessToken = accessToken;
    this.fetchImpl = fetchImpl;
  }

  async listSpreadsheets(options: { pageSize?: number } = {}): Promise<GoogleDriveSpreadsheet[]> {
    const params = new URLSearchParams({
      fields: "files(id,name,webViewLink,modifiedTime)",
      orderBy: "modifiedTime desc",
      pageSize: String(options.pageSize ?? 20),
      q: `mimeType = '${spreadsheetMimeType}' and trashed = false`,
      spaces: "drive",
    });
    const response = await this.requestJson(`${driveFilesBaseUrl}?${params.toString()}`, {
      method: "GET",
    });

    if (!isDriveSpreadsheetList(response)) {
      throw new Error("Google Drive did not return spreadsheet metadata.");
    }

    return response.files;
  }

  private async requestJson(url: string, init: RequestInit): Promise<unknown> {
    const response = await this.fetchImpl(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...init.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Google Drive request failed with ${response.status}: ${body}`,
      );
    }

    return response.json();
  }
}

function isDriveSpreadsheetList(
  value: unknown,
): value is { files: GoogleDriveSpreadsheet[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "files" in value &&
    Array.isArray(value.files) &&
    value.files.every(isDriveSpreadsheet)
  );
}

function isDriveSpreadsheet(value: unknown): value is GoogleDriveSpreadsheet {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    (!("webViewLink" in value) || typeof value.webViewLink === "string") &&
    (!("modifiedTime" in value) || typeof value.modifiedTime === "string")
  );
}
