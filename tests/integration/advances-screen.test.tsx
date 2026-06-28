import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdvancesScreen } from "../../src/features/advances/AdvancesScreen";
import {
  parseAdvanceScheduleText,
  validateStructuredAdvanceSchedule,
} from "../../src/features/advances/advanceSchedule";

describe("parseAdvanceScheduleText", () => {
  it("parses split deduction lines", () => {
    expect(
      parseAdvanceScheduleText("2026-06: 100 | First\n2026-07: 200", 300),
    ).toEqual([
      { month: "2026-06", amount: 100, notes: "First" },
      { month: "2026-07", amount: 200, notes: "" },
    ]);
  });

  it("rejects schedules that do not sum to the advance amount", () => {
    expect(() => parseAdvanceScheduleText("2026-06: 100", 300)).toThrow(
      "Deduction schedule total must match the advance amount.",
    );
  });
});

describe("validateStructuredAdvanceSchedule", () => {
  it("rejects repeated deduction months", () => {
    expect(() =>
      validateStructuredAdvanceSchedule(
        [
          { month: "2026-06", amount: 100, notes: "" },
          { month: "2026-06", amount: 200, notes: "" },
        ],
        300,
      ),
    ).toThrow("Deduction schedule cannot repeat the same month.");
  });
});

describe("AdvancesScreen", () => {
  it("saves an advance with split deductions", async () => {
    const onAddAdvance = vi.fn().mockResolvedValue(undefined);

    render(
      <AdvancesScreen
        advances={[]}
        deductions={[]}
        selectedMonth="2026-06"
        onAddAdvance={onAddAdvance}
        onUpdateAdvance={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Add advance" }));
    await userEvent.type(screen.getByLabelText("Advance date"), "2026-06-01");
    await userEvent.type(screen.getByLabelText("Advance amount"), "300");
    await userEvent.type(screen.getByLabelText("Description"), "Loan");
    await userEvent.type(screen.getByLabelText("Deduction pay month 1"), "2026-06");
    await userEvent.type(screen.getByLabelText("Deduction amount 1"), "100");
    await userEvent.click(
      screen.getByRole("button", { name: "Add deduction pay month" }),
    );
    await userEvent.type(screen.getByLabelText("Deduction pay month 2"), "2026-07");
    await userEvent.type(screen.getByLabelText("Deduction amount 2"), "200");
    await userEvent.click(screen.getByRole("button", { name: "Save advance" }));

    expect(onAddAdvance).toHaveBeenCalledWith(
      expect.objectContaining({
        advance: expect.objectContaining({
          date: "2026-06-01",
          amount: 300,
          description: "Loan",
        }),
        deductions: [
          { month: "2026-06", amount: 100, notes: "" },
          { month: "2026-07", amount: 200, notes: "" },
        ],
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Advance saved.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the remaining advance amount left to schedule", async () => {
    render(
      <AdvancesScreen
        advances={[]}
        deductions={[]}
        selectedMonth="2026-06"
        onAddAdvance={vi.fn()}
        onUpdateAdvance={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Add advance" }));
    await userEvent.type(screen.getByLabelText("Advance amount"), "300");
    await userEvent.type(screen.getByLabelText("Deduction amount 1"), "100");

    expect(
      screen.getByText("Left to schedule: SGD 200.00"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Schedule total:/)).not.toBeInTheDocument();
  });

  it("shows selected-month advance deduction total", () => {
    render(
      <AdvancesScreen
        selectedMonth="2026-06"
        advances={[
          {
            id: "adv_1",
            date: "2026-06-01",
            amount: 300,
            description: "Loan",
            createdAt: "2026-06-27T12:00:00.000Z",
          },
        ]}
        deductions={[
          {
            id: "ded_1",
            advanceId: "adv_1",
            month: "2026-06",
            amount: 100,
            createdAt: "2026-06-27T12:00:00.000Z",
          },
        ]}
        onAddAdvance={vi.fn()}
        onUpdateAdvance={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Deducted in pay month 2026-06: SGD 100.00"),
    ).toBeInTheDocument();
  });

  it("edits an existing advance in a popup form", async () => {
    const onUpdateAdvance = vi.fn().mockResolvedValue(undefined);

    render(
      <AdvancesScreen
        selectedMonth="2026-06"
        advances={[
          {
            id: "adv_1",
            date: "2026-06-01",
            amount: 300,
            description: "Loan",
            createdAt: "2026-06-27T12:00:00.000Z",
          },
        ]}
        deductions={[
          {
            id: "ded_1",
            advanceId: "adv_1",
            month: "2026-06",
            amount: 300,
            notes: "Original",
            createdAt: "2026-06-27T12:00:00.000Z",
          },
        ]}
        onAddAdvance={vi.fn()}
        onUpdateAdvance={onUpdateAdvance}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("dialog", { name: "Edit advance" })).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Advance amount"));
    await userEvent.type(screen.getByLabelText("Advance amount"), "250");
    await userEvent.clear(screen.getByLabelText("Description"));
    await userEvent.type(screen.getByLabelText("Description"), "Updated loan");
    await userEvent.clear(screen.getByLabelText("Deduction amount 1"));
    await userEvent.type(screen.getByLabelText("Deduction amount 1"), "250");
    await userEvent.click(screen.getByRole("button", { name: "Update advance" }));

    expect(onUpdateAdvance).toHaveBeenCalledWith(
      expect.objectContaining({
        advanceId: "adv_1",
        advance: expect.objectContaining({
          date: "2026-06-01",
          amount: 250,
          description: "Updated loan",
        }),
        deductions: [{ month: "2026-06", amount: 250, notes: "Original" }],
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Advance updated.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
