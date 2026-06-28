import { FormEvent, useState } from "react";
import { normalizeGoogleClientId } from "../../integrations/google/clientId";
import {
  isLegacyLocalSpreadsheetId,
  normalizeGoogleSpreadsheetId,
} from "../../integrations/google/spreadsheetId";
import {
  buildUncheckedSpreadsheetHealth,
  checkSpreadsheetHealth,
  type SpreadsheetHealthCheck,
} from "./spreadsheetHealth";

export type SpreadsheetSetupProps = {
  spreadsheetId?: string;
  googleClientId?: string;
  isGoogleOAuthConfigured?: boolean;
  isDeploymentGoogleOAuthConfigured?: boolean;
  onConnect: (spreadsheetId: string) => Promise<void> | void;
  onCreate: () => Promise<unknown> | unknown;
  onSaveGoogleClientId?: (clientId: string) => Promise<void> | void;
  onClearGoogleClientId?: () => Promise<void> | void;
  onHealthCheck?: (spreadsheetId: string) => Promise<SpreadsheetHealthCheck> | SpreadsheetHealthCheck;
  onSaveAccountBackup?: (spreadsheetId?: string) => Promise<void> | void;
  onRestoreAccountBackup?: () => Promise<void> | void;
};

export function SpreadsheetSetup({
  spreadsheetId,
  googleClientId,
  isGoogleOAuthConfigured,
  isDeploymentGoogleOAuthConfigured = false,
  onConnect,
  onCreate,
  onSaveGoogleClientId,
  onClearGoogleClientId,
  onHealthCheck,
  onSaveAccountBackup,
  onRestoreAccountBackup,
}: SpreadsheetSetupProps) {
  const [inputGoogleClientId, setInputGoogleClientId] = useState("");
  const [inputSpreadsheetId, setInputSpreadsheetId] = useState("");
  const [error, setError] = useState("");
  const [healthCheck, setHealthCheck] = useState<SpreadsheetHealthCheck>();
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createStatus, setCreateStatus] = useState("");
  const [accountBackupStatus, setAccountBackupStatus] = useState("");
  const [isSavingAccountBackup, setIsSavingAccountBackup] = useState(false);
  const [isRestoringAccountBackup, setIsRestoringAccountBackup] = useState(false);
  const canCreateSpreadsheet = isGoogleOAuthConfigured ?? true;
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

  async function handleConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedSpreadsheetId = inputSpreadsheetId.trim();
    const normalizedSpreadsheetId =
      normalizeGoogleSpreadsheetId(trimmedSpreadsheetId);

    if (!normalizedSpreadsheetId) {
      setError(getSpreadsheetIdValidationMessage(trimmedSpreadsheetId));
      return;
    }

    setError("");
    setAccountBackupStatus("");
    setCreateStatus("");
    await onConnect(normalizedSpreadsheetId);
    setHealthCheck(buildUncheckedSpreadsheetHealth(normalizedSpreadsheetId));
    setInputSpreadsheetId("");
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
      await onCreate();
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

  async function handleSaveAccountBackup() {
    setError("");
    setAccountBackupStatus("");

    const targetSpreadsheetId =
      connectedSpreadsheetId ??
      normalizeGoogleSpreadsheetId(inputSpreadsheetId.trim());

    if (!targetSpreadsheetId) {
      setError("Connect or create a Google Sheet before saving account backup.");
      return;
    }

    try {
      setIsSavingAccountBackup(true);
      await onSaveAccountBackup?.(targetSpreadsheetId);
      setAccountBackupStatus("Saved to Google account.");
    } catch (accountBackupError) {
      setError(
        accountBackupError instanceof Error
          ? accountBackupError.message
          : "Could not save setup to Google account.",
      );
    } finally {
      setIsSavingAccountBackup(false);
    }
  }

  async function handleRestoreAccountBackup() {
    setError("");
    setCreateStatus("");
    setAccountBackupStatus("");

    try {
      setIsRestoringAccountBackup(true);
      await onRestoreAccountBackup?.();
      setHealthCheck(undefined);
      setAccountBackupStatus("Restored from Google account.");
    } catch (accountBackupError) {
      setError(
        accountBackupError instanceof Error
          ? accountBackupError.message
          : "Could not restore setup from Google account.",
      );
    } finally {
      setIsRestoringAccountBackup(false);
    }
  }

  async function handleHealthCheck() {
    const targetSpreadsheetId =
      connectedSpreadsheetId ??
      normalizeGoogleSpreadsheetId(inputSpreadsheetId.trim());

    if (!targetSpreadsheetId) {
      setError("Connect or create a Google Sheet before checking health.");
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
            <p className="connected-sheet">Connected to {connectedSpreadsheetId}</p>
          ) : (
            <p>Paste an existing Google Spreadsheet ID or create a new workbook.</p>
          )}
          <form className="inline-form" onSubmit={handleConnect}>
            <label>
              Google Spreadsheet ID
              <input
                value={inputSpreadsheetId}
                onChange={(event) => setInputSpreadsheetId(event.target.value)}
                placeholder="1AbC..."
              />
            </label>
            <div className="button-row">
              <button type="submit">Connect sheet</button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleCreate}
                disabled={isCreating || !canCreateSpreadsheet}
              >
                {isCreating ? "Creating..." : "Create new sheet"}
              </button>
            </div>
          </form>
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
        {onSaveAccountBackup || onRestoreAccountBackup ? (
          <div className="setup-card">
            <span className="setup-step">{onSaveGoogleClientId ? "4" : "3"}</span>
            <h3>Account backup</h3>
            <p>Use Google account storage to keep this setup across browsers.</p>
            <div className="button-row">
              {onSaveAccountBackup ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleSaveAccountBackup}
                  disabled={isSavingAccountBackup || !connectedSpreadsheetId}
                >
                  {isSavingAccountBackup ? "Saving..." : "Save setup"}
                </button>
              ) : null}
              {onRestoreAccountBackup ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleRestoreAccountBackup}
                  disabled={isRestoringAccountBackup}
                >
                  {isRestoringAccountBackup ? "Restoring..." : "Restore setup"}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {error ? <p role="alert">{error}</p> : null}
      {createStatus ? <p role="status">{createStatus}</p> : null}
      {accountBackupStatus ? <p role="status">{accountBackupStatus}</p> : null}
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

function getSpreadsheetIdValidationMessage(spreadsheetId: string): string {
  if (isLegacyLocalSpreadsheetId(spreadsheetId)) {
    return "That is an old local placeholder. Create or connect a real Google Sheet.";
  }

  return "Enter a Google Spreadsheet ID.";
}
