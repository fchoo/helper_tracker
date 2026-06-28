import { FormEvent, useState } from "react";
import {
  buildUncheckedSpreadsheetHealth,
  checkSpreadsheetHealth,
  type SpreadsheetHealthCheck,
} from "./spreadsheetHealth";

export type SpreadsheetSetupProps = {
  spreadsheetId?: string;
  onConnect: (spreadsheetId: string) => Promise<void> | void;
  onCreate: () => Promise<void> | void;
  onHealthCheck?: (spreadsheetId: string) => Promise<SpreadsheetHealthCheck> | SpreadsheetHealthCheck;
};

export function SpreadsheetSetup({
  spreadsheetId,
  onConnect,
  onCreate,
  onHealthCheck,
}: SpreadsheetSetupProps) {
  const [inputSpreadsheetId, setInputSpreadsheetId] = useState("");
  const [error, setError] = useState("");
  const [healthCheck, setHealthCheck] = useState<SpreadsheetHealthCheck>();
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const displayedHealthCheck =
    healthCheck && healthCheck.spreadsheetId === spreadsheetId
      ? healthCheck
      : buildUncheckedSpreadsheetHealth(spreadsheetId);

  async function handleConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedSpreadsheetId = inputSpreadsheetId.trim();

    if (!trimmedSpreadsheetId) {
      setError("Enter a Google Spreadsheet ID.");
      return;
    }

    setError("");
    await onConnect(trimmedSpreadsheetId);
    setHealthCheck(buildUncheckedSpreadsheetHealth(trimmedSpreadsheetId));
    setInputSpreadsheetId("");
  }

  async function handleCreate() {
    setError("");

    try {
      setIsCreating(true);
      await onCreate();
    } catch (createError) {
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
    const targetSpreadsheetId = spreadsheetId ?? inputSpreadsheetId.trim();

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
        <div className="setup-card">
          <span className="setup-step">1</span>
          <h3>Connect workbook</h3>
          {spreadsheetId ? (
            <p className="connected-sheet">Connected to {spreadsheetId}</p>
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
                disabled={isCreating}
              >
                {isCreating ? "Creating..." : "Create new sheet"}
              </button>
            </div>
          </form>
        </div>

        <div className="setup-card health-card">
          <span className="setup-step">2</span>
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
