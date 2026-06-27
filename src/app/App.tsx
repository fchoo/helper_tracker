import { useMemo, useState } from "react";
import { AdvancesScreen, type NewAdvancePayload } from "../features/advances/AdvancesScreen";
import type { Advance, AdvanceDeduction } from "../features/advances/types";
import {
  CalendarScreen,
  type NewPublicHolidayInput,
} from "../features/calendar/CalendarScreen";
import type { PublicHoliday } from "../features/calendar/types";
import {
  ConfigScreen,
  type NewSalaryConfigInput,
} from "../features/config/ConfigScreen";
import type { SalaryConfig } from "../features/config/types";
import { SalaryScreen } from "../features/salary/SalaryScreen";
import {
  TimeRecordsScreen,
  type NewTimeRecordInput,
} from "../features/time-records/TimeRecordsScreen";
import type { TimeRecord } from "../features/time-records/types";
import { isMonthKey } from "../lib/dates";
import { getCachedAppPreferences, setCachedAppPreferences } from "../persistence/cacheDb";
import { fetchSingaporePublicHolidays } from "../integrations/singapore/publicHolidays";
import { appRoutes, type AppRouteId } from "./routes";

const fallbackMonth = new Date().toISOString().slice(0, 7);

export function App() {
  const cachedPreferences = useMemo(() => getCachedAppPreferences(), []);
  const [activeRoute, setActiveRoute] = useState<AppRouteId>("salary");
  const [spreadsheetId, setSpreadsheetId] = useState(cachedPreferences.spreadsheetId);
  const [selectedMonth, setSelectedMonth] = useState(
    cachedPreferences.selectedMonth ?? fallbackMonth,
  );
  const [salaryConfigs, setSalaryConfigs] = useState<SalaryConfig[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [advanceDeductions, setAdvanceDeductions] = useState<AdvanceDeduction[]>(
    [],
  );
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([]);

  function handleMonthChange(month: string) {
    setSelectedMonth(month);

    if (isMonthKey(month)) {
      setCachedAppPreferences({
        ...cachedPreferences,
        spreadsheetId,
        selectedMonth: month,
      });
    }
  }

  function handleConnectSpreadsheet(nextSpreadsheetId: string) {
    setSpreadsheetId(nextSpreadsheetId);
    setCachedAppPreferences({
      spreadsheetId: nextSpreadsheetId,
      selectedMonth,
    });
  }

  function handleCreateSpreadsheet() {
    handleConnectSpreadsheet(`local_${crypto.randomUUID()}`);
  }

  function handleAddSalaryConfig(input: NewSalaryConfigInput) {
    setSalaryConfigs((currentConfigs) => [
      ...currentConfigs,
      {
        ...input,
        id: `cfg_${crypto.randomUUID()}`,
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  function handleAddAdvance(payload: NewAdvancePayload) {
    const advanceId = `adv_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();

    setAdvances((currentAdvances) => [
      ...currentAdvances,
      {
        ...payload.advance,
        id: advanceId,
        createdAt,
      },
    ]);
    setAdvanceDeductions((currentDeductions) => [
      ...currentDeductions,
      ...payload.deductions.map((deduction) => ({
        ...deduction,
        id: `ded_${crypto.randomUUID()}`,
        advanceId,
        createdAt,
      })),
    ]);
  }

  function handleAddTimeRecord(input: NewTimeRecordInput) {
    setTimeRecords((currentRecords) => [
      ...currentRecords,
      {
        ...input,
        id: `time_${crypto.randomUUID()}`,
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  async function handleImportPublicHolidays(year: number) {
    const importedHolidays = await fetchSingaporePublicHolidays(year);
    setPublicHolidays((currentHolidays) =>
      mergePublicHolidays(currentHolidays, importedHolidays),
    );
    return importedHolidays;
  }

  function handleAddPublicHoliday(input: NewPublicHolidayInput): PublicHoliday {
    const holiday: PublicHoliday = {
      ...input,
      id: `holiday_${crypto.randomUUID()}`,
      year: Number(input.date.slice(0, 4)),
      source: "MANUAL",
      createdAt: new Date().toISOString(),
    };

    setPublicHolidays((currentHolidays) =>
      mergePublicHolidays(currentHolidays, [holiday]),
    );
    return holiday;
  }

  function handleUpdatePublicHoliday(holiday: PublicHoliday): PublicHoliday {
    setPublicHolidays((currentHolidays) =>
      currentHolidays.map((currentHoliday) =>
        currentHoliday.id === holiday.id ? holiday : currentHoliday,
      ),
    );
    return holiday;
  }

  function handleDeletePublicHoliday(holidayId: string) {
    setPublicHolidays((currentHolidays) =>
      currentHolidays.filter((holiday) => holiday.id !== holidayId),
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Static PWA MVP</p>
          <h1 id="app-title">Domestic Helper Tracker</h1>
        </div>
        <label className="month-control">
          Selected month
          <input
            type="month"
            value={selectedMonth}
            onChange={(event) => handleMonthChange(event.target.value)}
          />
        </label>
      </header>
      <nav className="primary-nav" aria-label="Primary">
        {appRoutes.map((route) => (
          <button
            type="button"
            key={route.id}
            className={activeRoute === route.id ? "active" : ""}
            aria-current={activeRoute === route.id ? "page" : undefined}
            onClick={() => setActiveRoute(route.id)}
          >
            {route.label}
          </button>
        ))}
      </nav>
      <div className="screen-frame">{renderActiveScreen(activeRoute)}</div>
    </main>
  );

  function renderActiveScreen(routeId: AppRouteId) {
    if (routeId === "advances") {
      return (
        <AdvancesScreen
          advances={advances}
          deductions={advanceDeductions}
          selectedMonth={selectedMonth}
          onAddAdvance={handleAddAdvance}
        />
      );
    }

    if (routeId === "time") {
      return (
        <TimeRecordsScreen
          selectedMonth={selectedMonth}
          timeRecords={timeRecords}
          onAddTimeRecord={handleAddTimeRecord}
        />
      );
    }

    if (routeId === "calendar") {
      return (
        <CalendarScreen
          selectedMonth={selectedMonth}
          publicHolidays={publicHolidays}
          timeRecords={timeRecords}
          onImportPublicHolidays={handleImportPublicHolidays}
          onAddPublicHoliday={handleAddPublicHoliday}
          onUpdatePublicHoliday={handleUpdatePublicHoliday}
          onDeletePublicHoliday={handleDeletePublicHoliday}
        />
      );
    }

    if (routeId === "config") {
      return (
        <ConfigScreen
          spreadsheetId={spreadsheetId}
          salaryConfigs={salaryConfigs}
          onAddSalaryConfig={handleAddSalaryConfig}
          onConnectSpreadsheet={handleConnectSpreadsheet}
          onCreateSpreadsheet={handleCreateSpreadsheet}
        />
      );
    }

    return (
      <SalaryScreen
        selectedMonth={selectedMonth}
        salaryConfigs={salaryConfigs}
        advances={advances}
        advanceDeductions={advanceDeductions}
        timeRecords={timeRecords}
        publicHolidays={publicHolidays}
      />
    );
  }
}

function mergePublicHolidays(
  currentHolidays: PublicHoliday[],
  nextHolidays: PublicHoliday[],
): PublicHoliday[] {
  const byId = new Map<string, PublicHoliday>();

  for (const holiday of currentHolidays) {
    byId.set(holiday.id, holiday);
  }

  for (const holiday of nextHolidays) {
    byId.set(holiday.id, holiday);
  }

  return [...byId.values()];
}
