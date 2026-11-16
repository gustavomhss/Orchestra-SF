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
import { plannerCurrentPageActions, plannerWorkbookImportAvailable } from "../../runtime/planner.ts"
import { budgetCanEditAnyLine } from "../../runtime/dashboard-budget.ts"
import { procurementCurrentRequestActions } from "../../runtime/procurement.ts"
import { plannerField } from "../../src/planner-role.ts"

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

test("Planner and budget page capabilities respect original source ownership and roles", () => {
  const snapshot = { data: { versions: [{ id: "v1", year: 2026, locked: false,
    lines: [{ id: "line", sec: "opex", owner: { id: "owner" }, domain: "service" }] }], officials: {},
    opexOwners: [{ id: "team" }], budgetLineIds: { owner: ["opexOwners:team"] } },
    versions: {}, sequences: {}, audit: [], notices: [] }
  const owner = { id: "owner", canWrite: true, roles: ["budget owner"], domains: [] }
  const other = { id: "other", canWrite: true, roles: ["budget owner"], domains: [] }
  expect(plannerCurrentPageActions(snapshot, owner, "OPEX")).toContain("save")
  expect(plannerCurrentPageActions(snapshot, other, "OPEX")).toEqual([])
  expect(plannerCurrentPageActions(snapshot, { ...owner, canWrite: false }, "OPEX")).toEqual([])
  expect(budgetCanEditAnyLine(snapshot, { ...owner, roles: ["domain leader"] }, "opexOwners")).toBe(true)
  expect(budgetCanEditAnyLine(snapshot, { ...other, roles: ["domain leader"] }, "opexOwners")).toBe(false)
})

test("OPEX save observes closed-month and synthetic HR modes without mutating the source", () => {
  const version = { id: "v1", year: 2026, locked: true, lines: [],
    hc: { positions: [], hrAF: { service: { ownerId: "assigned", domain: "ignored", synthetic: false } } } }
  const snapshot = { data: { versions: [version], officials: { "2026": "v1" } },
    versions: {}, sequences: {}, audit: [], notices: [] }
  const before = structuredClone(snapshot)
  const finance = { id: "finance", canWrite: true, roles: ["finance"] }
  const empty = { ...snapshot, data: { ...snapshot.data, versions: [{ ...version, hc: { positions: [], hrAF: {} } }] } }
  expect(plannerField("closedThrough", version, "v1", finance)).toBe(true)
  expect(plannerCurrentPageActions(empty, finance, "OPEX")).toContain("save")
  expect(plannerCurrentPageActions(empty, finance, "CAPEX")).toEqual([])
  expect(plannerCurrentPageActions(empty, { ...finance, canWrite: false }, "OPEX")).toEqual([])

  const owner = { id: "person", canWrite: true, roles: ["budget owner"], domains: ["service"] }
  const target = { ownerId: version.hc.hrAF.service.ownerId, domain: "service", hr: true }
  expect(plannerField("forecast", version, "v1", owner, target)).toBe(true)
  expect(plannerField("actual", version, "v1", owner, target)).toBe(false)
  expect(plannerCurrentPageActions(snapshot, owner, "OPEX")).toContain("save")
  expect(plannerCurrentPageActions(snapshot, { ...owner, canWrite: false }, "OPEX")).toEqual([])
  expect(plannerField("forecast", version, "v1", { ...owner, domains: ["foreign"] }, target)).toBe(false)
  expect(plannerCurrentPageActions(snapshot, { ...owner, domains: [] }, "OPEX")).toEqual([])
  expect(plannerCurrentPageActions(snapshot, { ...owner, id: "assigned", domains: [] }, "OPEX")).toContain("save")

  // Execute also permits creating an HR row for an assigned domain not yet in the source.
  expect(plannerCurrentPageActions(snapshot, { ...owner, domains: ["foreign"] }, "OPEX")).toContain("save")
  const positionOnly = { ...snapshot, data: { ...snapshot.data, versions: [{ ...version,
    hc: { positions: [{ domain: "service" }], hrAF: {} } }] } }
  expect(plannerCurrentPageActions(positionOnly, owner, "OPEX")).toContain("save")
  expect(snapshot).toEqual(before)
})

test("Planner workbook availability follows original fields, importable targets and roster authority", () => {
  const actor = { id: "owner", canWrite: true, roles: ["budget owner"], domains: [] as string[] }
  const snapshot = { data: { versions: [{ id: "v1", year: 2026, locked: true,
    lines: [{ id: "line", sec: "opex", el: "lic", owner: { id: "owner" } }] }], officials: { "2026": "v1" } },
    versions: {}, sequences: {}, audit: [], notices: [] }
  expect(plannerWorkbookImportAvailable(snapshot, actor)).toBe(true)
  expect(plannerWorkbookImportAvailable(snapshot, { ...actor, id: "other" })).toBe(false)
  expect(plannerWorkbookImportAvailable(snapshot, { ...actor, canWrite: false })).toBe(false)
  expect(plannerWorkbookImportAvailable(snapshot, { ...actor, roles: ["finance"] })).toBe(true)
  expect(plannerWorkbookImportAvailable(snapshot, { ...actor, roles: ["hr"] })).toBe(true) // roster remains writable
  expect(plannerWorkbookImportAvailable(snapshot, { ...actor, roles: ["admin"] })).toBe(true) // newVersion
  const noLines = { ...snapshot, data: { ...snapshot.data, versions: [{ ...snapshot.data.versions[0]!, lines: [] }] } }
  expect(plannerWorkbookImportAvailable(noLines, actor)).toBe(false)
  expect(plannerWorkbookImportAvailable(noLines, { ...actor, domains: ["  "] })).toBe(true)
  const unreachable = { ...snapshot, data: { ...snapshot.data, versions: [{ ...snapshot.data.versions[0]!, lines: [
    { id: "line", sec: "other", owner: { id: "owner" } }, { id: "capex", sec: "capex", owner: { id: "owner" } },
  ] }] } }
  expect(plannerWorkbookImportAvailable(unreachable, actor)).toBe(false)
  expect(plannerWorkbookImportAvailable({ ...snapshot, data: { ...snapshot.data, versions: [] } }, { ...actor, roles: ["admin"] })).toBe(false)
})

test("request action health cannot use another owner's draft", () => {
  const snapshot = { data: { store: { requests: {
    own: { request: { createdBy: "person", status: "draft" } },
    other: { request: { createdBy: "someone-else", status: "draft" } },
  }, settings: {} } }, versions: {}, sequences: {}, audit: [], notices: [] }
  const actor = { id: "person", canWrite: true, roles: ["requester"] }
  expect(procurementCurrentRequestActions(snapshot, actor)).toContain("save")
  expect(procurementCurrentRequestActions(snapshot, actor)).toContain("delete")
  delete (snapshot.data.store.requests as { own?: unknown }).own
  expect(procurementCurrentRequestActions(snapshot, actor)).toEqual([])
  expect(procurementCurrentRequestActions(snapshot, { ...actor, canWrite: false })).toEqual([])
})

test("request action source reaches eligible owner and approval records beyond 100 entries", () => {
  const actor = { id: "person", canWrite: true, roles: ["requester", "approver"] }
  const settings = { currency: "USD", levels: [{ id: "L1", name: "Level", threshold: 0, holderId: "person" }],
    prApprovalMode: "first", blockSelfApproval: true, fxRates: [{ code: "USD", rate: 1 }] }
  const own = { request: { number: "own", status: "draft", createdBy: "person" } }
  const approval = { request: { number: "pending", status: "pr_pending", createdBy: "other",
    pr: { estAmount: 100, recurring: false, expenseType: "OPEX" },
    prApproval: { amount: 100, fxRate: 1, steps: [{ levelId: "L1", levelName: "Level", threshold: 0, holderId: "person", status: "pending" }] },
    sourcing: null, po: null, history: [] } }
  const earlier = Array.from({ length: 150 }, (_, index) => [`irrelevant-${index}`, { request: { createdBy: "other", status: "po_issued" } }] as const)
  const make = (entries: readonly (readonly [string, unknown])[]) => ({ data: { store: { requests: Object.fromEntries(entries), settings } },
    versions: {}, sequences: {}, audit: [], notices: [] })
  for (const entries of [[...earlier, ["own", own], ["approval", approval]], [["approval", approval], ["own", own], ...earlier]] as const) {
    const actions = procurementCurrentRequestActions(make(entries), actor)
    expect(actions).toContain("save")
    expect(actions).toContain("delete")
    expect(actions).toContain("approve")
    expect(actions).toContain("reject")
  }
})
