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
function periodStamp(year: number, month: number) {
  return year * 12 + month
}
function yearMonth(value: string | null | undefined) {
  if (typeof value !== "string") return null
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  return month >= 1 && month <= 12 ? periodStamp(year, month) : null
}
export function securityActions(page: SfSecurityPage) {
  // Action rows have no period field. Callers must not present them as the selected month.
  return page.data.secActions ?? []
}
export function securityIncidents(page: SfSecurityPage) {
  const prefix = String(page.selection.year) + "-" + String(page.selection.month).padStart(2, "0")
  return (page.data.secIncidents ?? []).filter((row) =>
    typeof row.date === "string" && row.date.startsWith(prefix))
}
export function securityCampaigns(page: SfSecurityPage) {
  const stamp = periodStamp(page.selection.year, page.selection.month)
  return (page.data.secPhishing ?? []).filter((row) => {
    const start = yearMonth(row.start)
    const end = yearMonth(row.end)
    if (start === null && end === null) return false
    const from = start ?? end!
    const to = end ?? start!
    return from <= stamp && stamp <= to
  })
}
export function securityRow(page: SfSecurityPage, kind: SecurityEntity, id: string) {
  if (kind === "kpi")
    return securityKpi(page)?.id != null && String(securityKpi(page)!.id) === id ? securityKpi(page) : undefined
  if (kind === "action")
    return securityActions(page).find((row) => String(row.id) === id)
  if (kind === "incident")
    return (page.data.secIncidents ?? []).find((row) => String(row.id) === id)
  return securityCampaigns(page).find((row) => String(row.id) === id)
}
