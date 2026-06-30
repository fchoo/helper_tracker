import { formatSgd } from "../../lib/money";
import type { SalaryConfig } from "./types";

export type SalaryPlanHistoryProps = {
  salaryConfigs: SalaryConfig[];
  activeEffectiveStartDate?: string;
  emptyMessage?: string;
  onEditSalaryConfig?: (config: SalaryConfig) => void;
};

export function SalaryPlanHistory({
  salaryConfigs,
  activeEffectiveStartDate,
  emptyMessage = "No salary plans saved yet.",
  onEditSalaryConfig,
}: SalaryPlanHistoryProps) {
  if (!salaryConfigs.length) {
    return <p>{emptyMessage}</p>;
  }

  const sortedConfigs = [...salaryConfigs].sort((a, b) =>
    b.effectiveStartDate.localeCompare(a.effectiveStartDate),
  );

  return (
    <ul className="record-list salary-plan-list">
      {sortedConfigs.map((config) => {
        const isActive = config.effectiveStartDate === activeEffectiveStartDate;

        return (
          <li key={config.id} className={isActive ? "active-plan" : undefined}>
            <strong>{formatSgd(config.monthlySalary)}</strong>
            <span>Effective {config.effectiveStartDate}</span>
            <span>OT divisor {config.otDayDivisor}</span>
            <span>Pay date day {config.payCycleStartDay ?? 1}</span>
            <span>{formatSundayOffPolicy()}</span>
            {isActive ? <span className="status-pill status-healthy">Active</span> : null}
            {config.notes ? <span className="record-note">{config.notes}</span> : null}
            {onEditSalaryConfig ? (
              <div className="record-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onEditSalaryConfig(config)}
                  aria-label={`Edit salary plan effective ${config.effectiveStartDate}`}
                >
                  Edit
                </button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function formatSundayOffPolicy(): string {
  return "All Sundays rest days";
}
