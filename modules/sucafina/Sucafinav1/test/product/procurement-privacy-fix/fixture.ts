import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { emptyMap, resolve } from "../../../src/identity.ts"
import { createApplication } from "../../../runtime/application.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { domain, pages, render } from "../../../runtime/procurement.ts"
import { object, rows } from "../../../runtime/contract.ts"
import type { Command, Snapshot } from "../../../runtime/contract.ts"
import type { AssetServices } from "../../../runtime/assets.ts"

export const validPR = (title = "Synthetic privacy purchase73") => ({
  title, type: "service", description: "Synthetic procurement privacy fixture", estAmount: 100,
  costCenter: "IT", needBy: "2026-12-01", justification: "Exercise authorized command boundaries",
  recurring: false, expenseType: "OPEX",
})
export const requestData = (snapshot: Snapshot, id: string) => object(object(object(object(snapshot.data.store).requests)[id]).request)
export const requestVersion = (snapshot: Snapshot, id: string) => snapshot.versions[`requests:${id}`]?.version ?? 0

/** Synthetic group membership and records; real identity resolver, HTTP commands and SQLite persistence. */
export async function createPrivacyFixture(input: { directory?: string } = {}) {
  const directory = input.directory ?? await mkdtemp(join(await realpath(tmpdir()), "sf-procurement-privacy73-"))
  if (!input.directory) await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const roles: Record<string, string[]> = {
    alice: ["requester"], bob: ["requester"], buyer: ["buyer"], holder: ["approver"],
    other: ["approver"], admin: ["admin"], self: ["requester", "approver"],
    supplierAdmin: ["supplier admin"], viewer: ["viewer"],
  }
  const snapshot = () => store.transaction("procurement", async (current) => ({ commit: false, value: structuredClone(current) }))
  const handlerFor = (services?: AssetServices) => createApplication("/sf", {
    persistence: store,
    ...(services ? { assets: { persistence: store, services } } : {}),
    authenticate: async (request, context) => {
      const id = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? ""
      const membership = Object.hasOwn(roles, id) ? roles[id] : undefined
      if (!context || !membership) return null
      return resolve(id, [...context.roleMap], (group) => membership.some((role) => group === `synthetic73:${role}`))
    },
    environment: async () => ({
      at: "2026-11-15T12:00:00Z", id: randomUUID,
      directory: Object.keys(roles).map((id) => ({ id, name: `Synthetic ${id}73` })),
    }),
    maxJsonBytes: 1024 * 1024,
    domains: { dashboard: [], planner: [], procurement: [{ domain, pages, render }] },
  })
  const handler = handlerFor()
  const post = async (principal: string, command: Command): Promise<Response> => {
    const response = await handler(new Request("https://privacy.invalid/sf/procurement", {
      method: "POST", headers: { authorization: `Bearer ${principal}`, origin: "https://privacy.invalid", "content-type": "application/json" },
      body: JSON.stringify(command),
    }))
    if (!response) throw new Error("Canonical Procurement HTTP endpoint unavailable")
    return response
  }
  const requireSuccess = async (response: Response) => {
    if (response.status !== 200) throw new Error(`Synthetic setup failed: ${response.status} ${await response.text()}`)
  }
  const configureHolder = async (holderId: string | null) => {
    const current = await snapshot()
    const levels = rows(object(object(current.data.store).settings).levels).map((level) => ({ ...level, holderId }))
    await requireSuccess(await post("admin", { page: "Settings", action: "save", version: current.versions.settings?.version ?? 0, values: { levels } }))
  }
  const create = async (principal: string, title?: string): Promise<string> => {
    const before = object(object((await snapshot()).data.store).requests)
    await requireSuccess(await post(principal, { page: "Requests", action: "create", version: 0, values: { pr: validPR(title) } }))
    const after = object(object((await snapshot()).data.store).requests)
    const added = Object.keys(after).filter((id) => !Object.hasOwn(before, id))
    if (added.length !== 1) throw new Error("Canonical create did not allocate exactly one request")
    return added[0]!
  }
  try {
    if (!input.directory) {
      // Bootstrap only the synthetic installation's directory group mapping, never business state.
      await store.transaction("procurement", async (current) => {
        current.data.roleMap = emptyMap().filter((row) => row.surface === "procurement")
          .map((row) => ({ ...row, entra: `synthetic73:${row.role}` }))
        return { commit: true, value: undefined }
      })
      await requireSuccess(await post("admin", { page: "Settings", action: "reset", version: 0, values: {} }))
      // Keep canonical thresholds, stages, mode, currencies and self-approval default intact.
      await configureHolder("holder")
    }
  } catch (error) {
    await store.dispose()
    if (!input.directory) await rm(directory, { recursive: true, force: true })
    throw error
  }
  return {
    directory, store, roles, post, snapshot, create, handlerFor, configureHolder,
    close: () => store.dispose(),
    dispose: async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}
