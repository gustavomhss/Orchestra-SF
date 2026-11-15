import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { rm } from "node:fs/promises"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { SfProductStatePort } from "../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { HotTopicDraft, HotTopicDraftRequest } from "../../../product/decisions/hot-topic-draft.ts"
import { createHotTopicDraftStore } from "../../../product/decisions/hot-topic-draft.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createDashboardRecordEvidenceHost } from "../../../product/dashboard/sources.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { createSfDashboardHttp } from "../../../../../../apps/cli/src/sucafina-product/dashboard-http.ts"
import { dashboardSourceCurrent } from "../../../../../../apps/cli/src/sucafina-product/dashboard-services.ts"
import { plannerAt, plannerFixture } from "../wp03/planner-fixture.ts"

const origin = "https://example.test"
const caseRef = { id: "first-save-case", incarnation: "first-save-incarnation", version: 1 }
const day = { start: "2026-11-13", end: "2026-11-13" }
const row = { id: "topic", action: "Review renewal", owner: "admin", due: "2026-12-01", status: "open", priority: "normal", notes: "Official original" }

type Reply = { code: number; body: { status: string; reason?: string; value?: { draftRef: string; version: number } } }

async function fixture() {
  // The Planner fixture owns a private real SQLite installation. The Dashboard
  // registry and record scope are issued by the same C08/source machinery used
  // by the product, rather than fabricated source records or in-memory state.
  const planner = await plannerFixture()
  await planner.persistence.initializeSources("dashboard")
  await planner.persistence.initializeSources("procurement")
  await planner.persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admin-group", version: 1, by: "admin" }]
    snapshot.data.hotTopics = [row]
    return { commit: true, value: true }
  })
  const access = planner.access
  const observations: string[] = []
  const fence = { armed: false, fired: false }
  const calls = { register: 0, transactions: 0 }
  const targetIncarnation = { value: caseRef.incarnation }
  let store = planner.store
  let persistence = planner.persistence

  function bind() {
    const ui = createSfUiAuthority({
      authorize: async (request, operation) => {
        observations.push(operation)
        const principalRef = request.headers.get("authorization")
        return access.allowed && principalRef && ["admin", "finance"].includes(principalRef)
          ? { installationId: "i", projectId: "p", principalRef, policyVersion: "1", accessRevision: access.revision } : undefined
      },
      // The HTTP host binds the original key to the HUMAN ACTION, not to its
      // changed recovery body. Fresh admissions get fresh request identities.
      commandIdentity: async (request, operation) => {
        const key = request.headers.get("idempotency-key")
        return key && /^[A-Za-z0-9._:-]{8,128}$/.test(key) ? digestSfValue({ operation, key }) : undefined
      },
      createId: randomUUID, now: () => access.now, privateCommands: ["sf-human:decisions.edit"],
    })
    const human = createSfHumanAuthority({ origin, ui })
    const host: DomainPortHost = {
      ...planner.host,
      persistence,
      requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined,
      revalidate: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false),
    }
    const records = createDashboardRecordEvidenceHost({ host, scopedSources: persistence,
      issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: persistence }) })
    const writes = new WeakSet<object>()
    const rawState = createSfProductState({
      persistence, proposalCoverageWrites: writes, createId: randomUUID,
      authorize: async (request) => {
        const principalRef = request.headers.get("authorization")
        return access.allowed && principalRef && ["admin", "finance"].includes(principalRef)
          ? { principalRef, policyVersion: "1", accessRevision: access.revision } : undefined
      },
      resolveTarget: async (_request, _snapshot, _namespace, target) => target === caseRef.id ? { incarnation: targetIncarnation.value } : undefined,
    })
    const state: SfProductStatePort = {
      ...rawState,
      transaction: (request, command, work) => {
        calls.transactions++
        return rawState.transaction(request, command, work)
      },
      read: (request, namespace, select) => rawState.read(request, namespace, async (current, authority) => {
        const selected = await select(current, authority)
        // Interleave a real revocation between the final selector and the C08
        // second authorization under the SQL lock. No result may escape.
        if (fence.armed && namespace === "preferences" && selected === true) {
          fence.armed = false
          fence.fired = true
          access.allowed = false
        }
        return selected
      }),
    }
    const sourceCurrent = (snapshot: Snapshot, draft: HotTopicDraft, context: TrustedDomainContext) =>
      dashboardSourceCurrent(snapshot, draft.target, context, plannerAt) &&
      draft.sourceRefs.length > 0 && draft.sourceRefs.every((ref) =>
        ref.kind === "record" && ref.target.surface === "dashboard" && !!ref.target.period &&
        dashboardSourceCurrent(snapshot, { surface: "dashboard", type: ref.target.recordType, id: ref.target.recordId,
          incarnation: ref.target.incarnation, version: ref.target.version, fields: ref.target.fields,
          period: ref.target.period, observedAt: plannerAt }, context, plannerAt))
    const drafts = createHotTopicDraftStore({
      state, host, proposalCoverageWrites: writes,
      authorizeCase: async (decision, context) => decision.participants.includes(context.binding.principalRef) && await host.revalidate(context),
      authorizeDraft: (payload, context) => human.authorize(context, "decisions.edit", payload),
      authorizeLookup: (payload, context) => human.authorize(context, "decisions.edit", payload),
      operationIdentity: (context) => context.kind === "ui" ? ui.operationIdentity(context) : undefined,
      verifySources: async (draft, context) => {
        const resolved = await Promise.all(draft.sourceRefs.map((ref) => ref.kind === "record" ? records.resolve(ref.refId, context) : undefined))
        return resolved.length > 0 && resolved.every((item, index) => item?.status === "ok" &&
          digestSfValue(item.value) === digestSfValue(draft.sourceRefs[index])) && await host.revalidate(context)
      },
      verifySnapshot: (snapshot, request, draft, context) =>
        ui.matchesIntent(context, "sf-human:decisions.edit", digestSfValue(request)) && sourceCurrent(snapshot, draft, context),
      verifyLookupSnapshot: (draft, context) => {
        const dashboard = persistence.currentSnapshots?.()?.dashboard
        return !!dashboard && sourceCurrent(dashboard, draft, context)
      },
      createId: randomUUID, now: () => plannerAt,
    })
    // The route, admission, read-only C08 producer and SQL store are genuine.
    // Unused Dashboard services are outside the first-save route under test.
    const runtime = { authority: { ui, human, host }, decisions: { drafts: { ...drafts, register: (...args: Parameters<typeof drafts.register>) => {
      calls.register++
      return drafts.register(...args)
    } } }, dashboard: {} } as unknown as
      NonNullable<ReturnType<Parameters<typeof createSfDashboardHttp>[0]["runtime"]>>
    const handle = createSfDashboardHttp({ origin, mount: "/sf", runtime: () => runtime })
    const http = async (mode: string, payload: unknown, key?: string, actor = "admin"): Promise<Reply> => {
      const headers: Record<string, string> = { origin, authorization: actor, "content-type": "application/json" }
      if (key) headers["idempotency-key"] = key
      const response = await handle(new Request(origin + "/sf/dashboard?sf=" + mode, {
        method: "POST", headers, body: JSON.stringify(payload),
      }), "dashboard")
      if (!response) throw new Error("Dashboard HTTP route not installed")
      return { code: response.status, body: await response.json() as Reply["body"] }
    }
    const readRequest = (actor = "admin") => new Request(origin + "/seed", { headers: { authorization: actor } })
    const snapshot = async () => digestSfValue(await persistence.transaction("dashboard", async (current) => ({
      commit: false, value: { product: current.data.__sfProductV1, audit: current.audit, versions: current.versions,
        sources: current.sfSources, hotTopics: current.data.hotTopics },
    })))
    return { ui, human, records, state, drafts, http, readRequest, snapshot, persistence }
  }

  let live = bind()
  const contextRequest = new Request(origin + "/issue", {
    method: "POST", headers: { authorization: "admin", origin, "content-type": "application/json", "idempotency-key": "source-key-001" },
    body: JSON.stringify({ caseRef }),
  })
  const issuedContext = await live.human.admit(contextRequest, "decisions.edit", { caseRef })
  if (issuedContext.status !== "ok") throw new Error("Source issuance admission unavailable: " + JSON.stringify(issuedContext))
  const issued = await live.records.issue({ page: "Hot Topics & Actions", recordType: "hotTopics", recordId: row.id,
    fields: ["id", "action", "owner", "due", "status", "priority", "notes"], period: day }, issuedContext.value)
  live.human.finish(issuedContext.value)
  if (issued.status !== "ok") throw new Error("Real Dashboard record evidence unavailable: " + JSON.stringify(issued))
  const source = issued.value
  const input: HotTopicDraftRequest = {
    caseRef, expectedVersion: 0,
    target: { surface: "dashboard", type: "hotTopics", id: row.id, incarnation: source.target.incarnation,
      version: source.target.version, fields: source.target.fields, period: day, observedAt: plannerAt },
    targetEvidence: source,
    sourceRefs: [source],
    fields: { action: "Prepare renewal", owner: "admin", due: "2026-12-03", priority: "high", notes: "Two independent intentions can have identical text" },
  }
  const decision: DecisionCase = {
    ...caseRef, state: "draft", objective: "Prepare topic safely", horizon: day, currency: "USD",
    criteria: [], participants: ["admin"], sourceRefs: [source], alternatives: [],
    costCoverageBases: [], assumptions: [], questions: [], choices: [],
    preparedChanges: [], receipts: [], ledger: [],
  }
  const seeded = await live.state.transaction(live.readRequest(), {
    namespace: "cases", expectedStorageVersion: 0, targetRef: caseRef.id,
    targetIncarnation: caseRef.incarnation, idempotencyKey: "first-save-case-seed",
    commandDigest: digestSfValue(decision),
  }, async (state) => { state.cases[caseRef.id] = decision; return { commit: true, value: true } })
  if (seeded.status !== "ok") throw new Error("Real C08 case seed failed: " + JSON.stringify(seeded))
  const reopen = async () => {
    await store.dispose()
    store = await openLocalStore(planner.directory)
    persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID,
      enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => plannerAt) })
    live = bind() // New UI leases, source host, C08 port and HTTP handler.
    return live
  }
  const close = async () => { await store.dispose(); await rm(planner.directory, { recursive: true, force: true }) }
  return { get live() { return live }, input, access, observations, fence, calls, targetIncarnation, reopen, close }
}

function accepted(value: Reply): { draftRef: string; version: number } {
  expect(value.code).toBe(200)
  expect(value.body.status).toBe("ok")
  if (value.body.status !== "ok" || !value.body.value) throw new Error("Expected authoritative ACK")
  return value.body.value
}

const save = "dashboard-hot-topic-draft"
const outcome = "dashboard-hot-topic-draft-outcome"

test("lost first-save ACK survives SQLite reopen, preserves distinct identical-text intents and returns the original version after case advance", async () => {
  const f = await fixture()
  try {
    const first = accepted(await f.live.http(save, f.input, "first-save-key-001"))
    const second = accepted(await f.live.http(save, f.input, "first-save-key-002"))
    expect(first.version).toBe(1)
    expect(second.version).toBe(1)
    expect(first.draftRef).not.toBe(second.draftRef)
    const current = await f.live.state.read(f.live.readRequest(), "cases", (state) => state.cases[caseRef.id])
    if (current.status !== "ok" || !current.value) throw new Error("Persisted case unavailable")
    const advance = await f.live.state.transaction(f.live.readRequest(), {
      namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: caseRef.id,
      targetIncarnation: caseRef.incarnation, idempotencyKey: "first-save-case-advance",
      commandDigest: digestSfValue({ caseRef, version: 2 }),
    }, async (state) => {
      state.cases[caseRef.id] = { ...state.cases[caseRef.id]!, version: 2 }
      return { commit: true, value: true }
    })
    expect(advance.status).toBe("ok")
    const reopened = await f.reopen()
    const before = await reopened.snapshot()
    const beforeCalls = { ...f.calls }
    const returnedFirst = accepted(await reopened.http(outcome, { caseRef }, "first-save-key-001"))
    const returnedSecond = accepted(await reopened.http(outcome, { caseRef }, "first-save-key-002"))
    expect(returnedFirst).toEqual(first)
    expect(returnedSecond).toEqual(second)
    // No forgotten request body, timestamp selection, new draft, SQL state
    // transaction, official update or implicit Apply grant on retrieval.
    expect(await reopened.snapshot()).toBe(before)
    expect(f.calls).toEqual(beforeCalls)
    expect(f.observations.every((operation) => operation === "sf-human:decisions.edit")).toBe(true)
    expect(f.observations).not.toContain("sf-human:decisions.apply")
    const stored = await reopened.state.read(reopened.readRequest(), "preferences", (state) => ({
      history: Object.keys(state.preferences).filter((key) => key.includes(":history:")),
      active: Object.keys(state.preferences).filter((key) => key.includes(":active:")),
      transactions: Object.values(state.transactions).filter((record) => record.namespace === "preferences"),
    }))
    if (stored.status !== "ok") throw new Error("C08 state unavailable after reopen")
    expect(stored.value.history).toHaveLength(2)
    expect(stored.value.active).toHaveLength(2)
    expect(stored.value.transactions).toHaveLength(2)
    expect(await reopened.snapshot()).toBe(before)
  } finally { await f.close() }
}, 120000)

test("outcome HTTP refuses foreign actor, missing/wrong key, wrong case/incarnation and stale source without any lookup writes", async () => {
  const f = await fixture()
  try {
    accepted(await f.live.http(save, f.input, "first-save-key-003"))
    const before = await f.live.snapshot()
    const wrong = [
      await f.live.http(outcome, { caseRef }, "unrelated-key-003"),
      await f.live.http(outcome, { caseRef }, "first-save-key-003", "finance"),
      await f.live.http(outcome, { caseRef: { ...caseRef, id: "another-case" } }, "first-save-key-003"),
      await f.live.http(outcome, { caseRef: { ...caseRef, incarnation: "other-incarnation" } }, "first-save-key-003"),
      await f.live.http(outcome, { caseRef: { ...caseRef, version: 99 } }, "first-save-key-003"),
      await f.live.http(outcome, { caseRef }),
      await f.live.http(outcome, { caseRef, draftRef: "forged" }, "first-save-key-003"),
    ]
    expect(wrong.map((result) => result.code)).toEqual([503, 403, 403, 403, 403, 503, 400])
    expect(wrong.every((result) => result.body.status !== "ok" && !result.body.value)).toBe(true)
    expect(await f.live.snapshot()).toBe(before)
    f.access.revision = "changed-access"
    const changedAuthority = await f.live.http(outcome, { caseRef }, "first-save-key-003")
    expect(changedAuthority.body.status).not.toBe("ok")
    expect(changedAuthority.body).not.toHaveProperty("value")
    f.access.revision = "1"
    f.access.allowed = false
    expect((await f.live.http(outcome, { caseRef }, "first-save-key-003")).code).toBe(403)
    f.access.allowed = true
    expect(await f.live.snapshot()).toBe(before)
    expect(accepted(await f.live.http(outcome, { caseRef }, "first-save-key-003")).version).toBe(1)
    // This is an actual official Dashboard write. It invalidates the persisted
    // source incarnation/version without touching the original C08 receipt.
    await f.live.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.hotTopics = [{ ...row, notes: "Official source changed since save" }]
      return { commit: true, value: true }
    })
    const afterSource = await f.live.snapshot()
    expect(afterSource).not.toBe(before)
    const stale = await f.live.http(outcome, { caseRef }, "first-save-key-003")
    expect(stale.body.status).not.toBe("ok")
    expect(stale.body).not.toHaveProperty("value")
    expect(await f.live.snapshot()).toBe(afterSource)
  } finally { await f.close() }
}, 120000)

test("recreated case incarnation cannot inherit the original first-save receipt", async () => {
  const f = await fixture()
  try {
    accepted(await f.live.http(save, f.input, "first-save-key-004"))
    const read = await f.live.state.read(f.live.readRequest(), "cases", (state) => state.cases[caseRef.id])
    if (read.status !== "ok" || !read.value) throw new Error("Original case missing")
    const reCreated = await f.live.state.transaction(f.live.readRequest(), {
      namespace: "cases", expectedStorageVersion: read.storageVersion, targetRef: caseRef.id,
      targetIncarnation: caseRef.incarnation, idempotencyKey: "recreate-case-004",
      commandDigest: digestSfValue({ id: caseRef.id, incarnation: "recreated-incarnation" }),
    }, async (state) => {
      state.cases[caseRef.id] = { ...state.cases[caseRef.id]!, incarnation: "recreated-incarnation", version: 1 }
      return { commit: true, value: true }
    })
    expect(reCreated.status).toBe("ok")
    f.targetIncarnation.value = "recreated-incarnation"
    const before = await f.live.snapshot()
    const response = await f.live.http(outcome, { caseRef }, "first-save-key-004")
    expect(response.code).toBe(403)
    expect(response.body).not.toHaveProperty("value")
    expect(await f.live.snapshot()).toBe(before)
  } finally { await f.close() }
}, 120000)

test("final SQLite C08 reauthorization blocks the first-save ACK if the grant disappears under the last read", async () => {
  const f = await fixture()
  try {
    accepted(await f.live.http(save, f.input, "first-save-key-005"))
    const request = new Request(origin + "/sf/dashboard?sf=" + outcome, {
      method: "POST", headers: { origin, authorization: "admin", "content-type": "application/json",
        "idempotency-key": "first-save-key-005" }, body: JSON.stringify({ caseRef }),
    })
    const admitted = await f.live.human.admit(request, "decisions.edit", { caseRef })
    if (admitted.status !== "ok") throw new Error("Recovery action not admitted")
    const before = await f.live.snapshot()
    f.fence.armed = true
    const result = await f.live.drafts.lookupFirstSave({ caseRef }, admitted.value)
    expect(f.fence.fired).toBe(true)
    expect(result.status).not.toBe("ok")
    expect(result).not.toHaveProperty("value")
    expect(await f.live.snapshot()).toBe(before)
    f.live.human.finish(admitted.value)
  } finally { await f.close() }
}, 120000)


test("updating a saved draft preserves its historical C08 receipt but fails first-save active/history parity", async () => {
  const f = await fixture()
  try {
    const original = accepted(await f.live.http(save, f.input, "first-save-key-006"))
    const update: HotTopicDraftRequest = {
      ...f.input, draftRef: original.draftRef, expectedVersion: 1,
      fields: { ...f.input.fields, notes: "A new human intention supersedes the first" },
    }
    const replacement = accepted(await f.live.http(save, update, "first-save-key-007"))
    expect(replacement.version).toBe(2)
    expect(replacement.draftRef).not.toBe(original.draftRef)
    const stored = await f.live.state.read(f.live.readRequest(), "preferences", (state) => ({
      originals: Object.values(state.transactions).filter((transaction) =>
        transaction.namespace === "preferences" && transaction.value && typeof transaction.value === "object" &&
        "draftRef" in transaction.value && transaction.value.draftRef === original.draftRef),
      active: Object.values(state.preferences).filter((draft) => draft && typeof draft === "object" && "draftRef" in draft && draft.draftRef === replacement.draftRef),
      history: Object.values(state.preferences).filter((draft) => draft && typeof draft === "object" && "draftRef" in draft && draft.draftRef === original.draftRef),
    }))
    if (stored.status !== "ok") throw new Error("Saved draft metadata unavailable")
    expect(stored.value.originals).toHaveLength(1)
    expect(stored.value.active.length).toBeGreaterThan(0)
    expect(stored.value.history).toHaveLength(1)
    const before = await f.live.snapshot()
    const calls = { ...f.calls }
    const old = await f.live.http(outcome, { caseRef }, "first-save-key-006")
    expect(old.body.status).not.toBe("ok")
    expect(old.body).not.toHaveProperty("value")
    expect(await f.live.snapshot()).toBe(before)
    expect(f.calls).toEqual(calls)
  } finally { await f.close() }
}, 120000)

test("removing case participation blocks the old receipt without rewriting it or re-dispatching", async () => {
  const f = await fixture()
  try {
    accepted(await f.live.http(save, f.input, "first-save-key-008"))
    const current = await f.live.state.read(f.live.readRequest(), "cases", (state) => state.cases[caseRef.id])
    if (current.status !== "ok" || !current.value) throw new Error("Case missing before revocation")
    const committed = await f.live.state.transaction(f.live.readRequest(), {
      namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: caseRef.id,
      targetIncarnation: caseRef.incarnation, idempotencyKey: "first-save-revoke-participant",
      commandDigest: digestSfValue({ caseRef, participants: [] }),
    }, async (state) => {
      state.cases[caseRef.id] = { ...state.cases[caseRef.id]!, participants: [] }
      return { commit: true, value: true }
    })
    expect(committed.status).toBe("ok")
    const before = await f.live.snapshot()
    const calls = { ...f.calls }
    const revoked = await f.live.http(outcome, { caseRef }, "first-save-key-008")
    expect(revoked.code).toBe(403)
    expect(revoked.body).not.toHaveProperty("value")
    expect(await f.live.snapshot()).toBe(before)
    expect(f.calls).toEqual(calls)
  } finally { await f.close() }
}, 120000)
