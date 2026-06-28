import { formatSgd } from "../../lib/money";
import type { SalaryConfig } from "./types";

export type SalaryPlanHistoryProps = {
  salaryConfigs: SalaryConfig[];
  activeEffectiveStartDate?: string;
  emptyMessage?: string;
};

export function SalaryPlanHistory({
  salaryConfigs,
  activeEffectiveStartDate,
  emptyMessage = "No salary plans saved yet.",
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
            <span>{formatSundayOffPolicy(config)}</span>
            {isActive ? <span className="status-pill status-healthy">Active</span> : null}
            {config.notes ? <span className="record-note">{config.notes}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

function formatSundayOffPolicy(config: SalaryConfig): string {
  if (config.defaultSundayOffPolicy === "ALL_SUNDAYS") {
    return "All Sundays rest days";
  }

  return `${config.defaultSundayOffCount ?? 4} Sunday rest days`;
}
