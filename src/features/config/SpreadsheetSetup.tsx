import { FormEvent, useState } from "react";
import { normalizeGoogleClientId } from "../../integrations/google/clientId";
import type { GoogleDriveSpreadsheet } from "../../integrations/google/driveClient";
import { normalizeGoogleSpreadsheetId } from "../../integrations/google/spreadsheetId";
import {
  buildUncheckedSpreadsheetHealth,
  checkSpreadsheetHealth,
  type SpreadsheetHealthCheck,
} from "./spreadsheetHealth";

export type SpreadsheetSetupProps = {
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  googleClientId?: string;
  isGoogleOAuthConfigured?: boolean;
  isDeploymentGoogleOAuthConfigured?: boolean;
  onConnect: (spreadsheet: GoogleDriveSpreadsheet) => Promise<void> | void;
  onCreate: () => Promise<GoogleDriveSpreadsheet> | GoogleDriveSpreadsheet;
  onListDriveSpreadsheets?: () =>
    | Promise<GoogleDriveSpreadsheet[]>
    | GoogleDriveSpreadsheet[];
  onSaveGoogleClientId?: (clientId: string) => Promise<void> | void;
  onClearGoogleClientId?: () => Promise<void> | void;
  onHealthCheck?: (spreadsheetId: string) => Promise<SpreadsheetHealthCheck> | SpreadsheetHealthCheck;
};

export function SpreadsheetSetup({
  spreadsheetId,
  spreadsheetUrl,
  googleClientId,
  isGoogleOAuthConfigured,
  isDeploymentGoogleOAuthConfigured = false,
  onConnect,
  onCreate,
  onListDriveSpreadsheets,
  onSaveGoogleClientId,
  onClearGoogleClientId,
  onHealthCheck,
}: SpreadsheetSetupProps) {
  const [inputGoogleClientId, setInputGoogleClientId] = useState("");
  const [error, setError] = useState("");
  const [healthCheck, setHealthCheck] = useState<SpreadsheetHealthCheck>();
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingDriveSheets, setIsLoadingDriveSheets] = useState(false);
  const [createStatus, setCreateStatus] = useState("");
  const [driveSpreadsheets, setDriveSpreadsheets] = useState<
    GoogleDriveSpreadsheet[]
  >([]);
  const canCreateSpreadsheet = isGoogleOAuthConfigured ?? true;
  const canChooseSpreadsheet = isGoogleOAuthConfigured ?? true;
  const connectedSpreadsheetId = normalizeGoogleSpreadsheetId(spreadsheetId);
  const displayedHealthCheck =
    healthCheck && healthCheck.spreadsheetId === connectedSpreadsheetId
      ? healthCheck
      : buildUncheckedSpreadsheetHealth(connectedSpreadsheetId);

  async function handleSaveGoogleClientId(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedGoogleClientId = normalizeGoogleClientId(inputGoogleClientId);

    if (!normalizedGoogleClientId) {
      setError("Enter a valid Google OAuth Client ID.");
      return;
    }

    setError("");
    await onSaveGoogleClientId?.(normalizedGoogleClientId);
    setInputGoogleClientId(normalizedGoogleClientId);
  }

  async function handleClearGoogleClientId() {
    setError("");
    await onClearGoogleClientId?.();
    setInputGoogleClientId("");
  }

  async function handleLoadDriveSpreadsheets() {
    setError("");
    setCreateStatus("");

    if (!canChooseSpreadsheet) {
      setError("Add a Google OAuth Client ID before choosing from Google Drive.");
      return;
    }

    if (!onListDriveSpreadsheets) {
      setError("Google Drive selection is not available.");
      return;
    }

    try {
      setIsLoadingDriveSheets(true);
      setCreateStatus("Waiting for Google sign-in...");
      setDriveSpreadsheets(await onListDriveSpreadsheets());
      setCreateStatus("");
    } catch (loadError) {
      setCreateStatus("");
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load Google Sheets from Drive.",
      );
    } finally {
      setIsLoadingDriveSheets(false);
    }
  }

  async function handleSelectDriveSpreadsheet(spreadsheet: GoogleDriveSpreadsheet) {
    setError("");
    setCreateStatus("");

    try {
      await onConnect(spreadsheet);
      setHealthCheck(buildUncheckedSpreadsheetHealth(spreadsheet.id));
      setCreateStatus("Google Sheet connected.");
    } catch (connectError) {
      setError(
        connectError instanceof Error
          ? connectError.message
          : "Could not connect Google Sheet.",
      );
    }
  }

  async function handleCreate() {
    setError("");
    setCreateStatus("");

    if (!canCreateSpreadsheet) {
      setError("Add a Google OAuth Client ID before creating an online Google Sheet.");
      return;
    }

    try {
      setIsCreating(true);
      setCreateStatus("Waiting for Google sign-in...");
      const createdSpreadsheet = await onCreate();
      setHealthCheck(buildUncheckedSpreadsheetHealth(createdSpreadsheet.id));
      setCreateStatus("Google Sheet connected.");
    } catch (createError) {
      setCreateStatus("");
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create Google Sheet.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleHealthCheck() {
    const targetSpreadsheetId = connectedSpreadsheetId;

    if (!targetSpreadsheetId) {
      setError("Choose or create a Google Sheet before checking health.");
      setHealthCheck(checkSpreadsheetHealth());
      return;
    }

    setError("");
    setIsCheckingHealth(true);

    try {
      const nextHealthCheck = onHealthCheck
        ? await onHealthCheck(targetSpreadsheetId)
        : checkSpreadsheetHealth(targetSpreadsheetId);
      setHealthCheck(nextHealthCheck);
    } catch (healthError) {
      setError(
        healthError instanceof Error
          ? healthError.message
          : "Could not check Google Sheet health.",
      );
    } finally {
      setIsCheckingHealth(false);
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
          <p>Connect the payroll workbook and confirm the required tabs are ready.</p>
        </div>
        <span className={`status-pill status-${displayedHealthCheck.status}`}>
          {formatHealthStatus(displayedHealthCheck.status)}
        </span>
      </div>

      <div className="setup-grid">
        {onSaveGoogleClientId ? (
          <div className="setup-card">
            <span className="setup-step">1</span>
            <h3>Google OAuth</h3>
            {isDeploymentGoogleOAuthConfigured ? (
              <p>Deployment OAuth is ready.</p>
            ) : googleClientId ? (
              <p className="connected-sheet">Browser OAuth is ready.</p>
            ) : (
              <p>Add OAuth before creating an online workbook.</p>
            )}
            {isDeploymentGoogleOAuthConfigured ? null : (
              <form className="inline-form" onSubmit={handleSaveGoogleClientId}>
                <label>
                  OAuth Client ID
                  <input
                    value={inputGoogleClientId}
                    onChange={(event) => setInputGoogleClientId(event.target.value)}
                    placeholder={
                      googleClientId ??
                      "1234567890-abc.apps.googleusercontent.com"
                    }
                  />
                </label>
                <div className="button-row">
                  <button type="submit">Save OAuth ID</button>
                  {googleClientId ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={handleClearGoogleClientId}
                    >
                      Clear OAuth ID
                    </button>
                  ) : null}
                </div>
              </form>
            )}
          </div>
        ) : null}
        <div className="setup-card">
          <span className="setup-step">{onSaveGoogleClientId ? "2" : "1"}</span>
          <h3>Connect workbook</h3>
          {connectedSpreadsheetId ? (
            <div className="connected-sheet">
              <span>Connected to {connectedSpreadsheetId}</span>
              {spreadsheetUrl ? (
                <a href={spreadsheetUrl} target="_blank" rel="noreferrer">
                  Open Google Sheet
                </a>
              ) : null}
            </div>
          ) : (
            <p>Choose an existing Google Sheet from Drive or create a new workbook.</p>
          )}
          <div className="button-row">
            <button
              type="button"
              onClick={handleLoadDriveSpreadsheets}
              disabled={isLoadingDriveSheets || !canChooseSpreadsheet}
            >
              {isLoadingDriveSheets ? "Loading Drive..." : "Choose from Drive"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handleCreate}
              disabled={isCreating || !canCreateSpreadsheet}
            >
              {isCreating ? "Creating..." : "Create new sheet"}
            </button>
          </div>
          {driveSpreadsheets.length > 0 ? (
            <ul className="drive-sheet-list" aria-label="Google Drive sheets">
              {driveSpreadsheets.map((spreadsheet) => (
                <li key={spreadsheet.id}>
                  <button
                    type="button"
                    className="drive-sheet-option"
                    onClick={() => handleSelectDriveSpreadsheet(spreadsheet)}
                  >
                    <span>{spreadsheet.name}</span>
                    <small>{formatSpreadsheetModifiedTime(spreadsheet.modifiedTime)}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="setup-card health-card">
          <span className="setup-step">{onSaveGoogleClientId ? "3" : "2"}</span>
          <h3>Health check</h3>
          <dl className="health-grid">
            <div>
              <dt>Connection</dt>
              <dd>{displayedHealthCheck.connectionLabel}</dd>
            </div>
            <div>
              <dt>Schema</dt>
              <dd>{displayedHealthCheck.schemaLabel}</dd>
            </div>
          </dl>
          <ul className="compact-list" aria-label="Google Sheet health details">
            {displayedHealthCheck.detailItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <button
            type="button"
            className="secondary-button"
            onClick={handleHealthCheck}
            disabled={isCheckingHealth}
          >
            {isCheckingHealth ? "Checking..." : "Run health check"}
          </button>
        </div>
      </div>

      {error ? <p role="alert">{error}</p> : null}
      {createStatus ? <p role="status">{createStatus}</p> : null}
    </section>
  );
}

function formatHealthStatus(status: SpreadsheetHealthCheck["status"]): string {
  if (status === "healthy") {
    return "Healthy";
  }

  if (status === "needs_attention") {
    return "Needs setup";
  }

  if (status === "unchecked") {
    return "Ready to check";
  }

  return "Not connected";
}
function formatSpreadsheetModifiedTime(modifiedTime?: string): string {
  if (!modifiedTime) {
    return "Google Sheet";
  }

  const parsedDate = new Date(modifiedTime);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Google Sheet";
  }

  const formattedDate = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(parsedDate);

  return `Modified ${formattedDate}`;
}
