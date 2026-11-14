import { expect, test } from "bun:test"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createDashboardSourceIssuer } from "../../../../product/integration/dashboard-sources.ts"
import { createSfAlternativeCallScope } from "../../../../../../../apps/cli/src/sucafina-product/alternative-call-scope.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

test("an invocation confines real proof reuse to its UTC day and rejects revocation during its final clock read", async () => {
  const clock = { at: "2026-11-14T12:00:00Z" }
  const fixture = await financialCompositionFixture({ clock }), call = await fixture.read()
  const { authority, business, persistence } = fixture
  const caseRef = { id: "daily-proof-case", incarnation: "daily-proof-incarnation", version: 1 }
  const period = { start: "2026-11-14", end: "2026-11-14" }
  try {
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.hotTopics = []
      return { commit: true, value: undefined }
    })
    const initial: DecisionCase = { ...caseRef, state: "comparing", objective: "Daily source proof", horizon: period, currency: "USD", criteria: [],
      participants: ["person"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seeded = await authority.state.transaction(fixture.request("daily-proof-case"), { namespace: "cases", expectedStorageVersion: 0,
      targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation,
      idempotencyKey: "daily-proof-case", commandDigest: digestSfValue(initial) }, async (state) => {
      state.cases[initial.id] = initial
      return { commit: true, value: true }
    })
    if (seeded.status !== "ok") throw new Error(`Case fixture unavailable: ${JSON.stringify(seeded)}`)
    const issue = createDashboardSourceIssuer({ host: authority.host, scopedSources: persistence })
    const selected = await issue({ page: "Hot Topics & Actions", fields: ["hotTopics"], period }, call)
    if (selected.status !== "ok") throw new Error(`Actual daily source unavailable: ${selected.reason}`)
    const scope = createSfAlternativeCallScope<BusinessEvidenceRef>({ authority, selectedCase: business.resolveCase, lockedSourceFences: business.lockedSourceFences })
    let reads = 0
    const produce = async (): Promise<PortResult<BusinessEvidenceRef>> => {
      reads += 1
      const current = await business.dashboardSources.resolveDashboardSource(selected.value.selectionRef, call)
      return current.status === "ok" ? { status: "ok", value: current.value.evidence } : current
    }
    const composed = await business.withCase(call, caseRef, {}, async () => {
      const reused = await scope.run(call, async () => {
        const fences = await business.readSourceFences(call)
        const before = await authority.state.read(fixture.request(), "cases", (state) => digestSfValue(state))
        expect((await scope.read(call, produce)).status).toBe("ok")
        clock.at = "2026-11-14T23:59:59Z"
        expect((await scope.read(call, produce)).status).toBe("ok")
        expect(reads).toBe(1)
        clock.at = "2026-11-15T00:00:00Z"
        expect(await authority.host.revalidate(call)).toBe(true)
        expect(await scope.read(call, produce)).toEqual({ status: "denied", reason: "source-unavailable" })
        expect(reads).toBe(2)
        expect(await business.readSourceFences(call)).toEqual(fences)
        expect(await authority.state.read(fixture.request(), "cases", (state) => digestSfValue(state))).toEqual(before)
        return { status: "ok", value: true }
      })
      expect(reused).toEqual({ status: "ok", value: true })
      clock.at = "2026-11-14T12:00:00Z"
      const changed = await scope.run(call, async () => {
        const changed = await scope.read(call, async () => {
          const value = await produce()
          expect(value.status).toBe("ok")
          clock.at = "2026-11-15T00:00:00Z"
          return value
        })
        expect(changed).toEqual({ status: "stale", reason: "alternative-call-proof-changed" })
        return { status: "ok", value: true }
      })
      expect(changed).toEqual({ status: "ok", value: true })
      return { status: "ok", value: true }
    })
    expect(composed).toEqual({ status: "ok", value: true })
    expect(reads).toBe(3)
    clock.at = "2026-11-14T12:00:00Z"
    const reached = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
    let armed = false, clockReads = 0
    const authorityAtClock = { ...authority, host: { ...authority.host, environment: async (request: Request) => {
      const environment = await authority.host.environment(request)
      if (armed && ++clockReads === 4) { reached.resolve(); await release.promise }
      return environment
    } } }
    const guarded = createSfAlternativeCallScope<BusinessEvidenceRef>({ authority: authorityAtClock, selectedCase: business.resolveCase,
      lockedSourceFences: business.lockedSourceFences })
    const revoked = await business.withCase(call, caseRef, {}, () => guarded.run(call, async () => {
      expect((await guarded.read(call, produce)).status).toBe("ok")
      const producedBefore = reads
      armed = true
      const pending = guarded.read(call, produce)
      try {
        await Promise.race([reached.promise, pending.then(() => { throw new Error("Proof reuse did not reach its final real environment read") })])
        fixture.active.value = false
        release.resolve()
        expect(await pending).toEqual({ status: "stale", reason: "alternative-call-proof-changed" })
        expect(reads).toBe(producedBefore)
        expect(clockReads).toBe(4)
        expect(await authority.host.revalidate(call)).toBe(false)
        return { status: "ok", value: true }
      } finally { release.resolve() }
    }))
    // Revocation tombstones the real UI admission; the invocation cannot
    // return its earlier successful value after that authority is gone.
    expect(revoked).toEqual({ status: "denied", reason: "alternative-call-authority-unavailable" })
  } finally { authority.ui.finish(call); await fixture.dispose() }
}, 120_000)

// R3-W13-ALT-FENCE-01: the final clock await must retain the actual C08
// snapshot. An independent writer is queued while that await is paused; it
// is never awaited by the callback that owns the SQLite read scope.
for (const mutation of ["case", "planner"] as const) {
  test(`Alternative final fence serializes an actual ${mutation} writer and rejects its changed proof`, async () => {
    const deadline = compositionTestDeadline(`alternative-final-fence.${mutation}`)
    try {
      const fixture = await financialCompositionFixture({ signal: deadline.signal, beforeEnvironment: async () => deadline.check() })
      deadline.own(() => fixture.dispose())
      const { authority, business, persistence } = fixture
      const call = await fixture.read()
      deadline.own(() => authority.ui.finish(call))
      const caseRef = { id: "serialized-case", incarnation: "serialized-incarnation", version: 1 }
      const initial: DecisionCase = { ...caseRef, state: "comparing", objective: "Serialized Planner proof", horizon: { start: "2026-01-01", end: "2026-12-31" },
        currency: "USD", criteria: [], participants: ["person"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [],
        questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
      const seeded = await authority.state.transaction(fixture.request("serialized-case"), { namespace: "cases", expectedStorageVersion: 0,
        targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "serialized-case", commandDigest: digestSfValue(initial) },
      async (state) => { state.cases[initial.id] = initial; return { commit: true, value: true } })
      if (seeded.status !== "ok") throw new Error(`Case fixture unavailable: ${JSON.stringify(seeded)}`)
      await persistence.transaction("planner", async (snapshot) => {
        snapshot.data.versions = [{ id: "serialized-forecast", name: "Before writer", year: 2026, closed: 0,
          lines: [{ id: "line", name: "Service", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(100) }],
          fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
        return { commit: true, value: undefined }
      })
      const issued = await business.plannerProduct.issueSource("serialized-forecast", call)
      if (issued.status !== "ok") throw new Error(`Real Planner source unavailable: ${issued.reason}`)
      const reached = Promise.withResolvers<void>(), release = Promise.withResolvers<void>(), written = Promise.withResolvers<void>()
      const secondReturned = Promise.withResolvers<void>()
      let armed = false, clockReads = 0, produced = 0, enteredWriter = false
      let heldSources: ReturnType<typeof business.lockedSourceFences>
      const observed = { ...authority, host: { ...authority.host, environment: async (request: Request) => {
        const environment = await authority.host.environment(request)
        if (armed && ++clockReads === 4) {
          heldSources = business.lockedSourceFences()
          reached.resolve()
          await release.promise
        }
        return environment
      } } }
      const scope = createSfAlternativeCallScope<BusinessEvidenceRef>({ authority: observed, selectedCase: business.resolveCase, lockedSourceFences: business.lockedSourceFences })
      const produce = async (): Promise<PortResult<BusinessEvidenceRef>> => {
        produced++
        const current = await business.plannerSources.resolveForecastSource(issued.value.evidence.refId, call)
        return current.status === "ok" ? { status: "ok", value: current.value.evidence } : current
      }
      const pending = deadline.phase("proof-and-queued-write", () => business.withCase(call, caseRef, {}, () => scope.run(call, async () => {
        expect(await scope.read(call, produce)).toEqual({ status: "ok", value: issued.value.evidence })
        armed = true
        expect(await scope.read(call, produce)).toEqual({ status: "ok", value: issued.value.evidence })
        expect(produced).toBe(1)
        secondReturned.resolve()
        await written.promise
        // The same lexical holder must not reuse its completed value after the
        // writer has committed, even though the general UI admission is valid.
        expect((await scope.read(call, produce)).status).not.toBe("ok")
        expect(produced).toBe(mutation === "case" ? 1 : 2)
        return { status: "ok", value: true }
      })))
      let writer: Promise<unknown> | undefined
      try {
        await Promise.race([reached.promise, pending.then(() => { throw new Error("Actual proof did not reach its final environment await") })])
        // This continuation was created outside the held C08/lexical context.
        // It uses the actual store queue, not a nested read or a simulated lock.
        writer = mutation === "case" ? fixture.store.transaction("dashboard", async (snapshot) => {
          enteredWriter = true
          (snapshot.data.__sfProductV1 as SfProductState).cases[caseRef.id]!.participants = []
          return { commit: true, value: undefined }
        }) : persistence.transaction("planner", async (snapshot) => {
          enteredWriter = true
          const versions = snapshot.data.versions as { id: string; lines: { b: number[]; f: number[] }[] }[]
          const line = versions.find((version) => version.id === "serialized-forecast")!.lines[0]!
          line.b[0] = 200
          line.f[0] = 200
          return { commit: true, value: undefined }
        })
        // Yield a real event-loop turn so an unlocked writer could enter. The
        // before-fix code releases C08 before reaching this gate and fails here.
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
        expect(enteredWriter).toBe(false)
        expect(heldSources).toBeDefined()
        expect(clockReads).toBe(4)
        release.resolve()
        await Promise.race([secondReturned.promise, pending.then(() => { throw new Error("Authorized serialized reader did not finish") })])
        await writer
        expect(enteredWriter).toBe(true)
        expect(fixture.active.value).toBe(true)
        expect(await authority.host.revalidate(call)).toBe(true)
        written.resolve()
        expect(await pending).toEqual({ status: "ok", value: true })
      } finally {
        release.resolve()
        written.resolve()
        await Promise.allSettled([pending, ...(writer ? [writer] : [])])
      }
    } finally { await deadline.close() }
  }, 120_000)
}
