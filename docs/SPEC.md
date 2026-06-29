# Spec: Domestic Helper Tracker

## Assumptions
1. The MVP should run on Android Chrome and desktop web browsers as a responsive web app, with installable PWA behavior as a target.
2. The app starts as single-helper, single-household software.
3. Google Sheets is the source of truth. Local browser storage may cache data for responsiveness, but Sheets remains authoritative.
4. The existing `../helper_app` Google Apps Script prototype is used for domain understanding, not as the required implementation platform.
5. Records should be private and practical for household use; no payroll integrations, external bank connections, or multi-user admin workflows are included in MVP.
6. Historical salary calculations must remain explainable after salary settings change.
7. Sunday handling assumption for MVP: Sundays are contractual rest days by default and do not reduce the configured monthly base salary; when the helper works on a Sunday, that date is recorded and paid as worked-Sunday extra pay.
8. Public holiday handling assumption for MVP: public holidays are visible calendar context but are contractually expected work days by default; PH work creates no extra pay unless the employer explicitly records extra PH pay.
9. The MVP should not require a custom backend server. The chosen deployment target is a static-hosted React PWA.

## Objective
Build a mobile-first domestic helper tracker for recording salary settings, advances, day exceptions, and explicit extra pay, then reviewing the monthly payout from one place.

The primary user is the employer or household manager responsible for monthly helper payroll records. Success means the user can open the app on Android or desktop, add the month's events quickly, and see a clear payout calculation while the underlying Google Sheet remains inspectable and auditable.

Core user stories:
- As the employer, I can configure the helper's monthly salary with an effective date.
- As the employer, I can record advance payments with date, amount, note, and a split deduction schedule across one or more months.
- As the employer, I can record what happened on a day: worked, rested/off, extra unpaid day off, or explicit PH extra pay.
- As the employer, I can include Singapore Sunday/public-holiday context in monthly review.
- As the employer, I can select a month and see base salary, worked-Sunday pay, explicit PH extra pay, unpaid deductions, advance deductions, and final payout.
- As the employer, I can inspect which records contributed to the monthly calculation.

## Tech Stack
Recommended MVP stack:
- Runtime: Node.js 20+
- App framework: Vite + React + TypeScript
- Styling: CSS Modules or plain CSS with CSS custom properties
- Routing: React Router, or a lightweight internal tab router if only four screens exist
- Source of truth: Google Sheets through Google Sheets API v4
- Authentication: Google Identity Services OAuth in the browser, with Google Picker used to choose an existing Google Sheets workbook from Drive
- Local persistence: browser storage for the selected spreadsheet ID/link, selected pay month, and last synced records as a temporary cache only
- Validation: Zod
- Testing: Vitest + React Testing Library + Playwright
- PWA: Vite PWA plugin after the core app works
- Hosting target: static files only, with no custom backend server
- Later native packaging: Capacitor or a native Android wrapper, out of MVP implementation scope

This stack keeps the app web-native and Android-friendly while keeping Google Sheets as the human-readable source of truth. A Google Cloud OAuth client ID is required, but no client secret should be committed because the app is browser-based.

Hosting clarification:
- The React PWA does not need a custom server or database server.
- It does need to be served from a stable HTTPS origin for Android PWA behavior, service workers, and Google OAuth redirect/origin allowlisting.
- Suitable no-server hosts include GitHub Pages, Cloudflare Pages, Netlify static hosting, or similar static-file hosting.
- Opening built files directly with `file://` is not sufficient for PWA/OAuth.

## Commands
These commands define the target project interface after scaffolding:

```bash
npm install
cp .env.example .env.local
npm run dev -- --host 0.0.0.0
npm run build
npm run preview -- --host 0.0.0.0
npm run lint
npm run typecheck
npm run test -- --run
npm run test:e2e
```

## Project Structure
Target structure:

```text
docs/
  SPEC.md                         # Product and engineering specification
src/
  app/
    App.tsx                       # App shell, navigation, top-level providers
    routes.ts                     # Screen identifiers and navigation metadata
  components/
    forms/                        # Reusable form controls
    layout/                       # Shell, nav, page header
    summary/                      # Salary summary and breakdown components
  features/
    advances/                     # Advance CRUD UI and domain logic
    calendar/                     # Pay-cycle calendar, Sundays, public holidays
    config/                       # Salary settings and calculation rules
    salary/                       # Monthly review UI and calculation orchestration
    time-records/                 # Off day and overtime CRUD UI and logic
  integrations/
    google/
      auth.ts                     # Google Identity Services OAuth
      pickerClient.ts             # Google Picker workbook selection
      sheetsClient.ts             # Google Sheets API wrapper
    singapore/
      publicHolidays.ts           # Singapore public holiday import adapter
  lib/
    dates.ts                      # Month keys, date ranges, formatting
    money.ts                      # Money parsing, rounding, formatting
    validation.ts                 # Shared validation helpers
  persistence/
    cacheDb.ts                    # IndexedDB cache and preferences
    sheetsRepository.ts           # Typed Google Sheets persistence functions
  test/
    fixtures.ts                   # Shared test fixtures
tests/
  unit/                           # Domain and calculation tests
  integration/                    # Component/persistence integration tests
e2e/
  helper-tracker.spec.ts          # Browser-level happy paths
```

## Domain Model
Initial records:

```ts
type SalaryConfig = {
  id: string;
  monthlySalary: number;
  effectiveStartDate: string; // YYYY-MM-DD
  otDayDivisor: number; // default 26
  notes?: string;
  createdAt: string;
};

type Advance = {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  description?: string;
  createdAt: string;
};

type AdvanceDeduction = {
  id: string;
  advanceId: string;
  month: string; // YYYY-MM
  amount: number;
  notes?: string;
  createdAt: string;
};

type TimeRecord = {
  id: string;
  type: "OFF_DAY" | "SUNDAY_OT" | "PUBLIC_HOLIDAY_WORK";
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isPaidOffDay?: boolean;
  notes?: string;
  createdAt: string;
};

type PublicHoliday = {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  year: number;
  source: "SINGAPORE_IMPORT" | "MANUAL";
  notes?: string;
  createdAt: string;
};
```

MVP calculation:
- The selected month is the pay month: the month containing the pay date.
- Base salary comes from the latest salary config effective on or before the selected pay month.
- A pay date day of `26` for pay month `2026-08` reviews work from `2026-07-26` through `2026-08-25`, with pay due `2026-08-26`.
- Worked-Sunday amount = `sundayOtDays * (monthlySalary / otDayDivisor)`.
- Unpaid off day deduction = `unpaidOffDays * (monthlySalary / otDayDivisor)`.
- Explicit PH extra pay = `publicHolidayWorkDays * (monthlySalary / otDayDivisor)`.
- Advance deductions come from the advance deduction schedule for the selected pay month, not necessarily the date when cash was given.
- Deduction schedule line items must sum exactly to the total advance amount.
- Singapore public holidays are visible in the calendar and monthly review. Work on a public holiday is the default assumption and has no pay impact unless the employer explicitly records PH extra pay.
- Final payout = `baseSalary + sundayOvertimeAmount + publicHolidayWorkAmount - unpaidOffDayDeduction - advanceDeductions`.
- Monetary values are rounded to two decimals at display and persisted summary boundaries.
- Currency display defaults to SGD.

## Google Sheets Schema
The app manages one spreadsheet with these sheets:

```text
Config
  config_id, monthly_salary, effective_start_date, ot_day_divisor, notes, created_at

Advances
  advance_id, date, amount, description, created_at

Advance_Deductions
  advance_deduction_id, advance_id, year_month, amount, notes, created_at

Time_Records
  time_record_id, record_type, start_date, end_date, quantity, is_paid_off_day, notes, created_at

Public_Holidays
  holiday_id, holiday_name, date, year, source, notes, created_at

Monthly_Summary
  year_month, base_salary, sunday_ot_days, public_holiday_work_days,
  unpaid_off_days, ot_day_rate, sunday_ot_amount, public_holiday_work_amount,
  unpaid_off_day_deduction, total_advance_deductions, final_payout,
  config_effective_start_date, calculated_at
```

The app may regenerate `Monthly_Summary`; raw sheets remain the authoritative audit trail.

## Singapore Public Holiday Source
MVP uses the official data.gov.sg collection provided by MOM:

```text
Collection page:
  https://data.gov.sg/collections/691/view

Collection metadata:
  https://api-production.data.gov.sg/v2/public/api/collections/691/metadata

Consolidated dataset metadata:
  https://api-production.data.gov.sg/v2/public/api/datasets/d_8ef23381f9417e4d4254ee8b4dcdb176/metadata

Holiday rows:
  https://data.gov.sg/api/action/datastore_search?resource_id=d_8ef23381f9417e4d4254ee8b4dcdb176&limit=500
```

Expected row fields:
- `date`: ISO date such as `2026-01-01`
- `day`: weekday label
- `holiday`: public holiday name

The import adapter should trim whitespace from `day` and `holiday`, filter by selected year in-app, and allow manual add/edit/delete because the public source can change shape or lag future-year releases.

## Code Style
Prefer small typed domain functions and explicit validation at form boundaries.

```ts
export function calculateMonthlyPayout(input: MonthlyPayoutInput): MonthlyPayout {
  const dailyRate = roundMoney(input.baseSalary / input.otDayDivisor);
  const sundayOvertimeAmount = roundMoney(input.sundayOtDays * dailyRate);
  const unpaidOffDayDeduction = roundMoney(input.unpaidOffDays * dailyRate);
  const finalPayout = roundMoney(
    input.baseSalary + sundayOvertimeAmount - unpaidOffDayDeduction - input.advanceDeductions,
  );

  return {
    dailyRate,
    sundayOvertimeAmount,
    unpaidOffDayDeduction,
    finalPayout,
  };
}
```

Conventions:
- Use `PascalCase` for React components and TypeScript types.
- Use `camelCase` for functions, variables, and object fields.
- Keep calculation logic outside React components.
- Keep persistence code behind repository functions.
- Store dates as ISO strings and month keys as `YYYY-MM`.
- Avoid hidden mutation in calculation functions.

## Screens
MVP screens:
1. Salary
   - Default screen.
   - Pay month selector.
   - Summary values: base salary, daily rate, worked Sunday days, worked Sunday amount, explicit PH extra pay, extra unpaid days off, unpaid day deduction, advance deductions, final payout.
   - Breakdown of included advances and time records.
2. Advances
   - Add, edit, delete advances.
   - Fields: date, amount, description, deduction schedule.
   - Validate that split deduction schedule totals match the advance amount.
   - Filter by selected pay month.
3. Time
   - Add, edit, delete day records.
   - Fields: start date, end date, what happened, notes.
   - Sundays are shown as rest days by default; worked Sundays are recorded as extra pay.
   - Public holidays are shown as expected work days by default; PH work only affects pay when explicit extra PH pay is selected.
   - Pay-cycle counts for worked Sundays, explicit PH extra pay, and extra unpaid days off.
4. Calendar
   - Pay-cycle view showing Sundays, Singapore public holidays, off days, worked Sundays, and explicit PH extra pay.
   - Import or refresh Singapore public holidays for a selected year.
5. Config
   - Add salary version.
   - Show salary version history.
   - Keep OT day divisor configurable in advanced settings with default `26`.
   - Connect or initialize the Google Sheet.

Post-MVP candidates from `../helper_app`:
- Sunday monthly overrides beyond the default contract rule.
- Formal payslip PDF export.
- Data import from the older Apps Script spreadsheet shape.
- Packaged native Android app.

## Testing Strategy
Unit tests:
- Salary config effective-date selection.
- Monthly payout formula.
- Date range overlap with the selected pay cycle.
- Advance deduction schedule validation and month filtering.
- Sunday default rest-day generation for each month.
- Singapore public holiday import normalization.
- Money rounding.

Integration tests:
- Add/edit/delete records through React forms.
- Google Sheets repository reads/writes with mocked Sheets API responses.
- IndexedDB cache behavior for preferences and last loaded spreadsheet metadata.
- Monthly salary screen updates after record changes.

E2E tests:
- First-run flow: connect or initialize Sheet, add salary config, add split advance, add worked Sunday, verify PH work has no impact until explicit extra pay is selected, review payout.
- Android-sized viewport navigation and form submission.
- Reload keeps spreadsheet connection metadata and refreshes records from Sheets.

Coverage expectations:
- Calculation and date logic should be fully covered with unit tests.
- Core create/edit/delete flows should have at least one integration or E2E path.
- Visual QA should include one desktop viewport and one Android viewport before MVP completion.

## Boundaries
- Always: Validate form inputs before saving.
- Always: Keep calculation logic testable outside UI components.
- Always: Preserve historical salary configs instead of overwriting past versions silently.
- Always: Treat Google Sheets as authoritative and make sheet writes explicit and auditable.
- Always: Run `npm run build`, `npm run lint`, and relevant tests before calling implementation complete.
- Ask first: Add a backend service beyond direct Google Sheets API usage.
- Ask first: Add non-Google authentication.
- Ask first: Add paid third-party services.
- Ask first: Change the salary formula or default divisor after implementation starts.
- Ask first: Start native Android packaging.
- Never: Store secrets in the repo.
- Never: Print private salary or helper data into logs unnecessarily.
- Never: Delete existing user records without confirmation in the UI.
- Never: Build multi-helper or employer-sharing workflows in MVP unless scope changes.

## Success Criteria
- The app opens in desktop browser and Android Chrome viewport.
- The app can be installed or used as a PWA after MVP PWA setup is added.
- A user can connect or initialize a Google Sheet.
- A user can add one salary config, one split-deduction advance, one extra unpaid day off, one worked Sunday record, one public holiday record/import, and one explicit PH extra-pay record.
- The selected pay month salary page shows a correct final payout and a readable breakdown.
- Editing or deleting an advance or time record updates the monthly payout.
- Adding a future salary config does not change calculations for months before its effective date.
- Records are persisted in Google Sheets and visible after browser refresh.
- Currency is displayed as SGD.
- Automated tests cover core salary calculation, date filtering, and record CRUD.

## Open Questions
None.
