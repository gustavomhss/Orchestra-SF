import type { Actor, Command, Environment, Snapshot } from "../../runtime/contract.ts"
import { object, rows, text } from "../../runtime/contract.ts"
import { plannerKeys } from "../../src/nav.ts"
import { fteDecember } from "../../src/planner-accounts.ts"
import { plannerHrMonthState } from "./headcount-months.ts"
import { projectPlanner, simulatePlannerCommand } from "./adapter.ts"
import { projectPlannerSource } from "./port.ts"

/** Same order as the Headcount screen. These states are not interchangeable. */
export type HeadcountState = "excluded" | "not-in-roster" | "no-rate" | "new-hire" | "in-roster"

export function headcountStates(position: Record<string, unknown>): readonly HeadcountState[] {
  if (position.include !== true) return ["excluded"]
  const states: HeadcountState[] = []
  if (position.left) states.push("not-in-roster")
  if (position.hasRate === false) states.push("no-rate")
  if (position.src === "new") states.push("new-hire")
  return states.length ? states : ["in-roster"]
}

export function headcountState(position: Record<string, unknown>): HeadcountState {
  if (position.include !== true) return "excluded"
  if (position.left) return "not-in-roster"
  if (position.hasRate === false) return "no-rate"
  if (position.src === "new") return "new-hire"
  return "in-roster"
}

const positionFields = ["name", "title", "type", "location", "include", "fte", "start", "end", "domain", "rateId", "rateOverride"] as const

/** Read the redacted domain view. Do not recompute FTE, months, rates or HR budget. */
export function projectHeadcount(snapshot: Snapshot, actor: Actor, environment: Environment, versionId: string) {
  if (!plannerKeys(actor).includes("Headcount")) return undefined
  const version = projectPlannerSource(snapshot, actor, versionId)
  if (!version) return undefined
  const summary = object(version.summary)
  const positions = rows(object(version.hc).positions).map((position) => ({ ...position, state: headcountState(position), states: headcountStates(position), revision: snapshot.versions[`${versionId}:positions:${text(position.id)}`]?.version ?? 0 }))
  const domains = [...new Set([...positions.map((position) => text(object(position).domain) || "Unassigned"), ...Object.keys(object(object(version.hc).hrAF)).map((id) => id.replace(/^HR:/, ""))])]
  const privateAccess = actor.roles.some((role) => ["admin", "hr", "finance"].includes(role))
  return {
    versionId,
    locked: version.locked === true,
    year: version.year,
    versionName: text(version.name),
    closedThrough: version.closed,
    monthlyPlannedFte: plannedFte(positions, version.fteInputsKnown === true),
    syncRevision: snapshot.versions[`${versionId}:positions:sync`]?.version ?? 0,
    increaseRevision: snapshot.versions[`${versionId}:increase`]?.version ?? 0,
    leaderDomainsRevision: snapshot.versions[`${versionId}:leaderDomains`]?.version ?? 0,
    leaders: privateAccess ? [...new Set(rows(projectPlanner(snapshot, actor, environment).data.roster).map((person) => text(person.leader)).filter(Boolean))].map((leader) => ({ leader, domain: text(object(object(version.hc).leaderDomains)[leader]) })) : [],
    increase: privateAccess ? { percent: object(version.hc).inc, month: object(version.hc).incMonth } : null,
    rates: privateAccess ? rows(object(version.hc).rates).map((rate) => ({ ...rate, revision: snapshot.versions[`${versionId}:rates:${text(rate.id)}`]?.version ?? 0 })) : [],
    plannedDecemberFte: version.fteInputsKnown === true && typeof summary.fte === "number" && Number.isFinite(summary.fte) ? summary.fte : null,
    denominator: "FTE dezembro planejado das posições incluídas cujo intervalo cobre dezembro. Não é média anual nem disponibilidade real.",
    groups: domains.map((domain) => {
      const line = rows(summary.lines).find((item) => item.id === `HR:${domain}`)
      const members = positions.filter((position) => (text(object(position).domain) || "Unassigned") === domain)
      const months = line ? Array.from({ length: 12 }, (_, index) => plannerHrMonthState(version, line, index + 1)) : []
      const monthly = line ? months.map((entry) => entry.outlookUsd) : null
      const budgetMissing = [...new Set(months.flatMap((entry) => entry.budgetMissing))]
      return {
        domain,
        syntheticLineId: `HR:${domain}`,
        revision: snapshot.versions[`${versionId}:hrAF:HR:${domain}`]?.version ?? 0,
        monthlyPlannedFte: plannedFte(members, version.fteInputsKnown === true),
        monthlyBudgetUsd: line ? months.map((entry) => entry.budgetUsd) : null,
        monthlyActualUsd: line ? months.map((entry) => entry.actualUsd) : null,
        monthlyForecastUsd: line ? months.map((entry) => entry.forecastUsd) : null,
        monthlyOutlookUsd: monthly,
        outlookSources: line ? months.map((entry) => entry.source) : null,
        budgetState: budgetMissing.length || !line ? "partial" as const : "known" as const,
        costState: !monthly || monthly.some((value) => value === null) ? "partial" as const : "known" as const,
        costNote: budgetMissing.includes("missing-rate") ? "no-rate-is-not-confirmed-savings" as const : budgetMissing.includes("missing-fx") ? "missing-fx-is-not-confirmed-savings" as const : null,
        positions: members.map((position) => privateAccess ? position : Object.fromEntries(["id", "name", "title", "type", "location", "include", "fte", "start", "end", "domain", "left", "src", "hasRate", "state", "states", "revision"].filter((field) => field in position).map((field) => [field, object(position)[field]]))),
      }
    }),
  }
}

/** Reuse the existing December selection rule for each requested month. */
function plannedFte(positions: readonly Record<string, unknown>[], known: boolean) {
  return Array.from({ length: 12 }, (_, index) => known ? fteDecember(positions.map((position) => ({ include: position.include === true, fte: Number(position.fte), start: Number(position.start) + 11 - index, end: Number(position.end) + 11 - index }))) : null)
}

export function prepareHeadcountSync(versionId: string, revision: number): Command | undefined {
  if (!versionId.trim() || !Number.isSafeInteger(revision) || revision < 0) return undefined
  return { page: "Headcount", action: "sync", version: revision, values: { versionId } }
}

export function prepareHeadcountPositionSave(versionId: string, positionId: string, revision: number, values: Record<string, unknown>): Command | undefined {
  if (!versionId.trim() || positionId !== "" && !positionId.trim() || positionId.startsWith("HR:") || !Number.isSafeInteger(revision) || revision < 0 || positionId === "" && revision !== 0) return undefined
  if (!Object.keys(values).length || Object.keys(values).some((key) => !positionFields.includes(key as (typeof positionFields)[number]))) return undefined
  return { page: "Headcount", action: "save", id: positionId, version: revision, values: { versionId, collection: "positions", ...values } }
}

export function prepareHeadcountIncrease(versionId: string, revision: number, inc: number, incMonth: number): Command | undefined {
  if (!versionId.trim() || !Number.isSafeInteger(revision) || revision < 0 || !Number.isFinite(inc) || !Number.isInteger(incMonth) || incMonth < 1 || incMonth > 12) return undefined
  return { page: "Headcount", action: "save", version: revision, values: { versionId, collection: "increase", inc, incMonth } }
}

export function prepareHeadcountRateSave(versionId: string, rateId: string, revision: number, values: Record<string, unknown>): Command | undefined {
  if (!versionId.trim() || rateId !== "" && !rateId.trim() || !Number.isSafeInteger(revision) || revision < 0 || rateId === "" && revision !== 0) return undefined
  const fields = ["name", "locs", "annual", "cur"]
  if (!Object.keys(values).length || Object.keys(values).some((key) => !fields.includes(key))) return undefined
  return { page: "Headcount", action: "save", id: rateId, version: revision, values: { versionId, collection: "rates", ...values } }
}

export function prepareHeadcountDelete(versionId: string, collection: "positions" | "rates", id: string, revision: number): Command | undefined {
  if (!versionId.trim() || !id.trim() || id.startsWith("HR:") || !Number.isSafeInteger(revision) || revision < 0) return undefined
  return { page: "Headcount", action: "delete", id, version: revision, values: { versionId, collection } }
}

export function prepareHeadcountLeaderDomain(versionId: string, revision: number, leader: string, domain: string): Command | undefined {
  if (!versionId.trim() || typeof leader !== "string" || !leader.trim() || !Number.isSafeInteger(revision) || revision < 0 || typeof domain !== "string") return undefined
  return { page: "Headcount", action: "save", version: revision, values: { versionId, collection: "leaderDomains", leader, domain } }
}

/** Actual and forecast of a synthetic HR domain. Budget fields are not a writable measure. */
export function prepareHrDomainActualForecast(versionId: string, domain: string, revision: number, values: Record<string, unknown>): Command | undefined {
  if (!versionId.trim() || !domain.trim() || domain.includes(":") || !Number.isSafeInteger(revision) || revision < 0) return undefined
  const keys = Object.keys(values)
  if (!keys.length || keys.some((key) => !/^[af](?:[0-9]|1[01])$/.test(key) || (values[key] !== null && (typeof values[key] !== "number" || !Number.isFinite(values[key]))))) return undefined
  return { page: "OPEX", action: "save", id: `HR:${domain}`, version: revision, values: { versionId, collection: "lines", ...values } }
}

/** Name the positions behind one published HR outlook cell. The cell stays the domain value. */
export function explainHrMonth(snapshot: Snapshot, actor: Actor, environment: Environment, versionId: string, domain: string, month: number) {
  if (!Number.isInteger(month) || month < 1 || month > 12) return undefined
  const projected = projectHeadcount(snapshot, actor, environment, versionId)
  const group = projected?.groups.find((item) => item.domain === domain)
  if (!projected || !group) return undefined
  const outlook = group.monthlyOutlookUsd
  return {
    domain,
    month,
    syntheticLineId: group.syntheticLineId,
    syntheticOutlookUsd: Array.isArray(outlook) && typeof outlook[month - 1] === "number" && Number.isFinite(outlook[month - 1]) ? outlook[month - 1] : null,
    costState: group.costState,
    costNote: group.costNote,
    positions: group.positions.map((position) => ({ id: object(position).id, name: object(position).name, state: object(position).state, include: object(position).include === true })),
  }
}

export function previewHeadcountCommand(snapshot: Snapshot, actor: Actor, environment: Environment, command: Command) {
  if (!plannerKeys(actor).includes("Headcount") || !actor.roles.some((role) => ["admin", "hr", "finance"].includes(role))) return undefined
  return simulatePlannerCommand(snapshot, actor, command, environment)
}
