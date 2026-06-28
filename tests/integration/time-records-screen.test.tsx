import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TimeRecordsScreen } from "../../src/features/time-records/TimeRecordsScreen";

describe("TimeRecordsScreen", () => {
  it("saves Sunday work from the simplified day-entry flow", async () => {
    const onAddTimeRecord = vi.fn().mockResolvedValue(undefined);

    render(
      <TimeRecordsScreen
        selectedMonth="2026-06"
        timeRecords={[]}
        onAddTimeRecord={onAddTimeRecord}
      />,
    );

    await userEvent.type(screen.getByLabelText("Start date"), "2026-06-07");
    await userEvent.click(screen.getByLabelText("Worked"));
    await userEvent.type(screen.getByLabelText("Notes"), "Worked Sunday");
    await userEvent.click(screen.getByRole("button", { name: "Save day" }));

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
    await userEvent.click(screen.getByRole("button", { name: "Save day" }));

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

    expect(screen.getByText("Worked Sundays: 1")).toBeInTheDocument();
    expect(screen.getByText("Extra unpaid days off: 2")).toBeInTheDocument();
  });

  it("does not save a normal public holiday work day unless extra pay is selected", async () => {
    const onAddTimeRecord = vi.fn().mockResolvedValue(undefined);

    render(
      <TimeRecordsScreen
        selectedMonth="2026-08"
        publicHolidays={[
          {
            id: "holiday_1",
            name: "National Day observed",
            date: "2026-08-10",
            year: 2026,
            source: "MANUAL",
            createdAt: "2026-06-27T12:00:00.000Z",
          },
        ]}
        timeRecords={[]}
        onAddTimeRecord={onAddTimeRecord}
      />,
    );

    await userEvent.type(screen.getByLabelText("Start date"), "2026-08-10");
    await userEvent.click(screen.getByLabelText("Worked"));
    await userEvent.click(screen.getByRole("button", { name: "Save day" }));

    expect(onAddTimeRecord).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("No payroll change to save.");

    await userEvent.click(screen.getByLabelText("Pay extra for PH work"));
    await userEvent.click(screen.getByRole("button", { name: "Save day" }));

    expect(onAddTimeRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PUBLIC_HOLIDAY_WORK",
        startDate: "2026-08-10",
        endDate: "2026-08-10",
      }),
    );
  });
});
