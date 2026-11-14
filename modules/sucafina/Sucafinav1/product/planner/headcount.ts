import type { Actor, Command, Environment, Snapshot } from "../../runtime/contract.ts"
import { object, rows, text } from "../../runtime/contract.ts"
import { plannerKeys } from "../../src/nav.ts"
import { simulatePlannerCommand } from "./adapter.ts"
import { projectPlannerSource } from "./port.ts"

/** Same order as the Headcount screen. These states are not interchangeable. */
export type HeadcountState = "excluded" | "not-in-roster" | "no-rate" | "new-hire" | "in-roster"

export function headcountState(position: Record<string, unknown>): HeadcountState {
  if (position.include !== true) return "excluded"
  if (position.left) return "not-in-roster"
  if (position.hasRate === false) return "no-rate"
  if (position.src === "new") return "new-hire"
  return "in-roster"
}

const positionFields = ["name", "title", "type", "location", "include", "fte", "start", "end", "domain", "rateId", "rateOverride"] as const

/** Read the redacted domain view. Do not recompute FTE, months, rates or HR budget. */
export function projectHeadcount(snapshot: Snapshot, actor: Actor, _environment: Environment, versionId: string) {
  if (!plannerKeys(actor).includes("Headcount")) return undefined
  const version = projectPlannerSource(snapshot, actor, versionId)
  if (!version) return undefined
  const summary = object(version.summary)
  const positions = rows(object(version.hc).positions).map((position) => ({ ...position, state: headcountState(position) }))
  const domains = [...new Set(positions.map((position) => text(object(position).domain) || "Unassigned"))]
  return {
    versionId,
    locked: version.locked === true,
    plannedDecemberFte: version.fteInputsKnown === true && typeof summary.fte === "number" && Number.isFinite(summary.fte) ? summary.fte : null,
    denominator: "FTE dezembro planejado das posições incluídas cujo intervalo cobre dezembro. Não é média anual nem disponibilidade real.",
    groups: domains.map((domain) => {
      const line = rows(summary.lines).find((item) => item.id === `HR:${domain}`)
      return {
        domain,
        syntheticLineId: `HR:${domain}`,
        monthlyOutlookUsd: actor.roles.some((role) => ["admin", "hr", "finance"].includes(role)) && Array.isArray(line?.outlook) ? line.outlook : null,
        positions: positions.filter((position) => (text(object(position).domain) || "Unassigned") === domain),
      }
    }),
  }
}

export function prepareHeadcountSync(versionId: string, revision: number): Command | undefined {
  if (!versionId.trim() || !Number.isSafeInteger(revision) || revision < 0) return undefined
  return { page: "Headcount", action: "sync", version: revision, values: { versionId } }
}

export function prepareHeadcountPositionSave(versionId: string, positionId: string, revision: number, values: Record<string, unknown>): Command | undefined {
  if (!versionId.trim() || !positionId.trim() || positionId.startsWith("HR:") || !Number.isSafeInteger(revision) || revision < 0) return undefined
  if (!Object.keys(values).length || Object.keys(values).some((key) => !positionFields.includes(key as (typeof positionFields)[number]))) return undefined
  return { page: "Headcount", action: "save", id: positionId, version: revision, values: { versionId, collection: "positions", ...values } }
}

export function prepareHeadcountIncrease(versionId: string, revision: number, inc: number, incMonth: number): Command | undefined {
  if (!versionId.trim() || !Number.isSafeInteger(revision) || revision < 0 || !Number.isFinite(inc) || !Number.isInteger(incMonth) || incMonth < 1 || incMonth > 12) return undefined
  return { page: "Headcount", action: "save", version: revision, values: { versionId, collection: "increase", inc, incMonth } }
}

export function prepareHeadcountRateSave(versionId: string, rateId: string, revision: number, values: Record<string, unknown>): Command | undefined {
  if (!versionId.trim() || !Number.isSafeInteger(revision) || revision < 0) return undefined
  const fields = ["name", "locs", "annual", "cur"]
  if (Object.keys(values).some((key) => !fields.includes(key))) return undefined
  return { page: "Headcount", action: "save", id: rateId, version: revision, values: { versionId, collection: "rates", ...values } }
}

/** Actual and forecast of a synthetic HR domain. Budget fields are not a writable measure. */
export function prepareHrDomainActualForecast(versionId: string, domain: string, revision: number, values: Record<string, unknown>): Command | undefined {
  if (!versionId.trim() || !domain.trim() || domain.includes(":") || !Number.isSafeInteger(revision) || revision < 0) return undefined
  const keys = Object.keys(values)
  if (!keys.length || keys.some((key) => !/^[af](?:[0-9]|1[01])$/.test(key) || (values[key] !== null && (typeof values[key] !== "number" || !Number.isFinite(values[key]))))) return undefined
  return { page: "OPEX", action: "save", id: `HR:${domain}`, version: revision, values: { versionId, collection: "lines", ...values } }
}

export function previewHeadcountCommand(snapshot: Snapshot, actor: Actor, environment: Environment, command: Command) {
  if (!plannerKeys(actor).includes("Headcount") || !actor.roles.some((role) => ["admin", "hr", "finance"].includes(role))) return undefined
  return simulatePlannerCommand(snapshot, actor, command, environment)
}
