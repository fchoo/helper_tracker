import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CalendarScreen } from "../../src/features/calendar/CalendarScreen";

describe("CalendarScreen", () => {
  it("shows Sundays, public holidays, and time records for a month", () => {
    render(
      <CalendarScreen
        selectedMonth="2026-08"
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
        ]}
      />,
    );

    expect(screen.getByText("National Day")).toBeInTheDocument();
    expect(screen.getAllByText("Sunday").length).toBeGreaterThan(0);
    expect(screen.getByText("Sunday OT")).toBeInTheDocument();
  });

  it("imports and manages public holidays", async () => {
    const user = userEvent.setup();

    render(
      <CalendarScreen
        selectedMonth="2026-08"
        publicHolidays={[]}
        timeRecords={[]}
        onImportPublicHolidays={async () => [
          {
            id: "holiday_1",
            name: "National Day",
            date: "2026-08-09",
            year: 2026,
            source: "SINGAPORE_IMPORT",
            notes: "Sunday",
            createdAt: "2026-06-27T12:00:00.000Z",
          },
        ]}
        onAddPublicHoliday={async (holiday) => ({
          ...holiday,
          id: "manual_1",
          year: Number(holiday.date.slice(0, 4)),
          source: "MANUAL",
          createdAt: "2026-06-27T12:00:00.000Z",
        })}
        onDeletePublicHoliday={async () => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Import 2026 holidays" }));
    expect((await screen.findAllByText("National Day")).length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText("Holiday name"), "Family holiday");
    await user.type(screen.getByLabelText("Holiday date"), "2026-08-17");
    await user.click(screen.getByRole("button", { name: "Add public holiday" }));
    expect((await screen.findAllByText("Family holiday")).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Edit Family holiday" }));
    await user.clear(screen.getByLabelText("Holiday name"));
    await user.type(screen.getByLabelText("Holiday name"), "Family holiday updated");
    await user.click(screen.getByRole("button", { name: "Save public holiday" }));
    expect(
      (await screen.findAllByText("Family holiday updated")).length,
    ).toBeGreaterThan(0);

    await user.click(
      screen.getByRole("button", { name: "Delete Family holiday updated" }),
    );
    expect(screen.queryByText("Family holiday updated")).not.toBeInTheDocument();
  });
});
