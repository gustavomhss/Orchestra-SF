import { expect, test } from "bun:test"
import path from "node:path"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { createSfActionSource } from "../../../../../apps/cli/src/sucafina-product/native-ui/action-source.ts"
import { createSfLiveContext, sfContextDestinationsFromPages } from "../../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts"
import { createSfDomainProjectionHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/domain.ts"
import { createSfPeopleProjectionHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/people.ts"
import { createSfOperationsProjectionHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/operations.ts"
import { createSfPlannerProjectionHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/planner.ts"
import { createSfProcurementProjectionHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/procurement.ts"
import { contributions } from "../../index.ts"
import { openLocalStore } from "../../runtime/local-store.ts"
import { createSfSourcePersistence } from "../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../product/integration/source-projections.ts"
import { act, canApproveCurrentRequest } from "../../../porta/act.ts"

const binding = Object.freeze({ installationId: "installation", projectId: "project", hostId: "host" })
const stamp = Object.freeze({ ...binding, principalRef: "person", policyVersion: "policy", accessRevision: "revision" })

test("mapper ignores public claims and accepts only complete canonical private proofs", () => {
  const pages = [{ surface: "dashboard" as const, page: "Team Structure", allowedActionIds: ["deleteMember"] }]
  expect(sfContextDestinationsFromPages(pages)?.[0]?.allowedActionIds).toEqual([])
  expect(sfContextDestinationsFromPages(pages, [{ surface: "dashboard", page: "Team Structure", allowedActionIds: ["saveMember"] }])?.[0]?.allowedActionIds).toEqual(["saveMember"])
  expect(sfContextDestinationsFromPages(pages, [])).toBeUndefined()
  expect(sfContextDestinationsFromPages(pages, [{ surface: "dashboard", page: "Team Structure", allowedActionIds: ["invented"] }])).toBeUndefined()
  expect(sfContextDestinationsFromPages(pages, [{ surface: "dashboard", page: "Talent Review", allowedActionIds: [] }])).toBeUndefined()
})

test("current producer predicates grant actions and operation readiness only to the live actor", async () => {
  const dir = await mkdtemp(path.join(await realpath(tmpdir()), "sf-action-source-"))
  const driver = await openLocalStore(path.join(dir, "business"))
  const store = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources,
    createId: () => crypto.randomUUID(), projectScope: createSfSourceScopeProjector(() => new Date().toISOString()) })
  try {
    for (const surface of ["dashboard", "planner", "procurement"] as const) await store.initializeSources(surface)
    const original = new Request("http://localhost/sucafina/api/ui/context")
    let canWrite = true
    let actor = "person"
    const application = { persistence: store, domains: contributions,
      authenticate: async (request: Request, options: { surface: "dashboard" | "planner" | "procurement" }) => {
        expect(request).toBe(original)
        return { id: actor, canWrite, roles: [{ surface: options.surface, role: "admin" }] }
      }, environment: async (request: Request) => {
        expect(request).toBe(original)
        return { at: "2026-11-16T00:00:00Z", id: () => "id", directory: [{ id: "person", name: "Person" }] }
      } }
    const deps = { origin: "http://localhost", mount: "/sucafina", application, runtime: () => undefined,
      readContext: async () => { throw new Error("recursive context") } }
    const handlers = [...createSfDomainProjectionHandlers(deps as never), ...createSfPeopleProjectionHandlers(deps as never),
      ...createSfOperationsProjectionHandlers(deps as never), ...createSfPlannerProjectionHandlers(deps as never),
      ...createSfProcurementProjectionHandlers(deps as never)]
    const source = createSfActionSource(deps as never, handlers)
    const pages = [{ surface: "dashboard" as const, page: "Team Structure" }, { surface: "dashboard" as const, page: "IT Operations" },
      { surface: "planner" as const, page: "Versions" }, { surface: "procurement" as const, page: "Requests" }]
    const actions = await source.actions(original, stamp, pages)
    expect(actions.find((item) => item.page === "Team Structure")?.allowedActionIds).toContain("saveMember")
    expect(actions.find((item) => item.page === "IT Operations")?.allowedActionIds).toContain("save-tickets")
    expect(actions.find((item) => item.page === "Versions")?.allowedActionIds).toContain("copy")
    expect(actions.find((item) => item.page === "Requests")?.allowedActionIds).toContain("create")
    const operations = await source.operational(original, stamp)
    expect(operations.map((item) => item.operationId)).toContain("domain.command.CAP07.saveMember")
    expect(operations.map((item) => item.operationId)).toContain("domain.command.CAP11.save-tickets")
    canWrite = false
    expect((await source.actions(original, stamp, pages)).every((item) => item.allowedActionIds.length === 0)).toBe(true)
    expect(await source.operational(original, stamp)).toEqual([])
    actor = "other"
    await expect(source.actions(original, stamp, pages)).rejects.toThrow("SF_ACTION_AUTHORITY_UNAVAILABLE")
  } finally { await driver.dispose(); await rm(dir, { recursive: true, force: true }) }
})

test("changed action proofs or policy fail the outer context fence", async () => {
  const original = new Request("http://localhost/sucafina/api/ui/context?installationId=installation&projectId=project&hostId=host")
  const pages = [{ surface: "dashboard" as const, page: "Team Structure" }]
  let reads = 0
  let changed = false
  const live = createSfLiveContext({ origin: "http://localhost", mount: "/sucafina", currentBinding: () => binding,
    admit: async (request) => {
      expect(request).toBe(original)
      reads++
      const destinations = sfContextDestinationsFromPages(pages, [{ ...pages[0]!, allowedActionIds: changed && reads > 1 ? [] : ["saveMember"] }])!
      return { status: "ok", stamp, authMode: "local-operator", destinations }
    } })
  expect((await live.readContext(original, binding)).status).toBe("ok")
  reads = 0
  changed = true
  expect(await live.readContext(original, binding)).toEqual({ status: "unavailable", reason: "contract-mismatch" })
})

test("approval health uses the original holder and self-approval predicate", () => {
  const settings = { currency: "USD", levels: [{ id: "L1", name: "Level", threshold: 0, holderId: "approver" }],
    prApprovalMode: "first", blockSelfApproval: true, fxRates: [{ code: "USD", rate: 1 }] }
  const request = { number: "PR-2026-0001", status: "pr_pending", createdBy: "owner",
    pr: { estAmount: 100, recurring: false, expenseType: "OPEX" },
    prApproval: { amount: 100, fxRate: 1, steps: [{ levelId: "L1", levelName: "Level", threshold: 0, holderId: "approver", status: "pending" }] },
    sourcing: null, po: null, history: [] }
  const actor = { id: "approver", canWrite: true, roles: ["approver"] }
  expect(canApproveCurrentRequest(request, actor, settings)).toBe(true)
  expect(act(request, { type: "approve" }, actor, settings, "2026-11-16T00:00:00Z", { pr: [], po: [] }, null).ok).toBe(true)
  expect(canApproveCurrentRequest(request, { ...actor, id: "other" }, settings)).toBe(false)
  expect(canApproveCurrentRequest({ ...request, createdBy: "approver" }, actor, settings)).toBe(false)
  expect(canApproveCurrentRequest(request, { ...actor, canWrite: false }, settings)).toBe(false)
})
