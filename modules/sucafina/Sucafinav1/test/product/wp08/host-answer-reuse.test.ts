import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createSfUiAuthority, createSfDomainAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfExecutionBindingRegistry } from "../../../product/host-binding/execution-context.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfBusinessContext } from "../../../product/host-binding/business-context.ts"
import { createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardSourceHost } from "../../../product/dashboard/sources.ts"
import { createDashboardPort } from "../../../product/dashboard/port.ts"
import { createDashboardConfirmationObserver } from "../../../product/dashboard/confirmation.ts"
import { createDashboardConfirmationIssuer } from "../../../product/dashboard/confirmation-issuer.ts"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createCollaborationHumanAuthority, collaborationHumanActions } from "../../../product/collaboration/human.ts"
import { createCollaborationHost } from "../../../product/collaboration/host.ts"
import type { WorkSignals } from "../../../product/collaboration/work-port.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainPortHost, PortResult } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

function ok<T>(result: PortResult<T>, label: string): T {
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error(`${label}: ${result.reason}`)
  return result.value
}

test("host-created capabilities consume a confirmed answer through shared dispatch and real Dashboard scope", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-host-answer-"))
  const store = await openLocalStore(directory)
  const at = "2026-11-13T00:00:00Z"
  const current = { allowed: true }
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "person" }]
      snapshot.data.access = { person: { assigned: [], domains: [] } }
      snapshot.data.summaries = ["Budget Overview", "Executive Dashboard"]
      snapshot.data.opexOwners = [{ id: "owner", budget: 1200 }]
      snapshot.data.opexEntries = [{ id: "jan", ownerId: "owner", year: 2026, month: 1, budget: 200, actual: 0, forecast: 0 }, { id: "feb", ownerId: "owner", year: 2026, month: 2, actual: 10 }]
      return { commit: true, value: undefined }
    })
    const ui = createSfUiAuthority({ authorize: async (request) => current.allowed && request.headers.get("actor") === "person" ? { installationId: "i", projectId: "p", principalRef: "person", accessRevision: "access", policyVersion: "policy" } : undefined, commandIdentity: async () => randomUUID(), createId: randomUUID, now: () => Date.parse(at), privateCommands: collaborationHumanActions.map((action) => `sf-human:${action}`) })
    const authority = createSfDomainAuthority({ ui, native: createSfExecutionBindingRegistry({ authenticateAndResolve: async () => undefined, revalidateAdmission: async () => false }) })
    const human = createCollaborationHumanAuthority({ origin: "https://example.test", ui })
    const host: DomainPortHost = { persistence, authenticate: async (request, options) => current.allowed && request.headers.get("actor") === "person" ? resolve("person", [...options!.roleMap], (group) => group === "admins") : null, environment: async () => ({ at, id: randomUUID, directory: [{ id: "person", name: "Person" }] }), requestFor: authority.requestFor, revalidate: authority.revalidateDomainContext }
    const request = () => new Request("https://example.test/product", { method: "POST", headers: { origin: "https://example.test", actor: "person" } })
    const read = await ui.admit(request(), "sf_work_list", digestSfValue({}))
    if (read.status !== "ok" || !await ui.validate(read.value, "sf_work_list", digestSfValue({}))) throw new Error("source admission failed")
    const period = { start: "2026-01-01", end: "2026-01-31" }
    const issued = await createDashboardSourceIssuer({ host, scopedSources: persistence })({ page: "Budget Overview", fields: ["budgetSeries"], period }, read.value)
    if (issued.status !== "ok") throw new Error("Dashboard source unavailable")
    const sources = createDashboardSourceHost({ host, scopedSources: persistence })
    const dashboard = createDashboardPort({ host, sources })
    const observer = createDashboardConfirmationObserver({ host, scopedSources: persistence, readProjection: (selection, context) => dashboard.read({ selectionRef: selection.reference, fields: selection.fields, period: selection.period }, context) })
    const evidence = createSfBusinessContext({ revalidate: host.revalidate, resolveSource: async (ref, context) => {
      const source = await sources.resolveDashboardSource(ref.refId, context)
      return { state: source.status === "ok" && digestSfValue(source.value.evidence) === digestSfValue(ref) ? "fresh" : "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: at }
    }, proveContinuity: async () => false, recall: async () => [], emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "", scanner: { name: "", version: "", status: "unavailable" }, reason: "not-selected" }) })
    const state = createSfProductState({ persistence, createId: randomUUID, resolveTarget: async () => ({ incarnation: "workspace-inc" }), authorize: async (candidate) => current.allowed && candidate.headers.get("actor") === "person" ? { principalRef: "person", accessRevision: "access", policyVersion: "policy" } : undefined })
    const source = issued.value.evidence
    const creationTarget = { ref: "workspace", incarnation: "workspace-inc" }
    const authorizeCase = async (value: DecisionCase, context: TrustedDomainContext) => value.participants.includes(context.binding.principalRef) && await host.revalidate(context)
    const cases = createDecisionCasePort({ state, host, creationTarget, operationIdentity: (context) => context.kind === "ui" ? ui.operationIdentity(context) : undefined, authorizeCase, evidence, createId: randomUUID, now: () => at })
    const caseDraft = { objective: "Review January answers", horizon: period, currency: "USD", criteria: ["January has a current answer"], sourceRefs: [source] }
    const caseContext = ok(await ui.admit(request(), "sf_case_draft", digestSfValue(caseDraft)), "case admission")
    if (!await ui.validate(caseContext, "sf_case_draft", digestSfValue(caseDraft))) throw new Error("case validation failed")
    const decision = ok(await cases.draft(caseDraft, caseContext), "case draft")
    const currentIssuer = createDashboardConfirmationIssuer({ host, scopedSources: persistence })
    const issueForActor = (target: Extract<BusinessEvidenceRef, { kind: "record" }>["target"], context: TrustedDomainContext) => currentIssuer({ recordType: target.recordType, recordId: target.recordId, fields: target.fields, period: target.period }, context)
    const workSignals: WorkSignals = async (_selectionRef, selectedPeriod, context) => {
      const issued = await createDashboardSourceIssuer({ host, scopedSources: persistence })({ page: "Executive Dashboard", fields: ["signals"], period: selectedPeriod }, context)
      if (issued.status !== "ok") return { status: "unavailable" }
      const projected = await dashboard.read({ selectionRef: issued.value.selectionRef, fields: ["signals"], period: selectedPeriod }, context)
      return projected.status === "ok" && projected.value.values.length === 0 && projected.value.missing.length === 0 ? { status: "ok", signals: [] } : { status: "unavailable" }
    }
    const factory = createCollaborationHost({ host, state, human, creationTarget, scopedSources: persistence, evidence, cases, workCaseAuthority: authorizeCase, issueForActor, prepareReissueScope: observer.prepareReissueScope, caseSelectionWrites: new WeakSet<object>(), workSignals, procurement: { list: async () => ({ status: "unavailable", reason: "not-selected" }) }, collections: { resolveRequestCollection: async () => ({ status: "unavailable", reason: "not-selected" }) }, confirmationSource: observer, authority, requiredAuthority: { sf_work_list: [], sf_question_prepare: [], sf_answer_read: [], sf_relation_read: [], sf_handoff_prepare: [] }, createId: randomUUID, now: () => at })
    if (!factory.caseSelection) throw new Error("case selection unavailable")
    const selectionDraft = { caseRef: encodeCaseRef(decision), period, sourceRefs: [source] }
    const selectionMutation = { expectedStorageVersion: 0, idempotencyKey: "select-January-answers" }
    const selected = ok(await factory.caseSelection.create(selectionDraft, selectionMutation, ok(await human.admit(request(), "collaboration.selection.create", { draft: selectionDraft, mutation: selectionMutation }), "selection admission")), "work selection")
    const selection = { selectionRef: selected.selectionRef, period }
    const domains = () => Promise.all((["dashboard", "planner", "procurement"] as const).map((surface) => persistence.transaction(surface, async (snapshot) => ({ commit: false, value: { data: Object.fromEntries(Object.entries(snapshot.data).filter(([key]) => key !== "__sfProductV1")), versions: snapshot.versions } }))))
    const beforeCollaboration = await domains()
    const draft = { kind: "clarification" as const, sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version, period, recipientRef: "person", body: "Is January unchanged?", evidenceRefs: [source] }
    const mutation = { expectedStorageVersion: 0, idempotencyKey: "question" }
    const create = await human.admit(request(), "collaboration.thread.create", { draft, mutation })
    if (create.status !== "ok") throw new Error("question admission failed")
    const thread = await factory.threads.create(draft, mutation, create.value)
    if (thread.status !== "ok") throw new Error(`question failed: ${thread.reason}`)
    const replyMutation = { expectedStorageVersion: 1, idempotencyKey: "reply" }
    const body = "January is unchanged."
    const reply = await human.admit(request(), "collaboration.thread.reply", { id: thread.value.id, body, mutation: replyMutation })
    if (reply.status !== "ok") throw new Error("reply admission failed")
    const answered = await factory.threads.reply(thread.value.id, body, replyMutation, reply.value)
    if (answered.status !== "ok") throw new Error(`reply failed: ${answered.reason}`)
    const message = answered.value.messages[1]
    if (!message || !factory.answerReuse) throw new Error("answer reuse unavailable")
    expect(ok(await factory.work.listPresentation(selection, read.value), "unconfirmed answer work").items).toMatchObject([{ kind: "clarification", actionRef: thread.value.id, state: "clarification-open" }])
    const answer = await factory.answerEvidence.issue(thread.value.id, message.id, read.value)
    if (answer.status !== "ok") throw new Error("answer evidence unavailable")
    const prepared = await factory.answerReuse.prepare(thread.value.id, answer.value.refId, read.value)
    if (prepared.status !== "ok") throw new Error(`answer observation failed: ${prepared.reason}`)
    const confirmation = { expectedStorageVersion: 2, idempotencyKey: "confirm-answer", observationRef: prepared.value.observationRef, observedSourceVersion: prepared.value.observedSourceVersion, expectedScopeFingerprint: prepared.value.expectedScopeFingerprint }
    const approved = await human.admit(request(), "collaboration.answer.confirm", { questionId: thread.value.id, answerRef: answer.value.refId, mutation: confirmation })
    if (approved.status !== "ok") throw new Error("answer confirmation admission failed")
    expect(await factory.answerReuse.confirm(thread.value.id, answer.value.refId, confirmation, approved.value)).toMatchObject({ status: "ok", value: { observedVersion: source.target.version } })
    expect(ok(await factory.work.listPresentation(selection, read.value), "confirmed answer has no pending request").items).toEqual([])
    expect(ok(await factory.threads.read(thread.value.id, read.value), "question remains open").state).toBe("open")
    expect(await domains()).toEqual(beforeCollaboration)
    const dispatch = async () => {
      const payload = { questionRef: thread.value.id }
      const admitted = await ui.admit(request(), "sf_answer_read", digestSfValue(payload))
      if (admitted.status !== "ok") throw new Error("answer read admission failed")
      return dispatchSfCapability({ operation: "sf_answer_read", payload, context: admitted.value, descriptors: factory.capabilities, authority, validateInput: (_descriptor, value) => decodeSfOperationInput("sf_answer_read", value).ok, validateOutput: (_descriptor, value) => value.status !== "ok" || decodeSfOperationOutput("sf_answer_read", value.result).ok })
    }
    expect(await dispatch()).toMatchObject({ status: "ok", result: { questionRef: thread.value.id, answer: body, state: "confirmed" } })
    await persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.opexEntries as { actual: number }[])[1]!.actual = 80; return { commit: true, value: undefined } })
    expect(await dispatch()).toMatchObject({ status: "ok", result: { answer: body, state: "confirmed" } })
    expect(ok(await factory.answerReuse.read(thread.value.id, read.value), "irrelevant change retains observed version")).toMatchObject({ answer: body, authorRef: "person", observedVersion: source.target.version })
    expect(ok(await factory.work.listPresentation(selection, read.value), "February does not reopen January work").items).toEqual([])
    const resolution = { expectedStorageVersion: 3, idempotencyKey: "resolve-question" }
    const resolved = ok(await factory.threads.resolve(thread.value.id, resolution, ok(await human.admit(request(), "collaboration.thread.resolve", { id: thread.value.id, mutation: resolution }), "resolution admission")), "question resolution")
    expect(resolved.state).toBe("resolved")
    expect(await dispatch()).toMatchObject({ status: "ok", result: { answer: body, state: "confirmed" } })
    const history = await state.read(request(), "threads", (value) => value.threads)
    if (history.status !== "ok") throw new Error("history unavailable")
    await persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.opexEntries as { actual: number }[])[0]!.actual = 90; return { commit: true, value: undefined } })
    const afterMaterialChange = await domains()
    expect((await evidence.context({ refs: [source] }, read.value))[0]?.state).toBe("unavailable")
    const pending = ok(await factory.work.listPresentation(selection, read.value), "one material answer review")
    expect(pending.list.items).toHaveLength(1)
    expect(pending.items).toHaveLength(1)
    expect(pending.items[0]).toMatchObject({ kind: "clarification", actionRef: thread.value.id, state: "answer-stale", title: null, reason: "material-change", observedVersion: source.target.version, sourceVersion: source.target.version + 1, destination: { kind: "thread", threadId: thread.value.id } })
    expect(pending.items[0]!.sourceRefs.every((ref) => ref.refDigest !== source.refDigest)).toBe(true)
    expect((await evidence.context({ refs: pending.items[0]!.sourceRefs }, read.value)).every((entry) => entry.state === "fresh")).toBe(true)
    expect(JSON.stringify(pending)).not.toContain(body)
    expect(ok(await factory.work.listPresentation(selection, read.value), "same answer review identity")).toEqual(pending)
    const afterHistory = await state.read(request(), "threads", (value) => value.threads)
    expect(afterHistory.status === "ok" && digestSfValue(afterHistory.value)).toBe(digestSfValue(history.value))
    expect(await domains()).toEqual(afterMaterialChange)
    current.allowed = false
    expect((await factory.answerReuse.read(thread.value.id, read.value)).status).not.toBe("ok")
    const revokedWork = await factory.work.listPresentation(selection, read.value)
    expect(revokedWork.status).not.toBe("ok")
    expect("value" in revokedWork).toBe(false)
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
