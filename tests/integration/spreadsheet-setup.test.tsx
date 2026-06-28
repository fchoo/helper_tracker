import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SpreadsheetSetup } from "../../src/features/config/SpreadsheetSetup";

describe("SpreadsheetSetup", () => {
  it("connects an existing spreadsheet id", async () => {
    const onConnect = vi.fn().mockResolvedValue(undefined);

    render(<SpreadsheetSetup onConnect={onConnect} onCreate={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Google Spreadsheet ID"), "sheet_123");
    await userEvent.click(screen.getByRole("button", { name: "Connect sheet" }));

    expect(onConnect).toHaveBeenCalledWith("sheet_123");
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
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(<SpreadsheetSetup onConnect={vi.fn()} onCreate={onCreate} />);

    await userEvent.click(screen.getByRole("button", { name: "Create new sheet" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("shows a creation error when Google Sheet creation fails", async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error("Google OAuth is not configured."));

    render(<SpreadsheetSetup onConnect={vi.fn()} onCreate={onCreate} />);

    await userEvent.click(screen.getByRole("button", { name: "Create new sheet" }));

    expect(await screen.findByText("Google OAuth is not configured.")).toBeInTheDocument();
  });

  it("shows a validation message before connecting an empty spreadsheet id", async () => {
    render(<SpreadsheetSetup onConnect={vi.fn()} onCreate={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Connect sheet" }));

    expect(screen.getByText("Enter a Google Spreadsheet ID.")).toBeInTheDocument();
  });
});
