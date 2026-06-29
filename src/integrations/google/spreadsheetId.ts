export function normalizeGoogleSpreadsheetId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue || isLegacyLocalSpreadsheetId(trimmedValue)) {
    return undefined;
  }

  return trimmedValue;
}

export function buildGoogleSpreadsheetUrl(spreadsheetId: string): string {
  const normalizedSpreadsheetId = normalizeGoogleSpreadsheetId(spreadsheetId);

  if (!normalizedSpreadsheetId) {
    throw new Error("A real Google Spreadsheet ID is required.");
  }

  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(normalizedSpreadsheetId)}/edit`;
}

export function normalizeGoogleSpreadsheetUrl(
  value: unknown,
  spreadsheetId?: string,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  try {
    const url = new URL(trimmedValue);
    const normalizedSpreadsheetId = normalizeGoogleSpreadsheetId(spreadsheetId);
    const pathParts = url.pathname.split("/");
    const pathSpreadsheetId =
      pathParts[1] === "spreadsheets" && pathParts[2] === "d"
        ? decodeURIComponent(pathParts[3] ?? "")
        : undefined;

    if (
      url.protocol !== "https:" ||
      url.hostname !== "docs.google.com" ||
      !pathSpreadsheetId ||
      (normalizedSpreadsheetId && pathSpreadsheetId !== normalizedSpreadsheetId)
    ) {
      return undefined;
    }

    return url.toString();
  } catch {
    return undefined;
  }
}

export function isLegacyLocalSpreadsheetId(value: string): boolean {
  return value.toLowerCase().startsWith("local_");
}
