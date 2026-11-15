import { SfOperations, SfOperationsCampaignFields, SfOperationsKpiFields } from "@orchestra/schema/sucafina/operations"

export type SfSecurityPage = Extract<
  (typeof SfOperations.operations)["domain.page.CAP12"]["output"]["Type"],
  { status: "ok" }
>["value"]
export type SecurityEntity = "kpi" | "action" | "incident" | "campaign"
export type SecurityCommand =
  | "save-kpi" | "delete-kpi" | "save-action" | "delete-action"
  | "save-incident" | "delete-incident" | "save-campaign" | "delete-campaign"
export const SECURITY_YEARS = [2024, 2025, 2026, 2027] as const
export const SECURITY_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const
export const SECURITY_CONSEQUENCES = [
  "Data exfiltration", "Data loss", "Service unavailability",
] as const
export const SECURITY_DEPARTMENT_FIELDS = ["name", "users", "failed", "entered", "reported"] as const
export const SECURITY_INCIDENT_FLAGS = ["contained", "remediated", "rootCause"] as const
export const SECURITY_KPI_FIELDS = SfOperationsKpiFields
export const SECURITY_CAMPAIGN_FIELDS = SfOperationsCampaignFields
export const SECURITY_COLLECTIONS = {
  kpi: "secKpi",
  action: "secActions",
  incident: "secIncidents",
  campaign: "secPhishing",
} as const
export const SECURITY_OPERATION_IDS = {
  "save-kpi": "domain.command.CAP12.save-kpi",
  "delete-kpi": "domain.command.CAP12.delete-kpi",
  "save-action": "domain.command.CAP12.save-action",
  "delete-action": "domain.command.CAP12.delete-action",
  "save-incident": "domain.command.CAP12.save-incident",
  "delete-incident": "domain.command.CAP12.delete-incident",
  "save-campaign": "domain.command.CAP12.save-campaign",
  "delete-campaign": "domain.command.CAP12.delete-campaign",
} as const

export function securityVersion(page: SfSecurityPage, kind: SecurityEntity, id?: string) {
  if (kind === "kpi")
    return page.versions["security:" + page.selection.year + "-" + page.selection.month] ?? 0
  return page.versions[SECURITY_COLLECTIONS[kind] + ":" + (id ?? "")] ?? 0
}
export function securityString(value: string | number | boolean | null | undefined): string {
  return value == null ? "" : String(value)
}
export function securityKpi(page: SfSecurityPage) {
  return (page.data.secKpi ?? []).find((row) =>
    row.year === page.selection.year && row.month === page.selection.month)
}
export function securityActions(page: SfSecurityPage) {
  // These are the producer's current action records, not a selected-year archive.
  return page.data.secActions ?? []
}
export function securityIncidents(page: SfSecurityPage) {
  return (page.data.secIncidents ?? []).filter((row) =>
    typeof row.date === "string" && row.date.startsWith(String(page.selection.year)))
}
export function securityCampaigns(page: SfSecurityPage) {
  // Campaign records are current, not a fabricated snapshot for the KPI year.
  return page.data.secPhishing ?? []
}
export function securityRow(page: SfSecurityPage, kind: SecurityEntity, id: string) {
  if (kind === "kpi")
    return securityKpi(page)?.id === id ? securityKpi(page) : undefined
  if (kind === "action")
    return securityActions(page).find((row) => String(row.id) === id)
  if (kind === "incident")
    return (page.data.secIncidents ?? []).find((row) => String(row.id) === id)
  return securityCampaigns(page).find((row) => String(row.id) === id)
}
