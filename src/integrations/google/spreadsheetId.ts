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

export function isLegacyLocalSpreadsheetId(value: string): boolean {
  return value.toLowerCase().startsWith("local_");
}
