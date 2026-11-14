import { randomUUID } from "node:crypto"
import { createPlannerConfirmationObserver } from "../../../../modules/sucafina/Sucafinav1/product/planner/confirmation.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { domain } from "../../../../modules/sucafina/Sucafinav1/runtime/procurement.ts"
import { object, rows, text } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Actor, Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { CreateSfHostRuntime } from "../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import type { ConfirmationScope, Period } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { ForecastCompareRequest } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { CapabilityDescriptor } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { PlannerSourceHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { AuthorizedCaseProjection, BusinessContextService, BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DecisionCase, DocumentEvidence } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { mapSfEvidenceInOrder } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/evidence-order.ts"
import { isSfPeriod } from "../../../../modules/sucafina/Sucafinav1/product/contracts/validation.ts"
import type { SfDocumentReader } from "../../../../modules/sucafina/Sucafinav1/product/documents/evidence-resolver.ts"
import { createSfDocumentScenarios } from "../../../../modules/sucafina/Sucafinav1/product/documents/scenario-inputs.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { createDashboardPort } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/port.ts"
import { createDashboardRecordEvidenceHost, createDashboardSourceHost } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/sources.ts"
import { createDashboardRecordSourceIssuer, createDashboardSourceIssuer } from "../../../../modules/sucafina/Sucafinav1/product/integration/dashboard-sources.ts"
import { createDashboardCapabilities } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/capabilities.ts"
import { createDecisionCasePort, encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { createSfDecisionResultStore } from "../../../../modules/sucafina/Sucafinav1/product/decisions/result-store.ts"
import { createDecisionScenarioLookup } from "../../../../modules/sucafina/Sucafinav1/product/decisions/scenario-lookup.ts"
import { createDecisionCapabilities } from "../../../../modules/sucafina/Sucafinav1/product/decisions/capabilities.ts"
import { createProcurementCollectionRegistry, createProcurementSourceResolver } from "../../../../modules/sucafina/Sucafinav1/product/procurement/sources.ts"
import { createProcurementSourcingEvidence } from "../../../../modules/sucafina/Sucafinav1/product/procurement/sourcing-evidence.ts"
import { createProcurementPort } from "../../../../modules/sucafina/Sucafinav1/product/procurement/port.ts"
import { createProcurementCapabilities } from "../../../../modules/sucafina/Sucafinav1/product/procurement/capabilities.ts"
import { createProcurementContractSource } from "../../../../modules/sucafina/Sucafinav1/product/procurement/contracts.ts"
import { createProcurementDecisionHost } from "../../../../modules/sucafina/Sucafinav1/product/procurement/decision-host.ts"
import { sfRunSourceFence } from "../../../../modules/sucafina/Sucafinav1/product/ai/run-store.ts"
import { createPlannerProduct, createPlannerCoverageRouter } from "../../../../modules/sucafina/Sucafinav1/product/planner/product.ts"
import { createPlannerResultPersistence } from "../../../../modules/sucafina/Sucafinav1/product/planner/persistence.ts"
import { createDecisionCoverageAccess, decisionCoverageRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/coverage-access.ts"
import { createPlannerCapabilities } from "../../../../modules/sucafina/Sucafinav1/product/planner/capabilities.ts"
import { rankSfAtlasRecall } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/atlas-memory.ts"
import { createSfCaseRecall } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/case-recall.ts"
import { createSfAtlasBusiness } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/business-context.ts"
import type { probeSfAtlasScanner } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/atlas-scanner.ts"
import { createSfDashboardServices } from "./dashboard-services.ts"
import { createSfDashboardDecisions } from "./dashboard-decisions.ts"
import { createSfPlannerEvidence } from "./planner-evidence.ts"
import { createSfPlannerCalculationServices } from "./planner-calculation-services.ts"
import { createSfScenarioOperationAccess } from "./scenario-operation-access.ts"
import { createSfDecisionBaselineServices } from "./decision-baseline-services.ts"
import { createCollaborationHost } from "../../../../modules/sucafina/Sucafinav1/product/collaboration/host.ts"
import type { createSfContributionReader } from "../../../../modules/sucafina/Sucafinav1/product/ai/contribution-reader.ts"
import { createProcurementConfirmationObserver } from "../../../../modules/sucafina/Sucafinav1/product/procurement/confirmation.ts"
import { createProcurementCollectionMemberIssuer } from "../../../../modules/sucafina/Sucafinav1/product/procurement/collection-member.ts"
import { createProcurementDecisionPreparation } from "../../../../modules/sucafina/Sucafinav1/product/procurement/decision-preparation.ts"
import { createProcurementQueuePageView, procurementQueueIntent } from "../../../../modules/sucafina/Sucafinav1/product/procurement/queue-page.ts"
import { prepareSourcingDossier } from "../../../../modules/sucafina/Sucafinav1/product/routines/dossier.ts"
import { resolveSfDocumentEvidence } from "../../../../modules/sucafina/Sucafinav1/product/documents/evidence-resolver.ts"
import freeze from "../../../../modules/sucafina/Sucafinav1/product/contracts/freeze-v1.json" with { type: "json" }

export function createSfBusinessServices(input: { authority: ReturnType<typeof createSfProductAuthority>; persistence: Parameters<CreateSfHostRuntime>[0]["persistence"]; proposalCoverageWrites: WeakSet<object>; dashboardHostWrites?: WeakSet<object>; procurementEvidenceWrites?: WeakSet<object>; caseSelectionWrites?: WeakSet<object>; threadHistoryWrites?: WeakSet<object>; readQuestionContribution?: ReturnType<typeof createSfContributionReader>; documentEvidenceList?: (documentRef: string, call: TrustedDomainContext) => Promise<PortResult<readonly DocumentEvidence[]>>; extraDescriptors?: readonly CapabilityDescriptor[]; documentRead?: SfDocumentReader }) {
  const host = input.authority.host
  const dashboardHostWrites = input.dashboardHostWrites ?? new WeakSet<object>()
  const periods = new Map<string, { period: Period; expiresAt: number }>()
  const pagePeriods = new WeakMap<TrustedDomainContext, { period: Period; expiresAt: number }>()
  const fences = (snapshots: NonNullable<ReturnType<NonNullable<typeof input.persistence.currentSnapshots>>>) => ({
    dashboard: sfRunSourceFence(snapshots.dashboard), planner: sfRunSourceFence(snapshots.planner), procurement: sfRunSourceFence(snapshots.procurement),
  })
  const readSourceFences = async (call: TrustedDomainContext) => {
    const request = host.requestFor(call)
    if (!request || !input.persistence.transactionAll || !await host.revalidate(call)) return undefined
    const found = await input.persistence.transactionAll(async (snapshots) => ({ commit: false, value: fences(snapshots) }), { signal: request.signal })
    return await host.revalidate(call) && !request.signal.aborted ? found : undefined
  }
  const lockedSourceFences = () => {
    const snapshots = input.persistence.currentSnapshots?.()
    return snapshots ? fences(snapshots) : undefined
  }
  // Only available inside the current C08 transaction; returns a digest, never mutable state.
  const lockedDecisionStateDigest = (caseId: string) => {
    const snapshot = input.persistence.currentSnapshots?.()?.dashboard
    if (!snapshot) return undefined
    const product = object(snapshot.data.__sfProductV1)
    return digestSfValue({ case: object(product.cases)[caseId], preferences: product.preferences })
  }
  const key = (call: TrustedDomainContext) => digestSfValue({ installationId: call.binding.installationId, projectId: call.binding.projectId,
    principalRef: call.binding.principalRef, policyVersion: call.binding.policyVersion, accessRevision: call.binding.accessRevision })
  const selectedPeriod = (call: TrustedDomainContext) => pagePeriods.get(call) ?? periods.get(key(call))
  const contextFor = async (call: TrustedDomainContext) => {
    const request = host.requestFor(call)
    const selected = selectedPeriod(call)
    if (!request || !selected || selected.expiresAt <= Date.now() || !await host.revalidate(call)) return { status: "unavailable" as const, reason: "procurement-context-unavailable" }
    const environment = await host.environment(request)
    const currency = await host.persistence.transaction("procurement", async (snapshot) => {
      const principal = await host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
      if (!principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: undefined }
      const roles = principal.roles.filter((role) => role.surface === "procurement").map((role) => role.role)
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite, assigned: [], domains: [] }
      const value = object(domain.view(snapshot, actor, environment).data.formSettings).currency
      return { commit: false, value: typeof value === "string" && value.trim() ? value : undefined }
    }, { signal: request.signal })
    if (!currency || !await host.revalidate(call) || selectedPeriod(call) !== selected) return { status: "unavailable" as const, reason: "procurement-context-unavailable" }
    return { status: "ok" as const, value: { installationId: call.binding.installationId, projectId: call.binding.projectId,
      principalRef: call.binding.principalRef, policyVersion: call.binding.policyVersion, accessRevision: call.binding.accessRevision,
      surface: "procurement" as const, period: structuredClone(selected.period), currency, sourceRefs: [], capabilities: [] } }
  }
  const registry = createProcurementCollectionRegistry({ host, scopedSources: input.persistence, contextFor })
  const individual = createProcurementSourceResolver({ host, scopedSources: input.persistence, contextFor })
  const procurementConfirmation = createProcurementConfirmationObserver({ host, scopedSources: input.persistence, contextFor })
  const contracts = createProcurementContractSource({ host, scopedSources: input.persistence })
  const resolveProcurement = async (ref: string, call: TrustedDomainContext) => {
    const selected = await registry.resolveRequestSource(ref, call)
    return selected.status === "unavailable" && selected.reason === "Request unavailable" ? individual.resolve(ref, call) : selected
  }
  const procurementHost = { ...host, ...registry,
    resolveRequestSource: resolveProcurement,
    isCurrentRequestSource: (snapshot: Snapshot, evidence: Extract<BusinessEvidenceRef, { kind: "record" }>) => registry.isCurrentRequestSource(snapshot, evidence) || individual.isCurrent(snapshot, evidence),
    resolveSupplierSource: individual.resolve, isCurrentSupplierSource: individual.isCurrent,
    readContractSource: contracts.readContractSource,
  }
  const procurement = createProcurementPort(procurementHost)
  const sourcingEvidence = createProcurementSourcingEvidence(procurementHost)
  const dashboardSources = createDashboardSourceHost({ host, scopedSources: input.persistence })
  const dashboardRecords = createDashboardRecordEvidenceHost({ host, scopedSources: input.persistence,
    issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: input.persistence }) })
  const dashboard = createDashboardPort({ host, sources: dashboardSources, recordEvidence: dashboardRecords })
  const dashboardServices = createSfDashboardServices({ authority: input.authority, scopedSources: input.persistence, dashboard, sources: dashboardSources, records: dashboardRecords, dashboardHostWrites })
  const evidence: { current?: BusinessContextService } = {}
  const recall: { current?: ReturnType<typeof createSfCaseRecall> } = {}
  const caseRecall: ReturnType<typeof createSfCaseRecall> = (request, call) => recall.current
    ? recall.current(request, call) : Promise.resolve({ status: "unavailable" as const })
  const decisionEvidence: { current?: ReturnType<typeof createProcurementDecisionHost> } = {}
  const procurementEvidence = {
    resolveEvidence: async (ref: BusinessEvidenceRef, call: TrustedDomainContext): Promise<BusinessEvidenceResolution | undefined> => {
      const unavailable = (): BusinessEvidenceResolution => ({ state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString() })
      if (ref.kind !== "record" || !ref.refId.startsWith("sf-procurement-c06:")) return decisionEvidence.current?.resolveEvidence(ref, call)
      if (ref.schema !== "sf-evidence-v1" || ref.target.surface !== "procurement" || ref.target.recordType !== "procurement-request" || !ref.target.period || ref.refDigest !== digestSfEvidenceRef(ref) || ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId) return unavailable()
      const first = await procurementConfirmation.resolve(ref.refId, call)
      if (first.status !== "ok" || digestSfValue(first.value.evidence) !== digestSfValue(ref)) return unavailable()
      const observed = await procurementConfirmation.observe({ sourceRef: { surface: "procurement", type: "procurement-request", id: ref.target.recordId, incarnation: ref.target.incarnation }, fields: ref.target.fields, period: ref.target.period, materialDependencies: [], scopeDefinitionVersion: "procurement-c06-v1" }, call)
      const again = await procurementConfirmation.resolve(ref.refId, call)
      if (observed.state !== "available" || digestSfValue(observed.evidence) !== digestSfValue(ref) || again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(first.value) || !await host.revalidate(call)) return unavailable()
      return { state: "fresh", ref, currentRef: observed.evidence, authorizedProjection: observed.projection, accessRevision: call.binding.accessRevision, checkedAt: observed.projection.context.sourceRefs[0]?.observedAt ?? new Date().toISOString() }
    },
    proveContinuity: (original: BusinessEvidenceRef, current: BusinessEvidenceRef, call: TrustedDomainContext) => decisionEvidence.current?.proveContinuity(original, current, call) ?? Promise.resolve(undefined),
  }
  const context: BusinessContextService = {
    resolve: (ref, call) => evidence.current ? evidence.current.resolve(ref, call) : Promise.resolve({ state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString() }),
    context: async (request, call) => evidence.current ? evidence.current.context(request, call) :
      request.refs.map((ref) => ({ state: "unavailable", ref, accessRevision: call.binding.accessRevision, checkedAt: new Date().toISOString() })),
    recall: (request, call) => evidence.current ? evidence.current.recall(request, call) : Promise.reject(new Error("SF_ATLAS_UNAVAILABLE")),
    emitFromLedger: (ref, call) => evidence.current ? evidence.current.emitFromLedger(ref, call) : Promise.resolve({ status: "unavailable", sourceEventId: ref.kind === "case-event" ? ref.target.eventId : "", scanner: { name: "", version: "", status: "unavailable" }, reason: "atlas-unavailable" }),
  }
  const operationIdentity = (call: TrustedDomainContext) => call.kind === "ui" ? input.authority.ui.operationIdentity(call) : input.authority.native.operationIdentity?.(call)
  const authorizeCase = async (value: DecisionCase, call: TrustedDomainContext) => value.participants.includes(call.binding.principalRef) && await host.revalidate(call)
  let scenarioOperationAccess: ReturnType<typeof createSfScenarioOperationAccess> | undefined
  const cases = createDecisionCasePort({ state: input.authority.state, host, creationTarget: input.authority.creationTarget,
    operationIdentity,
    authorizeCase,
    verifyScenarioOperations: (value, call) => scenarioOperationAccess ? scenarioOperationAccess(value, call) : Promise.resolve(false),
    evidence: context, createId: randomUUID, now: () => new Date().toISOString() })
  const plannerConfirmation: { current?: ReturnType<typeof createPlannerConfirmationObserver> } = {}
  const confirmationSourceFor = (scope: ConfirmationScope) => scope.sourceRef.surface === "dashboard" ? dashboardServices.observer
    : scope.sourceRef.surface === "planner" ? plannerConfirmation.current : scope.sourceRef.surface === "procurement" ? procurementConfirmation : undefined
  const confirmationSource: NonNullable<Parameters<typeof createCollaborationHost>[0]["confirmationSource"]> = {
    verifyManifest: async (scope, call) => (await confirmationSourceFor(scope)?.verifyManifest(scope, call)) ?? false,
    fenceManifest: async (scope, call) => (await confirmationSourceFor(scope)?.fenceManifest(scope, call)) ?? false,
    observe: async (scope, call) => (await confirmationSourceFor(scope)?.observe(scope, call)) ?? { state: "dependency-unavailable", sourceVersion: 0 },
    fence: async (scope, observation, call) => (await confirmationSourceFor(scope)?.fence(scope, observation, call)) ?? false,
  }
  const collaboration = createCollaborationHost({ host, state: input.authority.state, creationTarget: input.authority.creationTarget,
    scopedSources: input.persistence, evidence: context, procurement, collections: registry, cases,
    authority: input.authority.authority, human: input.authority.human, confirmationSource,
    captureWorkSource: createProcurementCollectionMemberIssuer({ collection: registry, individual, revalidate: host.revalidate }),
    issueForActor: individual.issueForActor, prepareReissueScope: individual.prepareReissueScope,
    caseSelectionWrites: input.caseSelectionWrites, threadHistoryWrites: input.threadHistoryWrites,
    readQuestionContribution: input.readQuestionContribution, workCaseAuthority: authorizeCase,
    requiredAuthority: { sf_work_list: ["threads:read", "relations:read", "confirmations:read"], sf_question_prepare: ["threads:read", "cases:read"],
      sf_answer_read: ["threads:read"], sf_relation_read: ["relations:read"], sf_handoff_prepare: ["threads:read", "relations:read"] },
    createId: randomUUID, now: () => new Date().toISOString() })
  const dashboardDecisions = createSfDashboardDecisions({ authority: input.authority, cases, records: dashboardRecords, issue: dashboardServices.issue,
    proposalCoverageWrites: input.proposalCoverageWrites, dashboardHostWrites })
  type CaseRef = { id: string; incarnation: string; version: number }
  type CaseScope = { selected: CaseRef; request: Request; bindingDigest: string; retainers: number }
  const caseBindings = new WeakMap<TrustedDomainContext, CaseScope>()
  const callBindingDigest = (call: TrustedDomainContext) => digestSfValue([call.kind, call.binding])
  const currentCaseAuthority = (call: TrustedDomainContext, request: Request, bindingDigest: string) =>
    host.requestFor(call) === request && !request.signal.aborted && callBindingDigest(call) === bindingDigest
  const releaseCaseScope = (call: TrustedDomainContext, scope: CaseScope) => {
    scope.retainers--
    if (scope.retainers === 0 && caseBindings.get(call) === scope) caseBindings.delete(call)
  }
  // Private selector for producers which must not recursively call cases.read.
  // It proves current C08 membership and identity; each producer still authorizes its sources.
  const selectedCase = async (call: TrustedDomainContext): Promise<PortResult<CaseRef>> => {
    const scope = caseBindings.get(call)
    const selected = call.kind === "native" ? { id: call.binding.caseId, incarnation: call.binding.caseIncarnation, version: call.binding.caseVersion } : scope?.selected
    const request = host.requestFor(call)
    const binding = callBindingDigest(call)
    if (!selected || !request || (call.kind === "ui" && (!scope || scope.request !== request || scope.bindingDigest !== binding)) ||
      !await host.revalidate(call) || !currentCaseAuthority(call, request, binding)) return { status: "unavailable", reason: "case-selection-unavailable" }
    const captured = structuredClone(selected)
    const current = await input.authority.state.read(request, "cases", (state, actor) => {
      const value = state.cases[captured.id]
      return value && value.incarnation === captured.incarnation && value.version === captured.version && value.participants.includes(actor.principalRef) &&
        actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion
        ? { id: value.id, incarnation: value.incarnation, version: value.version } : undefined
    })
    const valid = await host.revalidate(call)
    const again = call.kind === "native" ? { id: call.binding.caseId, incarnation: call.binding.caseIncarnation, version: call.binding.caseVersion } : caseBindings.get(call)?.selected
    return current.status === "ok" && current.value && digestSfValue(current.value) === digestSfValue(captured) && digestSfValue(again) === digestSfValue(captured) &&
      valid && currentCaseAuthority(call, request, binding) && (call.kind === "native" || caseBindings.get(call) === scope)
      ? { status: "ok", value: captured } : { status: "unavailable", reason: "case-selection-unavailable" }
  }
  const resolveCase = async (call: TrustedDomainContext): Promise<PortResult<CaseRef>> => {
    const selected = call.kind === "native" ? { id: call.binding.caseId, incarnation: call.binding.caseIncarnation, version: call.binding.caseVersion } : caseBindings.get(call)?.selected
    if (!selected) return { status: "unavailable", reason: "case-selection-unavailable" }
    const current = await cases.read({ caseRef: encodeCaseRef(selected) }, call)
    return current.status === "ok" && current.value.case.version === selected.version && await host.revalidate(call)
      ? { status: "ok", value: structuredClone(selected) } : { status: "unavailable", reason: "case-selection-unavailable" }
  }
  const withCase = async <T>(call: TrustedDomainContext, selected: CaseRef, options: { allowHistoricalRetry?: boolean }, action: () => Promise<PortResult<T>>): Promise<PortResult<T>> => {
    const request = host.requestFor(call)
    const binding = callBindingDigest(call)
    const captured = structuredClone(selected)
    if (call.kind !== "ui" || !request || caseBindings.has(call)) return { status: "denied", reason: "case-selection-unavailable" }
    const current = await cases.read({ caseRef: encodeCaseRef(captured) }, call)
    if (current.status !== "ok" || (options.allowHistoricalRetry ? current.value.case.version < captured.version : current.value.case.version !== captured.version) ||
      !await host.revalidate(call) || !currentCaseAuthority(call, request, binding) || caseBindings.has(call)) return { status: "denied", reason: "case-selection-unavailable" }
    const scope: CaseScope = { selected: captured, request, bindingDigest: binding, retainers: 1 }
    caseBindings.set(call, scope)
    try { return await action() } finally { releaseCaseScope(call, scope) }
  }
  // This private entry receives a case only from the authenticated calculation
  // request/result stores. Avoid cases.read: that projection can itself cite the
  // calculation currently being resolved by the BCS.
  const withCalculationCase = async <T>(call: TrustedDomainContext, selected: CaseRef, work: () => Promise<PortResult<T>>): Promise<PortResult<T>> => {
    const source = host.requestFor(call)
    const binding = callBindingDigest(call)
    const captured = structuredClone(selected)
    const selectedDigest = digestSfValue(captured)
    if (!source || !await host.revalidate(call) || !currentCaseAuthority(call, source, binding)) return { status: "denied", reason: "calculation-case-authority-unavailable" }
    let scope: CaseScope | undefined
    if (call.kind === "native") {
      const held = { id: call.binding.caseId, incarnation: call.binding.caseIncarnation, version: call.binding.caseVersion }
      if (digestSfValue(held) !== selectedDigest) return { status: "denied", reason: "calculation-case-scope-mismatch" }
    } else {
      scope = caseBindings.get(call)
      if (!scope) {
        const current = await input.authority.state.read(source, "cases", (stored, actor) => {
          const value = stored.cases[captured.id]
          return !!value && value.incarnation === captured.incarnation && value.version === captured.version && value.participants.includes(actor.principalRef) &&
            actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion
        })
        if (current.status !== "ok" || current.value !== true || !await host.revalidate(call) || !currentCaseAuthority(call, source, binding))
          return { status: "denied", reason: "calculation-case-authority-unavailable" }
        // Another replay may have installed a scope while C08/authority awaited.
        // Join that exact owner synchronously; never replace an in-flight scope.
        scope = caseBindings.get(call)
      }
      if (scope) {
        if (scope.request !== source || scope.bindingDigest !== binding || digestSfValue(scope.selected) !== selectedDigest)
          return { status: "denied", reason: "calculation-case-scope-mismatch" }
        scope.retainers++
      } else {
        scope = { selected: captured, request: source, bindingDigest: binding, retainers: 1 }
        caseBindings.set(call, scope)
      }
    }
    try {
      const current = await selectedCase(call)
      if (current.status !== "ok") return current
      if (digestSfValue(current.value) !== selectedDigest || !currentCaseAuthority(call, source, binding) || (scope && caseBindings.get(call) !== scope))
        return { status: "denied", reason: "calculation-case-authority-changed" }
      const result = await work()
      const checked = await selectedCase(call)
      return checked.status === "ok" && digestSfValue(checked.value) === selectedDigest && currentCaseAuthority(call, source, binding) && (!scope || caseBindings.get(call) === scope)
        ? result : { status: "denied", reason: "calculation-case-authority-changed" }
    } finally { if (scope) releaseCaseScope(call, scope) }
  }
  const results = createSfDecisionResultStore({ state: input.authority.state, host, authorizeCase, createId: randomUUID, now: () => new Date().toISOString(),
    verifySources: async (_value, refs, call) => {
      const found = await context.context({ refs }, call)
      return found.length === refs.length && found.every((item, index) => item.state === "fresh" && !!item.authorizedProjection && !!item.currentRef &&
        digestSfValue(item.ref) === digestSfValue(refs[index]) && digestSfValue(item.currentRef) === digestSfValue(item.ref)) && await host.revalidate(call)
    } })
  const scenarioLookup = createDecisionScenarioLookup({ cases, state: input.authority.state, results, host })
  const coverage = createDecisionCoverageAccess({ state: input.authority.state, host, authorizeCase,
    verifyEvidence: async (basis, assessment, call) => {
      const refs = [...basis.sourceRefs, ...assessment.evaluatedSourceRefs, ...assessment.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
      const resolved = await context.context({ refs }, call)
      return resolved.length === refs.length && resolved.every((item, index) => item.state === "fresh" && !!item.authorizedProjection && !!item.currentRef &&
        digestSfValue(item.ref) === digestSfValue(refs[index]) && digestSfValue(item.currentRef) === digestSfValue(item.ref)) && await host.revalidate(call)
    } })
  const forecastCoverage: { current?: PlannerSourceHost["resolveForecastCoverage"] } = {}
  type DecisionDomain = { proposalCoverage: { resolveForecastCoverage: Parameters<typeof createPlannerCoverageRouter>[0]["forecast"] }; plannerCriteria: NonNullable<Parameters<typeof createPlannerProduct>[0]["criteria"]> }
  const decisionDomain: { current?: DecisionDomain } = {}
  const plannerHolder: { current?: ReturnType<typeof createPlannerProduct>["planner"] } = {}
  const baselineCoverage = createSfDecisionBaselineServices({ authority: input.authority, evidence: context, selectedCase,
    planner: () => plannerHolder.current, proposalCoverageWrites: input.proposalCoverageWrites, readSourceFences, lockedSourceFences })
  const bindDecisionDomain = (value: DecisionDomain) => {
    if (decisionDomain.current) throw new Error("SF_DECISION_DOMAIN_ALREADY_BOUND")
    decisionDomain.current = value
  }
  const product = createPlannerProduct({ host, scopedSources: input.persistence, evidence: context,
    coverageFor: createPlannerCoverageRouter({ forecast: async (ref, call) => {
      if (ref.startsWith("proposal-coverage:")) return decisionDomain.current?.proposalCoverage.resolveForecastCoverage(ref, call) ?? { status: "unavailable", reason: "decision-domain-not-initialized" }
      // A forecast can be read without choosing a decision case. An inaccessible
      // selection still reaches its registry and retains the current denial.
      if (call.kind === "ui" && !caseBindings.has(call)) return await host.revalidate(call)
        ? { status: "unavailable", reason: "baseline-coverage-case-not-selected" } : { status: "denied", reason: "baseline-coverage-access-unavailable" }
      return decisionDomain.current ? baselineCoverage.resolveForecastCoverage(ref, call)
        : forecastCoverage.current?.(ref, call) ?? baselineCoverage.resolveForecastCoverage(ref, call)
    }, decision: coverage }),
    criteria: { evaluate: (request, call) => decisionDomain.current?.plannerCriteria.evaluate(request, call) ?? Promise.resolve({ status: "unavailable", reason: "decision-domain-not-initialized" }) },
    storedScenarios: { store: results, cases, coverageRefFor: (caseRef, alternative) => decisionCoverageRef(caseRef, alternative.id, alternative.version) } })
  const planner = product.planner
  plannerConfirmation.current = createPlannerConfirmationObserver({ host, issueSource: product.issueSource, planner })
  plannerHolder.current = planner
  const plannerSources = product.sources
  const documentScenarios = input.documentRead ? createSfDocumentScenarios({ host, product, evidence: context, reader: input.documentRead,
    sourceFence: async (call) => { const current = await readSourceFences(call); return current ? digestSfValue(current) : undefined },
    authorize: (request, call) => input.authority.human.authorize(call, "planner.preview", request) }) : undefined
  const projectPlannerEvidence = createSfPlannerEvidence({ host, sources: plannerSources })
  const procurementDecisions = createProcurementDecisionHost({ host: procurementHost, port: procurement, individual,
    authority: input.authority, procurementEvidenceWrites: input.procurementEvidenceWrites ?? new WeakSet<object>(), cases, planner, plannerSources,
    operationIdentity, readSourceFences, lockedSourceFences, createId: randomUUID, now: () => new Date().toISOString() })
  decisionEvidence.current = procurementDecisions
  scenarioOperationAccess = createSfScenarioOperationAccess({ host, sources: plannerSources, planner, scenarioInputs: product.scenarioInputs,
    readSourceFences, resolveProcurementEvidence: context.resolve, externalOperation: dashboardDecisions.resolveOperation })
  const basePersist = createPlannerResultPersistence({ store: results, scenarios: product.scenarios, resolveCase })
  const calculations = createSfPlannerCalculationServices({ host, state: input.authority.state, results, authorizeCase, operationIdentity,
    writes: input.proposalCoverageWrites, sources: plannerSources, evidence: context, persist: basePersist, readSourceFences, lockedSourceFences, withCalculationCase })
  const persist = calculations.persist
  const receipt = input.authority.authority.receiptFor
  const descriptors = [
    ...input.extraDescriptors ?? [],
    ...createDashboardCapabilities(dashboard, async (call, operation, digest, result) => receipt(call, operation, digest, result)),
    ...createPlannerCapabilities(planner, receipt, persist),
    ...createProcurementCapabilities({ port: procurement, authority: input.authority.authority }),
    ...collaboration.capabilities,
    ...createDecisionCapabilities({ cases, createReceipt: receipt, requiredAuthority: { read: ["cases:read"], draft: ["cases:write"], receipt: ["cases:read"], alternative: ["cases:read"], change: ["cases:read"] } }),
  ]
  const atlasDescriptors = new Set<(typeof descriptors)[number]>()
  const atlasState: { current?: { memory: ReturnType<typeof createSfAtlasBusiness>["memory"]; proveContinuity: ReturnType<typeof createSfAtlasBusiness>["proveContinuity"]; featuresForCase: (value: AuthorizedCaseProjection, call: TrustedDomainContext) => Promise<import("../../../../modules/sucafina/Sucafinav1/product/decision-memory/recall.ts").RecallFeatures | undefined>; runtimeVersions: { boundaryVersion: string; schemaVersion: string; manifestVersion: string; skillVersion: string } } } = {}
  const clearAtlasDescriptors = () => {
    for (let index = descriptors.length - 1; index >= 0; index--) if (atlasDescriptors.has(descriptors[index]!)) descriptors.splice(index, 1)
    atlasDescriptors.clear()
  }
  const initializeAtlas = (scanner: Awaited<ReturnType<typeof probeSfAtlasScanner>>, versions: { boundaryVersion: string; schemaVersion: string; manifestVersion: string; skillVersion: string }) => {
    const dashboardIssue = createDashboardSourceIssuer({ host, scopedSources: input.persistence })
    const featuresForCase = async (value: AuthorizedCaseProjection, call: TrustedDomainContext) => {
      if (!await host.revalidate(call)) return undefined
      const refreshed = await cases.read({ caseRef: encodeCaseRef(value.case) }, call)
      if (refreshed.status !== "ok" || digestSfValue(refreshed.value.case) !== digestSfValue(value.case) ||
        digestSfValue(refreshed.value.evidenceRefs) !== digestSfValue(value.evidenceRefs) || !await host.revalidate(call)) return undefined
      const types = [...refreshed.value.evidenceRefs.flatMap((ref) => ref.kind === "record" ? [`${ref.target.surface}:${ref.target.recordType}`] : []),
        ...refreshed.value.case.preparedChanges.map((change) => `${change.target.surface}:${change.target.type}`)]
      if (!types.length) return undefined
      return { decisionType: [...new Set(types)].sort().join("|"), horizon: digestSfValue(value.case.horizon),
        components: [...new Set(value.case.alternatives.flatMap((alternative) => alternative.result.components.map((component) => component.id)))].sort(),
        restrictions: [...new Set(value.case.criteria.filter((criterion) => criterion.required).map((criterion) => criterion.description))].sort(),
        resultAvailable: value.case.alternatives.some((alternative) => alternative.result.comparisonStatus === "complete" && alternative.result.total !== null) ||
          value.case.choices.some((choice) => choice.result.comparisonStatus === "complete" && choice.result.total !== null) }
    }
    const caseForEvidence = async (digest: string, call: TrustedDomainContext) => {
      const request = host.requestFor(call)
      if (!request || !await host.revalidate(call)) return undefined
      const source = await input.authority.state.read(request, call.kind === "native" ? "contributions" : "cases", (state, actor) => {
        if (actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion) return []
        if (call.kind === "native") {
          const run = state.nativeRuns?.[call.binding.runId]
          return run && run.caseRef.id === call.binding.caseId && run.caseRef.incarnation === call.binding.caseIncarnation ? [{ ref: run.caseRef,
            outbox: Object.values(state.outbox).some((entry) => entry.eventRef.refDigest === digest && entry.eventRef.target.caseId === run.caseRef.id && entry.eventRef.target.caseIncarnation === run.caseRef.incarnation) }] : []
        }
        return Object.values(state.cases).filter((value) => value.participants.includes(actor.principalRef)).map((value) => ({ ref: { id: value.id, incarnation: value.incarnation },
          outbox: Object.values(state.outbox).some((entry) => entry.eventRef.refDigest === digest && entry.eventRef.target.caseId === value.id && entry.eventRef.target.caseIncarnation === value.incarnation) }))
      })
      if (source.status !== "ok" || source.value.length > 500) return undefined
      const checked = await mapSfEvidenceInOrder(source.value, async (entry) => ({ ...entry, result: await cases.read({ caseRef: encodeCaseRef(entry.ref) }, call) }))
      const matches = checked.filter((entry) => entry.result.status === "ok" && (entry.outbox || entry.result.value.evidenceRefs.some((ref) => ref.refDigest === digest)))
      return matches.length && await host.revalidate(call) ? matches.map((entry) => entry.ref) : undefined
    }
    const atlas = createSfAtlasBusiness({ host, authority: input.authority.authority, state: input.authority.state, cases, authorizeCase, dashboard, dashboardIssue, dashboardRecords,
      // WP14's published reader calls the resolver; WP04 also exposes named methods on it.
      procurement, procurementResolve: Object.assign(resolveProcurement, { ...individual, resolve: resolveProcurement }), procurementEvidence, planner: { sources: plannerSources, port: planner, project: projectPlannerEvidence, readEvidence: projectPlannerEvidence.readEvidence },
      documentRead: input.documentRead ?? (async (_id, call) => ({ status: "unavailable", accessRevision: call.binding.accessRevision })),
      caseForEvidence, calculation: calculations.resolveEvidence, ...(scanner ? { scanner } : {}), now: () => new Date().toISOString(), selections: {
        runtimeVersions: versions, featuresForCase,
        contextSelections: async (request, call) => {
          const refs: BusinessEvidenceRef[] = []
          for (const selector of request.selectionRefs) {
            const caseResult = await cases.read({ caseRef: selector }, call)
            if (caseResult.status === "ok" && digestSfValue(caseResult.value.case.horizon) === digestSfValue(request.period)) { refs.push(...caseResult.value.evidenceRefs); continue }
            const page = await dashboardSources.resolveDashboardSource(selector, call)
            if (page.status === "ok" && digestSfValue(page.value.evidence.target.period) === digestSfValue(request.period)) { refs.push(page.value.evidence); continue }
            const record = await dashboardRecords.resolve(selector, call)
            if (record.status === "ok" && digestSfValue(record.value.target.period) === digestSfValue(request.period)) { refs.push(record.value); continue }
            const forecast = await plannerSources.resolveForecastSource(selector, call)
            if (forecast.status === "ok" && forecast.value.evidence.target.period && forecast.value.evidence.target.period.start <= request.period.start &&
              forecast.value.evidence.target.period.end >= request.period.end) { refs.push(forecast.value.evidence); continue }
            const source = await resolveProcurement(selector, call)
            if (source.status === "ok" && digestSfValue(source.value.evidence.target.period) === digestSfValue(request.period)) { refs.push(source.value.evidence); continue }
            return undefined
          }
          return refs.filter((ref, index) => refs.findIndex((candidate) => candidate.refDigest === ref.refDigest) === index)
        },
        recallSelections: async (request, call) => {
          const found = await mapSfEvidenceInOrder(request.selectionRefs, (caseRef) => cases.read({ caseRef }, call))
          if (!found.length || found.some((item) => item.status !== "ok")) return undefined
          const values = found.flatMap((item) => item.status === "ok" ? [item.value] : [])
          if (values.some((value) => digestSfValue(value.case.horizon) !== digestSfValue(request.period))) return undefined
          const features = values[0] && await featuresForCase(values[0], call)
          if (!features) return undefined
          const comparisons = await mapSfEvidenceInOrder(values, (value) => featuresForCase(value, call))
          if (comparisons.some((value) => !value || value.decisionType !== features.decisionType || value.horizon !== features.horizon)) return undefined
          return { caseRefs: values.map((value) => ({ id: value.case.id, incarnation: value.case.incarnation })), features }
        },
      } })
    evidence.current = atlas.context
    recall.current = createSfCaseRecall({ host, cases, memory: atlas.memory, featuresForCase, runtimeVersions: versions,
      proveContinuity: atlas.proveContinuity, rank: rankSfAtlasRecall,
      selectCandidates: async (_source, call, scope) => {
        const request = host.requestFor(call)
        if (!request || !await host.revalidate(call)) return undefined
        const selected = await input.authority.state.read(request, "cases", (stored, actor) => {
          if (actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion) return undefined
          const values = Object.values(stored.cases).filter((value) => value.participants.includes(actor.principalRef))
          const candidates = scope ? values.filter((value) => scope.recallScope.cases.some((ref) => ref.id === value.id && ref.incarnation === value.incarnation && ref.version === value.version)) : values
          if (candidates.length > 500 || scope && candidates.length !== scope.recallScope.cases.length) return undefined
          return candidates.map((value) => ({ id: value.id, incarnation: value.incarnation })).sort((a, b) => a.id.localeCompare(b.id) || a.incarnation.localeCompare(b.incarnation))
        })
        return selected.status === "ok" && await host.revalidate(call) ? selected.value : undefined
      },
    })
    atlasState.current = { memory: atlas.memory, proveContinuity: atlas.proveContinuity, featuresForCase, runtimeVersions: structuredClone(versions) }
    clearAtlasDescriptors()
    for (const descriptor of atlas.capabilities) { descriptors.push(descriptor); atlasDescriptors.add(descriptor) }
    return atlas
  }
  const procurementSelections = { create: async (call: TrustedDomainContext, period: Period) => {
    if (!isSfPeriod(period)) return { status: "denied" as const, reason: "selection-authority-unavailable" }
    const digest = digestSfValue({ purpose: "work-selection", period })
    if (call.kind !== "ui" || !input.authority.ui.matchesIntent(call, "sf_work_list", digest) || !await host.revalidate(call))
      return { status: "denied" as const, reason: "selection-authority-unavailable" }
    for (const [entry, value] of periods) if (value.expiresAt <= Date.now()) periods.delete(entry)
    if (periods.size >= 5000 && !periods.has(key(call))) return { status: "unavailable" as const, reason: "selection-registry-full" }
    const selection = { period: Object.freeze(structuredClone(period)), expiresAt: Date.now() + 5 * 60_000 }
    const identity = key(call)
    periods.set(identity, selection)
    const result = await registry.createSelection(call)
    if (result.status !== "ok" || periods.get(identity) !== selection || !await host.revalidate(call)) {
      if (periods.get(identity) === selection) periods.delete(identity)
      return result.status === "ok" ? { status: "unavailable" as const, reason: "selection-authority-changed" } : result
    }
    return { status: "ok" as const, value: { selectionRef: result.value, label: "Procurement requests", period: structuredClone(selection.period) } }
  } }
  const procurementQueueView = createProcurementQueuePageView({ host, ui: input.authority.ui, collection: registry, port: procurement,
    selectPeriod: async (call, period) => {
      if (!isSfPeriod(period) || !input.authority.ui.matchesIntent(call, "sf_request_read", digestSfValue(procurementQueueIntent(period))) || !await host.revalidate(call)) return undefined
      const selected = { period: Object.freeze(structuredClone(period)), expiresAt: Date.now() + 5 * 60_000 }
      pagePeriods.set(call, selected)
      return () => { if (pagePeriods.get(call) === selected) pagePeriods.delete(call) }
    },
  })
  const forecastInputs = { prepare: async (call: TrustedDomainContext, request: ForecastCompareRequest & { caseRef: { id: string; incarnation: string; version: number } }) => {
    const wanted = structuredClone(request)
    if (call.kind !== "ui" || !input.authority.ui.matchesIntent(call, "sf_forecast_compare", digestSfValue(wanted)) || !await host.revalidate(call))
      return { status: "denied" as const, reason: "forecast-input-authority-unavailable" }
    return withCase(call, wanted.caseRef, {}, async () => {
    const current = await cases.read({ caseRef: encodeCaseRef(wanted.caseRef) }, call)
    if (current.status !== "ok" || current.value.case.version !== wanted.caseRef.version) return { status: "unavailable" as const, reason: "forecast-case-unavailable" }
    const result = await planner.compareForecast({ baseRef: wanted.baseRef, candidateRef: wanted.candidateRef, period: wanted.period, currency: wanted.currency }, call)
    if (result.status !== "ok") return result
    const refs = result.value.sourceRefs
    if (refs.length !== 2 || refs.some((ref) => !current.value.evidenceRefs.some((allowed) => digestSfValue(allowed) === digestSfValue(ref))))
      return { status: "denied" as const, reason: "forecast-source-outside-case" }
    const resolutions = await context.context({ refs }, call)
    const again = await cases.read({ caseRef: encodeCaseRef(wanted.caseRef) }, call)
    if (resolutions.length !== refs.length || resolutions.some((item) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || digestSfValue(item.currentRef) !== digestSfValue(item.ref)) ||
      again.status !== "ok" || digestSfValue(again.value.case) !== digestSfValue(current.value.case) || !await host.revalidate(call) ||
      !input.authority.ui.matchesIntent(call, "sf_forecast_compare", digestSfValue(wanted)))
      return { status: "stale" as const, reason: "forecast-source-changed" }
    return { status: "ok" as const, value: { forecastComparison: result.value, selectedPeriod: wanted.period, currency: wanted.currency, sourceRefs: refs, registeredReasons: [] } }
    })
  } }
  const prepareProcurement = createProcurementDecisionPreparation(procurement)
  const dossierDocuments = async (requestRef: string, call: TrustedDomainContext): Promise<PortResult<readonly Extract<BusinessEvidenceRef, { kind: "document" }>[]>> => {
    const request = host.requestFor(call)
    const source = await resolveProcurement(requestRef, call)
    if (!request || source.status !== "ok" || source.value.evidence.target.recordType !== "procurement-request" || !await host.revalidate(call)) return { status: "unavailable", reason: "dossier-request-unavailable" }
    const environment = await host.environment(request)
    const selected = await host.persistence.transaction<PortResult<readonly string[]>>("procurement", async (snapshot) => {
      const principal = await host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
      if (!principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: { status: "denied", reason: "dossier-authority-unavailable" } }
      const actor: Actor = { id: principal.id, roles: principal.roles.filter((role) => role.surface === "procurement").map((role) => role.role), canWrite: principal.canWrite, assigned: [], domains: [] }
      const record = rows(domain.view(snapshot, actor, environment).data.requests).find((value) => value.number === source.value.evidence.target.recordId)
      if (!record || !procurementHost.isCurrentRequestSource(snapshot, source.value.evidence)) return { commit: false, value: { status: "stale", reason: "dossier-request-changed" } }
      if (record.attachments !== undefined && !Array.isArray(record.attachments)) return { commit: false, value: { status: "unavailable", reason: "dossier-attachments-invalid" } }
      const attachments = rows(record.attachments)
      const ids = attachments.map((attachment) => text(attachment.id))
      if (ids.some((id) => !id) || new Set(ids).size !== ids.length || ids.length > 100 || attachments.length !== (Array.isArray(record.attachments) ? record.attachments.length : 0)) return { commit: false, value: { status: "unavailable", reason: "dossier-attachments-invalid" } }
      return { commit: false, value: { status: "ok", value: ids.sort() } }
    }, { signal: request.signal })
    if (selected.status !== "ok") return selected
    if (selected.value.length && (!input.documentRead || !input.documentEvidenceList)) return { status: "unavailable", reason: "dossier-document-reader-unavailable" }
    const listed = await Promise.all(selected.value.map((id) => input.documentEvidenceList!(id, call)))
    if (listed.some((result) => result.status !== "ok" || !result.value.length)) return { status: "unavailable", reason: "dossier-document-evidence-unavailable" }
    const refs = listed.flatMap((result, index) => result.status === "ok" ? result.value.map((entry) => ({ entry, documentId: selected.value[index] })) : [])
    if (refs.some(({ entry, documentId }) => entry.ref.kind !== "document" || entry.ref.target.documentId !== documentId || entry.ref.installationId !== call.binding.installationId || entry.ref.projectId !== call.binding.projectId || entry.ref.refDigest !== digestSfEvidenceRef(entry.ref)) || !await host.revalidate(call)) return { status: "unavailable", reason: "dossier-document-selection-changed" }
    const again = await resolveProcurement(requestRef, call)
    if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(source.value)) return { status: "stale", reason: "dossier-request-changed" }
    return { status: "ok", value: refs.map(({ entry }) => entry.ref).sort((a, b) => a.refDigest.localeCompare(b.refDigest)) }
  }
  const procurementDossier = { prepare: (requestRef: string, call: TrustedDomainContext) => prepareSourcingDossier({
    requestRef, context: call, prepareProcurement, selectedDocuments: dossierDocuments,
    reader: input.documentRead ?? (async (_id, binding) => ({ status: "unavailable", accessRevision: binding.binding.accessRevision })),
    revalidate: async (refs) => {
      const request = host.requestFor(call)
      if (!request || request.signal.aborted || !await host.revalidate(call) || refs.length > 0 && !input.documentRead) return false
      const resolved = await Promise.all(refs.map((ref) => resolveSfDocumentEvidence(ref, call, input.documentRead!)))
      return resolved.every((value) => value.state === "fresh" && !!value.authorizedProjection) && !request.signal.aborted && await host.revalidate(call)
    },
    revalidateProcurement: async (material) => {
      const current = await prepareProcurement(requestRef, call)
      const stable = (value: typeof material) => ({ ...value, request: { ...value.request, values: value.request.values.filter((field) => field.id !== "ageDays") } })
      return current.status === "ok" && digestSfValue(stable(current.value)) === digestSfValue(stable(material)) && await host.revalidate(call)
    },
  }) }
  return { host, authorizeCase, dashboardSources, dashboardRecords, dashboard, dashboardServices, dashboardDecisions, procurement, procurementDecisions, procurementConfirmation, procurementDossier, procurementQueueView, collaboration, planner, plannerProduct: product, plannerSources, registry, individual, contracts, cases, context, evidence, caseRecall, results, calculations, scenarioLookup, sourcingEvidence, operationIdentity, receipt, resolveCase, withCase, readSourceFences, lockedSourceFences, lockedDecisionStateDigest, descriptors, procurementSelections, forecastInputs, initializeAtlas,
    projectPlannerEvidence, documentScenarios, resolveProcurement, selectedCase, baselineCoverage, bindDecisionDomain,
    bindForecastCoverage: (reader: PlannerSourceHost["resolveForecastCoverage"]) => {
      if (forecastCoverage.current && forecastCoverage.current !== reader) throw new Error("SF_FORECAST_COVERAGE_ALREADY_BOUND")
      forecastCoverage.current = reader
    },
    atlasRecall: () => atlasState.current,
    remainingOperations: () => freeze.operations.map((entry) => entry.operation).filter((operation) => !descriptors.some((descriptor) => descriptor.id === operation)),
    dispose: () => { plannerConfirmation.current = undefined; dashboardServices.dispose(); procurementDecisions?.dispose(); periods.clear(); evidence.current = undefined; recall.current = undefined; decisionEvidence.current = undefined; atlasState.current = undefined; forecastCoverage.current = undefined; decisionDomain.current = undefined; plannerHolder.current = undefined; clearAtlasDescriptors() } }
}
