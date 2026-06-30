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
  onUpdateSalaryConfig?: (
    configId: string,
    config: NewSalaryConfigInput,
  ) => Promise<void> | void;
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
  onUpdateSalaryConfig,
  onImportPublicHolidays,
  onAddPublicHoliday,
  onUpdatePublicHoliday,
  onDeletePublicHoliday,
}: ConfigScreenProps) {
  const [activeConfigSection, setActiveConfigSection] =
    useState<ConfigSectionId>("sheet");
  const [salaryDialog, setSalaryDialog] = useState<SalaryDialogState>(null);
  return (
    <section aria-labelledby="config-title" className="screen">
      <h2 id="config-title" className="visually-hidden">
        Configuration
      </h2>
      <div className="config-page-toolbar">
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
        {activeConfigSection === "salary" ? (
          <button
            type="button"
            className="mobile-floating-action"
            onClick={() => setSalaryDialog({ mode: "add" })}
          >
            Add salary plan
          </button>
        ) : null}
      </div>
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
        <SalaryConfigList
          salaryConfigs={salaryConfigs}
          onEditSalaryConfig={
            onUpdateSalaryConfig
              ? (config) => setSalaryDialog({ mode: "edit", config })
              : undefined
          }
        />
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
      {salaryDialog ? (
        <SalaryConfigDialog
          mode={salaryDialog.mode}
          config={salaryDialog.mode === "edit" ? salaryDialog.config : null}
          onClose={() => setSalaryDialog(null)}
          onSubmit={async (config) => {
            if (
              salaryDialog.mode === "edit" &&
              salaryDialog.config &&
              onUpdateSalaryConfig
            ) {
              await onUpdateSalaryConfig(salaryDialog.config.id, config);
              setSalaryDialog(null);
              return;
            }

            await onAddSalaryConfig(config);
            setSalaryDialog(null);
          }}
        />
      ) : null}
    </section>
  );
}

type ConfigSectionId = "sheet" | "salary" | "holidays";

type SalaryDialogState =
  | { mode: "add"; config?: undefined }
  | { mode: "edit"; config: SalaryConfig }
  | null;

const configSections: Array<{
  id: ConfigSectionId;
  label: string;
}> = [
  {
    id: "sheet",
    label: "Google Sheet",
  },
  {
    id: "salary",
    label: "Salary plan",
  },
  {
    id: "holidays",
    label: "Public holidays",
  },
];

function SalaryConfigDialog({
  mode,
  config,
  onClose,
  onSubmit,
}: {
  mode: "add" | "edit";
  config: SalaryConfig | null;
  onClose: () => void;
  onSubmit: ConfigScreenProps["onAddSalaryConfig"];
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const title = mode === "edit" ? "Edit salary plan" : "Add salary plan";

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
            <h3 id="salary-config-dialog-title">{title}</h3>
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
        <SalaryConfigForm mode={mode} config={config} onSubmit={onSubmit} />
      </div>
    </div>
  );
}

function SalaryConfigForm({
  mode,
  config,
  onSubmit,
}: {
  mode: "add" | "edit";
  config: SalaryConfig | null;
  onSubmit: ConfigScreenProps["onAddSalaryConfig"];
}) {
  const [monthlySalary, setMonthlySalary] = useState(
    config ? String(config.monthlySalary) : "",
  );
  const [effectiveStartDate, setEffectiveStartDate] = useState(
    config?.effectiveStartDate ?? "",
  );
  const [otDayDivisor, setOtDayDivisor] = useState(
    String(config?.otDayDivisor ?? 26),
  );
  const [payCycleStartDay, setPayCycleStartDay] = useState(
    String(config?.payCycleStartDay ?? 1),
  );
  const [notes, setNotes] = useState(config?.notes ?? "");
  const [error, setError] = useState("");
  const isEditing = mode === "edit";

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

      if (!isEditing) {
        setMonthlySalary("");
        setEffectiveStartDate("");
        setOtDayDivisor("26");
        setPayCycleStartDay("1");
        setNotes("");
      }
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
      <button type="submit">
        {isEditing ? "Save salary plan" : "Add salary plan"}
      </button>
    </form>
  );
}

function SalaryConfigList({
  salaryConfigs,
  onEditSalaryConfig,
}: {
  salaryConfigs: SalaryConfig[];
  onEditSalaryConfig?: (config: SalaryConfig) => void;
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
        onEditSalaryConfig={onEditSalaryConfig}
      />
    </section>
  );
}
