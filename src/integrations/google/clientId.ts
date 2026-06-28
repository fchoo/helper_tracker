const googleClientIdPattern = /^[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i;

export function normalizeGoogleClientId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return googleClientIdPattern.test(trimmedValue) ? trimmedValue : undefined;
}

export function isGoogleClientId(value: unknown): value is string {
  return normalizeGoogleClientId(value) !== undefined;
}
