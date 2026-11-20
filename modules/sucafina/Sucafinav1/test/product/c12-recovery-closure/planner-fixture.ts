import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Actor, Snapshot } from "../../../runtime/contract.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { PreparedCommand } from "../../../product/contracts/context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageAssessment, CostCoverageBasis, DecisionCase } from "../../../product/contracts/decisions.ts"
import type { ScenarioOperation, ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { DomainPortHost, PlannerSourceHost, PreparedApplyPort } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import type { SfProductState, SfStateAuthority } from "../../../product/contracts/state.ts"
import { createPreparedExecution } from "../../../product/decisions/apply.ts"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { createDecisionCoverageAccess, decisionCoverageRef } from "../../../product/decisions/coverage-access.ts"
import { createDecisionMutations } from "../../../product/decisions/mutations.ts"
import { createSfPreparedApply } from "../../../product/decisions/prepared-apply.ts"
import { createDecisionPreparedReview } from "../../../product/decisions/prepared-review.ts"
import type { AdmittedApply, PreparedApplyRequest } from "../../../product/decisions/receipt-review-binding.ts"
import { createDecisionReviewAdmission } from "../../../product/decisions/review-admission.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import type { SfHumanAction } from "../../../product/integration/human-authority.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourcePersistence, sfScopedSourceIdentity } from "../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector, sfPlannerProjectionSelector } from "../../../product/integration/source-projections.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createPlannerOperationVerifier } from "../../../product/planner/operation-verifier.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { plannerPreparedRevision, preparePlannerMutation } from "../../../product/planner/prepared.ts"
import { createPlannerPreparedReview } from "../../../product/planner/prepared-review.ts"
import { createPlannerProduct } from "../../../product/planner/product.ts"
import { createStoredPlannerScenarioHost } from "../../../product/planner/stored-scenarios.ts"
import { plannerAt, plannerPeriod, plannerSnapshot } from "../wp03/planner-fixture.ts"

type CaseRef = PreparedApplyRequest["caseRef"]
type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
const origin = "https://c12-recovery.test"
const january = { start: "2027-01-01", end: "2027-01-31" }
const creationTarget = { ref: "c12-case-create", incarnation: "c12-case-create-v1" }
const selectedOperation: ScenarioOperation = { kind: "replace", targetRef: "line:1", amount: 42, currency: "USD", period: january }

/** Real private C08/SQLite and Planner. Test identities/one-field routing are explicit;
 * no installed HTTP, native session, financial approval or process restart is claimed. */
export async function openPlannerRecoveryFixture(retained?: { directory: string; caseRef: CaseRef }) {
  const directory = retained?.directory ?? await mkdtemp(join(await realpath(tmpdir()), "sf-c12-planner-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  if (!retained) {
    const initial = plannerSnapshot()
    initial.data.versions = ["v0", "v1"].map((id) => ({ id, name: id, year: 2027, closed: 0, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(100) }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
    await store.transaction("planner", async (snapshot) => { Object.assign(snapshot, initial); return { commit: true, value: undefined } })
  }
  const access = { allowed: true, revision: "1", policy: "1", sourceAllowed: true, now: Date.parse(plannerAt) }
  const counters = { dispatch: 0, domainExecutions: 0, receiptCommits: 0, reservationCommits: 0, intentCommits: 0, caseReconciliations: 0 }
  const faults: Partial<Record<"afterReceiptCommit" | "afterReservationCommit" | "afterIntentCommit" | "afterCaseReconcile", () => void | Promise<void>>> = {}
  const trigger = async (name: keyof typeof faults) => { const work = faults[name]; delete faults[name]; await work?.() }
  const lifecycle = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => plannerAt), createId: randomUUID })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await lifecycle.initializeSources(surface)
  const linked = (snapshot: Snapshot) => Object.values(object(object(snapshot.data.__sfProductV1).cases)).reduce<number>((count, value) => { const receipts = object(value).receipts; return count + (Array.isArray(receipts) ? receipts.length : 0) }, 0)
  const committed = async (before: { receipts: number; linked: number }, snapshot: Snapshot, value: unknown) => {
    if (Object.keys(object(object(snapshot.data.__sfProductV1).receipts)).length > before.receipts) { counters.receiptCommits++; await trigger("afterReceiptCommit") }
    if (linked(snapshot) > before.linked) { counters.caseReconciliations++; await trigger("afterCaseReconcile") }
    const schema = object(object(value).value).schema
    if (schema === "sf-c12-application-intent-v1" || schema === "sf-decision-application-attempt-v1") { counters.reservationCommits++; await trigger("afterReservationCommit") }
    if (schema === "sf-prepared-original-intent-v1") { counters.intentCommits++; await trigger("afterIntentCommit") }
  }
  const persistence: typeof lifecycle = { ...lifecycle,
    transaction: async (surface, work, options) => {
      const captured: { snapshot?: Snapshot; before?: { receipts: number; linked: number } } = {}
      const result = await lifecycle.transaction(surface, async (snapshot, blobs) => {
        const before = { receipts: Object.keys(object(object(snapshot.data.__sfProductV1).receipts)).length, linked: linked(snapshot) }
        const outcome = await work(snapshot, blobs)
        if (surface === "dashboard" && outcome.commit) { captured.snapshot = structuredClone(snapshot); captured.before = before }
        return outcome
      }, options)
      if (captured.snapshot && captured.before) await committed(captured.before, captured.snapshot, result)
      return result
    },
    transactionAll: async (work, options) => {
      if (!lifecycle.transactionAll) throw new Error("C12 requires real SQLite transactionAll")
      const captured: { snapshot?: Snapshot; before?: { receipts: number; linked: number } } = {}
      const result = await lifecycle.transactionAll(async (snapshots) => {
        const before = { receipts: Object.keys(object(object(snapshots.dashboard.data.__sfProductV1).receipts)).length, linked: linked(snapshots.dashboard) }
        const outcome = await work(snapshots)
        if (outcome.commit) { captured.snapshot = structuredClone(snapshots.dashboard); captured.before = before }
        return outcome
      }, options)
      if (captured.snapshot && captured.before) await committed(captured.before, captured.snapshot, result)
      return result
    },
  }
  const intents = new WeakMap<Request, { operation: string; digest: string; key: string }>()
  const payloads = new WeakMap<TrustedUiContext, { action: SfHumanAction; payload: unknown }>()
  const contexts: TrustedUiContext[] = []
  const authorize = async (request: Request) => access.allowed && intents.has(request) && ["finance", "other"].includes(request.headers.get("authorization") ?? "")
    ? { installationId: "i", projectId: "p", principalRef: request.headers.get("authorization")!, accessRevision: access.revision, policyVersion: access.policy } : undefined
  const actions: SfHumanAction[] = ["decisions.portfolio.read", "decisions.choose", "decisions.prepare-changes", "decisions.apply", "decisions.edit"]
  const ui = createSfUiAuthority({ authorize, privateCommands: actions.map((action) => `sf-human:${action}`), createId: randomUUID, now: () => access.now,
    commandIdentity: async (request, operation, digest) => { const intent = intents.get(request); return intent?.operation === operation && intent.digest === digest ? digestSfValue({ operation, key: intent.key }) : undefined } })
  const human = createSfHumanAuthority({ origin, ui })
  const requestFor = (operation: string, payload: unknown, key: string, principal: string) => {
    const request = new Request(`${origin}/decisions`, { method: "POST", headers: { authorization: principal, origin, "content-type": "application/json" }, body: JSON.stringify(payload) })
    intents.set(request, { operation, digest: digestSfValue(payload), key }); return request
  }
  const admit = async (action: SfHumanAction, payload: unknown, key: string = randomUUID(), principal = "finance") => {
    const value = await human.admit(requestFor(`sf-human:${action}`, payload, key, principal), action, payload)
    if (value.status !== "ok") throw new Error(`Human admission: ${value.reason}`)
    contexts.push(value.value); payloads.set(value.value, { action, payload: structuredClone(payload) }); return value.value
  }
  const admitOperation = async (operation: string, payload: unknown, key: string = randomUUID(), principal = "finance") => {
    const value = await ui.admit(requestFor(operation, payload, key, principal), operation, digestSfValue(payload))
    if (value.status !== "ok" || !await ui.validate(value.value, operation, digestSfValue(payload))) throw new Error("UI admission unavailable")
    contexts.push(value.value); return value.value
  }
  const host: DomainPortHost = { persistence,
    authenticate: async (request, context) => { const identity = await authorize(request); return identity && access.sourceAllowed ? resolve(identity.principalRef, [...context!.roleMap], (group) => group === "finance-group") : null },
    environment: async () => ({ at: plannerAt, id: randomUUID, directory: [] }), requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined,
    revalidate: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false),
  }
  const identity = (context: TrustedDomainContext): Actor => ({ id: context.binding.principalRef, roles: ["finance"], canWrite: true, assigned: [], domains: [] })
  const scopeFor = (snapshot: Snapshot, context: TrustedDomainContext) => ({ principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, recordType: "planner-version", recordId: "v1", selector: sfPlannerProjectionSelector(snapshot, identity(context)) })
  const currentCase: { ref?: CaseRef } = { ref: retained?.caseRef }
  const issuedRefs: RecordEvidence[] = []
  const coverage = new Map<string, CostCoverageAssessment>()
  const basis: CostCoverageBasis = { id: "c12-coverage", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: issuedRefs }
  let resolveForecastSource: PlannerSourceHost["resolveForecastSource"] | undefined
  const domainPlanner = createPlannerProduct({ host, scopedSources: persistence, coverageFor: async (reference, context) => {
    const assessment = coverage.get(reference)
    const source = await resolveForecastSource?.(reference, context)
    return assessment && source?.status === "ok" && assessment.evaluatedSourceRefs.some((ref) => digestSfValue(ref) === digestSfValue(source.value.evidence))
      ? { status: "ok", value: { coverageRef: reference, basis, assessment } } : { status: "unavailable", reason: "coverage-unavailable" }
  } })
  resolveForecastSource = domainPlanner.sources.resolveForecastSource
  const state = createSfProductState({ persistence, authorize, createId: randomUUID, resolveTarget: async (request, snapshot, namespace, targetRef, command) => {
    if (namespace === "cases" && targetRef === creationTarget.ref) return { incarnation: creationTarget.incarnation }
    if (namespace === "cases") { const value = object(object(object(snapshot.data.__sfProductV1).cases)[targetRef]); return typeof value.incarnation === "string" ? { incarnation: value.incarnation } : undefined }
    if (namespace !== "receipts" || command.domainSurface !== "planner" || targetRef !== "v1" || !access.sourceAllowed) return undefined
    const planner = persistence.currentSnapshots?.()?.planner
    const matches = Object.values(planner?.sfSources?.scopes ?? {}).filter((entry) => entry.alive && entry.incarnation === command.targetIncarnation && entry.scope.recordId === targetRef && entry.scope.recordType === "planner-version" && entry.scope.principalRef === request.headers.get("authorization") && entry.scope.policyVersion === access.policy && entry.scope.accessRevision === access.revision)
    const physical = planner?.sfSources?.records[JSON.stringify(["planner-version", targetRef])]
    return matches.length === 1 && physical?.alive && physical.incarnation === matches[0]!.sourceIncarnation ? { incarnation: matches[0]!.incarnation } : undefined
  } })
  const authorizeCase = async (value: DecisionCase, context: TrustedDomainContext) => value.participants.includes(context.binding.principalRef) && await host.revalidate(context)
  const verifySources = async (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => {
    for (const ref of refs) { if (ref.kind !== "record") return false; const source = await domainPlanner.sources.resolveForecastSource(ref.refId, context); if (source.status !== "ok" || digestSfValue(source.value.evidence) !== digestSfValue(ref)) return false }
    return host.revalidate(context)
  }
  const evidence: BusinessContextService = { resolve: async (ref, context) => ({ ref, state: await verifySources([ref], context) ? "fresh" : "revoked", accessRevision: context.binding.accessRevision, checkedAt: plannerAt }), context: async ({ refs }, context) => Promise.all(refs.map((ref) => evidence.resolve(ref, context))), recall: async () => [], emitFromLedger: async () => { throw new Error("Native memory is outside this fixture") } }
  const operationIdentity = (context: TrustedDomainContext) => context.kind === "ui" ? ui.operationIdentity(context) : undefined
  const verifier = createPlannerOperationVerifier({ host, planner: domainPlanner.planner, sources: domainPlanner.sources, scenarioInputs: domainPlanner.scenarioInputs })
  const cases = createDecisionCasePort({ state, host, creationTarget, operationIdentity, authorizeCase, verifyScenarioOperations: async (value, context) => (await Promise.all(value.alternatives.map((alternative) => verifier(alternative.scenario, context)))).every(Boolean), evidence, createId: randomUUID, now: () => plannerAt })
  const storedCase = async () => {
    const context = await admit("decisions.portfolio.read", { caseRef: currentCase.ref })
    const result = await state.read(ui.requestFor(context)!, "cases", (value) => currentCase.ref ? value.cases[currentCase.ref.id] : undefined)
    if (result.status !== "ok" || !result.value) throw new Error("C12 case unavailable")
    return { value: result.value, storageVersion: result.storageVersion, request: ui.requestFor(context)! }
  }
  const editCase = async (work: (value: DecisionCase) => DecisionCase | void) => {
    const current = await storedCase(); const next = structuredClone(current.value); const edited = work(next) ?? next
    if (edited.version === current.value.version) edited.version++
    const result = await state.transaction(current.request, { namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: current.value.id, targetIncarnation: current.value.incarnation, idempotencyKey: randomUUID(), commandDigest: digestSfValue(edited) }, async (value) => { value.cases[current.value.id] = edited; return { commit: true, value: edited } })
    if (result.status !== "ok") throw new Error(`C12 fixture case edit: ${result.status}`)
    return edited
  }
  const caseCoverage = createDecisionCoverageAccess({ state, host, authorizeCase, verifyEvidence: (inventory, assessment, context) => verifySources([...inventory.sourceRefs, ...assessment.evaluatedSourceRefs], context) })
  const sources: PlannerSourceHost = { ...domainPlanner.sources, resolveForecastCoverage: (reference, context) => reference.startsWith("case-coverage:") ? caseCoverage(reference, context) : domainPlanner.sources.resolveForecastCoverage(reference, context) }
  const results = createSfDecisionResultStore({ state, host, authorizeCase, verifySources: (_value, refs, context) => verifySources(refs, context), createId: randomUUID, now: () => plannerAt })
  const scenarios = createStoredPlannerScenarioHost({ store: results, cases, planner: domainPlanner.planner, coverageRefFor: (ref, alternative) => decisionCoverageRef(ref, alternative.id, alternative.version) })
  const planner = createPlannerPort({ host, sources, scenarios, evidence })
  const readSnapshot = () => persistence.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
  const prepareOne = async (operation: ScenarioOperation, context: TrustedDomainContext) => {
    if (digestSfValue(operation) !== digestSfValue(selectedOperation)) return undefined
    const source = await domainPlanner.sources.resolveForecastSource(issuedRefs[1]!.refId, context)
    if (source.status !== "ok") return undefined
    const snapshot = await readSnapshot()
    const target = { surface: "planner" as const, type: "planner-version", id: "v1", incarnation: source.value.evidence.target.incarnation, version: source.value.evidence.target.version, fields: source.value.evidence.target.fields, period: plannerPeriod, observedAt: plannerAt }
    const produced = preparePlannerMutation({ snapshot, actor: identity(context), environment: { at: plannerAt, id: randomUUID, directory: [] }, context, target, evidence: source.value.evidence, scope: scopeFor(snapshot, context), command: { page: "OPEX", action: "save", id: "line", version: snapshot.versions["v1:lines:line"]?.version ?? 0, values: { versionId: "v1", f0: operation.amount } }, operationId: "c12-planner-edit", idempotencyKey: "c12-planner-edit" })
    const line = produced?.preview && rows(produced.preview.lines).find((item) => item.id === "line")
    const projection = await domainPlanner.planner.compareForecast({ baseRef: source.value.evidence.refId, candidateRef: source.value.evidence.refId, period: plannerPeriod, currency: "USD" }, context)
    if (!produced || !line || !Array.isArray(line.f) || typeof line.f[0] !== "number" || projection.status !== "ok") return undefined
    const command: PreparedCommand = { id: "c12-planner-edit", target, command: produced.command, expectedVersion: produced.command.version, idempotencyKey: "c12-planner-edit", commandDigest: produced.mutation.commandDigest, requiredAuthority: ["finance"], preview: { context: projection.value.baseline.context, version: target.version, engineVersion: "planner-runtime-v1", components: [], missing: [], values: [{ id: "line:1:forecast", value: line.f[0], currency: "USD", period: january, granularity: "month", sourceRefs: [source.value.evidence], drilldown: source.value.evidence, evidenceState: "confirmed" }] } }
    return { command, targetEvidence: source.value.evidence }
  }
  const actionFor = (operation: string): SfHumanAction | undefined => operation === "record-choice" ? "decisions.choose" : operation === "prepare-changes" ? "decisions.prepare-changes" : undefined
  const unavailable = async () => ({ status: "unavailable" as const, reason: "outside-recovery-proof" })
  const mutations = createDecisionMutations({ state, host, planner, sources, authorizeCase, operationIdentity,
    authorizeMutation: async (operation, payload, context) => { const action = actionFor(operation); return !!action && human.authorize(context, action, payload) },
    verifyMutation: (snapshot, operation, payload, context) => { const action = actionFor(operation); return !!action && context.kind === "ui" && ui.matchesIntent(context, `sf-human:${action}`, digestSfValue(payload)) && access.sourceAllowed && issuedRefs.every((ref) => { const projection = projectPlannerSource(snapshot, identity(context), ref.target.recordId); return !!projection && digestSfValue({ versionId: ref.target.recordId, projection }) === ref.target.projectionDigest }) },
    confirmChoice: async (ref, alternativeId, context) => { const intent = context.kind === "ui" ? payloads.get(context) : undefined; return intent?.action === "decisions.choose" && object(intent.payload).alternativeId === alternativeId && digestSfValue(object(intent.payload).caseRef) === digestSfValue(ref) && human.authorize(context, intent.action, intent.payload) },
    resolveQuestion: unavailable, resolveAnswer: unavailable, confirmAnswer: async () => false,
    resolveChoiceValues: async (_ref, request, context) => { const compared = await planner.compareScenarios(request, context); return compared.status === "ok" ? { status: "ok", value: request.criteria.map((criterionRef) => ({ criterionRef, value: compared.value.knownDifference, unit: "USD", currency: "USD", horizon: plannerPeriod })) } : compared },
    readScenarioResult: (resultRef, context) => results.readHistoricalScenario({ resultRef }, context),
    prepareDomainCommands: async (ref, choiceId, operations, context) => { const decision = (await storedCase()).value; const choice = decision.choices.find((item) => item.id === choiceId); if (!choice || decision.version !== ref.version || operations.length !== 1 || digestSfValue(choice.scenario.operations) !== digestSfValue(operations)) return { status: "denied", reason: "selection-unavailable" }; const prepared = await prepareOne(operations[0]!, context); return prepared ? { status: "ok", value: [{ ...prepared, preview: choice.result }] } : unavailable() }, createId: randomUUID, now: () => plannerAt,
  })
  const review = createDecisionPreparedReview({ state, cases, host, reviewDomain: createPlannerPreparedReview({ host, issueSource: domainPlanner.issueSource }) })
  const admission = createDecisionReviewAdmission(ui)
  const authorizeApplication = async (request: PreparedApplyRequest, context: TrustedDomainContext) => { const payload = context.kind === "ui" ? admission.payload(context, request) : undefined; return !!payload && access.sourceAllowed && human.authorize(context, "decisions.apply", payload) }
  const authorizeLookup: Parameters<typeof createSfPreparedApply>[0]["authorizeLookup"] = async (request, context) => {
    if (request.surface !== "planner" || request.targetRef !== "v1" || !access.sourceAllowed || !await host.revalidate(context)) return false
    const source = await persistence.resolveScopedSource("planner", request.targetIncarnation, async (snapshot, scope) => scope.recordType === "planner-version" && scope.recordId === request.targetRef && scope.principalRef === context.binding.principalRef && scope.accessRevision === context.binding.accessRevision && scope.policyVersion === context.binding.policyVersion && digestSfValue(scope.selector) === digestSfValue(sfPlannerProjectionSelector(snapshot, identity(context))) && access.sourceAllowed && await host.revalidate(context))
    return !!source && await host.revalidate(context)
  }
  const producer = createSfPreparedApply({ state, host, authorizeCase, authorizeLookup,
    authorizeReceipt: async (receipt, lookup, context) => receipt.principalRef === context.binding.principalRef && receipt.surface === lookup.surface && receipt.targetIncarnation === lookup.targetIncarnation && receipt.idempotencyKey === lookup.idempotencyKey && receipt.commandDigest === lookup.commandDigest && await authorizeLookup(lookup, context),
    confirmHuman: (request, _change, context) => authorizeApplication(request, context), reviewDigestFor: admission.get,
    resolveActor: (_snapshot, context) => access.sourceAllowed ? identity(context) : undefined,
    resolveMutation: (snapshot, change, actor, context) => {
      const source = change.operation.preview.values[0]?.sourceRefs[0]
      const mutation = source?.kind === "record" ? preparePlannerMutation({ snapshot, actor, environment: { at: plannerAt, id: randomUUID, directory: [] }, context, target: change.target, evidence: source, scope: scopeFor(snapshot, context), command: change.operation.command, operationId: change.operation.id, idempotencyKey: change.idempotencyKey })?.mutation : undefined
      return mutation && { ...mutation, execute: (current, principal, environment) => { counters.domainExecutions++; return mutation.execute(current, principal, environment) } }
    },
    verifyGrant: (snapshot, _request, change, actor, context) => access.sourceAllowed && actor.id === context.binding.principalRef && actor.canWrite && actor.roles.includes("finance") && sfScopedSourceIdentity(snapshot, scopeFor(snapshot, context))?.incarnation === change.target.incarnation,
    receiptVersion: (snapshot, change) => plannerPreparedRevision(snapshot, change.operation.command), environment: () => ({ at: plannerAt, id: randomUUID, directory: [] }), createId: randomUUID, now: () => plannerAt,
  })
  const measured: PreparedApplyPort = { ...producer, executePrepared: async (request, context) => { counters.dispatch++; return producer.executePrepared(request, context) } }
  const execute = createPreparedExecution({ state, host, apply: measured, authorizeCase, authorizeApplication: (request, _change, context) => authorizeApplication(request, context), confirmApplication: authorizeApplication, operationIdentity, reviewDigestFor: admission.get,
    revalidateProducer: async (request, context) => { const value = await review(request, context); return value.status === "ok" ? { status: "ok", value: { reviewDigest: value.value.reviewDigest } } : value },
    classifyReceipt: async (receipt, change, context) => { if (!await authorizeLookup({ surface: change.target.surface, targetRef: change.target.id, targetIncarnation: change.target.incarnation, idempotencyKey: change.idempotencyKey, commandDigest: change.operation.commandDigest }, context)) return undefined; const ref: Extract<BusinessEvidenceRef, { kind: "receipt" }> = { schema: "sf-evidence-v1", kind: "receipt", refId: receipt.id, installationId: "i", projectId: "p", evidenceLevel: "observed", refDigest: "", target: { surface: receipt.surface, receiptId: receipt.id, idempotencyKey: receipt.idempotencyKey, targetIncarnation: receipt.targetIncarnation, commandDigest: receipt.commandDigest, version: receipt.version } }; return { state: receipt.result.ok ? "applied" : "conflict", evidence: { ...ref, refDigest: digestSfEvidenceRef(ref) } } },
  })
  const admitApply = async (original: AdmittedApply, principal = "finance", key = "c12-human-apply") => { const context = await admit("decisions.apply", original, key, principal); admission.bind(context, original); return context }
  const apply = async (original: AdmittedApply, options: { mode?: "apply" | "recover"; principal?: string; operationId?: string } = {}) => { const context = await admitApply(original, options.principal, options.operationId); return execute({ caseRef: original.caseRef, choiceId: original.choiceId, changeId: original.changeId }, context, options.mode) }
  const prepare = async () => {
    if (currentCase.ref) throw new Error("Reopened C12 composition must use its original prepared request")
    const context = await admit("decisions.portfolio.read", { purpose: "c12-source-read" })
    for (const [index, id] of ["v0", "v1"].entries()) { const source = await domainPlanner.issueSource(id, context); if (source.status !== "ok") throw new Error(source.reason); issuedRefs.push(source.value.evidence); coverage.set(source.value.evidence.refId, { basisId: basis.id, basisVersion: basis.version, alternativeId: index ? "selected" : "baseline", alternativeVersion: 1, currency: "USD", horizon: plannerPeriod, evaluatedSourceRefs: [source.value.evidence], coverageState: "pending", entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => ({ categoryId, status: "pending", reason: "human-cost-classification-required" })), derivedMissingCategoryIds: [...RENEWAL_TRANSITION_CATEGORIES], issues: ["human-cost-classification-required"] }) }
    const draft = { objective: "Recover a separately reviewed January forecast edit", criteria: ["Known cost with unresolved coverage"], horizon: plannerPeriod, currency: "USD", sourceRefs: issuedRefs }
    const created = await cases.draft(draft, await admitOperation("sf_case_draft", draft, "c12-first-case"))
    if (created.status !== "ok") throw new Error(created.reason)
    currentCase.ref = { id: created.value.id, incarnation: created.value.incarnation, version: created.value.version }
    const requests: ScenarioRequest[] = [{ baseRef: issuedRefs[0]!.refId, operations: [], assumptions: [] }, { baseRef: issuedRefs[1]!.refId, operations: [selectedOperation], assumptions: [] }]
    const simulated = await Promise.all(requests.map((request) => domainPlanner.planner.simulateScenario(request, context)))
    const alternatives = simulated.map((result, index) => { if (result.status !== "ok") throw new Error(result.reason); return { id: index ? "selected" : "baseline", version: 1, title: index ? "January forecast edit" : "Keep forecast", scenario: requests[index]!, result: result.value } })
    // Inputs only: both alternatives are canonical simulations. Choice, prepared
    // command, review, admission, domain receipt and reconciliation are never seeded.
    const comparing = await editCase((value) => ({ ...value, state: "comparing", alternatives, costCoverageBases: [basis] }))
    const caseRef = { id: comparing.id, incarnation: comparing.incarnation, version: comparing.version }
    const scenarioRefs: string[] = []
    for (const alternative of alternatives) { const result = await results.write({ kind: "scenario", caseRef, result: alternative.result, requestDigest: digestSfValue(alternative.scenario), sourceRefs: alternative.result.sourceRefs, idempotencyKey: alternative.id }, context); if (result.status !== "ok") throw new Error(result.reason); scenarioRefs.push(result.value.resultRef) }
    const criteria = comparing.criteria.map((criterion) => criterion.id)
    const choiceRequest = { caseRef, alternativeId: "selected", alternativeVersion: 1, comparison: { scenarioRefs, criteria }, criteria, reason: "Review January separately; unresolved coverage confers no financial approval." }
    const chosen = await mutations.recordChoice(choiceRequest, await admit("decisions.choose", choiceRequest, "c12-human-choice"))
    if (chosen.status !== "ok") throw new Error(chosen.reason)
    const choice = (await storedCase()).value.choices[0]!
    const prepareRequest = { caseRef: chosen.value.caseRef, choiceId: choice.id, operations: [selectedOperation] }
    const prepared = await mutations.prepareChanges(prepareRequest, await admit("decisions.prepare-changes", prepareRequest, "c12-human-prepare"))
    if (prepared.status !== "ok") throw new Error(prepared.reason)
    const change = (await storedCase()).value.preparedChanges[0]!
    const request: PreparedApplyRequest = { caseRef: prepared.value.caseRef, choiceId: choice.id, changeId: change.id }
    const reviewed = await review(request, context)
    if (reviewed.status !== "ok") throw new Error(reviewed.reason)
    return { request, reviewDigest: reviewed.value.reviewDigest, original: { ...request, reviewDigest: reviewed.value.reviewDigest }, change, choice, review: reviewed.value }
  }
  const readProduct = async <A>(read: (value: Readonly<SfProductState>, authority: SfStateAuthority) => A | Promise<A>, principal = "finance") => {
    const context = await admit("decisions.portfolio.read", { caseRef: currentCase.ref }, randomUUID(), principal)
    const result = await state.read(ui.requestFor(context)!, "cases", read)
    if (result.status !== "ok") throw new Error(`C12 current state admission: ${result.status}`)
    return result.value
  }
  const observe = async () => { if (!persistence.transactionAll) throw new Error("SQLite snapshot unavailable"); return persistence.transactionAll(async (snapshots) => { const value = snapshots.dashboard.data.__sfProductV1 as SfProductState; return { commit: false, value: structuredClone({ state: value, decision: currentCase.ref ? value?.cases[currentCase.ref.id] : undefined, domain: snapshots.planner }) } }) }
  return { directory, get caseRef() { return currentCase.ref }, access, counters, faults, persistence, state, ui, human, host, admission, cases, mutations, producer, execute, prepare, apply, admit, admitOperation, admitApply, storedCase, readCase: async () => (await storedCase()).value, readSnapshot, editCase, readProduct, observe,
    close: async (remove = true) => { contexts.forEach(human.finish); await store.dispose(); if (remove) await rm(directory, { recursive: true, force: true }) },
  }
}
