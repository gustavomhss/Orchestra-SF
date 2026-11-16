/**
 * A11 server-only, side-effect-free projection of the already-authorized domain
 * view. The originating Domain.view owns visibility; this further narrows the
 * allowed fields to the CAP11/CAP12 legacy render/fieldset selectors.
 */
import {
  SECURITY_KPIS, securityKpiStatus, socClosureValue, heatCell,
  phishRate, phishTone,
} from "../../../../../../modules/sucafina/Sucafinav1/src/dashboard-accounts.ts"

export const SF_OPERATIONS_PAGES = {
  CAP11: "IT Operations",
  CAP12: "IT Security KPIs",
} as const
export type SfOperationsCapability = keyof typeof SF_OPERATIONS_PAGES
export const SF_OPERATIONS_ACTIONS = {
  CAP11: [
    "save-categories", "save-items", "save-tickets", "save-sla",
    "save-heatmap", "import-month",
  ],
  CAP12: [
    "save-kpi", "delete-kpi", "save-action", "delete-action",
    "save-incident", "delete-incident", "save-campaign", "delete-campaign",
  ],
} as const

const kpiFields = [
  "training", "assessment", "scan", "patch", "patchEndpoint",
  "patchServer", "socCritical", "socHigh", "socMedium", "socLow",
  "socPending", "socTP", "socFP", "socEPS", "socIPs", "socClosure",
] as const
const campaignFields = [
  "targeted", "noInteraction", "openedOnly", "clicked",
  "entered", "reported", "trainingCompletion", "avgMinutes",
] as const
const opsRowKeys = ["id", "year", "month"] as const
const slaKeys = ["id", "year", "month", "incSLA", "svcSLA", "avail"] as const
const heatKeys = ["id", "year", "month", "item", "p1", "p2", "tickets", "comments"] as const
const kpiKeys = ["id", "year", "month", "notes", ...kpiFields] as const
const actionKeys = ["id", "text", "done"] as const
const incidentKeys = [
  "id", "title", "date", "impact", "notes",
  "contained", "remediated", "rootCause", "consequences",
] as const
const campaignKeys = [
  "id", "name", "start", "end", "notes", ...campaignFields, "departments",
] as const
const departmentKeys = ["name", "users", "failed", "entered", "reported"] as const
const ticketMetric = /^[^|]+\|(Incidents|Service Requests)\|(Initial Balance|Open|Closed)$/

function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) ||
    value.some((item) => !item || typeof item !== "object" || Array.isArray(item)))
    throw new Error("Malformed authorized operations source collection")
  return value as Record<string, unknown>[]
}
function pick(row: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(keys.filter((key) => Object.hasOwn(row, key)).map((key) => [key, row[key]]))
}
function sourceSeverity(value: unknown): number | string | null | undefined {
  return value === null || typeof value === "number" || typeof value === "string"
    ? value : undefined
}
function sourceNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}
function selected(
  source: Record<string, unknown>, field: string, keys: readonly string[],
  predicate: (row: Record<string, unknown>) => boolean,
): readonly Record<string, unknown>[] | null | undefined {
  if (!Object.hasOwn(source, field)) return undefined
  if (source[field] === null) return null
  return records(source[field]).filter(predicate).map((row) => pick(row, keys))
}
function storedKeys(source: Record<string, unknown>, name: string): readonly string[] | null | undefined {
  if (!Object.hasOwn(source, name)) return undefined
  if (source[name] === null) return null
  if (!Array.isArray(source[name]) ||
    source[name].some((value: unknown) => typeof value !== "string"))
    throw new Error("Malformed authorized operations source list")
  return source[name] as string[]
}

export function projectSfOperationsData(
  cap: SfOperationsCapability, source: Record<string, unknown>, year: number, month: number,
) {
  if (cap === "CAP11") {
    const opsCats = storedKeys(source, "opsCats")
    const opsHmItems = storedKeys(source, "opsHmItems")
    const tickets = !Object.hasOwn(source, "opsTickets") ? undefined :
      source.opsTickets === null ? null :
      records(source.opsTickets).filter((row) => row.year === year).map((row) =>
        pick(row, [
          ...opsRowKeys,
          ...Object.keys(row).filter((key) => ticketMetric.test(key) &&
            (!opsCats?.length || opsCats.includes(key.split("|")[0]!))),
        ]))
    const sla = selected(source, "opsSLA", slaKeys, (row) => row.year === year)
    const heatmap = selected(source, "opsHeatmap", heatKeys, (row) => row.year === year)
    const months = Array.from({ length: 12 }, (_, index) => index + 1)
    const totals = (measure: "Open" | "Closed") => months.map((currentMonth) => {
      const row = tickets?.find((entry) => entry.month === currentMonth)
      if (!row) return null
      return Object.keys(row)
        .filter((key) => ticketMetric.test(key) && key.endsWith("|" + measure))
        .reduce((sum, key) => sum + sourceNumber(row[key]), 0)
    })
    const cells = (opsHmItems ?? [...new Set((heatmap ?? []).map((row) => row.item).filter(
      (value): value is string => typeof value === "string",
    ))]).flatMap((item) => months.flatMap((currentMonth) => {
      const row = heatmap?.find((entry) => entry.item === item && entry.month === currentMonth)
      if (!row) return []
      const p1 = sourceNumber(row.p1)
      const p2 = sourceNumber(row.p2)
      const count = sourceNumber(row.tickets)
      const color = heatCell(p1, p2, count)
      return [{ item, month: currentMonth, p1, p2, tickets: count,
        dot: color.dot, background: color.bg }]
    }))
    return {
      ...(tickets === undefined ? {} : { opsTickets: tickets }),
      ...(sla === undefined ? {} : { opsSLA: sla }),
      ...(heatmap === undefined ? {} : { opsHeatmap: heatmap }),
      ...(opsCats === undefined ? {} : { opsCats }),
      ...(opsHmItems === undefined ? {} : { opsHmItems }),
      display: { opened: totals("Open"), closed: totals("Closed"), heatmap: cells },
    }
  }

  const secKpi = selected(source, "secKpi", kpiKeys, (row) => row.year === year)
  const secActions = selected(source, "secActions", actionKeys, () => true)
  const secIncidents = selected(source, "secIncidents", incidentKeys,
    (row) => typeof row.date === "string" && row.date.startsWith(String(year)))
  const secPhishing = !Object.hasOwn(source, "secPhishing") ? undefined :
    source.secPhishing === null ? null :
    records(source.secPhishing).map((row) => {
      const projected = pick(row, campaignKeys)
      if (Object.hasOwn(row, "departments"))
        projected.departments = records(row.departments).map((department) => pick(department, departmentKeys))
      return projected
    })
  const entry = secKpi?.find((row) => row.month === month)
  const kpis = SECURITY_KPIS.map((spec) => {
    const value = spec.key === "socClosure"
      ? socClosureValue({
        socCritical: sourceSeverity(entry?.socCritical),
        socHigh: sourceSeverity(entry?.socHigh),
        socMedium: sourceSeverity(entry?.socMedium),
        socLow: sourceSeverity(entry?.socLow),
        socPending: sourceSeverity(entry?.socPending),
        socClosure: sourceSeverity(entry?.socClosure),
      })
      : entry?.[spec.key]
    const scalar = typeof value === "number" || typeof value === "string" ? value : null
    return {
      key: spec.key, value: scalar,
      status: securityKpiStatus(spec.better, spec.target, spec.moderate, scalar),
    }
  })
  const campaigns = (secPhishing ?? []).map((row) => {
    const targeted = sourceNumber(row.targeted)
    const failureRate = phishRate(sourceNumber(row.clicked) + sourceNumber(row.entered), targeted)
    const enteredRate = phishRate(sourceNumber(row.entered), targeted)
    const reportedRate = phishRate(sourceNumber(row.reported), targeted)
    return {
      id: String(row.id ?? ""), failureRate, enteredRate, reportedRate,
      failureTone: phishTone("low", failureRate, 10, 20),
    }
  })
  const openIncidents = (secIncidents ?? []).filter((row) =>
    !row.contained || !row.remediated || !row.rootCause).length
  return {
    ...(secKpi === undefined ? {} : { secKpi }),
    ...(secActions === undefined ? {} : { secActions }),
    ...(secIncidents === undefined ? {} : { secIncidents }),
    ...(secPhishing === undefined ? {} : { secPhishing }),
    display: { kpis, campaigns, openIncidents },
  }
}

/** Only versions of returned/mutable rows are public. Never project "by". */
export function projectSfOperationsVersions(
  cap: SfOperationsCapability,
  versions: Record<string, { version: number; by: string }>,
  data: ReturnType<typeof projectSfOperationsData>,
  year: number, month: number,
): Record<string, number> {
  const monthly = cap === "CAP11" ? "ops:" : "security:"
  const keys = [monthly + year + "-" + month]
  if (cap === "CAP11") keys.push("ops-list:opsCats", "ops-list:opsHmItems")
  if (cap === "CAP12") {
    for (const [collection, rows] of [
      ["secActions", "secActions" in data ? data.secActions : undefined],
      ["secIncidents", "secIncidents" in data ? data.secIncidents : undefined],
      ["secPhishing", "secPhishing" in data ? data.secPhishing : undefined],
    ] as const) {
      for (const row of rows ?? []) {
        if (row.id !== undefined && row.id !== null)
          keys.push(collection + ":" + String(row.id))
      }
    }
  }
  return Object.fromEntries(keys.filter((key) =>
    !!versions[key] && Number.isSafeInteger(versions[key].version) && versions[key].version >= 0,
  ).map((key) => [key, versions[key]!.version]))
}
