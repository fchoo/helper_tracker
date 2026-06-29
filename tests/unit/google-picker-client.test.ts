import { describe, expect, it, vi } from "vitest";
import {
  GOOGLE_PICKER_SPREADSHEET_MIME_TYPE,
  pickGoogleSpreadsheet,
} from "../../src/integrations/google/pickerClient";

describe("pickGoogleSpreadsheet", () => {
  it("opens Google Picker with a Sheets-only view", async () => {
    let pickerCallback:
      | ((response: { action?: string; docs?: { id?: string; name?: string; url?: string }[] }) => void)
      | undefined;
    const setMimeTypes = vi.fn().mockReturnThis();
    const setDeveloperKey = vi.fn().mockReturnThis();
    const setAppId = vi.fn().mockReturnThis();
    const setOAuthToken = vi.fn().mockReturnThis();
    const addView = vi.fn().mockReturnThis();
    const setCallback = vi.fn((callback) => {
      pickerCallback = callback;
      return builder;
    });
    const setVisible = vi.fn((isVisible: boolean) => {
      if (!isVisible) {
        return;
      }

      pickerCallback?.({
        action: "picked",
        docs: [
          {
            id: "sheet_123",
            name: "Domestic Helper Tracker",
            url: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
          },
        ],
      });
    });
    const build = vi.fn(() => ({ setVisible }));
    const createdViews: string[] = [];
    const builder = {
      addView,
      build,
      setAppId,
      setCallback,
      setDeveloperKey,
      setOAuthToken,
    };
    class TestPickerBuilder {
      setDeveloperKey = setDeveloperKey;
      setAppId = setAppId;
      setOAuthToken = setOAuthToken;
      addView = addView;
      setCallback = setCallback;
      build = build;
    }
    class TestPickerView {
      setMimeTypes = setMimeTypes;

      constructor(viewId: string) {
        createdViews.push(viewId);
      }
    }
    const googlePicker = {
      Action: {
        CANCEL: "cancel",
        PICKED: "picked",
      },
      PickerBuilder: TestPickerBuilder,
      View: TestPickerView,
      ViewId: {
        DOCS: "docs",
        SPREADSHEETS: "spreadsheets",
      },
    };
    const gapi = {
      load: vi.fn((_api: string, callback: () => void) => callback()),
    };

    const pickPromise = pickGoogleSpreadsheet({
      accessToken: "token_123",
      appId: "404849934745",
      developerKey: "picker_key",
      gapi,
      googlePicker,
      document,
    });

    await expect(pickPromise).resolves.toEqual({
      id: "sheet_123",
      name: "Domestic Helper Tracker",
      webViewLink: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
    });
    expect(createdViews).toEqual(["spreadsheets"]);
    expect(setMimeTypes).toHaveBeenCalledWith(GOOGLE_PICKER_SPREADSHEET_MIME_TYPE);
    expect(setDeveloperKey).toHaveBeenCalledWith("picker_key");
    expect(setAppId).toHaveBeenCalledWith("404849934745");
    expect(setOAuthToken).toHaveBeenCalledWith("token_123");
    expect(addView).toHaveBeenCalledTimes(1);
    expect(setVisible).toHaveBeenCalledWith(true);
  });

  it("requires a Google Picker API key", async () => {
    await expect(
      pickGoogleSpreadsheet({
        accessToken: "token_123",
        developerKey: "",
        googlePicker: {
          Action: { CANCEL: "cancel", PICKED: "picked" },
          PickerBuilder: vi.fn(),
          View: vi.fn(),
          ViewId: { DOCS: "docs" },
        },
      }),
    ).rejects.toThrow("Google Picker API key is required.");
  });
});
