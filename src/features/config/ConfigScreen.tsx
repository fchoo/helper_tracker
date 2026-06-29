import { FormEvent, useEffect, useRef, useState } from "react";
import { PublicHolidayPanel } from "../calendar/PublicHolidayPanel";
import type { NewPublicHolidayInput, PublicHoliday } from "../calendar/types";
import type { SalaryConfig } from "./types";
import type { GooglePickerSpreadsheet } from "../../integrations/google/pickerClient";
import { parseMoneyInput } from "../../lib/money";
import { SalaryPlanHistory } from "./SalaryPlanHistory";
import { SpreadsheetSetup } from "./SpreadsheetSetup";

export type NewSalaryConfigInput = Omit<SalaryConfig, "id" | "createdAt">;

export type ConfigScreenProps = {
  selectedMonth: string;
  salaryConfigs: SalaryConfig[];
  publicHolidays?: PublicHoliday[];
  spreadsheetId?: string;
  spreadsheetName?: string;
  spreadsheetUrl?: string;
  isGoogleOAuthConfigured?: boolean;
  onAddSalaryConfig: (config: NewSalaryConfigInput) => Promise<void> | void;
  onConnectSpreadsheet?: (spreadsheet: GooglePickerSpreadsheet) => Promise<void> | void;
  onCreateSpreadsheet?: () => Promise<GooglePickerSpreadsheet> | GooglePickerSpreadsheet;
  onPickDriveSpreadsheet?: () =>
    | Promise<GooglePickerSpreadsheet>
    | GooglePickerSpreadsheet;
  onImportPublicHolidays?: (year: number) => Promise<PublicHoliday[]>;
  onAddPublicHoliday?: (
    holiday: NewPublicHolidayInput,
  ) => Promise<PublicHoliday> | PublicHoliday;
  onUpdatePublicHoliday?: (
    holiday: PublicHoliday,
  ) => Promise<PublicHoliday> | PublicHoliday;
  onDeletePublicHoliday?: (holidayId: string) => Promise<void> | void;
};

export function ConfigScreen({
  selectedMonth,
  salaryConfigs,
  publicHolidays = [],
  spreadsheetId,
  spreadsheetName,
  spreadsheetUrl,
  isGoogleOAuthConfigured,
  onAddSalaryConfig,
  onConnectSpreadsheet,
  onCreateSpreadsheet,
  onPickDriveSpreadsheet,
  onImportPublicHolidays,
  onAddPublicHoliday,
  onUpdatePublicHoliday,
  onDeletePublicHoliday,
}: ConfigScreenProps) {
  const [activeConfigSection, setActiveConfigSection] =
    useState<ConfigSectionId>("sheet");
  const [isSalaryDialogOpen, setIsSalaryDialogOpen] = useState(false);
  const activeSection = configSections.find(
    (section) => section.id === activeConfigSection,
  );

  return (
    <section aria-labelledby="config-title" className="screen">
      <header className="screen-header">
        <div>
          <h2 id="config-title">Configuration</h2>
          <p>{activeSection?.description}</p>
        </div>
        {activeConfigSection === "salary" ? (
          <button
            type="button"
            className="mobile-floating-action"
            onClick={() => setIsSalaryDialogOpen(true)}
          >
            Add salary plan
          </button>
        ) : null}
      </header>
      <nav className="config-subnav" aria-label="Configuration pages">
        {configSections.map((section) => (
          <button
            type="button"
            key={section.id}
            className={activeConfigSection === section.id ? "active" : ""}
            aria-current={activeConfigSection === section.id ? "page" : undefined}
            onClick={() => setActiveConfigSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>
      {activeConfigSection === "sheet" &&
      onConnectSpreadsheet &&
      onCreateSpreadsheet ? (
        <SpreadsheetSetup
          spreadsheetId={spreadsheetId}
          spreadsheetName={spreadsheetName}
          spreadsheetUrl={spreadsheetUrl}
          isGoogleOAuthConfigured={isGoogleOAuthConfigured}
          onConnect={onConnectSpreadsheet}
          onCreate={onCreateSpreadsheet}
          onPickDriveSpreadsheet={onPickDriveSpreadsheet}
        />
      ) : null}
      {activeConfigSection === "salary" ? (
        <SalaryConfigList salaryConfigs={salaryConfigs} />
      ) : null}
      {activeConfigSection === "holidays" ? (
        <PublicHolidayPanel
          holidays={publicHolidays}
          selectedYear={Number(selectedMonth.slice(0, 4))}
          onImportPublicHolidays={onImportPublicHolidays}
          onAddPublicHoliday={onAddPublicHoliday}
          onUpdatePublicHoliday={onUpdatePublicHoliday}
          onDeletePublicHoliday={onDeletePublicHoliday}
        />
      ) : null}
      {isSalaryDialogOpen ? (
        <SalaryConfigDialog
          onClose={() => setIsSalaryDialogOpen(false)}
          onSubmit={async (config) => {
            await onAddSalaryConfig(config);
            setIsSalaryDialogOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}

type ConfigSectionId = "sheet" | "salary" | "holidays";

const configSections: Array<{
  id: ConfigSectionId;
  label: string;
  description: string;
}> = [
  {
    id: "sheet",
    label: "Google Sheet",
    description: "Connect the payroll workbook.",
  },
  {
    id: "salary",
    label: "Salary plan",
    description: "Review salary plan history.",
  },
  {
    id: "holidays",
    label: "Public holidays",
    description: "Manage public holiday dates.",
  },
];

function SalaryConfigDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: ConfigScreenProps["onAddSalaryConfig"];
}) {
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

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        aria-labelledby="salary-config-dialog-title"
        aria-modal="true"
        className="modal-panel"
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="modal-header">
          <div>
            <h3 id="salary-config-dialog-title">Add salary plan</h3>
          </div>
          <button
            type="button"
            className="secondary-button icon-button"
            aria-label="Close salary plan form"
            onClick={onClose}
          >
            X
          </button>
        </div>
        <SalaryConfigForm onSubmit={onSubmit} />
      </div>
    </div>
  );
}

function SalaryConfigForm({
  onSubmit,
}: {
  onSubmit: ConfigScreenProps["onAddSalaryConfig"];
}) {
  const [monthlySalary, setMonthlySalary] = useState("");
  const [effectiveStartDate, setEffectiveStartDate] = useState("");
  const [otDayDivisor, setOtDayDivisor] = useState("26");
  const [payCycleStartDay, setPayCycleStartDay] = useState("1");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!monthlySalary.trim()) {
      setError("Monthly salary is required.");
      return;
    }

    if (!effectiveStartDate) {
      setError("Effective start date is required.");
      return;
    }

    const divisor = Number(otDayDivisor);

    if (!Number.isInteger(divisor) || divisor <= 0) {
      setError("OT day divisor must be a positive whole number.");
      return;
    }

    const cycleStartDay = Number(payCycleStartDay);

    if (!Number.isInteger(cycleStartDay) || cycleStartDay < 1 || cycleStartDay > 31) {
      setError("Pay date day must be between 1 and 31.");
      return;
    }

    try {
      setError("");
      await onSubmit({
        monthlySalary: parseMoneyInput(monthlySalary),
        effectiveStartDate,
        otDayDivisor: divisor,
        payCycleStartDay: cycleStartDay,
        defaultSundayOffPolicy: "ALL_SUNDAYS",
        defaultSundayOffCount: undefined,
        notes: notes.trim(),
      });

      setMonthlySalary("");
      setEffectiveStartDate("");
      setOtDayDivisor("26");
      setPayCycleStartDay("1");
      setNotes("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to save salary plan.",
      );
    }
  }

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      <label>
        Monthly salary
        <input
          inputMode="decimal"
          value={monthlySalary}
          onChange={(event) => setMonthlySalary(event.target.value)}
        />
      </label>
      <label>
        Effective start date
        <input
          type="date"
          value={effectiveStartDate}
          onChange={(event) => setEffectiveStartDate(event.target.value)}
        />
      </label>
      <details className="advanced-settings">
        <summary>Advanced pay settings</summary>
        <label>
          OT day divisor
          <input
            inputMode="numeric"
            value={otDayDivisor}
            onChange={(event) => setOtDayDivisor(event.target.value)}
          />
        </label>
        <label>
          Pay date day
          <input
            inputMode="numeric"
            value={payCycleStartDay}
            onChange={(event) => setPayCycleStartDay(event.target.value)}
          />
        </label>
      </details>
      <label>
        Salary notes
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit">Add salary plan</button>
    </form>
  );
}

function SalaryConfigList({
  salaryConfigs,
}: {
  salaryConfigs: SalaryConfig[];
}) {
  return (
    <section
      aria-labelledby="salary-history-title"
      className="panel-section salary-history-panel"
    >
      <div className="panel-header">
        <div>
          <h3 id="salary-history-title">Salary plan history</h3>
          <p>Each saved plan stays as an audit trail for future payroll checks.</p>
        </div>
      </div>
      <SalaryPlanHistory
        salaryConfigs={salaryConfigs}
        emptyMessage="No salary plans saved yet."
      />
    </section>
  );
}
