import { useMemo, useState } from "react";
import {
  AdvancesScreen,
  type EditAdvancePayload,
  type NewAdvancePayload,
} from "../features/advances/AdvancesScreen";
import type { Advance, AdvanceDeduction } from "../features/advances/types";
import {
  CalendarScreen,
  type NewTimeRecordInput,
} from "../features/calendar/CalendarScreen";
import type {
  NewPublicHolidayInput,
  PublicHoliday,
} from "../features/calendar/types";
import {
  ConfigScreen,
  type NewSalaryConfigInput,
} from "../features/config/ConfigScreen";
import type { SalaryConfig } from "../features/config/types";
import { checkSpreadsheetHealth } from "../features/config/spreadsheetHealth";
import { SalaryScreen } from "../features/salary/SalaryScreen";
import type { TimeRecord } from "../features/time-records/types";
import { isMonthKey } from "../lib/dates";
import { getCachedAppPreferences, setCachedAppPreferences } from "../persistence/cacheDb";
import { fetchSingaporePublicHolidays } from "../integrations/singapore/publicHolidays";
import {
  createGoogleTokenClient as createDefaultGoogleTokenClient,
  type AppGoogleTokenClient,
} from "../integrations/google/auth";
import { GoogleSheetsClient } from "../integrations/google/sheetsClient";
import { buildSpreadsheetCreateBody } from "../integrations/google/spreadsheetSchema";
import { appRoutes, type AppRouteId } from "./routes";

const fallbackMonth = new Date().toISOString().slice(0, 7);
const defaultPayCycleStartDay = 1;

type GoogleSheetsCreateClient = Pick<GoogleSheetsClient, "createSpreadsheet">;

export type AppProps = {
  googleClientId?: string;
  createGoogleTokenClient?: (options: {
    clientId: string;
  }) => AppGoogleTokenClient;
  createGoogleSheetsClient?: (options: {
    accessToken: string;
  }) => GoogleSheetsCreateClient;
};

export function App({
  googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID,
  createGoogleTokenClient = createDefaultGoogleTokenClient,
  createGoogleSheetsClient = (options) => new GoogleSheetsClient(options),
}: AppProps = {}) {
  const cachedPreferences = useMemo(() => getCachedAppPreferences(), []);
  const [activeRoute, setActiveRoute] = useState<AppRouteId>("salary");
  const [spreadsheetId, setSpreadsheetId] = useState(cachedPreferences.spreadsheetId);
  const [selectedMonth, setSelectedMonth] = useState(
    cachedPreferences.selectedMonth ?? fallbackMonth,
  );
  const [payCycleStartDay, setPayCycleStartDay] = useState(
    cachedPreferences.payCycleStartDay ?? defaultPayCycleStartDay,
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
        payCycleStartDay,
      });
    }
  }

  function handleConnectSpreadsheet(nextSpreadsheetId: string) {
    setSpreadsheetId(nextSpreadsheetId);
    setCachedAppPreferences({
      spreadsheetId: nextSpreadsheetId,
      selectedMonth,
      payCycleStartDay,
    });
  }

  async function handleCreateSpreadsheet() {
    if (!googleClientId) {
      throw new Error("Set VITE_GOOGLE_CLIENT_ID before creating an online Google Sheet.");
    }

    const tokenClient = createGoogleTokenClient({ clientId: googleClientId });
    const accessToken = await tokenClient.requestToken({ prompt: "consent" });
    const sheetsClient = createGoogleSheetsClient({ accessToken });
    const spreadsheet = await sheetsClient.createSpreadsheet(
      buildSpreadsheetCreateBody(
        `Domestic Helper Tracker ${new Date().toISOString().slice(0, 10)}`,
      ),
    );
    const nextSpreadsheetId = readCreatedSpreadsheetId(spreadsheet);

    handleConnectSpreadsheet(nextSpreadsheetId);
  }

  function handleCheckSpreadsheetHealth(targetSpreadsheetId: string) {
    return checkSpreadsheetHealth(targetSpreadsheetId);
  }

  function handleAddSalaryConfig(input: NewSalaryConfigInput) {
    setPayCycleStartDay(input.payCycleStartDay ?? defaultPayCycleStartDay);
    setCachedAppPreferences({
      spreadsheetId,
      selectedMonth,
      payCycleStartDay: input.payCycleStartDay ?? defaultPayCycleStartDay,
    });
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

  function handleUpdateAdvance(payload: EditAdvancePayload) {
    const createdAt = new Date().toISOString();

    setAdvances((currentAdvances) =>
      currentAdvances.map((advance) =>
        advance.id === payload.advanceId
          ? {
              ...advance,
              ...payload.advance,
            }
          : advance,
      ),
    );
    setAdvanceDeductions((currentDeductions) => [
      ...currentDeductions.filter(
        (deduction) => deduction.advanceId !== payload.advanceId,
      ),
      ...payload.deductions.map((deduction) => ({
        ...deduction,
        id: `ded_${crypto.randomUUID()}`,
        advanceId: payload.advanceId,
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

  function handleUpdateTimeRecord(record: TimeRecord) {
    setTimeRecords((currentRecords) =>
      currentRecords.map((currentRecord) =>
        currentRecord.id === record.id ? record : currentRecord,
      ),
    );
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
          onUpdateAdvance={handleUpdateAdvance}
        />
      );
    }

    if (routeId === "calendar") {
      return (
        <CalendarScreen
          selectedMonth={selectedMonth}
          publicHolidays={publicHolidays}
          timeRecords={timeRecords}
          onAddTimeRecord={handleAddTimeRecord}
          onUpdateTimeRecord={handleUpdateTimeRecord}
        />
      );
    }

    if (routeId === "config") {
      return (
        <ConfigScreen
          selectedMonth={selectedMonth}
          spreadsheetId={spreadsheetId}
          salaryConfigs={salaryConfigs}
          publicHolidays={publicHolidays}
          onAddSalaryConfig={handleAddSalaryConfig}
          onConnectSpreadsheet={handleConnectSpreadsheet}
          onCreateSpreadsheet={handleCreateSpreadsheet}
          onCheckSpreadsheetHealth={handleCheckSpreadsheetHealth}
          onImportPublicHolidays={handleImportPublicHolidays}
          onAddPublicHoliday={handleAddPublicHoliday}
          onUpdatePublicHoliday={handleUpdatePublicHoliday}
          onDeletePublicHoliday={handleDeletePublicHoliday}
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

function readCreatedSpreadsheetId(spreadsheet: unknown): string {
  if (
    typeof spreadsheet === "object" &&
    spreadsheet !== null &&
    "spreadsheetId" in spreadsheet &&
    typeof spreadsheet.spreadsheetId === "string" &&
    spreadsheet.spreadsheetId
  ) {
    return spreadsheet.spreadsheetId;
  }

  throw new Error("Google Sheets did not return a spreadsheet ID.");
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
