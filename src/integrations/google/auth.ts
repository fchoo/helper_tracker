export const GOOGLE_SHEETS_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets";
export const GOOGLE_DRIVE_METADATA_SCOPE =
  "https://www.googleapis.com/auth/drive.metadata.readonly";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
};

type GoogleTokenClientConfig = {
  client_id: string;
  scope: string;
  callback: (response: GoogleTokenResponse) => void;
  error_callback?: (error: { type?: string }) => void;
};

type GoogleTokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void;
};

export type GoogleAccounts = {
  oauth2: {
    initTokenClient: (config: GoogleTokenClientConfig) => GoogleTokenClient;
  };
};

export type CreateGoogleTokenClientOptions = {
  clientId: string;
  scope?: string;
  googleAccounts?: GoogleAccounts;
};

export type AppGoogleTokenClient = {
  requestToken: (options?: { prompt?: string }) => Promise<string>;
};

declare global {
  interface Window {
    google?: {
      accounts?: GoogleAccounts;
    };
  }
}

export function createGoogleTokenClient({
  clientId,
  scope = GOOGLE_SHEETS_SCOPE,
  googleAccounts = window.google?.accounts,
}: CreateGoogleTokenClientOptions): AppGoogleTokenClient {
  if (!clientId) {
    throw new Error("Google OAuth client ID is required.");
  }

  if (!googleAccounts?.oauth2) {
    throw new Error("Google Identity Services is not loaded.");
  }

  let resolveToken: ((token: string) => void) | undefined;
  let rejectToken: ((error: Error) => void) | undefined;

  const tokenClient = googleAccounts.oauth2.initTokenClient({
    client_id: clientId,
    scope,
    callback: (response) => {
      const resolveCurrentToken = resolveToken;
      const rejectCurrentToken = rejectToken;
      resolveToken = undefined;
      rejectToken = undefined;

      if (response.error || !response.access_token) {
        rejectCurrentToken?.(
          new Error(response.error || "Google did not return an access token."),
        );
        return;
      }

      resolveCurrentToken?.(response.access_token);
    },
    error_callback: (error) => {
      const rejectCurrentToken = rejectToken;
      resolveToken = undefined;
      rejectToken = undefined;
      rejectCurrentToken?.(buildGoogleTokenError(error.type));
    },
  });

  return {
    requestToken: (options = { prompt: "" }) =>
      new Promise((resolve, reject) => {
        resolveToken = resolve;
        rejectToken = reject;
        tokenClient.requestAccessToken(options);
      }),
  };
}

function buildGoogleTokenError(type?: string): Error {
  if (type === "popup_failed_to_open") {
    return new Error("Google sign-in popup was blocked. Allow popups and try again.");
  }

  if (type === "popup_closed") {
    return new Error("Google sign-in was closed before authorization finished.");
  }

  return new Error("Google sign-in could not finish. Try again.");
}
