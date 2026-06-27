import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../src/app/App";

describe("App", () => {
  it("renders the application title", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Domestic Helper Tracker" }),
    ).toBeInTheDocument();
  });
});
