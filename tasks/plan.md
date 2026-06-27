# Implementation Plan: Domestic Helper Tracker

## Overview
Build the MVP as a responsive React/TypeScript PWA backed by Google Sheets. The plan prioritizes the highest-risk dependencies first: Google authentication, spreadsheet schema management, and domain calculation correctness. Each feature slice should leave the app runnable and testable.

## Architecture Decisions
- Google Sheets is authoritative. The app reads and writes raw records to Sheets, while derived monthly summaries can be regenerated.
- Browser-only Google OAuth is used. The repo stores only a public OAuth client ID through `.env.local`; no secrets are committed.
- The default deployment shape is static hosting only: no custom backend server, no app server, and no database server beyond Google Sheets.
- Domain calculations are pure TypeScript functions. UI, Sheets API calls, and persistence are kept outside calculation code.
- Split advance deductions are first-class records. The `Advance_Deductions` sheet drives monthly deductions.
- Sunday and Singapore public-holiday logic is in MVP. Calendar context is shown alongside salary review, while formal native Android packaging stays post-MVP.
- Singapore public holidays come from MOM's official data.gov.sg collection 691, using the consolidated datastore resource `d_8ef23381f9417e4d4254ee8b4dcdb176`.

## Dependency Graph
```text
Project scaffold, env config, and static hosting target
  -> Domain types, date/money utilities, validation schemas
    -> Google OAuth and Sheets client
      -> Spreadsheet schema initialization
        -> Repositories for Config, Advances, Deductions, Time, Holidays
          -> Salary calculation engine
            -> Feature screens and app shell
              -> PWA setup, E2E, visual/mobile QA
```

## Task List

### Phase 1: Foundation

## Task 1: Scaffold React/TypeScript App
**Status:** Completed
**Description:** Create the Vite React project structure, baseline scripts, linting, typecheck, tests, environment example, and static-hosting notes.

**Acceptance criteria:**
- [ ] `npm run dev -- --host 0.0.0.0` starts the app.
- [ ] `npm run build`, `npm run lint`, `npm run typecheck`, and `npm run test -- --run` exist.
- [ ] `.env.example` documents the Google OAuth client ID variable.
- [ ] `README.md` explains that the app needs only static hosting, but still needs a stable HTTPS origin for PWA/OAuth.

**Verification:**
- [ ] Run `npm run build`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run test -- --run`.

**Dependencies:** None

**Files likely touched:**
- `package.json`
- `vite.config.ts`
- `tsconfig*.json`
- `src/main.tsx`
- `src/app/App.tsx`
- `.env.example`
- `README.md`

**Estimated scope:** Medium

## Task 2: Add Domain Types and Utilities
**Status:** Completed
**Description:** Implement shared TypeScript types, date helpers, money helpers, and Zod schemas that match the spec.

**Acceptance criteria:**
- [ ] Types exist for salary config, advance, advance deduction, time record, public holiday, and monthly summary.
- [ ] Helpers normalize `YYYY-MM-DD` dates and `YYYY-MM` month keys.
- [ ] Money helpers round and format SGD values consistently.

**Verification:**
- [ ] Run unit tests for date and money helpers.
- [ ] Run `npm run typecheck`.

**Dependencies:** Task 1

**Files likely touched:**
- `src/lib/dates.ts`
- `src/lib/money.ts`
- `src/lib/validation.ts`
- `src/features/*/types.ts`
- `tests/unit/date-money.test.ts`

**Estimated scope:** Medium

## Task 3: Implement Salary Calculation Engine
**Status:** Completed
**Description:** Build pure functions for effective salary config selection, split advance filtering, Sunday/public-holiday counts, and final payout calculation.

**Acceptance criteria:**
- [ ] Latest config effective on or before the selected month is selected.
- [ ] Advance deductions are included by deduction month and must sum to their parent advance in validation.
- [ ] Sunday overtime and public-holiday work are added using the configured divisor.
- [ ] The Sunday assumption is encoded as explicit tests.

**Verification:**
- [ ] Run `npm run test -- --run tests/unit/salary-calculation.test.ts`.
- [ ] Run `npm run typecheck`.

**Dependencies:** Task 2

**Files likely touched:**
- `src/features/salary/calculateMonthlyPayout.ts`
- `src/features/advances/advanceSchedule.ts`
- `src/features/time-records/timeRecordMath.ts`
- `tests/unit/salary-calculation.test.ts`

**Estimated scope:** Medium

### Checkpoint: Domain Foundation
- [ ] All unit tests pass.
- [ ] Calculation behavior matches the spec.
- [ ] Review Sunday calculation assumption before wiring UI.

### Phase 2: Google Sheets Integration

## Task 4: Add Google Auth and Sheets Client
**Status:** Pending
**Description:** Add Google Identity Services login and a small typed wrapper around Google Sheets API read/write operations.

**Acceptance criteria:**
- [ ] User can request Google authorization from the app.
- [ ] Access token is held in memory only.
- [ ] Sheets client supports reading values, appending rows, updating rows, and batch updates.

**Verification:**
- [ ] Unit tests cover Sheets client request construction with mocked fetch.
- [ ] Manual check with configured `.env.local` signs in and receives an access token.

**Dependencies:** Task 1

**Files likely touched:**
- `src/integrations/google/auth.ts`
- `src/integrations/google/sheetsClient.ts`
- `src/app/App.tsx`
- `tests/unit/google-sheets-client.test.ts`

**Estimated scope:** Medium

## Task 5: Implement Spreadsheet Setup and Schema Management
**Status:** Pending
**Description:** Add logic to create or connect a spreadsheet and ensure required sheets and headers exist.

**Acceptance criteria:**
- [ ] User can paste a spreadsheet ID or create a new spreadsheet when authorized.
- [ ] Required sheets are created when absent.
- [ ] Headers match the spec and are not duplicated.

**Verification:**
- [ ] Unit tests cover schema diff and header normalization.
- [ ] Manual check creates/connects a test spreadsheet.

**Dependencies:** Task 4

**Files likely touched:**
- `src/persistence/sheetsRepository.ts`
- `src/integrations/google/spreadsheetSchema.ts`
- `src/features/config/SpreadsheetSetup.tsx`
- `tests/unit/spreadsheet-schema.test.ts`

**Estimated scope:** Medium

## Task 6: Add Sheet Repositories and Local Cache Metadata
**Status:** Pending
**Description:** Implement repositories for reading/writing configs, advances, deductions, time records, and holidays; cache spreadsheet ID and lightweight preferences in IndexedDB/local storage.

**Acceptance criteria:**
- [ ] CRUD repository functions exist for each raw sheet.
- [ ] Spreadsheet ID and selected month survive refresh.
- [ ] Repository functions return typed domain objects.

**Verification:**
- [ ] Mocked repository tests pass.
- [ ] Manual refresh keeps selected spreadsheet connection metadata.

**Dependencies:** Task 5

**Files likely touched:**
- `src/persistence/sheetsRepository.ts`
- `src/persistence/cacheDb.ts`
- `src/persistence/repositoryTypes.ts`
- `tests/unit/sheets-repository.test.ts`

**Estimated scope:** Medium

### Checkpoint: Sheets Foundation
- [ ] App can authorize and connect/create a test spreadsheet.
- [ ] Required sheet tabs and headers are present.
- [ ] Mocked repository tests pass.

### Phase 3: Core Feature Slices

## Task 7: Build Config Screen
**Status:** Pending
**Description:** Implement salary version creation/listing and OT divisor configuration, backed by Google Sheets.

**Acceptance criteria:**
- [ ] User can add a salary config with monthly salary, effective date, divisor, and notes.
- [ ] Config history displays newest and historical configs.
- [ ] Invalid salary/date values are blocked before saving.

**Verification:**
- [ ] Component/integration tests cover create and validation.
- [ ] Manual check saves config to the `Config` sheet.

**Dependencies:** Task 6

**Files likely touched:**
- `src/features/config/ConfigScreen.tsx`
- `src/features/config/SalaryConfigForm.tsx`
- `src/features/config/SalaryConfigList.tsx`
- `tests/integration/config-screen.test.tsx`

**Estimated scope:** Medium

## Task 8: Build Advances Screen with Split Deductions
**Status:** Pending
**Description:** Implement advance CRUD with one or more deduction schedule lines per advance.

**Acceptance criteria:**
- [ ] User can add/edit/delete an advance.
- [ ] Deduction schedule supports multiple `YYYY-MM` lines and totals exactly to the advance amount.
- [ ] Saving an advance writes both `Advances` and `Advance_Deductions` records.

**Verification:**
- [ ] Integration tests cover split deduction validation and save flow.
- [ ] Manual check verifies both Sheets tabs update.

**Dependencies:** Task 6

**Files likely touched:**
- `src/features/advances/AdvancesScreen.tsx`
- `src/features/advances/AdvanceForm.tsx`
- `src/features/advances/AdvanceList.tsx`
- `tests/integration/advances-screen.test.tsx`

**Estimated scope:** Medium

## Task 9: Build Time Records Screen
**Status:** Pending
**Description:** Implement off-day, Sunday overtime, and public-holiday-work records with date ranges and notes.

**Acceptance criteria:**
- [ ] User can add/edit/delete off day, Sunday OT, and public holiday work records.
- [ ] Date ranges validate end date on or after start date.
- [ ] Monthly counts update from saved records.

**Verification:**
- [ ] Integration tests cover record type switching and validation.
- [ ] Manual check saves records to `Time_Records`.

**Dependencies:** Task 6

**Files likely touched:**
- `src/features/time-records/TimeRecordsScreen.tsx`
- `src/features/time-records/TimeRecordForm.tsx`
- `src/features/time-records/TimeRecordList.tsx`
- `tests/integration/time-records-screen.test.tsx`

**Estimated scope:** Medium

## Task 10: Build Salary Review Screen
**Status:** Pending
**Description:** Implement the default monthly salary screen using config, advances, deductions, time records, and holidays from Sheets.

**Acceptance criteria:**
- [ ] Month selector loads the relevant records and calculates payout.
- [ ] Summary shows SGD base salary, daily rate, Sunday OT, public holiday work, deductions, and final payout.
- [ ] Related records are listed so the calculation is auditable.

**Verification:**
- [ ] Integration tests cover monthly calculation from mocked repositories.
- [ ] Manual check matches expected calculation for a known test sheet.

**Dependencies:** Tasks 7, 8, 9

**Files likely touched:**
- `src/features/salary/SalaryScreen.tsx`
- `src/features/salary/SalarySummary.tsx`
- `src/features/salary/RelatedRecords.tsx`
- `tests/integration/salary-screen.test.tsx`

**Estimated scope:** Medium

### Checkpoint: Payroll MVP
- [ ] Config, advances, time records, and salary review work against a test spreadsheet.
- [ ] Editing records updates the salary review.
- [ ] Core integration tests pass.

### Phase 4: Calendar, Public Holidays, and PWA

## Task 11: Add Singapore Public Holiday Import and Calendar View
**Status:** Pending
**Description:** Implement public holiday import/management and a monthly calendar that shows Sundays, holidays, and entered time records.

**Acceptance criteria:**
- [ ] User can load/import Singapore public holidays for a selected year from `https://data.gov.sg/api/action/datastore_search?resource_id=d_8ef23381f9417e4d4254ee8b4dcdb176&limit=500`.
- [ ] Import normalizes `date`, `day`, and `holiday` fields from the MOM data.gov.sg dataset.
- [ ] User can manually add/edit/delete public holidays.
- [ ] Calendar view highlights Sundays, holidays, off days, Sunday OT, and public-holiday work.

**Verification:**
- [ ] Unit tests cover holiday import normalization.
- [ ] Manual check imports current-year holidays into `Public_Holidays`.
- [ ] Manual visual check on desktop and Android viewport.

**Dependencies:** Tasks 6 and 9

**Files likely touched:**
- `src/integrations/singapore/publicHolidays.ts`
- `src/features/calendar/CalendarScreen.tsx`
- `src/features/calendar/PublicHolidayPanel.tsx`
- `tests/unit/public-holidays.test.ts`

**Estimated scope:** Medium

## Task 12: App Shell, Responsive Navigation, and PWA Setup
**Status:** Pending
**Description:** Finish the app shell, responsive navigation, installable PWA behavior, and high-signal empty/loading/error states.

**Acceptance criteria:**
- [ ] Bottom navigation works on Android-sized viewport.
- [ ] Desktop layout remains readable and task-focused.
- [ ] PWA manifest and service worker are configured.
- [ ] Loading, empty, validation, and error states are present for each screen.

**Verification:**
- [ ] Run `npm run build`.
- [ ] Use browser viewport checks for desktop and Android sizes.
- [ ] Confirm manifest/service worker registration in preview build.

**Dependencies:** Tasks 7-11

**Files likely touched:**
- `src/app/App.tsx`
- `src/app/routes.ts`
- `src/components/layout/*`
- `src/styles.css`
- `vite.config.ts`

**Estimated scope:** Medium

## Task 13: End-to-End QA and Hardening
**Status:** Pending
**Description:** Add Playwright happy-path tests, run full verification, and fix defects found during browser QA.

**Acceptance criteria:**
- [ ] E2E test covers connect/create sheet, config, split advance, Sunday OT, and salary review with mocked or isolated test data.
- [ ] Desktop and Android viewport screenshots show no incoherent overlap.
- [ ] Full verification passes or known external-blocking gaps are documented.

**Verification:**
- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run test -- --run`.
- [ ] Run `npm run test:e2e`.
- [ ] Run `npm run build`.

**Dependencies:** Task 12

**Files likely touched:**
- `e2e/helper-tracker.spec.ts`
- `playwright.config.ts`
- Existing feature files as defects require

**Estimated scope:** Medium

### Checkpoint: MVP Complete
- [ ] All success criteria in `docs/spec.md` are met or explicitly deferred.
- [ ] Full verification passes.
- [ ] User can run the app locally and open it from Android Chrome on the same network.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Google OAuth setup blocks local use | High | Provide `.env.example`, clear setup notes, and isolate auth behind a small module. |
| Google Sheets API write complexity creates partial records | High | Batch writes for related records where possible and validate schedule totals before writes. |
| Browser-only app cannot securely store secrets | High | Use OAuth client ID only; never commit secrets; hold access tokens in memory. |
| Sunday/public-holiday rules are misunderstood | Medium | Keep the Sunday assumption explicit in spec/tests and review before UI wiring. |
| Public holiday source changes shape or availability | Medium | Normalize through an adapter and allow manual holiday entry. |
| Static PWA lacks a stable HTTPS origin | High | Choose a static host before OAuth setup, because Google OAuth and service workers depend on origin allowlisting. |
| Mobile UI becomes crowded | Medium | Use task-specific screens, bottom navigation, compact summaries, and viewport QA. |

## Parallelization Opportunities
- After Task 6, Config, Advances, and Time screen UI can be developed mostly independently against repository contracts.
- Unit tests for calculation, date helpers, and public holiday normalization can be expanded in parallel with UI work.
- E2E and visual QA should wait until core flows are wired.

## Open Questions Before Tasks
None.
