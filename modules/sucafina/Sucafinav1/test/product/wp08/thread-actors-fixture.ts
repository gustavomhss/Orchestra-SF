import { randomUUID } from "node:crypto"
import { resolve } from "../../../src/identity.ts"
import { createSfUiAuthority, createSfDomainAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfExecutionBindingRegistry } from "../../../product/host-binding/execution-context.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfBusinessContext } from "../../../product/host-binding/business-context.ts"
import { createDashboardRecordSourceIssuer, createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardRecordEvidenceHost, createDashboardSourceHost } from "../../../product/dashboard/sources.ts"
import { createDashboardPort } from "../../../product/dashboard/port.ts"
import { createDashboardConfirmationObserver } from "../../../product/dashboard/confirmation.ts"
import { createDashboardConfirmationIssuer } from "../../../product/dashboard/confirmation-issuer.ts"
import { createCollaborationAuthority } from "../../../product/collaboration/authority.ts"
import { createCollaborationReissuer } from "../../../product/collaboration/reissue.ts"
import { createWorkSourceRefresh } from "../../../product/collaboration/work-source-refresh.ts"
import { createCollaborationHost } from "../../../product/collaboration/host.ts"
import { collaborationHumanActions, createCollaborationHumanAuthority } from "../../../product/collaboration/human.ts"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { CollaborationHumanAction } from "../../../product/collaboration/human.ts"
import type { CollaborationRecipientAuthority } from "../../../product/collaboration/recipient-authority.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { available, createRelationsFixture } from "./relations-fixture.ts"

/** Real SQLite, domain selectors, UI admissions, actor scopes and Dashboard historical access verifier.
 * Recipient leases and capture archive remain explicit fixture boundaries; this is not a native/host witness.
 */
export async function createThreadActorsFixture() {
  const base = await createRelationsFixture()
  const at = "2026-11-13T00:00:00Z"
  const actors: Record<string, { enabled: boolean; access: string; group: string; name: string }> = {
    person: { enabled: true, access: "a1", group: "admins", name: "Author" },
    "reader-b": { enabled: true, access: "b1", group: "viewers", name: "Alex" },
    "reader-c": { enabled: true, access: "c1", group: "viewers", name: "Alex" },
  }
  await base.persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "person" }, { surface: "dashboard", role: "viewer", entra: "viewers", version: 1, by: "person" }]
    snapshot.data.access = Object.fromEntries(Object.keys(actors).map((id) => [id, { assigned: [], domains: [] }]))
    snapshot.data.summaries = ["All Projects", "Portfolio Dashboard", "Hot Topics & Actions", "Executive Dashboard"]
    return { commit: true, value: undefined }
  })
  const request = (id: string) => new Request("https://example.test/product", { method: "POST", headers: { origin: "https://example.test", actor: id } })
  const identity = (candidate: Request) => {
    const principalRef = candidate.headers.get("actor") ?? ""
    const actor = actors[principalRef]
    return actor?.enabled ? { installationId: "installation", projectId: "project", principalRef, accessRevision: actor.access, policyVersion: "policy" } : undefined
  }
  const ui = createSfUiAuthority({ authorize: async (candidate) => identity(candidate), commandIdentity: async () => randomUUID(), createId: randomUUID, now: () => Date.parse(at), privateCommands: collaborationHumanActions.map((action) => `sf-human:${action}`) })
  const domainAuthority = createSfDomainAuthority({ ui, native: createSfExecutionBindingRegistry({ authenticateAndResolve: async () => undefined, revalidateAdmission: async () => false }) })
  const human = createCollaborationHumanAuthority({ origin: "https://example.test", ui })
  const host: DomainPortHost = { persistence: base.persistence, requestFor: domainAuthority.requestFor, revalidate: domainAuthority.revalidateDomainContext,
    authenticate: async (candidate, options) => {
      const authority = identity(candidate)
      return authority && options ? resolve(authority.principalRef, [...options.roleMap], (group) => group === actors[authority.principalRef]!.group) : null
    },
    environment: async () => ({ at, id: randomUUID, directory: Object.entries(actors).map(([id, actor]) => ({ id, name: actor.name })) }),
  }
  const contexts = new Map<string, TrustedUiContext>()
  const admitRead = async (id: string) => {
    const context = available(await ui.admit(request(id), "sf_work_list", digestSfValue({})))
    if (!await ui.validate(context, "sf_work_list", digestSfValue({}))) throw new Error("actor read unavailable")
    contexts.set(id, context)
    return context
  }
  const admit = async (id: string, action: CollaborationHumanAction, payload: unknown) => available(await human.admit(request(id), action, payload))
  const author = await admitRead("person")
  const recipient = await admitRead("reader-b")
  const homonym = await admitRead("reader-c")
  const threadHistoryWrites = new WeakSet<object>()
  const caseSelectionWrites = new WeakSet<object>()
  const state = createSfProductState({ persistence: base.persistence, createId: randomUUID, resolveTarget: async () => ({ incarnation: base.creationTarget.incarnation }), authorize: async (candidate) => identity(candidate), threadHistoryWrites, caseSelectionWrites })
  const records = createDashboardRecordEvidenceHost({ host, scopedSources: base.persistence, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: base.persistence }) })
  const pageSources = createDashboardSourceHost({ host, scopedSources: base.persistence })
  const dashboard = createDashboardPort({ host, sources: pageSources })
  const observer = createDashboardConfirmationObserver({ host, scopedSources: base.persistence, readProjection: (selection, context) => selection.recordType === "dashboard-page" ? dashboard.read({ selectionRef: selection.reference, fields: selection.fields, period: selection.period }, context) : records.read(selection.reference, context) })
  const currentIssuer = createDashboardConfirmationIssuer({ host, scopedSources: base.persistence })
  const issueForActor: NonNullable<Parameters<typeof createCollaborationHost>[0]["issueForActor"]> = (target, context) => currentIssuer({ recordType: target.recordType, recordId: target.recordId, fields: target.fields, period: target.period }, context)
  const historical = { allowed: false }
  const archived = new Map<string, { ref: BusinessEvidenceRef; projection: DomainProjection }>()
  const historicalAccess = async (ref: BusinessEvidenceRef, context: TrustedDomainContext) => {
    if (ref.kind !== "record") return false
    const grant = await observer.prepareHistoricalReissue(ref, context)
    return grant.status === "ok" && await base.persistence.transactionAll!(async () => ({ commit: false, value: await grant.value.fence() }))
  }
  const evidence = createSfBusinessContext({ revalidate: host.revalidate, resolveSource: async (ref, context): Promise<BusinessEvidenceResolution> => {
    const fresh = ref.kind === "record" && ref.target.surface === "dashboard" ? await records.resolve(ref.refId, context) : undefined
    if (fresh?.status === "ok" && digestSfValue(fresh.value) === digestSfValue(ref)) return { state: "fresh", ref, accessRevision: context.binding.accessRevision, checkedAt: at }
    const original = archived.get(ref.refDigest)
    if (!historical.allowed || !original || digestSfValue(original.ref) !== digestSfValue(ref) || ref.kind !== "record") return { state: "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: at }
    const current = await refresh(ref, context)
    return current.status === "ok" && await historicalAccess(ref, context) ? { state: "historical", ref, currentRef: current.value, authorizedProjection: original.projection, differences: [], accessRevision: context.binding.accessRevision, checkedAt: at } : { state: "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: at }
  }, proveContinuity: async (original, current, context) => {
    if (!historical.allowed || !archived.has(original.refDigest) || original.kind !== "record") return false
    const refreshed = await refresh(original, context)
    return refreshed.status === "ok" && digestSfValue(refreshed.value) === digestSfValue(current) && await historicalAccess(original, context)
  }, recall: async () => [], emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "", scanner: { name: "", version: "", status: "unavailable" }, reason: "not-selected" }) })
  const sourceAuthority = createCollaborationAuthority({ host, evidence })
  const reissue = createCollaborationReissuer({ host, issueForActor, authorize: (ref, context) => sourceAuthority.sources([ref], context), prepareMaterialScope: observer.prepareReissueScope })
  const refresh = createWorkSourceRefresh({ host, issueForActor, authorize: (ref, context) => sourceAuthority.sources([ref], context) })
  const leases = new Map<string, { recipientContext: TrustedUiContext; digest: string }>()
  const key = (id: string, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => digestSfValue({ id, refs, caller: context.binding })
  const fingerprint = () => {
    const snapshots = base.persistence.currentSnapshots?.()
    return snapshots ? digestSfValue(Object.entries(snapshots).map(([surface, snapshot]) => [surface, { ...snapshot, data: Object.fromEntries(Object.entries(snapshot.data).filter(([name]) => name !== "__sfProductV1")) }])) : undefined
  }
  const recipientAuthority: CollaborationRecipientAuthority = {
    authorize: async (id, refs, context) => {
      const selected = contexts.get(id)
      if (!selected || !actors[id]?.enabled || actors[id]!.access !== selected.binding.accessRevision || !await host.revalidate(selected) || refs.some((ref) => ref.kind !== "record")) return false
      const issued = await Promise.all(refs.map((ref) => reissue(ref as Extract<BusinessEvidenceRef, { kind: "record" }>, selected)))
      if (issued.some((result) => result.status !== "ok")) return false
      const digest = await base.persistence.transactionAll!(async () => ({ commit: false, value: fingerprint() }))
      if (!digest) return false
      leases.set(key(id, refs, context), { recipientContext: selected, digest })
      return true
    },
    checkAtCommit: (id, refs, context) => {
      const lease = leases.get(key(id, refs, context))
      return !!lease && actors[id]?.enabled === true && actors[id]!.access === lease.recipientContext.binding.accessRevision && fingerprint() === lease.digest
    },
  }
  const authorizeCase = async (value: DecisionCase, context: TrustedDomainContext) => value.participants.includes(context.binding.principalRef) && await host.revalidate(context)
  const cases = createDecisionCasePort({ state, host, creationTarget: base.creationTarget, operationIdentity: (context) => context.kind === "ui" ? ui.operationIdentity(context) : undefined, authorizeCase, evidence, createId: randomUUID, now: () => at })
  const port = createCollaborationHost({ host, state, creationTarget: base.creationTarget, scopedSources: base.persistence, evidence, human, authority: domainAuthority, recipientAuthority, issueForActor, prepareReissueScope: observer.prepareReissueScope, confirmationSource: observer, threadHistoryWrites, caseSelectionWrites, cases, workCaseAuthority: authorizeCase,
    workSignals: async (_selection, period, context) => {
      const issued = await createDashboardSourceIssuer({ host, scopedSources: base.persistence })({ page: "Executive Dashboard", fields: ["signals"], period }, context)
      if (issued.status !== "ok") return { status: "unavailable" }
      const read = await dashboard.read({ selectionRef: issued.value.selectionRef, fields: ["signals"], period }, context)
      return read.status === "ok" && read.value.values.length === 0 && read.value.missing.length === 0 ? { status: "ok", signals: [] } : { status: "unavailable" }
    }, procurement: { list: async () => ({ status: "unavailable", reason: "not-selected" }) }, collections: { resolveRequestCollection: async () => ({ status: "unavailable", reason: "not-selected" }) }, requiredAuthority: { sf_work_list: [], sf_question_prepare: [], sf_answer_read: [], sf_relation_read: [], sf_handoff_prepare: [] }, createId: randomUUID, now: () => at })
  const issueProject = async (context: TrustedDomainContext) => available(await records.issue({ page: "Portfolio Dashboard", recordType: "projects", recordId: "project", fields: ["name", "status"], period: base.period }, context))
  const select = async (id: string, context: TrustedUiContext) => {
    if (!port.caseSelection) throw new Error("case selection unavailable")
    const source = await issueProject(context)
    const draft = { objective: "Follow the selected project", horizon: base.period, currency: "USD", criteria: ["Explicit assignments only"], sourceRefs: [source] }
    const call = available(await ui.admit(request(id), "sf_case_draft", digestSfValue(draft)))
    if (!await ui.validate(call, "sf_case_draft", digestSfValue(draft))) throw new Error("case admission unavailable")
    const decision = available(await cases.draft(draft, call))
    const selection = { caseRef: encodeCaseRef(decision), period: base.period, sourceRefs: [source] }
    const mutation = { expectedStorageVersion: available(await port.caseSelection.storageVersion(context)), idempotencyKey: `selection-${id}-${context.binding.accessRevision}` }
    const selected = available(await port.caseSelection.create(selection, mutation, await admit(id, "collaboration.selection.create", { draft: selection, mutation })))
    return { selectionRef: selected.selectionRef, period: base.period }
  }
  const capture = async (ref: BusinessEvidenceRef, context: TrustedDomainContext) => archived.set(ref.refDigest, { ref: structuredClone(ref), projection: available(await records.read(ref.refId, context)) })
  return { ...base, actors, request, author, recipient, homonym, admitRead, admit, ui, human, host, state, records, evidence, port, observer, reissue, historical, capture, select, issueProject, cases, domainAuthority }
}
