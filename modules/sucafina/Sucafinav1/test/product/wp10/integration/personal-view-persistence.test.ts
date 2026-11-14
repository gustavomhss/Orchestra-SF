import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfPersonalViews } from "../../../../product/interface/personal-views.ts"
import type { SfPersonalView } from "../../../../product/interface/personal-views.ts"
import type { TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import { createSfPersonalViewAuthority } from "../../../../../../../apps/cli/src/sucafina-product/personal-view-authority.ts"

const origin = "https://example.test"

// The authenticator represents a test identity. Persistence, C08 admission, domain
// projections and saved-view authorization are the actual composed implementations.
async function openViews(directory: string, active: { value: boolean }) {
  const driver = await openLocalStore(path.join(directory, "store"))
  const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID,
    projectScope: createSfSourceScopeProjector(() => "2026-11-14T00:00:00Z") })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  const authority = createSfProductAuthority({ installationId: "saved-view-installation", origin, policyVersion: "policy",
    identity: () => ({ installationId: "saved-view-installation", hostId: "host", projectId: "project",
      location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }),
    persistence, grants: [{ principalRef: "person", namespaces: ["preferences"], operations: ["sf_dashboard_read"],
      humanActions: ["views.read", "views.save", "views.remove"] }],
    authenticate: async (_request, scope) => active.value && scope
      ? { id: "person", canWrite: true, roles: [{ surface: scope.surface, role: "admin" }] } : null,
    environment: async () => ({ at: "2026-11-14T00:00:00Z", id: randomUUID, directory: [{ id: "owner", name: "Owner" }] }),
    createId: randomUUID, now: Date.now, commandIdentity: async (request) => request.headers.get("Idempotency-Key") ?? undefined,
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
    providerGeneration: async () => undefined, authorizeDocument: async () => undefined })
  const views = createSfPersonalViews({ host: authority.host, state: authority.state, creationTarget: authority.creationTarget,
    operationIdentity: (call) => call.kind === "ui" ? authority.ui.operationIdentity(call) : undefined,
    humanAuthorize: (call, action, payload) => authority.human.authorize(call, action, payload),
    authorizeView: createSfPersonalViewAuthority({ authority }) })
  const admitted = async <T>(action: "views.read" | "views.save", payload: unknown, work: (call: TrustedUiContext) => Promise<T>) => {
    const request = new Request(`${origin}/sucafina/dashboard`, { method: "POST", headers: { origin, "Idempotency-Key": randomUUID() } })
    const result = await authority.human.admit(request, action, payload)
    if (result.status !== "ok") throw new Error(`Saved-view admission failed: ${result.reason}`)
    try { return await work(result.value) } finally { authority.human.finish(result.value) }
  }
  return { driver, persistence, authority, views, admitted }
}

test("saved Planner and Procurement views survive a new store and authority, then reauthorize their actual destinations", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-saved-view-persistence-"))
  const active = { value: true }
  const opened: Awaited<ReturnType<typeof openViews>>[] = []
  const planner: SfPersonalView = { id: "saved-planner", title: "Operating plan by owner", surface: "planner", page: "OPEX",
    period: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", density: "compact",
    filters: { query: "Licenses", selections: { year: "2027", version: "forecast-persisted", owner: "owner", class: "opex", mode: "compare" } } }
  const procurement: SfPersonalView = { id: "saved-suppliers", title: "Pending selected supplier", surface: "procurement", page: "Suppliers",
    density: "comfortable", filters: { query: "Coffee", selections: { year: "2027", status: "pending", supplier: "supplier-persisted" } } }
  try {
    const first = await openViews(directory, active)
    opened.push(first)
    await first.persistence.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [{ id: "forecast-persisted", name: "Operating plan", year: 2027, closed: 0,
        lines: [], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
      return { commit: true, value: undefined }
    })
    await first.persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { settings: { currency: "USD", fxRates: [] }, requests: {},
        suppliers: [{ id: "supplier-persisted", legalName: "Coffee supplier", status: "pending" }] }
      return { commit: true, value: undefined }
    })
    for (const view of [planner, procurement]) {
      const payload = { view, expectedVersion: null }
      expect(await first.admitted("views.save", payload, (call) => first.views.save(payload, call))).toEqual({ status: "ok", value: { view, version: 1 } })
    }
    await first.driver.dispose()
    opened.pop()

    const reopened = await openViews(directory, active)
    opened.push(reopened)
    expect(reopened.authority).not.toBe(first.authority)
    expect(reopened.driver).not.toBe(first.driver)
    for (const view of [planner, procurement]) {
      const payload = { id: view.id }
      expect(await reopened.admitted("views.read", payload, (call) => reopened.views.open(payload, call))).toEqual({ status: "ok", value: { view, version: 1 } })
    }
    const listed = await reopened.admitted("views.read", {}, (call) => reopened.views.list(call))
    expect(listed.status).toBe("ok")
    if (listed.status !== "ok") throw new Error(listed.reason)
    expect(listed.value.map((entry) => entry.view.id).toSorted()).toEqual([planner.id, procurement.id].toSorted())

    // A saved URL is not authority to reopen a removed destination.
    await reopened.persistence.transaction("planner", async (snapshot) => {
      snapshot.data.versions = []
      return { commit: true, value: undefined }
    })
    expect(await reopened.admitted("views.read", { id: planner.id }, (call) => reopened.views.open({ id: planner.id }, call)))
      .toEqual({ status: "unavailable", reason: "view-unavailable" })
    expect(await reopened.admitted("views.read", {}, (call) => reopened.views.list(call)))
      .toEqual({ status: "ok", value: [{ view: procurement, version: 1 }] })

    await reopened.admitted("views.read", { id: procurement.id }, async (call) => {
      active.value = false
      expect(await reopened.views.open({ id: procurement.id }, call)).toEqual({ status: "denied", reason: "view-access-unavailable" })
    })
  } finally {
    for (const host of opened) await host.driver.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}, 60_000)
