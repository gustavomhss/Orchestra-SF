import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { SfProductStatePort } from "../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createHotTopicDraftStore } from "../../../product/decisions/hot-topic-draft.ts"
import type { HotTopicDraftRequest } from "../../../product/decisions/hot-topic-draft.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { object, type Snapshot } from "../../../runtime/contract.ts"

/** Real C08/local-store surface selection. Grants and the source verifier are
 * explicit fixture boundaries; this does not exercise installed human authority. */
test("Hot Topic drafts verify the Dashboard snapshot, persist once without domain application and reject a source race", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-hot-topic-draft-domain-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const at = "2026-11-14T00:00:00Z"
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const request = new Request("https://example.test/hot-topic")
  const identity = { installationId: "install", projectId: "project", principalRef: "leader", policyVersion: "policy", accessRevision: "access" }
  const clock = { now: Date.parse(at) }
  const ui = createSfUiAuthority({ authorize: async (source) => source === request ? identity : undefined, commandIdentity: async () => "hot-topic-ui", createId: () => "hot-topic-ui", now: () => clock.now })
  const caseRef = { id: "hot-topic-case", incarnation: "hot-topic-case-inc", version: 1 }
  const admission = await ui.admit(request, "sf_case_read", digestSfValue({ caseRef: "fixture" }))
  if (admission.status !== "ok" || !await ui.validate(admission.value, "sf_case_read", digestSfValue({ caseRef: "fixture" }))) throw new Error("Fixture UI admission unavailable")
  let context = admission.value
  const host = { requestFor: (call: TrustedDomainContext) => call.kind === "ui" ? ui.requestFor(call) : undefined, revalidate: (call: TrustedDomainContext) => call.kind === "ui" ? ui.revalidate(call) : Promise.resolve(false) }
  const writes = new WeakSet<object>()
  const control = { human: false, race: false, operation: "draft-once", checks: 0, ids: 0 }
  const leaseRace: { afterAuthorization?: (namespace: string, mode: "read" | "write") => Promise<void>; afterDraftAuthorization?: () => Promise<void> } = {}
  const original = { id: "topic", action: "Review transition", owner: "leader", due: "2027-11-01", priority: "normal", notes: "Original Dashboard source" }
  const current = (snapshot: Snapshot) => {
    const topics = snapshot.data.hotTopics
    return Array.isArray(topics) && topics.filter((value) => object(value).id === original.id).length === 1 && digestSfValue(topics.find((value) => object(value).id === original.id)) === digestSfValue(original)
  }
  try {
    await store.transaction("dashboard", async (snapshot) => { snapshot.data.hotTopics = [original]; return { commit: true, value: true } })
    // This deliberately different row makes selecting Planner fail the source verifier.
    await store.transaction("planner", async (snapshot) => { snapshot.data.hotTopics = [{ ...original, notes: "Unrelated Planner content" }]; return { commit: true, value: true } })
    const persisted = createSfProductState({ persistence: store, proposalCoverageWrites: writes,
      authorize: async (source, _snapshot, namespace, mode) => {
        const authority = source === request && await host.revalidate(context) ? identity : undefined
        if (authority) await leaseRace.afterAuthorization?.(namespace, mode)
        return authority
      },
      resolveTarget: async () => ({ incarnation: caseRef.incarnation }), createId: () => "hot-topic-state-inc" })
    const state: SfProductStatePort = { ...persisted, transaction: async (source, command, work) => {
      if (control.race && command.idempotencyKey.startsWith("hot-topic-draft:")) {
        control.race = false
        await store.transaction("dashboard", async (snapshot) => { snapshot.data.hotTopics = [{ ...original, notes: "Concurrent Dashboard update" }]; return { commit: true, value: true } })
      }
      return persisted.transaction(source, command, work)
    } }
    const decision: DecisionCase = { ...caseRef, state: "draft", objective: "Review an explicit Hot Topic draft", currency: "USD", horizon: period, criteria: [], participants: [identity.principalRef], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seeded = await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "case-seed", commandDigest: digestSfValue(decision) }, async (value) => { value.cases[caseRef.id] = decision; return { commit: true, value: true } })
    if (seeded.status !== "ok") throw new Error("Fixture C08 seed unavailable")
    const target: HotTopicDraftRequest["target"] = { surface: "dashboard", type: "hotTopics", id: original.id, incarnation: "topic-inc", version: 1, fields: ["action", "owner", "due", "priority", "notes"], period, observedAt: at }
    const unsigned: HotTopicDraftRequest["targetEvidence"] = { schema: "sf-evidence-v1", kind: "record", refId: "topic-evidence", installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", target: { surface: "dashboard", recordType: "hotTopics", recordId: original.id, incarnation: target.incarnation, version: target.version, fields: target.fields, period, projectionDigest: digestSfValue(original) } }
    const targetEvidence = { ...unsigned, refDigest: digestSfEvidenceRef(unsigned) }
    const input: HotTopicDraftRequest = { caseRef, target, targetEvidence, fields: { action: "Prepare revised transition", owner: "leader", due: "2027-11-30", priority: "high", notes: "Prepared, not applied" }, sourceRefs: [targetEvidence], expectedVersion: 0 }
    const drafts = createHotTopicDraftStore({ state, host, proposalCoverageWrites: writes,
      authorizeCase: async (value, call) => value.participants.includes(call.binding.principalRef) && await host.revalidate(call),
      authorizeDraft: async () => { const allowed = control.human; await leaseRace.afterDraftAuthorization?.(); return allowed },
      verifySources: async (draft, call) => digestSfValue(draft.targetEvidence) === digestSfValue(targetEvidence) && await host.revalidate(call) && await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: current(snapshot) })),
      verifySnapshot: (snapshot) => { control.checks++; return !!store.currentSnapshots?.() && current(snapshot) },
      operationIdentity: () => control.operation, createId: () => `hot-topic-${++control.ids}`, now: () => at,
    })
    const plannerBefore = await store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))
    expect((await drafts.register(input, context)).status).toBe("denied")
    expect(control.checks).toBe(0)
    control.human = true
    const saved = await drafts.register(input, context)
    if (saved.status !== "ok") throw new Error(`Dashboard draft: ${JSON.stringify(saved)}`)
    expect(control.checks).toBe(1)
    const restored = await drafts.readCurrent({ caseRef, draftRef: saved.value.draftRef }, context)
    if (restored.status !== "ok") throw new Error("Persisted draft unavailable")
    expect(restored.value.fields).toEqual(input.fields)
    expect(restored.value.target).toEqual(target)
    expect(await drafts.register(input, context)).toEqual(saved)
    expect(control.checks).toBe(1)
    const before = await state.read(request, "preferences", (value) => value.preferences)
    if (before.status !== "ok") throw new Error("Saved draft metadata unavailable")
    expect(Object.keys(before.value).filter((key) => key.startsWith("sf:proposal-coverage:hot-topic:"))).toHaveLength(2)
    expect(await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: current(snapshot) }))).toBe(true)
    expect(await store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))).toBe(plannerBefore)
    // Read/list each reach their final C08 post-callback authorization with the
    // same case, draft and grants. Finishing or expiring only the UI lease must
    // suppress that egress, without deleting the successfully persisted draft.
    for (const route of ["read", "list", "retry"] as const) for (const end of ["finished", "expired"] as const) {
      const exercise = () => route === "read" ? drafts.readCurrent({ caseRef, draftRef: saved.value.draftRef }, context) : route === "list" ? drafts.list({ caseRef }, context) : drafts.register(input, context)
      expect((await exercise()).status).toBe("ok")
      const previous = context
      let namespaceChecks = 0
      let applied = false
      const finalAuthorization = route === "read" ? 6 : route === "list" ? 12 : 2
      const endAfterAuthorization = async () => {
        if (++namespaceChecks !== finalAuthorization) return
        if (end === "finished") ui.finish(previous)
        else clock.now += 300_001
        applied = true
      }
      if (route === "retry") leaseRace.afterDraftAuthorization = endAfterAuthorization
      else leaseRace.afterAuthorization = async (namespace, mode) => { if (namespace === "preferences" && mode === "read") await endAfterAuthorization() }
      try {
        const denied = await exercise()
        expect({ namespaceChecks, applied }).toEqual({ namespaceChecks: finalAuthorization, applied: true })
        expect(denied).toEqual(route === "retry" ? { status: "unavailable", reason: "hot-topic-draft-unavailable" } : { status: "stale", reason: "hot-topic-draft-changed" })
        expect(denied).not.toHaveProperty("value")
        expect(request.signal.aborted).toBe(false)
        expect(ui.requestFor(previous)).toBeUndefined()
        expect(await ui.revalidate(previous)).toBe(false)
      } finally {
        leaseRace.afterAuthorization = undefined
        leaseRace.afterDraftAuthorization = undefined
        const renewed = await ui.admit(request, "sf_case_read", digestSfValue({ caseRef: "fixture" }))
        if (renewed.status !== "ok" || !await ui.validate(renewed.value, "sf_case_read", digestSfValue({ caseRef: "fixture" }))) throw new Error("Renewed draft reader unavailable")
        context = renewed.value
      }
      expect(await drafts.readCurrent({ caseRef, draftRef: saved.value.draftRef }, context)).toEqual(restored)
      expect(await drafts.list({ caseRef }, context)).toEqual({ status: "ok", value: [{ draftRef: saved.value.draftRef, label: input.fields.action, version: saved.value.version, target }] })
      expect(await state.read(request, "preferences", (value) => value.preferences)).toEqual(before)
      expect(await store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))).toBe(plannerBefore)
      expect(control.checks).toBe(1)
    }
    control.operation = "draft-race"
    control.race = true
    const rejected = await drafts.register({ ...input, fields: { ...input.fields, notes: "Must not persist" } }, context)
    expect(rejected.status).not.toBe("ok")
    expect(control.checks).toBe(2)
    const after = await state.read(request, "preferences", (value) => ({ preferences: value.preferences, decision: value.cases[caseRef.id] }))
    if (after.status !== "ok") throw new Error("Draft metadata after race unavailable")
    expect(after.value.preferences).toEqual(before.value)
    expect(after.value.decision).toEqual(decision)
    expect(await store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))).toBe(plannerBefore)
  } finally { ui.finish(context); await store.dispose(); await rm(directory, { recursive: true, force: true }) }
}, 60000)
