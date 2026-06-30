import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CalendarScreen } from "../../src/features/calendar/CalendarScreen";

describe("CalendarScreen", () => {
  it("shows Sundays, public holidays, and time records for a pay cycle", () => {
    const { container } = render(
      <CalendarScreen
        selectedMonth="2026-08"
        payCycleStartDay={26}
        publicHolidays={[
          {
            id: "holiday_1",
            name: "National Day",
            date: "2026-08-09",
            year: 2026,
            source: "SINGAPORE_IMPORT",
            createdAt: "2026-06-27T12:00:00.000Z",
          },
        ]}
        timeRecords={[
          {
            id: "time_1",
            type: "SUNDAY_OT",
            startDate: "2026-08-09",
            endDate: "2026-08-09",
            notes: "Worked",
            createdAt: "2026-06-27T12:00:00.000Z",
          },
          {
            id: "time_2",
            type: "OFF_DAY",
            startDate: "2026-07-25",
            endDate: "2026-07-27",
            isPaidOffDay: false,
            notes: "Overlapping off day",
            createdAt: "2026-06-27T12:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("National Day")).toHaveClass(
      "calendar-badge-holiday",
    );
    expect(screen.queryByText("Sunday")).not.toBeInTheDocument();
    const workedSundayLabels = screen.getAllByText("Worked Sunday");
    expect(workedSundayLabels.length).toBeGreaterThan(0);
    expect(
      workedSundayLabels.some((label) =>
        label.classList.contains("calendar-badge-sunday-work"),
      ),
    ).toBe(true);
    expect(container.querySelector(".calendar-badge-off-day")).toBeInTheDocument();
    expect(screen.getByText("Overlapping off day")).toBeInTheDocument();
    expect(screen.getByText("Jul 26")).toBeInTheDocument();
    expect(screen.queryByText("Aug 26")).not.toBeInTheDocument();
  });

  it("opens day entry in a dialog and defaults end date to the start date", async () => {
    const user = userEvent.setup();
    const addedRecords: unknown[] = [];

    render(
      <CalendarScreen
        selectedMonth="2026-08"
        payCycleStartDay={26}
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
        onAddTimeRecord={(record) => {
          addedRecords.push(record);
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add time" }));
    expect(screen.getByRole("dialog", { name: "Add time" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Start date"), "2026-08-10");
    expect(screen.getByLabelText("End date")).toHaveValue("2026-08-10");
    await user.click(screen.getByLabelText("Worked"));
    await user.click(screen.getByRole("button", { name: "Save day" }));

    expect(addedRecords).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("No payroll change to save.");

    await user.click(screen.getByLabelText("Pay extra for PH work"));
    await user.click(screen.getByRole("button", { name: "Save day" }));

    expect(addedRecords).toContainEqual(
      expect.objectContaining({
        type: "PUBLIC_HOLIDAY_WORK",
        startDate: "2026-08-10",
        endDate: "2026-08-10",
      }),
    );
  });

  it("blocks an end date before the start date in the time dialog", async () => {
    const user = userEvent.setup();

    render(
      <CalendarScreen
        selectedMonth="2026-08"
        payCycleStartDay={26}
        publicHolidays={[]}
        timeRecords={[]}
        onAddTimeRecord={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add time" }));
    await user.type(screen.getByLabelText("Start date"), "2026-08-10");
    await user.clear(screen.getByLabelText("End date"));
    await user.type(screen.getByLabelText("End date"), "2026-08-09");
    await user.click(screen.getByRole("button", { name: "Save day" }));

    expect(
      screen.getByText("End date must be on or after start date."),
    ).toBeInTheDocument();
  });

  it("updates an existing time record from the dialog", async () => {
    const user = userEvent.setup();
    const updatedRecords: unknown[] = [];

    render(
      <CalendarScreen
        selectedMonth="2026-08"
        payCycleStartDay={26}
        publicHolidays={[]}
        timeRecords={[
          {
            id: "time_1",
            type: "SUNDAY_OT",
            startDate: "2026-08-09",
            endDate: "2026-08-09",
            notes: "Old note",
            createdAt: "2026-06-27T12:00:00.000Z",
          },
        ]}
        onUpdateTimeRecord={(record) => {
          updatedRecords.push(record);
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit time record" }));
    await user.clear(screen.getByLabelText("Time notes"));
    await user.type(screen.getByLabelText("Time notes"), "Updated note");
    await user.click(screen.getByRole("button", { name: "Update day" }));

    expect(updatedRecords).toContainEqual(
      expect.objectContaining({
        id: "time_1",
        type: "SUNDAY_OT",
        startDate: "2026-08-09",
        endDate: "2026-08-09",
        notes: "Updated note",
      }),
    );
  });

  it("shows weekday headers above the pay cycle calendar", () => {
    const { container } = render(
      <CalendarScreen selectedMonth="2026-08" publicHolidays={[]} timeRecords={[]} />,
    );

    expect(
      Array.from(container.querySelectorAll(".weekday-header span")).map(
        (label) => label.textContent,
      ),
    ).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  });
});
