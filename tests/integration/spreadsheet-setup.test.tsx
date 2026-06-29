import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SpreadsheetSetup } from "../../src/features/config/SpreadsheetSetup";

describe("SpreadsheetSetup", () => {
  it("connects an existing spreadsheet from Google Drive", async () => {
    const onConnect = vi.fn().mockResolvedValue(undefined);
    const onListDriveSpreadsheets = vi.fn().mockResolvedValue([
      {
        id: "sheet_123",
        name: "Domestic Helper Tracker",
        webViewLink: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
        modifiedTime: "2026-06-29T10:00:00.000Z",
      },
    ]);

    render(
      <SpreadsheetSetup
        isGoogleOAuthConfigured
        onConnect={onConnect}
        onCreate={vi.fn()}
        onListDriveSpreadsheets={onListDriveSpreadsheets}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose from Drive" }));
    await userEvent.click(
      await screen.findByRole("button", { name: /Domestic Helper Tracker/ }),
    );

    expect(onListDriveSpreadsheets).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledWith({
      id: "sheet_123",
      name: "Domestic Helper Tracker",
      webViewLink: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
      modifiedTime: "2026-06-29T10:00:00.000Z",
    });
  });

  it("blocks Drive selection until Google OAuth is configured", async () => {
    const onListDriveSpreadsheets = vi.fn();

    render(
      <SpreadsheetSetup
        isGoogleOAuthConfigured={false}
        onConnect={vi.fn()}
        onCreate={vi.fn()}
        onListDriveSpreadsheets={onListDriveSpreadsheets}
      />,
    );

    expect(screen.getByRole("button", { name: "Choose from Drive" })).toBeDisabled();
  });

  it("does not display old local placeholders as connected sheets", () => {
    render(
      <SpreadsheetSetup
        spreadsheetId="local_c4495524-5185-423e-92ac-62ddb0a5f275"
        onConnect={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    expect(
      screen.queryByText(/Connected to local_c4495524/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Choose an existing Google Sheet from Drive or create a new workbook.",
      ),
    ).toBeInTheDocument();
  });

  it("runs a setup health check for the connected spreadsheet", async () => {
    const onHealthCheck = vi.fn().mockResolvedValue({
      status: "healthy",
      spreadsheetId: "sheet_123",
      checkedAt: "2026-06-28T12:00:00.000Z",
      connectionLabel: "Sheet reachable",
      schemaLabel: "Schema healthy",
      detailItems: ["6 required tabs found", "45 required columns aligned"],
      requiredSheetCount: 6,
      requiredHeaderCount: 45,
      missingSheetCount: 0,
      headerIssueCount: 0,
    });

    render(
      <SpreadsheetSetup
        spreadsheetId="sheet_123"
        onConnect={vi.fn()}
        onCreate={vi.fn()}
        onHealthCheck={onHealthCheck}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Run health check" }));

    expect(onHealthCheck).toHaveBeenCalledWith("sheet_123");
    expect(await screen.findByText("Schema healthy")).toBeInTheDocument();
  });

  it("creates a new spreadsheet", async () => {
    const onCreate = vi.fn().mockResolvedValue({
      id: "sheet_123",
      name: "Domestic Helper Tracker",
      webViewLink: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
    });

    render(
      <SpreadsheetSetup
        isGoogleOAuthConfigured
        onConnect={vi.fn()}
        onCreate={onCreate}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Create new sheet" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("shows progress while Google Sheet creation is in flight", async () => {
    const onCreate = vi.fn(
      () =>
        new Promise<{
          id: string;
          name: string;
        }>((resolve) =>
          setTimeout(
            () =>
              resolve({
                id: "sheet_123",
                name: "Domestic Helper Tracker",
              }),
            50,
          ),
        ),
    );

    render(
      <SpreadsheetSetup
        isGoogleOAuthConfigured
        onConnect={vi.fn()}
        onCreate={onCreate}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Create new sheet" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Waiting for Google sign-in...",
    );
  });

  it("shows a creation error when Google Sheet creation fails", async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error("Google OAuth is not configured."));

    render(
      <SpreadsheetSetup
        isGoogleOAuthConfigured
        onConnect={vi.fn()}
        onCreate={onCreate}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Create new sheet" }));

    expect(await screen.findByText("Google OAuth is not configured.")).toBeInTheDocument();
  });

  it("saves a valid browser OAuth client id", async () => {
    const onSaveGoogleClientId = vi.fn();

    render(
      <SpreadsheetSetup
        onConnect={vi.fn()}
        onCreate={vi.fn()}
        onSaveGoogleClientId={onSaveGoogleClientId}
      />,
    );

    await userEvent.type(
      screen.getByLabelText("OAuth Client ID"),
      "1234567890-local.apps.googleusercontent.com",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save OAuth ID" }));

    expect(onSaveGoogleClientId).toHaveBeenCalledWith(
      "1234567890-local.apps.googleusercontent.com",
    );
  });

  it("blocks sheet creation until Google OAuth is configured", async () => {
    const onCreate = vi.fn();

    render(
      <SpreadsheetSetup
        isGoogleOAuthConfigured={false}
        onConnect={vi.fn()}
        onCreate={onCreate}
      />,
    );

    expect(screen.getByRole("button", { name: "Create new sheet" })).toBeDisabled();
  });

  it("shows a validation message before connecting an empty spreadsheet id", async () => {
    render(<SpreadsheetSetup onConnect={vi.fn()} onCreate={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Run health check" }));

    expect(
      screen.getByText("Choose or create a Google Sheet before checking health."),
    ).toBeInTheDocument();
  });

  it("shows the connected sheet link when available", () => {
    render(
      <SpreadsheetSetup
        spreadsheetId="sheet_123"
        spreadsheetUrl="https://docs.google.com/spreadsheets/d/sheet_123/edit"
        onConnect={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    expect(screen.getByText("Connected to sheet_123")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Google Sheet" })).toHaveAttribute(
      "href",
      "https://docs.google.com/spreadsheets/d/sheet_123/edit",
    );
  });
});
