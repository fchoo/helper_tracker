import { useMemo, useRef, useState } from "react";
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
import {
  getCachedAppPreferences,
  sanitizeCachedAppPreferences,
  setCachedAppPreferences,
  type CachedAppPreferences,
} from "../persistence/cacheDb";
import { fetchSingaporePublicHolidays } from "../integrations/singapore/publicHolidays";
import { normalizeGoogleClientId } from "../integrations/google/clientId";
import { normalizeGoogleSpreadsheetId } from "../integrations/google/spreadsheetId";
import {
  GOOGLE_APP_SCOPES,
  GOOGLE_DRIVE_APPDATA_SCOPE,
  GOOGLE_SHEETS_SCOPE,
  createGoogleTokenClient as createDefaultGoogleTokenClient,
  type AppGoogleTokenClient,
} from "../integrations/google/auth";
import { GoogleDriveAppDataClient } from "../integrations/google/driveAppDataClient";
import { GoogleSheetsClient } from "../integrations/google/sheetsClient";
import {
  buildEnsureSchemaRequests,
  buildSpreadsheetCreateBody,
  getRequiredSheetSchemas,
  type SpreadsheetMetadata,
} from "../integrations/google/spreadsheetSchema";
import { SheetsRepository } from "../persistence/sheetsRepository";
import { appRoutes, type AppRouteId } from "./routes";

const fallbackMonth = new Date().toISOString().slice(0, 7);
const defaultPayCycleStartDay = 1;
const accountPreferencesFileName = "helper-tracker-preferences.json";

type GoogleSheetsAppClient = Pick<
  GoogleSheetsClient,
  | "appendValues"
  | "batchUpdate"
  | "createSpreadsheet"
  | "getSpreadsheet"
  | "getValues"
  | "updateValues"
>;
type GoogleAccountStorageClient = Pick<
  GoogleDriveAppDataClient,
  "readJsonFile" | "writeJsonFile"
>;

export type AppProps = {
  googleClientId?: string;
  createGoogleTokenClient?: (options: {
    clientId: string;
    scope?: string;
  }) => AppGoogleTokenClient;
  createGoogleSheetsClient?: (options: {
    accessToken: string;
  }) => GoogleSheetsAppClient;
  createGoogleDriveAppDataClient?: (options: {
    accessToken: string;
  }) => GoogleAccountStorageClient;
};

export function App({
  googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID,
  createGoogleTokenClient = createDefaultGoogleTokenClient,
  createGoogleSheetsClient = (options) => new GoogleSheetsClient(options),
  createGoogleDriveAppDataClient = (options) =>
    new GoogleDriveAppDataClient(options),
}: AppProps = {}) {
  const cachedPreferences = useMemo(() => getCachedAppPreferences(), []);
  const deploymentGoogleClientId = normalizeGoogleClientId(googleClientId);
  const [activeRoute, setActiveRoute] = useState<AppRouteId>("salary");
  const [spreadsheetId, setSpreadsheetId] = useState(cachedPreferences.spreadsheetId);
  const [selectedMonth, setSelectedMonth] = useState(
    cachedPreferences.selectedMonth ?? fallbackMonth,
  );
  const [payCycleStartDay, setPayCycleStartDay] = useState(
    cachedPreferences.payCycleStartDay ?? defaultPayCycleStartDay,
  );
  const [browserGoogleClientId, setBrowserGoogleClientId] = useState(
    cachedPreferences.googleClientId,
  );
  const [salaryConfigs, setSalaryConfigs] = useState<SalaryConfig[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [advanceDeductions, setAdvanceDeductions] = useState<AdvanceDeduction[]>(
    [],
  );
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([]);
  const activeGoogleClientId = deploymentGoogleClientId ?? browserGoogleClientId;
  const googleSheetsAccessTokenRef = useRef<string | undefined>(undefined);

  function buildCurrentPreferences(
    overrides: CachedAppPreferences = {},
  ): CachedAppPreferences {
    return sanitizeCachedAppPreferences({
      spreadsheetId,
      selectedMonth,
      payCycleStartDay,
      googleClientId: browserGoogleClientId,
      ...overrides,
    });
  }

  function cachePreferences(overrides: CachedAppPreferences = {}) {
    setCachedAppPreferences(buildCurrentPreferences(overrides));
  }

  function handleMonthChange(month: string) {
    setSelectedMonth(month);

    if (isMonthKey(month)) {
      cachePreferences({ selectedMonth: month });
    }
  }

  async function handleConnectSpreadsheet(nextSpreadsheetId: string) {
    const normalizedSpreadsheetId = normalizeGoogleSpreadsheetId(nextSpreadsheetId);

    if (!normalizedSpreadsheetId) {
      throw new Error("Connect a real Google Spreadsheet ID.");
    }

    setSpreadsheetId(normalizedSpreadsheetId);
    cachePreferences({ spreadsheetId: normalizedSpreadsheetId });
    await loadSpreadsheetRecords(normalizedSpreadsheetId);
  }

  function handleSaveGoogleClientId(nextGoogleClientId: string) {
    const normalizedGoogleClientId = normalizeGoogleClientId(nextGoogleClientId);

    if (!normalizedGoogleClientId) {
      throw new Error("Enter a valid Google OAuth Client ID.");
    }

    setBrowserGoogleClientId(normalizedGoogleClientId);
    cachePreferences({ googleClientId: normalizedGoogleClientId });
  }

  function handleClearGoogleClientId() {
    setBrowserGoogleClientId(undefined);
    cachePreferences({ googleClientId: undefined });
  }

  async function handleCreateSpreadsheet(): Promise<string> {
    if (!activeGoogleClientId) {
      throw new Error("Add a Google OAuth Client ID before creating an online Google Sheet.");
    }

    const tokenClient = createGoogleTokenClient({
      clientId: activeGoogleClientId,
      scope: GOOGLE_APP_SCOPES,
    });
    const accessToken = await tokenClient.requestToken({ prompt: "consent" });
    googleSheetsAccessTokenRef.current = accessToken;
    const sheetsClient = createGoogleSheetsClient({ accessToken });
    const spreadsheet = await sheetsClient.createSpreadsheet(
      buildSpreadsheetCreateBody(
        `Domestic Helper Tracker ${new Date().toISOString().slice(0, 10)}`,
      ),
    );
    const nextSpreadsheetId = readCreatedSpreadsheetId(spreadsheet);
    const spreadsheetMetadata = hasSheetMetadata(spreadsheet)
      ? spreadsheet
      : readSpreadsheetMetadata(await sheetsClient.getSpreadsheet(nextSpreadsheetId));
    const schemaRequests = buildEnsureSchemaRequests(spreadsheetMetadata);

    if (schemaRequests.length > 0) {
      await sheetsClient.batchUpdate(nextSpreadsheetId, schemaRequests);
    }

    setSpreadsheetId(nextSpreadsheetId);
    cachePreferences({ spreadsheetId: nextSpreadsheetId });
    await loadSpreadsheetRecordsWithClient(sheetsClient, nextSpreadsheetId);
    return nextSpreadsheetId;
  }

  async function handleCheckSpreadsheetHealth(targetSpreadsheetId: string) {
    if (!activeGoogleClientId) {
      throw new Error("Add a Google OAuth Client ID before checking the online sheet.");
    }

    const tokenClient = createGoogleTokenClient({
      clientId: activeGoogleClientId,
      scope: GOOGLE_APP_SCOPES,
    });
    const accessToken = await tokenClient.requestToken({ prompt: "consent" });
    googleSheetsAccessTokenRef.current = accessToken;
    const sheetsClient = createGoogleSheetsClient({ accessToken });
    const spreadsheetMetadata = readSpreadsheetMetadata(
      await sheetsClient.getSpreadsheet(targetSpreadsheetId),
    );
    await loadSpreadsheetRecordsWithClient(sheetsClient, targetSpreadsheetId);

    return checkSpreadsheetHealth(
      targetSpreadsheetId,
      await readSpreadsheetMetadataWithHeaders(
        sheetsClient,
        targetSpreadsheetId,
        spreadsheetMetadata,
      ),
    );
  }

  async function handleSaveAccountBackup(targetSpreadsheetId?: string) {
    const normalizedSpreadsheetId = normalizeGoogleSpreadsheetId(
      targetSpreadsheetId ?? spreadsheetId,
    );

    if (!normalizedSpreadsheetId) {
      throw new Error("Connect a real Google Sheet before saving account backup.");
    }

    const driveClient = await createAccountStorageClient();
    const preferences = buildAccountPreferences({
      spreadsheetId: normalizedSpreadsheetId,
    });

    await driveClient.writeJsonFile(accountPreferencesFileName, preferences);
    setSpreadsheetId(normalizedSpreadsheetId);
    cachePreferences({ spreadsheetId: normalizedSpreadsheetId });
  }

  async function handleRestoreAccountBackup() {
    const driveClient = await createAccountStorageClient();
    const storedPreferences = await driveClient.readJsonFile(
      accountPreferencesFileName,
    );

    if (!isCachedAppPreferences(storedPreferences)) {
      throw new Error("No saved Helper Tracker setup was found in this Google account.");
    }

    const restoredPreferences = sanitizeCachedAppPreferences(storedPreferences);

    if (!restoredPreferences.spreadsheetId) {
      throw new Error("Saved account setup does not include a Google Sheet.");
    }

    setSpreadsheetId(restoredPreferences.spreadsheetId);
    await loadSpreadsheetRecords(restoredPreferences.spreadsheetId);

    if (restoredPreferences.selectedMonth) {
      setSelectedMonth(restoredPreferences.selectedMonth);
    }

    if (restoredPreferences.payCycleStartDay) {
      setPayCycleStartDay(restoredPreferences.payCycleStartDay);
    }

    cachePreferences({
      spreadsheetId: restoredPreferences.spreadsheetId,
      selectedMonth: restoredPreferences.selectedMonth ?? selectedMonth,
      payCycleStartDay: restoredPreferences.payCycleStartDay ?? payCycleStartDay,
    });
  }

  async function createAccountStorageClient(): Promise<GoogleAccountStorageClient> {
    if (!activeGoogleClientId) {
      throw new Error("Add a Google OAuth Client ID before using account backup.");
    }

    const tokenClient = createGoogleTokenClient({
      clientId: activeGoogleClientId,
      scope: GOOGLE_DRIVE_APPDATA_SCOPE,
    });
    const accessToken = await tokenClient.requestToken({ prompt: "consent" });
    return createGoogleDriveAppDataClient({ accessToken });
  }

  async function createSheetsRepository(): Promise<SheetsRepository> {
    if (!activeGoogleClientId) {
      throw new Error("Add a Google OAuth Client ID before saving to Google Sheets.");
    }

    const normalizedSpreadsheetId = normalizeGoogleSpreadsheetId(spreadsheetId);

    if (!normalizedSpreadsheetId) {
      throw new Error("Connect a real Google Sheet before saving records.");
    }

    const accessToken = await getGoogleSheetsAccessToken();
    return new SheetsRepository(
      normalizedSpreadsheetId,
      createGoogleSheetsClient({ accessToken }),
    );
  }

  async function loadSpreadsheetRecords(targetSpreadsheetId: string): Promise<void> {
    if (!activeGoogleClientId) {
      return;
    }

    const accessToken = await getGoogleSheetsAccessToken();
    await loadSpreadsheetRecordsWithClient(
      createGoogleSheetsClient({ accessToken }),
      targetSpreadsheetId,
    );
  }

  async function getGoogleSheetsAccessToken(): Promise<string> {
    if (googleSheetsAccessTokenRef.current) {
      return googleSheetsAccessTokenRef.current;
    }

    if (!activeGoogleClientId) {
      throw new Error("Add a Google OAuth Client ID before using Google Sheets.");
    }

    const tokenClient = createGoogleTokenClient({
      clientId: activeGoogleClientId,
      scope: GOOGLE_SHEETS_SCOPE,
    });
    const accessToken = await tokenClient.requestToken({ prompt: "consent" });
    googleSheetsAccessTokenRef.current = accessToken;
    return accessToken;
  }

  async function loadSpreadsheetRecordsWithClient(
    sheetsClient: GoogleSheetsAppClient,
    targetSpreadsheetId: string,
  ): Promise<void> {
    const repository = new SheetsRepository(targetSpreadsheetId, sheetsClient);
    const [
      nextSalaryConfigs,
      nextAdvances,
      nextAdvanceDeductions,
      nextTimeRecords,
      nextPublicHolidays,
    ] = await Promise.all([
      repository.listSalaryConfigs(),
      repository.listAdvances(),
      repository.listAdvanceDeductions(),
      repository.listTimeRecords(),
      repository.listPublicHolidays(),
    ]);

    setSalaryConfigs(nextSalaryConfigs);
    setAdvances(nextAdvances);
    setAdvanceDeductions(nextAdvanceDeductions);
    setTimeRecords(nextTimeRecords);
    setPublicHolidays(nextPublicHolidays);

    const newestPayCycleStartDay = [...nextSalaryConfigs]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .find((config) => config.payCycleStartDay)?.payCycleStartDay;

    if (newestPayCycleStartDay) {
      setPayCycleStartDay(newestPayCycleStartDay);
      cachePreferences({
        spreadsheetId: targetSpreadsheetId,
        payCycleStartDay: newestPayCycleStartDay,
      });
    }
  }

  function buildAccountPreferences(
    overrides: CachedAppPreferences = {},
  ): CachedAppPreferences {
    return sanitizeCachedAppPreferences({
      spreadsheetId,
      selectedMonth,
      payCycleStartDay,
      ...overrides,
    });
  }

  async function handleAddSalaryConfig(input: NewSalaryConfigInput) {
    const salaryConfig: SalaryConfig = {
      ...input,
      id: `cfg_${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
    };
    const repository = await createSheetsRepository();

    await repository.addSalaryConfig(salaryConfig);
    setPayCycleStartDay(input.payCycleStartDay ?? defaultPayCycleStartDay);
    cachePreferences({
      payCycleStartDay: input.payCycleStartDay ?? defaultPayCycleStartDay,
    });
    setSalaryConfigs((currentConfigs) => [...currentConfigs, salaryConfig]);
  }

  async function handleAddAdvance(payload: NewAdvancePayload) {
    const advanceId = `adv_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const advance: Advance = {
      ...payload.advance,
      id: advanceId,
      createdAt,
    };
    const deductions: AdvanceDeduction[] = payload.deductions.map((deduction) => ({
      ...deduction,
      id: `ded_${crypto.randomUUID()}`,
      advanceId,
      createdAt,
    }));
    const repository = await createSheetsRepository();

    await repository.addAdvance(advance, deductions);
    setAdvances((currentAdvances) => [...currentAdvances, advance]);
    setAdvanceDeductions((currentDeductions) => [
      ...currentDeductions,
      ...deductions,
    ]);
  }

  async function handleUpdateAdvance(payload: EditAdvancePayload) {
    const createdAt = new Date().toISOString();
    const existingAdvance = advances.find(
      (advance) => advance.id === payload.advanceId,
    );
    const advance: Advance = {
      ...existingAdvance,
      ...payload.advance,
      id: payload.advanceId,
      createdAt: existingAdvance?.createdAt ?? createdAt,
    };
    const deductions: AdvanceDeduction[] = payload.deductions.map((deduction) => ({
      ...deduction,
      id: `ded_${crypto.randomUUID()}`,
      advanceId: payload.advanceId,
      createdAt,
    }));
    const repository = await createSheetsRepository();

    await repository.updateAdvance(advance, deductions);
    setAdvances((currentAdvances) =>
      currentAdvances.map((advance) =>
        advance.id === payload.advanceId ? { ...advance, ...payload.advance } : advance,
      ),
    );
    setAdvanceDeductions((currentDeductions) => [
      ...currentDeductions.filter(
        (deduction) => deduction.advanceId !== payload.advanceId,
      ),
      ...deductions,
    ]);
  }

  async function handleAddTimeRecord(input: NewTimeRecordInput) {
    const timeRecord: TimeRecord = {
      ...input,
      id: `time_${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
    };
    const repository = await createSheetsRepository();

    await repository.addTimeRecord(timeRecord);
    setTimeRecords((currentRecords) => [...currentRecords, timeRecord]);
  }

  async function handleUpdateTimeRecord(record: TimeRecord) {
    const repository = await createSheetsRepository();

    await repository.updateTimeRecord(record);
    setTimeRecords((currentRecords) =>
      currentRecords.map((currentRecord) =>
        currentRecord.id === record.id ? record : currentRecord,
      ),
    );
  }

  async function handleImportPublicHolidays(year: number) {
    const importedHolidays = await fetchSingaporePublicHolidays(year);
    const repository = await createSheetsRepository();

    await repository.upsertPublicHolidays(importedHolidays);
    setPublicHolidays((currentHolidays) =>
      mergePublicHolidays(currentHolidays, importedHolidays),
    );
    return importedHolidays;
  }

  async function handleAddPublicHoliday(
    input: NewPublicHolidayInput,
  ): Promise<PublicHoliday> {
    const holiday: PublicHoliday = {
      ...input,
      id: `holiday_${crypto.randomUUID()}`,
      year: Number(input.date.slice(0, 4)),
      source: "MANUAL",
      createdAt: new Date().toISOString(),
    };
    const repository = await createSheetsRepository();

    await repository.addPublicHoliday(holiday);
    setPublicHolidays((currentHolidays) =>
      mergePublicHolidays(currentHolidays, [holiday]),
    );
    return holiday;
  }

  async function handleUpdatePublicHoliday(
    holiday: PublicHoliday,
  ): Promise<PublicHoliday> {
    const repository = await createSheetsRepository();

    await repository.updatePublicHoliday(holiday);
    setPublicHolidays((currentHolidays) =>
      currentHolidays.map((currentHoliday) =>
        currentHoliday.id === holiday.id ? holiday : currentHoliday,
      ),
    );
    return holiday;
  }

  async function handleDeletePublicHoliday(holidayId: string) {
    const repository = await createSheetsRepository();

    await repository.deletePublicHoliday(holidayId);
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
          googleClientId={browserGoogleClientId}
          isGoogleOAuthConfigured={Boolean(activeGoogleClientId)}
          isDeploymentGoogleOAuthConfigured={Boolean(deploymentGoogleClientId)}
          salaryConfigs={salaryConfigs}
          publicHolidays={publicHolidays}
          onAddSalaryConfig={handleAddSalaryConfig}
          onConnectSpreadsheet={handleConnectSpreadsheet}
          onCreateSpreadsheet={handleCreateSpreadsheet}
          onSaveGoogleClientId={handleSaveGoogleClientId}
          onClearGoogleClientId={handleClearGoogleClientId}
          onCheckSpreadsheetHealth={handleCheckSpreadsheetHealth}
          onSaveAccountBackup={handleSaveAccountBackup}
          onRestoreAccountBackup={handleRestoreAccountBackup}
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
    typeof spreadsheet.spreadsheetId === "string"
  ) {
    const normalizedSpreadsheetId = normalizeGoogleSpreadsheetId(
      spreadsheet.spreadsheetId,
    );

    if (normalizedSpreadsheetId) {
      return normalizedSpreadsheetId;
    }
  }

  throw new Error("Google Sheets did not return a spreadsheet ID.");
}

function hasSheetMetadata(spreadsheet: unknown): spreadsheet is SpreadsheetMetadata {
  return (
    typeof spreadsheet === "object" &&
    spreadsheet !== null &&
    "sheets" in spreadsheet &&
    Array.isArray(spreadsheet.sheets)
  );
}

function readSpreadsheetMetadata(spreadsheet: unknown): SpreadsheetMetadata {
  if (hasSheetMetadata(spreadsheet)) {
    return spreadsheet;
  }

  throw new Error("Google Sheets did not return sheet metadata.");
}

async function readSpreadsheetMetadataWithHeaders(
  sheetsClient: GoogleSheetsAppClient,
  spreadsheetId: string,
  metadata: SpreadsheetMetadata,
): Promise<SpreadsheetMetadata> {
  const requiredSheetNames = new Set(Object.keys(getRequiredSheetSchemas()));

  return {
    ...metadata,
    sheets: await Promise.all(
      (metadata.sheets ?? []).map(async (sheet) => {
        if (!requiredSheetNames.has(sheet.properties.title)) {
          return sheet;
        }

        return {
          ...sheet,
          headerValues: readHeaderValues(
            await sheetsClient.getValues(
              spreadsheetId,
              `${sheet.properties.title}!1:1`,
            ),
          ),
        };
      }),
    ),
  };
}

function readHeaderValues(valuesResponse: unknown): string[] {
  if (
    typeof valuesResponse !== "object" ||
    valuesResponse === null ||
    !("values" in valuesResponse) ||
    !Array.isArray(valuesResponse.values) ||
    !Array.isArray(valuesResponse.values[0])
  ) {
    return [];
  }

  return valuesResponse.values[0].map((value) => String(value ?? ""));
}

function isCachedAppPreferences(value: unknown): value is CachedAppPreferences {
  return typeof value === "object" && value !== null;
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
