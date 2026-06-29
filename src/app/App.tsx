import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { selectEffectiveSalaryConfig } from "../features/salary/calculateMonthlyPayout";
import type { TimeRecord } from "../features/time-records/types";
import { isMonthKey } from "../lib/dates";
import {
  getCachedAppPreferences,
  getCachedSheetRecords,
  sanitizeCachedAppPreferences,
  setCachedAppPreferences,
  setCachedSheetRecords,
  type CachedSheetRecords,
  type CachedAppPreferences,
} from "../persistence/cacheDb";
import { fetchSingaporePublicHolidays } from "../integrations/singapore/publicHolidays";
import { normalizeGoogleClientId } from "../integrations/google/clientId";
import {
  buildGoogleSpreadsheetUrl,
  normalizeGoogleSpreadsheetId,
  normalizeGoogleSpreadsheetUrl,
} from "../integrations/google/spreadsheetId";
import {
  GOOGLE_DRIVE_METADATA_SCOPE,
  GOOGLE_SHEETS_SCOPE,
  createGoogleTokenClient as createDefaultGoogleTokenClient,
  type AppGoogleTokenClient,
} from "../integrations/google/auth";
import {
  pickGoogleSpreadsheet,
  type GooglePickerConfig,
  type GooglePickerSpreadsheet,
} from "../integrations/google/pickerClient";
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

type GoogleSheetsAppClient = Pick<
  GoogleSheetsClient,
  | "appendValues"
  | "batchUpdate"
  | "createSpreadsheet"
  | "getSpreadsheet"
  | "getValues"
  | "updateValues"
>;
function createDefaultGoogleSheetsClient(options: {
  accessToken: string;
}): GoogleSheetsAppClient {
  return new GoogleSheetsClient(options);
}

export type AppProps = {
  googleClientId?: string;
  googlePickerDeveloperKey?: string;
  googlePickerAppId?: string;
  createGoogleTokenClient?: (options: {
    clientId: string;
    scope?: string;
  }) => AppGoogleTokenClient;
  createGoogleSheetsClient?: (options: {
    accessToken: string;
  }) => GoogleSheetsAppClient;
  pickGoogleSpreadsheet?: (
    options: GooglePickerConfig & { accessToken: string },
  ) => Promise<GooglePickerSpreadsheet>;
};

export function App({
  googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID,
  googlePickerDeveloperKey = import.meta.env.VITE_GOOGLE_PICKER_API_KEY,
  googlePickerAppId = import.meta.env.VITE_GOOGLE_PICKER_APP_ID,
  createGoogleTokenClient = createDefaultGoogleTokenClient,
  createGoogleSheetsClient = createDefaultGoogleSheetsClient,
  pickGoogleSpreadsheet: pickGoogleSpreadsheetFromDrive = pickGoogleSpreadsheet,
}: AppProps = {}) {
  const cachedPreferences = useMemo(() => getCachedAppPreferences(), []);
  const cachedSheetRecords = useMemo(
    () => getCachedSheetRecords(cachedPreferences.spreadsheetId),
    [cachedPreferences.spreadsheetId],
  );
  const deploymentGoogleClientId = normalizeGoogleClientId(googleClientId);
  const [activeRoute, setActiveRoute] = useState<AppRouteId>("salary");
  const [spreadsheetId, setSpreadsheetId] = useState(cachedPreferences.spreadsheetId);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState(
    cachedPreferences.spreadsheetUrl,
  );
  const [selectedMonth, setSelectedMonth] = useState(
    cachedPreferences.selectedMonth ?? fallbackMonth,
  );
  const [isMonthDialogOpen, setIsMonthDialogOpen] = useState(false);
  const [payCycleStartDay, setPayCycleStartDay] = useState(
    cachedPreferences.payCycleStartDay ?? defaultPayCycleStartDay,
  );
  const [browserGoogleClientId, setBrowserGoogleClientId] = useState(
    cachedPreferences.googleClientId,
  );
  const [salaryConfigs, setSalaryConfigs] = useState<SalaryConfig[]>(
    cachedSheetRecords.salaryConfigs,
  );
  const [advances, setAdvances] = useState<Advance[]>(cachedSheetRecords.advances);
  const [advanceDeductions, setAdvanceDeductions] = useState<AdvanceDeduction[]>(
    cachedSheetRecords.advanceDeductions,
  );
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>(
    cachedSheetRecords.timeRecords,
  );
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>(
    cachedSheetRecords.publicHolidays,
  );
  const selectedPayCycleStartDay = useMemo(
    () =>
      isMonthKey(selectedMonth)
        ? (selectEffectiveSalaryConfig(salaryConfigs, selectedMonth)
            ?.payCycleStartDay ?? payCycleStartDay)
        : payCycleStartDay,
    [payCycleStartDay, salaryConfigs, selectedMonth],
  );
  const activeGoogleClientId = deploymentGoogleClientId ?? browserGoogleClientId;
  const googleSheetsAccessTokenRef = useRef<string | undefined>(undefined);
  const autoLoadedSpreadsheetKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const targetSpreadsheetId = normalizeGoogleSpreadsheetId(spreadsheetId);

    if (!targetSpreadsheetId || !activeGoogleClientId) {
      return undefined;
    }

    const autoLoadKey = `${activeGoogleClientId}:${targetSpreadsheetId}`;

    if (autoLoadedSpreadsheetKeyRef.current === autoLoadKey) {
      return undefined;
    }

    autoLoadedSpreadsheetKeyRef.current = autoLoadKey;

    let isCancelled = false;
    let retryCount = 0;
    let retryTimeoutId: number | undefined;
    const googleClientIdForLoad = activeGoogleClientId;
    const spreadsheetIdForLoad = targetSpreadsheetId;

    async function loadFromGoogleSheet() {
      try {
        const tokenClient = createGoogleTokenClient({
          clientId: googleClientIdForLoad,
          scope: GOOGLE_SHEETS_SCOPE,
        });
        const accessToken = await tokenClient.requestToken({ prompt: "" });

        if (isCancelled) {
          return;
        }

        googleSheetsAccessTokenRef.current = accessToken;
        const sheetsClient = createGoogleSheetsClient({ accessToken });
        const repository = new SheetsRepository(spreadsheetIdForLoad, sheetsClient);
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

        if (isCancelled) {
          return;
        }

        applySpreadsheetRecords(spreadsheetIdForLoad, {
          salaryConfigs: nextSalaryConfigs,
          advances: nextAdvances,
          advanceDeductions: nextAdvanceDeductions,
          timeRecords: nextTimeRecords,
          publicHolidays: nextPublicHolidays,
        });
      } catch (caughtError) {
        if (isCancelled) {
          return;
        }

        if (isGoogleIdentityLoadingError(caughtError) && retryCount < 20) {
          retryCount += 1;
          retryTimeoutId = window.setTimeout(loadFromGoogleSheet, 500);
          return;
        }

        autoLoadedSpreadsheetKeyRef.current = undefined;
      }
    }

    void loadFromGoogleSheet();

    return () => {
      isCancelled = true;

      if (retryTimeoutId) {
        window.clearTimeout(retryTimeoutId);
      }
    };
  }, [
    activeGoogleClientId,
    createGoogleSheetsClient,
    createGoogleTokenClient,
    spreadsheetId,
  ]);

  function buildCurrentPreferences(
    overrides: CachedAppPreferences = {},
  ): CachedAppPreferences {
    return sanitizeCachedAppPreferences({
      spreadsheetId,
      spreadsheetUrl,
      selectedMonth,
      payCycleStartDay,
      googleClientId: browserGoogleClientId,
      ...overrides,
    });
  }

  function cachePreferences(overrides: CachedAppPreferences = {}) {
    setCachedAppPreferences(buildCurrentPreferences(overrides));
  }

  function cacheSheetRecords(
    overrides: Partial<CachedSheetRecords> = {},
    targetSpreadsheetId: string | undefined = spreadsheetId,
  ) {
    setCachedSheetRecords(targetSpreadsheetId, {
      salaryConfigs,
      advances,
      advanceDeductions,
      timeRecords,
      publicHolidays,
      ...overrides,
    });
  }

  function applySpreadsheetRecords(
    targetSpreadsheetId: string,
    records: CachedSheetRecords,
  ) {
    setSalaryConfigs(records.salaryConfigs);
    setAdvances(records.advances);
    setAdvanceDeductions(records.advanceDeductions);
    setTimeRecords(records.timeRecords);
    setPublicHolidays(records.publicHolidays);
    setCachedSheetRecords(targetSpreadsheetId, records);

    const newestPayCycleStartDay = [...records.salaryConfigs]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .find((config) => config.payCycleStartDay)?.payCycleStartDay;

    if (newestPayCycleStartDay) {
      setPayCycleStartDay(newestPayCycleStartDay);
      setCachedAppPreferences({
        ...getCachedAppPreferences(),
        spreadsheetId: targetSpreadsheetId,
        payCycleStartDay: newestPayCycleStartDay,
      });
    }
  }

  function handleMonthChange(month: string) {
    setSelectedMonth(month);

    if (isMonthKey(month)) {
      cachePreferences({ selectedMonth: month });
    }
  }

  async function handleConnectSpreadsheet(nextSpreadsheet: GooglePickerSpreadsheet) {
    const normalizedSpreadsheetId = normalizeGoogleSpreadsheetId(nextSpreadsheet.id);

    if (!normalizedSpreadsheetId) {
      throw new Error("Choose a real Google Sheet.");
    }

    const nextSpreadsheetUrl =
      normalizeGoogleSpreadsheetUrl(nextSpreadsheet.webViewLink, normalizedSpreadsheetId) ??
      buildGoogleSpreadsheetUrl(normalizedSpreadsheetId);

    setSpreadsheetId(normalizedSpreadsheetId);
    setSpreadsheetUrl(nextSpreadsheetUrl);
    cachePreferences({
      spreadsheetId: normalizedSpreadsheetId,
      spreadsheetUrl: nextSpreadsheetUrl,
    });
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

  async function handleCreateSpreadsheet(): Promise<GooglePickerSpreadsheet> {
    if (!activeGoogleClientId) {
      throw new Error("Add a Google OAuth Client ID before creating an online Google Sheet.");
    }

    const tokenClient = createGoogleTokenClient({
      clientId: activeGoogleClientId,
      scope: GOOGLE_SHEETS_SCOPE,
    });
    const accessToken = await tokenClient.requestToken({ prompt: "consent" });
    googleSheetsAccessTokenRef.current = accessToken;
    const sheetTitle = `Domestic Helper Tracker ${new Date().toISOString().slice(0, 10)}`;
    const sheetsClient = createGoogleSheetsClient({ accessToken });
    const spreadsheet = await sheetsClient.createSpreadsheet(
      buildSpreadsheetCreateBody(sheetTitle),
    );
    const nextSpreadsheetId = readCreatedSpreadsheetId(spreadsheet);
    const spreadsheetMetadata = hasSheetMetadata(spreadsheet)
      ? spreadsheet
      : readSpreadsheetMetadata(await sheetsClient.getSpreadsheet(nextSpreadsheetId));
    const schemaRequests = buildEnsureSchemaRequests(spreadsheetMetadata);

    if (schemaRequests.length > 0) {
      await sheetsClient.batchUpdate(nextSpreadsheetId, schemaRequests);
    }

    const nextSpreadsheetUrl = buildGoogleSpreadsheetUrl(nextSpreadsheetId);
    setSpreadsheetId(nextSpreadsheetId);
    setSpreadsheetUrl(nextSpreadsheetUrl);
    cachePreferences({
      spreadsheetId: nextSpreadsheetId,
      spreadsheetUrl: nextSpreadsheetUrl,
    });
    await loadSpreadsheetRecordsWithClient(sheetsClient, nextSpreadsheetId);
    return {
      id: nextSpreadsheetId,
      name: sheetTitle,
      webViewLink: nextSpreadsheetUrl,
    };
  }

  async function handlePickDriveSpreadsheet(): Promise<GooglePickerSpreadsheet> {
    if (!activeGoogleClientId) {
      throw new Error("Add a Google OAuth Client ID before choosing from Google Drive.");
    }

    if (!googlePickerDeveloperKey) {
      throw new Error("Add a Google Picker API key before choosing from Google Drive.");
    }

    const tokenClient = createGoogleTokenClient({
      clientId: activeGoogleClientId,
      scope: GOOGLE_DRIVE_METADATA_SCOPE,
    });
    const accessToken = await tokenClient.requestToken({ prompt: "consent" });
    const pickedSpreadsheet = await pickGoogleSpreadsheetFromDrive({
      accessToken,
      appId: googlePickerAppId,
      developerKey: googlePickerDeveloperKey,
    });
    return pickedSpreadsheet;
  }

  async function handleCheckSpreadsheetHealth(targetSpreadsheetId: string) {
    if (!activeGoogleClientId) {
      throw new Error("Add a Google OAuth Client ID before checking the online sheet.");
    }

    const tokenClient = createGoogleTokenClient({
      clientId: activeGoogleClientId,
      scope: GOOGLE_SHEETS_SCOPE,
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

    applySpreadsheetRecords(targetSpreadsheetId, {
      salaryConfigs: nextSalaryConfigs,
      advances: nextAdvances,
      advanceDeductions: nextAdvanceDeductions,
      timeRecords: nextTimeRecords,
      publicHolidays: nextPublicHolidays,
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
    cacheSheetRecords({
      salaryConfigs: [...salaryConfigs, salaryConfig],
    });
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
    cacheSheetRecords({
      advances: [...advances, advance],
      advanceDeductions: [...advanceDeductions, ...deductions],
    });
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
    const nextAdvanceDeductions = [
      ...advanceDeductions.filter(
        (deduction) => deduction.advanceId !== payload.advanceId,
      ),
      ...deductions,
    ];
    setAdvanceDeductions(nextAdvanceDeductions);
    cacheSheetRecords({
      advances: advances.map((currentAdvance) =>
        currentAdvance.id === payload.advanceId
          ? { ...currentAdvance, ...payload.advance }
          : currentAdvance,
      ),
      advanceDeductions: nextAdvanceDeductions,
    });
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
    cacheSheetRecords({
      timeRecords: [...timeRecords, timeRecord],
    });
  }

  async function handleUpdateTimeRecord(record: TimeRecord) {
    const repository = await createSheetsRepository();

    await repository.updateTimeRecord(record);
    setTimeRecords((currentRecords) =>
      currentRecords.map((currentRecord) =>
        currentRecord.id === record.id ? record : currentRecord,
      ),
    );
    cacheSheetRecords({
      timeRecords: timeRecords.map((currentRecord) =>
        currentRecord.id === record.id ? record : currentRecord,
      ),
    });
  }

  async function handleImportPublicHolidays(year: number) {
    const importedHolidays = await fetchSingaporePublicHolidays(year);
    const repository = await createSheetsRepository();

    await repository.upsertPublicHolidays(importedHolidays);
    setPublicHolidays((currentHolidays) =>
      mergePublicHolidays(currentHolidays, importedHolidays),
    );
    cacheSheetRecords({
      publicHolidays: mergePublicHolidays(publicHolidays, importedHolidays),
    });
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
    cacheSheetRecords({
      publicHolidays: mergePublicHolidays(publicHolidays, [holiday]),
    });
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
    cacheSheetRecords({
      publicHolidays: publicHolidays.map((currentHoliday) =>
        currentHoliday.id === holiday.id ? holiday : currentHoliday,
      ),
    });
    return holiday;
  }

  async function handleDeletePublicHoliday(holidayId: string) {
    const repository = await createSheetsRepository();

    await repository.deletePublicHoliday(holidayId);
    setPublicHolidays((currentHolidays) =>
      currentHolidays.filter((holiday) => holiday.id !== holidayId),
    );
    cacheSheetRecords({
      publicHolidays: publicHolidays.filter((holiday) => holiday.id !== holidayId),
    });
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1 id="app-title">Domestic Helper Tracker</h1>
        </div>
        <label className="month-control">
          Pay month
          <input
            type="month"
            value={selectedMonth}
            onChange={(event) => handleMonthChange(event.target.value)}
          />
        </label>
      </header>
      <button
        type="button"
        className="mobile-month-fab"
        aria-label={`Change pay month, current ${selectedMonth}`}
        onClick={() => setIsMonthDialogOpen(true)}
      >
        <span>Pay month</span>
        <strong>{selectedMonth}</strong>
      </button>
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
      {isMonthDialogOpen ? (
        <MonthPickerDialog
          selectedMonth={selectedMonth}
          onClose={() => setIsMonthDialogOpen(false)}
          onSubmit={(month) => {
            handleMonthChange(month);
            setIsMonthDialogOpen(false);
          }}
        />
      ) : null}
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
          payCycleStartDay={selectedPayCycleStartDay}
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
          spreadsheetUrl={spreadsheetUrl}
          googleClientId={browserGoogleClientId}
          isGoogleOAuthConfigured={Boolean(activeGoogleClientId)}
          isDeploymentGoogleOAuthConfigured={Boolean(deploymentGoogleClientId)}
          salaryConfigs={salaryConfigs}
          publicHolidays={publicHolidays}
          onAddSalaryConfig={handleAddSalaryConfig}
          onConnectSpreadsheet={handleConnectSpreadsheet}
          onCreateSpreadsheet={handleCreateSpreadsheet}
          onPickDriveSpreadsheet={handlePickDriveSpreadsheet}
          onSaveGoogleClientId={handleSaveGoogleClientId}
          onClearGoogleClientId={handleClearGoogleClientId}
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

function MonthPickerDialog({
  selectedMonth,
  onClose,
  onSubmit,
}: {
  selectedMonth: string;
  onClose: () => void;
  onSubmit: (month: string) => void;
}) {
  const [month, setMonth] = useState(selectedMonth);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(month);
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        aria-labelledby="month-dialog-title"
        aria-modal="true"
        className="modal-panel month-dialog-panel"
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="modal-header">
          <div>
            <h3 id="month-dialog-title">Change pay month</h3>
          </div>
          <button
            type="button"
            className="secondary-button icon-button"
            aria-label="Close pay month picker"
            onClick={onClose}
          >
            X
          </button>
        </div>
        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            Select pay month
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
          <button type="submit">Apply month</button>
        </form>
      </div>
    </div>
  );
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

function isGoogleIdentityLoadingError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message === "Google Identity Services is not loaded."
  );
}
