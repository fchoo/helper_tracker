import { buildGoogleSpreadsheetUrl } from "./spreadsheetId";

const googleApiScriptUrl = "https://apis.google.com/js/api.js";
export const GOOGLE_PICKER_SPREADSHEET_MIME_TYPE =
  "application/vnd.google-apps.spreadsheet";

export type GooglePickerSpreadsheet = {
  id: string;
  name: string;
  webViewLink?: string;
};

export type GooglePickerConfig = {
  developerKey?: string;
  appId?: string;
};

export type GooglePickerClientOptions = GooglePickerConfig & {
  accessToken: string;
  gapi?: GoogleApiLoader;
  googlePicker?: GooglePickerNamespace;
  document?: Document;
};

type GoogleApiLoader = {
  load: (api: string, callback: () => void) => void;
};

type PickerDocument = {
  id?: string;
  name?: string;
  url?: string;
};

type PickerResponse = {
  action?: string;
  docs?: PickerDocument[];
};

type PickerView = {
  setMimeTypes?: (mimeTypes: string) => PickerView;
};

type Picker = {
  setVisible: (isVisible: boolean) => void;
};

type PickerBuilder = {
  setDeveloperKey: (developerKey: string) => PickerBuilder;
  setAppId?: (appId: string) => PickerBuilder;
  setOAuthToken: (accessToken: string) => PickerBuilder;
  addView: (view: PickerView) => PickerBuilder;
  setCallback: (callback: (response: PickerResponse) => void) => PickerBuilder;
  build: () => Picker;
};

type GooglePickerNamespace = {
  Action: {
    CANCEL: string;
    PICKED: string;
  };
  Feature?: {
    NAV_HIDDEN?: string;
  };
  PickerBuilder: new () => PickerBuilder;
  View: new (viewId: string) => PickerView;
  ViewId: {
    SPREADSHEETS?: string;
    DOCS: string;
  };
};

declare global {
  interface Window {
    gapi?: GoogleApiLoader;
  }
}

let pickerApiLoadPromise: Promise<void> | undefined;

export async function pickGoogleSpreadsheet({
  accessToken,
  developerKey,
  appId,
  gapi = window.gapi,
  googlePicker = getWindowGooglePicker(),
  document: documentObject = window.document,
}: GooglePickerClientOptions): Promise<GooglePickerSpreadsheet> {
  if (!accessToken) {
    throw new Error("Google Picker access token is required.");
  }

  if (!developerKey) {
    throw new Error("Google Picker API key is required.");
  }

  await loadGooglePickerApi(documentObject, gapi);
  const pickerNamespace = googlePicker ?? getWindowGooglePicker();

  if (!pickerNamespace) {
    throw new Error("Google Picker API is not loaded.");
  }

  return openSpreadsheetPicker({
    accessToken,
    appId,
    developerKey,
    pickerNamespace,
  });
}

function loadGooglePickerApi(
  documentObject: Document,
  gapi = window.gapi,
): Promise<void> {
  if (getWindowGooglePicker()) {
    return Promise.resolve();
  }

  if (pickerApiLoadPromise) {
    return pickerApiLoadPromise;
  }

  pickerApiLoadPromise = new Promise((resolve, reject) => {
    const loadPicker = () => {
      const googleApi = window.gapi ?? gapi;

      if (!googleApi) {
        reject(new Error("Google API loader is not available."));
        return;
      }

      googleApi.load("picker", resolve);
    };

    if (window.gapi ?? gapi) {
      loadPicker();
      return;
    }

    const existingScript = documentObject.querySelector<HTMLScriptElement>(
      `script[src="${googleApiScriptUrl}"]`,
    );

    if (existingScript) {
      existingScript.addEventListener("load", loadPicker, { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Google API loader could not be loaded.")),
        { once: true },
      );
      return;
    }

    const script = documentObject.createElement("script");
    script.src = googleApiScriptUrl;
    script.async = true;
    script.onload = loadPicker;
    script.onerror = () => reject(new Error("Google API loader could not be loaded."));
    documentObject.head.appendChild(script);
  });

  return pickerApiLoadPromise;
}

function getWindowGooglePicker(): GooglePickerNamespace | undefined {
  return (window.google as { picker?: GooglePickerNamespace } | undefined)?.picker;
}

function openSpreadsheetPicker({
  accessToken,
  appId,
  developerKey,
  pickerNamespace,
}: {
  accessToken: string;
  appId?: string;
  developerKey: string;
  pickerNamespace: GooglePickerNamespace;
}): Promise<GooglePickerSpreadsheet> {
  return new Promise((resolve, reject) => {
    const view = new pickerNamespace.View(
      pickerNamespace.ViewId.SPREADSHEETS ?? pickerNamespace.ViewId.DOCS,
    );
    view.setMimeTypes?.(GOOGLE_PICKER_SPREADSHEET_MIME_TYPE);

    let builder = new pickerNamespace.PickerBuilder()
      .setDeveloperKey(developerKey)
      .setOAuthToken(accessToken)
      .addView(view)
      .setCallback((response) => {
        if (response.action === pickerNamespace.Action.CANCEL) {
          reject(new Error("Google Picker was closed before a workbook was selected."));
          return;
        }

        if (response.action !== pickerNamespace.Action.PICKED) {
          return;
        }

        const spreadsheet = readPickedSpreadsheet(response);

        if (!spreadsheet) {
          reject(new Error("Google Picker did not return a workbook."));
          return;
        }

        resolve(spreadsheet);
      });

    if (appId && builder.setAppId) {
      builder = builder.setAppId(appId);
    }

    const picker = builder.build();
    picker.setVisible(true);
  });
}

function readPickedSpreadsheet(
  response: PickerResponse,
): GooglePickerSpreadsheet | undefined {
  const pickedDocument = response.docs?.[0];

  if (!pickedDocument?.id) {
    return undefined;
  }

  return {
    id: pickedDocument.id,
    name: pickedDocument.name ?? "Google Sheet",
    webViewLink: pickedDocument.url ?? buildGoogleSpreadsheetUrl(pickedDocument.id),
  };
}
