import { expect, test } from "bun:test"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createDashboardSourceIssuer } from "../../../../product/integration/dashboard-sources.ts"
import { createSfAlternativeCallScope } from "../../../../../../../apps/cli/src/sucafina-product/alternative-call-scope.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"

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
    expect(revoked).toEqual({ status: "ok", value: true })
  } finally { authority.ui.finish(call); await fixture.dispose() }
}, 120_000)

test("alternative proof refuses overlapping and reentrant callers while its real owner retains the completed proof", async () => {
  const fixture = await financialCompositionFixture(), call = await fixture.read()
  const { authority, business, persistence } = fixture
  const caseRef = { id: "lexical-proof-case", incarnation: "lexical-proof-incarnation", version: 1 }
  const period = { start: "2026-11-14", end: "2026-11-14" }
  try {
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.hotTopics = []; return { commit: true, value: undefined } })
    const initial: DecisionCase = { ...caseRef, state: "comparing", objective: "Lexical source proof", horizon: period, currency: "USD", criteria: [],
      participants: ["person"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seeded = await authority.state.transaction(fixture.request("lexical-proof-case"), { namespace: "cases", expectedStorageVersion: 0,
      targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation,
      idempotencyKey: "lexical-proof-case", commandDigest: digestSfValue(initial) }, async (state) => {
      state.cases[initial.id] = initial
      return { commit: true, value: true }
    })
    if (seeded.status !== "ok") throw new Error(`Case fixture unavailable: ${JSON.stringify(seeded)}`)
    const issue = createDashboardSourceIssuer({ host: authority.host, scopedSources: persistence })
    const selected = await issue({ page: "Hot Topics & Actions", fields: ["hotTopics"], period }, call)
    if (selected.status !== "ok") throw new Error(`Actual source unavailable: ${selected.reason}`)
    const scope = createSfAlternativeCallScope<BusinessEvidenceRef>({ authority, selectedCase: business.resolveCase, lockedSourceFences: business.lockedSourceFences })
    let reads = 0
    const produce = async (): Promise<PortResult<BusinessEvidenceRef>> => {
      reads += 1
      const current = await business.dashboardSources.resolveDashboardSource(selected.value.selectionRef, call)
      return current.status === "ok" ? { status: "ok", value: current.value.evidence } : current
    }
    const ready = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
    const pending = business.withCase(call, caseRef, {}, () => scope.run(call, async () => {
      const first = await scope.read(call, produce)
      expect(first.status).toBe("ok")
      expect(await scope.run(call, async () => { throw new Error("Reentrant alternative work must not execute") }))
        .toEqual({ status: "denied", reason: "alternative-call-authority-unavailable" })
      ready.resolve()
      await release.promise
      const again = await scope.read(call, produce)
      expect(again).toEqual(first)
      if (again.status === "ok" && first.status === "ok") expect(again.value).not.toBe(first.value)
      expect(reads).toBe(1)
      return { status: "ok", value: true }
    }))
    try {
      await Promise.race([ready.promise, pending.then(() => { throw new Error("Alternative owner did not reach its completed proof") })])
      // Both reads share valid domain authority and a real case. They still
      // cannot borrow a proof completed by another lexical invocation.
      const overlaps = await Promise.all([scope.read(call, produce), scope.read(call, produce)])
      for (const result of overlaps) {
        expect(result).toEqual({ status: "denied", reason: "alternative-call-authority-unavailable" })
        expect(result).not.toHaveProperty("value")
      }
      expect(reads).toBe(1)
      release.resolve()
      expect(await pending).toEqual({ status: "ok", value: true })
    } finally { release.resolve(); await pending }
  } finally { authority.ui.finish(call); await fixture.dispose() }
}, 120_000)

