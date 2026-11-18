import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { createDashboardRecordEvidenceHost } from "../../../product/dashboard/sources.ts"
import { createHotTopicDraftStore } from "../../../product/decisions/hot-topic-draft.ts"
import type { HotTopicDraftRequest } from "../../../product/decisions/hot-topic-draft.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import type { SfHumanAction } from "../../../product/integration/human-authority.ts"
import { projectSfSourceScope } from "../../../product/integration/source-projections.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { rows } from "../../../runtime/contract.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { DashboardPeople } from "../../../runtime/dashboard-people.ts"
import { plannerAt, plannerFixture } from "../wp03/planner-fixture.ts"

const origin = "https://example.test"
const today = { start: "2026-11-13", end: "2026-11-13" }
const caseRef = { id: "hot-topic-case", incarnation: "hot-topic-case-incarnation", version: 1 }
const actor = { id: "admin", roles: ["admin"], canWrite: true, assigned: [], domains: [] }

// Regression from WP10 PR32 @35b9fd4f532abeb1058f00281d4ad8885ca9966f.
// Actual SQLite/C08 and Dashboard source projection, with private test admissions.
// A draft writes private fields only; no person/browser/native session is asserted.
test("hot-topic draft commits against its actual Dashboard snapshot and preserves official records", async () => {
  const fixture = await hotTopicFixture()
  try {
    const original = await fixture.readState()
    const official = await fixture.official()
    expect(await fixture.drafts.register(fixture.request, fixture.readContext)).toEqual({ status: "denied", reason: "hot-topic-draft-access-unavailable" })
    expect(await fixture.readState()).toEqual(original)
    const context = await fixture.admit("decisions.draft-hot-topic", fixture.request, "draft-first")
    const registered = await fixture.drafts.register(fixture.request, context)
    expect(registered.status).toBe("ok")
    if (registered.status !== "ok") throw new Error(registered.reason)
    expect(fixture.controls.snapshots).toEqual(["dashboard"])
    const current = await fixture.drafts.readCurrent({ caseRef, draftRef: registered.value.draftRef }, fixture.readContext)
    expect(current).toMatchObject({ status: "ok", value: { version: 1, target: fixture.request.target, fields: fixture.request.fields, principalRef: actor.id } })
    expect(await fixture.drafts.list({ caseRef }, fixture.readContext)).toEqual({ status: "ok", value: [{ draftRef: registered.value.draftRef, label: fixture.request.fields.action, version: 1, target: fixture.request.target }] })
    const saved = await fixture.readState()
    expect(saved.cases).toEqual(original.cases)
    expect(saved.confirmations).toEqual(original.confirmations)
    expect(saved.receipts).toEqual(original.receipts)
    expect(saved.decisionResults).toEqual(original.decisionResults)
    expect(saved.versions.preferences).toBe(original.versions.preferences + 1)
    expect(saved.versions.cases).toBe(original.versions.cases + 1)
    expect(Object.keys(saved.preferences).filter((key) => key.startsWith("sf:proposal-coverage:hot-topic:"))).toHaveLength(2)
    expect(await fixture.drafts.register(fixture.request, context)).toEqual(registered)
    expect(await fixture.readState()).toEqual(saved)
    expect(fixture.controls.snapshots).toEqual(["dashboard"])
    expect(await fixture.official()).toEqual(official)
  } finally { await fixture.close() }
})

for (const race of ["source", "case", "authority"] as const) test(`hot-topic draft refuses ${race} change after source observation and before C08 commit`, async () => {
  const fixture = await hotTopicFixture()
  try {
    const original = await fixture.readState()
    const official = await fixture.official()
    const sourceRace = { committed: false }
    const context = await fixture.admit("decisions.draft-hot-topic", fixture.request, `draft-race-${race}`)
    fixture.controls.hook = { remaining: 1, run: async () => {
      if (race === "authority") { fixture.access.allowed = false; return }
      if (race === "source") {
        const applied = await fixture.persistence.transaction("dashboard", async (snapshot) => {
          const edited = DashboardPeople.domain.execute(snapshot, actor, { page: "Hot Topics & Actions", action: "save", id: "topic", version: 0, values: { notes: "Concurrent official source edit" } }, { at: plannerAt, id: randomUUID, directory: [] })
          if (!edited.ok) throw new Error("Concurrent Dashboard edit unavailable")
          return { commit: true, value: edited }
        })
        sourceRace.committed = applied.ok
        return
      }
      await fixture.editCase()
    } }
    const result = await fixture.drafts.register(fixture.request, context)
    expect(result.status).not.toBe("ok")
    expect("value" in result).toBe(false)
    fixture.access.allowed = true
    const after = await fixture.readState()
    expect(after.preferences).toEqual(original.preferences)
    expect(after.confirmations).toEqual(original.confirmations)
    expect(after.receipts).toEqual(original.receipts)
    expect(after.decisionResults).toEqual(original.decisionResults)
    expect(Object.values(after.transactions).filter((transaction) => transaction.commandDigest === digestSfValue(fixture.request))).toEqual([])
    if (race === "case") expect(after.cases[caseRef.id]).toEqual({ ...original.cases[caseRef.id]!, version: 2, objective: "Concurrent case edit" })
    else expect(after).toEqual(original)
    if (race === "source") {
      expect(sourceRace.committed).toBe(true)
      expect(fixture.controls.snapshots).toEqual(["dashboard"])
      const changed = await fixture.official()
      expect(rows(changed.dashboard.data.hotTopics)[0]?.notes).toBe("Concurrent official source edit")
      expect(changed.dashboard.audit.length).toBe(official.dashboard.audit.length + 1)
      expect(changed.planner).toEqual(official.planner)
    } else expect(await fixture.official()).toEqual(official)
  } finally { await fixture.close() }
})

test("hot-topic read refuses an old draft replaced during its last source callback", async () => {
  const fixture = await hotTopicFixture()
  try {
    const context = await fixture.admit("decisions.draft-hot-topic", fixture.request, "draft-original")
    const registered = await fixture.drafts.register(fixture.request, context)
    if (registered.status !== "ok") throw new Error(registered.reason)
    const before = await fixture.readState()
    const official = await fixture.official()
    const update: HotTopicDraftRequest = { ...fixture.request, draftRef: registered.value.draftRef, expectedVersion: 1, fields: { ...fixture.request.fields, notes: "New human draft, still unapplied" } }
    const updateContext = await fixture.admit("decisions.draft-hot-topic", update, "draft-update")
    const observed: { replacement?: { draftRef: string; version: number } } = {}
    // Both source observations remain valid and the caller keeps the same case ACL.
    // Only the private draft advances, using the actual authorized registry API.
    fixture.controls.hook = { remaining: 2, run: async () => {
      const revised = await fixture.drafts.register(update, updateContext)
      if (revised.status !== "ok") throw new Error(revised.reason)
      observed.replacement = revised.value
    } }
    const read = await fixture.drafts.readCurrent({ caseRef, draftRef: registered.value.draftRef }, fixture.readContext)
    expect(read).toEqual({ status: "stale", reason: "hot-topic-draft-changed" })
    expect("value" in read).toBe(false)
    if (!observed.replacement) throw new Error("The source callback did not replace the private draft")
    expect(await fixture.drafts.readCurrent({ caseRef, draftRef: observed.replacement.draftRef }, fixture.readContext)).toMatchObject({ status: "ok", value: { version: 2, fields: update.fields } })
    expect(await fixture.drafts.readCurrent({ caseRef, draftRef: registered.value.draftRef }, fixture.readContext)).toEqual({ status: "stale", reason: "hot-topic-draft-changed" })
    const after = await fixture.readState()
    expect(after.cases).toEqual(before.cases)
    expect(after.versions.preferences).toBe(before.versions.preferences + 1)
    expect(after.versions.cases).toBe(before.versions.cases + 1)
    expect(after.confirmations).toEqual(before.confirmations)
    expect(after.receipts).toEqual(before.receipts)
    expect(fixture.access.allowed).toBe(true)
    expect(await fixture.official()).toEqual(official)
  } finally { await fixture.close() }
})

test("hot-topic list refuses a draft replaced during its last case authorization callback", async () => {
  const fixture = await hotTopicFixture()
  try {
    const context = await fixture.admit("decisions.draft-hot-topic", fixture.request, "list-original")
    const registered = await fixture.drafts.register(fixture.request, context)
    if (registered.status !== "ok") throw new Error(registered.reason)
    const before = await fixture.readState()
    const official = await fixture.official()
    const update: HotTopicDraftRequest = { ...fixture.request, draftRef: registered.value.draftRef, expectedVersion: 1, fields: { ...fixture.request.fields, action: "Revised private action after authorization" } }
    const updateContext = await fixture.admit("decisions.draft-hot-topic", update, "list-update")
    const observed: { replacement?: { draftRef: string; version: number } } = {}
    // One active draft: list admission, the reader's two case checks, then list's
    // final authorizeCase. The replacement keeps this case and its ACL unchanged.
    fixture.controls.caseHook = { remaining: 4, run: async () => {
      const revised = await fixture.drafts.register(update, updateContext)
      if (revised.status !== "ok") throw new Error(revised.reason)
      observed.replacement = revised.value
    } }
    const listed = await fixture.drafts.list({ caseRef }, fixture.readContext)
    expect(listed).toEqual({ status: "stale", reason: "hot-topic-draft-changed" })
    expect("value" in listed).toBe(false)
    if (!observed.replacement) throw new Error("The final case authorization did not replace the private draft")
    expect(await fixture.drafts.list({ caseRef }, fixture.readContext)).toEqual({ status: "ok", value: [{ draftRef: observed.replacement.draftRef, label: update.fields.action, version: 2, target: fixture.request.target }] })
    const after = await fixture.readState()
    expect(after.cases).toEqual(before.cases)
    expect(after.versions.preferences).toBe(before.versions.preferences + 1)
    expect(after.versions.cases).toBe(before.versions.cases + 1)
    expect(after.confirmations).toEqual(before.confirmations)
    expect(after.receipts).toEqual(before.receipts)
    expect(fixture.access.allowed).toBe(true)
    expect(await fixture.official()).toEqual(official)
  } finally { await fixture.close() }
})

async function hotTopicFixture() {
  const fixture = await plannerFixture()
  // The first Dashboard transaction and later C08 transactionAll require initialized registries.
  for (const surface of ["dashboard", "procurement"] as const) await fixture.persistence.initializeSources(surface)
  await fixture.persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admin-group", version: 1, by: actor.id }]
    snapshot.data.hotTopics = [{ id: "topic", action: "Review renewal", owner: actor.id, due: "2026-12-01", status: "open", priority: "normal", notes: "Original official topic" }]
    return { commit: true, value: undefined }
  })
  const intents = new WeakMap<Request, { action: SfHumanAction; digest: string; operation: string }>()
  const contexts: TrustedUiContext[] = []
  const authorize = async (request: Request) => fixture.access.allowed && intents.has(request) && request.headers.get("authorization") === actor.id
    ? { installationId: "i", projectId: "p", principalRef: actor.id, accessRevision: "1", policyVersion: "1" } : undefined
  const actions: SfHumanAction[] = ["decisions.portfolio.read", "decisions.draft-hot-topic"]
  const ui = createSfUiAuthority({ authorize, commandIdentity: async (request, operation, digest) => { const intent = intents.get(request); return intent && operation === `sf-human:${intent.action}` && digest === intent.digest ? intent.operation : undefined }, privateCommands: actions.map((action) => `sf-human:${action}`), createId: randomUUID, now: () => Date.parse(plannerAt) })
  const human = createSfHumanAuthority({ origin, ui })
  const admit = async (action: SfHumanAction, payload: unknown, operation: string) => {
    const request = new Request(origin, { method: "POST", headers: { authorization: actor.id, origin, "content-type": "application/json" }, body: JSON.stringify(payload) })
    intents.set(request, { action, digest: digestSfValue(payload), operation })
    const admitted = await human.admit(request, action, payload)
    if (admitted.status !== "ok") throw new Error(admitted.reason)
    contexts.push(admitted.value)
    return admitted.value
  }
  const host: DomainPortHost = { ...fixture.host, requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false) }
  const readContext = await admit("decisions.portfolio.read", { caseRef }, "read")
  const readRequest = host.requestFor(readContext)
  if (!readRequest) throw new Error("Read authority unavailable")
  const records = createDashboardRecordEvidenceHost({ host, scopedSources: fixture.persistence, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: fixture.persistence }) })
  const issued = await records.issue({ page: "Hot Topics & Actions", recordType: "hotTopics", recordId: "topic", fields: ["id", "action", "owner", "due", "status", "priority", "notes"], period: today }, readContext)
  if (issued.status !== "ok") throw new Error(issued.reason)
  const source = issued.value
  const request: HotTopicDraftRequest = { caseRef, expectedVersion: 0, target: { surface: "dashboard", type: "hotTopics", id: "topic", incarnation: source.target.incarnation, version: source.target.version, fields: source.target.fields, period: today, observedAt: plannerAt }, targetEvidence: source, sourceRefs: [source], fields: { action: "Review the prepared renewal change", owner: actor.id, due: "2026-12-03", priority: "high", notes: "Private human draft; no official command" } }
  const writes = new WeakSet<object>()
  const state = createSfProductState({ persistence: fixture.persistence, authorize, createId: randomUUID, proposalCoverageWrites: writes, resolveTarget: async (_request, _snapshot, _namespace, target) => target === caseRef.id ? { incarnation: caseRef.incarnation } : undefined })
  const seed: DecisionCase = { ...caseRef, state: "investigating", objective: "Prepare a topic without applying it", horizon: today, currency: "USD", criteria: [], participants: [actor.id], sourceRefs: [source], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const seeded = await state.transaction(readRequest, { namespace: "cases", expectedStorageVersion: 0, targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "seed", commandDigest: digestSfValue(seed) }, async (value) => { value.cases[caseRef.id] = seed; return { commit: true, value: true } })
  if (seeded.status !== "ok") throw new Error("Case setup unavailable")
  const readState = async () => { const current = await state.read(readRequest, "cases", (value) => value); if (current.status !== "ok") throw new Error("Private state unavailable"); return current.value }
  const controls: { snapshots: string[]; hook?: { remaining: number; run: () => Promise<void> }; caseHook?: { remaining: number; run: () => Promise<void> } } = { snapshots: [] }
  const snapshotMatches = (snapshot: Snapshot, context: TrustedDomainContext) => {
    const scopes = Object.values(snapshot.sfSources?.scopes ?? {}).filter((value) => value.alive && value.scope.principalRef === context.binding.principalRef && value.scope.accessRevision === context.binding.accessRevision && value.scope.policyVersion === context.binding.policyVersion && value.incarnation === source.target.incarnation && value.version === source.target.version)
    if (scopes.length !== 1) return false
    const projection = projectSfSourceScope("dashboard", snapshot, scopes[0]!.scope, plannerAt)
    return !!projection && digestSfValue(projection) === source.target.projectionDigest
  }
  const drafts = createHotTopicDraftStore({ state, host,
    authorizeCase: async (decision, context) => {
      const valid = decision.id === caseRef.id && decision.incarnation === caseRef.incarnation && decision.participants.includes(context.binding.principalRef) && await host.revalidate(context)
      const hook = controls.caseHook
      if (valid && hook && --hook.remaining === 0) { controls.caseHook = undefined; await hook.run() }
      return valid
    },
    authorizeDraft: (payload, context) => human.authorize(context, "decisions.draft-hot-topic", payload),
    verifySources: async (draft, context) => {
      const observed = await Promise.all(draft.sourceRefs.map((ref) => records.resolve(ref.refId, context)))
      const valid = observed.every((value, index) => value.status === "ok" && digestSfValue(value.value) === digestSfValue(draft.sourceRefs[index])) && await host.revalidate(context)
      const hook = controls.hook
      if (valid && hook && --hook.remaining === 0) { controls.hook = undefined; await hook.run() }
      return valid
    }, verifySnapshot: (snapshot, payload, draft, context) => {
      controls.snapshots.push(Array.isArray(snapshot.data.hotTopics) ? "dashboard" : "wrong-surface")
      return context.kind === "ui" && ui.matchesIntent(context, "sf-human:decisions.draft-hot-topic", digestSfValue(payload)) && digestSfValue(draft.targetEvidence) === digestSfValue(source) && snapshotMatches(snapshot, context)
    }, operationIdentity: (context) => context.kind === "ui" ? ui.operationIdentity(context) : undefined, proposalCoverageWrites: writes, createId: randomUUID, now: () => plannerAt,
  })
  const editCase = async () => {
    const current = await state.read(readRequest, "cases", (value) => value.cases[caseRef.id])
    if (current.status !== "ok" || !current.value) throw new Error("Concurrent case unavailable")
    const decision = current.value
    const edited = await state.transaction(readRequest, { namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "concurrent-edit", commandDigest: digestSfValue({ version: decision.version, objective: "Concurrent case edit" }) }, async (value) => { value.cases[caseRef.id] = { ...decision, version: decision.version + 1, objective: "Concurrent case edit" }; return { commit: true, value: true } })
    if (edited.status !== "ok") throw new Error("Concurrent case edit unavailable")
  }
  const official = async () => {
    const dashboard = await fixture.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: { data: Object.fromEntries(Object.entries(snapshot.data).filter(([key]) => key !== "__sfProductV1")), audit: snapshot.audit, versions: snapshot.versions, sequences: snapshot.sequences, notices: snapshot.notices } }))
    return { dashboard: structuredClone(dashboard), planner: await fixture.readSnapshot() }
  }
  return { access: fixture.access, admit, controls, drafts, editCase, official, persistence: fixture.persistence, readContext, readState, request, close: async () => { contexts.forEach(human.finish); await fixture.close() } }
}
