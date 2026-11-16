import { computeBudgetTotals } from "../../../../../../modules/sucafina/Sucafinav1/src/dashboard-accounts.ts"
import type { BudgetData } from "../../../../../../modules/sucafina/Sucafinav1/src/dashboard-accounts.ts"
import { rows } from "../../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"

/** Server-only projection: public fieldsets returned by the pinned Domain.view producers. */
export const SF_DOMAIN_PAGES = {
  CAP01: "Executive Dashboard",
  CAP03: "Budget Overview",
  CAP04: "OPEX Detail",
  CAP05: "CAPEX Projects",
  CAP09: "Portfolio Dashboard",
  CAP10: "All Projects",
  CAP13: "IT Risks",
  CAP14: "Vendor Contracts",
  CAP15: "Stakeholder Management",
  CAP16: "IT Performance Contract",
} as const

export type SfDomainCapability = keyof typeof SF_DOMAIN_PAGES

const budgetOwnerFields = ["id", "name", "budget", "status"] as const
const budgetEntryFields = ["id", "ownerId", "projId", "projectId", "year", "month", "budget", "actual", "forecast"] as const
const executiveFields = ["active", "departures", "monthlyDepartures", "pmoActive", "pmoAtRisk", "activeRisks", "topRisks", "onTarget"] as const
const executiveMonthFields = ["opened", "closed", "netChange", "backlog", "p1", "incSLA", "svcSLA", "incYtd", "svcYtd", "backlogYtd", "openIncidents"] as const
const projectFields = ["id", "createdAt", "updatedAt", "name", "desc", "status", "risk", "priority", "pm", "leaderId", "start", "end", "budget", "spent", "pct", "notes", "watch", "watchList"] as const
const riskFields = ["id", "createdAt", "updatedAt", "title", "action", "responsible", "name", "desc", "category", "impact", "probability", "status", "owner", "ownerId", "leaderId", "mitigation", "due", "notes"] as const
const contractFields = ["id", "createdAt", "updatedAt", "num", "renewal", "vendor", "name", "desc", "category", "owner", "ownerId", "start", "end", "amount", "amtType", "renewType", "notice", "eval", "notes", "currency"] as const
const stakeholderFields = ["id", "createdAt", "updatedAt", "position", "name", "title", "company", "department", "role", "email", "biz", "iti", "perc", "priority", "owner", "action", "actions", "notes"] as const
const itemFields = ["id", "name", "color", "totalWeight", "ownerWeight", "co1Weight", "co2Weight", "expanded", "description"] as const
const subFields = ["id", "label", "objective", "target", "description", "totalWeight", "owner", "ownerWeight", "co1", "co1Weight", "co2", "co2Weight", "score", "status", "q1", "q2", "q3", "q4", "statusQ1", "statusQ2", "statusQ3", "statusQ4", "notes"] as const
const signalFields = ["id", "page", "recordId", "fact", "rule", "date"] as const
const budgetVersionKeys = ["opexOwners", "opexEntries", "capexProjects", "capexEntries", "budgetYtd", "budgetCurrentMonth", "revenueByYear", "itUsersMonthly", "costPerUserBenchmarks", "deviations"] as const

const has = (value: Record<string, unknown>, key: string): boolean => Object.hasOwn(value, key)
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
const isRecordList = (value: unknown): value is Record<string, unknown>[] =>
  Array.isArray(value) && value.every(isRecord)
const requiredRecord = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error("Malformed authorized source object")
  return value
}
const pick = (source: Record<string, unknown>, keys: readonly string[]) =>
  Object.fromEntries(keys.filter((key) => has(source, key)).map((key) => [key, source[key]]))

const requiredRows = (value: unknown): Record<string, unknown>[] => {
  if (!isRecordList(value)) throw new Error("Malformed authorized source collection")
  return value
}
const projectRows = (value: unknown, keys: readonly string[]) =>
  requiredRows(value).map((row) => pick(row, keys))

function sanitizedFinance(source: Record<string, unknown>): BudgetData | undefined {
  if (!["opexOwners", "opexEntries", "capexProjects", "capexEntries"].every((key) => isRecordList(source[key]))) return undefined
  const owners = (value: unknown) => rows(value).map((row) => {
    const id = row.id
    const budget = row.budget
    if (typeof id !== "string" && typeof id !== "number") return undefined
    if (budget !== undefined && budget !== null && (typeof budget !== "number" || !Number.isFinite(budget))) return undefined
    return { id, ...(typeof budget === "number" ? { budget } : {}) }
  })
  const entries = (value: unknown) => rows(value).map((row) => {
    if (typeof row.year !== "number" || !Number.isInteger(row.year) || typeof row.month !== "number" || !Number.isInteger(row.month)) return undefined
    const amountFields = ["budget", "actual", "forecast"] as const
    if (amountFields.some((field) => row[field] !== undefined && row[field] !== null && (typeof row[field] !== "number" || !Number.isFinite(row[field])))) return undefined
    return {
      year: Number(row.year), month: Number(row.month),
      ...(typeof row.ownerId === "string" || typeof row.ownerId === "number" ? { ownerId: row.ownerId } : {}),
      ...(typeof row.projId === "string" || typeof row.projId === "number" ? { projId: row.projId } : {}),
      ...(typeof row.projectId === "string" || typeof row.projectId === "number" ? { projectId: row.projectId } : {}),
      ...(typeof row.budget === "number" ? { budget: row.budget } : {}),
      ...(typeof row.actual === "number" ? { actual: row.actual } : {}),
      ...(typeof row.forecast === "number" ? { forecast: row.forecast } : {}),
    }
  })
  const opexOwners = owners(source.opexOwners)
  const capexProjects = owners(source.capexProjects)
  const opexEntries = entries(source.opexEntries)
  const capexEntries = entries(source.capexEntries)
  if ([...opexOwners, ...capexProjects, ...opexEntries, ...capexEntries].some((value) => !value)) return undefined
  return {
    opexOwners: opexOwners.filter((row): row is NonNullable<typeof row> => row !== undefined),
    capexProjects: capexProjects.filter((row): row is NonNullable<typeof row> => row !== undefined),
    opexEntries: opexEntries.filter((row): row is NonNullable<typeof row> => row !== undefined),
    capexEntries: capexEntries.filter((row): row is NonNullable<typeof row> => row !== undefined),
  }
}

function publicBudget(source: Record<string, unknown>, cap: "CAP01" | "CAP03" | "CAP04" | "CAP05", year: number) {
  const data: Record<string, unknown> = {}
  if (cap === "CAP01" || cap === "CAP03") {
    const budget = sanitizedFinance(source)
    if (budget) data.totals = computeBudgetTotals(budget, year)
  }
  if (cap === "CAP01") {
    if (has(source, "executive")) data.executive = pick(requiredRecord(source.executive), executiveFields)
    for (const field of ["executiveByYear", "executiveMonths", "opsDefaultMonth"] as const) {
      if (!has(source, field)) continue
      const values = requiredRecord(source[field])
      data[field] = field === "executiveByYear"
        ? Object.fromEntries(Object.entries(values).map(([key, val]) => [key, pick(requiredRecord(val), executiveFields)]))
        : field === "executiveMonths"
          ? Object.fromEntries(Object.entries(values).map(([key, val]) => [key, {
              ...pick(requiredRecord(val), executiveMonthFields),
              ...(has(requiredRecord(val), "kpis") ? { kpis: projectRows(requiredRecord(val).kpis, ["key", "value", "status", "sourceYear", "sourceMonth"]) } : {}),
            }]))
          : Object.fromEntries(Object.entries(values).filter(([, val]) => Number.isInteger(val)))
    }
    for (const field of ["itUsersMonthly", "costPerUserBenchmarks"] as const)
      if (has(source, field)) data[field] = projectRows(source[field], ["id", "year", "month", "users", "value"])
    if (has(source, "signals")) data.signals = projectRows(source.signals, signalFields)
  }
  if (cap === "CAP03") {
    if (has(source, "budgetCurrentMonth")) data.budgetCurrentMonth = requiredRecord(source.budgetCurrentMonth)
    if (has(source, "revenueByYear")) data.revenueByYear = requiredRecord(source.revenueByYear)
  }
  if (cap === "CAP04" || cap === "CAP05") {
    const own = cap === "CAP04" ? "opex" : "capex"
    const owners = cap === "CAP04" ? "opexOwners" : "capexProjects"
    const entries = cap === "CAP04" ? "opexEntries" : "capexEntries"
    if (has(source, owners)) data[owners] = projectRows(source[owners], budgetOwnerFields)
    if (has(source, entries)) data[entries] = projectRows(source[entries], budgetEntryFields)
    if (has(source, "budgetLineIds")) {
      if (!Array.isArray(source.budgetLineIds) || !source.budgetLineIds.every((line) => typeof line === "string"))
        throw new Error("Malformed authorized budget line scope")
      data.budgetLineIds = source.budgetLineIds.filter((line): line is string => line.startsWith(`${owners}:`))
    }
    if (has(source, "deviations")) data.deviations = Object.fromEntries(
      Object.entries(requiredRecord(source.deviations)).filter(([key]) => key.startsWith(`${own}-`))
        .map(([key, value]) => [key, pick(requiredRecord(value), ["flag", "text"])]),
    )
    if (has(source, "budgetYtd") && has(requiredRecord(source.budgetYtd), own))
      data.budgetYtd = { [own]: Object.fromEntries(
        Object.entries(requiredRecord(requiredRecord(source.budgetYtd)[own]))
          .map(([key, value]) => [key, pick(requiredRecord(value), ["amount", "months", "perMonth", "at"])]),
      ) }
  }
  return data
}

function publicPortfolio(source: Record<string, unknown>, cap: SfDomainCapability) {
  if (cap === "CAP09" || cap === "CAP10") {
    if (!has(source, "projects")) return undefined
    return { projects: requiredRows(source.projects).map((row) => ({
      ...pick(row, projectFields),
      ...(has(row, "milestones") ? { milestones: projectRows(row.milestones, ["id", "name", "date", "status", "notes"]) } : {}),
    })) }
  }
  if (cap === "CAP13") {
    if (!has(source, "risks")) return undefined
    return { risks: projectRows(source.risks, riskFields) }
  }
  if (cap === "CAP14") {
    if (!has(source, "contracts")) return undefined
    return { contracts: requiredRows(source.contracts).map((row) => ({
      ...pick(row, contractFields),
      ...(has(row, "docs") ? { docs: projectRows(row.docs, ["id", "name", "size", "type", "added", "status"]) } : {}),
    })) }
  }
  if (cap === "CAP15") {
    if (!has(source, "stakeholders")) return undefined
    return { stakeholders: projectRows(source.stakeholders, stakeholderFields) }
  }
  if (cap === "CAP16") {
    if (!has(source, "itperf")) return undefined
    const performance = requiredRecord(source.itperf)
    return { itperf: {
      ...pick(performance, ["name", "year"]),
      ...(has(performance, "items") ? { items: requiredRows(performance.items).map((item) => ({
        ...pick(item, itemFields),
        ...(has(item, "subs") ? { subs: projectRows(item.subs, subFields) } : {}),
      })) } : {}),
    } }
  }
  return undefined
}

/** No private snapshot, auth map, cost details, supplier banking or document bytes. */
export function projectSfDomainData(cap: SfDomainCapability, source: Record<string, unknown>, year: number) {
  if (cap === "CAP01" || cap === "CAP03" || cap === "CAP04" || cap === "CAP05")
    return publicBudget(source, cap, year)
  return publicPortfolio(source, cap)
}

/** Version values are CAS integers only, never version.by or private record IDs. */
export function projectSfDomainVersions(cap: SfDomainCapability, source: Record<string, { version: number; by: string }>) {
  if (cap === "CAP03") {
    for (const key of ["budgetCurrentMonth", "revenueByYear"] as const) {
      if (Object.hasOwn(source, key) && (!source[key] || !Number.isSafeInteger(source[key].version) || source[key].version < 0))
        throw new Error("Malformed authorized singleton version")
    }
  }
  const keys: readonly string[] = cap === "CAP01" || cap === "CAP03" ? budgetVersionKeys :
    cap === "CAP04" ? ["opexOwners", "opexEntries", "budgetYtd", "deviations"] :
      cap === "CAP05" ? ["capexProjects", "capexEntries", "budgetYtd", "deviations"] :
        cap === "CAP09" || cap === "CAP10" ? ["projects"] :
          cap === "CAP13" ? ["risks"] : cap === "CAP14" ? ["contracts"] :
            cap === "CAP15" ? ["stakeholders"] : ["itperf"]
  const projected = Object.fromEntries(Object.entries(source).filter(([key, value]) =>
    Number.isSafeInteger(value.version) && value.version >= 0 &&
    keys.some((allowed) => key === allowed || key.startsWith(`${allowed}:`)) &&
    (cap !== "CAP04" && cap !== "CAP05" ||
      !key.startsWith("deviations:") ||
      key.startsWith(`deviations:${cap === "CAP04" ? "opex" : "capex"}-`)))
    .map(([key, value]) => [key, value.version]))
  if (cap === "CAP03") {
    for (const key of ["budgetCurrentMonth", "revenueByYear"] as const)
      if (!Object.hasOwn(source, key)) projected[key] = 0
  }
  return projected
}
