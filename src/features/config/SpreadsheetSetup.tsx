import { FormEvent, useState } from "react";

export type SpreadsheetSetupProps = {
  onConnect: (spreadsheetId: string) => Promise<void> | void;
  onCreate: () => Promise<void> | void;
};

export function SpreadsheetSetup({
  onConnect,
  onCreate,
}: SpreadsheetSetupProps) {
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [error, setError] = useState("");

  async function handleConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedSpreadsheetId = spreadsheetId.trim();

    if (!trimmedSpreadsheetId) {
      setError("Enter a Google Spreadsheet ID.");
      return;
    }

    setError("");
    await onConnect(trimmedSpreadsheetId);
  }

  async function handleCreate() {
    setError("");
    await onCreate();
  }

  return (
    <section aria-labelledby="spreadsheet-setup-title">
      <h2 id="spreadsheet-setup-title">Google Sheet</h2>
      <form onSubmit={handleConnect}>
        <label>
          Google Spreadsheet ID
          <input
            value={spreadsheetId}
            onChange={(event) => setSpreadsheetId(event.target.value)}
          />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit">Connect sheet</button>
      </form>
      <button type="button" onClick={handleCreate}>
        Create new sheet
      </button>
    </section>
  );
}
