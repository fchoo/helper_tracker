import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SpreadsheetSetup } from "../../src/features/config/SpreadsheetSetup";

describe("SpreadsheetSetup", () => {
  it("opens Google Picker and verifies the selected spreadsheet through connect", async () => {
    const onConnect = vi.fn().mockResolvedValue(undefined);
    const onPickDriveSpreadsheet = vi.fn().mockResolvedValue({
      id: "sheet_123",
      name: "Domestic Helper Tracker",
      webViewLink: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
    });

    render(
      <SpreadsheetSetup
        isGoogleOAuthConfigured
        onConnect={onConnect}
        onCreate={vi.fn()}
        onPickDriveSpreadsheet={onPickDriveSpreadsheet}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose from Drive" }));

    expect(onPickDriveSpreadsheet).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledWith({
      id: "sheet_123",
      name: "Domestic Helper Tracker",
      webViewLink: "https://docs.google.com/spreadsheets/d/sheet_123/edit",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Google Sheet connected.",
    );
  });

  it("blocks Drive selection until Google Sheets is configured", () => {
    render(
      <SpreadsheetSetup
        isGoogleOAuthConfigured={false}
        onConnect={vi.fn()}
        onCreate={vi.fn()}
        onPickDriveSpreadsheet={vi.fn()}
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
      screen.queryByText(/local_c4495524/),
    ).not.toBeInTheDocument();
    expect(screen.getByText("No workbook connected.")).toBeInTheDocument();
  });

  it("creates and verifies a new spreadsheet", async () => {
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
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Google Sheet connected.",
    );
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
      "Creating and verifying workbook...",
    );
  });

  it("shows an error when verification fails", async () => {
    const onConnect = vi
      .fn()
      .mockRejectedValue(new Error("Google Sheet setup issue: 1 missing tabs."));

    render(
      <SpreadsheetSetup
        isGoogleOAuthConfigured
        onConnect={onConnect}
        onCreate={vi.fn()}
        onPickDriveSpreadsheet={vi.fn().mockResolvedValue({
          id: "sheet_123",
          name: "Domestic Helper Tracker",
        })}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose from Drive" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Google Sheet setup issue: 1 missing tabs.",
    );
  });

  it("shows the connected sheet as a name and id link", () => {
    render(
      <SpreadsheetSetup
        spreadsheetId="sheet_123"
        spreadsheetName="Domestic Helper Tracker"
        spreadsheetUrl="https://docs.google.com/spreadsheets/d/sheet_123/edit"
        onConnect={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("link", {
        name: "Domestic Helper Tracker (sheet_123)",
      }),
    ).toHaveAttribute(
      "href",
      "https://docs.google.com/spreadsheets/d/sheet_123/edit",
    );
  });
});
