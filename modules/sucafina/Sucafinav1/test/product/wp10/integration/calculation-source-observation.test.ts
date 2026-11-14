import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import type { AssetPersistence } from "../../../../runtime/assets.ts"
import type { Snapshot, TransactionOptions } from "../../../../runtime/contract.ts"
import type { Surface } from "../../../../src/identity.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import { createSfPlannerSourceHost } from "../../../../product/integration/planner-sources.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import type { SfScopedSourcePort, SfSourceScope } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"

type Fixture = Awaited<ReturnType<typeof financialCompositionFixture>>
type PreparedRead = (
  surface: Surface,
  prepare: (snapshot: Snapshot) => Promise<{ scope: SfSourceScope; authorize: (snapshot: Snapshot) => Promise<boolean> } | undefined>,
  options?: TransactionOptions,
) => ReturnType<SfScopedSourcePort["readScopedSource"]>
type PreparedPort = SfScopedSourcePort & { readScopedSourcePrepared?: PreparedRead }

/**
 * WP10 owner-intake gate over the real SQLite/source/authority implementation.
 * Wrappers count and delegate; they do not implement source or financial logic.
 * The prepared CI request uses the existing 120000ms default; no timing oracle.
 */
test("Planner source consolidation retains fresh authority and ABA fences with two source transactions", async () => {
  const fixture = await financialCompositionFixture()
  try {
    const call = await fixture.read()
    try {
      await setPlannerAmount(fixture, 80)
      const issued = await fixture.business.plannerProduct.issueSource("v0", call)
      if (issued.status !== "ok") throw new Error(`Actual source issuance failed: ${issued.status}/${issued.reason}`)
      const fallback = observeSource(fixture, call, "fallback")
      const candidate = observeSource(fixture, call, "candidate")
      const before = await inspectDurableState(fixture)
      const original = await fallback.read("fallback", issued.value.evidence.refId)
      const first = await candidate.read("candidate-first", issued.value.evidence.refId)
      // Reuse this exact resolver and context to expose an improper cache
      // retained by the candidate between invocations.
      const second = await candidate.read("candidate-second", issued.value.evidence.refId)
      expect(original.result).toEqual(issued)
      expect(first.result).toEqual(original.result)
      expect(second.result).toEqual(original.result)
      expect(digestSfValue(first.result)).toBe(digestSfValue(original.result))
      expect(digestSfValue(second.result)).toBe(digestSfValue(original.result))
      expect(original.counts).toMatchObject({
        sourceTransactions: 4, authenticate: 6, revalidate: 4, legacyReads: 2, preparedReads: 0,
      })
      for (const observation of [first, second]) expect(observation.counts).toMatchObject({
        sourceTransactions: 2, authenticate: 6, revalidate: 4, legacyReads: 0, preparedReads: 2,
      })
      expect(await inspectDurableState(fixture)).toEqual(before)

      // The first source transaction has closed before revalidation #2.
      // Actual lifecycle writes must preserve the A -> B -> A revision fence.
      const aba = await candidate.read("candidate-source-aba", issued.value.evidence.refId, async (count) => {
        if (count !== 2) return
        await setPlannerAmount(fixture, 81)
        await setPlannerAmount(fixture, 80)
      })
      expect(aba.result.status).toBe("stale")
      expect(Object.hasOwn(aba.result, "value")).toBe(false)
      const reissued = await fixture.business.plannerProduct.issueSource("v0", call)
      if (reissued.status !== "ok") throw new Error(`Actual source reissuance failed: ${reissued.status}/${reissued.reason}`)
      expect(reissued.value.evidence.target.projectionDigest).toBe(issued.value.evidence.target.projectionDigest)
      expect(reissued.value.evidence.target.incarnation).toBe(issued.value.evidence.target.incarnation)
      expect(reissued.value.evidence.target.version).toBeGreaterThan(issued.value.evidence.target.version)

      const beforeRevocation = await inspectDurableState(fixture)
      // Both source observations complete. Revoke the real authenticator at
      // the final external revalidation with the original Request and context.
      const revoked = await candidate.read("candidate-egress-revoked", reissued.value.evidence.refId, async (count) => {
        if (count === 4) fixture.active.value = false
      })
      expect(revoked.counts).toMatchObject({
        sourceTransactions: 2, authenticate: 6, revalidate: 4, preparedReads: 2,
      })
      expect(revoked.result.status).toBe("stale")
      expect(Object.hasOwn(revoked.result, "value")).toBe(false)
      const denied = await candidate.read("candidate-next-invocation-denied", reissued.value.evidence.refId)
      expect(denied.result.status).toBe("denied")
      expect(Object.hasOwn(denied.result, "value")).toBe(false)
      expect(denied.counts).toMatchObject({
        sourceTransactions: 0, authenticate: 0, revalidate: 1, preparedReads: 0,
      })
      expect(await inspectDurableState(fixture)).toEqual(beforeRevocation)
    } finally { fixture.authority.ui.finish(call) }
  } finally { await fixture.dispose() }
})

test("Planner prepared source observation refuses abort after the last source authorizer without durable change", async () => {
  const controller = new AbortController()
  const fixture = await financialCompositionFixture({ signal: controller.signal })
  try {
    const call = await fixture.read()
    try {
      await setPlannerAmount(fixture, 80)
      const issued = await fixture.business.plannerProduct.issueSource("v0", call)
      if (issued.status !== "ok") throw new Error(`Actual source issuance failed: ${issued.status}/${issued.reason}`)
      const candidate = observeSource(fixture, call, "candidate")
      const before = await inspectDurableState(fixture)
      // Authentication #3 is observe's second authorizer in stage current.
      // Delegate the real authentication before aborting the original Request.
      const aborted = await candidate.read("candidate-abort-at-authorizer-egress", issued.value.evidence.refId, undefined, async (count) => {
        if (count === 3) controller.abort(new Error("diagnostic-source-authorizer-abort"))
      })
      expect(controller.signal.aborted).toBe(true)
      expect(aborted.counts).toMatchObject({
        sourceTransactions: 1, authenticate: 3, revalidate: 1, preparedReads: 1,
      })
      expect(aborted.result.status).toBe("denied")
      expect(Object.hasOwn(aborted.result, "value")).toBe(false)
      expect(await inspectDurableState(fixture)).toEqual(before)
    } finally { fixture.authority.ui.finish(call) }
  } finally { await fixture.dispose() }
})

function observeSource(fixture: Fixture, call: TrustedDomainContext, mode: "fallback" | "candidate") {
  const counts = {
    sourceTransactions: 0, authenticate: 0, revalidate: 0, legacyReads: 0, preparedReads: 0,
    transactionMs: 0, maximumTransactionMs: 0, beforeCallbackMs: 0, callbackMs: 0, notAdmitted: 0,
  }
  const hook: {
    beforeRevalidate?: (count: number) => Promise<void>
    afterAuthenticate?: (count: number) => Promise<void>
  } = {}
  const transaction: AssetPersistence["transaction"] = async (surface, work, options) => {
    counts.sourceTransactions++
    const started = performance.now()
    let entered = false
    try {
      return await fixture.store.transaction(surface, async (snapshot, blobs) => {
        const callbackStart = performance.now()
        entered = true
        // Includes queue/admission/open/BEGIN/decode; not an exclusive lock timer.
        counts.beforeCallbackMs += callbackStart - started
        try { return await work(snapshot, blobs) }
        finally { counts.callbackMs += performance.now() - callbackStart }
      }, options)
    } finally {
      const elapsed = performance.now() - started
      counts.transactionMs += elapsed
      counts.maximumTransactionMs = Math.max(counts.maximumTransactionMs, elapsed)
      if (!entered) counts.notAdmitted++
    }
  }
  // Same SQLite, canonical lifecycle/projector. The real authority retains its
  // original persistence closure, excluding its own transactions from this count.
  const persistence = createSfSourcePersistence({
    persistence: { ...fixture.store, transaction },
    enumerate: enumerateSfSources, createId: randomUUID,
    projectScope: createSfSourceScopeProjector(() => fixture.clock.at),
  })
  const capability: unknown = Reflect.get(persistence, "readScopedSourcePrepared")
  if (typeof capability !== "function") throw new Error("OWNER_PATCH_NOT_APPLIED: readScopedSourcePrepared is unavailable")
  const prepared = capability as PreparedRead
  const sources: PreparedPort = {
    resolveScopedSource: persistence.resolveScopedSource,
    readScopedSource: (surface, scope, authorize) => {
      counts.legacyReads++
      return persistence.readScopedSource(surface, scope, authorize)
    },
    ...(persistence.checkScopedSource ? { checkScopedSource: persistence.checkScopedSource } : {}),
  }
  if (mode === "candidate") sources.readScopedSourcePrepared = (surface, prepare, options) => {
    counts.preparedReads++
    return prepared(surface, prepare, options)
  }
  const host: Parameters<typeof createSfPlannerSourceHost>[0]["host"] = {
    ...fixture.authority.host, persistence,
    authenticate: async (request, context) => {
      counts.authenticate++
      const principal = await fixture.authority.host.authenticate(request, context)
      await hook.afterAuthenticate?.(counts.authenticate)
      return principal
    },
    revalidate: async (context) => {
      counts.revalidate++
      await hook.beforeRevalidate?.(counts.revalidate)
      return fixture.authority.host.revalidate(context)
    },
  }
  const resolver = createSfPlannerSourceHost({
    host, scopedSources: sources, coverageFor: fixture.business.plannerSources.resolveForecastCoverage,
  })
  return {
    read: async (
      phase: string, reference: string,
      beforeRevalidate?: (count: number) => Promise<void>,
      afterAuthenticate?: (count: number) => Promise<void>,
    ) => {
      Object.assign(counts, {
        sourceTransactions: 0, authenticate: 0, revalidate: 0, legacyReads: 0, preparedReads: 0,
        transactionMs: 0, maximumTransactionMs: 0, beforeCallbackMs: 0, callbackMs: 0, notAdmitted: 0,
      })
      hook.beforeRevalidate = beforeRevalidate
      hook.afterAuthenticate = afterAuthenticate
      const started = performance.now()
      const outcome: { status?: string } = {}
      try {
        const result = await resolver.resolveForecastSource(reference, call)
        outcome.status = result.status
        return { result, counts: { ...counts } }
      } finally {
        hook.beforeRevalidate = undefined
        hook.afterAuthenticate = undefined
        console.info("SF_CALCULATION_SOURCE_OBSERVATION", JSON.stringify({
          phase, mode, ...counts, status: outcome.status ?? "threw", elapsedMs: performance.now() - started,
        }))
      }
    },
  }
}

async function setPlannerAmount(fixture: Fixture, amount: number) {
  await fixture.persistence.transaction("planner", async (snapshot) => {
    snapshot.data.versions = [{
      id: "v0", name: "Source observation diagnostic", year: 2026, closed: 0,
      lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD",
        b: Array(12).fill(amount), a: Array(12).fill(null), f: Array(12).fill(amount) }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {},
    }]
    return { commit: true, value: undefined }
  })
}

async function inspectDurableState(fixture: Fixture) {
  const surfaces = ["dashboard", "planner", "procurement"] as const
  return Promise.all(surfaces.map((surface) => fixture.store.transaction(
    surface, async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }),
  )))
}
