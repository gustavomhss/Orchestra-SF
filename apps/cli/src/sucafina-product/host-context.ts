import { randomUUID } from "node:crypto"
import { createSfPersonalViews } from "../../../../modules/sucafina/Sucafinav1/product/interface/personal-views.ts"
import { createSfPersonalViewAuthority } from "./personal-view-authority.ts"
import path from "node:path"
import { makeGlobalNode } from "@orchestra/core/effect/app-node"
import { ProjectV2 } from "@orchestra/core/project"
import { AbsolutePath } from "@orchestra/core/schema"
import { Effect, Layer, Option, Schema } from "effect"
import { Catalog } from "@orchestra/core/catalog"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import { Mcp } from "@orchestra/core/mcp"
import { SessionStore } from "@orchestra/core/session/store"
import { SessionMessage } from "@orchestra/core/session/message"
import { AppProcess } from "@orchestra/core/process"
import { ModelV2 } from "@orchestra/core/model"
import { ClaudeCodeHost } from "@orchestra/engine-claude-code/v2/host"
import { createResidentAiBundle } from "../../../../modules/sucafina/Sucafinav1/product/ai/resident.ts"
import { digestSfContribution, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { CreateSfHostRuntime, SfHostRuntime, SfHostServices } from "../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { createSfNativeEvidenceStore } from "../../../../modules/sucafina/Sucafinav1/product/integration/native-evidence.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { validSfSelection, sfSourceFor } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/resident-agents.ts"
import { probeSfAtlasScanner } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/atlas-scanner.ts"
import atlasPackage from "../../../../modules/atlas/boundary/package.json" with { type: "json" }
import contractFreeze from "../../../../modules/sucafina/Sucafinav1/product/contracts/freeze-v1.json" with { type: "json" }
import { createSfRosterSources } from "./roster-sources.ts"
import { createSfPlannerSourceHost, sfPlannerSourceSelector } from "../../../../modules/sucafina/Sucafinav1/product/integration/planner-sources.ts"
import { createSfDocumentTargetAuthority } from "./document-authority.ts"
import { createSfDocumentServices } from "./document-services.ts"
import { createSfDocumentHttp } from "../../../../modules/sucafina/Sucafinav1/product/interface/document-http.ts"
import { createSfDocumentScenarioHttp } from "../../../../modules/sucafina/Sucafinav1/product/interface/document-scenario-http.ts"
import { createSfDossierServices } from "./dossier-services.ts"
import { readSfDocumentAnalysisCandidate } from "./document-analysis.ts"
import { createSfImportServices } from "./import-services.ts"
import { createSfImportHttp } from "../../../../modules/sucafina/Sucafinav1/product/interface/import-http.ts"
import { readSfImportAnalysisChoices } from "../../../../modules/sucafina/Sucafinav1/product/imports/analysis-options.ts"
import { createSfBusinessServices } from "./business-services.ts"
import { createSfExtendedBusinessServices } from "./extended-business-services.ts"
import { createSfDecisionDomainServices } from "./decision-domain-services.ts"
import { createSfDecisionDomainHttp } from "./decision-domain-http.ts"
import { createSfNativeAnalysisInputs, createSfAlternativeRunState } from "./analysis-native-inputs.ts"
import type { SfAdmittedAnalysisInput } from "./analysis-native-inputs.ts"
import { createSfAlternativeCaptures } from "./alternative-captures.ts"
import { createSfBaselineServices } from "./baseline-services.ts"
import { createSfMemoryServices } from "./memory-services.ts"
import { createSfMemoryHttp } from "./memory-http.ts"
import { materialSelection } from "./memory-selection.ts"
import type { SfReviewReaders } from "./review-services.ts"
import { createSfAnalysisAuthorReader } from "./analysis-author.ts"
import type { createSfContributionReader } from "../../../../modules/sucafina/Sucafinav1/product/ai/contribution-reader.ts"
import { createSfAnalysisHostServices } from "./analysis-host-services.ts"
import { createSfAnalysisHttp } from "./analysis-http.ts"
import { createSfForecastInputAdapter } from "./forecast-input-adapter.ts"
import { sfAnalysisSourceNamespaces } from "./analysis-namespaces.ts"
import type { SfAnalysisStartInput } from "./analysis-http.ts"
import type { SfProductHtml } from "../../../../modules/sucafina/Sucafinav1/product/integration/host-presentation.ts"
import { createSfRoutinePublicationContribution } from "./routine-publication.ts"
import { createSfRoutineInputReaders } from "./routine-inputs.ts"
import { createSfRoutineServices } from "./routine-services.ts"
import { createSfDashboardHttp } from "./dashboard-http.ts"
import { createSfSourcingInputs } from "./sourcing-inputs.ts"
import { createProcurementDecisionHttp } from "../../../../modules/sucafina/Sucafinav1/product/procurement/decision-http.ts"
import { createCollaborationHttp } from "../../../../modules/sucafina/Sucafinav1/product/collaboration/http.ts"
import { createCollaborationHumanAuthority } from "../../../../modules/sucafina/Sucafinav1/product/collaboration/human.ts"
import { sfHumanReadActions } from "../../../../modules/sucafina/Sucafinav1/product/integration/human-authority.ts"
import type { SfAnalysisInputPort } from "../../../../modules/sucafina/Sucafinav1/product/interface/analysis-input-port.ts"
import { createSfProductContribution, createSfProductDispatch } from "./contribution.ts"
import { createSfTokenGate } from "./token-gate.ts"
import { createSfNativeHostContribution } from "./native-host.ts"
import { sfNativeLocationRef, sfNativeModelRef } from "./native-identity.ts"
import { createSfNativeExecution } from "./native-execution.ts"
import type { SfStoppedRun } from "./native-execution.ts"
import { createPlannerMonthlyHost } from "../../../../modules/sucafina/Sucafinav1/product/planner/monthly-host.ts"
import { createSfRunStore, sfRunSourceFence } from "../../../../modules/sucafina/Sucafinav1/product/ai/run-store.ts"
import { createSfAnalysisHost } from "../../../../modules/sucafina/Sucafinav1/product/ai/analysis-host.ts"
import { runSfAnalysis } from "../../../../modules/sucafina/Sucafinav1/product/ai/analysis-port.ts"
import { decodeSfContributionEnvelope, decodeSfOperationInput, decodeSfOperationOutput, decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import { captureAlternativeProvenance } from "../../../../modules/sucafina/Sucafinav1/product/decisions/alternative-provenance.ts"
import type { AlternativeCapabilityProvenance } from "../../../../modules/sucafina/Sucafinav1/product/decisions/alternative-provenance.ts"
import type { SfSkillInputMap } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import { sfAnalysisPrompt, withoutObservationTimes } from "./analysis-verifier.ts"
import { sfAnalysisSourcesAuthorized, sfHistoricalMemoryRequested, sfMemoryEvidence } from "./analysis-memory-evidence.ts"
import type { BusinessPorts, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedExecutionBinding } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfNativeRunRecord } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfNativeHostApi, SfLoadedSkillObservation } from "./native-host.ts"
import type { SfNativeAdmission, SfSelectedRuntime } from "../../../../modules/sucafina/Sucafinav1/product/contracts/runtime.ts"

/** Resolves placement in the application's existing graph before it accepts HTTP. No second Session coordinator. */
export const createSfHostRuntime: CreateSfHostRuntime = async (input) => {
  if (!input.installationId.trim() || !path.isAbsolute(input.directory) || path.resolve(input.directory) !== input.directory) throw new Error("SF_HOST_PLACEMENT_INVALID")
  const directory = AbsolutePath.make(input.directory)
  const bundle = await createResidentAiBundle({ root: input.sourceRoot, manifestPath: path.join(input.sourceRoot, "manifests/resident.json") })
  const selected = bundle.profiles.map((profile) => {
    const skills = bundle.skills.filter((skill) => profile.allowedSkills.includes(skill.id))
    return { profile, manifestDigest: bundle.manifestDigest, skills,
      operationIds: profile.allowedOperations.filter((operation) => skills.some((skill) => skill.allowedOperations.includes(operation))) }
  })
  const state: { identity?: ReturnType<SfHostRuntime["identity"]>; store?: SessionStore.Interface; api?: SfNativeHostApi;
    models?: SfHostServices["models"]; configuration?: string; generation: number } = { generation: 0 }
  const requests = new Map<string, Request>()
  const admittedInputs = new Map<string, SfAdmittedAnalysisInput>()
  const replayContexts = new WeakMap<TrustedDomainContext, string>()
  const alternativeCaptures = new Map<string, Map<string, AlternativeCapabilityProvenance>>()
  const alternativeBindings = new Map<string, TrustedExecutionBinding>()
  const liveNativeBindings = new Map<string, TrustedExecutionBinding>()
  const revokedNativeBindings = new WeakSet<object>()
  const invalidNativeGenerations = new Set<number>()
  const observed = new Map<string, { value: SfLoadedSkillObservation; digest: string }>()
  const proposalCoverageWrites = new WeakSet<object>()
  const nativePublicationGuards = new WeakMap<object, () => boolean>()
  const signalRegistryWrites = new WeakSet<object>()
  const caseSelectionWrites = new WeakSet<object>()
  const threadHistoryWrites = new WeakSet<object>()
  const dashboardHostWrites = new WeakSet<object>()
  const procurementEvidenceWrites = new WeakSet<object>()
  const analysisSelectionWrites = new WeakSet<object>()
  const preparedAuthority: { business?: ReturnType<typeof createSfBusinessServices> } = {}
  const identity = () => state.identity
  const selectionMatches = (value: SfSelectedRuntime) => validSfSelection(value) && selected.some((parent) =>
    parent.manifestDigest === value.manifestDigest && digestSfValue(parent.profile) === digestSfValue(value.profile) &&
    value.skills.every((skill) => parent.skills.some((allowed) => digestSfValue(allowed) === digestSfValue(skill))) &&
    value.operationIds.every((operation) => parent.operationIds.includes(operation)))
  const authority = createSfProductAuthority({ ...input, identity, proposalCoverageWrites, nativePublicationGuards, signalRegistryWrites, caseSelectionWrites, threadHistoryWrites, dashboardHostWrites, procurementEvidenceWrites, analysisSelectionWrites, policyVersion: "sf-product-v1", grants: input.grants ?? [], createId: randomUUID, now: Date.now,
    commandIdentity: async (request, operation, digest) => {
      if (request.method === "GET" || request.method === "HEAD") return randomUUID()
      const key = request.headers.get("Idempotency-Key")
      return key && /^[A-Za-z0-9._:-]{8,128}$/.test(key) ? digestSfValue({ operation, key }) : undefined
    },
    inspectSession: async (id) => state.store ? Effect.runPromise(state.store.get(id)) : undefined,
    verifySelection: async (value) => selectionMatches(value),
    verifySkillReceipt: async (admission) => {
      const proof = observed.get(admission.sessionID)
      const receipt = admission.skillReceipts[0]
      if (!state.store || !proof || !receipt || admission.skillReceipts.length !== 1 || proof.value.admission.request !== admission.request ||
        proof.digest !== admissionDigest(admission) || !sfSourceFor(proof.value.sourceCapability, proof.value.skills, admission.selected)) return false
      const skill = await Effect.runPromise(proof.value.skills.get(receipt.skillId))
      const message = await Effect.runPromise(state.store.message(SessionMessage.ID.make(receipt.loadedMessageId)))
      return !!skill && message?.sessionID === admission.sessionID && message.message.type === "synthetic" &&
        message.message.text.startsWith(`<skill_content name="${skill.name}">\n# Skill: ${skill.name}\n\n${skill.content.trim()}\n\n`) &&
        new Bun.CryptoHasher("sha256").update(await Bun.file(skill.location).arrayBuffer()).digest("hex") === receipt.sourceDigest &&
        new Bun.CryptoHasher("sha256").update(skill.content.trim()).digest("hex") === receipt.instructionsDigest
    },
    providerGeneration: async () => await state.models?.() ? state.generation : undefined,
    authorizeDocument: createSfDocumentTargetAuthority(input),
    authorizePreparedTarget: (request, snapshot, targetRef, actor) => preparedAuthority.business?.procurementDecisions.authorizeReceiptTarget(request, snapshot, targetRef, actor) ?? Promise.resolve(undefined),
  })
  const nativeRegistry = authority.native
  authority.native = { ...nativeRegistry,
    bind: async (admission) => {
      const admitted = await nativeRegistry.bind(admission)
      if (admitted.status === "ok") liveNativeBindings.set(admitted.value.nativeSessionId, admitted.value)
      return admitted
    },
    revoke: (binding) => {
      revokedNativeBindings.add(binding)
      if (liveNativeBindings.get(binding.nativeSessionId) === binding) liveNativeBindings.delete(binding.nativeSessionId)
      nativeRegistry.revoke(binding)
    },
    invalidateGeneration: (generation) => { invalidNativeGenerations.add(generation); nativeRegistry.invalidateGeneration(generation) },
  }
  const evidence = createSfNativeEvidenceStore({ state: authority.state, nativeEvidenceWrites: authority.nativeEvidenceWrites,
    persistence: input.persistence, createId: randomUUID, requestForRun: (id) => requests.get(id),
    authorizeRun: async (reservation, expected) => {
      const request = requests.get(reservation.runId)
      if (!request) return false
      const result = await authority.state.read(request, "contributions", (stored, current) => {
        const run = stored.nativeRuns?.[reservation.runId]
        return digestSfValue(current) === digestSfValue(expected) && run?.state === "preparing" &&
          run.selection.profile.id === reservation.profileId && run.selection.manifestDigest === reservation.manifestDigest &&
          digestSfValue(run.caseRef) === digestSfValue(reservation.caseRef)
      })
      return result.status === "ok" && result.value
    },
    authorizeBinding: async (binding) => {
      const proof = observed.get(binding.nativeSessionId)
      return !!proof && authority.authorizeNative(proof.value.admission, binding)
    },
  })
  const gate = createSfTokenGate({ upstream: ClaudeCodeHost.node, isSfOwned: (id) => Effect.tryPromise(() => evidence.isSfOwned(id)) })
  const native = createSfNativeHostContribution({ registry: authority.native,
    onReady: (api) => { state.api = api; return () => { if (state.api === api) state.api = undefined } },
    onSkillLoaded: (value) => {
      if (!identity() || observed.has(value.session.id) || !selectionMatches(value.admission.selected)) throw new Error("SF_SKILL_OBSERVATION_INVALID")
      const proof = { value, digest: admissionDigest(value.admission) }
      observed.set(value.session.id, proof)
      return () => { if (observed.get(value.session.id) === proof) observed.delete(value.session.id) }
    },
    admit: (request) => Effect.tryPromise(async () => {
      if (!identity() || requests.get(request.runId) !== request.request || !selectionMatches(request.selected)) return false
      const result = await authority.state.read(request.request, "contributions", (stored, actor) => {
        const run = stored.nativeRuns?.[request.runId]
        const reserved = Object.entries(stored.preferences).some(([key, value]) => key.startsWith("sf:native-session:") && object(object(value).reservation).runId === request.runId)
        return !reserved && run?.state === "preparing" && !run.native && run.principalRef === actor.principalRef && run.accessRevision === actor.accessRevision &&
          digestSfValue(run.selection) === digestSfValue(request.selected) && digestSfValue(run.model) === digestSfValue(request.model) &&
          digestSfValue(run.caseRef) === digestSfValue(request.caseRef) && run.skillId === request.skillId &&
          digestSfValue(request.location) === digestSfValue(identity()?.location)
      })
      return result.status === "ok" && result.value
    }),
    authorize: (admission, binding) => Effect.tryPromise(() => authority.authorizeNative(admission, binding)),
    authorizeInterrupt: (admission, binding, request) => Effect.tryPromise(() => authority.authorizeInterrupt(admission, binding, request)),
    budget: { gate, reserveSession: (reservation) => Effect.tryPromise(() => evidence.reserveSession(reservation)),
      persistReceipt: (binding, receipt) => Effect.tryPromise(() => evidence.persistTokenReceipt(binding, receipt)) },
  })
  const roster = createSfRosterSources({ host: authority.host, scopedSources: input.persistence, plannerSources: createSfPlannerSourceHost({ host: authority.host, scopedSources: input.persistence, coverageFor: async () => ({ status: "unavailable", reason: "roster-coverage-unavailable" }) }) })
  const imports = createSfImportServices({ runtime: input, authority, roster })
  const documents = createSfDocumentServices({ runtime: input, authority })
  const questionContributions: { read?: ReturnType<typeof createSfContributionReader> } = {}
  const business = createSfBusinessServices({ authority, persistence: input.persistence, proposalCoverageWrites, procurementEvidenceWrites, dashboardHostWrites, caseSelectionWrites, threadHistoryWrites,
    readQuestionContribution: (request, call) => questionContributions.read?.(request, call) ?? Promise.resolve({ status: "unavailable", reason: "contribution-reader-unavailable" }),
    documentRead: documents?.documents.reader, documentEvidenceList: documents?.documents.list,
    extraDescriptors: [...imports?.descriptors ?? [], ...documents?.descriptors ?? []] })
  preparedAuthority.business = business
  const captureCurrent = (record: AlternativeCapabilityProvenance) => {
    const binding = alternativeBindings.get(record.receipt.runId)
    const proof = observed.get(record.receipt.nativeSessionId)
    return !!binding && !!proof && liveNativeBindings.get(binding.nativeSessionId) === binding && !revokedNativeBindings.has(binding) &&
      !invalidNativeGenerations.has(binding.providerGeneration) && binding.providerGeneration === state.generation && Date.now() < Date.parse(binding.expiresAt) && !proof.value.admission.request.signal.aborted &&
      requests.get(record.receipt.runId) === proof.value.admission.request &&
      binding.nativeSessionId === record.receipt.nativeSessionId && binding.providerGeneration === record.receipt.providerGeneration &&
      digestSfValue(alternativeCaptures.get(record.receipt.runId)?.get(record.operationIdentity)) === digestSfValue(record)
  }
  const revalidateCapture = async (record: AlternativeCapabilityProvenance) => {
    const binding = alternativeBindings.get(record.receipt.runId)
    const proof = observed.get(record.receipt.nativeSessionId)
    return !!binding && !!proof && captureCurrent(record) && await authority.authorizeNative(proof.value.admission, binding) && captureCurrent(record)
  }
  const nativeInputs = createSfNativeAnalysisInputs({ authority, selectedCase: business.selectedCase,
    requestForRun: (runRef) => requests.get(runRef), runForContext: (call) => replayContexts.get(call), admittedInput: (runRef) => admittedInputs.get(runRef),
    captures: (runRef) => [...alternativeCaptures.get(runRef)?.values() ?? []], revalidateCapture })
  const dossier = documents ? createSfDossierServices({ runtime: input, authority, business, documents }) : undefined
  const documentScenarioHttp = createSfDocumentScenarioHttp({ origin: input.origin, mount: input.mount, authority, service: business.documentScenarios })
  const readAuthorAnalysis = createSfAnalysisAuthorReader({ authority, context: business.context, resolveCase: business.resolveCase })
  const readContribution: ReturnType<typeof createSfContributionReader> = async (incoming, call) => {
    const wanted = structuredClone(incoming)
    const request = authority.host.requestFor(call)
    if (!request || call.kind !== "ui" || !await authority.host.revalidate(call)) return { status: "denied", reason: "contribution-authority-unavailable" }
    const found = await authority.state.read(request, "contributions", (stored, actor) => actor.principalRef === call.binding.principalRef &&
      actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion ? stored.contributions[wanted.outputRef] : undefined)
    if (found.status !== "ok") return { status: "unavailable", reason: "contribution-unavailable" }
    const decoded = decodeSfContributionEnvelope(found.value)
    if (!decoded.ok || decoded.value.id !== wanted.outputRef || digestSfValue(decoded.value.caseRef) !== digestSfValue(wanted.caseRef)) return { status: "unavailable", reason: "contribution-unavailable" }
    const bound = await business.resolveCase(call)
    const read = () => readAuthorAnalysis(decoded.value.runProvenance.runId, decoded.value.outputDigest, call)
    const result = bound.status === "ok" && digestSfValue(bound.value) === digestSfValue(wanted.caseRef) ? await read() :
      await business.withCase(call, wanted.caseRef, {}, read)
    if (result.status !== "ok") return result
    return result.value.output.id === wanted.outputRef && digestSfValue(result.value.output) === digestSfValue(decoded.value) &&
      digestSfValue(result.value.run.caseRef) === digestSfValue(wanted.caseRef) && await authority.host.revalidate(call)
      ? result : { status: "unavailable", reason: "contribution-changed" }
  }
  questionContributions.read = readContribution
  const baselineServices = createSfBaselineServices({ authority, business, proposalCoverageWrites, origin: input.origin, mount: input.mount })
  business.bindForecastCoverage(baselineServices.baseline.resolveForecastCoverage)
  const captures = createSfAlternativeCaptures({ authority, captures: alternativeCaptures,
    active: (record) => !!identity() && captureCurrent(record) })
  const outcomeReader: { current?: NonNullable<SfReviewReaders["outcome"]> } = {}
  const extended = createSfExtendedBusinessServices({ authority, business, persistence: input.persistence, proposalCoverageWrites, analysisSelectionWrites, procurementEvidenceWrites, origin: input.origin,
    reviewReaders: { contributions: { contributions: readContribution, results: business.results }, outcome: {
      read: (request, call) => outcomeReader.current?.read(request, call) ?? Promise.resolve({ status: "unavailable" }),
      authorize: (call, observations) => outcomeReader.current?.authorize(call, observations) ?? Promise.resolve(false),
    } } })
  const memory = createSfMemoryServices({ authority, business: { ...business, planner: extended.portfolioServices.planner }, signalRegistryWrites })
  const decisionDomain = createSfDecisionDomainServices({ authority, business, baseline: business.baselineCoverage, proposalCoverageWrites, signalRegistryWrites,
    sharedPortfolio: extended.portfolioServices, selectedCase: business.selectedCase, verifiedInputFor: nativeInputs.verifiedInputFor,
    verifiedAlternativeSelectionFor: nativeInputs.verifiedAlternativeSelectionFor,
    hasAdmittedInputContext: nativeInputs.hasAdmittedInputContext, readAlternativeCapture: nativeInputs.readAlternativeCapture })
  business.bindDecisionDomain(decisionDomain)
  const decisionDomainHttp = createSfDecisionDomainHttp({ origin: input.origin, mount: input.mount, runtime: () => identity() ? { authority, business, domain: decisionDomain } : undefined })
  const portfolioHttp = extended.portfolioServices.http({ origin: input.origin, mount: input.mount })
  outcomeReader.current = memory.reviewOutcome
  const memoryHttp = createSfMemoryHttp({ origin: input.origin, mount: input.mount, authority, memory, withCase: business.withCase })
  for (const replacement of extended.replacements) {
    const index = business.descriptors.findIndex((descriptor) => descriptor.id === replacement.id)
    if (index < 0) business.descriptors.push(replacement)
    else business.descriptors.splice(index, 1, replacement)
  }
  business.descriptors.push(...extended.descriptors)
  for (const replacement of decisionDomain.descriptors) {
    const index = business.descriptors.findIndex((descriptor) => descriptor.id === replacement.id)
    const previous = index >= 0 ? business.descriptors[index] : undefined
    const selected = previous && ["sf_alternative_draft", "sf_change_prepare"].includes(replacement.id)
      ? { ...replacement, handler: (payload: Parameters<typeof replacement.handler>[0], call: Parameters<typeof replacement.handler>[1]) =>
        nativeInputs.hasAdmittedInputContext(call) ? replacement.handler(payload, call) : previous.handler(payload, call) } : replacement
    if (index < 0) business.descriptors.push(selected)
    else business.descriptors.splice(index, 1, selected)
  }
  const routinePublication = createSfRoutinePublicationContribution({ identity, authorize: authority.authority.revalidateDomainContext })
  const routineInputs = createSfRoutineInputReaders({ cases: business.cases, context: business.context, resolveCase: business.resolveCase, revalidate: authority.host.revalidate })
  const routineServices = createSfRoutineServices({ authority: authority.authority, publication: routinePublication.publication, resolveCase: business.resolveCase, prepareWatch: memory.prepareWatch, ...routineInputs })
  // No public C07 native/publication ports are installed; keep unavailable status readers without advertising callable routines.
  const sourcingInputs = createSfSourcingInputs({ authority, business })
  const dashboardHttp = createSfDashboardHttp({ origin: input.origin, mount: input.mount, runtime: () => identity() ? { authority, dashboard: business.dashboardServices, decisions: business.dashboardDecisions } : undefined })
  const procurementDecisionHttp = createProcurementDecisionHttp({ origin: input.origin, mount: input.mount, runtime: () => identity() ? { human: authority.human, decisions: business.procurementDecisions, withCase: business.withCase } : undefined })
  const collaborationHuman = createCollaborationHumanAuthority({ origin: input.origin, ui: authority.ui })
  const collaborationHttp = new Map(["dashboard", "planner", "procurement"].map((surface) => [surface, createCollaborationHttp({
    origin: input.origin, mount: `${input.mount}/${surface}`, host: business.collaboration, human: collaborationHuman,
    admitRead: async (request, operation, payload) => {
      if (!identity() || !sfHumanReadActions.some((action) => action === operation)) return { status: "denied", reason: "collaboration-read-unavailable" }
      const action = `sf-human:${operation}`
      const digest = digestSfValue(payload)
      const admitted = await authority.ui.admit(request, action, digest)
      if (admitted.status !== "ok") return admitted
      if (!await authority.ui.validate(admitted.value, action, digest)) {
        authority.ui.finish(admitted.value)
        return { status: "denied", reason: "collaboration-read-unavailable" }
      }
      return admitted
    }, finishRead: authority.ui.finish,
  })]))
  const documentHttp = createSfDocumentHttp({ origin: input.origin, mount: input.mount, runtime: () => identity() && documents ? { ui: authority.ui, human: authority.human, ...documents } : undefined })
  const importHttp = createSfImportHttp({ origin: input.origin, mount: input.mount, runtime: () => identity() && imports ? { ui: authority.ui, human: authority.human, service: imports } : undefined })
  const monthly = createPlannerMonthlyHost({ host: authority.host, humanAuthorize: (context, action, value) => authority.human.authorize(context, action, value) })
  const plannerMonthly: NonNullable<SfHostServices["plannerMonthly"]> = {
    preview: (context, value) => monthly.preview(value, context), apply: (context, value) => monthly.apply(value, context),
  }
  const descriptors = business.descriptors
  const executions = new Map<string, ReturnType<typeof createSfNativeExecution>>()
  const starts = new Map<string, { digest: string; promise: Promise<PortResult<{ runRef: string }>> }>()
  const stopped = new Map<string, { marker: SfStoppedRun; timer: ReturnType<typeof setTimeout> }>()
  const analysisServices = createSfAnalysisHostServices({ authority, selected, analysisSelectionWrites, business: { ...business, planner: extended.portfolioServices.planner }, documents, imports,
    bindings: { ...extended.analysisBindings, biSource: extended.bi.source, caseRecall: business.caseRecall, readAlternativeCapture: nativeInputs.readAlternativeCapture,
      changeProposals: decisionDomain.changeProposals,
      replayAlternative: (request, call) => nativeInputs.hasAdmittedInputContext(call) ? decisionDomain.replayAlternative(request, call) : extended.alternatives.replay(request, call),
      selectedMaterialChanges: memory.selectedMaterialChanges } })
  const withMaterialSelection = <T>(call: TrustedDomainContext, action: "analysis.prepare" | "analysis.start", payload: { request: unknown; selection?: unknown; skillInput?: unknown }, work: () => Promise<PortResult<T>>): Promise<PortResult<T>> => {
    if (object(payload.request).skillId !== "sf-reavaliar-compromissos") return work()
    const selected = materialSelection(payload.request, action === "analysis.prepare" ? payload.selection : payload.skillInput)
    return selected ? memory.withMaterialSelection(call, { ...selected, action, payload }, work)
      : Promise.resolve({ status: "needs-input", reason: "materiality-selection-required" })
  }
  const verifiers = analysisServices.verifiers
  const analysisInputs: SfAnalysisInputPort = { prepare: async (call, incoming) => {
    const captured = structuredClone(incoming)
    const profile = selected.find((item) => item.profile.id === captured.request.profileId && item.profile.version === captured.request.profileVersion && item.manifestDigest === captured.request.manifestDigest)
    const skill = profile?.skills.find((item) => item.id === captured.request.skillId && item.version === captured.request.skillVersion)
    if (!profile || !skill || captured.request.requestedOperationScope.some((operation) => !skill.allowedOperations.includes(operation)))
      return { status: "denied", reason: "analysis-selection-unavailable" }
    return withMaterialSelection(call, "analysis.prepare", captured, () => analysisServices.registry.prepare(captured.selection, captured.request, call))
  } }
  const analyses: NonNullable<SfHostServices["analyses"]> = {
    start: async (context, incoming: SfAnalysisStartInput) => {
      const captured = structuredClone(incoming)
      const request = authority.host.requestFor(context)
      if (!request || !state.api || !identity() || !await authority.human.authorize(context, "analysis.start", captured))
        return { status: "denied", reason: "analysis-authority-unavailable" }
      const operation = authority.ui.operationIdentity(context)
      if (!operation) return { status: "denied", reason: "analysis-identity-unavailable" }
      const runRef = `sf-run-${digestSfValue({ installationId: context.binding.installationId, projectId: context.binding.projectId,
        principalRef: context.binding.principalRef, operation })}`
      const intentDigest = digestSfValue(captured)
      const pending = starts.get(runRef)
      if (pending) {
        if (pending.digest !== intentDigest) return { status: "conflict", reason: "analysis-idempotency-content-changed" }
        const result = await pending.promise
        return await authority.human.authorize(context, "analysis.start", captured) ? result : { status: "denied", reason: "analysis-authority-unavailable" }
      }
      const work = async (): Promise<PortResult<{ runRef: string }>> => {
      const claim = await authority.state.read(request, "contributions", (stored, actor) => {
        const run = stored.nativeRuns?.[runRef]
        return run && run.principalRef === actor.principalRef && run.accessRevision === actor.accessRevision && run.policyVersion === actor.policyVersion ? run.intentDigest : undefined
      })
      if (claim.status !== "ok") return "reason" in claim ? { status: claim.status, reason: claim.reason } : { status: "unavailable", reason: "analysis-state-unavailable" }
      if (claim.value !== undefined && !/^[a-f0-9]{64}$/.test(claim.value)) return { status: "unavailable", reason: "analysis-legacy-intent-unavailable" }
      if (claim.value !== undefined && claim.value !== intentDigest) return { status: "conflict", reason: "analysis-idempotency-content-changed" }
      const model = Schema.decodeUnknownOption(ModelV2.Ref)(captured.model)
      if (Option.isNone(model)) return { status: "needs-input", reason: "invalid-analysis-input" }
      const parent = selected.find((item) => item.profile.id === captured.request.profileId && item.profile.version === captured.request.profileVersion && item.manifestDigest === captured.request.manifestDigest)
      const skill = parent?.skills.find((item) => item.id === captured.request.skillId && item.version === captured.request.skillVersion)
      if (!parent || !skill || !captured.request.objective.trim() || captured.request.outputSchemaVersion !== "sf-contribution-v1" || captured.reviewTarget ||
        new Set(captured.request.requestedOperationScope).size !== captured.request.requestedOperationScope.length ||
        captured.request.requestedOperationScope.some((operation) => !skill.allowedOperations.includes(operation)))
        return { status: "denied", reason: "analysis-selection-unavailable" }
      const matching = verifiers.filter((item) => item.skillIds.includes(skill.id))
      if (matching.length !== 1) return { status: "unavailable", reason: "analysis-skill-verifier-unavailable" }
      const verifier = matching[0]!
      const decoded = decodeSfSkillInput(skill.inputSchemaRef as keyof SfSkillInputMap, captured.skillInput)
      if (!decoded.ok) return { status: "needs-input", reason: "invalid-analysis-input" }
      const skillInput = decoded.value
      const review = await analysisServices.resolveReviewTarget({
        request: captured.request, skillInput, runRef, ...(captured.authorAnalysis ? { authorAnalysis: captured.authorAnalysis } : {}),
      }, context)
      if (review.status !== "ok") return review
      const { author, reviewTarget } = review.value
      const chosen = { profile: parent.profile, manifestDigest: parent.manifestDigest, skills: [skill], operationIds: [...captured.request.requestedOperationScope] }
      if (!selectionMatches(chosen)) return { status: "denied", reason: "analysis-selection-unavailable" }
      const actualModel = sfNativeModelRef(model.value)
      const existing = async (): Promise<PortResult<{ runRef: string }> | undefined> => {
        const found = await authority.state.read(request, "contributions", (stored, actor) => {
          const run = stored.nativeRuns?.[runRef]
          return run && run.principalRef === actor.principalRef && run.accessRevision === actor.accessRevision && run.policyVersion === actor.policyVersion ? run : undefined
        })
        if (found.status !== "ok") return "reason" in found ? { status: found.status, reason: found.reason } : { status: "unavailable", reason: "analysis-state-unavailable" }
        if (!found.value) return undefined
        const run = found.value
        if (!run.intentDigest || !/^[a-f0-9]{64}$/.test(run.intentDigest)) return { status: "unavailable", reason: "analysis-legacy-intent-unavailable" }
        if (run.intentDigest !== intentDigest) return { status: "conflict", reason: "analysis-idempotency-content-changed" }
        if (run.requestDigest !== digestSfValue({ ...captured.request, contextFingerprint: run.contextFingerprint }) || run.skillInputDigest !== digestSfValue(skillInput) ||
          digestSfValue(run.model) !== digestSfValue(actualModel) || digestSfValue(run.selection) !== digestSfValue(chosen) || digestSfValue(run.reviewTarget) !== digestSfValue(reviewTarget))
          return { status: "conflict", reason: "analysis-idempotency-content-changed" }
        const current = await business.cases.read({ caseRef: encodeCaseRef(run.caseRef) }, context)
        if (current.status !== "ok" || !await authority.human.authorize(context, "analysis.start", captured)) return { status: "denied", reason: "analysis-authority-unavailable" }
        if (!run.native) return { status: "unavailable", reason: run.state === "preparing" ? "analysis-admission-in-progress" : "analysis-admission-not-attached" }
        return { status: "ok", value: { runRef } }
      }
      const prior = await existing()
      if (prior) return prior
      if (executions.size + starts.size + stopped.size > 256) return { status: "unavailable", reason: "analysis-registry-full" }
      const available = await state.models?.().catch(() => undefined)
      if (!available?.some((item) => item.providerID === actualModel.providerID && item.id === actualModel.id))
        return { status: "unavailable", reason: "analysis-model-unavailable" }
      const baseRequest = captured.request
      const verifiedInput = structuredClone(skillInput)
      const selectedRuntime = structuredClone(chosen)
      const withRunContext = async <T>(id: string, action: (call: TrustedDomainContext) => Promise<PortResult<T>>): Promise<PortResult<T>> => {
        if (id !== runRef || request.signal.aborted || !identity()) return { status: "denied", reason: "analysis-authority-unavailable" }
        const admitted = await authority.human.admit(request, "analysis.start", captured)
        if (admitted.status !== "ok") return admitted
        replayContexts.set(admitted.value, runRef)
        try { return await business.withCase(admitted.value, baseRequest.caseRef, {}, () => action(admitted.value)) } finally { replayContexts.delete(admitted.value); authority.human.finish(admitted.value) }
      }
      const verify = async (call: TrustedDomainContext) => {
        const result = await withMaterialSelection(call, "analysis.start", captured, () => verifier.verify(verifiedInput, baseRequest, call))
        if (result.status !== "ok" || digestSfValue(result.value.input) !== digestSfValue(verifiedInput) ||
          result.value.current.id !== baseRequest.caseRef.id || result.value.current.incarnation !== baseRequest.caseRef.incarnation ||
          result.value.current.version !== baseRequest.caseRef.version || !sfAnalysisSourcesAuthorized(result.value, baseRequest, call) ||
          !await authority.host.revalidate(call)) return undefined
        return { ...result.value, acceptsOutput: (output: Parameters<typeof result.value.acceptsOutput>[0], next: TrustedDomainContext) =>
          withMaterialSelection(next, "analysis.start", captured, () => result.value.acceptsOutput(output, next)) }
      }
      const sourceProjection = (proof: NonNullable<Awaited<ReturnType<typeof verify>>>) => ({
        sources: proof.sources.map((item) => sfHistoricalMemoryRequested(baseRequest, proof.input) ? sfMemoryEvidence(item) : { ref: item.ref, projection: item.authorizedProjection }),
        ...(proof.promptContext ? { promptContext: proof.promptContext } : {}),
      })
      const first = await verify(context)
      if (!first) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const fingerprint = digestSfValue(withoutObservationTimes({ case: first.current, skillInput: verifiedInput, selected: selectedRuntime, reviewTarget,
        accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, sources: sourceProjection(first) }))
      const fullRequest = { ...baseRequest, contextFingerprint: fingerprint }
      // Capture the human's explicit target once. A later selection cannot grant a running model a different draft target.
      const alternativeSelection = fullRequest.profileId === "sf_finance" && fullRequest.skillId === "sf-comparar-cenarios" && fullRequest.requestedOperationScope.includes("sf_alternative_draft")
        ? await decisionDomain.captureAlternativeSelection(fullRequest, captured, context) : undefined
      if (alternativeSelection && alternativeSelection.status !== "ok" && !(alternativeSelection.status === "needs-input" && alternativeSelection.reason === "selection-not-created")) return alternativeSelection
      const fences: { current?: Record<"dashboard" | "planner" | "procurement", string> } = {}
      const readFences = () => input.persistence.transactionAll?.(async (snapshots) => ({ commit: false, value: {
        dashboard: sfRunSourceFence(snapshots.dashboard), planner: sfRunSourceFence(snapshots.planner), procurement: sfRunSourceFence(snapshots.procurement),
      } }))
      const readForCancellation = async (id: string, call: TrustedDomainContext): Promise<PortResult<SfNativeRunRecord>> => {
        const source = authority.host.requestFor(call)
        if (id !== runRef || !source || !await authority.host.revalidate(call)) return { status: "denied", reason: "analysis-authority-unavailable" }
        const found = await authority.state.read(source, "contributions", (stored, actor) => {
          const run = stored.nativeRuns?.[id]
          const current = run && stored.cases[run.caseRef.id]
          return run && current && current.incarnation === run.caseRef.incarnation && current.version >= run.caseRef.version && current.participants.includes(actor.principalRef) &&
            run.principalRef === actor.principalRef && run.policyVersion === actor.policyVersion && run.accessRevision === actor.accessRevision ? run : undefined
        })
        if (found.status !== "ok") return "reason" in found ? { status: found.status, reason: found.reason } : { status: "unavailable", reason: "analysis-state-unavailable" }
        return found.value && await authority.host.revalidate(call) ? { status: "ok", value: found.value } : { status: "denied", reason: "analysis-authority-unavailable" }
      }
      const runState = createSfAlternativeRunState({ state: authority.state, proposalCoverageWrites, nativePublicationGuards, captureCurrent, runRef,
        captures: () => [...alternativeCaptures.get(runRef)?.values() ?? []] })
      const store = createSfRunStore({ state: runState, readCapturedAlternative: nativeInputs.readCapturedAlternative, requestFor: authority.host.requestFor, revalidate: authority.host.revalidate,
        requiredNamespaces: sfAnalysisSourceNamespaces(fullRequest.skillId),
        preflight: async (record, call, output) => {
          if (record.state === "cancelled") {
            const current = await readForCancellation(record.runRef, call)
            if (current.status !== "ok" || current.value.native?.sessionID !== record.native?.sessionID)
              return { status: "denied", reason: "analysis-cancellation-unavailable" }
            const dashboard = await input.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: sfRunSourceFence(snapshot) }))
            fences.current = { dashboard, planner: "", procurement: "" }
            return { status: "ok", value: { sourceFence: dashboard } }
          }
          const before = await readFences()
          if (!before) return { status: "unavailable", reason: "analysis-source-fence-unavailable" }
          const proof = await verify(call)
          const after = await readFences()
          if (!proof || !after || digestSfValue(before) !== digestSfValue(after) || record.contextFingerprint !== fingerprint ||
            digestSfValue(withoutObservationTimes({ case: proof.current, skillInput: verifiedInput, selected: selectedRuntime, reviewTarget,
              accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion, sources: sourceProjection(proof) })) !== fingerprint)
            return { status: "stale", reason: "analysis-source-changed" }
          if (output) {
            const accepted = await proof.acceptsOutput(output, call)
            if (accepted.status !== "ok" || accepted.value !== true) return { status: "denied", reason: "analysis-output-unverified" }
          }
          fences.current = after
          return { status: "ok", value: { sourceFence: after.dashboard } }
        },
        revalidateForCommit: async (record, call, snapshot, output, alternative) => {
          if (record.state === "cancelled") return fences.current && sfRunSourceFence(snapshot) === fences.current.dashboard && await authority.host.revalidate(call)
            ? { status: "ok", value: true } : { status: "denied", reason: "analysis-cancellation-unavailable" }
          if (alternative && (!captures.matchesLive(alternative) || !output || alternative.receipt.resultDigest !== digestSfValue(output.payload)))
            return { status: "denied", reason: "alternative-capture-changed" }
          const current = input.persistence.currentSnapshots?.()
          if (!current || !fences.current || !await authority.host.revalidate(call)) return { status: "unavailable", reason: "analysis-source-fence-unavailable" }
          if (reviewTarget && author) {
            const stored = object(snapshot.data.__sfProductV1)
            const authorRun = object(stored.nativeRuns)[reviewTarget.targetRunId]
            const authorOutput = object(stored.contributions)[author.output.id]
            if (digestSfValue({ run: authorRun, output: authorOutput }) !== digestSfValue(author))
              return { status: "stale", reason: "author-analysis-changed" }
          }
          const actual = { dashboard: sfRunSourceFence(snapshot), planner: sfRunSourceFence(current.planner), procurement: sfRunSourceFence(current.procurement) }
          if (digestSfValue(actual) !== digestSfValue(fences.current) || record.contextFingerprint !== fingerprint) return { status: "stale", reason: "analysis-source-changed" }
          if (alternative && (!output || !await revalidateCapture(alternative))) return { status: "denied", reason: "alternative-capture-authority-changed" }
          return { status: "ok", value: true }
        }, now: () => new Date().toISOString() })
      const announcement = Promise.withResolvers<PortResult<{ runRef: string }>>()
      const host = state.api
      if (!host || !identity()) return { status: "unavailable", reason: "analysis-host-unavailable" }
      const execution = createSfNativeExecution({ host, store, withRunContext, intentDigest,
        preflight: async (requested, decodedSkill) => {
          if (digestSfValue(requested) !== digestSfValue(fullRequest) || digestSfValue(decodedSkill) !== digestSfValue(verifiedInput)) return { status: "denied", reason: "analysis-input-changed" }
          const admission = await withRunContext(runRef, async (call) => {
            const proof = await verify(call)
            if (!proof) return { status: "unavailable", reason: "analysis-source-unavailable" }
            if (alternativeSelection?.status === "ok") {
              const again = await decisionDomain.captureAlternativeSelection(fullRequest, captured, call)
              if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(alternativeSelection.value))
                return { status: "stale", reason: "alternative-admitted-selection-changed" }
            }
            const at = new Date().toISOString()
            const record: SfNativeRunRecord = { schema: "sf-native-run-v1", runRef, version: 1, intentDigest, requestDigest: digestSfValue(fullRequest), skillInputDigest: digestSfValue(verifiedInput),
              principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion, caseRef: baseRequest.caseRef,
              selection: selectedRuntime, model: actualModel, skillId: skill.id, objective: baseRequest.objective, contextFingerprint: fingerprint, createdAt: at, updatedAt: at, state: "preparing", ...(reviewTarget ? { reviewTarget } : {}) }
            const location = identity()?.location
            if (!location) return { status: "unavailable", reason: "analysis-host-unavailable" }
            requests.set(runRef, request)
            admittedInputs.set(runRef, { request: structuredClone(fullRequest), input: structuredClone(verifiedInput),
              ...(alternativeSelection?.status === "ok" ? { alternativeSelection: structuredClone(alternativeSelection.value) } : {}) })
            return { status: "ok", value: { record, native: { request, selected: selectedRuntime, location, model: actualModel, skillId: skill.id,
              prompt: sfAnalysisPrompt(baseRequest.objective, proof),
              runId: runRef, caseRef: baseRequest.caseRef, entryMode: "interactive" as const, toolCallBudget: Math.max(1, skill.limits.maxSteps), skillLoadBudget: 0 } } }
          })
          return admission
        },
        verifyOutput: async (output, _record, call) => {
          const proof = await verify(call)
          if (!proof) return { status: "unavailable", reason: "analysis-output-unverified" }
          return proof.acceptsOutput(output, call)
        },
        onAdmitted: (id) => { executions.set(id, execution); announcement.resolve({ status: "ok", value: { runRef: id } }) },
        authorizeCancellation: (id, call) => authority.human.authorize(call, "analysis.cancel", { runRef: id }),
        cancellationRequest: authority.host.requestFor,
        readForCancellation,
        cancelAdmitted: async (id, call) => {
          const current = await readForCancellation(id, call)
          if (current.status !== "ok") return current
          const saved = await store.transition(id, current.value.version, "cancelled", "human-cancelled", call)
          return saved.status === "ok" ? { status: "ok", value: { cancelled: true } } : saved
        } })
      const unavailable = async () => ({ status: "unavailable" as const, reason: "analysis-operation-unavailable" })
      const analysis: BusinessPorts["analysis"] = { create: unavailable, read: unavailable, cancel: async (id, call) => {
        const current = await store.read(id, call)
        if (current.status !== "ok") return current
        const saved = await store.transition(id, current.value.version, "cancelled", "human-cancelled", call)
        return saved.status === "ok" ? { status: "ok", value: { cancelled: true } } : saved
      } }
      const analysisHost = createSfAnalysisHost({ store, execution, analysis, routines: routineServices.routines, withRunContext,
        alternativeForOutput: async (id, resultDigest, call) => {
          const found = await nativeInputs.readAlternativeCapture(id, resultDigest, call)
          return found.status === "ok" ? { status: "ok", value: found.value.record } : found
        },
        verify: async (call, _record, value) => {
          const proof = await verify(call)
          if (!proof) return { status: "unavailable", reason: "analysis-output-unverified" }
          if (value.output) {
            const accepted = await proof.acceptsOutput(value.output, call)
            if (accepted.status !== "ok" || accepted.value !== true) return { status: "unavailable", reason: "analysis-output-unverified" }
          }
          return { status: "ok", value: true }
        } })
      void runSfAnalysis({ host: analysisHost, request: fullRequest, skillInput: verifiedInput, ...(reviewTarget ? { reviewTarget } : {}) }).then(async (result) => {
        if (result.status !== "ok") {
          const status = (["conflict", "denied", "failed", "needs-input", "provider-conflict", "stale", "unavailable"] as const).find((status) => status === result.status) ?? "unavailable"
          announcement.resolve(await existing() ?? { status, reason: "reason" in result && typeof result.reason === "string" ? result.reason : "analysis-unavailable" })
        }
        else announcement.resolve({ status: "unavailable", reason: "analysis-admission-missing" })
      }).catch(async () => {
        await withRunContext(runRef, (call) => analysisHost.settle(runRef, "unavailable", "analysis-outcome-unknown", call)).catch(() => undefined)
        announcement.resolve({ status: "unavailable", reason: "analysis-outcome-unknown" })
      }).finally(async () => {
        const marker = await execution.releaseRun(runRef).catch(() => undefined)
        executions.delete(runRef)
        requests.delete(runRef)
        admittedInputs.delete(runRef)
        alternativeCaptures.delete(runRef)
        alternativeBindings.delete(runRef)
        if (marker && identity()) {
          const old = stopped.get(runRef)
          if (old) clearTimeout(old.timer)
          const timer = setTimeout(() => { stopped.delete(runRef) }, 5 * 60_000)
          stopped.set(runRef, { marker, timer })
        }
      })
      return announcement.promise
      }
      const promise = Promise.resolve().then(() => business.withCase(context, captured.request.caseRef, {}, work)).catch(() => ({ status: "unavailable" as const, reason: "analysis-start-unavailable" }))
      starts.set(runRef, { digest: intentDigest, promise })
      void promise.finally(() => { if (starts.get(runRef)?.promise === promise) starts.delete(runRef) })
      return promise
    },
    list: async (context, caseRef) => {
      const request = authority.host.requestFor(context)
      const intent = { caseRef }
      if (!request || !await authority.human.authorize(context, "analysis.read", intent)) return { status: "denied", reason: "analysis-authority-unavailable" }
      const current = await business.cases.read({ caseRef: encodeCaseRef(caseRef) }, context)
      if (current.status !== "ok" || current.value.case.version !== caseRef.version) return { status: "denied", reason: "analysis-case-unavailable" }
      const found = await authority.state.read(request, "contributions", (stored, actor) => Object.values(stored.nativeRuns ?? {})
        .filter((run) => run.principalRef === actor.principalRef && run.policyVersion === actor.policyVersion && run.accessRevision === actor.accessRevision &&
          run.caseRef.id === caseRef.id && run.caseRef.incarnation === caseRef.incarnation && run.caseRef.version <= caseRef.version)
        .map((run) => ({ runRef: run.runRef, state: run.state, version: run.version, ...("outputRef" in run && run.outputRef ? { outputRef: run.outputRef } : {}) })))
      if (found.status !== "ok") return "reason" in found ? { status: found.status, reason: found.reason } : { status: "unavailable", reason: "analysis-state-unavailable" }
      const again = await business.cases.read({ caseRef: encodeCaseRef(caseRef) }, context)
      if (again.status !== "ok" || digestSfValue(again.value.case) !== digestSfValue(current.value.case) || !await authority.human.authorize(context, "analysis.read", intent))
        return { status: "denied", reason: "analysis-authority-unavailable" }
      return { status: "ok", value: found.value }
    },
    read: async (context, runRef) => {
      const request = authority.host.requestFor(context)
      if (!request || !await authority.human.authorize(context, "analysis.read", { runRef })) return { status: "denied", reason: "analysis-authority-unavailable" }
      const found = await authority.state.read(request, "contributions", (stored, actor) => {
        const run = stored.nativeRuns?.[runRef]
        const current = run && stored.cases[run.caseRef.id]
        return run && current && current.incarnation === run.caseRef.incarnation && current.participants.includes(actor.principalRef) && run.principalRef === actor.principalRef &&
          run.accessRevision === actor.accessRevision && run.policyVersion === actor.policyVersion ? run : undefined
      })
      if (found.status !== "ok") return "reason" in found ? { status: found.status, reason: found.reason } : { status: "unavailable", reason: "analysis-state-unavailable" }
      if (!found.value || !await authority.human.authorize(context, "analysis.read", { runRef })) return { status: "denied", reason: "analysis-authority-unavailable" }
      const again = await authority.state.read(request, "contributions", (stored, actor) => {
        const run = stored.nativeRuns?.[runRef]
        const current = run && stored.cases[run.caseRef.id]
        return run && current && current.incarnation === run.caseRef.incarnation && current.participants.includes(actor.principalRef) && run.principalRef === actor.principalRef && run.accessRevision === actor.accessRevision && run.policyVersion === actor.policyVersion ? run : undefined
      })
      if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(found.value) || !await authority.human.authorize(context, "analysis.read", { runRef })) return { status: "denied", reason: "analysis-authority-unavailable" }
      return { status: "ok", value: structuredClone(found.value) }
    },
    output: async (context, runRef) => {
      const request = authority.host.requestFor(context)
      if (!request || !await authority.human.authorize(context, "analysis.read", { runRef })) return { status: "denied", reason: "analysis-authority-unavailable" }
      const read = () => authority.state.read(request, "contributions", (stored, actor) => {
        const run = stored.nativeRuns?.[runRef]
        const current = run && stored.cases[run.caseRef.id]
        const output = run?.outputRef && stored.contributions[run.outputRef]
        if (!run || run.state !== "ready" || !run.native || !output || !current || current.incarnation !== run.caseRef.incarnation ||
          !current.participants.includes(actor.principalRef) || run.principalRef !== actor.principalRef || run.policyVersion !== actor.policyVersion || run.accessRevision !== actor.accessRevision) return undefined
        return { run, output }
      })
      const found = await read()
      if (found.status !== "ok" || !found.value) return { status: "unavailable", reason: "analysis-output-unavailable" }
      const decoded = decodeSfContributionEnvelope(found.value.output)
      const run = found.value.run
      if (!decoded.ok || !run.native || decoded.value.id !== run.outputRef || decoded.value.outputDigest !== digestSfContribution(decoded.value) ||
        digestSfValue(decoded.value.caseRef) !== digestSfValue(run.caseRef) || decoded.value.accessRevision !== run.accessRevision ||
        decoded.value.runProvenance.runId !== runRef || decoded.value.runProvenance.nativeSessionId !== run.native.sessionID ||
        decoded.value.runProvenance.contextFingerprint !== run.contextFingerprint || decoded.value.runProvenance.actualModel !== `${run.model.providerID}/${run.model.id}` ||
        digestSfValue(Object.fromEntries(Object.keys(run.native.skillReceipt).map((key) => [key, decoded.value.runProvenance[key as keyof typeof run.native.skillReceipt]]))) !== digestSfValue(run.native.skillReceipt))
        return { status: "unavailable", reason: "analysis-output-invalid" }
      const current = await business.cases.read({ caseRef: encodeCaseRef(run.caseRef) }, context)
      if (decoded.value.kind === "DocumentEvidence") {
        if (!documents || decoded.value.state !== "ready" || digestSfValue(decoded.value.evidenceRefs) !== digestSfValue([decoded.value.payload.ref]))
          return { status: "unavailable", reason: "analysis-output-invalid" }
        const source = await readSfDocumentAnalysisCandidate(decoded.value.payload, context, documents.documents.evidenceHost)
        const again = await read()
        const checked = await readSfDocumentAnalysisCandidate(decoded.value.payload, context, documents.documents.evidenceHost)
        const currentAgain = await business.cases.read({ caseRef: encodeCaseRef(run.caseRef) }, context)
        if (current.status !== "ok" || current.value.case.incarnation !== run.caseRef.incarnation || current.value.case.version < run.caseRef.version ||
          source.status !== "ok" || checked.status !== "ok" || digestSfValue(source.value) !== digestSfValue(checked.value) ||
          currentAgain.status !== "ok" || digestSfValue(currentAgain.value.case) !== digestSfValue(current.value.case) ||
          again.status !== "ok" || !again.value || digestSfValue(again.value) !== digestSfValue(found.value) ||
          !await authority.human.authorize(context, "analysis.read", { runRef }))
          return { status: "denied", reason: "analysis-output-authority-changed" }
        return { status: "ok", value: decoded.value }
      }
      const resolutions = await business.context.context({ refs: decoded.value.evidenceRefs }, context)
      const again = await read()
      const checked = await business.context.context({ refs: decoded.value.evidenceRefs }, context)
      const currentAgain = await business.cases.read({ caseRef: encodeCaseRef(run.caseRef) }, context)
      if (current.status !== "ok" || current.value.case.incarnation !== run.caseRef.incarnation || current.value.case.version < run.caseRef.version ||
        resolutions.length !== decoded.value.evidenceRefs.length || resolutions.some((item, index) =>
          digestSfValue(item.ref) !== digestSfValue(decoded.value.evidenceRefs[index]) || !item.currentRef || !item.authorizedProjection ||
          (item.state !== "fresh" && item.state !== "historical") || (item.state === "historical" && !item.differences)) ||
        digestSfValue(withoutObservationTimes(resolutions.map((item) => ({ state: item.state, ref: item.ref, currentRef: item.currentRef, projection: item.authorizedProjection, differences: item.differences })))) !==
          digestSfValue(withoutObservationTimes(checked.map((item) => ({ state: item.state, ref: item.ref, currentRef: item.currentRef, projection: item.authorizedProjection, differences: item.differences })))) ||
        currentAgain.status !== "ok" || digestSfValue(currentAgain.value.case) !== digestSfValue(current.value.case) ||
        again.status !== "ok" || !again.value || digestSfValue(again.value) !== digestSfValue(found.value) || !await authority.human.authorize(context, "analysis.read", { runRef }))
        return { status: "denied", reason: "analysis-output-authority-changed" }
      return { status: "ok", value: decoded.value }
    },
    cancel: async (context, runRef) => {
      if (!await authority.human.authorize(context, "analysis.cancel", { runRef })) return { status: "denied", reason: "analysis-authority-unavailable" }
      const execution = executions.get(runRef)
      if (execution) {
        const result = await execution.cancelRun(runRef, context)
        if (result.status === "ok" && result.value.cancelled && executions.get(runRef) === execution) executions.delete(runRef)
        return result
      }
      const saved = stopped.get(runRef)
      const request = authority.host.requestFor(context)
      if (!saved || !request || saved.marker.principalRef !== context.binding.principalRef || saved.marker.accessRevision !== context.binding.accessRevision || saved.marker.policyVersion !== context.binding.policyVersion)
        return { status: "unavailable", reason: "native-run-not-active" }
      const read = () => authority.state.read(request, "contributions", (stored, actor) => {
        const run = stored.nativeRuns?.[runRef]
        const current = run && stored.cases[run.caseRef.id]
        return run && run.native && current && current.incarnation === saved.marker.caseRef.incarnation && current.version >= saved.marker.caseRef.version &&
          current.participants.includes(actor.principalRef) && run.principalRef === actor.principalRef && run.accessRevision === actor.accessRevision && run.policyVersion === actor.policyVersion &&
          digestSfValue(run.caseRef) === digestSfValue(saved.marker.caseRef) && run.native.sessionID === saved.marker.sessionID && digestSfValue(run.native.skillReceipt) === saved.marker.receiptDigest ? run : undefined
      })
      const current = await read()
      if (current.status !== "ok" || !current.value || !await authority.human.authorize(context, "analysis.cancel", { runRef })) return { status: "denied", reason: "analysis-authority-unavailable" }
      if (current.value.state !== "cancelled") {
        const cancellation = createSfRunStore({ state: authority.state, requestFor: authority.host.requestFor, revalidate: authority.host.revalidate,
          preflight: async (record, call) => {
            if (record.state !== "cancelled" || !await authority.human.authorize(call, "analysis.cancel", { runRef })) return { status: "denied", reason: "analysis-authority-unavailable" }
            const value = await read()
            if (value.status !== "ok" || !value.value || (value.value.version + 1 !== record.version && digestSfValue(value.value) !== digestSfValue(record)))
              return { status: "stale", reason: "analysis-run-changed" }
            const sourceFence = await input.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: sfRunSourceFence(snapshot) }))
            return { status: "ok", value: { sourceFence } }
          },
          revalidateForCommit: async (record, call, snapshot) => {
            const stored = object(object(snapshot.data.__sfProductV1).nativeRuns)[runRef]
            const native = object(object(stored).native)
            const permitted = record.state === "cancelled" && object(stored).version === record.version - 1 && native.sessionID === saved.marker.sessionID &&
              digestSfValue(native.skillReceipt) === saved.marker.receiptDigest && await authority.human.authorize(call, "analysis.cancel", { runRef })
            return permitted ? { status: "ok", value: true } : { status: "denied", reason: "analysis-authority-unavailable" }
          }, now: () => new Date().toISOString() })
        const result = await cancellation.transition(runRef, current.value.version, "cancelled", "human-cancelled", context)
        if (result.status !== "ok") return result
      }
      clearTimeout(saved.timer)
      if (stopped.get(runRef) === saved) stopped.delete(runRef)
      return { status: "ok", value: { cancelled: true } }
    },
  }
  const product = createSfProductContribution({ registry: authority.native, authority: authority.authority, selected, source: bundle.source,
    descriptors, onRegistered: native.onRegistered, onVerifiedCall: (operation, payload, result, call) => {
      if (operation !== "sf_alternative_draft") return true
      if (!requests.has(call.binding.runId)) return false
      const request = decodeSfOperationInput("sf_alternative_draft", payload)
      const output = decodeSfOperationOutput("sf_alternative_draft", result.result)
      if (!request.ok || !output.ok) return false
      const identity = authority.native.operationIdentity?.(call)
      if (!identity) return false
      const captured = captureAlternativeProvenance(request.value, output.value, result.receipt, call, identity)
      if (!captured) return false
      const current = alternativeCaptures.get(call.binding.runId) ?? new Map<string, AlternativeCapabilityProvenance>()
      const previous = current.get(identity)
      if (previous) return digestSfValue(previous) === digestSfValue(captured)
      if (current.size >= 100) return false
      current.set(identity, captured)
      alternativeCaptures.set(call.binding.runId, current)
      const previousBinding = alternativeBindings.get(call.binding.runId)
      if (previousBinding && digestSfValue(previousBinding) !== digestSfValue(call.binding)) { current.delete(identity); return false }
      alternativeBindings.set(call.binding.runId, call.binding)
      return true
    } })
  const node = makeGlobalNode({
    name: "sucafina/host-context",
    deps: [ProjectV2.node, SessionStore.node, LocationServiceMap.node, AppProcess.node],
    layer: Layer.effectDiscard(Effect.gen(function* () {
      const projects = yield* ProjectV2.Service
      const store = yield* SessionStore.Service
      const locations = yield* LocationServiceMap.Service
      const process = yield* AppProcess.Service
      const scanner = yield* Effect.promise(() => probeSfAtlasScanner(process))
      business.initializeAtlas(scanner, { boundaryVersion: atlasPackage.version, schemaVersion: contractFreeze.canonicalSha256,
        manifestVersion: bundle.manifestDigest, skillVersion: digestSfValue(bundle.skills.map((skill) => ({ id: skill.id, version: skill.version, sourceDigest: skill.sourceDigest }))) })
      if (new Set(descriptors.map((descriptor) => descriptor.id)).size !== descriptors.length ||
        descriptors.some((descriptor) => !contractFreeze.operations.some((entry) => entry.operation === descriptor.id)) ||
        descriptors.length + business.remainingOperations().length !== contractFreeze.operations.length) throw new Error("SF_OPERATION_REGISTRY_INVALID")
      const project = yield* projects.resolve(directory)
      const identity = Object.freeze({ installationId: input.installationId, hostId: randomUUID(), projectId: project.id,
        location: Object.freeze(sfNativeLocationRef({ directory })) })
      state.identity = identity
      state.store = store
      state.models = async () => {
        const data = await Effect.runPromise(Effect.gen(function* () {
          const catalog = yield* Catalog.Service
          const mcp = yield* Mcp.Service
          return { models: yield* catalog.model.available(), servers: yield* mcp.config() }
        }).pipe(Effect.provide(locations.get(identity.location)))).catch(() => undefined)
        if (!data || state.identity !== identity) throw new Error("SF_CATALOG_UNAVAILABLE")
        // Public metadata only; credentials, provider headers and endpoint configuration remain opaque.
        const digest = digestSfValue({ models: data.models.map((model) => ({ providerID: model.providerID, id: model.id,
          api: { id: model.api.id, type: model.api.type }, variants: model.variants.map((variant) => variant.id).toSorted(), limit: model.limit }))
          .toSorted((left, right) => `${left.providerID}:${left.id}`.localeCompare(`${right.providerID}:${right.id}`)),
          servers: data.servers })
        if (state.configuration !== digest) { state.configuration = digest; state.generation += 1 }
        return data.models.map((model) => ({ providerID: model.providerID, id: model.id }))
      }
      yield* Effect.addFinalizer(() => Effect.gen(function* () {
        if (state.identity !== identity) return
        yield* Effect.promise(() => Promise.allSettled([...executions.values()].map((execution) => execution.shutdown())))
        executions.clear()
        stopped.forEach((entry) => clearTimeout(entry.timer)); stopped.clear()
        state.identity = undefined; state.store = undefined; state.models = undefined; requests.clear(); admittedInputs.clear(); observed.clear(); alternativeCaptures.clear(); alternativeBindings.clear(); liveNativeBindings.clear(); invalidNativeGenerations.clear(); decisionDomain.dispose(); business.dispose(); extended.dispose(); documents?.dispose()
      }))
    })),
  })
  const personalViews = createSfPersonalViews({ host: authority.host, state: authority.state, creationTarget: authority.creationTarget,
    operationIdentity: (call) => call.kind === "ui" ? authority.ui.operationIdentity(call) : undefined, humanAuthorize: (call, action, payload) => authority.human.authorize(call, action, payload),
    authorizeView: createSfPersonalViewAuthority({ authority }) })
  const analysisHttp = createSfAnalysisHttp({ origin: input.origin, mount: input.mount,
    runtime: () => identity() ? { human: authority.human, selected, models: async () => state.models ? state.models() : [], inputs: analysisInputs, start: analyses.start,
      choices: (request) => readSfImportAnalysisChoices(request, services) } : undefined })
  const services: SfHostServices & { analysisInputs: SfAnalysisInputPort; productHtml: SfProductHtml } = { ...authority, productView: business.procurementQueueView, productHtml: extended.productHtml,
    procurementSelections: business.procurementSelections, forecastInputs: createSfForecastInputAdapter({ authority, business, selected, inputs: analysisInputs }), sourcingInputs, work: business.collaboration.work,
    analysisInputs, analyses, plannerMonthly, personalViews, documents: documents?.documents, routineRuns: routineServices.routineRuns,
    productHttp: async (request, surface) => await analysisHttp(request, surface) ?? await decisionDomainHttp(request, surface) ?? await portfolioHttp(request, surface) ?? await baselineServices.productHttp(request, surface) ?? await memoryHttp(request, surface) ?? await extended.productHttp(request, surface) ?? await dashboardHttp(request, surface) ?? await procurementDecisionHttp(request, surface) ?? await collaborationHttp.get(surface)?.(request) ?? await documentHttp(request, surface) ?? await importHttp(request, surface) ?? await dossier?.http(request, surface) ?? await documentScenarioHttp(request, surface),
    selected, dispatch: createSfProductDispatch({ descriptors, authority: authority.authority }), models: async () => state.models ? state.models() : [], sessions: {
    prepare: async (request) => {
      if (!state.api || !identity()) return { status: "unavailable", reason: "native-host-unavailable" }
      if (requests.has(request.runId)) return { status: "conflict", reason: "native-run-already-admitted" }
      requests.set(request.runId, request.request)
      request.request.signal.addEventListener("abort", () => { if (requests.get(request.runId) === request.request) requests.delete(request.runId) }, { once: true })
      return Effect.runPromise(state.api.prepare(request), { signal: request.request.signal })
    },
    execute: (binding) => state.api ? Effect.runPromise(state.api.execute(binding), { signal: requests.get(binding.runId)?.signal }) : Promise.resolve({ status: "unavailable", reason: "native-host-unavailable" }),
    collect: (binding) => state.api ? Effect.runPromise(state.api.collect(binding)) : Promise.resolve({ status: "unavailable", reason: "native-host-unavailable" }),
    interrupt: (binding) => state.api ? Effect.runPromise(state.api.interrupt(binding)) : Promise.resolve({ status: "unavailable", reason: "native-host-unavailable" }),
  } }
  return { identity, services: () => identity() ? services : undefined,
    contributions: [{ id: "sucafina-host-context", nodes: [node] }, gate.contribution, native.contribution, routinePublication.contribution, product] }
}

function admissionDigest(admission: SfNativeAdmission) {
  return digestSfValue({ ...admission, request: undefined })
}
