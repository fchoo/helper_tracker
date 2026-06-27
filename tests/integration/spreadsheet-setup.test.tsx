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

  it("creates a new spreadsheet", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(<SpreadsheetSetup onConnect={vi.fn()} onCreate={onCreate} />);

    await userEvent.click(screen.getByRole("button", { name: "Create new sheet" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("shows a validation message before connecting an empty spreadsheet id", async () => {
    render(<SpreadsheetSetup onConnect={vi.fn()} onCreate={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Connect sheet" }));

    expect(screen.getByText("Enter a Google Spreadsheet ID.")).toBeInTheDocument();
  });
});
