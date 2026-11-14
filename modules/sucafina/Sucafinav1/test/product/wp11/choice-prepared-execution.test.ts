import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { PreparedCommand } from "../../../product/contracts/context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageAssessment, CostCoverageBasis, DecisionCase } from "../../../product/contracts/decisions.ts"
import type { ScenarioOperation, ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { DomainPortHost, PlannerSourceHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { createPreparedExecution } from "../../../product/decisions/apply.ts"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { createDecisionCoverageAccess, decisionCoverageRef } from "../../../product/decisions/coverage-access.ts"
import { createDecisionMutations } from "../../../product/decisions/mutations.ts"
import { createSfPreparedApply } from "../../../product/decisions/prepared-apply.ts"
import { proposalReviewDigest } from "../../../product/decisions/receipt-review-binding.ts"
import type { PreparedApplyRequest, ReviewDigestFor } from "../../../product/decisions/receipt-review-binding.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import type { SfHumanAction } from "../../../product/integration/human-authority.ts"
import { sfPlannerProjectionSelector } from "../../../product/integration/source-projections.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createPlannerOperationVerifier } from "../../../product/planner/operation-verifier.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { plannerPreparedRevision, preparePlannerMutation } from "../../../product/planner/prepared.ts"
import { createPlannerPreparedReview } from "../../../product/planner/prepared-review.ts"
import { createPlannerProduct } from "../../../product/planner/product.ts"
import { createStoredPlannerScenarioHost } from "../../../product/planner/stored-scenarios.ts"
import { rows } from "../../../runtime/contract.ts"
import { plannerAt, plannerFixture, plannerPeriod, plannerSnapshot } from "../wp03/planner-fixture.ts"

const origin = "https://example.test"
const actor = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }
const january = { start: "2027-01-01", end: "2027-01-31" }
const caseRef = { id: "choice-to-domain", incarnation: "choice-to-domain-incarnation", version: 1 }
type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>

// Real SQLite, scoped source issuer, canonical Planner calculation/preparation/review/apply
// and private human/UI admissions. The requests are explicit test admissions, not evidence
// of a person using an installed UI or a native resident session. No choice/change is seeded.
test("a canonical human choice creates a reviewed Planner proposal and only a separate application grant commits it", async () => {
  const initial = plannerSnapshot()
  initial.data.versions = ["v0", "v1"].map((id) => ({ id, name: id, year: 2027, closed: 0,
    lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(100) }],
    fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {},
  }))
  const fixture = await plannerFixture(initial)
  const contexts: TrustedUiContext[] = []
  let finish: ((context: TrustedUiContext) => void) | undefined
  try {
    // C08 uses Dashboard and prepared dispatch spans all three surfaces. Planner is
    // already initialized by plannerFixture; admit the others through the lifecycle.
    for (const surface of ["dashboard", "procurement"] as const) await fixture.persistence.initializeSources(surface)
    const intents = new WeakMap<Request, { action: SfHumanAction; digest: string; operationId: string }>()
    const payloads = new WeakMap<TrustedUiContext, { action: SfHumanAction; payload: unknown }>()
    const authorize = async (request: Request) => fixture.access.allowed && intents.has(request) && request.headers.get("authorization") === "finance"
      ? { installationId: "i", projectId: "p", principalRef: "finance", accessRevision: "1", policyVersion: "1" } : undefined
    const actions: SfHumanAction[] = ["decisions.portfolio.read", "decisions.choose", "decisions.prepare-changes", "decisions.apply"]
    const ui = createSfUiAuthority({ authorize, commandIdentity: async (request, operation, digest) => {
      const intent = intents.get(request)
      return intent && operation === `sf-human:${intent.action}` && digest === intent.digest ? intent.operationId : undefined
    }, privateCommands: actions.map((action) => `sf-human:${action}`), createId: randomUUID, now: () => Date.parse(plannerAt) })
    const human = createSfHumanAuthority({ origin, ui })
    finish = human.finish
    const admit = async (action: SfHumanAction, payload: unknown, operationId: string) => {
      const request = new Request(`${origin}/decisions`, { method: "POST", headers: { authorization: "finance", origin, "content-type": "application/json" }, body: JSON.stringify(payload) })
      intents.set(request, { action, digest: digestSfValue(payload), operationId })
      const admitted = await human.admit(request, action, payload)
      if (admitted.status !== "ok") throw new Error(admitted.reason)
      contexts.push(admitted.value)
      payloads.set(admitted.value, { action, payload: structuredClone(payload) })
      return admitted.value
    }
    const host: DomainPortHost = { ...fixture.host,
      requestFor: (binding) => binding.kind === "ui" ? ui.requestFor(binding) : undefined,
      revalidate: (binding) => binding.kind === "ui" ? ui.revalidate(binding) : Promise.resolve(false),
    }
    const readContext = await admit("decisions.portfolio.read", { caseRef }, "read-case")
    const readRequest = host.requestFor(readContext)
    if (!readRequest) throw new Error("Read authority unavailable")
    const issuedRefs: RecordEvidence[] = []
    const coverage = new Map<string, CostCoverageAssessment>()
    const basis: CostCoverageBasis = { id: "choice-execution-basis", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: issuedRefs }
    const unavailable = async () => ({ status: "unavailable" as const, reason: "outside-choice-execution-proof" })
    let resolveForecastSource: PlannerSourceHost["resolveForecastSource"] | undefined
    const domainPlanner = createPlannerProduct({ host, scopedSources: fixture.persistence, coverageFor: async (reference, binding) => {
      const assessment = coverage.get(reference)
      const current = await resolveForecastSource?.(reference, binding)
      if (!assessment || !current || current.status !== "ok" || !assessment.evaluatedSourceRefs.some((ref) => digestSfValue(ref) === digestSfValue(current.value.evidence))) return { status: "unavailable", reason: "source-coverage-unavailable" }
      return { status: "ok", value: { coverageRef: reference, basis, assessment } }
    } })
    resolveForecastSource = domainPlanner.sources.resolveForecastSource
    for (const [index, id] of ["v0", "v1"].entries()) {
      const issued = await domainPlanner.issueSource(id, readContext)
      if (issued.status !== "ok") throw new Error(issued.reason)
      const source = issued.value.evidence
      issuedRefs.push(source)
      coverage.set(source.refId, { basisId: basis.id, basisVersion: basis.version, alternativeId: index === 0 ? "baseline" : "selected", alternativeVersion: 1,
        currency: "USD", horizon: plannerPeriod, evaluatedSourceRefs: [source], coverageState: "pending",
        entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => ({ categoryId, status: "pending", reason: "human-cost-classification-required" })),
        derivedMissingCategoryIds: [...RENEWAL_TRANSITION_CATEGORIES], issues: ["human-cost-classification-required"],
      })
    }
    const selectedOperation: ScenarioOperation = { kind: "replace", targetRef: "line:1", amount: 42, currency: "USD", period: january }
    const requests: ScenarioRequest[] = [
      { baseRef: issuedRefs[0]!.refId, operations: [], assumptions: [] },
      { baseRef: issuedRefs[1]!.refId, operations: [selectedOperation], assumptions: [] },
    ]
    const simulated = await Promise.all(requests.map((request) => domainPlanner.planner.simulateScenario(request, readContext)))
    if (simulated[0]?.status !== "ok" || simulated[1]?.status !== "ok") throw new Error("Canonical alternatives unavailable")
    const alternatives = [simulated[0].value, simulated[1].value].map((result, index) => ({ id: result.costCoverage.alternativeId, version: result.costCoverage.alternativeVersion, title: index === 0 ? "Keep forecast" : "Explicit January edit", scenario: requests[index]!, result }))
    expect(alternatives.map((alternative) => alternative.result.knownSubtotal)).toEqual([1200, 1142])
    expect(alternatives[1]!.result).toMatchObject({ total: null, comparisonStatus: "conditioned", restrictions: ["preview-not-applied"] })
    const seed: DecisionCase = { ...caseRef, state: "comparing", objective: "Keep the chosen financial basis through a separately reviewed forecast edit", horizon: plannerPeriod, currency: "USD",
      criteria: [{ id: "review-cost", description: "Review the known cost with unresolved coverage", required: true }], participants: ["finance"], sourceRefs: issuedRefs,
      alternatives, costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [],
    }
    const state = createSfProductState({ persistence: fixture.persistence, authorize, createId: randomUUID, resolveTarget: async (_request, _snapshot, namespace, targetRef) => {
      if (namespace === "cases" && targetRef === caseRef.id) return { incarnation: caseRef.incarnation }
      if (namespace === "receipts" && targetRef === "v1") return { incarnation: issuedRefs[1]!.target.incarnation }
      return undefined
    } })
    const seeded = await state.transaction(readRequest, { namespace: "cases", expectedStorageVersion: 0, targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "seed-alternatives-only", commandDigest: digestSfValue(seed) }, async (value) => { value.cases[caseRef.id] = seed; return { commit: true, value: true } })
    if (seeded.status !== "ok") throw new Error("Case setup unavailable")
    const authorizeCase = async (decision: DecisionCase, binding: TrustedDomainContext) => decision.id === caseRef.id && decision.incarnation === caseRef.incarnation && decision.participants.includes(binding.binding.principalRef) && await host.revalidate(binding)
    const readCase = async () => {
      const current = await state.read(readRequest, "cases", (value) => value.cases[caseRef.id])
      if (current.status !== "ok" || !current.value) throw new Error("Case unavailable")
      return current.value
    }
    const verifySources = async (refs: readonly BusinessEvidenceRef[], binding: TrustedDomainContext) => {
      for (const ref of refs) {
        if (ref.kind !== "record") return false
        const current = await domainPlanner.sources.resolveForecastSource(ref.refId, binding)
        if (current.status !== "ok" || digestSfValue(current.value.evidence) !== digestSfValue(ref)) return false
      }
      return host.revalidate(binding)
    }
    const evidence: BusinessContextService = {
      resolve: async (ref, binding) => ({ state: await verifySources([ref], binding) ? "fresh" : "revoked", ref, accessRevision: binding.binding.accessRevision, checkedAt: plannerAt }),
      context: async ({ refs }, binding) => Promise.all(refs.map((ref) => evidence.resolve(ref, binding))), recall: async () => [],
      emitFromLedger: async () => { throw new Error("No native memory publication in this proof") },
    }
    const caseCoverage = createDecisionCoverageAccess({ state, host, authorizeCase, verifyEvidence: (inventory, assessment, binding) => verifySources([...inventory.sourceRefs, ...assessment.evaluatedSourceRefs], binding) })
    const sources: PlannerSourceHost = { ...domainPlanner.sources, resolveForecastCoverage: (reference, binding) => reference.startsWith("case-coverage:") ? caseCoverage(reference, binding) : domainPlanner.sources.resolveForecastCoverage(reference, binding) }
    const results = createSfDecisionResultStore({ state, host, authorizeCase, verifySources: (_value, refs, binding) => verifySources(refs, binding), createId: randomUUID, now: () => plannerAt })
    const stored = []
    for (const alternative of alternatives) {
      const saved = await results.write({ kind: "scenario", caseRef, result: alternative.result, requestDigest: digestSfValue(alternative.scenario), sourceRefs: alternative.result.sourceRefs, idempotencyKey: alternative.id }, readContext)
      if (saved.status !== "ok") throw new Error(saved.reason)
      stored.push(saved.value.resultRef)
    }
    const verifier = createPlannerOperationVerifier({ host, planner: domainPlanner.planner, sources: domainPlanner.sources, scenarioInputs: domainPlanner.scenarioInputs })
    const cases = createDecisionCasePort({ state, host, creationTarget: { ref: caseRef.id, incarnation: caseRef.incarnation }, operationIdentity: (binding) => binding.kind === "ui" ? ui.operationIdentity(binding) : undefined,
      authorizeCase, verifyScenarioOperations: async (decision, binding) => (await Promise.all(decision.alternatives.map((alternative) => verifier(alternative.scenario, binding)))).every(Boolean), evidence, createId: randomUUID, now: () => plannerAt,
    })
    const scenarios = createStoredPlannerScenarioHost({ store: results, cases, planner: domainPlanner.planner, coverageRefFor: (ref, alternative) => decisionCoverageRef(ref, alternative.id, alternative.version) })
    const planner = createPlannerPort({ host, sources, scenarios, evidence })
    const prepareOne = async (operation: ScenarioOperation, binding: TrustedDomainContext) => {
      if (digestSfValue(operation) !== digestSfValue(selectedOperation)) return undefined
      const source = await domainPlanner.sources.resolveForecastSource(issuedRefs[1]!.refId, binding)
      if (source.status !== "ok") return undefined
      const snapshot = await fixture.readSnapshot()
      const target = { surface: "planner" as const, type: "planner-version", id: "v1", incarnation: source.value.evidence.target.incarnation, version: source.value.evidence.target.version, fields: source.value.evidence.target.fields, period: plannerPeriod, observedAt: plannerAt }
      // Fixture routing for this one selected field; arithmetic and the command digest are
      // produced by the published Planner. This is not a generic production operation mapper.
      const produced = preparePlannerMutation({ snapshot, actor, environment: { at: plannerAt, id: randomUUID, directory: [] }, context: binding, target, evidence: source.value.evidence,
        scope: { principalRef: "finance", accessRevision: "1", policyVersion: "1", recordType: "planner-version", recordId: "v1", selector: sfPlannerProjectionSelector(snapshot, actor) },
        command: { page: "OPEX", action: "save", id: "line", version: snapshot.versions["v1:lines:line"]?.version ?? 0, values: { versionId: "v1", f0: operation.amount } }, operationId: "selected-forecast-operation", idempotencyKey: "selected-forecast-edit",
      })
      const line = produced?.preview && rows(produced.preview.lines).find((item) => item.id === "line")
      if (!produced || !line || !Array.isArray(line.f) || typeof line.f[0] !== "number") return undefined
      const projection = await domainPlanner.planner.compareForecast({ baseRef: source.value.evidence.refId, candidateRef: source.value.evidence.refId, period: plannerPeriod, currency: "USD" }, binding)
      if (projection.status !== "ok") return undefined
      const command: PreparedCommand = { id: "selected-forecast-operation", target, command: produced.command, expectedVersion: produced.command.version, idempotencyKey: "selected-forecast-edit", commandDigest: produced.mutation.commandDigest, requiredAuthority: ["finance"],
        preview: { context: projection.value.baseline.context, version: target.version, engineVersion: "planner-runtime-v1", components: [], missing: [], values: [{ id: "line:1:forecast", value: line.f[0], currency: "USD", period: january, granularity: "month", sourceRefs: [source.value.evidence], drilldown: source.value.evidence, evidenceState: "confirmed" }] },
      }
      return { command, targetEvidence: source.value.evidence }
    }
    const actionFor = (operation: string): SfHumanAction | undefined => operation === "record-choice" ? "decisions.choose" : operation === "prepare-changes" ? "decisions.prepare-changes" : undefined
    const mutations = createDecisionMutations({ state, host, planner, sources, authorizeCase,
      authorizeMutation: async (operation, payload, binding) => { const action = actionFor(operation); return !!action && human.authorize(binding, action, payload) },
      verifyMutation: (snapshot, operation, payload, binding) => {
        const action = actionFor(operation)
        return !!action && binding.kind === "ui" && ui.matchesIntent(binding, `sf-human:${action}`, digestSfValue(payload)) && issuedRefs.every((ref) => {
          const projection = projectPlannerSource(snapshot, actor, ref.target.recordId)
          return !!projection && digestSfValue({ versionId: ref.target.recordId, projection }) === ref.target.projectionDigest
        })
      }, operationIdentity: (binding) => binding.kind === "ui" ? ui.operationIdentity(binding) : undefined,
      confirmChoice: async (ref, alternativeId, binding) => {
        const admitted = binding.kind === "ui" ? payloads.get(binding) : undefined
        if (admitted?.action !== "decisions.choose" || !admitted.payload || typeof admitted.payload !== "object" || !("caseRef" in admitted.payload) || !("alternativeId" in admitted.payload)) return false
        return digestSfValue(admitted.payload.caseRef) === digestSfValue(ref) && admitted.payload.alternativeId === alternativeId && human.authorize(binding, admitted.action, admitted.payload)
      }, resolveQuestion: unavailable, resolveAnswer: unavailable, confirmAnswer: async () => false,
      resolveChoiceValues: async (_ref, request, binding) => { const compared = await planner.compareScenarios(request, binding); return compared.status === "ok" ? { status: "ok", value: [{ criterionRef: "review-cost", value: compared.value.knownDifference, unit: "USD", currency: "USD", horizon: plannerPeriod }] } : compared },
      readScenarioResult: (resultRef, binding) => results.readHistoricalScenario({ resultRef }, binding),
      prepareDomainCommands: async (ref, choiceId, operations, binding) => {
        const decision = await readCase()
        const choice = decision.choices.find((item) => item.id === choiceId)
        if (!choice || decision.version !== ref.version || operations.length !== 1 || digestSfValue(choice.scenario.operations) !== digestSfValue(operations)) return { status: "denied", reason: "selection-unavailable" }
        const prepared = await prepareOne(operations[0]!, binding)
        return prepared ? { status: "ok", value: [{ ...prepared, preview: choice.result }] } : { status: "unavailable", reason: "canonical-preparation-unavailable" }
      }, createId: randomUUID, now: () => plannerAt,
    })
    const official = async () => { const snapshot = await fixture.readSnapshot(); return structuredClone({ versions: snapshot.data.versions, officials: snapshot.data.officials, revisions: snapshot.versions, audit: snapshot.audit }) }
    const before = await official()
    const choiceRequest = { caseRef, alternativeId: "selected", alternativeVersion: 1, comparison: { scenarioRefs: stored, criteria: ["review-cost"] }, criteria: ["review-cost"], reason: "Review the January forecast separately; cost coverage and criterion evaluation remain unresolved, and no approval is implied." }
    expect((await mutations.recordChoice(choiceRequest, readContext)).status).toBe("denied")
    const choiceContext = await admit("decisions.choose", choiceRequest, "human-choice")
    const chosen = await mutations.recordChoice(choiceRequest, choiceContext)
    expect(chosen.status).toBe("ok")
    if (chosen.status !== "ok") throw new Error(chosen.reason)
    const afterChoice = await readCase()
    expect(afterChoice.choices).toHaveLength(1)
    expect(afterChoice.preparedChanges).toEqual([])
    expect(afterChoice.receipts).toEqual([])
    const choice = structuredClone(afterChoice.choices[0]!)
    expect(choice.result).toEqual(alternatives[1]!.result)
    expect(choice.comparison).toMatchObject({ knownDifference: -58, completeDifference: null, comparisonStatus: "conditioned", criterionResults: [{ criterionId: "review-cost", state: "unknown" }] })
    expect(await official()).toEqual(before)
    const prepareRequest = { caseRef: chosen.value.caseRef, choiceId: choice.id, operations: [selectedOperation] }
    expect((await mutations.prepareChanges(prepareRequest, choiceContext)).status).toBe("denied")
    const prepareContext = await admit("decisions.prepare-changes", prepareRequest, "human-prepare")
    const prepared = await mutations.prepareChanges(prepareRequest, prepareContext)
    expect(prepared.status).toBe("ok")
    if (prepared.status !== "ok") throw new Error(prepared.reason)
    const afterPrepare = await readCase()
    expect(afterPrepare.preparedChanges).toHaveLength(1)
    const change = afterPrepare.preparedChanges[0]!
    expect(change).toMatchObject({ choiceId: choice.id, state: "planned", target: { surface: "planner", id: "v1" }, operation: { command: { action: "save", values: { versionId: "v1", f0: 42 } } } })
    expect(change.preview).toEqual(choice.result)
    expect(afterPrepare.choices).toEqual([choice])
    expect(await official()).toEqual(before)
    expect(await mutations.prepareChanges(prepareRequest, prepareContext)).toEqual(prepared)
    const review = createPlannerPreparedReview({ host, issueSource: domainPlanner.issueSource })
    const reviewed = await review(change.operation, readContext)
    expect(reviewed.status).toBe("ok")
    if (reviewed.status !== "ok") throw new Error(reviewed.reason)
    expect(reviewed.value.fields).toEqual([{ field: "line:1:forecast", before: 100, after: 42, beforeCurrency: "USD", afterCurrency: "USD" }])
    const reviewDigest = proposalReviewDigest({ caseId: caseRef.id, caseIncarnation: caseRef.incarnation, changeCaseVersion: change.caseVersion, choiceDigest: digestSfValue(choice), change, fields: reviewed.value.fields, sourceRefDigest: reviewed.value.source.refDigest })
    const reviewedGrants = new WeakMap<TrustedUiContext, string>()
    const reviewDigestFor: ReviewDigestFor = (binding, incoming, selected) => binding.kind === "ui" && incoming.changeId === selected.id && incoming.choiceId === choice.id ? reviewedGrants.get(binding) : undefined
    const appliedRequest: PreparedApplyRequest = { caseRef: prepared.value.caseRef, choiceId: choice.id, changeId: change.id }
    const producer = createSfPreparedApply({ state, host, authorizeCase, authorizeLookup: async (_lookup, binding) => host.revalidate(binding), authorizeReceipt: async (receipt, lookup, binding) => receipt.principalRef === binding.binding.principalRef && receipt.surface === lookup.surface && await host.revalidate(binding),
      confirmHuman: (request, _change, binding) => human.authorize(binding, "decisions.apply", request), reviewDigestFor, resolveActor: (_snapshot, binding) => binding.binding.principalRef === actor.id ? actor : undefined,
      resolveMutation: (snapshot, selected, currentActor, binding) => {
        const source = selected.operation.preview.values[0]?.sourceRefs[0]
        if (source?.kind !== "record") return undefined
        return preparePlannerMutation({ snapshot, actor: currentActor, environment: { at: plannerAt, id: randomUUID, directory: [] }, context: binding, target: selected.target, evidence: source,
          scope: { principalRef: currentActor.id, accessRevision: "1", policyVersion: "1", recordType: "planner-version", recordId: "v1", selector: sfPlannerProjectionSelector(snapshot, currentActor) }, command: selected.operation.command, operationId: selected.operation.id, idempotencyKey: selected.idempotencyKey })?.mutation
      }, verifyGrant: (_snapshot, _request, _change, currentActor, binding) => currentActor.id === binding.binding.principalRef && currentActor.canWrite && currentActor.roles.includes("finance"), receiptVersion: (snapshot, selected) => plannerPreparedRevision(snapshot, selected.operation.command), environment: () => ({ at: plannerAt, id: randomUUID, directory: [] }), createId: randomUUID, now: () => plannerAt,
    })
    const counters = { dispatch: 0 }
    const execute = createPreparedExecution({ state, host, apply: { ...producer, executePrepared: async (request, binding) => { counters.dispatch++; return producer.executePrepared(request, binding) } }, authorizeCase,
      authorizeApplication: (request, _change, binding) => human.authorize(binding, "decisions.apply", request), confirmApplication: (request, binding) => human.authorize(binding, "decisions.apply", request), operationIdentity: (binding) => binding.kind === "ui" ? ui.operationIdentity(binding) : undefined, reviewDigestFor,
      revalidateProducer: async (_request, binding) => { const current = await review(change.operation, binding); return current.status === "ok" ? { status: "ok", value: { reviewDigest: proposalReviewDigest({ caseId: caseRef.id, caseIncarnation: caseRef.incarnation, changeCaseVersion: change.caseVersion, choiceDigest: digestSfValue(choice), change, fields: current.value.fields, sourceRefDigest: current.value.source.refDigest }) } } : current },
      classifyReceipt: async (receipt, _change, binding) => {
        if (!await host.revalidate(binding)) return undefined
        const ref: Extract<BusinessEvidenceRef, { kind: "receipt" }> = { schema: "sf-evidence-v1", kind: "receipt", refId: receipt.id, installationId: "i", projectId: "p", evidenceLevel: "observed", refDigest: "", target: { surface: receipt.surface, receiptId: receipt.id, idempotencyKey: receipt.idempotencyKey, targetIncarnation: receipt.targetIncarnation, commandDigest: receipt.commandDigest, version: receipt.version } }
        return { state: receipt.result.ok ? "applied" : "conflict", evidence: { ...ref, refDigest: digestSfEvidenceRef(ref) } }
      },
    })
    expect((await execute(appliedRequest, prepareContext)).status).not.toBe("ok")
    expect(counters.dispatch).toBe(0)
    expect(await official()).toEqual(before)
    const applyContext = await admit("decisions.apply", appliedRequest, "human-apply-after-review")
    reviewedGrants.set(applyContext, reviewDigest)
    const applied = await execute(appliedRequest, applyContext)
    expect(applied).toMatchObject({ status: "ok", value: { surface: "planner", version: 1, result: { ok: true } } })
    if (applied.status !== "ok") throw new Error(applied.reason)
    const final = await readCase()
    expect(final.choices).toEqual([choice])
    expect(final.preparedChanges).toMatchObject([{ id: change.id, state: "applied", receipt: applied.value }])
    expect(final.receipts).toEqual([applied.value])
    const after = await official()
    const version = rows(after.versions).find((value) => value.id === "v1")
    const line = rows(version?.lines).find((value) => value.id === "line")
    expect(Array.isArray(line?.f) ? line.f[0] : undefined).toBe(42)
    expect(after.officials).toEqual(before.officials)
    expect(await execute(appliedRequest, applyContext)).toEqual(applied)
    expect(await mutations.recordChoice(choiceRequest, choiceContext)).toEqual(chosen)
    expect(await mutations.prepareChanges(prepareRequest, prepareContext)).toEqual(prepared)
    expect(counters.dispatch).toBe(1)
    expect(await official()).toEqual(after)
    expect((await readCase()).choices).toEqual([choice])
  } finally {
    // Host leases are discarded with the real provider; native grant persistence is not claimed.
    for (const context of contexts) finish?.(context)
    await fixture.close()
  }
}, 180000)

