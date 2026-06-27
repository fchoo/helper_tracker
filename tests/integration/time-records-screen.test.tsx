import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TimeRecordsScreen } from "../../src/features/time-records/TimeRecordsScreen";

describe("TimeRecordsScreen", () => {
  it("saves a Sunday overtime record", async () => {
    const onAddTimeRecord = vi.fn().mockResolvedValue(undefined);

    render(
      <TimeRecordsScreen
        selectedMonth="2026-06"
        timeRecords={[]}
        onAddTimeRecord={onAddTimeRecord}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("Record type"), "SUNDAY_OT");
    await userEvent.type(screen.getByLabelText("Start date"), "2026-06-07");
    await userEvent.type(screen.getByLabelText("End date"), "2026-06-07");
    await userEvent.type(screen.getByLabelText("Notes"), "Worked Sunday");
    await userEvent.click(screen.getByRole("button", { name: "Save time record" }));

    expect(onAddTimeRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SUNDAY_OT",
        startDate: "2026-06-07",
        endDate: "2026-06-07",
        notes: "Worked Sunday",
      }),
    );
  });

  it("blocks an end date before the start date", async () => {
    const onAddTimeRecord = vi.fn();

    render(
      <TimeRecordsScreen
        selectedMonth="2026-06"
        timeRecords={[]}
        onAddTimeRecord={onAddTimeRecord}
      />,
    );

    await userEvent.type(screen.getByLabelText("Start date"), "2026-06-10");
    await userEvent.type(screen.getByLabelText("End date"), "2026-06-09");
    await userEvent.click(screen.getByRole("button", { name: "Save time record" }));

    expect(onAddTimeRecord).not.toHaveBeenCalled();
    expect(screen.getByText("End date must be on or after start date.")).toBeInTheDocument();
  });

  it("shows selected-month counts", () => {
    render(
      <TimeRecordsScreen
        selectedMonth="2026-06"
        timeRecords={[
          {
            id: "time_1",
            type: "SUNDAY_OT",
            startDate: "2026-06-07",
            endDate: "2026-06-07",
            createdAt: "2026-06-27T12:00:00.000Z",
          },
          {
            id: "time_2",
            type: "OFF_DAY",
            startDate: "2026-06-10",
            endDate: "2026-06-11",
            isPaidOffDay: false,
            createdAt: "2026-06-27T12:00:00.000Z",
          },
        ]}
        onAddTimeRecord={vi.fn()}
      />,
    );

    expect(screen.getByText("Sunday OT: 1")).toBeInTheDocument();
    expect(screen.getByText("Unpaid off days: 2")).toBeInTheDocument();
  });
});
