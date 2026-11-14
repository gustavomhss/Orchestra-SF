import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { ChoiceRecord, DecisionCase, PreparedChange, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createPreparedExecution } from "../../../product/decisions/apply.ts"
import { applicationAttempt, applicationAttemptKey } from "../../../product/decisions/application-attempt.ts"
import { createDecisionHttp } from "../../../product/decisions/http.ts"
import { createDecisionMutations } from "../../../product/decisions/mutations.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"

test("a separate human rejection cancels only an undispatched proposal, retains the choice and reconciles retries", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-prepared-rejection-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const origin = "https://example.test"
  const at = "2026-11-14T00:00:00Z"
  const horizon = { start: "2027-01-01", end: "2027-12-31" }
  const access = { allowed: true }
  let sequence = 0
  const createId = () => `rejection-${++sequence}`
  const authorize = async (source: Request) => access.allowed && source.headers.get("x-principal") === "owner" ? { installationId: "install", projectId: "project", principalRef: "owner", policyVersion: "policy", accessRevision: "access" } : undefined
  const ui = createSfUiAuthority({ authorize, commandIdentity: async (source) => source.headers.get("x-command") ?? undefined, createId, now: () => Date.parse(at), privateCommands: ["sf-human:decisions.prepare-changes", "sf-human:decisions.portfolio.read", "sf-human:decisions.apply"] })
  const human = createSfHumanAuthority({ origin, ui })
  const host = { requestFor: (context: TrustedDomainContext) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: (context: TrustedDomainContext) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false) }
  const operationIdentity = (context: TrustedDomainContext) => context.kind === "ui" ? ui.operationIdentity(context) : undefined
  const authorizeCase = async (decision: DecisionCase, context: TrustedDomainContext) => decision.participants.includes(context.binding.principalRef) && await host.revalidate(context)
  const request = (command: string, payload: unknown, requestOrigin = origin) => new Request(`${origin}/app?sf=decision-reject-change`, { method: "POST", headers: { "content-type": "application/json", origin: requestOrigin, "x-principal": "owner", "x-command": command }, body: JSON.stringify(payload) })
  try {
    const state = createSfProductState({ persistence: store, createId, authorize, resolveTarget: async () => ({ incarnation: "case-inc" }) })
    const caseRef = { id: "case", incarnation: "case-inc", version: 1 }
    // Deliberately unavailable financial data: this test proves cancellation/authority,
    // while canonical domain preparation and calculation have separate integration tests.
    const preview: ScenarioResult = { id: "unpriced", version: 1, currency: "USD", horizon, components: [], sourceRefs: [], unresolvedConditions: ["not-priced"], restrictions: [], comparisonStatus: "unavailable", knownSubtotal: null, total: null, costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon, issues: ["not-priced"], evaluatedSourceRefs: [], coverageState: "unavailable", entries: [], derivedMissingCategoryIds: [] } }
    const choice: ChoiceRecord = { id: "choice", alternativeId: "alternative", alternativeVersion: 1, basisVersion: 1, criteria: [], values: [], evidenceRefs: [], principalRef: "owner", reason: "Retained original decision", at, scenario: { baseRef: "source", operations: [], assumptions: [] }, result: preview, comparison: { baselineResultRef: "baseline", alternativeResultRef: preview.id, costCoverageRefs: ["basis"], criterionResults: [], unresolvedConditions: ["not-priced"], comparisonStatus: "unavailable", knownDifference: null, completeDifference: null }, comparisonStatus: "unavailable", costCoverage: preview.costCoverage }
    const target = { surface: "planner", type: "planner-version", id: "source", incarnation: "source-inc", version: 1, fields: ["amount"], period: horizon, observedAt: at } as const
    const change: PreparedChange = { id: "change", caseId: caseRef.id, caseVersion: 1, choiceId: choice.id, target, expectedVersion: 0, requiredAuthority: ["finance"], idempotencyKey: "proposal-command", state: "planned", preview, operation: { id: "command", target, idempotencyKey: "proposal-command", commandDigest: "a".repeat(64), expectedVersion: 0, requiredAuthority: ["finance"], command: { page: "OPEX", action: "save", id: "line", version: 0, values: { versionId: "source", f0: 42 } }, preview: { context: { installationId: "install", projectId: "project", surface: "planner", policyVersion: "policy", principalRef: "owner", accessRevision: "access", sourceRefs: [target], period: horizon, currency: "USD", capabilities: [] }, version: 1, engineVersion: "no-calculation-in-cancellation-fixture", components: [], missing: [], values: [] } } }
    const decision: DecisionCase = { ...caseRef, state: "chosen", objective: "Reject a prepared proposal without changing the choice", horizon, currency: "USD", criteria: [], participants: ["owner"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [choice], preparedChanges: [change], receipts: [], ledger: [] }
    const seeded = await state.transaction(request("seed", {}), { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed", commandDigest: digestSfValue(decision), targetRef: caseRef.id, targetIncarnation: caseRef.incarnation }, async (staged) => { staged.cases.case = decision; return { commit: true, value: true } })
    if (seeded.status !== "ok") throw new Error("Case unavailable")
    const unavailable = async () => ({ status: "unavailable" as const, reason: "not-requested" })
    const mutations = createDecisionMutations({ state, host, operationIdentity, authorizeCase, createId, now: () => at,
      planner: { compareForecast: unavailable, simulateScenario: unavailable, compareScenarios: unavailable, evaluateSensitivity: unavailable }, sources: { resolveForecastSource: unavailable, resolveForecastCoverage: unavailable },
      authorizeMutation: (operation, payload, context) => operation === "reject-change" ? human.authorize(context, "decisions.prepare-changes", payload) : Promise.resolve(false),
      verifyMutation: (_snapshot, operation, payload, context) => operation === "reject-change" && context.kind === "ui" && ui.matchesIntent(context, "sf-human:decisions.prepare-changes", digestSfValue(payload)),
      confirmChoice: async () => false, confirmAnswer: async () => false, resolveQuestion: unavailable, resolveAnswer: unavailable, resolveChoiceValues: unavailable, prepareDomainCommands: unavailable })
    const payload = { purpose: "reject-change" as const, caseRef, choiceId: choice.id, changeId: change.id, rationale: "Keep the chosen analysis but reject this proposed domain change." }
    const admittedRead = await human.admit(request("read", payload), "decisions.portfolio.read", payload)
    if (admittedRead.status !== "ok") throw new Error("Read authority unavailable")
    expect(await mutations.rejectChange(payload, admittedRead.value)).toEqual({ status: "denied", reason: "human-rejection-required" })
    human.finish(admittedRead.value)
    const preparation = { caseRef, choiceId: choice.id, operations: [] }
    const admittedPreparation = await human.admit(request("prepare", preparation), "decisions.prepare-changes", preparation)
    if (admittedPreparation.status !== "ok") throw new Error("Preparation admission unavailable")
    expect(await mutations.rejectChange(payload, admittedPreparation.value)).toEqual({ status: "denied", reason: "human-rejection-required" })
    human.finish(admittedPreparation.value)
    const empty = {} as unknown as Parameters<typeof createDecisionHttp>[0]
    const handle = createDecisionHttp({ ...empty, origin, mount: "/app", human, mutations, withCase: async (_context, _ref, _options, action) => action() })
    expect((await handle(request("reject", { ...payload, applied: true })))?.status).toBe(400)
    expect((await handle(request("reject", payload, "https://untrusted.example")))?.status).toBe(403)
    const rejected = await handle(request("reject", payload))
    expect(rejected?.status).toBe(200)
    const receipt = await rejected!.json()
    expect(receipt).toMatchObject({ status: "ok", value: { caseRef: { ...caseRef, version: 2 } } })
    expect(await (await handle(request("reject", payload)))!.json()).toEqual(receipt)
    expect((await handle(request("reject", { ...payload, rationale: "Changed under the same command identity" })))?.status).toBe(409)
    const saved = await state.read(request("inspect", {}), "cases", (staged) => ({ decision: staged.cases.case!, outbox: Object.values(staged.outbox) }))
    if (saved.status !== "ok") throw new Error("Rejection unavailable")
    expect(saved.value.decision.choices).toEqual([choice])
    expect(saved.value.decision.preparedChanges).toEqual([{ ...change, state: "cancelled" }])
    expect(saved.value.decision.receipts).toEqual([])
    expect(saved.value.decision.ledger).toMatchObject([{ kind: "reconsideration-accepted", principalRef: "owner", rationale: payload.rationale, consideredActions: ["reject-change:change"] }])
    expect(saved.value.outbox).toHaveLength(1)
    const applyContext = await human.admit(request("apply-cancelled", payload), "decisions.apply", payload)
    if (applyContext.status !== "ok") throw new Error("Application admission unavailable")
    let dispatches = 0
    const execute = createPreparedExecution({ state, host, operationIdentity, authorizeCase, authorizeApplication: async () => true, confirmApplication: async () => true, reviewDigestFor: () => "b".repeat(64), revalidateProducer: unavailable, classifyReceipt: async () => undefined,
      apply: { readReceipt: async () => { throw new Error("Cancelled proposal must not inspect a domain") }, executePrepared: async () => { dispatches++; return unavailable() } } })
    expect(await execute({ caseRef: { ...caseRef, version: 2 }, choiceId: choice.id, changeId: change.id }, applyContext.value)).toEqual({ status: "conflict", reason: "change-not-applicable" })
    expect(dispatches).toBe(0)
    human.finish(applyContext.value)

    // A separate undisposed proposal may already have crossed the domain boundary.
    // Its durable reservation forbids reporting a cancellation while the outcome is unknown.
    const pending = { ...change, id: "possibly-dispatched", idempotencyKey: "other-command", operation: { ...change.operation, idempotencyKey: "other-command" } }
    const next = { ...saved.value.decision, version: 3, preparedChanges: [...saved.value.decision.preparedChanges, pending] }
    const added = await state.transaction(request("seed-second", {}), { namespace: "cases", expectedStorageVersion: saved.storageVersion, idempotencyKey: "seed-second", commandDigest: digestSfValue(next), targetRef: caseRef.id, targetIncarnation: caseRef.incarnation }, async (staged) => { staged.cases.case = next; return { commit: true, value: true } })
    if (added.status !== "ok") throw new Error("Second proposal unavailable")
    const attemptRequest = { caseRef: { ...caseRef, version: 3 }, choiceId: choice.id, changeId: pending.id }
    const attempt = applicationAttempt(attemptRequest, pending, "b".repeat(64), "owner", "dispatch")
    const reserved = await state.transaction(request("reserve", {}), { namespace: "cases", expectedStorageVersion: added.storageVersion, idempotencyKey: applicationAttemptKey(attemptRequest), commandDigest: digestSfValue(attempt), targetRef: caseRef.id, targetIncarnation: caseRef.incarnation }, async () => ({ commit: true, value: attempt }))
    if (reserved.status !== "ok") throw new Error("Reservation unavailable")
    expect((await handle(request("late-reject", { ...payload, ...attemptRequest })))?.status).toBe(409)
    const unchanged = await state.read(request("inspect", {}), "cases", (staged) => staged.cases.case)
    if (unchanged.status !== "ok") throw new Error("Case unavailable")
    expect(unchanged.value).toEqual(next)
    access.allowed = false
    expect((await handle(request("reject", payload)))?.status).toBe(403)
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
