import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { DecisionCasePort, DomainPortHost, PortResult } from "../../../../product/contracts/ports.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { createSfPlannerCaseReadScope } from "../../../../../../../apps/cli/src/sucafina-product/planner-case-read-scope.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

function ok<T>(result: PortResult<T>, label: string): T {
  if (result.status !== "ok") throw new Error(`${label}: ${JSON.stringify(result)}`)
  return result.value
}

// Real SQLite, scoped Planner source, C08 case and consumed UI authority. The
// empty case and source rows are fixtures; no financial result is synthesized.
// The WP12 native scenario acceptance covers promoted alternatives and replay.
async function prepare(deadline: ReturnType<typeof compositionTestDeadline>) {
  const cancellation = new AbortController()
  const fixture = await financialCompositionFixture({ signal: AbortSignal.any([deadline.signal, cancellation.signal]),
    beforeEnvironment: async () => deadline.check() })
  deadline.own(() => fixture.dispose())
  await fixture.persistence.transaction("planner", async (snapshot) => {
    snapshot.data.versions = [{ id: "case-source", name: "Current Planner source", year: 2026, closed: 0,
      lines: [{ id: "line", name: "Recorded service", sec: "opex", el: "licenses", cur: "USD",
        b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(100) }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
    return { commit: true, value: undefined }
  })
  await fixture.persistence.initializeSources("planner")
  const call = await fixture.read()
  deadline.own(() => fixture.authority.ui.finish(call))
  const source = ok(await fixture.business.plannerProduct.issueSource("case-source", call), "Issue actual Planner source")
  const caseRef = { id: "case-proof", incarnation: "case-proof-incarnation", version: 1 }
  const initial: DecisionCase = { ...caseRef, state: "draft", objective: "Inspect current recorded costs", currency: "USD",
    horizon: { start: "2026-01-01", end: "2026-12-31" }, criteria: [{ id: "cost", description: "Preserve complete coverage", required: true }],
    participants: ["person"], sourceRefs: [source.evidence], alternatives: [], costCoverageBases: [], assumptions: [], questions: [],
    choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const seeded = await fixture.authority.state.transaction(fixture.request("case-proof-empty"), { namespace: "cases", expectedStorageVersion: 0,
    targetRef: fixture.authority.creationTarget.ref, targetIncarnation: fixture.authority.creationTarget.incarnation,
    idempotencyKey: "case-proof-empty", commandDigest: digestSfValue(initial) }, async (state) => {
    state.cases[initial.id] = initial
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error(`Empty case unavailable: ${JSON.stringify(seeded)}`)
  const counts = { canonical: 0 }
  const read: DecisionCasePort["read"] = async (...args) => { counts.canonical++; return fixture.business.cases.read(...args) }
  const scope = (host: DomainPortHost = fixture.business.host) => createSfPlannerCaseReadScope({
    host, state: fixture.authority.state, read, sources: fixture.business.plannerSources,
    readerIdentity: () => fixture.business.evidence.current, lockedSourceFences: fixture.business.lockedSourceFences,
  })
  return { ...fixture, cancellation, call, caseRef, argument: { caseRef: encodeCaseRef(caseRef) },
    selection: { caseRef, alternatives: [] }, counts, scope }
}

test("Planner case proof keeps one canonical read per invocation, isolates returned clones and closes lexical ownership", async () => {
  const deadline = compositionTestDeadline("planner-case-proof-owner")
  try {
    const fixture = await prepare(deadline), scope = fixture.scope()
    for (const iteration of [1, 2]) {
      const result = await scope.run(fixture.selection, fixture.call, async () => {
        const first = ok(await scope.read(fixture.argument, fixture.call), "Canonical case")
        expect(first.case.criteria).toHaveLength(1)
        first.case.objective = "Changed only by the caller"
        const second = ok(await scope.read(fixture.argument, fixture.call), "Completed case proof")
        expect(second.case.objective).toBe("Inspect current recorded costs")
        expect(second.case).not.toBe(first.case)
        expect(second.evidenceRefs[0]).not.toBe(first.evidenceRefs[0])
        expect(fixture.counts.canonical).toBe(iteration)
        return { status: "ok", value: true }
      })
      expect(result).toEqual({ status: "ok", value: true })
    }
    const reached = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
    const pending = scope.run(fixture.selection, fixture.call, async () => {
      expect((await scope.read(fixture.argument, fixture.call)).status).toBe("ok")
      reached.resolve()
      await release.promise
      return { status: "ok", value: true }
    })
    try {
      await Promise.race([reached.promise, pending.then(() => { throw new Error("Canonical case did not reach its ownership boundary") })])
      expect(await scope.read(fixture.argument, fixture.call)).toEqual({ status: "denied", reason: "scenario-case-invocation-unavailable" })
      expect(await scope.run(fixture.selection, fixture.call, async () => ({ status: "ok", value: true })))
        .toEqual({ status: "denied", reason: "scenario-case-already-active" })
      expect(fixture.counts.canonical).toBe(3)
    } finally { release.resolve() }
    expect(await pending).toEqual({ status: "ok", value: true })
    expect((await scope.read(fixture.argument, fixture.call)).status).toBe("ok")
    expect(fixture.counts.canonical).toBe(4)
  } finally { await deadline.close() }
}, 120_000)

for (const boundary of ["day", "request", "input", "reader", "actor", "lease", "abort"] as const) {
  test(`Planner case proof refuses ${boundary} changes after the completed canonical read`, async () => {
    const deadline = compositionTestDeadline(`planner-case-proof-${boundary}`)
    try {
      const fixture = await prepare(deadline), scope = fixture.scope()
      const result = await scope.run(fixture.selection, fixture.call, async () => {
        expect((await scope.read(fixture.argument, fixture.call)).status).toBe("ok")
        if (boundary === "day") fixture.clock.at = "2026-11-15T00:00:00Z"
        if (boundary === "request") fixture.authority.host.requestFor(fixture.call)!.headers.set("x-proof-change", "changed")
        if (boundary === "input") fixture.selection.caseRef.version++
        if (boundary === "reader") fixture.business.evidence.current = undefined
        if (boundary === "actor") fixture.active.value = false
        if (boundary === "lease") fixture.authority.ui.finish(fixture.call)
        if (boundary === "abort") fixture.cancellation.abort(new Error("Real Request cancellation"))
        const changed = await scope.read(fixture.argument, fixture.call)
        expect(changed).toEqual(boundary === "day" ? { status: "stale", reason: "scenario-source-changed" }
          : { status: "denied", reason: "case-access-unavailable" })
        expect(changed).not.toHaveProperty("value")
        expect(fixture.counts.canonical).toBe(1)
        return changed
      })
      expect(result.status).toBe(boundary === "day" ? "stale" : "denied")
    } finally { await deadline.close() }
  }, 120_000)
}

for (const mutation of ["source", "case"] as const) {
  test(`Planner case proof detects unversioned ${mutation} changes in complete protected snapshots`, async () => {
    const deadline = compositionTestDeadline(`planner-case-proof-${mutation}`)
    try {
      const fixture = await prepare(deadline), scope = fixture.scope()
      const result = await scope.run(fixture.selection, fixture.call, async () => {
        expect((await scope.read(fixture.argument, fixture.call)).status).toBe("ok")
        const original = await fixture.authority.state.read(fixture.request(), "cases", (state) => ({ revision: state.revision, version: state.versions.cases }))
        await fixture.store.transaction(mutation === "source" ? "planner" : "dashboard", async (snapshot) => {
          if (mutation === "source") {
            const versions = snapshot.data.versions as { lines: { f: number[] }[] }[]
            versions[0]!.lines[0]!.f[0] = 101
          }
          if (mutation === "case") (snapshot.data.__sfProductV1 as SfProductState).cases[fixture.caseRef.id]!.objective = "Changed without a case revision"
          return { commit: true, value: undefined }
        })
        expect(await fixture.authority.state.read(fixture.request(), "cases", (state) => ({ revision: state.revision, version: state.versions.cases }))).toEqual(original)
        expect(await fixture.authority.host.revalidate(fixture.call)).toBe(true)
        const changed = await scope.read(fixture.argument, fixture.call)
        expect(changed).toEqual({ status: "stale", reason: "scenario-source-changed" })
        expect(changed).not.toHaveProperty("value")
        expect(fixture.counts.canonical).toBe(1)
        return changed
      })
      expect(result.status).toBe("stale")
    } finally { await deadline.close() }
  }, 120_000)
}

test("Planner case proof rechecks real lease ownership after its final asynchronous authority response", async () => {
  const deadline = compositionTestDeadline("planner-case-proof-egress")
  try {
    const fixture = await prepare(deadline), marker = { armed: false }
    const scope = fixture.scope({ ...fixture.business.host, revalidate: async (call) => {
      const allowed = await fixture.business.host.revalidate(call)
      if (marker.armed) fixture.authority.ui.finish(call)
      return allowed
    } })
    const result = await scope.run(fixture.selection, fixture.call, async () => {
      expect((await scope.read(fixture.argument, fixture.call)).status).toBe("ok")
      marker.armed = true
      return { status: "ok", value: true }
    })
    expect(result).toEqual({ status: "denied", reason: "case-access-unavailable" })
    expect(result).not.toHaveProperty("value")
    expect(fixture.counts.canonical).toBe(1)
  } finally { await deadline.close() }
}, 120_000)

test("Planner comparison joins only its live case owner and keeps nested run refusal", async () => {
  const deadline = compositionTestDeadline("planner-comparison-owner")
  try {
    const fixture = await prepare(deadline), scope = fixture.scope()
    const other = await fixture.read()
    deadline.own(() => fixture.authority.ui.finish(other))
    const result = await scope.run(fixture.selection, fixture.call, async () => {
      expect((await scope.read(fixture.argument, fixture.call)).status).toBe("ok")
      const incoming = { caseRef: fixture.caseRef, request: { scenarioRefs: ["baseline", "candidate"], criteria: [] } }
      const joined = await scope.observe(incoming, fixture.call, async () => {
        const first = ok(await scope.read(fixture.argument, fixture.call), "Joined canonical case")
        const second = ok(await scope.read(fixture.argument, fixture.call), "Joined final case")
        expect(first.case).toEqual(second.case)
        expect(first.case).not.toBe(second.case)
        return { status: "ok", value: first.case.id }
      })
      expect(joined).toEqual({ status: "ok", value: fixture.caseRef.id })
      expect(fixture.counts.canonical).toBe(1)
      let foreignWork = false
      const work = async (): Promise<PortResult<true>> => { foreignWork = true; return { status: "ok", value: true } }
      expect(await scope.observe(incoming, other, work))
        .toEqual({ status: "denied", reason: "scenario-case-invocation-unavailable" })
      expect(await scope.observe({ ...incoming, caseRef: { ...fixture.caseRef, id: "other-case" } }, fixture.call, work))
        .toEqual({ status: "denied", reason: "scenario-case-selection-unavailable" })
      expect(await scope.run(fixture.selection, fixture.call, work))
        .toEqual({ status: "denied", reason: "scenario-case-already-active" })
      expect(foreignWork).toBe(false)
      expect(fixture.counts.canonical).toBe(1)
      return joined
    })
    expect(result).toEqual({ status: "ok", value: fixture.caseRef.id })
    expect(await fixture.authority.host.revalidate(other)).toBe(true)
  } finally { await deadline.close() }
}, 120_000)

for (const phase of ["pending", "completed"] as const) {
  test(`an overlapping comparison cannot borrow the active owner's ${phase} proof`, async () => {
    const deadline = compositionTestDeadline(`planner-comparison-overlap-${phase}`)
    try {
      const fixture = await prepare(deadline)
      const reached = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
      let hold = phase === "pending"
      const scope = createSfPlannerCaseReadScope({ host: fixture.business.host, state: fixture.authority.state,
        sources: fixture.business.plannerSources, readerIdentity: () => fixture.business.evidence.current,
        lockedSourceFences: fixture.business.lockedSourceFences, read: async (...args) => {
          fixture.counts.canonical++
          const result = await fixture.business.cases.read(...args)
          if (hold) { hold = false; reached.resolve(); await release.promise }
          return result
        } })
      const pending = scope.observe(fixture.selection, fixture.call, async () => {
        expect((await scope.read(fixture.argument, fixture.call)).status).toBe("ok")
        if (phase === "completed") { reached.resolve(); await release.promise }
        return { status: "ok", value: true }
      })
      try {
        await Promise.race([reached.promise, pending.then(() => { throw new Error("Comparison did not reach its owner boundary") })])
        let invoked = false
        expect(await scope.observe(fixture.selection, fixture.call, async () => { invoked = true; return { status: "ok", value: true } }))
          .toEqual({ status: "denied", reason: "scenario-case-invocation-unavailable" })
        expect(invoked).toBe(false)
        expect(fixture.counts.canonical).toBe(1)
      } finally { release.resolve() }
      expect(await pending).toEqual({ status: "ok", value: true })
      const next = await scope.observe(fixture.selection, fixture.call, async () => {
        expect((await scope.read(fixture.argument, fixture.call)).status).toBe("ok")
        return { status: "ok", value: true }
      })
      expect(next).toEqual({ status: "ok", value: true })
      expect(fixture.counts.canonical).toBe(2)
    } finally { await deadline.close() }
  }, 120_000)
}

for (const boundary of ["source", "case", "reader", "day", "request", "input", "lease", "actor", "abort"] as const) {
  test(`joined Planner comparison rechecks ${boundary} after its final awaited callback`, async () => {
    const deadline = compositionTestDeadline(`planner-comparison-final-${boundary}`)
    try {
      const fixture = await prepare(deadline), scope = fixture.scope()
      const incoming = { caseRef: { ...fixture.caseRef }, request: { scenarioRefs: ["baseline", "candidate"], criteria: [] } }
      const result = await scope.run(fixture.selection, fixture.call, async () => {
        expect((await scope.read(fixture.argument, fixture.call)).status).toBe("ok")
        return scope.observe(incoming, fixture.call, async () => {
          if (boundary === "source" || boundary === "case") await fixture.store.transaction(boundary === "source" ? "planner" : "dashboard", async (snapshot) => {
            if (boundary === "source") {
              const versions = snapshot.data.versions as { lines: { f: number[] }[] }[]
              versions[0]!.lines[0]!.f[0] = 101
            } else (snapshot.data.__sfProductV1 as SfProductState).cases[fixture.caseRef.id]!.objective = "Changed during comparison"
            return { commit: true, value: undefined }
          })
          if (boundary === "reader") fixture.business.evidence.current = undefined
          if (boundary === "day") fixture.clock.at = "2026-11-15T00:00:00Z"
          if (boundary === "request") fixture.authority.host.requestFor(fixture.call)!.headers.set("x-comparison-owner", "changed")
          if (boundary === "input") incoming.request.scenarioRefs[1] = "other-candidate"
          if (boundary === "lease") fixture.authority.ui.finish(fixture.call)
          if (boundary === "actor") fixture.active.value = false
          if (boundary === "abort") fixture.cancellation.abort(new Error("Comparison Request cancellation"))
          await Promise.resolve()
          return { status: "ok", value: true }
        })
      })
      const stale = ["source", "case", "day", "input"].includes(boundary)
      expect(result).toEqual(stale ? { status: "stale", reason: "scenario-source-changed" }
        : { status: "denied", reason: "case-access-unavailable" })
      expect(result).not.toHaveProperty("value")
      expect(fixture.counts.canonical).toBe(1)
    } finally { await deadline.close() }
  }, 120_000)
}
