import { domain } from "../../runtime/planner.ts"
import { object, rows, text } from "../../runtime/contract.ts"
import type { Actor, Command, Environment, Snapshot } from "../../runtime/contract.ts"
import { plannerKeys } from "../../src/nav.ts"
import { plannerField } from "../../src/planner-role.ts"
import { usdAmount } from "../../src/planner-accounts.ts"

/** Read only the two catalog surfaces from the authorized Planner view. */
export function plannerCatalogs(snapshot: Snapshot, actor: Actor, environment: Environment, versionId: string) {
  if (!plannerKeys(actor).includes("FX rates") || !plannerKeys(actor).includes("Entities & allocations")) return undefined
  const view = domain.view(snapshot, actor, environment)
  const version = rows(view.data.versions).find((entry) => entry.id === versionId)
  if (!version) return undefined
  const warnings = object(version.summary).warnings
  const year = typeof version.year === "number" && Number.isInteger(version.year) ? version.year : undefined
  const officialId = year === undefined ? undefined : text(object(view.data.officials)[String(year)]) || undefined
  return {
    fx: { scope: "version" as const, versionId, locked: version.locked === true, writable: year !== undefined && plannerField("fx", { id: versionId, year, locked: version.locked === true }, officialId, actor), usd: { code: "USD", rate: 1, editable: false as const }, rates: rows(version.fx).map((rate) => ({ id: text(rate.id), currency: text(rate.cur), rate: typeof rate.rate === "number" && Number.isFinite(rate.rate) ? rate.rate : null, revision: snapshot.versions[`${versionId}:fx:${text(rate.id)}`]?.version ?? 0 })), warnings: Array.isArray(warnings) ? warnings.filter((value): value is string => typeof value === "string") : [] },
    shared: { scope: "shared" as const, writable: actor.canWrite && actor.roles.includes("admin"), commonRevision: snapshot.versions["allocations:common"]?.version ?? 0, entities: rows(view.data.entities).map((entry) => ({ id: text(entry.id), name: text(entry.name), code: text(entry.code), revision: snapshot.versions[`entities:${text(entry.id)}`]?.version ?? 0 })), allocations: rows(view.data.allocations).map((entry) => ({ id: text(entry.id), name: text(entry.name), description: text(entry.desc), classificationOnly: true as const, revision: snapshot.versions[`allocations:${text(entry.id)}`]?.version ?? 0 })) },
  }
}

/** Preview delegates restrictions and conflicts to the domain without exposing unrelated view data. */
export function previewPlannerCatalog(snapshot: Snapshot, actor: Actor, environment: Environment, versionId: string, command: Command) {
  if (!plannerKeys(actor).includes(command.page) || !["FX rates", "Entities & allocations"].includes(command.page)) return undefined
  const before = plannerCatalogs(snapshot, actor, environment, versionId)
  if (!before || command.page === "FX rates" && command.values.versionId !== versionId) return undefined
  const copy = structuredClone(snapshot)
  const sequence = { value: 0 }
  const result = domain.execute(copy, actor, command, { ...environment, id: () => `catalog-preview-${sequence.value++}` })
  const after = result.ok ? plannerCatalogs(copy, actor, environment, versionId) : undefined
  return { before, ...(after ? { after } : {}), result: result.ok ? { ok: true as const, warnings: result.warnings ?? [] } : { ok: false as const, status: result.status, errors: result.errors ?? [] } }
}

/** Keep missing rates explicit while preserving the domain's numeric fallback. */
export function plannerCurrencyComposition(snapshot: Snapshot, actor: Actor, environment: Environment, versionId: string, amount: number, currency: string) {
  if (!Number.isFinite(amount) || !currency.trim()) return undefined
  const catalogs = plannerCatalogs(snapshot, actor, environment, versionId)
  if (!catalogs) return undefined
  const rate = currency.toUpperCase() === "USD" ? 1 : catalogs.fx.rates.find((entry) => entry.currency === currency)?.rate ?? null
  const result = usdAmount(amount, currency, rate)
  return { amount, currency, rate, usd: result.warning ? null : result.usd, legacyUsd: result.usd, missingRate: !!result.warning }
}
