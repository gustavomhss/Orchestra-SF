import { randomUUID } from "node:crypto"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object, rows } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Actor, Environment, Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { PreparedCommand } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { DecisionCase, PreparedChange } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { ScenarioOperation } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { DecisionCasePort, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfProductState, SfStateAuthority } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import { createHotTopicDraftStore, verifyHotTopicDraftBinding } from "../../../../modules/sucafina/Sucafinav1/product/decisions/hot-topic-draft.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { HotTopicDraft, HotTopicDraftRequest } from "../../../../modules/sucafina/Sucafinav1/product/decisions/hot-topic-draft.ts"
import { prepareDomainChange } from "../../../../modules/sucafina/Sucafinav1/product/decisions/prepared-change.ts"
import { createDecisionPreparedReview } from "../../../../modules/sucafina/Sucafinav1/product/decisions/prepared-review.ts"
import { createSfPreparedApply } from "../../../../modules/sucafina/Sucafinav1/product/decisions/prepared-apply.ts"
import { createPreparedExecution } from "../../../../modules/sucafina/Sucafinav1/product/decisions/apply.ts"
import { sameApplyRequest } from "../../../../modules/sucafina/Sucafinav1/product/decisions/receipt-review-binding.ts"
import type { AdmittedApply, PreparedApplyRequest, ReviewDigestFor } from "../../../../modules/sucafina/Sucafinav1/product/decisions/receipt-review-binding.ts"
import { prepareHotTopicDraft, resolveHotTopicDraftOperation, hotTopicReceiptVersion } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/hot-topic-draft.ts"
import { createDashboardPreparedMutation } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/prepared.ts"
import { createDashboardPreparedReview } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/prepared-review.ts"
import type { DashboardMutationScope } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/mutation-scope.ts"
import type { createDashboardConfirmationIssuer } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/confirmation-issuer.ts"
import type { createDashboardRecordEvidenceHost } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/sources.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { projectSfSourceScope } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts"
import { dashboardSourceCurrent } from "./dashboard-services.ts"
import { createSfDashboardDecisionEvidence } from "./dashboard-decision-evidence.ts"
import type { DashboardSourceCapture } from "./dashboard-decision-evidence.ts"

type CaseRef = { id: string; incarnation: string; version: number }
export type DashboardPrepareRequest = { caseRef: CaseRef; choiceId: string; draftRef: string }
export type DashboardPreparedBinding = {
  schema: "sf-dashboard-prepared-binding-v1"
  caseRef: CaseRef
  choiceId: string
  choiceDigest: string
  changeId: string
  command: PreparedCommand
  draft: HotTopicDraft
  operation: ScenarioOperation
  mutationScope: DashboardMutationScope
  baseDigest: string
  previewDigest: string
  principalRef: string
  accessRevision: string
  policyVersion: string
  /** Actual producer reads taken before prepare; legacy bindings have no archive. */
  sourceCaptures?: readonly DashboardSourceCapture[]
  recordDigest: string
}

/** C12 consumes durable WP11 drafts and choices; executable material stays in protected host state. */
export function createSfDashboardDecisions(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  cases: DecisionCasePort
  records: ReturnType<typeof createDashboardRecordEvidenceHost>
  issue: ReturnType<typeof createDashboardConfirmationIssuer>
  proposalCoverageWrites: WeakSet<object>
  dashboardHostWrites: WeakSet<object>
}) {
  const { state, host, human, ui } = input.authority
  const evidence = createSfDashboardDecisionEvidence({ authority: input.authority, records: input.records, isBinding, bindingDigest })
  const environments = new WeakMap<TrustedDomainContext, Environment>()
  const preferenceReads = new WeakSet<TrustedDomainContext>()
  const admitted = new WeakMap<TrustedDomainContext, { request: AdmittedApply; actor: Actor; environment: Environment; roles: string; access: string }>()
  const authorizeCase = async (value: DecisionCase, context: TrustedDomainContext) => value.participants.includes(context.binding.principalRef) && await host.revalidate(context)
  const actorFor = async (snapshot: Snapshot, context: TrustedDomainContext) => {
    const request = host.requestFor(context)
    if (!request) return undefined
    const principal = await host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
    if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return undefined
    const roles = principal.roles.filter((entry) => entry.surface === "dashboard").map((entry) => entry.role)
    const access = object(object(snapshot.data.access)[principal.id])
    return { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
      assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [],
      domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
  }
  const verifySources = async (draft: HotTopicDraft, context: TrustedDomainContext) => {
    const resolved = await Promise.all(draft.sourceRefs.map(async (ref) => ref.kind === "record" && ref.target.surface === "dashboard" ? input.records.resolve(ref.refId, context) : undefined))
    return resolved.length > 0 && resolved.every((result, index) => result?.status === "ok" && digestSfValue(result.value) === digestSfValue(draft.sourceRefs[index])) && await host.revalidate(context)
  }
  const drafts = createHotTopicDraftStore({ state, host, authorizeCase,
    authorizeDraft: (request, context) => human.authorize(context, "decisions.edit", request),
    verifySources,
    verifySnapshot: (snapshot, _request, draft, context) => {
      const environment = environments.get(context)
      return !!host.persistence.currentSnapshots?.() && !!environment && dashboardSourceCurrent(snapshot, draft.target, context, environment.at) &&
        draft.sourceRefs.every((ref) => ref.kind === "record" && ref.target.surface === "dashboard" && !!ref.target.period && dashboardSourceCurrent(snapshot,
          { surface: "dashboard", type: ref.target.recordType, id: ref.target.recordId, incarnation: ref.target.incarnation, version: ref.target.version, fields: ref.target.fields, period: ref.target.period, observedAt: environment.at }, context, environment.at))
    },
    operationIdentity: (context) => context.kind === "ui" ? ui.operationIdentity(context) : undefined,
    proposalCoverageWrites: input.proposalCoverageWrites, createId: randomUUID, now: () => new Date().toISOString() })
  const load = async (ref: CaseRef, context: TrustedDomainContext) => {
    const request = host.requestFor(context)
    if (!request || !await host.revalidate(context)) return undefined
    const current = await state.read(request, "cases", (stored, authority) => sameAuthority(authority, context) ? stored.cases[ref.id] : undefined)
    const protectedState = await state.read(request, "preferences", (stored, authority) => sameAuthority(authority, context) ? structuredClone(stored) : undefined)
    if (current.status !== "ok" || !current.value || protectedState.status !== "ok" || !protectedState.value || current.value.incarnation !== ref.incarnation ||
      current.value.version !== ref.version || !await authorizeCase(current.value, context) || digestSfValue(protectedState.value.cases[ref.id]) !== digestSfValue(current.value)) return undefined
    preferenceReads.add(context)
    return { case: current.value, state: protectedState.value, casesVersion: current.storageVersion, preferencesVersion: protectedState.storageVersion }
  }
  const domainReview = createDashboardPreparedReview({ host, issueSource: input.issue,
    verifyPreparedBinding: async (snapshot, command, context) => {
      const bindings = Object.values(object(object(snapshot.data.__sfProductV1).preferences)).filter(isBinding).filter((entry) => digestSfValue(entry.command) === digestSfValue(command))
      // load() already proved both namespace grants. Current authority and the canonical protected
      // draft/choice/command are checked against the all-surface lock's snapshot here.
      return preferenceReads.has(context) && bindings.length === 1 && bindingCurrent(snapshot, bindings[0]!, context) && await host.revalidate(context)
    } })
  const reviewChange = createDecisionPreparedReview({ state, cases: input.cases, host, reviewDomain: domainReview })
  const review = async (request: PreparedApplyRequest, context: TrustedDomainContext) => {
    const current = await load(request.caseRef, context)
    if (!current) return { status: "unavailable" as const, reason: "dashboard-prepared-case-unavailable" }
    const changes = current.case.preparedChanges.filter((change) => change.id === request.changeId && change.choiceId === request.choiceId)
    const binding = current.state.preferences[preparedKey(request.changeId)]
    if (changes.length !== 1 || !isBinding(binding) || binding.choiceId !== request.choiceId || digestSfValue(changes[0]!.operation) !== digestSfValue(binding.command)) return { status: "unavailable" as const, reason: "dashboard-prepared-change-unavailable" }
    return reviewChange(request, context)
  }
  const reviewDigestFor: ReviewDigestFor = (context, request, change) => {
    const allowed = admitted.get(context)
    return allowed && sameApplyRequest(allowed.request, request) && change.id === request.changeId && change.choiceId === request.choiceId ? allowed.request.reviewDigest : undefined
  }
  const authorizeApplication = async (request: PreparedApplyRequest, change: PreparedChange, context: TrustedDomainContext) => {
    const value = admitted.get(context)
    return !!value && sameApplyRequest(value.request, request) && change.id === request.changeId && change.choiceId === request.choiceId &&
      await human.authorize(context, "decisions.apply", value.request) && await host.revalidate(context)
  }
  const lookup = async (request: { targetRef: string; targetIncarnation: string; idempotencyKey: string; commandDigest: string }, context: TrustedDomainContext) => {
    const allowed = admitted.get(context)
    const source = host.requestFor(context)
    if (!source || !allowed || !await human.authorize(context, "decisions.apply", allowed.request)) return false
    const found = await state.read(source, "cases", (stored, authority) => {
      const current = stored.cases[allowed.request.caseRef.id]
      const changes = current?.preparedChanges.filter((change) => change.id === allowed.request.changeId && change.choiceId === allowed.request.choiceId) ?? []
      return sameAuthority(authority, context) && !!current && current.incarnation === allowed.request.caseRef.incarnation && current.participants.includes(authority.principalRef) && changes.length === 1 &&
        changes[0]!.target.surface === "dashboard" && changes[0]!.target.id === request.targetRef && changes[0]!.target.incarnation === request.targetIncarnation &&
        changes[0]!.idempotencyKey === request.idempotencyKey && changes[0]!.operation.commandDigest === request.commandDigest
    })
    return found.status === "ok" && found.value && await host.revalidate(context)
  }
  const verifyGrant = (snapshot: Snapshot, request: PreparedApplyRequest, change: PreparedChange, actor: Actor, context: TrustedDomainContext) => {
    const allowed = admitted.get(context)
    const binding = object(object(snapshot.data.__sfProductV1).preferences)[preparedKey(change.id)]
    return !!allowed && sameApplyRequest(allowed.request, request) && allowed.actor.id === actor.id && actor.canWrite && actor.roles.some((role) => role === "admin" || role === "domain leader") &&
      allowed.roles === digestSfValue(roleMap(snapshot, "dashboard")) && allowed.access === digestSfValue(object(snapshot.data.access)[actor.id]) &&
      isBinding(binding) && bindingCurrent(snapshot, binding, context) && digestSfValue(binding.command) === digestSfValue(change.operation)
  }
  const applyPort = createSfPreparedApply({ state, host, authorizeCase, authorizeLookup: lookup,
    authorizeReceipt: async (receipt, request, context) => receipt.principalRef === context.binding.principalRef && receipt.surface === "dashboard" && await lookup(request, context),
    confirmHuman: authorizeApplication,
    resolveActor: (_snapshot, context) => admitted.get(context)?.actor,
    resolveMutation: (snapshot, change, actor, context) => {
      const binding = object(object(snapshot.data.__sfProductV1).preferences)[preparedKey(change.id)]
      const allowed = admitted.get(context)
      if (!allowed || !isBinding(binding) || !bindingCurrent(snapshot, binding, context) || digestSfValue(binding.command) !== digestSfValue(change.operation)) return undefined
      const mutation = createDashboardPreparedMutation({ actorId: actor.id, target: binding.command.target, command: binding.command.command,
        baseDigest: binding.baseDigest, previewDigest: binding.previewDigest, idempotencyKey: binding.command.idempotencyKey, mutationScope: binding.mutationScope,
        projectScope: (current, _actor, scope) => projectSfSourceScope("dashboard", current, scope, allowed.environment.at) })
      return mutation ? { ...mutation, execute: (current: Snapshot, currentActor: Actor, environment: Environment) => bindingCurrent(current, binding, context) ? mutation.execute(current, currentActor, environment) :
        { commit: false, value: { status: "conflict", reason: "hot-topic-choice-binding-changed" } } } : undefined
    },
    verifyGrant,
    receiptVersion: (snapshot, change, actor) => hotTopicReceiptVersion(snapshot, actor, change.target),
    environment: (context) => admitted.get(context)!.environment,
    createId: randomUUID, now: () => new Date().toISOString(), reviewDigestFor })
  const execute = createPreparedExecution({ state, host, apply: applyPort, authorizeCase, authorizeApplication,
    confirmApplication: async (request, context) => {
      const value = admitted.get(context)
      return !!value && sameApplyRequest(value.request, request) && await human.authorize(context, "decisions.apply", value.request)
    },
    operationIdentity: (context) => context.kind === "ui" ? ui.operationIdentity(context) : undefined,
    reviewDigestFor, revalidateProducer: async (request, context) => {
      const result = await review(request, context)
      return result.status === "ok" ? { status: "ok", value: { reviewDigest: result.value.reviewDigest } } : result
    },
    classifyReceipt: async (receipt, change, context) => {
      if (!await lookup({ targetRef: change.target.id, targetIncarnation: change.target.incarnation, idempotencyKey: change.idempotencyKey, commandDigest: change.operation.commandDigest }, context)) return undefined
      const initial: Extract<BusinessEvidenceRef, { kind: "receipt" }> = { schema: "sf-evidence-v1", kind: "receipt", refId: `receipt:${receipt.id}`,
        installationId: context.binding.installationId, projectId: context.binding.projectId, evidenceLevel: "observed", refDigest: "",
        target: { surface: receipt.surface, receiptId: receipt.id, idempotencyKey: receipt.idempotencyKey, targetIncarnation: receipt.targetIncarnation, commandDigest: receipt.commandDigest, version: receipt.version } }
      return { state: receipt.result.ok ? "applied" : receipt.result.status === 409 ? "conflict" : "failed", evidence: { ...initial, refDigest: digestSfEvidenceRef(initial) } }
    } })
  return {
    resolveEvidence: evidence.resolveEvidence,
    proveContinuity: evidence.proveContinuity,
    discover: async (context: TrustedDomainContext) => {
      const request = host.requestFor(context)
      if (!request || !await host.revalidate(context)) return { status: "denied" as const, reason: "decision-discovery-unavailable" }
      const current = await state.read(request, "cases", (stored, authority) => sameAuthority(authority, context) ? Object.values(stored.cases)
        .filter((decision) => decision.participants.includes(authority.principalRef)).sort((a, b) => a.objective.localeCompare(b.objective)).slice(0, 50) : [])
      const protectedState = await state.read(request, "preferences", (stored, authority) => sameAuthority(authority, context) ? stored.preferences : undefined)
      const receipts = await state.read(request, "receipts", (_stored, authority) => sameAuthority(authority, context))
      const cases: { caseRef: CaseRef; label: string }[] = []
      const emittedCases = new Map<string, DecisionCase>()
      const emittedPreferences = new Map<string, string>()
      const draftOptions: { id: string; incarnation: string; caseRef: CaseRef; draftRef: string; version: number; label: string; target: HotTopicDraft["target"]; targetEvidence: HotTopicDraft["targetEvidence"]; fields: HotTopicDraft["fields"]; sourceRefs: HotTopicDraft["sourceRefs"] }[] = []
      const preparations: { caseRef: CaseRef; choiceId: string; draftRef: string; label: string; reason: string }[] = []
      const changes: { caseRef: CaseRef; choiceId: string; changeId: string; label: string; state: PreparedChange["state"] }[] = []
      if (current.status === "ok") for (const decision of current.value) {
        const selected = await input.cases.read({ caseRef: encodeCaseRef(decision) }, context)
        if (selected.status !== "ok" || selected.value.case.version !== decision.version) continue
        const caseRef = { id: decision.id, incarnation: decision.incarnation, version: decision.version }
        cases.push({ caseRef, label: decision.objective })
        emittedCases.set(decision.id, decision)
        if (protectedState.status !== "ok" || !protectedState.value) continue
        const available = await drafts.list({ caseRef }, context)
        if (available.status === "ok") for (const draft of available.value) {
          const actual = await drafts.readCurrent({ caseRef, draftRef: draft.draftRef }, context)
          if (actual.status !== "ok" || actual.value.principalRef !== context.binding.principalRef) continue
          emittedPreferences.set(`sf:proposal-coverage:hot-topic:active:${digestSfValue(actual.value.id)}`, digestSfValue(actual.value))
          emittedPreferences.set(`sf:proposal-coverage:hot-topic:history:${digestSfValue(actual.value.draftRef)}`, digestSfValue(actual.value))
          draftOptions.push({ id: actual.value.id, incarnation: actual.value.incarnation, caseRef, draftRef: draft.draftRef, version: draft.version, label: draft.label, target: actual.value.target, targetEvidence: actual.value.targetEvidence, fields: actual.value.fields, sourceRefs: actual.value.sourceRefs })
          for (const choice of decision.choices) {
            const operations = choice.scenario.operations.filter((operation) => operation.kind === "replace" && operation.targetRef === actual.value.targetEvidence.refId && operation.replacementRef === draft.draftRef)
            if (operations.length !== 1 || decision.preparedChanges.some((change) => change.choiceId === choice.id && change.target.id === draft.target.id && change.state === "planned")) continue
            const title = decision.alternatives.find((alternative) => alternative.id === choice.alternativeId && alternative.version === choice.alternativeVersion)?.title
            preparations.push({ caseRef, choiceId: choice.id, draftRef: draft.draftRef, label: `${decision.objective} · ${title ?? draft.label}`, reason: choice.reason })
          }
        }
        for (const change of decision.preparedChanges) {
          const binding = protectedState.value[preparedKey(change.id)]
          const choices = decision.choices.filter((choice) => choice.id === change.choiceId)
          if (!isBinding(binding) || !sameAuthority(binding, context) || binding.recordDigest !== bindingDigest(binding) || digestSfValue(binding.command) !== digestSfValue(change.operation) ||
            binding.caseRef.id !== decision.id || binding.caseRef.incarnation !== decision.incarnation || binding.choiceId !== change.choiceId || binding.changeId !== change.id ||
            choices.length !== 1 || binding.choiceDigest !== digestSfValue(choices[0]) ||
            (change.state === "planned" && binding.caseRef.version !== decision.version)) continue
          changes.push({ caseRef, choiceId: change.choiceId, changeId: change.id, label: `${decision.objective} · ${binding.draft.fields.action}`, state: change.state })
          emittedPreferences.set(preparedKey(change.id), digestSfValue(binding))
        }
      }
      const actions = await input.authority.humanActions(request)
      if (emittedCases.size) {
        // The earlier preferences read proved that namespace's grant. One final C08 snapshot fences
        // the exact emitted cases and draft/binding records together; authority alone does not bind participants.
        const current = await state.read(request, "cases", (stored, authority) => sameAuthority(authority, context) &&
          [...emittedCases].every(([id, previous]) => {
            const actual = stored.cases[id]
            return !!actual && actual.incarnation === previous.incarnation && actual.version === previous.version &&
              actual.participants.includes(authority.principalRef) && digestSfValue(actual) === digestSfValue(previous)
          }) && (!emittedPreferences.size || protectedState.status === "ok" && [...emittedPreferences].every(([key, digest]) => digestSfValue(stored.preferences[key]) === digest)))
        if (current.status !== "ok" || !current.value) return { status: "stale" as const, reason: "decision-discovery-changed" }
      }
      if (!await host.revalidate(context)) return { status: "denied" as const, reason: "decision-discovery-unavailable" }
      return { status: "ok" as const, value: { cases, drafts: draftOptions, preparations, changes, caseLimit: 50, permissions: {
        draft: actions.includes("decisions.edit") && current.status === "ok" && protectedState.status === "ok",
        prepare: actions.includes("decisions.prepare-changes") && current.status === "ok" && protectedState.status === "ok",
        apply: actions.includes("decisions.apply") && current.status === "ok" && protectedState.status === "ok" && receipts.status === "ok" && receipts.value,
      } } }
    },
    drafts: {
      register: async (request: HotTopicDraftRequest, context: TrustedDomainContext) => {
        const source = host.requestFor(context)
        if (!source) return { status: "denied" as const, reason: "hot-topic-draft-access-unavailable" }
        environments.set(context, await host.environment(source))
        try { return await drafts.register(request, context) } finally { environments.delete(context) }
      }, readCurrent: drafts.readCurrent, list: drafts.list,
    },
    resolveOperation: async (request: { caseRef: CaseRef; draftRef: string; operation: ScenarioOperation }, context: TrustedDomainContext) => {
      // Reading an already applied choice uses its immutable C12 command/capture
      // and real receipt. New preparation still requires the live draft below.
      const recorded = await evidence.resolveRecordedOperation(request, context).catch(() => undefined)
      if (recorded) return recorded
      const current = await load(request.caseRef, context)
      const source = host.requestFor(context)
      if (!current || !source) return { status: "denied" as const, reason: "hot-topic-case-unavailable" }
      const actor = await host.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: await actorFor(snapshot, context) }))
      if (!actor) return { status: "denied" as const, reason: "hot-topic-access-unavailable" }
      return resolveHotTopicDraftOperation({ ...request, actor, context, expectedAccessRevision: context.binding.accessRevision, expectedPolicyVersion: context.binding.policyVersion,
        readCurrent: drafts.readCurrent, issueCurrentTarget: input.issue })
    },
    prepare: async (request: DashboardPrepareRequest, context: TrustedDomainContext): Promise<PortResult<{ caseRef: CaseRef; choiceId: string; changeId: string }>> => {
      if (context.kind !== "ui" || !await human.authorize(context, "decisions.prepare-changes", request)) return { status: "denied", reason: "human-preparation-required" }
      const source = host.requestFor(context)
      const operationIdentity = ui.operationIdentity(context)
      if (!source || !operationIdentity) return { status: "unavailable", reason: "hot-topic-operation-unavailable" }
      const previous = await state.read(source, "cases", (stored, authority) => {
        if (!sameAuthority(authority, context)) return undefined
        const decision = stored.cases[request.caseRef.id]
        const prior = stored.transactions[JSON.stringify([authority.principalRef, "cases", request.caseRef.id, `dashboard-prepare:${operationIdentity}`])]
        return decision && decision.incarnation === request.caseRef.incarnation && decision.participants.includes(authority.principalRef) && prior ? { prior, decision } : undefined
      })
      if (previous.status === "ok" && previous.value) {
        if (previous.value.prior.commandDigest !== digestSfValue(request)) return { status: "conflict", reason: "idempotency-content-changed" }
        const saved = object(previous.value.prior.value)
        const savedRef = object(saved.caseRef)
        if (typeof saved.changeId !== "string" || saved.choiceId !== request.choiceId || savedRef.id !== request.caseRef.id || savedRef.incarnation !== request.caseRef.incarnation || typeof savedRef.version !== "number" ||
          !previous.value.decision.preparedChanges.some((change) => change.id === saved.changeId && change.choiceId === saved.choiceId) || !await host.revalidate(context)) return { status: "unavailable", reason: "hot-topic-preparation-unavailable" }
        return { status: "ok", value: { caseRef: { id: request.caseRef.id, incarnation: request.caseRef.incarnation, version: savedRef.version }, choiceId: request.choiceId, changeId: saved.changeId } }
      }
      const current = await load(request.caseRef, context)
      if (!current) return { status: "unavailable", reason: "hot-topic-case-unavailable" }
      const choices = current.case.choices.filter((choice) => choice.id === request.choiceId)
      const draft = await drafts.readCurrent(request, context)
      if (choices.length !== 1 || draft.status !== "ok") return { status: "unavailable", reason: "hot-topic-choice-unavailable" }
      const choice = choices[0]!
      const operations = choice.scenario.operations.filter((operation) => operation.kind === "replace" && operation.replacementRef === request.draftRef && operation.targetRef === draft.value.targetEvidence.refId)
      if (operations.length !== 1) return { status: "conflict", reason: "hot-topic-choice-binding-mismatch" }
      const operation = operations[0]!
      const environment = await host.environment(source)
      const sourceCaptures = await evidence.captureSources(draft.value.sourceRefs, context)
      if (!sourceCaptures) return { status: "unavailable", reason: "hot-topic-original-capture-unavailable" }
      const captured = await host.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: { snapshot: structuredClone(snapshot), actor: await actorFor(snapshot, context) } }))
      if (!captured.actor) return { status: "denied", reason: "hot-topic-access-unavailable" }
      const prepared = await prepareHotTopicDraft({ snapshot: captured.snapshot, actor: captured.actor, environment, draft: draft.value, caseRef: request.caseRef, choice, operation, context,
        expectedAccessRevision: context.binding.accessRevision, expectedPolicyVersion: context.binding.policyVersion, issueCurrentTarget: input.issue,
        operationId: `hot-topic:${operationIdentity}`, idempotencyKey: `hot-topic:${operationIdentity}`,
        verifyDraftBinding: (snapshot, value, caseRef, selected, scenario) => digestSfValue(object(object(snapshot.data.__sfProductV1).cases)[caseRef.id]) === digestSfValue(current.case) &&
          selected.id === request.choiceId && verifyHotTopicDraftBinding(current.state, caseRef, selected.id, scenario, value) })
      if (prepared.status !== "ok") return { status: prepared.status === "denied" ? "denied" : "stale", reason: "reason" in prepared ? prepared.reason : "hot-topic-preparation-unavailable" }
      const changeId = `dashboard-change:${digestSfValue({ operationIdentity, caseId: request.caseRef.id })}`
      const change = prepareDomainChange({ case: current.case, expectedCaseVersion: request.caseRef.version, choiceId: choice.id, command: prepared.value.command, preview: choice.result, id: changeId })
      if (change.status !== "ok") return change
      const caseRef = { ...request.caseRef, version: request.caseRef.version + 1 }
      const initial: DashboardPreparedBinding = { schema: "sf-dashboard-prepared-binding-v1", caseRef, choiceId: choice.id, choiceDigest: digestSfValue(choice), changeId,
        command: prepared.value.command, draft: draft.value, operation, mutationScope: prepared.value.mutationScope, baseDigest: prepared.value.baseDigest, previewDigest: prepared.value.previewDigest,
        sourceCaptures,
        principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, recordDigest: "" }
      const binding = { ...initial, recordDigest: bindingDigest(initial) }
      const work = async (stored: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => {
        const actual = stored.cases[request.caseRef.id]
        if (!sameAuthority(authority, context) || !actual || digestSfValue(actual) !== digestSfValue(current.case) || !verifyHotTopicDraftBinding(stored, request.caseRef, choice.id, operation, draft.value) ||
          stored.preferences[preparedKey(changeId)] !== undefined || actual.preparedChanges.some((item) => item.id === changeId || item.idempotencyKey === change.change.idempotencyKey) ||
          !dashboardSourceCurrent(snapshot, draft.value.target, context, environment.at) || (snapshot.versions[`hotTopics:${draft.value.target.id}`]?.version ?? 0) !== prepared.value.command.expectedVersion ||
          !evidence.capturesCurrent(snapshot, sourceCaptures, context, environment.at) ||
          !await human.authorize(context, "decisions.prepare-changes", request)) return { commit: false, value: null }
        stored.cases[actual.id] = { ...actual, version: caseRef.version, preparedChanges: [...actual.preparedChanges, change.change] }
        stored.preferences[preparedKey(changeId)] = binding
        return { commit: true, value: { caseRef, choiceId: choice.id, changeId } }
      }
      input.dashboardHostWrites.add(work)
      const saved = await state.transaction(source, { namespace: "cases", domainSurface: "dashboard", expectedStorageVersion: current.casesVersion,
        additionalNamespaces: [{ namespace: "preferences", expectedStorageVersion: current.preferencesVersion }], targetRef: current.case.id, targetIncarnation: current.case.incarnation,
        idempotencyKey: `dashboard-prepare:${operationIdentity}`, commandDigest: digestSfValue(request) }, work).finally(() => input.dashboardHostWrites.delete(work))
      return saved.status === "ok" && saved.value ? { status: "ok", value: saved.value } : { status: saved.status === "conflict" ? "conflict" : "unavailable", reason: "hot-topic-preparation-not-persisted" }
    },
    review,
    apply: async (request: AdmittedApply, context: TrustedDomainContext) => {
      if (context.kind !== "ui" || !/^[a-f0-9]{64}$/.test(request.reviewDigest) || !await human.authorize(context, "decisions.apply", request)) return { status: "denied" as const, reason: "human-application-required" }
      const source = host.requestFor(context)
      if (!source || admitted.has(context)) return { status: "denied" as const, reason: "application-authority-unavailable" }
      const environment = await host.environment(source)
      const captured = await host.persistence.transaction("dashboard", async (snapshot) => ({ commit: false,
        value: { actor: await actorFor(snapshot, context), roles: digestSfValue(roleMap(snapshot, "dashboard")), access: digestSfValue(object(snapshot.data.access)[context.binding.principalRef]) } }))
      if (!captured.actor) return { status: "denied" as const, reason: "application-authority-unavailable" }
      admitted.set(context, { ...captured, actor: captured.actor, request: structuredClone(request), environment })
      try { return await execute({ caseRef: request.caseRef, changeId: request.changeId, choiceId: request.choiceId }, context) }
      finally { admitted.delete(context) }
    },
  }
}

function preparedKey(id: string) { return `sf:dashboard-host:prepared:${id}` }
function sameAuthority(authority: SfStateAuthority, context: TrustedDomainContext) { return authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion }
function bindingDigest(value: DashboardPreparedBinding) { return digestSfValue(Object.fromEntries(Object.entries(value).filter(([name]) => name !== "recordDigest"))) }
function isBinding(value: unknown): value is DashboardPreparedBinding {
  const stored = object(value)
  return stored.schema === "sf-dashboard-prepared-binding-v1" && typeof stored.changeId === "string" && typeof stored.choiceId === "string" && typeof stored.choiceDigest === "string" &&
    typeof stored.recordDigest === "string" && typeof object(stored.caseRef).id === "string" && typeof object(stored.caseRef).incarnation === "string" && Number.isSafeInteger(object(stored.caseRef).version) &&
    typeof object(stored.command).id === "string" && typeof object(stored.command).commandDigest === "string" && !!object(stored.command).command && !!object(stored.command).target &&
    object(stored.draft).schema === "sf-hot-topic-draft-v1" && typeof object(stored.draft).id === "string" && typeof object(stored.draft).draftRef === "string" &&
    !!stored.operation && Array.isArray(object(stored.mutationScope).targets) && typeof stored.baseDigest === "string" && typeof stored.previewDigest === "string" &&
    typeof stored.principalRef === "string" && typeof stored.accessRevision === "string" && typeof stored.policyVersion === "string"
}
function bindingCurrent(snapshot: Snapshot, binding: DashboardPreparedBinding, context: TrustedDomainContext) {
  if (!sameAuthority(binding, context) || binding.recordDigest !== bindingDigest(binding)) return false
  const stored = object(snapshot.data.__sfProductV1)
  const current = object(object(stored.cases)[binding.caseRef.id])
  const choices = rows(current.choices).filter((choice) => choice.id === binding.choiceId)
  const changes = rows(current.preparedChanges).filter((change) => change.id === binding.changeId && change.choiceId === binding.choiceId)
  if (current.id !== binding.caseRef.id || current.incarnation !== binding.caseRef.incarnation || current.version !== binding.caseRef.version || !Array.isArray(current.participants) || !current.participants.includes(context.binding.principalRef) ||
    choices.length !== 1 || digestSfValue(choices[0]) !== binding.choiceDigest || changes.length !== 1 || digestSfValue(changes[0]!.operation) !== digestSfValue(binding.command)) return false
  const preferences = object(stored.preferences)
  const active = preferences[`sf:proposal-coverage:hot-topic:active:${digestSfValue(binding.draft.id)}`]
  const historical = preferences[`sf:proposal-coverage:hot-topic:history:${digestSfValue(binding.draft.draftRef)}`]
  return binding.draft.caseScopeDigest === digestSfValue({ id: current.id, incarnation: current.incarnation, horizon: current.horizon, currency: current.currency, criteria: current.criteria }) &&
    digestSfValue(active) === digestSfValue(binding.draft) && digestSfValue(historical) === digestSfValue(binding.draft) &&
    digestSfValue(preferences[preparedKey(binding.changeId)]) === digestSfValue(binding)
}
