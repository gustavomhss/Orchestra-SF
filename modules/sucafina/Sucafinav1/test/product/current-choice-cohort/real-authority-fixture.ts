import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { ChoiceRecord, CostCoverageBasis, DecisionCase, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort } from "../../../product/contracts/state.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { createCurrentChoiceFence, createCurrentChoicePreview, type CurrentChoiceBinding } from "../../../product/decisions/current-choice-preview.ts"
import { createCurrentChoicePromotion, type CurrentChoicePromotion } from "../../../product/decisions/current-choice-promotion.ts"
import { createProposalCoverageRegistry } from "../../../product/decisions/proposal-coverage.ts"
import { assessCostCoverage } from "../../../product/decisions/cost-coverage.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createPlannerConfirmationObserver } from "../../../product/planner/confirmation.ts"
import { createPlannerProduct } from "../../../product/planner/product.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"

type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
const horizon = { start: "2027-01-01", end: "2027-12-31" }
const at = "2026-11-14T00:00:00Z"

function unknownResult(id: string, reference: RecordEvidence, alternativeVersion: number): ScenarioResult {
  return { id, version: 0, currency: "USD", horizon, components: [], sourceRefs: [reference], comparisonStatus: "conditioned", knownSubtotal: null, total: null, unresolvedConditions: ["authority-fixture-no-financial-claim"], restrictions: ["preview-not-applied"], costCoverage: { basisId: "basis", basisVersion: reference.target.version, alternativeId: "selected", alternativeVersion, currency: "USD", horizon, coverageState: "pending", entries: [], derivedMissingCategoryIds: [], issues: ["inventory-unavailable"], evaluatedSourceRefs: [reference] } }
}

/** Real C08/UI/source adapters, with seeded unknown financial results only.
 * This fixture proves authorization and snapshot fences, not the financial lifecycle.
 */
export async function currentChoiceAuthorityFixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-current-choice-authority-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const clock = { now: Date.parse(at) }
    const authenticated = { principal: "person", active: true }
    const identity = { installationId: "installation", hostId: "host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
    const events = { finalAuthorization: 0, applied: 0, producerCalls: 0 }
    const hooks: { afterFinalCapture?: () => Promise<void>; afterSources?: () => Promise<void>; afterPromotionWork?: () => Promise<void>; promotionSnapshot?: Snapshot; pendingFinal: boolean; pendingPromotion: boolean } = { pendingFinal: false, pendingPromotion: false }
    const controller = new AbortController()
    const request = new Request("https://example.test/current-choice", { headers: { authorization: "cohort-session" }, signal: controller.signal })
    const writes = new WeakSet<object>()
    let nextId = 0
    let product: ReturnType<typeof createSfProductAuthority>
    const fence = createCurrentChoiceFence({ persistence: store, host: () => product.host,
      operationIdentity: (context) => context.kind === "ui" ? product.ui.operationIdentity(context) : undefined, identity: () => identity })
    const sourceOptions = { createId: () => `cohort-source-${++nextId}`, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) }
    const persistence = createSfSourcePersistence({ ...sourceOptions, persistence: fence.persistence })
    // A genuinely separate writer for races; it does not borrow the operation scope.
    const external = createSfSourcePersistence({ ...sourceOptions, persistence: store })
    for (const surface of ["dashboard", "planner", "procurement"] as const) {
      await external.initializeSources(surface)
      await external.transaction(surface, async (snapshot) => {
        snapshot.data.roleMap = [{ surface, role: surface === "planner" ? "finance" : "viewer", entra: "cohort-group", version: 1, by: "admin" }]
        if (surface === "planner") snapshot.data.versions = [{ id: "v0", year: 2027, closed: 0, lines: [{ id: "line", name: "Observed source", sec: "opex", el: "licenses", cur: "USD", b: [100] }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
        return { commit: true, value: undefined }
      })
    }
    const options: Parameters<typeof createSfProductAuthority>[0] = {
      identity: () => identity, installationId: identity.installationId, origin: "https://example.test", policyVersion: "policy",
      persistence, proposalCoverageWrites: writes, createId: () => `cohort-state-${++nextId}`, now: () => clock.now,
      grants: [{ principalRef: "person", namespaces: ["cases", "preferences"], operations: ["sf_case_read"], humanActions: ["decisions.edit", "decisions.promote-alternative"] }],
      authenticate: async (incoming, context) => {
        if (hooks.pendingPromotion && context?.surface === "dashboard") {
          hooks.pendingPromotion = false
          events.finalAuthorization += 1
          await hooks.afterPromotionWork?.()
        }
        if (hooks.pendingFinal && context?.surface === "dashboard") {
          hooks.pendingFinal = false
          events.finalAuthorization += 1
          await hooks.afterFinalCapture?.()
        }
        if (incoming.headers.get("authorization") !== "cohort-session" || !context || !authenticated.active) return null
        return resolve(authenticated.principal, [...context.roleMap], (group) => group === "cohort-group")
      },
      environment: async () => ({ at, id: () => `environment-${++nextId}`, directory: [] }),
      commandIdentity: async (incoming, operation) => `${incoming.headers.get("x-command") ?? "cohort-command"}:${operation}`,
      inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
      providerGeneration: async () => undefined, authorizeDocument: async () => undefined,
    }
    product = createSfProductAuthority(options)
    const outside = createSfProductAuthority({ ...options, persistence: external })
    const caseRef = { id: "case", incarnation: "case-incarnation", version: 2 }
    const intentDigest = digestSfValue({ caseRef })
    const admitted = await product.ui.admit(request, "sf_case_read", intentDigest)
    if (admitted.status !== "ok" || !await product.ui.validate(admitted.value, "sf_case_read", intentDigest)) throw new Error("Real UI reader admission unavailable")
    const context = admitted.value
    const contexts: TrustedUiContext[] = [context]
    const planner = createPlannerProduct({ host: product.host, scopedSources: persistence, coverageFor: async () => ({ status: "unavailable", reason: "reader-does-not-calculate" }) })
    const original = await planner.issueSource("v0", context)
    if (original.status !== "ok") throw new Error(`Original canonical source unavailable: ${JSON.stringify(original)}`)
    await external.transaction("planner", async (snapshot) => {
      const versions = snapshot.data.versions as { lines: { b: number[] }[] }[]
      versions[0]!.lines[0]!.b[0] = 200
      return { commit: true, value: undefined }
    })
    const current = await planner.issueSource("v0", context)
    if (current.status !== "ok") throw new Error(`Current canonical source unavailable: ${JSON.stringify(current)}`)
    const originalSource = original.value.evidence
    const currentSource = current.value.evidence
    const continuity = createPlannerConfirmationObserver({ host: product.host, issueSource: planner.issueSource, planner: planner.planner })
    const proof = await continuity.prepareResimulationContinuity(originalSource, currentSource, context)
    if (proof.status !== "ok") throw new Error(`Canonical continuity unavailable: ${JSON.stringify(proof)}`)
    const originalScenario: ScenarioRequest = { baseRef: originalSource.refId, operations: [], assumptions: [] }
    const currentScenario: ScenarioRequest = { ...originalScenario, baseRef: currentSource.refId }
    const originalResult = unknownResult("original-preview", originalSource, 1)
    const choice: ChoiceRecord = { id: "choice", alternativeId: "selected", alternativeVersion: 1, basisVersion: 1, criteria: [], values: [], evidenceRefs: [originalSource], principalRef: "person", reason: "Seeded historical reader fixture; no financial or application claim.", at, scenario: originalScenario, result: originalResult, comparison: { baselineResultRef: "retained-baseline", alternativeResultRef: "retained-original", costCoverageRefs: [], criterionResults: [], unresolvedConditions: ["authority-fixture-no-financial-claim"], comparisonStatus: "conditioned", knownDifference: null, completeDifference: null }, comparisonStatus: "conditioned", costCoverage: originalResult.costCoverage }
    const decision: DecisionCase = { ...caseRef, state: "chosen", objective: "Read an authenticated current-choice binding", currency: "USD", horizon, criteria: [], participants: ["person"], sourceRefs: [originalSource, currentSource], alternatives: [{ id: "selected", version: 1, title: "Historical selection", scenario: originalScenario, result: originalResult }], costCoverageBases: [], assumptions: [], questions: [], choices: [choice], preparedChanges: [], receipts: [], ledger: [] }
    const seed = await product.state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, targetRef: product.creationTarget.ref, targetIncarnation: product.creationTarget.incarnation, idempotencyKey: "seed-reader-case", commandDigest: digestSfValue(decision) }, async (value) => { value.cases[caseRef.id] = decision; return { commit: true, value: true } })
    if (seed.status !== "ok" || !seed.value) throw new Error(`Real C08 case unavailable: ${JSON.stringify(seed)}`)
    const authorizeCase = async (value: DecisionCase, trusted: TrustedDomainContext) => value.id === caseRef.id && value.incarnation === caseRef.incarnation && value.participants.includes(trusted.binding.principalRef) && await product.host.revalidate(trusted)
    const verifyResultSources = async (_value: unknown, refs: readonly BusinessEvidenceRef[], trusted: TrustedDomainContext) => {
      if (!refs.length || refs.some((ref) => digestSfValue(ref) !== digestSfValue(currentSource))) return false
      const resolved = await planner.sources.resolveForecastSource(currentSource.refId, trusted)
      return resolved.status === "ok" && digestSfValue(resolved.value.evidence) === digestSfValue(currentSource) && await product.host.revalidate(trusted)
    }
    const results = createSfDecisionResultStore({ state: product.state, host: product.host, authorizeCase, verifySources: verifyResultSources, createId: () => `cohort-result-${++nextId}`, now: () => at })
    const producer = await results.write({ kind: "scenario", caseRef, requestDigest: digestSfValue(currentScenario), result: unknownResult("producer-preview", currentSource, 2), sourceRefs: [currentSource], idempotencyKey: "cohort-producer" }, context)
    const reviewed = await results.write({ kind: "scenario", caseRef, requestDigest: digestSfValue(currentScenario), result: unknownResult("reviewed-preview", currentSource, 2), sourceRefs: [currentSource], idempotencyKey: "cohort-reviewed" }, context)
    if (producer.status !== "ok" || reviewed.status !== "ok" || producer.value.kind !== "scenario" || reviewed.value.kind !== "scenario") throw new Error("Canonical result-store seeding unavailable")
    const basis: CostCoverageBasis = { id: "basis", version: currentSource.target.version, decisionType: "cohort-unpriced", categoryIds: [], additionalCategoryIds: [], sourceRefs: [currentSource] }
    const registry = createProposalCoverageRegistry({ state: product.state, host: product.host, authorizeCase, proposalCoverageWrites: writes,
      operationIdentity: (trusted) => trusted.kind === "ui" ? product.ui.operationIdentity(trusted) : undefined, now: () => at,
      verifyEvidence: async (record, trusted) => {
        if (digestSfValue(record.basis) !== digestSfValue(basis) || !await verifyResultSources(record.result, record.sourceRefs, trusted)) return false
        const assessed = assessCostCoverage({ basis, alternativeId: "selected", alternativeVersion: 2, currency: "USD", horizon, entries: [], components: [],
          evidence: record.sourceRefs.map((ref) => ({ ref, state: "fresh" as const, accessRevision: trusted.binding.accessRevision, checkedAt: at })),
          supports: () => { throw new Error("Unknown inventory must not imply applicability") } })
        return digestSfValue(assessed) === digestSfValue(record.assessment) && digestSfValue(record.result.costCoverage) === digestSfValue(assessed)
      },
      verifySnapshot: (snapshot, record) => digestSfValue(record.basis) === digestSfValue(basis) && proof.value.fenceSnapshot(snapshot),
    })
    const coverage = await registry.registerProposalCoverage({ caseRef: encodeCaseRef(caseRef), expectedCaseVersion: caseRef.version, basis, assessment: reviewed.value.result.costCoverage, result: reviewed.value.result, scenario: currentScenario }, context)
    if (coverage.status !== "ok") throw new Error(`Actual pending coverage registry unavailable: ${JSON.stringify(coverage)}`)
    const resolvedCoverage = await registry.resolveForecastCoverage(coverage.value.coverageRef, context)
    const retainedCoverage = await product.state.read(request, "preferences", (stored) => stored.preferences[`sf:proposal-coverage:${coverage.value.coverageRef}`])
    if (resolvedCoverage.status !== "ok" || retainedCoverage.status !== "ok" || !retainedCoverage.value) throw new Error("Canonical coverage binding unavailable")
    const promotion: CurrentChoicePromotion = { caseRef, choiceId: choice.id, choiceDigest: digestSfValue(choice), alternativeRef: { id: "selected", version: 1 }, resultRef: reviewed.value.resultRef, resultDigest: reviewed.value.resultDigest, scenario: currentScenario, coverageRef: coverage.value.coverageRef }
    const body = { schema: "sf-current-choice-binding-v1" as const, promotion, originalSource, source: currentSource, producerResultRef: producer.value.resultRef, producerResultDigest: producer.value.resultDigest, coverageDigest: digestSfValue(resolvedCoverage.value), coverageRecordDigest: digestSfValue(retainedCoverage.value) }
    const binding: CurrentChoiceBinding = { ...body, recordDigest: digestSfValue(body) }
    const preferences = await product.state.read(request, "preferences", () => null)
    if (preferences.status !== "ok") throw new Error("Real preference authority unavailable")
    const put = async (state: SfProductState) => { state.preferences[`sf:proposal-coverage:current-choice:${digestSfValue(promotion.resultRef)}`] = binding; return { commit: true, value: true } }
    writes.add(put)
    const bound = await product.state.transaction(request, { namespace: "preferences", expectedStorageVersion: preferences.storageVersion, targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "seed-private-reader-binding", commandDigest: digestSfValue(binding) }, put).finally(() => writes.delete(put))
    if (bound.status !== "ok" || !bound.value) throw new Error("Private binding unavailable")
    const state: SfProductStatePort = { ...product.state, transaction: (incoming, command, work) => product.state.transaction(incoming, command, async (stored, authority, snapshot) => {
      const result = await work(stored, authority, snapshot)
      if (hooks.afterPromotionWork && command.idempotencyKey.endsWith(":promote-current-choice") && result.commit) {
        // Retain the provider's actual Planner work snapshot. currentSnapshots()
        // intentionally returns copies and cannot inject this late adapter race.
        hooks.promotionSnapshot = snapshot
        hooks.pendingPromotion = true
      }
      return result
    }), read: (incoming, namespace, read) => product.state.read(incoming, namespace, async (stored, authority) => {
      const value = await read(stored, authority)
      // A timing probe around the real provider callback, never an authority replacement.
      if (hooks.afterFinalCapture && namespace === "cases" && value && typeof value === "object" && "decision" in value && "result" in value && "producer" in value && "binding" in value) hooks.pendingFinal = true
      return value
    }) }
    const unused = (): never => { events.producerCalls += 1; throw new Error("Read must not calculate, prepare or promote") }
    const unusedAsync = async (): Promise<never> => unused()
    const preview = createCurrentChoicePreview({ state, host: product.host, fence, results, writes,
      sources: registry, coverageEvidence: { entries: unusedAsync, resolve: unusedAsync, supports: unused, verifySnapshot: unused },
      authorizePreview: async () => false, resimulate: unusedAsync, registerCoverage: unusedAsync,
      operationIdentity: (trusted) => trusted.kind === "ui" ? product.ui.operationIdentity(trusted) : undefined,
      authorizeCase, verifySnapshot: (snapshot, _request, value) => digestSfValue(value) === digestSfValue(binding) && proof.value.fenceSnapshot(snapshot),
      verifySources: async (value, trusted) => {
        if (digestSfValue(value) !== digestSfValue(binding)) return false
        const observed = await continuity.prepareResimulationContinuity(value.originalSource, value.source, trusted)
        const valid = observed.status === "ok" && await observed.value.revalidate()
        if (valid && hooks.afterSources) { const work = hooks.afterSources; hooks.afterSources = undefined; await work() }
        return valid
      },
    })
    const promotionProofs = new WeakMap<TrustedDomainContext, (snapshot: Snapshot) => boolean>()
    const promote = createCurrentChoicePromotion({ state, host: product.host, fence, sources: registry, authorizeCase,
      authorizePromotion: (payload, trusted) => product.human.authorize(trusted, "decisions.promote-alternative", payload),
      verifyProvenance: async (payload, retained, result, trusted, promoted) => {
        if (digestSfValue(payload) !== digestSfValue(promotion) || digestSfValue(retained) !== digestSfValue(choice) || result.resultDigest !== promotion.resultDigest || result.requestDigest !== digestSfValue(currentScenario)) return false
        const bound = await preview.read(payload, trusted, promoted)
        if (bound.status !== "ok" || digestSfValue(bound.value) !== digestSfValue(binding)) return false
        const observed = await continuity.prepareResimulationContinuity(originalSource, currentSource, trusted)
        if (observed.status !== "ok" || !await observed.value.revalidate()) return false
        promotionProofs.set(trusted, observed.value.fenceSnapshot)
        return true
      },
      verifySnapshot: (snapshot, payload, retained, result, trusted) => digestSfValue(payload) === digestSfValue(promotion) && digestSfValue(retained) === digestSfValue(choice) && result.resultDigest === promotion.resultDigest && promotionProofs.get(trusted)?.(snapshot) === true,
      operationIdentity: (trusted) => trusted.kind === "ui" ? product.ui.operationIdentity(trusted) : undefined, now: () => at,
    })
    const snapshot = () => store.transactionAll!(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
    return { store, persistence, external, outside, product, fence, preview, request, controller, context, contexts, intentDigest, identity, authenticated, clock, events, hooks,
      caseRef, choice, decision, binding, promotion, promote, results, currentSource, originalSource, snapshot, registry, writes, authorizeCase,
      changePolicy() { options.policyVersion = "policy-replaced" },
      async admitPromotion(payload: CurrentChoicePromotion = promotion, command = "human-promotes-current") {
        const post = new Request(request, { method: "POST", headers: { authorization: "cohort-session", origin: "https://example.test", "x-command": command } })
        const human = await product.human.admit(post, "decisions.promote-alternative", payload)
        if (human.status !== "ok") throw new Error(`Real human promotion admission unavailable: ${JSON.stringify(human)}`)
        contexts.push(human.value)
        return { request: post, context: human.value }
      },
      async renew() {
        const otherRequest = new Request(request, { headers: { authorization: "cohort-session", "x-command": "unrelated-command" } })
        const otherDigest = digestSfValue({ caseRef, reason: "unrelated request" })
        const other = await product.ui.admit(otherRequest, "sf_case_read", otherDigest)
        if (other.status !== "ok" || !await product.ui.validate(other.value, "sf_case_read", otherDigest)) throw new Error("Unrelated real admission unavailable")
        contexts.push(other.value)
        return { request: otherRequest, context: other.value }
      },
      async changeSource() {
        await external.transaction("planner", async (snapshot) => {
          const versions = snapshot.data.versions as { lines: { b: number[] }[] }[]
          versions[0]!.lines[0]!.b[0] = 300
          return { commit: true, value: undefined }
        })
      },
      async changeCase() {
        const loaded = await outside.state.read(request, "cases", (value) => value.cases[caseRef.id])
        if (loaded.status !== "ok" || !loaded.value) throw new Error("External case unavailable")
        const saved = await outside.state.transaction(request, { namespace: "cases", expectedStorageVersion: loaded.storageVersion, targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "external-case-change", commandDigest: digestSfValue({ caseRef, version: 3 }) }, async (value) => {
          value.cases[caseRef.id] = { ...value.cases[caseRef.id]!, version: 3, objective: "Changed by separate authorized operation" }
          return { commit: true, value: true }
        })
        if (saved.status !== "ok" || !saved.value) throw new Error("External case edit did not commit")
      },
      async cleanup() {
        contexts.forEach((trusted) => product.ui.finish(trusted))
        await store.dispose()
        await rm(directory, { recursive: true, force: true })
      },
    }
  } catch (error) {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
    throw error
  }
}
