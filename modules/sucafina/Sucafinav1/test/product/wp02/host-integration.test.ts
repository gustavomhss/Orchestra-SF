import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AbsolutePath } from "@orchestra/core/schema"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { resolve } from "../../../src/identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createDashboardRecordSourceIssuer, createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardRecordEvidenceHost, createDashboardSourceHost } from "../../../product/dashboard/sources.ts"
import { createChoiceSnapshot } from "../../../product/decisions/choice.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DecisionCase, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { SfHumanAction } from "../../../product/integration/human-authority.ts"
import type { HotTopicDraftRequest } from "../../../product/decisions/hot-topic-draft.ts"
import { createFixtureBusiness } from "./business-services-fixture.ts"
import { createSfDashboardHttp } from "../../../../../../apps/cli/src/sucafina-product/dashboard-http.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const day = { start: "2026-11-13", end: "2026-11-13" }
const caseRef = { id: "case", incarnation: "case-inc", version: 1 }
async function fixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-dashboard-host-"))
  const store = await openLocalStore(directory)
  const clock = { at: "2026-11-13T00:00:00Z", active: true }
  const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => clock.at) })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]
    snapshot.data.hotTopics = [{ id: "topic", action: "Original action", owner: "owner", due: "2026-12-01", status: "open", priority: "normal", notes: "" }]
    snapshot.data.itperf = { items: [{ id: "delivery", name: "Delivery", hiddenSecret: "never-public", subs: [] }, { id: "availability", name: "Availability", subs: [] }] }
    return { commit: true, value: undefined }
  })
  const proposalCoverageWrites = new WeakSet<object>()
  const dashboardHostWrites = new WeakSet<object>()
  const identity = { installationId: "installation", hostId: "host", projectId: "project", location: { directory: AbsolutePath.make(directory) } }
  const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId, origin: "https://example.test", policyVersion: "policy", persistence,
    authenticate: async (_request, current) => clock.active && current ? resolve("admin", [...current.roleMap], (group) => group === "admins") : null,
    environment: async () => ({ at: clock.at, id: randomUUID, directory: [] }), now: Date.now, createId: randomUUID,
    commandIdentity: async (request, operation) => digestSfValue({ operation, key: request.headers.get("Idempotency-Key") ?? randomUUID() }),
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => 1,
    authorizeDocument: async () => undefined, proposalCoverageWrites, dashboardHostWrites,
    grants: [{ principalRef: "admin", namespaces: ["preferences", "reviews", "cases", "receipts"], operations: ["sf_dashboard_read", "sf_case_read"],
      humanActions: ["reviews.preserve", "decisions.edit", "decisions.choose", "decisions.prepare-changes", "decisions.apply"] }] })
  const records = createDashboardRecordEvidenceHost({ host: authority.host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host: authority.host, scopedSources: persistence }) })
  const sources = createDashboardSourceHost({ host: authority.host, scopedSources: persistence })
  const business = await createFixtureBusiness({ authority, persistence, proposalCoverageWrites, dashboardHostWrites }).catch(async (error: unknown) => {
    const failures: unknown[] = [error]
    try { await store.dispose() } catch (failure) { failures.push(failure) }
    try { await rm(directory, { recursive: true, force: true }) } catch (failure) { failures.push(failure) }
    throw failures.length === 1 ? error : new AggregateError(failures, "Business fixture setup and cleanup failed")
  })
  const dashboard = business.dashboardServices, decisions = business.dashboardDecisions
  const http = createSfDashboardHttp({ origin: "https://example.test", mount: "/sucafina", runtime: () => ({ authority, dashboard, decisions }) })
  const request = (mode: string, payload?: unknown, key: string = randomUUID()) => new Request(`https://example.test/sucafina/dashboard?sf=${mode}`, payload === undefined ? undefined :
    { method: "POST", headers: { origin: "https://example.test", "content-type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(payload) })
  const read = async <T>(payload: unknown, work: (context: TrustedDomainContext) => Promise<T>) => {
    const source = request("dashboard-agenda", payload)
    const digest = digestSfValue(payload)
    const context = await authority.ui.admit(source, "sf_dashboard_read", digest)
    if (context.status !== "ok") throw new Error(`read admission: ${context.status}`)
    try { expect(await authority.ui.validate(context.value, "sf_dashboard_read", digest)).toBe(true); return await work(context.value) }
    finally { authority.ui.finish(context.value) }
  }
  const human = async <T>(action: SfHumanAction, payload: unknown, work: (context: TrustedDomainContext) => Promise<T>, key: string = randomUUID()) => {
    const context = await authority.human.admit(request("dashboard-hot-topic-apply", payload, key), action, payload)
    if (context.status !== "ok") throw new Error(`human admission: ${context.status}`)
    try { return await work(context.value) } finally { authority.human.finish(context.value) }
  }
  const emptyCase: DecisionCase = { ...caseRef, state: "investigating", objective: "Review the action", horizon: period, currency: "USD",
    criteria: [{ id: "operational", description: "Operational action", required: true }], participants: ["admin"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const seeded = await authority.state.transaction(request("dashboard-hot-topic-draft", {}), { namespace: "cases", expectedStorageVersion: 0,
    targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "case-fixture", commandDigest: digestSfValue(emptyCase) }, async (state) => {
      state.cases[emptyCase.id] = emptyCase; return { commit: true, value: true }
    })
  expect(seeded.status).toBe("ok")
  return { clock, persistence, authority, records, sources, dashboard, decisions, http, request, read, human,
    issuePage: createDashboardSourceIssuer({ host: authority.host, scopedSources: persistence }),
    close: async () => { business.dispose(); await store.dispose(); await rm(directory, { recursive: true, force: true }) } }
}

test("real host protects metadata writes and captures under the all-surface C08 lock", async () => {
  const f = await fixture()
  try {
    const request = f.request("dashboard-capture", {})
    const denied = await f.authority.state.transaction(request, { namespace: "preferences", domainSurface: "dashboard", expectedStorageVersion: 0,
      targetRef: f.authority.creationTarget.ref, targetIncarnation: f.authority.creationTarget.incarnation, idempotencyKey: "forged-capture", commandDigest: digestSfValue({ forged: true }) }, async (state) => {
      state.preferences["sf:dashboard-host:capture:forged"] = { projection: "not authorized" }; return { commit: true, value: true }
    })
    expect(denied).toMatchObject({ status: "denied", reason: "dashboard-host-write-outside-authority" })
    const source = await f.read({}, (context) => f.records.issue({ page: "Hot Topics & Actions", recordType: "hotTopics", recordId: "topic", fields: ["action"], period: day }, context))
    if (source.status !== "ok") throw new Error(`source: ${source.status}`)
    const captureRequest = { sourceRef: source.value.refId }
    const capture = await f.human("reviews.preserve", captureRequest, (context) => f.dashboard.capture(captureRequest, context), "capture-once")
    expect(capture.status).toBe("ok")
    if (capture.status !== "ok") return
    const durable = await f.authority.state.read(request, "preferences", (state) => Object.entries(state.preferences).filter(([name]) => name.startsWith("sf:dashboard-host:capture:")))
    expect(durable.status === "ok" && durable.value).toHaveLength(1)
    const replay = await f.human("reviews.preserve", captureRequest, (context) => f.dashboard.capture(captureRequest, context), "capture-once")
    expect(replay).toEqual(capture)
    await f.persistence.transaction("dashboard", async (snapshot) => { rows(snapshot.data.hotTopics)[0]!.action = "Changed current action"; return { commit: true, value: undefined } })
    f.clock.at = "2026-11-14T00:00:00Z"
    const historical = await f.read({}, (context) => f.dashboard.reopen(capture.value.captureId, context))
    expect(historical).toMatchObject({ status: "ok", value: { state: "historical", projection: { values: [{ value: "Original action" }] } } })
    const revoked = await f.read({}, async (context) => { f.clock.active = false; return f.dashboard.reopen(capture.value.captureId, context) })
    expect(revoked.status).toBe("denied")
    f.clock.active = true
    await f.persistence.transaction("dashboard", async (snapshot) => { snapshot.data.hotTopics = []; return { commit: true, value: undefined } })
    await f.persistence.transaction("dashboard", async (snapshot) => { snapshot.data.hotTopics = [{ id: "topic", action: "Replacement" }]; return { commit: true, value: undefined } })
    expect((await f.read({}, (context) => f.dashboard.reopen(capture.value.captureId, context))).status).not.toBe("ok")
  } finally { await f.close() }
})

test("ReviewHost.select consumes real Performance item lifecycle and preserves an authorized subset", async () => {
  const f = await fixture()
  try {
    const issued = await f.read({}, async (context) => ({ page: await f.issuePage({ page: "IT Performance Contract", fields: ["itperf"], period }, context),
      item: await f.records.issue({ page: "IT Performance Contract", recordType: "itperf-item", recordId: "delivery", fields: ["id"], period }, context) }))
    if (issued.page.status !== "ok" || issued.item.status !== "ok") throw new Error("performance lifecycle unavailable")
    const agendaRequest = { sections: [{ id: "performance", title: "Performance", selectionRef: issued.page.value.selectionRef, topic: "it-performance", period, recordRefs: [issued.item.value.refId] }] }
    const agenda = await f.read(agendaRequest, (context) => f.dashboard.agenda(agendaRequest, context))
    expect(agenda.status).toBe("ok")
    if (agenda.status !== "ok") return
    expect(agenda.value.sections[0]!.recordCount).toBe(1)
    expect(agenda.value.sections[0]!.projection.values.every((value) => value.id.startsWith("itperf.items[id:delivery]."))).toBe(true)
    expect(JSON.stringify(agenda)).not.toContain("never-public")
    expect(JSON.stringify(agenda)).not.toContain("Availability")
    const preserveRequest = { selectionRef: agenda.value.selectionRef, sectionRefs: ["performance"] }
    const saved = await f.human("reviews.preserve", preserveRequest, (context) => f.dashboard.preserveReview(preserveRequest, context))
    expect(saved.status).toBe("ok")
    if (saved.status !== "ok") return
    expect(saved.value?.sections[0]?.count).toBe(1)
    const outside = await f.read({}, (context) => f.dashboard.select(agenda.value.selectionRef, ["not-selected"], context))
    expect(outside.status).toBe("denied")
    const itemCaptureRequest = { sourceRef: issued.item.value.refId }
    const itemCapture = await f.human("reviews.preserve", itemCaptureRequest, (context) => f.dashboard.capture(itemCaptureRequest, context))
    expect(itemCapture.status).toBe("ok")
    if (itemCapture.status !== "ok") return
    f.clock.at = "2027-01-02T00:00:00Z"
    const historical = await f.read({}, (context) => f.dashboard.reopen(itemCapture.value.captureId, context))
    expect(historical).toMatchObject({ status: "ok", value: { state: "historical", projection: { values: [{ value: "delivery", period }] } } })
    await f.persistence.transaction("dashboard", async (snapshot) => { snapshot.data.itperf = { items: [{ id: "delivery", name: "One" }, { id: "delivery", name: "Duplicate" }] }; return { commit: true, value: undefined } })
    expect((await f.read({}, (context) => f.dashboard.select(agenda.value.selectionRef, ["performance"], context))).status).not.toBe("ok")
    expect((await f.read({}, (context) => f.dashboard.reopen(itemCapture.value.captureId, context))).status).not.toBe("ok")
  } finally { await f.close() }
})

async function prepareCase(f: Awaited<ReturnType<typeof fixture>>) {
  const issued = await f.read({}, (context) => f.dashboard.issue({ recordType: "hotTopics", recordId: "topic", fields: ["action", "due", "notes", "owner", "priority"], period: day }, context))
  if (issued.status !== "ok") throw new Error(`topic issue: ${issued.status}`)
  const draftRequest: HotTopicDraftRequest = { caseRef, target: { surface: "dashboard", type: "hotTopics", id: "topic", incarnation: issued.value.target.incarnation,
    version: issued.value.target.version, fields: issued.value.target.fields, period: day, observedAt: f.clock.at }, targetEvidence: issued.value,
    fields: { action: "Approved new action", owner: "owner", due: "2026-12-20", priority: "high", notes: "Human-authored draft" }, sourceRefs: [issued.value], expectedVersion: 0 }
  const registered = await f.human("decisions.edit", draftRequest, (context) => f.decisions.drafts.register(draftRequest, context))
  expect(registered.status).toBe("ok")
  if (registered.status !== "ok") throw new Error(`draft: ${registered.status}`)
  const operation = { kind: "replace" as const, targetRef: issued.value.refId, replacementRef: registered.value.draftRef }
  const resolved = await f.read({}, (context) => f.decisions.resolveOperation({ caseRef, draftRef: registered.value.draftRef, operation }, context))
  expect(resolved).toMatchObject({ status: "ok", value: { kind: "external", condition: "Financial impact of the Hot Topic change is not assessed." } })
  const scenario: ScenarioResult = { id: "scenario", version: 1, currency: "USD", horizon: period, components: [], sourceRefs: [issued.value],
    unresolvedConditions: ["Financial impact of the Hot Topic change is not assessed."], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: null, total: null,
    costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon: period, issues: [], evaluatedSourceRefs: [issued.value],
      coverageState: "pending", entries: [{ status: "pending", categoryId: "other_relevant_costs", reason: "Financial impact is not assessed" }], derivedMissingCategoryIds: ["other_relevant_costs"] } }
  const source = f.request("dashboard-hot-topic-prepare", {})
  const current = await f.authority.state.read(source, "cases", (state) => state.cases[caseRef.id])
  if (current.status !== "ok" || !current.value) throw new Error("case unavailable")
  const chosenCase: DecisionCase = { ...current.value, sourceRefs: [issued.value], costCoverageBases: [{ id: "basis", version: 1, decisionType: "operational", categoryIds: ["other_relevant_costs"], additionalCategoryIds: [], sourceRefs: [issued.value] }],
    alternatives: [{ id: "alternative", version: 1, title: "Update action", scenario: { baseRef: "case-base", operations: [operation], assumptions: [] }, result: scenario }] }
  const selected = createChoiceSnapshot({ case: chosenCase, alternativeId: "alternative", alternativeVersion: 1, id: "choice", principalRef: "admin", reason: "Proceed with operational action; no financial claim", at: f.clock.at,
    criteria: ["operational"], values: [], evidenceRefs: [issued.value], comparison: { baselineResultRef: "baseline", alternativeResultRef: scenario.id, costCoverageRefs: ["basis"], criterionResults: [], unresolvedConditions: scenario.unresolvedConditions,
      comparisonStatus: "conditioned", knownDifference: null, completeDifference: null } })
  if (selected.status !== "ok") throw new Error(`choice: ${selected.reason}`)
  const stored = await f.authority.state.transaction(source, { namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: caseRef.id, targetIncarnation: caseRef.incarnation,
    idempotencyKey: "fixture-choice", commandDigest: digestSfValue(selected.choice) }, async (state) => { state.cases[caseRef.id] = { ...chosenCase, version: 2, state: "chosen", choices: [selected.choice] }; return { commit: true, value: true } })
  expect(stored.status).toBe("ok")
  const prepareRequest = { caseRef: { ...caseRef, version: 2 }, choiceId: "choice", draftRef: registered.value.draftRef }
  const prepared = await f.human("decisions.prepare-changes", prepareRequest, (context) => f.decisions.prepare(prepareRequest, context), "prepare-topic")
  expect(prepared.status).toBe("ok")
  if (prepared.status !== "ok") throw new Error(`prepare: ${prepared.status}`)
  const replay = await f.human("decisions.prepare-changes", prepareRequest, (context) => f.decisions.prepare(prepareRequest, context), "prepare-topic")
  expect(replay).toEqual(prepared)
  const reviewed = await f.read({}, (context) => f.decisions.review(prepared.value, context))
  expect(reviewed.status).toBe("ok")
  if (reviewed.status !== "ok") throw new Error(`review: ${reviewed.status}`)
  expect(reviewed.value.fields.find((field) => field.field === "action")).toMatchObject({ before: "Original action", after: "Approved new action" })
  expect(JSON.stringify(reviewed)).not.toContain("mutationScope")
  expect(JSON.stringify(reviewed)).not.toContain("idempotencyKey")
  return { request: { ...prepared.value, reviewDigest: reviewed.value.reviewDigest }, draftRequest }
}

test("C12 host persists the real draft and prepared binding, applies once, and reconciles its receipt", async () => {
  const f = await fixture()
  try {
    const prepared = await prepareCase(f)
    const applied = await f.human("decisions.apply", prepared.request, (context) => f.decisions.apply(prepared.request, context), "apply-topic")
    expect(applied.status).toBe("ok")
    if (applied.status !== "ok") return
    expect(applied.value.result.ok).toBe(true)
    const snapshot = await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    expect(rows(snapshot.data.hotTopics)[0]!.action).toBe("Approved new action")
    expect(rows(snapshot.data.hotTopics)[0]!.status).toBe("open")
    const decision = object(object(object(snapshot.data.__sfProductV1).cases).case)
    expect(decision.state).toBe("applied")
    expect(rows(decision.preparedChanges)[0]!.state).toBe("applied")
    expect(rows(decision.receipts)).toHaveLength(1)
    const replay = await f.human("decisions.apply", prepared.request, (context) => f.decisions.apply(prepared.request, context), "apply-topic")
    expect(replay).toEqual(applied)
    const wrong = { ...prepared.request, reviewDigest: "f".repeat(64) }
    const rejected = await f.human("decisions.apply", wrong, (context) => f.decisions.apply(wrong, context), "apply-topic")
    expect(rejected.status).toBe("conflict")
    const final = await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.versions["hotTopics:topic"]?.version }))
    expect(final).toBe(applied.value.version)
  } finally { await f.close() }
})

test("prepared host refuses replaced choice and forged metadata before touching the target or receipt", async () => {
  const f = await fixture()
  try {
    const prepared = await prepareCase(f)
    await f.persistence.transaction("dashboard", async (snapshot) => {
      const cases = object(object(snapshot.data.__sfProductV1).cases)
      rows(object(cases.case).choices)[0]!.reason = "Replaced after review"
      return { commit: true, value: undefined }
    })
    const result = await f.human("decisions.apply", prepared.request, (context) => f.decisions.apply(prepared.request, context))
    expect(result.status).not.toBe("ok")
    const snapshot = await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    expect(rows(snapshot.data.hotTopics)[0]!.action).toBe("Original action")
    expect(Object.keys(object(object(snapshot.data.__sfProductV1).receipts))).toHaveLength(0)
    const forged = await f.authority.state.transaction(f.request("dashboard-hot-topic-apply", prepared.request), { namespace: "receipts", domainSurface: "dashboard", expectedStorageVersion: 0,
      targetRef: "topic", targetIncarnation: "forged", idempotencyKey: "prepared:forged", commandDigest: "a".repeat(64) }, async () => ({ commit: true, value: "must-not-commit" }))
    expect(forged.status).toBe("denied")
  } finally { await f.close() }
})

test("HTTP consumer checks origin, payload, action grant and never admits caller-supplied commands", async () => {
  const f = await fixture()
  try {
    const target = { recordId: "topic", period: day }
    const good = await f.http(f.request("dashboard-hot-topic-source", target), "dashboard")
    expect(good?.status).toBe(200)
    const body = object(await good!.json())
    expect(object(object(body.value).target).type).toBe("hotTopics")
    const forged = await f.http(f.request("dashboard-hot-topic-apply", { caseRef, choiceId: "choice", changeId: "change", reviewDigest: "a".repeat(64), command: { action: "save", values: { action: "Forged" } } }), "dashboard")
    expect(forged?.status).toBe(400)
    const cross = await f.http(new Request("https://example.test/sucafina/dashboard?sf=dashboard-hot-topic-source", { method: "POST", headers: { origin: "https://other.test", "content-type": "application/json" }, body: JSON.stringify(target) }), "dashboard")
    expect(cross?.status).toBe(403)
    const wrongSurface = await f.http(f.request("dashboard-hot-topic-source", target), "planner")
    expect(wrongSurface?.status).toBe(403)
    f.clock.active = false
    expect((await f.http(f.request("dashboard-hot-topic-source", target), "dashboard"))?.status).toBe(403)
    expect(await f.http(new Request("https://example.test/sucafina/dashboard?sf=another-product"), "dashboard")).toBeUndefined()
  } finally { await f.close() }
})

test("changing protected prepared content or its digest cannot substitute a C12 command", async () => {
  const f = await fixture()
  try {
    const prepared = await prepareCase(f)
    const key = `sf:dashboard-host:prepared:${prepared.request.changeId}`
    await f.persistence.transaction("dashboard", async (snapshot) => {
      const binding = object(object(object(snapshot.data.__sfProductV1).preferences)[key])
      object(object(binding.command).command).values = { action: "Substituted", owner: "owner", due: "2026-12-20", priority: "high", notes: "" }
      return { commit: true, value: undefined }
    })
    expect((await f.read({}, (context) => f.decisions.review(prepared.request, context))).status).not.toBe("ok")
    await f.persistence.transaction("dashboard", async (snapshot) => {
      const binding = object(object(object(snapshot.data.__sfProductV1).preferences)[key])
      binding.recordDigest = digestSfValue(Object.fromEntries(Object.entries(binding).filter(([name]) => name !== "recordDigest")))
      return { commit: true, value: undefined }
    })
    expect((await f.human("decisions.apply", prepared.request, (context) => f.decisions.apply(prepared.request, context))).status).not.toBe("ok")
    const unchanged = await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: { action: rows(snapshot.data.hotTopics)[0]!.action, receipts: Object.keys(object(object(snapshot.data.__sfProductV1).receipts)) } }))
    expect(unchanged).toEqual({ action: "Original action", receipts: [] })
  } finally { await f.close() }
})
