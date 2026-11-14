// Selective setup copy from operations-consumers@15df31a67efab0aae6e2bff2b7eb8e5e59511324.
// Only real command/persistence setup is retained; monetary export assertions live here.
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { domain } from "../../../runtime/procurement.ts"
import { object, text } from "../../../runtime/contract.ts"
import type { Actor } from "../../../runtime/contract.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { initialProcurementSettings } from "../../../src/initial-settings.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { projectProcurementScope } from "../../../product/procurement/source-projection.ts"

export const buyer = { id: "buyer", roles: ["buyer"], canWrite: true }
export const holder = { id: "holder", roles: ["approver"], canWrite: true }
export const admin = { id: "settings-admin", roles: ["admin"], canWrite: true }
const at = "2026-11-14T12:00:00Z"
export const environment = { at, directory: [{ id: "holder", name: "Assigned holder" }], id: randomUUID }

/** Real domain commands and durable source lifecycle; no hand-built approval or future PO. */
export async function procurementExportFixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-procurement-exports-"))
  const store = await openLocalStore(directory)
  const persistence = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, projectScope: projectProcurementScope, createId: randomUUID })
  await persistence.initializeSources("procurement")
  const target = { id: "" }
  const execute = async (actor: Actor, action: string, values: Record<string, unknown> = {}, page = "Requests") => {
    const result = await persistence.transaction("procurement", async (snapshot) => {
      const key = page === "Settings" ? "settings" : `requests:${action === "create" ? "" : target.id}`
      const value = domain.execute(snapshot, actor, { page, action, id: action === "create" ? undefined : target.id, version: snapshot.versions[key]?.version ?? 0, values }, environment)
      return { commit: value.ok, value }
    })
    if (result.ok && page === "Requests" && action === "create") target.id = text(object(result.value).number)
    return result
  }
  const run = async (actor: Actor, action: string, values: Record<string, unknown> = {}, page = "Requests") => {
    const result = await execute(actor, action, values, page)
    if (!result.ok) throw new Error(`${page}/${action}: ${JSON.stringify(result)}`)
    return result
  }
  await run(admin, "reset", {}, "Settings")
  const initial = initialProcurementSettings()
  await run(admin, "save", { settings: { levels: initial.levels.map((level) => ({ ...level, holderId: "holder" })) } }, "Settings")
  const requester = { id: "requester", roles: ["requester"], canWrite: true }
  await run(requester, "create", { pr: { title: "Sourcing snapshot regression", type: "service", description: "A real sourcing decision", estAmount: 100, costCenter: "IT", needBy: "2026-12-01", justification: "Compare the same submitted record", recurring: false, expenseType: "OPEX" } })
  await run(requester, "submit_pr")
  await run(holder, "approve")
  await run(buyer, "save", { sourcing: {
    evaluator: "Technical evaluator", selectionJustification: "Recorded selection",
    quotes: [
      { id: "EUR-100", supplier: "European supplier", currency: "EUR", total: 100, qty: 1, unitPrice: 100, techPass: true, scores: [5, 5, 5, 5, 5], cscores: [null, 5, 5] },
      { id: "USD-150", supplier: "US supplier", currency: "USD", total: 150, qty: 1, unitPrice: 150, techPass: true, scores: [4, 4, 4, 4, 4], cscores: [null, 4, 4] },
      { id: "USD-180", supplier: "Third supplier", currency: "USD", total: 180, qty: 1, unitPrice: 180, techPass: true, scores: [3, 3, 3, 3, 3], cscores: [null, 3, 3] },
    ],
  } })
  await run(buyer, "select_quote", { quoteId: "EUR-100" })
  const material = () => persistence.transaction("procurement", async (snapshot) => ({
    commit: false,
    value: structuredClone(object(object(object(snapshot.data.store).requests)[target.id]).request),
  }))
  return {
    target, execute, run, material, persistence, requester,
    settings: (values: Record<string, unknown>) => run(admin, "save", { settings: values }, "Settings"),
    close: async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}
