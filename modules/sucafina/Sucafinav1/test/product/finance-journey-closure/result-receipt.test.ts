import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import type { SfProductState } from "../../../product/contracts/state.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"

// A producer persistence proof: real C08/SQLite, explicitly synthetic grants,
// and the same valid comparison shape as wp11/result-store.test.ts. This does
// not claim native authority, source completeness, or the renewal journey.
const request = {
  kind: "comparison",
  result: { baselineResultRef: "base", alternativeResultRef: "result", costCoverageRefs: ["coverage"], criterionResults: [], unresolvedConditions: ["training:missing-category"], comparisonStatus: "conditioned", knownDifference: 30000, completeDifference: null },
  caseRef: { id: "case", incarnation: "inc", version: 1 },
  requestDigest: "b".repeat(64), sourceRefs: [], idempotencyKey: "operation",
} as const
const lookup = { caseRef: request.caseRef, kind: request.kind, idempotencyKey: request.idempotencyKey, requestDigest: request.requestDigest }
const receiptKey = JSON.stringify(["principal", "cases", "case", "decision-result:operation"])

async function receiptFixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-finance-receipt-"))
  await chmod(directory, 0o700)
  let db = await openLocalStore(directory)
  const access = { allowed: true, case: true, sources: true }
  const identity = { next: 0, authority: 0 }
  const admit = () => {
    const epoch = ++identity.authority
    const lifetime = { open: true }
    const source = new Request("https://example.test/result-receipt")
    const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: `request-${epoch}`, policyVersion: "policy", accessRevision: `access-${epoch}`, expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    const host = { requestFor: (candidate: TrustedDomainContext) => lifetime.open && candidate === context ? source : undefined, revalidate: async (candidate: TrustedDomainContext) => lifetime.open && access.allowed && candidate === context }
    const state = createSfProductState({ persistence: db, createId: () => "state", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async (incoming) => lifetime.open && access.allowed && incoming === source ? context.binding : undefined })
    const results = createSfDecisionResultStore({
      state, host,
      authorizeCase: async (decision, trusted) => access.case && decision.participants.includes(trusted.binding.principalRef),
      verifySources: async (_value, refs) => access.sources && refs.length === 0,
      createId: () => `result-${++identity.next}`, now: () => "2026-11-13T00:00:00Z",
    })
    return { source, context, host, state, results, retire: () => { lifetime.open = false } }
  }
  let authority = admit()
  const seeded = await authority.state.transaction(authority.source, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed", commandDigest: "a".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (state) => {
    state.cases.case = { id: "case", incarnation: "inc", version: 1, state: "draft", objective: "decision", currency: "USD", horizon: { start: "2027-01-01", end: "2027-12-31" }, criteria: [], participants: ["principal"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error("Receipt fixture could not seed the real state")
  return {
    access, authority,
    editPersisted: async (edit: (state: SfProductState) => void) => {
      const changed = await db.transaction("dashboard", async (snapshot) => {
        edit(snapshot.data.__sfProductV1 as SfProductState)
        return { commit: true, value: true }
      })
      if (!changed) throw new Error("Persisted corruption probe did not commit")
    },
    reopen: async () => {
      authority.retire()
      await db.dispose()
      db = await openLocalStore(directory)
      authority = admit()
      return authority
    },
    cleanup: async () => {
      authority.retire()
      await db.dispose()
      await rm(directory, { recursive: true, force: true })
    },
  }
}

test("FIN-IND-005 result receipt avoids duplicating the durable body while preserving authorized retries", async () => {
  const fixture = await receiptFixture()
  try {
    const current = fixture.authority
    const created = await current.results.write(request, current.context)
    expect(created.status).toBe("ok")
    if (created.status !== "ok") throw new Error(created.reason)
    expect(await current.results.readByRequest(lookup, current.context)).toEqual({ status: "ok", value: { state: "found", result: created.value } })
    expect(await current.results.write(request, current.context)).toEqual(created)
    expect((await current.results.write({ ...request, requestDigest: "c".repeat(64) }, current.context)).status).toBe("conflict")
    expect((await current.results.readByRequest({ ...lookup, requestDigest: "c".repeat(64) }, current.context)).status).toBe("conflict")
    fixture.access.sources = false
    expect((await current.results.readByRequest(lookup, current.context)).status).toBe("denied")
    fixture.access.sources = true
    const saved = await current.state.read(current.source, "cases", (state) => ({ record: state.decisionResults?.[created.value.resultRef], count: Object.keys(state.decisionResults ?? {}).length, receipt: state.transactions[receiptKey]?.value }))
    if (saved.status !== "ok" || !saved.value.receipt || typeof saved.value.receipt !== "object") throw new Error("Durable result receipt unavailable")
    expect(saved.value.record).toEqual(created.value)
    expect(saved.value.count).toBe(1)
    console.info(JSON.stringify({ phase: "finance-result-receipt", canonicalBytes: JSON.stringify(created.value).length, receiptBytes: JSON.stringify(saved.value.receipt).length, duplicateBody: "result" in saved.value.receipt }))
    // This discriminant is intentionally red on the prior full-copy producer.
    expect("result" in saved.value.receipt).toBe(false)
    expect(JSON.stringify(saved.value.receipt).length).toBeLessThan(JSON.stringify(created.value).length)
  } finally { await fixture.cleanup() }
}, 120000)

test("FIN-IND-005 result receipt retains legacy replay and rejects corrupt or revoked reads after SQLite reopen", async () => {
  const fixture = await receiptFixture()
  try {
    const original = fixture.authority
    const created = await original.results.write(request, original.context)
    if (created.status !== "ok") throw new Error(created.reason)
    // Emulate a persisted pre-upgrade receipt, preserving its actual full body.
    await fixture.editPersisted((state) => { state.transactions[receiptKey]!.value = structuredClone(created.value) })
    const current = await fixture.reopen()
    expect(await original.host.revalidate(original.context)).toBe(false)
    expect(current.source).not.toBe(original.source)
    expect(current.context.lease).not.toBe(original.context.lease)
    expect(current.context.binding.accessRevision).not.toBe(original.context.binding.accessRevision)
    expect(await current.results.readByRequest(lookup, current.context)).toEqual({ status: "ok", value: { state: "found", result: created.value } })
    expect(await current.results.write(request, current.context)).toEqual(created)
    const legacy = await current.state.read(current.source, "cases", (state) => state.transactions[receiptKey]!.value)
    expect(legacy.status === "ok" ? legacy.value : undefined).toEqual(created.value)

    const nextRequest = { ...request, idempotencyKey: "new-after-reopen" }
    const nextLookup = { ...lookup, idempotencyKey: nextRequest.idempotencyKey }
    const next = await current.results.write(nextRequest, current.context)
    if (next.status !== "ok") throw new Error(next.reason)
    expect(next.value.resultRef).not.toBe(created.value.resultRef)
    const restore = () => fixture.editPersisted((state) => { state.decisionResults![next.value.resultRef] = structuredClone(next.value) })
    // An unchanged monetary body cannot excuse a changed durable envelope.
    await fixture.editPersisted((state) => { state.decisionResults![next.value.resultRef] = { ...next.value, createdAt: "2026-11-14T00:00:00Z" } })
    expect((await current.results.readByRequest(nextLookup, current.context)).status).toBe("conflict")
    await restore()
    // Recomputing the producer-result hash alone must not rewrite the receipt.
    await fixture.editPersisted((state) => {
      const record = structuredClone(next.value)
      if (record.kind !== "comparison") throw new Error("Expected the fixture comparison")
      record.result.knownDifference = 999999
      record.resultDigest = digestSfValue(record.result)
      state.decisionResults![record.resultRef] = record
    })
    expect((await current.results.readByRequest(nextLookup, current.context)).status).toBe("conflict")
    await restore()
    await fixture.editPersisted((state) => { delete state.decisionResults![next.value.resultRef] })
    expect((await current.results.readByRequest(nextLookup, current.context)).status).toBe("unavailable")
    await restore()
    expect(await current.results.readByRequest(nextLookup, current.context)).toEqual({ status: "ok", value: { state: "found", result: next.value } })

    const restarted = await fixture.reopen()
    expect(await current.host.revalidate(current.context)).toBe(false)
    expect(await restarted.results.readByRequest(nextLookup, restarted.context)).toEqual({ status: "ok", value: { state: "found", result: next.value } })
    fixture.access.case = false
    expect((await restarted.results.readByRequest(nextLookup, restarted.context)).status).toBe("denied")
    fixture.access.case = true
    fixture.access.sources = false
    expect((await restarted.results.readByRequest(nextLookup, restarted.context)).status).toBe("denied")
    fixture.access.sources = true
    fixture.access.allowed = false
    expect((await restarted.results.readByRequest(nextLookup, restarted.context)).status).toBe("denied")
  } finally { await fixture.cleanup() }
}, 120000)

