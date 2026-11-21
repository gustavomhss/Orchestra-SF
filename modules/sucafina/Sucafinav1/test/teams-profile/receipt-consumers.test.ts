import { afterEach, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import type { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { createSfProductAuthority } from "../../product/integration/product-authority.ts"
import type { SfProductGrant } from "../../product/integration/product-authority.ts"
import { createDecisionCasePort } from "../../product/decisions/case-port.ts"
import { createDecisionCaseManagement } from "../../product/decisions/case-management.ts"
import { createSfDecisionResultStore } from "../../product/decisions/result-store.ts"
import { applicationAttemptKey, applicationAttempts, hasApplicationAttempt } from "../../product/decisions/application-attempt.ts"
import { digestSfValue } from "../../product/contracts/canonical.ts"
import type { TrustedDomainContext } from "../../product/contracts/sf-execution.ts"
import type { DecisionCase } from "../../product/contracts/decisions.ts"
import { oid, other } from "../microsoft-login/oidc-fixture.ts"
import { profileA, profileB } from "./installation-fixture.ts"
import { productGrant, teamProductFixture } from "./product-fixture.ts"

// Real signed Microsoft sessions, private grants/role maps, product authority and
// SQLite/C08. The case is source-free and the comparison body is declared fixture
// data; this suite qualifies receipt/retry authority, not financial or native output.
const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const close of cleanups.splice(0)) await close() })

function grant(principalRef: string): SfProductGrant {
  const base = productGrant(principalRef)
  return { ...base, operations: [...base.operations, "sf_scenario_compare"],
    humanActions: [...base.humanActions ?? [], "decisions.edit"] }
}
async function fixture() {
  const f = await teamProductFixture({ enabled: [profileA, profileB], grants: [grant(oid), grant(other)] })
  cleanups.push(f.close)
  return f
}
type Fixture = Awaited<ReturnType<typeof fixture>>
type Authority = ReturnType<typeof createSfProductAuthority>
const payload = { objective: "A source-free receipt consumer case", horizon: { start: "2027-01-01", end: "2027-12-31" },
  currency: "USD", criteria: ["cost"], sourceRefs: [] }

async function lease(authority: Authority, request: Request, operation: string, input: unknown) {
  const digest = digestSfValue(input)
  const result = await authority.ui.admit(request, operation, digest)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error("Current Microsoft product admission required")
  expect(await authority.ui.validate(result.value, operation, digest)).toBe(true)
  return result.value
}
async function editLease(authority: Authority, request: Request, input: Parameters<ReturnType<typeof createDecisionCaseManagement>["edit"]>[0]) {
  const result = await authority.human.admit(request, "decisions.edit", input)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error("Current human edit admission required")
  return result.value
}
const authorizeCase = (authority: Authority) => async (value: DecisionCase, context: TrustedDomainContext) =>
  value.participants.includes(context.binding.principalRef) && await authority.host.revalidate(context)
function cases(f: Fixture, authority = f.authority) {
  return createDecisionCasePort({
    state: authority.state, host: authority.host, creationTarget: authority.creationTarget,
    operationIdentity: (context) => context.kind === "ui" ? authority.ui.operationIdentity(context) : undefined,
    authorizeCase: authorizeCase(authority),
    verifyScenarioOperations: async (value, context) => !value.alternatives.length && !value.choices.length && await authority.host.revalidate(context),
    evidence: { context: async () => [], recall: async () => [],
      resolve: async () => { throw new Error("No external evidence mounted in this receipt test") },
      emitFromLedger: async () => { throw new Error("No external ledger emitter mounted in this receipt test") } },
    createId: randomUUID, now: () => new Date(f.provider.clock.value).toISOString(),
  })
}
async function seed(f: Fixture, authority = f.authority) {
  const context = await lease(authority, f.businessRequest(profileA, f.cookie, { method: "POST",
    headers: { "Idempotency-Key": randomUUID() } }), "sf_case_draft", payload)
  try {
    const created = await cases(f, authority).draft(payload, context)
    expect(created.status).toBe("ok")
    if (created.status !== "ok") throw new Error("Real case creation required")
    return created.value
  } finally { authority.ui.finish(context) }
}
function management(authority: Authority) {
  return createDecisionCaseManagement({
    state: authority.state, host: authority.host, operationIdentity: (context) => context.kind === "ui" ? authority.ui.operationIdentity(context) : undefined,
    authorizeCase: authorizeCase(authority),
    authorizeEdit: (request, context) => authority.human.authorize(context, "decisions.edit", request),
    verifyEvidence: async (refs, context) => refs.length === 0 && await authority.host.revalidate(context),
    verifyEdit: (_snapshot, before, after, context) => context.kind === "ui" && before.sourceRefs.length === 0 && after.sourceRefs.length === 0 &&
      authority.ui.matchesIntent(context, "sf-human:decisions.edit", digestSfValue({
        caseRef: { id: before.id, incarnation: before.incarnation, version: before.version },
        objective: after.objective, criteria: after.criteria, sourceRefs: after.sourceRefs,
      })),
  })
}
function results(f: Fixture, authority = f.authority) {
  return createSfDecisionResultStore({
    state: authority.state, host: authority.host, authorizeCase: authorizeCase(authority),
    verifySources: async (_result, refs, context) => refs.length === 0 && await authority.host.revalidate(context),
    createId: randomUUID, now: () => new Date(f.provider.clock.value).toISOString(),
  })
}
async function stored(f: Fixture) {
  return f.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data.__sfProductV1) }))
}
const ref = (decision: DecisionCase) => ({ id: decision.id, incarnation: decision.incarnation, version: decision.version })
const comparison = (decision: DecisionCase) => ({
  kind: "comparison" as const, result: { baselineResultRef: "fixture-baseline", alternativeResultRef: "fixture-result",
    costCoverageRefs: ["fixture-coverage"], criterionResults: [], unresolvedConditions: ["fixture:source-free"],
    comparisonStatus: "conditioned" as const, knownDifference: 30000, completeDifference: null },
  caseRef: ref(decision), requestDigest: digestSfValue({ kind: "declared-comparison-fixture" }), sourceRefs: [], idempotencyKey: randomUUID(),
})
const post = (f: Fixture, key: string, profile: TeamProfile.Ref = profileA) =>
  f.businessRequest(profile, f.cookie, { method: "POST", headers: { "Idempotency-Key": key } })

test("receipt-consumer: real decision edit retries retain one receipt and current grants still govern replay", async () => {
  const f = await fixture(), decision = await seed(f), port = management(f.authority)
  const request = { caseRef: ref(decision), objective: "The deliberately edited objective", criteria: decision.criteria, sourceRefs: [] }
  const key = randomUUID()
  const first = await editLease(f.authority, post(f, key), request)
  const saved = await port.edit(request, first)
  expect(saved.status).toBe("ok")
  f.authority.human.finish(first)
  const before = await stored(f)
  const retry = await editLease(f.authority, post(f, key), request)
  expect(await port.edit(request, retry)).toEqual(saved)
  f.authority.human.finish(retry)
  expect(await stored(f)).toEqual(before)

  const foreign = await editLease(f.authority, post(f, key, profileB), request)
  const refused = await port.edit(request, foreign)
  expect(refused.status).not.toBe("ok")
  expect(refused).not.toHaveProperty("value")
  f.authority.human.finish(foreign)
  expect(await stored(f)).toEqual(before)

  const changed = { ...request, objective: "A different intent with the same key" }
  const conflicting = await editLease(f.authority, post(f, key), changed)
  expect(await port.edit(changed, conflicting)).toMatchObject({ status: "conflict", reason: "idempotency-content-changed" })
  f.authority.human.finish(conflicting)
  expect(await stored(f)).toEqual(before)

  const retained = await editLease(f.authority, post(f, key), request)
  await f.writeGrants(f.grants.map((value) => ({ ...value, humanActions: [] })))
  const revoked = await port.edit(request, retained)
  expect(revoked.status).toBe("denied")
  expect(revoked).not.toHaveProperty("value")
  f.authority.human.finish(retained)
  expect(await stored(f)).toEqual(before)
})

test("receipt-consumer: result recovery distinguishes missing, same-Team receipt and foreign-Team ambiguity", async () => {
  const f = await fixture(), decision = await seed(f), port = results(f)
  const request = comparison(decision)
  const lookup = { caseRef: request.caseRef, kind: request.kind, idempotencyKey: request.idempotencyKey, requestDigest: request.requestDigest }
  const context = await lease(f.authority, post(f, randomUUID()), "sf_scenario_compare", request)
  expect(await port.readByRequest(lookup, context)).toEqual({ status: "ok", value: { state: "not-found" } })
  const saved = await port.write(request, context)
  expect(saved.status).toBe("ok")
  if (saved.status !== "ok") throw new Error("Real result persistence required")
  expect(await port.readByRequest(lookup, context)).toEqual({ status: "ok", value: { state: "found", result: saved.value } })
  const byRef = { resultRef: saved.value.resultRef, kind: request.kind }
  expect(await port.read(byRef, context)).toEqual(saved)
  f.authority.ui.finish(context)
  const before = await stored(f)

  const foreign = await lease(f.authority, post(f, randomUUID(), profileB), "sf_scenario_compare", request)
  const foreignResult = await port.read(byRef, foreign)
  expect(foreignResult.status).not.toBe("ok")
  expect(foreignResult).not.toHaveProperty("value")
  const recovered = await port.readByRequest(lookup, foreign)
  expect(recovered.status).not.toBe("ok")
  expect(recovered).not.toHaveProperty("value")
  expect((await port.write(request, foreign)).status).not.toBe("ok")
  f.authority.ui.finish(foreign)
  expect(await stored(f)).toEqual(before)

  const retry = await lease(f.authority, post(f, randomUUID()), "sf_scenario_compare", request)
  expect(await port.write(request, retry)).toEqual(saved)
  expect(await port.readByRequest(lookup, retry)).toEqual({ status: "ok", value: { state: "found", result: saved.value } })
  await f.writeGrants([])
  expect((await port.readByRequest(lookup, retry)).status).not.toBe("ok")
  f.authority.ui.finish(retry)
  expect(await stored(f)).toEqual(before)
})

test("receipt-consumer: an actual legacy result receipt never becomes a Team not-found or a new write", async () => {
  const f = await fixture()
  const legacy = createSfProductAuthority({ ...f.options, teamProfiles: undefined })
  const decision = await seed(f, legacy), port = results(f, legacy), request = comparison(decision)
  const lookup = { caseRef: request.caseRef, kind: request.kind, idempotencyKey: request.idempotencyKey, requestDigest: request.requestDigest }
  const legacyContext = await lease(legacy, post(f, randomUUID()), "sf_scenario_compare", request)
  const saved = await port.write(request, legacyContext)
  expect(saved.status).toBe("ok")
  if (saved.status !== "ok") throw new Error("Real legacy result persistence required")
  expect(await port.readByRequest(lookup, legacyContext)).toEqual({ status: "ok", value: { state: "found", result: saved.value } })
  const before = await stored(f)
  const current = results(f), context = await lease(f.authority, post(f, randomUUID()), "sf_scenario_compare", request)
  const refused = await current.readByRequest(lookup, context)
  expect(refused.status).not.toBe("ok")
  expect(refused).not.toHaveProperty("value")
  expect((await current.write(request, context)).status).not.toBe("ok")
  expect(await stored(f)).toEqual(before)
  expect(await port.write(request, legacyContext)).toEqual(saved)
  expect(await stored(f)).toEqual(before)
  legacy.ui.finish(legacyContext)
  f.authority.ui.finish(context)
})

test("receipt-consumer: durable reservations keep their original actor and block unknown profile outcomes", async () => {
  const f = await fixture(), decision = await seed(f)
  const selected = { caseRef: ref(decision), changeId: "fixture-reserved-change", choiceId: "fixture-choice" }
  const source = post(f, randomUUID())
  const current = await f.authority.state.read(source, "cases", () => null)
  expect(current.status).toBe("ok")
  if (current.status !== "ok") throw new Error("Actual C08 read required")
  const reservation = { schema: "fixture-undelivered-reservation", effect: "unknown" }
  const saved = await f.authority.state.transaction(source, { namespace: "cases", expectedStorageVersion: current.storageVersion,
    targetRef: decision.id, targetIncarnation: decision.incarnation, idempotencyKey: applicationAttemptKey(selected),
    commandDigest: digestSfValue(reservation) }, async () => ({ commit: true, value: reservation }))
  expect(saved.status).toBe("ok")
  const before = await stored(f)
  const inspect = (profile: TeamProfile.Ref, cookie = f.cookie) => f.authority.state.read(f.businessRequest(profile, cookie), "cases", (state, authority) =>
    ({ attempts: applicationAttempts(state, selected, authority), blocksDispatch: hasApplicationAttempt(state, selected, authority) }))
  const first = await inspect(profileA)
  expect(first).toMatchObject({ status: "ok", value: { attempts: { status: "verified", entries: [{ principalRef: oid, value: reservation }] }, blocksDispatch: true } })
  const secondCookie = await f.login(other)
  const shared = await inspect(profileA, secondCookie)
  expect(shared).toMatchObject({ status: "ok", value: { attempts: { status: "verified", entries: [{ principalRef: oid, value: reservation }] }, blocksDispatch: true } })
  const foreign = await inspect(profileB)
  expect(foreign).toMatchObject({ status: "ok", value: { attempts: { status: "ambiguous" }, blocksDispatch: true } })
  if (foreign.status === "ok") expect(foreign.value.attempts).not.toHaveProperty("entries")
  expect(await stored(f)).toEqual(before)
  await f.writeGrants([])
  expect((await inspect(profileA)).status).toBe("denied")
  expect(await stored(f)).toEqual(before)
})
