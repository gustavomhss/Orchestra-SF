import type { SF_U32_COPY } from "@/i18n/orchestra-chapters/sf-u32"
import type { PreservedValue } from "./model"

type CopyKey = keyof typeof SF_U32_COPY
const fields: Readonly<Record<string, CopyKey>> = {
  id: "sf.u32.field.id",
  name: "sf.u32.field.name",
  label: "sf.u32.field.label",
  title: "sf.u32.field.title",
  subject: "sf.u32.field.subject",
  year: "sf.u32.field.year",
  month: "sf.u32.field.month",
  budget: "sf.u32.field.budget",
  actual: "sf.u32.field.actual",
  forecast: "sf.u32.field.forecast",
  ownerId: "sf.u32.field.ownerId",
  projectId: "sf.u32.field.projectId",
  projId: "sf.u32.field.projId",
  domain: "sf.u32.field.domain",
  location: "sf.u32.field.location",
  type: "sf.u32.field.type",
  status: "sf.u32.field.status",
  notes: "sf.u32.field.notes",
  start: "sf.u32.field.start",
  end: "sf.u32.field.end",
  date: "sf.u32.field.date",
  amount: "sf.u32.field.amount",
  currency: "sf.u32.field.currency",
  spent: "sf.u32.field.spent",
  pct: "sf.u32.field.pct",
  risk: "sf.u32.field.risk",
  owner: "sf.u32.field.owner",
  leaderId: "sf.u32.field.leaderId",
  cls: "sf.u32.field.cls",
  outlook: "sf.u32.field.outlook",
  description: "sf.u32.field.description",
  legalName: "sf.u32.field.legalName",
  active: "sf.u32.field.active",
  departures: "sf.u32.field.departures",
  opened: "sf.u32.field.opened",
  closed: "sf.u32.field.closed",
  netChange: "sf.u32.field.netChange",
  backlog: "sf.u32.field.backlog",
  backlogYtd: "sf.u32.field.backlogYtd",
  totalBudget: "sf.u32.field.totalBudget",
  totalActual: "sf.u32.field.totalActual",
  totalForecast: "sf.u32.field.totalForecast",
  effectiveMonthlyBudget: "sf.u32.field.effectiveMonthlyBudget",
  effective: "sf.u32.field.effective",
  basis: "sf.u32.field.basis",
  pmoActive: "sf.u32.field.pmoActive",
  pmoAtRisk: "sf.u32.field.pmoAtRisk",
  activeRisks: "sf.u32.field.activeRisks",
  onTarget: "sf.u32.field.onTarget",
}
const records: Readonly<Record<string, CopyKey>> = {
  opexOwners: "sf.u32.record.opexOwners",
  opexEntries: "sf.u32.record.opexEntries",
  capexProjects: "sf.u32.record.capexProjects",
  capexEntries: "sf.u32.record.capexEntries",
  members: "sf.u32.record.members",
  leaders: "sf.u32.record.leaders",
  projects: "sf.u32.record.projects",
  contracts: "sf.u32.record.contracts",
  risks: "sf.u32.record.risks",
  stakeholders: "sf.u32.record.stakeholders",
  hotTopics: "sf.u32.record.hotTopics",
  signals: "sf.u32.record.signals",
  itperf: "sf.u32.record.itperf",
  secActions: "sf.u32.record.secActions",
  secIncidents: "sf.u32.record.secIncidents",
  secPhishing: "sf.u32.record.secPhishing",
  itUsersMonthly: "sf.u32.record.itUsersMonthly",
  secKpi: "sf.u32.record.secKpi",
  opsSLA: "sf.u32.record.opsSLA",
  executive: "sf.u32.record.executive",
  executiveByYear: "sf.u32.record.executiveByYear",
  executiveMonths: "sf.u32.record.executiveMonths",
  budgetMetrics: "sf.u32.record.budgetMetrics",
  budget: "sf.u32.record.budget",
  milestone: "sf.u32.record.milestone",
}
export type PreservedValuePresentation = Readonly<{
  fieldKey?: CopyKey
  recordKey?: CopyKey
  recordRef: string
  recordName?: string
}>

/**
 * These are the explicit paths emitted by product/dashboard/port.ts, not opaque
 * reference inference. Unknown paths remain visible verbatim. Names come only
 * from uniquely identified sibling fields in the same preserved projection.
 */
export function preservedValuePresentation(value: PreservedValue, values: readonly PreservedValue[]): PreservedValuePresentation {
  const record = /^([A-Za-z][A-Za-z0-9]*)\[(id:[^\]]+|\d+)\]\.([A-Za-z][A-Za-z0-9]*)$/.exec(value.id)
  const scalar = /^(executive|executiveByYear|executiveMonths|budgetMetrics)(?:\.(\d{4}(?::\d{1,2})?))?\.([A-Za-z][A-Za-z0-9]*)(?:\[\d+\])?$/.exec(value.id)
  const monthly = /^(budget):(\d{4}-\d{2}):(basis|effective|actual|forecast)$/.exec(value.id)
  const milestone = /^(milestone):([^:]+):([^:]+):(date|name|status)$/.exec(value.id)
  const collection = record?.[1] ?? scalar?.[1] ?? monthly?.[1] ?? milestone?.[1]
  const field = record?.[3] ?? scalar?.[3] ?? monthly?.[3] ?? milestone?.[4]
  if (!collection || !field || !Object.hasOwn(records, collection) || !Object.hasOwn(fields, field))
    return { recordRef: value.id }
  const separator = milestone || monthly ? ":" : "."
  const recordRef = milestone ? value.id.slice(0, value.id.lastIndexOf(":"))
    : monthly ? "budget:" + monthly[2]
    : record ? collection + "[" + record[2] + "]"
    : collection + (scalar?.[2] ? "." + scalar[2] : "")
  const nameOf = (prefix: string, split = ".") => {
    for (const name of ["name", "legalName", "subject", "title", "label"]) {
      const candidates = values.filter((entry) => entry.id === prefix + split + name)
      if (candidates.length === 1 && typeof candidates[0]!.value === "string" && candidates[0]!.value.trim())
        return candidates[0]!.value as string
    }
    return undefined
  }
  const relation = collection === "opexEntries" ? { fields: ["ownerId"], collection: "opexOwners" }
    : collection === "capexEntries" ? { fields: ["projId", "projectId"], collection: "capexProjects" } : undefined
  const targets = relation ? values.filter((entry) => relation.fields.some((name) => entry.id === recordRef + "." + name) &&
    (typeof entry.value === "string" || typeof entry.value === "number")).map((entry) => String(entry.value)) : []
  const related = relation && targets.length > 0 && targets.every((target) => target === targets[0])
    ? nameOf(relation.collection + "[id:" + encodeURIComponent(targets[0]!) + "]") : undefined
  const recordName = nameOf(recordRef, separator) ?? related
  return { fieldKey: fields[field], recordKey: records[collection], recordRef, ...(recordName ? { recordName } : {}) }
}

export function preservedValueGroups(values: readonly PreservedValue[]) {
  const groups = new Map<string, { presentation: PreservedValuePresentation; values: PreservedValue[] }>()
  for (const value of values) {
    const presentation = preservedValuePresentation(value, values)
    const group = groups.get(presentation.recordRef)
    if (group) group.values.push(value)
    else groups.set(presentation.recordRef, { presentation, values: [value] })
  }
  return [...groups.values()]
}
