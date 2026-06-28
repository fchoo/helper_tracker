import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";

describe("App", () => {
  it("renders the application shell and default salary screen", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Domestic Helper Tracker" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Salary" })).toBeInTheDocument();
    expect(screen.getByLabelText("Selected month")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
  });

  it("navigates between feature screens", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Advances" }));
    expect(screen.getByRole("heading", { name: "Advances" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Time & Calendar" }));
    expect(
      screen.getByRole("heading", { name: "Time & Calendar" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Config" }));
    expect(screen.getByRole("heading", { name: "Configuration" })).toBeInTheDocument();
  });

  it("shares the selected month across screens", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.clear(screen.getByLabelText("Selected month"));
    await user.type(screen.getByLabelText("Selected month"), "2026-08");
    await user.click(screen.getByRole("button", { name: "Time & Calendar" }));

    expect(screen.getByText("2026-08")).toBeInTheDocument();
  });

  it("creates an online Google Sheet through OAuth and connects the returned spreadsheet id", async () => {
    const user = userEvent.setup();
    const requestToken = vi.fn().mockResolvedValue("token_123");
    const createGoogleTokenClient = vi.fn().mockReturnValue({ requestToken });
    const createSpreadsheet = vi.fn().mockResolvedValue({ spreadsheetId: "sheet_online" });
    const createGoogleSheetsClient = vi.fn().mockReturnValue({ createSpreadsheet });

    render(
      <App
        googleClientId="client_123"
        createGoogleTokenClient={createGoogleTokenClient}
        createGoogleSheetsClient={createGoogleSheetsClient}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Config" }));
    await user.click(screen.getByRole("button", { name: "Create new sheet" }));

    expect(createGoogleTokenClient).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "client_123" }),
    );
    expect(requestToken).toHaveBeenCalledWith({ prompt: "consent" });
    expect(createGoogleSheetsClient).toHaveBeenCalledWith({
      accessToken: "token_123",
    });
    expect(createSpreadsheet).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({
          title: expect.stringContaining("Domestic Helper Tracker"),
        }),
        sheets: expect.arrayContaining([
          expect.objectContaining({
            properties: expect.objectContaining({ title: "Config" }),
          }),
        ]),
      }),
    );
    expect(await screen.findByText("Connected to sheet_online")).toBeInTheDocument();
  });
});
