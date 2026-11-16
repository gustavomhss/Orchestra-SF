/**
 * U05 - source-locked presentation of the Portfolio Dashboard / All Projects
 * projection from the A01 domain.page.CAP09/CAP10 producer. This module does
 * not authorize, persist, calculate financial values or issue transport calls.
 *
 * A malformed/partial *envelope* is unavailable, not an empty project list.
 * Missing *fields* remain missing rather than being coerced to zero.
 */
export type SfProjectMilestone = Readonly<{
  id: string
  name: string
  date: string | null | undefined
  status: "done" | "in-progress" | "upcoming" | "late" | null | undefined
  notes: string | null | undefined
}>
export type SfProjectRecord = Readonly<{
  id: string
  name: string
  desc: string | null | undefined
  status: "Planning" | "In Progress" | "On Hold" | "Completed" | null | undefined
  risk: "Low" | "Medium" | "High" | null | undefined
  priority: string | null | undefined
  pm: string | null | undefined
  leaderId: string | null | undefined
  start: string | null | undefined
  end: string | null | undefined
  budget: number | null | undefined
  spent: number | null | undefined
  pct: number | null | undefined
  notes: string | null | undefined
  watch: boolean | null | undefined
  watchList: boolean | null | undefined
  milestones: readonly SfProjectMilestone[] | null
}>
export type SfProjectPage = Readonly<{
  records: readonly SfProjectRecord[]
  versions: Readonly<Record<string, number>>
  capturedAt: string | null
  sourceState: "ready" | "partial"
}>
export type SfProjectEdit = Readonly<{
  name: string
  desc: string
  status: "Planning" | "In Progress" | "On Hold" | "Completed"
  risk: "Low" | "Medium" | "High"
  priority: string
  pm: string
  start: string
  end: string
  budget: string
  spent: string
  pct: string
  watchList: boolean
  notes: string
}>
export const PROJECT_STATUS = ["Planning", "In Progress", "On Hold", "Completed"] as const
export const PROJECT_RISK = ["Low", "Medium", "High"] as const
export const MILESTONE_STATUS = ["done", "in-progress", "upcoming", "late"] as const

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
const string = (value: unknown): value is string => typeof value === "string"
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value)
function optionalString(value: unknown) {
  return value === null || value === undefined || string(value)
}
function optionalNumber(value: unknown) {
  return value === null || value === undefined || finite(value)
}
function optionalBool(value: unknown) {
  return value === null || value === undefined || typeof value === "boolean"
}
function oneOf<const Values extends readonly string[]>(value: unknown, options: Values) {
  return value === null || value === undefined || options.some((v) => v === value)
}
function id(value: unknown): string | null {
  if (string(value) && value.trim()) return value
  if (finite(value)) return String(value)
  return null
}
function projectMilestone(value: unknown): SfProjectMilestone | null {
  if (!object(value) || !id(value.id) || !string(value.name) ||
    !optionalString(value.date) || !oneOf(value.status, MILESTONE_STATUS) ||
    !optionalString(value.notes)) return null
  return {
    id: id(value.id)!,
    name: value.name,
    date: value.date as string | null | undefined,
    status: value.status as SfProjectMilestone["status"],
    notes: value.notes as string | null | undefined,
  }
}
function projectRecord(value: unknown): SfProjectRecord | null {
  if (!object(value) || !id(value.id) || !string(value.name)) return null
  if (![value.desc, value.priority, value.pm, value.leaderId, value.start, value.end, value.notes].every(optionalString) ||
      !oneOf(value.status, PROJECT_STATUS) || !oneOf(value.risk, PROJECT_RISK) ||
      ![value.budget, value.spent, value.pct].every(optionalNumber) ||
      !optionalBool(value.watch) || !optionalBool(value.watchList)) return null
  if (value.milestones != null && !Array.isArray(value.milestones)) return null
  const milestones = Array.isArray(value.milestones)
    ? value.milestones.map(projectMilestone) : null
  if (milestones && (milestones.some((item) => !item) ||
      new Set(milestones.map((item) => item!.id)).size !== milestones.length)) return null
  return {
    id: id(value.id)!,
    name: value.name,
    desc: value.desc as SfProjectRecord["desc"],
    status: value.status as SfProjectRecord["status"],
    risk: value.risk as SfProjectRecord["risk"],
    priority: value.priority as SfProjectRecord["priority"],
    pm: value.pm as SfProjectRecord["pm"],
    leaderId: value.leaderId as SfProjectRecord["leaderId"],
    start: value.start as SfProjectRecord["start"],
    end: value.end as SfProjectRecord["end"],
    budget: value.budget as SfProjectRecord["budget"],
    spent: value.spent as SfProjectRecord["spent"],
    pct: value.pct as SfProjectRecord["pct"],
    notes: value.notes as SfProjectRecord["notes"],
    watch: value.watch as SfProjectRecord["watch"],
    watchList: value.watchList as SfProjectRecord["watchList"],
    milestones: milestones as readonly SfProjectMilestone[] | null,
  }
}

/** Accept only the pinned A01 source-envelope variants and explicit project fieldset. */
export function readSfProjectPage(payload: unknown): SfProjectPage | null {
  if (!object(payload)) return null
  if (payload.status !== undefined && payload.status !== "ok") return null
  const source = payload.status === "ok" ? payload.value : payload
  if (!object(source)) return null
  const raw = object(source.data) ? source.data : source
  if (!Array.isArray(raw.projects)) return null
  const records = raw.projects.map(projectRecord)
  if (records.some((row) => !row) ||
      new Set(records.map((row) => row!.id)).size !== records.length) return null
  const versions: Record<string, number> = {}
  if (object(source.versions)) {
    for (const [key, value] of Object.entries(source.versions)) {
      if (!key.startsWith("projects:") || typeof value !== "number" ||
          !Number.isSafeInteger(value) || value < 0) continue
      versions[key] = value
    }
  }
  return {
    records: records as readonly SfProjectRecord[],
    versions,
    capturedAt: string(source.at) ? source.at : null,
    sourceState: source.coverage === "partial" ? "partial" : "ready",
  }
}
export function sfProjectVersion(page: SfProjectPage, recordId: string): number | null {
  const version = page.versions["projects:" + recordId]
  return version === undefined ? null : version
}
export function sfProjectDraft(record?: SfProjectRecord): SfProjectEdit {
  return {
    name: record?.name ?? "",
    desc: record?.desc ?? "",
    status: record?.status ?? "Planning",
    risk: record?.risk ?? "Low",
    priority: record?.priority ?? "",
    pm: record?.pm ?? "",
    start: record?.start ?? "",
    end: record?.end ?? "",
    budget: record?.budget === undefined || record?.budget === null ? "" : String(record.budget),
    spent: record?.spent === undefined || record?.spent === null ? "" : String(record.spent),
    pct: record?.pct === undefined || record?.pct === null ? "" : String(record.pct),
    watchList: record?.watchList === true,
    notes: record?.notes ?? "",
  }
}
export function sfProjectValues(edit: SfProjectEdit):
  | Readonly<{ name: string; desc: string; status: SfProjectEdit["status"]; risk: SfProjectEdit["risk"]; priority: string; pm: string; start: string; end: string; budget: number; spent: number; pct: number; watchList: boolean; notes: string }>
  | null {
  if (!edit.name.trim() || !PROJECT_STATUS.includes(edit.status) || !PROJECT_RISK.includes(edit.risk)) return null
  // The source's original numeric and validation rules remain authoritative.
  // Do not change blank to observed zero in the UI or silently normalize it.
  const asSourceNumber = (value: string) => value.trim() !== "" && /^-?(?:\d+|\d*\.\d+)$/.test(value.trim()) ? Number(value) : NaN
  const budget = asSourceNumber(edit.budget), spent = asSourceNumber(edit.spent), pct = asSourceNumber(edit.pct)
  if (![budget, spent, pct].every(Number.isFinite)) return null
  return { name: edit.name, desc: edit.desc, status: edit.status, risk: edit.risk, priority: edit.priority,
    pm: edit.pm, start: edit.start, end: edit.end, budget, spent, pct, watchList: edit.watchList, notes: edit.notes }
}
export function sfSourceDate(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d\d-\d\d$/.test(value)) return null
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null
}
