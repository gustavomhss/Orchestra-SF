import type { CostCoverageEntry } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/decisions"
import type { BusinessEvidenceRef } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/business-context"
import type { DomainProjection } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/context"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/decisions"
import { waveFourDecisionsData } from "./wave-four-decisions-data"

type Installed = { actorId: string; request(pathname: string, init?: RequestInit): Promise<Response> }
type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
type Inventory = { title: string; rows: readonly { categoryId: string; id: string }[] }

export const finalMemoryPlans = {
  baseline: "Design test data · January itemized baseline",
  candidate: "Design test data · January itemized candidate",
} as const
const costNames: Record<(typeof RENEWAL_TRANSITION_CATEGORIES)[number], string> = {
  service: waveFourDecisionsData.plannerService,
  service_overlap: "Design test data · January parallel service",
  implementation: "Design test data · January implementation",
  contract_exit: "Design test data · January contract exit",
  migration: "Design test data · January migration",
  taxes: "Design test data · January taxes",
  training: "Design test data · January training",
  internal_costs: "Design test data · January internal costs",
  other_relevant_costs: "Design test data · January other recorded costs",
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Original Planner omitted a source object")
  return value as Record<string, unknown>
}
function list(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error("Original Planner omitted a source list")
  return value.map(object)
}
function text(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Original Planner omitted a source identity")
  return value
}

/**
 * Two additional plans in the isolated installation. The original Planner copies
 * the service plan and accepts one separately priced row for each remaining cost
 * category. No applicability assertion, missing-cost zero or coverage state is
 * fabricated. Existing uncertainty-bearing plans and cases are not edited.
 */
export async function createFinalMemoryInventory(installed: Installed, year: number): Promise<readonly Inventory[]> {
  const read = async (capability: "CAP18" | "CAP23", version?: string) => {
    const response = await installed.request("/api/ui/pages/" + capability + "?" + new URLSearchParams({
      year: String(year), ...(version ? { version } : {}),
    }))
    const body = object(await response.json())
    if (response.status !== 200 || body.status !== "ok") throw new Error("Original Planner inventory read failed: " + capability)
    return object(body.value)
  }
  const command = async (input: { page: "Versions" | "OPEX"; action: "copy" | "save"; id?: string; version: number; values: Record<string, unknown> }) => {
    console.info("SF_FINAL_MEMORY_STAGE planner-" + input.page + "-" + input.action)
    const response = await installed.request("/planner?" + new URLSearchParams({ page: input.page }), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    })
    const body = object(await response.json())
    if (response.status !== 200 || body.ok !== true) throw new Error("Original Planner inventory command failed: " +
      input.page + "/" + input.action + " HTTP " + response.status + " " + String(body.errors ?? body.status))
  }
  const plans: Inventory[] = []
  const origins = [waveFourDecisionsData.plannerBaseline, waveFourDecisionsData.plannerCandidate]
  const titles = [finalMemoryPlans.baseline, finalMemoryPlans.candidate]
  for (const [index, originalName] of origins.entries()) {
    const catalog = await read("CAP23")
    const source = list(object(catalog.data).versions).filter((entry) => entry.name === originalName)
    if (source.length !== 1 || !source[0]) throw new Error("Original Planner inventory source is ambiguous")
    const id = text(source[0].id)
    const revision = object(object(catalog.versions)["versions:" + id]).version
    if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0)
      throw new Error("Original Planner copy revision is unavailable")
    const title = titles[index]!
    await command({ page: "Versions", action: "copy", id, version: revision, values: { name: title } })
    const copied = list(object((await read("CAP23")).data).versions).filter((entry) => entry.name === title)
    if (copied.length !== 1 || !copied[0] || copied[0].closed !== 1)
      throw new Error("Original Planner did not reopen the closed-month copy")
    const versionId = text(copied[0].id)
    for (const [categoryIndex, categoryId] of RENEWAL_TRANSITION_CATEGORIES.entries()) {
      if (categoryId === "service") continue
      const amount = categoryIndex * 10 + index * 2
      await command({ page: "OPEX", action: "save", version: 0, values: {
        versionId, collection: "lines", name: costNames[categoryId], el: "licenses",
        desc: "Isolated January test inventory: " + categoryId,
        cur: "USD", owner: installed.actorId, annual: String(amount * 12),
        a: [amount, ...Array(11).fill(null)], f: [null, ...Array(11).fill(amount)],
      } })
    }
    const lines = list(object((await read("CAP18", versionId)).data).lines)
    const rows = RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => {
      const matches = lines.filter((entry) => entry.name === costNames[categoryId] && entry.synthetic !== true)
      if (matches.length !== 1 || !matches[0]) throw new Error("Original Planner omitted a unique inventory cost")
      return { categoryId, id: text(matches[0].id) }
    })
    if (lines.length !== rows.length) throw new Error("Original Planner inventory contains unclassified lines")
    plans.push({ title, rows })
  }
  return plans
}

/** Exact projection component IDs and current emitted evidence, accepted by the human coverage command. */
export function finalMemoryCoverage(inventory: Inventory, projection: DomainProjection, evidence: RecordEvidence): CostCoverageEntry[] {
  const entries: CostCoverageEntry[] = inventory.rows.map(({ categoryId, id }) => {
    const components = projection.components.filter((component) => component.id === id + ":1")
    if (components.length !== 1 || !components[0] || components[0].evidenceState !== "confirmed" ||
        typeof components[0].amount !== "number" || !Number.isFinite(components[0].amount))
      throw new Error("Original Planner inventory cost is not a confirmed January component")
    return { categoryId, status: "included", componentRefs: components.map((component) => component.id),
      evidenceRefs: [evidence], scopeNote: "This separately priced January component covers " + categoryId + " in the isolated inventory." }
  })
  if (projection.components.length !== entries.length || projection.missing.length)
    throw new Error("Original Planner inventory is incomplete")
  return entries
}
