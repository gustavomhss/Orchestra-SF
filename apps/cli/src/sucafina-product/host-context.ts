import { randomUUID } from "node:crypto"
import { dashboardPages, plannerKeys, procurementKeys } from "../../../../modules/sucafina/Sucafinav1/src/nav.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { createSfPersonalViews } from "../../../../modules/sucafina/Sucafinav1/product/interface/personal-views.ts"
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
import { createSfDocumentTargetAuthority } from "./document-authority.ts"
import { createSfDocumentServices } from "./document-services.ts"
import { createSfDocumentHttp } from "../../../../modules/sucafina/Sucafinav1/product/interface/document-http.ts"
import { createSfImportServices } from "./import-services.ts"
import { createSfImportHttp } from "../../../../modules/sucafina/Sucafinav1/product/interface/import-http.ts"
import { createSfBusinessServices } from "./business-services.ts"
import { createSfProductContribution, createSfProductDispatch } from "./contribution.ts"
import { createSfTokenGate } from "./token-gate.ts"
import { createSfNativeHostContribution } from "./native-host.ts"
import { createSfNativeExecution } from "./native-execution.ts"
import type { SfStoppedRun } from "./native-execution.ts"
import { createPlannerMonthlyHost } from "../../../../modules/sucafina/Sucafinav1/product/planner/monthly-host.ts"
import { createSfRunStore, sfRunSourceFence } from "../../../../modules/sucafina/Sucafinav1/product/ai/run-store.ts"
import { createSfAnalysisHost } from "../../../../modules/sucafina/Sucafinav1/product/ai/analysis-host.ts"
import { runSfAnalysis } from "../../../../modules/sucafina/Sucafinav1/product/ai/analysis-port.ts"
import { decodeSfContributionEnvelope, decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { SfSkillInputMap } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import { createSfAnalysisAuthorReader } from "./analysis-author.ts"
import { createSfDecisionCritiqueVerifier } from "./analysis-verifier-review.ts"
import { createSfIntentVerifier } from "./analysis-verifier-intent.ts"
import { createSfSourcingVerifier } from "./analysis-verifier-procurement.ts"
import { createSfScenarioVerifier } from "./analysis-verifier-scenarios.ts"
import { createSfForecastVerifier, withoutObservationTimes } from "./analysis-verifier.ts"
import type { BusinessPorts, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfNativeRunRecord } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfNativeHostApi, SfLoadedSkillObservation } from "./native-host.ts"
import type { SfNativeAdmission, SfSelectedRuntime } from "../../../../modules/sucafina/Sucafinav1/product/contracts/runtime.ts"

/** Resolves placement in the application's existing graph before it accepts HTTP. No second Session coordinator. */
export const createSfHostRuntime: CreateSfHostRuntime = async (input) => {
  if (!input.installationId.trim() || !path.isAbsolute(input.directory) || path.resolve(input.directory) !== input.directory) throw new Error("SF_HOST_PLACEMENT_INVALID")
  const directory = AbsolutePath.make(input.directory)
  const bundle = await createResidentAiBundle({ root: input.sourceRoot, manifestPath: path.join(input.sourceRoot, "manifests/resident.json") })
  const selected = bundle.profiles.map((profile) => ({ profile, manifestDigest: bundle.manifestDigest,
    skills: bundle.skills.filter((skill) => profile.allowedSkills.includes(skill.id)), operationIds: profile.allowedOperations }))
  const state: { identity?: ReturnType<SfHostRuntime["identity"]>; store?: SessionStore.Interface; api?: SfNativeHostApi;
    models?: SfHostServices["models"]; configuration?: string; generation: number } = { generation: 0 }
  const requests = new Map<string, Request>()
  const observed = new Map<string, { value: SfLoadedSkillObservation; digest: string }>()
  const proposalCoverageWrites = new WeakSet<object>()
  const identity = () => state.identity
  const selectionMatches = (value: SfSelectedRuntime) => validSfSelection(value) && selected.some((parent) =>
    parent.manifestDigest === value.manifestDigest && digestSfValue(parent.profile) === digestSfValue(value.profile) &&
    value.skills.every((skill) => parent.skills.some((allowed) => digestSfValue(allowed) === digestSfValue(skill))) &&
    value.operationIds.every((operation) => parent.operationIds.includes(operation)))
  const authority = createSfProductAuthority({ ...input, identity, proposalCoverageWrites, policyVersion: "sf-product-v1", grants: input.grants ?? [], createId: randomUUID, now: Date.now,
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
  })
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
  const imports = createSfImportServices({ runtime: input, authority })
  const documents = createSfDocumentServices({ runtime: input, authority })
  const business = createSfBusinessServices({ authority, persistence: input.persistence, proposalCoverageWrites, documentRead: documents?.documents.reader,
    extraDescriptors: [...imports?.descriptors ?? [], ...documents?.descriptors ?? []] })
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
  const analysisDependencies = { cases: business.cases, planner: business.planner, procurement: business.procurement, context: business.context, host: authority.host }
  const readAuthorAnalysis = createSfAnalysisAuthorReader({ authority, context: business.context, resolveCase: business.resolveCase })
  const verifiers = [createSfDecisionCritiqueVerifier({ ...analysisDependencies, readAuthorAnalysis }), createSfIntentVerifier({ ...analysisDependencies, replayIntent: business.cases.prepareIntentForCase }), createSfForecastVerifier(analysisDependencies), createSfSourcingVerifier({ ...analysisDependencies, sourcingEvidence: business.sourcingEvidence }), createSfScenarioVerifier({ ...analysisDependencies,
    scenarioRef: async (caseRef, alternative, call) => {
      const result = await business.scenarioLookup({ caseRef, alternativeId: alternative.id, alternativeVersion: alternative.version }, call)
      return result.status === "ok" ? { status: "ok", value: result.value.resultRef } : result
    } })]
  const analyses: NonNullable<SfHostServices["analyses"]> = {
    start: async (context, incoming) => {
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
      if (claim.status !== "ok") return claim.status === "preview" ? { status: "unavailable", reason: "analysis-state-unavailable" } : claim
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
      const critique = skill.id === "sf-contestar-decisao" ? decodeSfSkillInput("DecisionCritiqueInput", skillInput) : undefined
      if (critique && !critique.ok) return { status: "needs-input", reason: "invalid-analysis-input" }
      const author = critique?.ok ? await readAuthorAnalysis(critique.value.authorAnalysis.runRef, critique.value.authorAnalysis.outputDigest, context) : undefined
      if (critique?.ok && (!author || author.status !== "ok" || !author.value.run.native || author.value.run.runRef === runRef))
        return { status: "unavailable", reason: "author-analysis-unavailable" }
      const reviewTarget = author?.status === "ok" && author.value.run.native ? { targetRunId: author.value.run.runRef, targetSessionId: author.value.run.native.sessionID,
        targetOutputDigest: author.value.output.outputDigest, caseRef: author.value.run.caseRef } : undefined
      const chosen = { profile: parent.profile, manifestDigest: parent.manifestDigest, skills: [skill], operationIds: [...captured.request.requestedOperationScope] }
      if (!selectionMatches(chosen)) return { status: "denied", reason: "analysis-selection-unavailable" }
      const actualModel = model.value
      const existing = async (): Promise<PortResult<{ runRef: string }> | undefined> => {
        const found = await authority.state.read(request, "contributions", (stored, actor) => {
          const run = stored.nativeRuns?.[runRef]
          return run && run.principalRef === actor.principalRef && run.accessRevision === actor.accessRevision && run.policyVersion === actor.policyVersion ? run : undefined
        })
        if (found.status !== "ok") return found.status === "preview" ? { status: "unavailable", reason: "analysis-state-unavailable" } : found
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
        try { return await business.withCase(admitted.value, baseRequest.caseRef, {}, () => action(admitted.value)) } finally { authority.human.finish(admitted.value) }
      }
      const verify = async (call: TrustedDomainContext) => {
        const result = await verifier.verify(verifiedInput, baseRequest, call)
        if (result.status !== "ok" || digestSfValue(result.value.input) !== digestSfValue(verifiedInput) ||
          result.value.current.id !== baseRequest.caseRef.id || result.value.current.incarnation !== baseRequest.caseRef.incarnation ||
          result.value.current.version !== baseRequest.caseRef.version || result.value.sources.some((item) => item.state !== "fresh" ||
            !item.authorizedProjection || !item.currentRef || digestSfValue(item.currentRef) !== digestSfValue(item.ref)) ||
          !await authority.host.revalidate(call)) return undefined
        return result.value
      }
      const sourceProjection = (proof: NonNullable<Awaited<ReturnType<typeof verify>>>) => proof.sources.map((item) => ({ ref: item.ref, projection: item.authorizedProjection }))
      const first = await verify(context)
      if (!first) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const fingerprint = digestSfValue(withoutObservationTimes({ case: first.current, skillInput: verifiedInput, selected: selectedRuntime, reviewTarget,
        accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, sources: sourceProjection(first) }))
      const fullRequest = { ...baseRequest, contextFingerprint: fingerprint }
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
        if (found.status !== "ok") return found.status === "preview" ? { status: "unavailable", reason: "analysis-state-unavailable" } : found
        return found.value && await authority.host.revalidate(call) ? { status: "ok", value: found.value } : { status: "denied", reason: "analysis-authority-unavailable" }
      }
      const store = createSfRunStore({ state: authority.state, requestFor: authority.host.requestFor, revalidate: authority.host.revalidate,
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
        revalidateForCommit: async (record, call, snapshot, output) => {
          if (record.state === "cancelled") return fences.current && sfRunSourceFence(snapshot) === fences.current.dashboard && await authority.host.revalidate(call)
            ? { status: "ok", value: true } : { status: "denied", reason: "analysis-cancellation-unavailable" }
          const current = input.persistence.currentSnapshots?.()
          if (!current || !fences.current || !await authority.host.revalidate(call)) return { status: "unavailable", reason: "analysis-source-fence-unavailable" }
          const actual = { dashboard: sfRunSourceFence(snapshot), planner: sfRunSourceFence(current.planner), procurement: sfRunSourceFence(current.procurement) }
          if (digestSfValue(actual) !== digestSfValue(fences.current) || record.contextFingerprint !== fingerprint) return { status: "stale", reason: "analysis-source-changed" }
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
            const at = new Date().toISOString()
            const record: SfNativeRunRecord = { schema: "sf-native-run-v1", runRef, version: 1, intentDigest, requestDigest: digestSfValue(fullRequest), skillInputDigest: digestSfValue(verifiedInput),
              principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion, caseRef: baseRequest.caseRef,
              selection: selectedRuntime, model: actualModel, skillId: skill.id, objective: baseRequest.objective, contextFingerprint: fingerprint, createdAt: at, updatedAt: at, state: "preparing", ...(reviewTarget ? { reviewTarget } : {}) }
            const location = identity()?.location
            if (!location) return { status: "unavailable", reason: "analysis-host-unavailable" }
            requests.set(runRef, request)
            return { status: "ok", value: { record, native: { request, selected: selectedRuntime, location, model: actualModel, skillId: skill.id,
              prompt: JSON.stringify({ objective: baseRequest.objective, skillInput: verifiedInput, output: "Return one JSON object with kind, payload, and evidenceRefs." }),
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
      const routines: BusinessPorts["routines"] = { catalog: unavailable, prepareAdmission: unavailable, readAdmission: unavailable, readRun: unavailable, run: unavailable }
      const analysisHost = createSfAnalysisHost({ store, execution, analysis, routines, withRunContext,
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
        if (result.status !== "ok") announcement.resolve(await existing() ?? result)
        else announcement.resolve({ status: "unavailable", reason: "analysis-admission-missing" })
      }).catch(async () => {
        await withRunContext(runRef, (call) => analysisHost.settle(runRef, "unavailable", "analysis-outcome-unknown", call)).catch(() => undefined)
        announcement.resolve({ status: "unavailable", reason: "analysis-outcome-unknown" })
      }).finally(async () => {
        const marker = await execution.releaseRun(runRef).catch(() => undefined)
        executions.delete(runRef)
        requests.delete(runRef)
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
        .map((run) => ({ runRef: run.runRef, state: run.state, version: run.version, ...(run.outputRef ? { outputRef: run.outputRef } : {}) })))
      if (found.status !== "ok") return found.status === "preview" ? { status: "unavailable", reason: "analysis-state-unavailable" } : found
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
      if (found.status !== "ok") return found.status === "preview" ? { status: "unavailable", reason: "analysis-state-unavailable" } : found
      return found.value && await authority.human.authorize(context, "analysis.read", { runRef }) ? { status: "ok", value: found.value } : { status: "denied", reason: "analysis-authority-unavailable" }
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
    descriptors, onRegistered: native.onRegistered })
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
      if (descriptors.length + business.remainingOperations().length !== contractFreeze.operations.length) throw new Error("SF_OPERATION_REGISTRY_INVALID")
      const project = yield* projects.resolve(directory)
      const identity = Object.freeze({ installationId: input.installationId, hostId: randomUUID(), projectId: project.id,
        location: Object.freeze({ directory }) })
      state.identity = identity
      state.store = store
      state.models = async () => {
        const data = await Effect.runPromise(Effect.gen(function* () {
          const catalog = yield* Catalog.Service
          const mcp = yield* Mcp.Service
          return { models: yield* catalog.model.available(), servers: yield* mcp.list() }
        }).pipe(Effect.provide(locations.get(identity.location)))).catch(() => undefined)
        if (!data || state.identity !== identity) throw new Error("SF_CATALOG_UNAVAILABLE")
        // Public metadata only; credentials, provider headers and endpoint configuration remain opaque.
        const digest = digestSfValue({ models: data.models.map((model) => ({ providerID: model.providerID, id: model.id,
          api: { id: model.api.id, type: model.api.type }, variants: model.variants.map((variant) => variant.id).toSorted(), limit: model.limit }))
          .toSorted((left, right) => `${left.providerID}:${left.id}`.localeCompare(`${right.providerID}:${right.id}`)),
          servers: data.servers.toSorted((left, right) => left.name.localeCompare(right.name)) })
        if (state.configuration !== digest) { state.configuration = digest; state.generation += 1 }
        return data.models.map((model) => ({ providerID: model.providerID, id: model.id }))
      }
      yield* Effect.addFinalizer(() => Effect.gen(function* () {
        if (state.identity !== identity) return
        yield* Effect.promise(() => Promise.allSettled([...executions.values()].map((execution) => execution.shutdown())))
        executions.clear()
        stopped.forEach((entry) => clearTimeout(entry.timer)); stopped.clear()
        state.identity = undefined; state.store = undefined; state.models = undefined; requests.clear(); observed.clear(); business.dispose(); documents?.dispose()
      }))
    })),
  })
  const personalViews = createSfPersonalViews({ host: authority.host, state: authority.state, creationTarget: authority.creationTarget,
    operationIdentity: authority.ui.operationIdentity, humanAuthorize: (call, action, payload) => authority.human.authorize(call, action, payload),
    authorizeView: async (view, call) => {
      if (Object.keys(view.filters?.selections ?? {}).some((key) => !["year", "own", "execYear", "opsYear", "secYear", "month", "executiveMonth", "operationsMonth", "securityMonth", "opsMonth"].includes(key))) return false
      const request = authority.host.requestFor(call)
      if (!request || !await authority.host.revalidate(call)) return false
      const allowed = await input.persistence.transaction(view.surface, async (snapshot) => {
        const principal = await authority.host.authenticate(request, { surface: view.surface, roleMap: roleMap(snapshot, view.surface) })
        if (!principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: false }
        const access = object(object(snapshot.data.access)[principal.id])
        const roles = principal.roles.filter((role) => role.surface === view.surface).map((role) => role.role)
        const actor = { id: principal.id, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), roles,
          assigned: Array.isArray(access.assigned) ? access.assigned.filter((entry): entry is string => typeof entry === "string") : [],
          domains: Array.isArray(access.domains) ? access.domains.filter((entry): entry is string => typeof entry === "string") : [] }
        const summaries = Array.isArray(snapshot.data.summaries) ? snapshot.data.summaries.filter((entry): entry is string => typeof entry === "string") : []
        const pages = view.surface === "dashboard" ? dashboardPages(actor, summaries) : view.surface === "planner" ? plannerKeys(actor) : procurementKeys(actor)
        return { commit: false, value: pages.includes(view.page) }
      }, { signal: request.signal })
      return allowed && await authority.host.revalidate(call)
    } })
  const services: SfHostServices = { ...authority, ...{ procurementSelections: business.procurementSelections, forecastInputs: business.forecastInputs, analyses, plannerMonthly, personalViews, documents: documents?.documents, productHttp: async (request, surface) => await documentHttp(request, surface) ?? await importHttp(request, surface) }, selected, dispatch: createSfProductDispatch({ descriptors, authority: authority.authority }), models: async () => state.models ? state.models() : [], sessions: {
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
    contributions: [{ id: "sucafina-host-context", nodes: [node] }, gate.contribution, native.contribution, product] }
}

function admissionDigest(admission: SfNativeAdmission) {
  return digestSfValue({ ...admission, request: undefined })
}
