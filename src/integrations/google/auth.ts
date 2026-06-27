export const GOOGLE_SHEETS_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
};

type GoogleTokenClientConfig = {
  client_id: string;
  scope: string;
  callback: (response: GoogleTokenResponse) => void;
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
  requestToken: () => Promise<string>;
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
      if (response.error || !response.access_token) {
        rejectToken?.(
          new Error(response.error || "Google did not return an access token."),
        );
        return;
      }

      resolveToken?.(response.access_token);
    },
  });

  return {
    requestToken: () =>
      new Promise((resolve, reject) => {
        resolveToken = resolve;
        rejectToken = reject;
        tokenClient.requestAccessToken({ prompt: "" });
      }),
  };
}
