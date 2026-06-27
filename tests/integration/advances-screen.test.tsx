import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdvancesScreen } from "../../src/features/advances/AdvancesScreen";
import { parseAdvanceScheduleText } from "../../src/features/advances/advanceSchedule";

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

describe("AdvancesScreen", () => {
  it("saves an advance with split deductions", async () => {
    const onAddAdvance = vi.fn().mockResolvedValue(undefined);

    render(
      <AdvancesScreen
        advances={[]}
        deductions={[]}
        selectedMonth="2026-06"
        onAddAdvance={onAddAdvance}
      />,
    );

    await userEvent.type(screen.getByLabelText("Advance date"), "2026-06-01");
    await userEvent.type(screen.getByLabelText("Amount"), "300");
    await userEvent.type(screen.getByLabelText("Description"), "Loan");
    await userEvent.type(
      screen.getByLabelText("Deduction schedule"),
      "2026-06: 100\n2026-07: 200",
    );
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
      />,
    );

    expect(
      screen.getByText("Selected month deductions: SGD 100.00"),
    ).toBeInTheDocument();
  });
});
