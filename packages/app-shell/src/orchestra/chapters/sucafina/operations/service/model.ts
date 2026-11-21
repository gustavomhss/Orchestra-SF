import { SfOperations } from "@orchestra/schema/sucafina/operations"

/**
 * U04 view selectors. This file does not implement persistence, numeric policy,
 * owner admission, or a substitute DTO: A11 owns the typed source projection.
 */
export type SfServicePage = Extract<
  (typeof SfOperations.operations)["domain.page.CAP11"]["output"]["Type"],
  { status: "ok" }
>["value"]

export type SfServiceAction =
  | "save-tickets"
  | "save-sla"
  | "save-heatmap"
  | "save-categories"
  | "save-items"
  | "import-month"

export const SERVICE_DEFAULT_CATEGORIES = [
  "IT Security", "Infrastructure", "Application", "IT Operations", "Others (Beyers OT)",
] as const
export const SERVICE_DEFAULT_ITEMS = ["iRely", "SAP BCC", "SAP TOM", "SUN", "SOL", "Daily PNL"] as const
export const SERVICE_TICKET_TYPES = ["Incidents", "Service Requests"] as const
export const SERVICE_TICKET_MEASURES = ["Initial Balance", "Open", "Closed"] as const
export const SERVICE_SLA_FIELDS = ["incSLA", "svcSLA", "avail"] as const
export const SERVICE_HEAT_FIELDS = ["p1", "p2", "tickets"] as const
export const SERVICE_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const
export const SERVICE_YEARS = [2024, 2025, 2026, 2027] as const

export const SOURCE_OPERATION_IDS = {
  "save-tickets": "domain.command.CAP11.save-tickets",
  "save-sla": "domain.command.CAP11.save-sla",
  "save-heatmap": "domain.command.CAP11.save-heatmap",
  "save-categories": "domain.command.CAP11.save-categories",
  "save-items": "domain.command.CAP11.save-items",
  "import-month": "domain.command.CAP11.import-month",
} as const

export function serviceCategories(page: SfServicePage): readonly string[] {
  const source = page.data.opsCats
  return source?.length ? source : SERVICE_DEFAULT_CATEGORIES
}

export function serviceItems(page: SfServicePage): readonly string[] {
  const source = page.data.opsHmItems
  return source?.length ? source : SERVICE_DEFAULT_ITEMS
}

export function serviceTicketKeys(page: SfServicePage): string[] {
  return serviceCategories(page).flatMap((category) =>
    SERVICE_TICKET_TYPES.flatMap((kind) =>
      SERVICE_TICKET_MEASURES.map((measure) => category + "|" + kind + "|" + measure),
    ),
  )
}

export function serviceMonthVersion(page: SfServicePage): number {
  return page.versions["ops:" + page.selection.year + "-" + page.selection.month] ?? 0
}

export function serviceListVersion(page: SfServicePage, collection: "opsCats" | "opsHmItems"): number {
  return page.versions["ops-list:" + collection] ?? 0
}

export function serviceRecordId(year: number, month: number): string {
  return String(year) + "-" + String(month)
}

// Do not treat absent/null source metrics as a recorded zero.
export function serviceString(value: string | number | boolean | null | undefined): string {
  return value == null ? "" : String(value)
}

export function serviceCurrentTickets(page: SfServicePage) {
  return (page.data.opsTickets ?? []).find(
    (row) => row.year === page.selection.year && row.month === page.selection.month,
  )
}

export function serviceCurrentSla(page: SfServicePage) {
  return (page.data.opsSLA ?? []).find(
    (row) => row.year === page.selection.year && row.month === page.selection.month,
  )
}

export function serviceCurrentHeatmap(page: SfServicePage, item: string) {
  return (page.data.opsHeatmap ?? []).find(
    (row) => row.year === page.selection.year && row.month === page.selection.month && row.item === item,
  )
}

export function serviceCurrentMonthHeatmap(page: SfServicePage) {
  return (page.data.opsHeatmap ?? []).filter(
    (row) => row.year === page.selection.year && row.month === page.selection.month,
  )
}
