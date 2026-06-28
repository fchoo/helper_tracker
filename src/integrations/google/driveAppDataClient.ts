const driveFilesBaseUrl = "https://www.googleapis.com/drive/v3/files";
const driveUploadBaseUrl = "https://www.googleapis.com/upload/drive/v3/files";

export type GoogleDriveAppDataClientOptions = {
  accessToken: string;
  fetch?: typeof fetch;
};

export class GoogleDriveAppDataClient {
  private readonly accessToken: string;
  private readonly fetchImpl: typeof fetch;

  constructor({
    accessToken,
    fetch: fetchImpl = globalThis.fetch.bind(globalThis),
  }: GoogleDriveAppDataClientOptions) {
    if (!accessToken) {
      throw new Error("Google Drive access token is required.");
    }

    this.accessToken = accessToken;
    this.fetchImpl = fetchImpl;
  }

  async readJsonFile(fileName: string): Promise<unknown | undefined> {
    const fileId = await this.findAppDataFileId(fileName);

    if (!fileId) {
      return undefined;
    }

    return this.requestJson(
      `${driveFilesBaseUrl}/${encodeURIComponent(fileId)}?alt=media`,
      { method: "GET" },
    );
  }

  async writeJsonFile(fileName: string, body: unknown): Promise<void> {
    const fileId = await this.findAppDataFileId(fileName);
    const metadata = { name: fileName, parents: fileId ? undefined : ["appDataFolder"] };
    const delimiter = `helper_tracker_${crypto.randomUUID()}`;
    const multipartBody = [
      `--${delimiter}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${delimiter}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(body),
      `--${delimiter}--`,
      "",
    ].join("\r\n");

    await this.requestText(
      fileId
        ? `${driveUploadBaseUrl}/${encodeURIComponent(fileId)}?uploadType=multipart`
        : `${driveUploadBaseUrl}?uploadType=multipart`,
      {
        method: fileId ? "PATCH" : "POST",
        body: multipartBody,
        headers: {
          "Content-Type": `multipart/related; boundary=${delimiter}`,
        },
      },
    );
  }

  private async findAppDataFileId(fileName: string): Promise<string | undefined> {
    const params = new URLSearchParams({
      spaces: "appDataFolder",
      fields: "files(id,name)",
      pageSize: "10",
      q: `name = '${escapeDriveQueryValue(fileName)}' and trashed = false`,
    });
    const response = await this.requestJson(
      `${driveFilesBaseUrl}?${params.toString()}`,
      { method: "GET" },
    );

    if (!isDriveFileList(response)) {
      throw new Error("Google Drive did not return app storage metadata.");
    }

    return response.files[0]?.id;
  }

  private async requestJson(url: string, init: RequestInit): Promise<unknown> {
    const text = await this.requestText(url, init);
    return text ? JSON.parse(text) : undefined;
  }

  private async requestText(url: string, init: RequestInit): Promise<string> {
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

    return response.text();
  }
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function isDriveFileList(value: unknown): value is { files: Array<{ id: string }> } {
  return (
    typeof value === "object" &&
    value !== null &&
    "files" in value &&
    Array.isArray(value.files) &&
    value.files.every(
      (file) =>
        typeof file === "object" &&
        file !== null &&
        "id" in file &&
        typeof file.id === "string",
    )
  );
}
