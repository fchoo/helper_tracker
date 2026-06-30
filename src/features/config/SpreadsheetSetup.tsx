import { useState } from "react";
import type { GooglePickerSpreadsheet } from "../../integrations/google/pickerClient";
import { normalizeGoogleSpreadsheetId } from "../../integrations/google/spreadsheetId";

export type SpreadsheetSetupProps = {
  spreadsheetId?: string;
  spreadsheetName?: string;
  spreadsheetUrl?: string;
  isGoogleOAuthConfigured?: boolean;
  onConnect: (spreadsheet: GooglePickerSpreadsheet) => Promise<void> | void;
  onCreate: () => Promise<GooglePickerSpreadsheet> | GooglePickerSpreadsheet;
  onPickDriveSpreadsheet?: () =>
    | Promise<GooglePickerSpreadsheet>
    | GooglePickerSpreadsheet;
};

export function SpreadsheetSetup({
  spreadsheetId,
  spreadsheetName,
  spreadsheetUrl,
  isGoogleOAuthConfigured,
  onConnect,
  onCreate,
  onPickDriveSpreadsheet,
}: SpreadsheetSetupProps) {
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingDriveSheets, setIsLoadingDriveSheets] = useState(false);
  const canUseGoogleSheets = isGoogleOAuthConfigured ?? true;
  const connectedSpreadsheetId = normalizeGoogleSpreadsheetId(spreadsheetId);
  const connectedSpreadsheetName =
    normalizeSpreadsheetName(spreadsheetName) ?? "Google Sheet";
  const connectedSpreadsheetLabel = connectedSpreadsheetId
    ? `${connectedSpreadsheetName} (${connectedSpreadsheetId})`
    : "";

  async function handlePickDriveSpreadsheet() {
    setError("");
    setStatus("");

    if (!canUseGoogleSheets) {
      setError("Google Sheets is not configured for this deployment.");
      return;
    }

    if (!onPickDriveSpreadsheet) {
      setError("Google Drive selection is not available.");
      return;
    }

    try {
      setIsLoadingDriveSheets(true);
      setStatus("Opening Google Drive...");
      const pickedSpreadsheet = await onPickDriveSpreadsheet();
      setStatus("Verifying workbook...");
      await onConnect(pickedSpreadsheet);
      setStatus("Google Sheet connected.");
    } catch (connectError) {
      setStatus("");
      setError(
        connectError instanceof Error
          ? connectError.message
          : "Could not choose Google Sheet from Drive.",
      );
    } finally {
      setIsLoadingDriveSheets(false);
    }
  }

  async function handleCreate() {
    setError("");
    setStatus("");

    if (!canUseGoogleSheets) {
      setError("Google Sheets is not configured for this deployment.");
      return;
    }

    try {
      setIsCreating(true);
      setStatus("Creating and verifying workbook...");
      await onCreate();
      setStatus("Google Sheet connected.");
    } catch (createError) {
      setStatus("");
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create Google Sheet.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section
      aria-labelledby="spreadsheet-setup-title"
      className="panel-section setup-panel spreadsheet-setup-panel"
    >
      <div className="panel-header setup-panel-header">
        <div>
          <h3 id="spreadsheet-setup-title">Google Sheet setup</h3>
          <p>Connected workbook</p>
        </div>
        <div className="button-row">
          <button
            type="button"
            className="secondary-button"
            onClick={handlePickDriveSpreadsheet}
            disabled={
              isLoadingDriveSheets || isCreating || !canUseGoogleSheets
            }
          >
            {isLoadingDriveSheets ? "Opening..." : "Choose from Drive"}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleCreate}
            disabled={
              isCreating || isLoadingDriveSheets || !canUseGoogleSheets
            }
          >
            {isCreating ? "Creating..." : "Create new sheet"}
          </button>
        </div>
      </div>

      {connectedSpreadsheetId ? (
        spreadsheetUrl ? (
          <a
            className="connected-workbook-link"
            href={spreadsheetUrl}
            target="_blank"
            rel="noreferrer"
          >
            {connectedSpreadsheetLabel}
          </a>
        ) : (
          <strong className="connected-workbook-name">
            {connectedSpreadsheetLabel}
          </strong>
        )
      ) : (
        <p>No workbook connected.</p>
      )}

      {error ? <p role="alert">{error}</p> : null}
      {status ? <p role="status">{status}</p> : null}
    </section>
  );
}

function normalizeSpreadsheetName(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue || undefined;
}
