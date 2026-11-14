import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { rows } from "../../../runtime/contract.ts"
import { resolve } from "../../../src/identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createSfUiAuthority, createSfDomainAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfExecutionBindingRegistry } from "../../../product/host-binding/execution-context.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfBusinessContext } from "../../../product/host-binding/business-context.ts"
import { createDashboardSourceIssuer, createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardSourceHost, createDashboardRecordEvidenceHost } from "../../../product/dashboard/sources.ts"
import { createDashboardPort } from "../../../product/dashboard/port.ts"
import { createProcurementCollectionRegistry, createProcurementSourceResolver } from "../../../product/procurement/sources.ts"
import { createProcurementPort } from "../../../product/procurement/port.ts"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createCollaborationHumanAuthority, collaborationHumanActions } from "../../../product/collaboration/human.ts"
import { createCollaborationHost } from "../../../product/collaboration/host.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import type { DomainPortHost, PortResult } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

function admitted<T>(result: PortResult<T>, action: string): T {
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error(`${action}: ${result.reason}`)
  return result.value
}

// This starts with an actual Dashboard record and a contextual review request.
// It does not exercise a WP07 preserved review or native model/MCP admission.
test("contextual request → explicit confirmation → one canonical Hot Topic → completion in My Work", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-collaboration-journey-"))
  const store = await openLocalStore(directory)
  const at = "2026-11-13T00:00:00Z"
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const actor = { active: true }
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "person" }]
      snapshot.data.access = { person: { assigned: [], domains: [] } }
      snapshot.data.summaries = ["Executive Dashboard", "All Projects", "Hot Topics & Actions"]
      const result = DashboardPortfolio.domain.execute(snapshot, { id: "person", canWrite: true, roles: ["admin"] }, { page: "All Projects", action: "save", version: 0, values: { name: "Delivery review", status: "In Progress", risk: "Low" } }, { at, id: () => "project-A", directory: [{ id: "person", name: "Person" }] })
      if (!result.ok) throw new Error(`canonical project seed failed: ${result.errors?.join(", ")}`)
      return { commit: true, value: undefined }
    })
    const request = () => new Request("https://example.test/product", { method: "POST", headers: { origin: "https://example.test", actor: "person" } })
    const ui = createSfUiAuthority({ authorize: async (candidate) => actor.active && candidate.headers.get("actor") === "person" ? { installationId: "installation", projectId: "project", principalRef: "person", accessRevision: "access", policyVersion: "policy" } : undefined, commandIdentity: async () => randomUUID(), createId: randomUUID, now: () => Date.parse(at), privateCommands: collaborationHumanActions.map((action) => `sf-human:${action}`) })
    const authority = createSfDomainAuthority({ ui, native: createSfExecutionBindingRegistry({ authenticateAndResolve: async () => undefined, revalidateAdmission: async () => false }) })
    const human = createCollaborationHumanAuthority({ origin: "https://example.test", ui })
    const host: DomainPortHost = { persistence, authenticate: async (candidate, options) => actor.active && candidate.headers.get("actor") === "person" ? resolve("person", [...options!.roleMap], (group) => group === "admins") : null, environment: async () => ({ at, id: randomUUID, directory: [{ id: "person", name: "Person" }] }), requestFor: authority.requestFor, revalidate: authority.revalidateDomainContext }
    const readContext = async (operation: string, payload: unknown) => {
      const value = admitted(await ui.admit(request(), operation, digestSfValue(payload)), operation)
      if (!await ui.validate(value, operation, digestSfValue(payload))) throw new Error(`${operation} validation failed`)
      return value
    }
    const read = await readContext("sf_work_list", { selectionRef: "discovery", period })
    const issuePage = createDashboardSourceIssuer({ host, scopedSources: persistence })
    const pages = createDashboardSourceHost({ host, scopedSources: persistence })
    const dashboard = createDashboardPort({ host, sources: pages })
    const records = createDashboardRecordEvidenceHost({ host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: persistence }) })
    const source = admitted(await records.issue({ page: "All Projects", recordType: "projects", recordId: "project-A", fields: ["status"], period }, read), "project source")
    expect(admitted(await records.read(source.refId, read), "project projection").values).toMatchObject([{ value: "In Progress" }])
    const evidence = createSfBusinessContext({ revalidate: host.revalidate, resolveSource: async (ref, context) => {
      const result = await records.resolve(ref.refId, context)
      return { state: result.status === "ok" && digestSfValue(result.value) === digestSfValue(ref) ? "fresh" : "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: at }
    }, proveContinuity: async () => false, recall: async () => [], emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "", scanner: { name: "", version: "", status: "unavailable" }, reason: "not-selected" }) })
    const creationTarget = { ref: "workspace", incarnation: "workspace-inc" }
    const state = createSfProductState({ persistence, createId: randomUUID, resolveTarget: async () => ({ incarnation: creationTarget.incarnation }), authorize: async (candidate) => actor.active && candidate.headers.get("actor") === "person" ? { principalRef: "person", accessRevision: "access", policyVersion: "policy" } : undefined })
    const cases = createDecisionCasePort({ host, state, creationTarget, operationIdentity: (context) => context.kind === "ui" ? ui.operationIdentity(context) : undefined, authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef) && await host.revalidate(context), evidence, createId: randomUUID, now: () => at })
    const draft = { objective: "Review the current delivery and assign its follow-up", horizon: period, currency: "USD", criteria: ["Delivery follow-up is resolved"], sourceRefs: [source] }
    const decision = admitted(await cases.draft(draft, await readContext("sf_case_draft", draft)), "case draft")
    const caseRef = encodeCaseRef(decision)
    const contextFor = async (context: TrustedDomainContext) => ({ status: "ok" as const, value: { installationId: context.binding.installationId, projectId: context.binding.projectId, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, surface: "procurement" as const, period, currency: "USD", sourceRefs: [], capabilities: [] } })
    const collections = createProcurementCollectionRegistry({ host, scopedSources: persistence, contextFor })
    const individual = createProcurementSourceResolver({ host, scopedSources: persistence, contextFor })
    const procurement = createProcurementPort({ ...host, ...collections, resolveSupplierSource: individual.resolve, isCurrentSupplierSource: individual.isCurrent, readContractSource: async () => ({ status: "unavailable", reason: "not-selected" }) })
    const factory = createCollaborationHost({ host, state, creationTarget, scopedSources: persistence, evidence, cases, procurement, collections, human, authority, caseSelectionWrites: new WeakSet(),
      // The selected real fixture has no canonical Dashboard signal. A nonempty or
      // unavailable producer result must fail this absence, never become an empty queue.
      workSignals: async (_selectionRef, selectedPeriod, context) => {
        const issued = await issuePage({ page: "Executive Dashboard", fields: ["signals"], period: selectedPeriod }, context)
        if (issued.status !== "ok") return { status: "unavailable" }
        const projected = await dashboard.read({ selectionRef: issued.value.selectionRef, fields: ["signals"], period: selectedPeriod }, context)
        return projected.status === "ok" && projected.value.values.length === 0 && projected.value.missing.length === 0 ? { status: "ok", signals: [] } : { status: "unavailable" }
      }, requiredAuthority: { sf_work_list: [], sf_question_prepare: [], sf_answer_read: [], sf_relation_read: [], sf_handoff_prepare: [] }, createId: randomUUID, now: () => at })
    if (!factory.caseSelection) throw new Error("real case selection unavailable")
    const selectionDraft = { caseRef, period, sourceRefs: [source] }
    const selectionMutation = { expectedStorageVersion: 0, idempotencyKey: "journey-selection" }
    const selectionContext = admitted(await human.admit(request(), "collaboration.selection.create", { draft: selectionDraft, mutation: selectionMutation }), "selection confirmation")
    const selected = admitted(await factory.caseSelection.create(selectionDraft, selectionMutation, selectionContext), "case selection")
    const selection = { selectionRef: selected.selectionRef, period }
    const question = { caseRef, question: { text: "Review the project and confirm its delivery follow-up", criterionRef: decision.criteria[0]!.id }, recipientRef: "person", sourceRefs: [source] }
    const preparationContext = admitted(await ui.admit(request(), "sf_question_prepare", digestSfValue(question)), "question preparation")
    const prepared = await dispatchSfCapability({ operation: "sf_question_prepare", payload: question, context: preparationContext, descriptors: factory.capabilities, authority, validateInput: (_descriptor, value) => decodeSfOperationInput("sf_question_prepare", value).ok, validateOutput: (_descriptor, value) => value.status !== "ok" || decodeSfOperationOutput("sf_question_prepare", value.result).ok })
    expect(prepared).toMatchObject({ status: "ok", result: { question: question.question.text, recipientRef: "person", expectedCaseVersion: decision.version } })
    const threadDraft = { kind: "review" as const, sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version, period, recipientRef: "person", body: question.question.text, evidenceRefs: [source] }
    const threadMutation = { expectedStorageVersion: 0, idempotencyKey: "journey-review-request" }
    const threadContext = admitted(await human.admit(request(), "collaboration.thread.create", { draft: threadDraft, mutation: threadMutation }), "request confirmation")
    const thread = admitted(await factory.threads.create(threadDraft, threadMutation, threadContext), "contextual request")
    const topics = () => persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(rows(snapshot.data.hotTopics)) }))
    expect(await topics()).toHaveLength(0)
    const handoff = { intent: { correlationKey: "journey-action", sourceRefs: [source], action: "Confirm delivery follow-up", owner: "Person", due: "2026-12-01", priority: "normal" as const, notes: "" }, sourceRef: source.refId, recipientRef: "person", relationKey: "journey-link" }
    expect((await factory.handoff.create(handoff, read)).status).toBe("denied")
    expect(await topics()).toHaveLength(0)
    const confirmation = admitted(await human.admit(request(), "collaboration.handoff.confirm", handoff), "handoff confirmation")
    const created = admitted(await factory.handoff.create(handoff, confirmation), "canonical handoff")
    expect(created).toMatchObject({ state: "created", topic: { status: "open", owner: "Person" } })
    const retry = admitted(await human.admit(request(), "collaboration.handoff.confirm", handoff), "handoff retry confirmation")
    expect(admitted(await factory.handoff.create(handoff, retry), "idempotent handoff")).toMatchObject({ state: "existing", topic: { id: created.topic.id }, relationId: created.relationId })
    expect(await topics()).toHaveLength(1)
    const originalRelation = await state.read(request(), "relations", (value) => value.relations[created.relationId])
    if (originalRelation.status !== "ok") throw new Error("original relation unavailable")
    const open = admitted(await factory.work.listPresentation(selection, read), "open work")
    expect(open.items.filter((item) => item.kind === "handoff")).toMatchObject([{ state: "open", destination: { kind: "hot-topic", topicId: created.topic.id } }])
    expect(open.items.filter((item) => item.kind === "handoff")).toHaveLength(1)
    expect(open.items.filter((item) => item.kind === "clarification")).toMatchObject([{ state: "clarification-open", destination: { kind: "thread", threadId: thread.id } }])
    const resolveMutation = { expectedStorageVersion: 1, idempotencyKey: "journey-request-resolved" }
    const resolvedContext = admitted(await human.admit(request(), "collaboration.thread.resolve", { id: thread.id, mutation: resolveMutation }), "request resolution")
    admitted(await factory.threads.resolve(thread.id, resolveMutation, resolvedContext), "resolved request")
    const afterRequest = admitted(await factory.work.listPresentation(selection, read), "work after request resolution")
    expect(afterRequest.items).toHaveLength(1)
    expect(afterRequest.items[0]).toMatchObject({ kind: "handoff", state: "open", destination: { topicId: created.topic.id } })
    const completion = { topicId: created.topic.id, expectedVersion: created.topic.version, idempotencyKey: "journey-action-completed", values: { status: "done" }, sourceRefs: [source], sourceRef: source.refId, recipientRef: "person", relationKey: "journey-completion-link" }
    const completionContext = admitted(await human.admit(request(), "collaboration.handoff.confirm", completion), "completion confirmation")
    expect(admitted(await factory.handoff.update(completion, completionContext), "canonical completion")).toMatchObject({ state: "updated", topic: { id: created.topic.id, status: "done" } })
    const completed = admitted(await factory.work.listPresentation(selection, read), "completed work")
    expect(completed.items).toHaveLength(1)
    expect(completed.items[0]).toMatchObject({ kind: "handoff", state: "done", destination: { kind: "hot-topic", topicId: created.topic.id } })
    expect((await topics()).map((topic) => ({ id: topic.id, status: topic.status }))).toEqual([{ id: created.topic.id, status: "done" }])
    const retained = await state.read(request(), "relations", (value) => value.relations[created.relationId])
    expect(retained.status === "ok" && digestSfValue(retained.value)).toBe(digestSfValue(originalRelation.value))
    const again = admitted(await factory.work.listPresentation(selection, read), "repeated completed work")
    expect(again).toEqual(completed)
    // A restored record reusing the text ID cannot inherit the original assignment.
    const oldTopic = (await topics())[0]!
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.hotTopics = []; return { commit: true, value: undefined } })
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.hotTopics = [{ ...oldTopic, action: "Replacement without this handoff", status: "open" }]; return { commit: true, value: undefined } })
    const replaced = await factory.work.listPresentation(selection, read)
    expect(replaced.status).toBe("unavailable")
    expect(JSON.stringify(replaced)).not.toContain("Replacement without this handoff")
    actor.active = false
    const revoked = await factory.work.listPresentation(selection, read)
    expect(revoked.status).toBe("denied")
    expect("value" in revoked).toBe(false)
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
