import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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
});
