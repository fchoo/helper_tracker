import {
  buildEnsureSchemaRequests,
  getRequiredSheetSchemas,
  type SpreadsheetMetadata,
} from "../../integrations/google/spreadsheetSchema";

export type SpreadsheetHealthStatus =
  | "not_connected"
  | "unchecked"
  | "healthy"
  | "needs_attention";

export type SpreadsheetHealthCheck = {
  status: SpreadsheetHealthStatus;
  spreadsheetId?: string;
  checkedAt?: string;
  connectionLabel: string;
  schemaLabel: string;
  detailItems: string[];
  requiredSheetCount: number;
  requiredHeaderCount: number;
  missingSheetCount?: number;
  headerIssueCount?: number;
};

export function buildUncheckedSpreadsheetHealth(
  spreadsheetId?: string,
): SpreadsheetHealthCheck {
  const stats = getRequiredSchemaStats();

  if (!spreadsheetId) {
    return {
      status: "not_connected",
      connectionLabel: "No sheet selected",
      schemaLabel: `${stats.sheetCount} required tabs`,
      detailItems: ["Connect or create a sheet before checking setup health."],
      requiredSheetCount: stats.sheetCount,
      requiredHeaderCount: stats.headerCount,
    };
  }

  return {
    status: "unchecked",
    spreadsheetId,
    connectionLabel: "Sheet selected",
    schemaLabel: "Health not checked",
    detailItems: [
      `${stats.sheetCount} required tabs`,
      `${stats.headerCount} required columns`,
    ],
    requiredSheetCount: stats.sheetCount,
    requiredHeaderCount: stats.headerCount,
  };
}

export function checkSpreadsheetHealth(
  spreadsheetId?: string,
  metadata?: SpreadsheetMetadata,
): SpreadsheetHealthCheck {
  const stats = getRequiredSchemaStats();
  const checkedAt = new Date().toISOString();

  if (!spreadsheetId) {
    return {
      status: "not_connected",
      checkedAt,
      connectionLabel: "No sheet selected",
      schemaLabel: "Cannot check schema",
      detailItems: ["Connect or create a sheet before running the health check."],
      requiredSheetCount: stats.sheetCount,
      requiredHeaderCount: stats.headerCount,
    };
  }

  if (!metadata) {
    return {
      status: "healthy",
      spreadsheetId,
      checkedAt,
      connectionLabel: "Sheet ID saved",
      schemaLabel: "Schema template ready",
      detailItems: [
        `${stats.sheetCount} tabs will be initialized`,
        `${stats.headerCount} columns are defined`,
      ],
      requiredSheetCount: stats.sheetCount,
      requiredHeaderCount: stats.headerCount,
    };
  }

  const requests = buildEnsureSchemaRequests(metadata);
  const missingSheetCount = requests.filter((request) => "addSheet" in request).length;
  const headerIssueCount = requests.filter(
    (request) => "updateCells" in request,
  ).length;
  const needsAttention = missingSheetCount > 0 || headerIssueCount > 0;

  return {
    status: needsAttention ? "needs_attention" : "healthy",
    spreadsheetId,
    checkedAt,
    connectionLabel: "Sheet reachable",
    schemaLabel: needsAttention ? "Schema needs setup" : "Schema healthy",
    detailItems: needsAttention
      ? [
          `${missingSheetCount} missing tabs`,
          `${headerIssueCount} header rows to repair`,
        ]
      : [
          `${stats.sheetCount} required tabs found`,
          `${stats.headerCount} required columns aligned`,
        ],
    requiredSheetCount: stats.sheetCount,
    requiredHeaderCount: stats.headerCount,
    missingSheetCount,
    headerIssueCount,
  };
}

function getRequiredSchemaStats(): { sheetCount: number; headerCount: number } {
  const schemas = getRequiredSheetSchemas();
  const headers = Object.values(schemas).flat();

  return {
    sheetCount: Object.keys(schemas).length,
    headerCount: headers.length,
  };
}
