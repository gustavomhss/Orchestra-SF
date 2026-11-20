import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { BusinessEvidenceResolution } from "../../../../product/contracts/business-context.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import { createPlannerCalculationEvidence } from "../../../../product/planner/calculation-evidence.ts"
import { ancestryProofFixture } from "./planner-calculation-ancestry-fixture.ts"

const normalized = (value: BusinessEvidenceResolution) => ({ ...value, checkedAt: "" })

test("one ancestry invocation reuses only a completed leaf and still performs fresh source and coverage admissions", async () => {
  const fixture = await ancestryProofFixture()
  try {
    const before = await fixture.capture()
    const control = await fixture.run(async (call) => {
      fixture.reset()
      const first = await fixture.canonical(call), second = await fixture.canonical(call)
      return { status: "ok", value: { first, second, counts: { ...fixture.counts } } }
    })
    expect(control.status).toBe("ok")
    if (control.status !== "ok") throw new Error("Canonical control unavailable")
    expect(control.value.first.state).toBe("fresh")
    expect(normalized(control.value.second)).toEqual(normalized(control.value.first))
    expect(control.value.counts.resolutions).toBe(2)
    expect(control.value.counts.results).toBe(12)
    const observed = await fixture.run(async (call) => {
      fixture.reset()
      return fixture.observe(call, async () => {
        const first = await fixture.resolve(call), firstCounts = { ...fixture.counts }
        const second = await fixture.resolve(call), secondCounts = { ...fixture.counts }
        return { status: "ok", value: { first, second, firstCounts, secondCounts } }
      })
    })
    expect(observed.status).toBe("ok")
    if (observed.status !== "ok") throw new Error("Ancestry observation unavailable")
    expect(normalized(observed.value.first)).toEqual(normalized(control.value.first))
    expect(normalized(observed.value.second)).toEqual(normalized(control.value.first))
    expect(observed.value.firstCounts.results).toBe(6)
    expect(observed.value.secondCounts.results).toBe(6)
    expect(observed.value.secondCounts.resolutions).toBe(1)
    expect(observed.value.secondCounts.sources).toBeGreaterThan(observed.value.firstCounts.sources)
    expect(observed.value.secondCounts.coverage).toBeGreaterThan(observed.value.firstCounts.coverage)
    expect(observed.value.secondCounts.scopes).toBeGreaterThan(observed.value.firstCounts.scopes)
    expect(await fixture.capture()).toEqual(before)
    const next = await fixture.run(async (call) => {
      fixture.reset()
      return fixture.observe(call, async () => ({ status: "ok", value: await fixture.resolve(call) }))
    })
    expect(next.status).toBe("ok")
    if (next.status === "ok") expect(normalized(next.value)).toEqual(normalized(control.value.first))
    expect(fixture.counts.resolutions).toBe(1)
    expect(fixture.counts.results).toBe(6)
    expect(await fixture.capture()).toEqual(before)
  } finally { await fixture.cleanup() }
}, 120000)

for (const fault of ["result", "request", "source", "input", "headers", "lease", "access", "day", "actor", "reader", "source-reader", "evidence-holder", "coverage-reader"] as const) {
  test("completed ancestry proof refuses the same-reference change in " + fault, async () => {
    const fixture = await ancestryProofFixture()
    try {
      const refDigest = digestSfValue(fixture.leaf), before = await fixture.capture()
      const observed: { first?: BusinessEvidenceResolution; second?: BusinessEvidenceResolution; changed?: boolean; resultReads?: number } = {}
      const result = await fixture.run(async (call) => {
        fixture.reset()
        return fixture.observe(call, async () => {
          observed.first = await fixture.resolve(call)
          if (observed.first.state !== "fresh") throw new Error("The original leaf was not proven")
          observed.resultReads = fixture.counts.results
          if (fault === "result" || fault === "request") {
            observed.changed = await fixture.corrupt((state) => {
              const stored = state.decisionResults![fixture.leaf.target.runId]!
              const key = "sf:proposal-coverage:scenario-request:" + digestSfValue(fixture.leaf.target.runId)
              const record = state.preferences[key] as { request: { baseRef: string }; requestDigest: string; resultDigest: string; recordDigest: string }
              if (stored.kind !== "scenario") throw new Error("Actual scenario missing")
              if (fault === "result") {
                stored.result.knownSubtotal += 1
                stored.resultDigest = digestSfValue(stored.result)
                record.resultDigest = stored.resultDigest
              } else {
                record.request.baseRef += "-changed"
                record.requestDigest = digestSfValue(record.request)
                stored.requestDigest = record.requestDigest
              }
              record.recordDigest = digestSfValue(Object.fromEntries(Object.entries(record).filter(([key]) => key !== "recordDigest")))
            })
          }
          if (fault === "source") observed.changed = (await fixture.changeSource(call)).ok
          if (fault === "input") fixture.incoming.assumptions[0]!.value += "-changed"
          if (fault === "headers") fixture.business.host.requestFor(call)!.headers.set("x-observation", "changed")
          if (fault === "lease") fixture.authority.ui.finish(call)
          if (fault === "access") fixture.control.active = false
          if (fault === "day") fixture.control.at = "2027-02-03T00:00:00Z"
          if (fault === "actor") fixture.control.canWrite = false
          if (fault === "reader") {
            const original = fixture.business.results.readForCalculation
            fixture.business.results.readForCalculation = (...args) => original(...args)
          }
          if (fault === "source-reader") {
            const original = fixture.business.plannerSources.resolveForecastSource
            fixture.business.plannerSources.resolveForecastSource = (...args) => original(...args)
          }
          if (fault === "evidence-holder") {
            const original = fixture.business.evidence.current
            if (!original) throw new Error("The actual evidence producer was not mounted")
            fixture.business.evidence.current = { ...original }
          }
          if (fault === "coverage-reader") fixture.replaceCoverage()
          observed.second = await fixture.resolve(call)
          return { status: "ok", value: observed.second }
        })
      })
      expect(observed.first?.state).toBe("fresh")
      expect(observed.resultReads).toBe(6)
      expect(observed.second?.state).toBe("unavailable")
      expect(result.status).not.toBe("ok")
      expect(fixture.counts.resolutions).toBe(1)
      expect(fixture.counts.results).toBe(6)
      expect(digestSfValue(fixture.leaf)).toBe(refDigest)
      if (fault === "result" || fault === "request" || fault === "source") {
        expect(observed.changed).toBe(true)
        expect(await fixture.rawSnapshots()).not.toEqual(before.snapshots)
      } else expect(await fixture.rawSnapshots()).toEqual(before.snapshots)
    } finally { await fixture.cleanup() }
  }, 120000)
}

for (const fault of ["access", "day", "actor", "lease"] as const) {
  test("the last real authority await cannot publish an ancestry proof after " + fault + " changes", async () => {
    const fixture = await ancestryProofFixture()
    try {
      const before = await fixture.capture()
      let finalAt = 0
      const control = await fixture.run(async (call) => {
        fixture.reset()
        const value = await fixture.observe(call, async () => {
          const first = await fixture.resolve(call), second = await fixture.resolve(call)
          return { status: "ok", value: [first, second] }
        })
        finalAt = fixture.counts.revalidations
        return value
      })
      expect(control.status).toBe("ok")
      expect(finalAt).toBeGreaterThan(0)
      const injected = { count: 0, allowed: false, held: false }
      const result = await fixture.run(async (call) => {
        fixture.reset()
        fixture.hooks.revalidate = (allowed, current) => {
          if (fixture.counts.revalidations !== finalAt) return
          injected.count++
          injected.allowed = allowed
          injected.held = fixture.store.currentSnapshots() !== undefined
          if (fault === "access") fixture.control.active = false
          if (fault === "day") fixture.control.at = "2027-02-03T00:00:00Z"
          if (fault === "actor") fixture.control.canWrite = false
          if (fault === "lease") fixture.authority.ui.finish(current)
        }
        return fixture.observe(call, async () => {
          const first = await fixture.resolve(call), second = await fixture.resolve(call)
          return { status: "ok", value: [first, second] }
        })
      })
      expect(injected.count).toBe(1)
      expect(injected.allowed).toBe(true)
      expect(injected.held).toBe(true)
      expect(result.status).not.toBe("ok")
      expect(fixture.counts.resolutions).toBe(1)
      expect(fixture.counts.results).toBe(6)
      expect(await fixture.rawSnapshots()).toEqual(before.snapshots)
    } finally { await fixture.cleanup() }
  }, 120000)
}

test("mutating an actual source callback output after its return invalidates the completed ancestry owner", async () => {
  const fixture = await ancestryProofFixture()
  try {
    const before = await fixture.capture(), leafDigest = digestSfValue(fixture.leaf)
    let retained: Awaited<ReturnType<typeof fixture.business.plannerSources.resolveForecastSource>> | undefined
    fixture.hooks.source = (value) => { retained = value }
    const result = await fixture.run(async (call) => {
      fixture.reset()
      return fixture.observe(call, async () => {
        expect((await fixture.resolve(call)).state).toBe("fresh")
        if (!retained || retained.status !== "ok") throw new Error("A real source callback output was not reached")
        retained.value.evidence.target.version += 1
        const changed = await fixture.resolve(call)
        expect(changed.state).toBe("unavailable")
        return { status: "ok", value: changed }
      })
    })
    expect(result.status).not.toBe("ok")
    expect(fixture.counts.results).toBe(6)
    expect(fixture.counts.resolutions).toBe(1)
    expect(digestSfValue(fixture.leaf)).toBe(leafDigest)
    expect(await fixture.capture()).toEqual(before)
    fixture.hooks.source = undefined
    const fresh = await fixture.run(async (call) => ({ status: "ok", value: await fixture.canonical(call) }))
    expect(fresh.status).toBe("ok")
    if (fresh.status === "ok") expect(fresh.value.state).toBe("fresh")
  } finally { await fixture.cleanup() }
}, 120000)

test("an overlapping independent call cannot borrow the active ancestry owner's completed proof", async () => {
  const fixture = await ancestryProofFixture()
  let release = () => {}, reached = () => {}
  const held = new Promise<void>((resolve) => { release = resolve })
  const ready = new Promise<void>((resolve) => { reached = resolve })
  try {
    const before = await fixture.capture()
    const result = await fixture.run(async (call) => {
      fixture.reset()
      const first = fixture.observe(call, async () => {
        const original = await fixture.resolve(call)
        expect(original.state).toBe("fresh")
        reached()
        await held
        const again = await fixture.resolve(call)
        return { status: "ok", value: [original, again] }
      })
      void first.then(reached, reached)
      await ready
      const completed = fixture.counts.results
      const outsider = await fixture.observe(call, async () => ({ status: "ok", value: await fixture.resolve(call) }))
      expect(outsider.status).toBe("ok")
      if (outsider.status === "ok") expect(outsider.value.state).toBe("fresh")
      expect(fixture.counts.results - completed).toBe(6)
      const afterOutsider = fixture.counts.results
      release()
      const observed = await first
      expect(observed.status).toBe("ok")
      if (observed.status === "ok") expect(observed.value.map((entry) => entry.state)).toEqual(["fresh", "fresh"])
      expect(fixture.counts.results).toBe(afterOutsider)
      return observed
    })
    expect(result.status).toBe("ok")
    expect(await fixture.capture()).toEqual(before)
  } finally { release(); await fixture.cleanup() }
}, 120000)

test("an unmaterialized source follows refusal and real reissuance never resurrects the old calculation reference", async () => {
  const fixture = await ancestryProofFixture()
  try {
    const old = fixture.leaf.target.sourceRefs.find((ref) => ref.kind === "record")
    if (!old || old.kind !== "record") throw new Error("Actual Planner source missing")
    const result = await fixture.run(async (call) => {
      const removed = await fixture.store.transaction("planner", async (snapshot) => {
        const scopes = snapshot.sfSources?.scopes ?? {}
        const keys = Object.keys(scopes).filter((key) => scopes[key]!.incarnation === old.target.incarnation)
        for (const key of keys) delete scopes[key]
        return { commit: true, value: keys.length }
      })
      expect(removed).toBe(1)
      expect((await fixture.canonical(call)).state).not.toBe("fresh")
      const beforeObservation = await fixture.rawSnapshots()
      fixture.reset()
      const observed = await fixture.observe(call, async () => ({ status: "ok", value: await fixture.resolve(call) }))
      expect(observed.status).not.toBe("ok")
      expect(fixture.counts.resolutions).toBe(0)
      expect(await fixture.rawSnapshots()).toEqual(beforeObservation)
      const restored = await fixture.business.plannerProduct.issueSource("v0", call)
      expect(restored.status).toBe("ok")
      if (restored.status !== "ok") throw new Error("Canonical C02 reissuance unavailable")
      expect(restored.value.evidence.target.incarnation).not.toBe(old.target.incarnation)
      expect((await fixture.canonical(call)).state).not.toBe("fresh")
      return { status: "ok", value: true }
    })
    expect(result.status).toBe("ok")
  } finally { await fixture.cleanup() }
}, 120000)

test("the canonical calculation cycle guard runs before the optional completed-proof hook", async () => {
  const fixture = await ancestryProofFixture()
  try {
    const before = await fixture.capture()
    const result = await fixture.run(async (call) => {
      const calls = { hook: 0, nested: undefined as PortResult<Extract<typeof fixture.leaf, { kind: "calculation" }>> | undefined }
      const producer = createPlannerCalculationEvidence({ host: fixture.business.host,
        readForCalculation: (request, context) => fixture.business.results.readForCalculation({ resultRef: request.resultRef }, context),
        loadRecordOnlyRequest: fixture.business.calculations.requests.read,
        replayRecordOnly: fixture.business.planner.simulateScenario,
        observeReplay: async (runId, context, work) => {
          calls.hook++
          calls.nested = await producer.issue(runId, context)
          return work()
        } })
      const issued = await producer.issue(fixture.leaf.target.runId, call)
      expect(calls.hook).toBe(1)
      expect(calls.nested).toEqual({ status: "unavailable", reason: "calculation-replay-cycle" })
      expect(issued).toEqual({ status: "ok", value: fixture.leaf })
      return issued
    })
    expect(result.status).toBe("ok")
    expect(await fixture.capture()).toEqual(before)
  } finally { await fixture.cleanup() }
}, 120000)

test("ordinary leaf reads retain two independent canonical replays outside an ancestry invocation", async () => {
  const fixture = await ancestryProofFixture()
  try {
    const before = await fixture.capture()
    const result = await fixture.run(async (call) => {
      fixture.reset()
      return fixture.observation.observe(fixture.leaf, call, async () => {
        const first = await fixture.resolve(call), second = await fixture.resolve(call)
        return { status: "ok", value: [first, second] }
      })
    })
    expect(result.status).toBe("ok")
    if (result.status === "ok") expect(result.value.map((entry) => entry.state)).toEqual(["fresh", "fresh"])
    expect(fixture.counts.resolutions).toBe(2)
    expect(fixture.counts.results).toBe(12)
    expect(await fixture.capture()).toEqual(before)
  } finally { await fixture.cleanup() }
}, 120000)
