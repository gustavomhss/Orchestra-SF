// AJ-PROC-UNSEEN-DECIDE. Hidden approve/reject must fail before conflict.
// Fixture amounts stay under the frozen L2 threshold, so one blank step is the whole porta route.
import { expect, test } from "bun:test"
import { createModule } from "../index.ts"
import { object, rows } from "../runtime/contract.ts"
import type { Actor, Environment, Snapshot } from "../runtime/contract.ts"
import { domain } from "../runtime/procurement.ts"
import type { ResolvedActor } from "../src/identity.ts"
import { testPersistence } from "./fixture/persistence.ts"

const AT = "2026-11-12T12:00:00Z"
const ORIGIN = "https://installation.example"
const TITLE = "HIDDEN-PR-TITLE-SENTINEL"
const BODY = "HIDDEN-BODY-SENTINEL"
const WHY = "HIDDEN-JUSTIFICATION-SENTINEL"
const ADA = "directory-ada"
const BEA = "directory-bea"
const CARA = "directory-cara"
const BUYER = "directory-buyer"
const APPROVER = "directory-approver"
const SUPPLIER_ADMIN = "directory-supplier-admin"
const ADMIN = "directory-admin"
const HOLDER = "directory-holder"
const VIEWER = "directory-viewer"
const DIRECTORY = [
  [ADA, "Ada Requester"],
  [BEA, "Bea Requester"],
  [CARA, "Cara Requester"],
  [BUYER, "Buyer Person"],
  [APPROVER, "Approver Person"],
  [SUPPLIER_ADMIN, "Supplier Admin Person"],
  [ADMIN, "Admin Person"],
  [HOLDER, "Holder Person"],
  [VIEWER, "Viewer Person"],
].map(([id, name]) => ({ id, name }))
const environment: Environment = { at: AT, id: () => "server-id", directory: DIRECTORY }
const stages = ["pr_pending", "src_pending", "po_pending"] as const
const openRoles = ["buyer", "approver", "supplier admin", "admin", "viewer"] as const
const forbidden = ["save", "cancel", "delete", "submit_sourcing", "select_quote", "submit_po", "issue"] as const
const portaStatus = {
  approve: { pr_pending: "sourcing", src_pending: "po_draft", po_pending: "po_approved" },
  reject: { pr_pending: "pr_rejected", src_pending: "src_rejected", po_pending: "po_rejected" },
} as const
const pr = {
  title: TITLE,
  type: "product",
  description: BODY,
  estAmount: 100,
  costCenter: "IT",
  needBy: "2026-12-01",
  justification: WHY,
  recurring: false,
  expenseType: "OPEX",
}
const sourcing = {
  quotes: [
    {
      id: "q1",
      supplier: "Vendor",
      supplierId: null,
      currency: "USD",
      total: 500,
      qty: 1,
      unitPrice: 500,
      techPass: true,
      scores: [5],
      cscores: [],
    },
  ],
  evaluator: "Engineer",
  selectedId: "q1",
  fewQuotesJustification: "Sole source",
  selectionJustification: "Best",
  contractStrategy: "new",
  weights: {
    tech: 60,
    comm: 40,
    criteria: [{ weight: 1 }],
    commCriteria: [{ weight: 1, auto: true }],
  },
}
const po = {
  description: "Consulting deliverable",
  paymentTerms: "Net 30",
  deliveryDate: "2026-12-20",
  deliveryConditions: "Remote",
  contractRef: "C-1",
  assetRef: "Text reference",
  lines: [{ description: "Milestone", qty: 1, unitPrice: 500 }],
  expenseType: "OPEX",
}

type Stage = (typeof stages)[number]

function actor(id: string, roles: string[], canWrite = true): Actor {
  return { id, canWrite, roles }
}
function principal(id: string, roles: string[], canWrite = true): ResolvedActor {
  return { id, canWrite, roles: roles.map((role) => ({ surface: "procurement", role })) }
}
function installation() {
  const storage = testPersistence()
  const session: { principal: ResolvedActor | null } = { principal: principal(ADMIN, ["admin"]) }
  const ids = { next: 0 }
  const handler = createModule("/sucafina", {
    authenticate: async () => session.principal,
    persistence: storage.persistence,
    environment: async () => ({
      at: AT,
      id: () => `server-${++ids.next}`,
      directory: DIRECTORY.map((person) => ({ ...person })),
    }),
    maxJsonBytes: 1000000,
    presentation: "native",
  })
  const send = (who: ResolvedActor, body: Record<string, unknown>) => {
    session.principal = who
    return handler(
      new Request(`${ORIGIN}/sucafina/procurement`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: ORIGIN },
        body: JSON.stringify(body),
      }),
    )
  }
  const post = (
    who: ResolvedActor,
    page: string,
    action: string,
    version: number,
    values: Record<string, unknown>,
    id?: string,
  ) => send(who, { page, action, id, version, values })
  const read = (who: ResolvedActor, page = "Requests") => {
    session.principal = who
    return handler(new Request(`${ORIGIN}/sucafina/procurement?page=${encodeURIComponent(page)}`))
  }
  return { state: storage.state, post, send, read }
}
function requestIds(snapshot: Snapshot) {
  return Object.keys(object(object(snapshot.data.store).requests))
}
function storedRequest(snapshot: Snapshot, id: string) {
  return object(object(object(object(snapshot.data.store).requests)[id]).request)
}
function rowVersion(snapshot: Snapshot, id: string) {
  return snapshot.versions[`requests:${id}`]?.version ?? 0
}
function approvalOf(request: Record<string, unknown>) {
  if (request.status === "src_pending") return object(request.sourcing).approval
  if (request.status === "po_pending") return object(request.po).approval
  return request.prApproval
}
function pendingHolder(request: Record<string, unknown>) {
  const step = rows(object(approvalOf(request)).steps).find((item) => item.status === "pending")
  return step ? step.holderId : undefined
}
function presence(data: Record<string, unknown>, versions: object, id: string) {
  return {
    row: rows(data.requests).some((request) => request.number === id),
    version: Object.hasOwn(versions, `requests:${id}`),
  }
}
function expectUntouched(actual: Snapshot, before: Snapshot) {
  expect(actual.data).toEqual(before.data)
  expect(actual.versions).toEqual(before.versions)
  expect(actual.sequences).toEqual(before.sequences)
  expect(actual.audit).toEqual(before.audit)
  expect(actual.notices).toEqual(before.notices)
}
function expectNoLeak(raw: string, value: unknown, writer: string) {
  expect(raw).not.toContain(writer)
  expect(raw).not.toContain(ADA)
  expect(raw).not.toContain(TITLE)
  expect(raw).not.toContain(BODY)
  expect(raw).not.toContain(WHY)
  expect(raw.includes(`"by":"`)).toBe(false)
  const body = object(value)
  expect(typeof body.by).not.toBe("string")
  const stored = body.stored
  expect(stored === undefined || stored === null || typeof stored !== "object").toBe(true)
}
function commandValues(action: string): Record<string, unknown> {
  if (action === "approve") return { comment: "Noted", roles: ["admin"] }
  if (action === "reject") return { reason: "no", roles: ["buyer"] }
  if (action === "cancel") return { reason: "Stop" }
  if (action === "select_quote") return { quoteId: "q1" }
  if (action === "save") return { pr: { title: "HIDDEN-MUTATION" } }
  if (action === "submit_po") return { po: { description: "HIDDEN-MUTATION" } }
  return {}
}
async function responseText(response: Response | undefined) {
  if (!response) throw new Error("procurement application returned no response")
  const raw = await response.text()
  return { response, raw }
}
async function must(
  app: ReturnType<typeof installation>,
  who: ResolvedActor,
  page: string,
  action: string,
  values: Record<string, unknown>,
  id?: string,
) {
  const version =
    page === "Settings" ? (app.state.procurement.versions.settings?.version ?? 0) : id ? rowVersion(app.state.procurement, id) : 0
  const { response, raw } = await responseText(await app.post(who, page, action, version, values, id))
  expect(response.status, raw).toBe(200)
}
async function createPr(app: ReturnType<typeof installation>, who: ResolvedActor) {
  const before = new Set(requestIds(app.state.procurement))
  await must(app, who, "Requests", "create", { pr })
  const id = requestIds(app.state.procurement).find((item) => !before.has(item))
  if (!id) throw new Error("create did not persist a request")
  return id
}
async function pending(stage: Stage) {
  const app = installation()
  const ada = principal(ADA, ["requester"])
  const buyer = principal(BUYER, ["buyer"])
  await must(app, principal(ADMIN, ["admin"]), "Settings", "reset", {})
  const id = await createPr(app, ada)
  await must(app, ada, "Requests", "submit_pr", { pr }, id)
  if (stage !== "pr_pending") {
    await must(app, ada, "Requests", "approve", { comment: "Noted" }, id)
    await must(app, buyer, "Requests", "save", { sourcing }, id)
    await must(app, buyer, "Requests", "select_quote", { quoteId: "q1" }, id)
    await must(app, buyer, "Requests", "submit_sourcing", { sourcing }, id)
  }
  if (stage === "po_pending") {
    await must(app, ada, "Requests", "approve", { comment: "Noted" }, id)
    await must(app, buyer, "Requests", "save", { po }, id)
    await must(app, buyer, "Requests", "submit_po", { po }, id)
  }
  const request = storedRequest(app.state.procurement, id)
  const settings = object(object(app.state.procurement.data.store).settings)
  expect(request.status).toBe(stage)
  expect(request.createdBy).toBe(ADA)
  expect(pendingHolder(request)).toBeNull()
  expect(settings.blockSelfApproval).toBe(false)
  expect(rows(settings.levels).every((level) => level.holderId == null)).toBe(true)
  return { app, id }
}
async function decide(
  app: ReturnType<typeof installation>,
  before: Snapshot,
  who: ResolvedActor,
  whoActor: Actor,
  page: string,
  action: string,
  version: number,
  values: Record<string, unknown>,
  id: string,
  status: 403 | 409,
) {
  const writer = before.versions[`requests:${id}`]?.by
  if (!writer) throw new Error("version writer missing")
  app.state.procurement = structuredClone(before)
  const domainState = structuredClone(before)
  const domainResult = domain.execute(
    domainState,
    whoActor,
    { page, action, id, version, values },
    environment,
  )
  const domainRaw = JSON.stringify(domainResult)
  expect(domainResult).toMatchObject({ ok: false, status })
  expectNoLeak(domainRaw, domainResult, writer)
  expectUntouched(domainState, before)
  app.state.procurement = structuredClone(before)
  const http = await responseText(await app.post(who, page, action, version, values, id))
  const parsed = object(JSON.parse(http.raw))
  expect(http.response.status).toBe(status)
  expect(parsed).toMatchObject({ ok: false, status })
  expectNoLeak(http.raw, parsed, writer)
  expectUntouched(app.state.procurement, before)
  return { domain: domainRaw, http: http.raw }
}
async function commits(
  app: ReturnType<typeof installation>,
  who: ResolvedActor,
  whoActor: Actor,
  action: string,
  values: Record<string, unknown>,
  id: string,
  status: string,
) {
  const before = structuredClone(app.state.procurement)
  const version = rowVersion(before, id)
  const domainState = structuredClone(before)
  const domainResult = domain.execute(
    domainState,
    whoActor,
    { page: "Requests", action, id, version, values },
    environment,
  )
  expect(domainResult.ok).toBe(true)
  expect(storedRequest(domainState, id).status).toBe(status)
  expect(rowVersion(domainState, id)).toBe(version + 1)
  expect(domainState.audit.length).toBeGreaterThan(before.audit.length)
  const http = await responseText(await app.post(who, "Requests", action, version, values, id))
  expect(http.response.status, http.raw).toBe(200)
  expect(object(JSON.parse(http.raw)).ok).toBe(true)
  expect(storedRequest(app.state.procurement, id).status).toBe(status)
  expect(rowVersion(app.state.procurement, id)).toBe(version + 1)
  expect(app.state.procurement.audit.length).toBeGreaterThan(before.audit.length)
}

const ada = principal(ADA, ["requester"])
const bea = principal(BEA, ["requester"])
const admin = principal(ADMIN, ["admin"])
const personId = {
  buyer: BUYER,
  approver: APPROVER,
  "supplier admin": SUPPLIER_ADMIN,
  admin: ADMIN,
  viewer: VIEWER,
} as const

test(
  "hidden requester approve and reject on another person's pending PR, sourcing, and PO return the same 403 for the live and stale version without writing or leaking",
  async () => {
    for (const stage of stages) {
      const fixture = await pending(stage)
      const before = structuredClone(fixture.app.state.procurement)
      const id = fixture.id
      const view = domain.view(before, actor(BEA, ["requester"]), environment)
      expect(presence(view.data, view.versions, id)).toEqual({ row: false, version: false })
      const seen = await responseText(await fixture.app.read(bea))
      expect(seen.response.status).toBe(200)
      const page = object(JSON.parse(seen.raw))
      expect(presence(object(page.data), object(page.versions), id)).toEqual({ row: false, version: false })
      expect(seen.raw).not.toContain(TITLE)
      expect(seen.raw).not.toContain(`"requests:${id}"`)
      const version = rowVersion(before, id)
      for (const pageName of ["Requests", "My approvals"]) {
        for (const action of ["approve", "reject"] as const) {
          const values = commandValues(action)
          const live = await decide(fixture.app, before, bea, actor(BEA, ["requester"]), pageName, action, version, values, id, 403)
          const stale = await decide(
            fixture.app,
            before,
            bea,
            actor(BEA, ["requester"]),
            pageName,
            action,
            version - 1,
            values,
            id,
            403,
          )
          const guessed = await decide(fixture.app, before, bea, actor(BEA, ["requester"]), pageName, action, 999, values, id, 403)
          expect(stale).toEqual(live)
          expect(guessed).toEqual(live)
        }
      }
    }
  },
  30_000,
)

test(
  "hidden save, cancel, delete, and other forbidden actions that conflict omit the writer and the stored request",
  async () => {
    for (const stage of stages) {
      const fixture = await pending(stage)
      const before = structuredClone(fixture.app.state.procurement)
      const version = rowVersion(before, fixture.id)
      for (const action of forbidden) {
        await decide(
          fixture.app,
          before,
          bea,
          actor(BEA, ["requester"]),
          "Requests",
          action,
          version - 1,
          commandValues(action),
          fixture.id,
          409,
        )
      }
    }
  },
  30_000,
)

test(
  "hidden save, cancel, delete, and non-requester transitions stay refused at the live version",
  async () => {
    for (const stage of stages) {
      const fixture = await pending(stage)
      const before = structuredClone(fixture.app.state.procurement)
      const version = rowVersion(before, fixture.id)
      for (const action of forbidden) {
        await decide(
          fixture.app,
          before,
          bea,
          actor(BEA, ["requester"]),
          "Requests",
          action,
          version,
          commandValues(action),
          fixture.id,
          403,
        )
      }
    }
  },
  30_000,
)

test(
  "a requester's own blank-holder approve and reject follow the porta for PR, sourcing, and PO",
  async () => {
    for (const stage of stages) {
      for (const action of ["approve", "reject"] as const) {
        const fixture = await pending(stage)
        const values = action === "approve" ? { comment: "Noted" } : { reason: "no" }
        await commits(fixture.app, ada, actor(ADA, ["requester"]), action, values, fixture.id, portaStatus[action][stage])
      }
    }
  },
  30_000,
)

test(
  "a visible writer still decides another person's blank-holder request",
  async () => {
    for (const role of ["buyer", "approver", "supplier admin", "admin"] as const) {
      const fixture = await pending("pr_pending")
      const who = principal(personId[role], [role])
      await commits(fixture.app, who, actor(who.id, [role]), "approve", { comment: "Noted" }, fixture.id, "sourcing")
    }
  },
  30_000,
)

test("block self approval still refuses the creator and writes nothing", async () => {
  const app = installation()
  await must(app, admin, "Settings", "reset", {})
  await must(app, admin, "Settings", "save", { blockSelfApproval: true })
  const id = await createPr(app, ada)
  await must(app, ada, "Requests", "submit_pr", { pr }, id)
  const before = structuredClone(app.state.procurement)
  expect(object(object(before.data.store).settings).blockSelfApproval).toBe(true)
  expect(pendingHolder(storedRequest(before, id))).toBeNull()
  const refused = await decide(app, before, ada, actor(ADA, ["requester"]), "Requests", "approve", rowVersion(before, id), { comment: "Noted" }, id, 403)
  expect(JSON.parse(refused.http)).toMatchObject({ errors: ["self_approval"] })
  expect(JSON.parse(refused.domain)).toMatchObject({ errors: ["self_approval"] })
  const buyer = principal(BUYER, ["buyer"])
  await commits(app, buyer, actor(BUYER, ["buyer"]), "approve", { comment: "Noted" }, id, "sourcing")
})

test("a named holder refuses a different actor, including admin, and the holder can decide", async () => {
  const app = installation()
  await must(app, admin, "Settings", "reset", {})
  await must(app, admin, "Settings", "save", {
    levels: [{ id: "L1", name: "CIO-1 (Level 1)", threshold: 0, holderId: HOLDER }],
  })
  const id = await createPr(app, ada)
  await must(app, ada, "Requests", "submit_pr", { pr }, id)
  const before = structuredClone(app.state.procurement)
  expect(pendingHolder(storedRequest(before, id))).toBe(HOLDER)
  const version = rowVersion(before, id)
  const adminRefusal = await decide(app, before, admin, actor(ADMIN, ["admin"]), "Requests", "approve", version, { comment: "Noted" }, id, 403)
  expect(JSON.parse(adminRefusal.http)).toMatchObject({ errors: ["no_override"] })
  expect(JSON.parse(adminRefusal.domain)).toMatchObject({ errors: ["no_override"] })
  const other = principal(APPROVER, ["approver"])
  const otherRefusal = await decide(
    app,
    before,
    other,
    actor(APPROVER, ["approver"]),
    "Requests",
    "approve",
    version,
    { comment: "Noted" },
    id,
    403,
  )
  expect(JSON.parse(otherRefusal.http)).toMatchObject({ errors: ["not_approver"] })
  expect(JSON.parse(otherRefusal.domain)).toMatchObject({ errors: ["not_approver"] })
  const holder = principal(HOLDER, ["approver"])
  await commits(app, holder, actor(HOLDER, ["approver"]), "approve", { comment: "Noted" }, id, "sourcing")
})

test("submit_pr by any requester still commits a draft that requester did not create", async () => {
  const app = installation()
  await must(app, admin, "Settings", "reset", {})
  for (const requester of [bea, principal(CARA, ["requester"])]) {
    const id = await createPr(app, ada)
    const before = structuredClone(app.state.procurement)
    const version = rowVersion(before, id)
    await decide(app, before, requester, actor(requester.id, ["requester"]), "Requests", "save", version, commandValues("save"), id, 403)
    await decide(app, before, requester, actor(requester.id, ["requester"]), "Requests", "delete", version, {}, id, 403)
    await must(app, requester, "Requests", "submit_pr", { pr: { ...pr, title: "STOLEN-TITLE" } }, id)
    const saved = storedRequest(app.state.procurement, id)
    expect(saved.status).toBe("pr_pending")
    expect(saved.createdBy).toBe(ADA)
    expect(object(saved.pr)).toMatchObject(pr)
    expect(rowVersion(app.state.procurement, id)).toBe(version + 1)
  }
})

test("a viewer still sees every request and canWrite false refuses the command", async () => {
  const fixture = await pending("pr_pending")
  const before = structuredClone(fixture.app.state.procurement)
  const view = domain.view(before, actor(VIEWER, ["viewer"], false), environment)
  expect(presence(view.data, view.versions, fixture.id)).toEqual({ row: true, version: true })
  expect(rows(view.data.requests).find((request) => request.number === fixture.id)).toMatchObject({
    createdBy: ADA,
    pr: { title: TITLE },
  })
  const seen = await responseText(await fixture.app.read(principal(VIEWER, ["viewer"], true)))
  expect(seen.response.status).toBe(200)
  expect(seen.raw).toContain(TITLE)
  const version = rowVersion(before, fixture.id)
  await decide(
    fixture.app,
    before,
    principal(VIEWER, ["viewer"], true),
    actor(VIEWER, ["viewer"], false),
    "Requests",
    "approve",
    version,
    { comment: "Noted" },
    fixture.id,
    403,
  )
  const domainState = structuredClone(before)
  const domainResult = domain.execute(
    domainState,
    actor(VIEWER, ["viewer"], true),
    { page: "Requests", action: "approve", id: fixture.id, version, values: { comment: "Noted" } },
    environment,
  )
  expect(domainResult).toMatchObject({ ok: false, status: 403 })
  expectUntouched(domainState, before)
  expectUntouched(fixture.app.state.procurement, before)
})

test("buyer, approver, supplier admin, admin, and viewer still see another person's request and version", async () => {
  const fixture = await pending("src_pending")
  const before = structuredClone(fixture.app.state.procurement)
  const hidden = domain.view(before, actor(BEA, ["requester"]), environment)
  expect(presence(hidden.data, hidden.versions, fixture.id)).toEqual({ row: false, version: false })
  for (const role of openRoles) {
    const open = domain.view(before, actor(personId[role], [role], role !== "viewer"), environment)
    expect(presence(open.data, open.versions, fixture.id)).toEqual({ row: true, version: true })
    expect(rows(open.data.requests).find((request) => request.number === fixture.id)).toMatchObject({
      createdBy: ADA,
      pr: { title: TITLE },
    })
    const seen = await responseText(await fixture.app.read(principal(personId[role], [role], true)))
    expect(seen.response.status).toBe(200)
    const page = object(JSON.parse(seen.raw))
    expect(presence(object(page.data), object(page.versions), fixture.id)).toEqual({ row: true, version: true })
    expect(seen.raw).toContain(TITLE)
    const dualView = domain.view(before, actor(BEA, ["requester", role]), environment)
    expect(presence(dualView.data, dualView.versions, fixture.id)).toEqual({ row: true, version: true })
    const dual = await responseText(await fixture.app.read(principal(BEA, ["requester", role], true)))
    expect(dual.response.status).toBe(200)
    const dualPage = object(JSON.parse(dual.raw))
    expect(presence(object(dualPage.data), object(dualPage.versions), fixture.id)).toEqual({ row: true, version: true })
  }
  expectUntouched(fixture.app.state.procurement, before)
})

test("an owner's stale command still returns the visible row conflict and a payload actor is not granted", async () => {
  const fixture = await pending("pr_pending")
  const before = structuredClone(fixture.app.state.procurement)
  const version = rowVersion(before, fixture.id)
  const domainState = structuredClone(before)
  const domainResult = domain.execute(
    domainState,
    actor(ADA, ["requester"]),
    { page: "Requests", action: "approve", id: fixture.id, version: version - 1, values: { comment: "Noted", roles: ["admin"] } },
    environment,
  )
  expect(domainResult).toMatchObject({ ok: false, status: 409, by: ADA })
  expect(JSON.stringify(domainResult)).toContain(TITLE)
  expectUntouched(domainState, before)
  const http = await responseText(
    await fixture.app.post(ada, "Requests", "approve", version - 1, { comment: "Noted", roles: ["admin"] }, fixture.id),
  )
  expect(http.response.status).toBe(409)
  const parsed = object(JSON.parse(http.raw))
  expect(parsed.by).toBe(ADA)
  expect(http.raw).toContain(TITLE)
  expectUntouched(fixture.app.state.procurement, before)
  const spoofed = await responseText(
    await fixture.app.send(bea, {
      page: "Requests",
      action: "approve",
      id: fixture.id,
      version,
      values: { comment: "Noted" },
      actor: { id: ADMIN, canWrite: true, roles: ["admin"] },
    }),
  )
  expect(spoofed.response.status).toBe(400)
  expect(spoofed.raw).not.toContain(TITLE)
  expectUntouched(fixture.app.state.procurement, before)
  expect(storedRequest(fixture.app.state.procurement, fixture.id).status).toBe("pr_pending")
})
