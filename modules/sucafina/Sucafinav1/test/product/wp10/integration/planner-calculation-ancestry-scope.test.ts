import { AsyncLocalStorage } from "node:async_hooks"
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
          if (fault === "coverage-reader") observed.changed = fixture.replaceCoverage()
          observed.second = await fixture.resolve(call)
          return { status: "ok", value: observed.second }
        })
      })
      expect(observed.first?.state).toBe("fresh")
      expect(observed.resultReads).toBe(6)
      if (fault === "coverage-reader") expect(observed.changed).toBe(true)
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

test("the authenticated case read keeps both evidence passes inside one completed ancestry phase", async () => {
  const fixture = await ancestryProofFixture()
  try {
    const before = await fixture.capture()
    const evidence = fixture.business.evidence.current
    if (!evidence) throw new Error("The real BCS producer was not mounted")
    const original = evidence.context
    type Phase = "empty-before" | "case" | "empty-after"
    const invocation = new AsyncLocalStorage<{ call: Parameters<typeof original>[1]; depth: number; phase: Phase }>()
    const emptyResponses: Awaited<ReturnType<typeof original>>[] = []
    const contexts: {
      requested: Parameters<typeof original>[0]["refs"]; returned: Parameters<typeof original>[0]["refs"]
      states: BusinessEvidenceResolution["state"][]; depth: number; phase: Phase; sameCall: boolean
      results: number; sources: number; fresh: boolean
    }[] = []
    const leafRefs = digestSfValue([fixture.leaf])
    evidence.context = (...args) => {
      const scope = invocation.getStore()
      if (!scope) return original(...args)
      const requested = structuredClone(args[0].refs)
      return invocation.run({ ...scope, depth: scope.depth + 1 }, async () => {
        const value = await original(...args)
        contexts.push({ requested, returned: structuredClone(value.map((item) => item.ref)),
          states: value.map((item) => item.state), depth: scope.depth, phase: scope.phase, sameCall: args[1] === scope.call,
          results: fixture.counts.results, sources: fixture.counts.sources,
          fresh: value.length > 0 && value.every((item) => item.state === "fresh") })
        return value
      })
    }
    const read = await fixture.run(async (call) => {
      fixture.reset()
      contexts.length = 0
      // The empty public BCS request is its own real contract. Record-only leaf
      // replay has no evidence resolver and does not emit an empty child request.
      emptyResponses.push(await invocation.run({ call, depth: 0, phase: "empty-before" }, () =>
        fixture.business.context.context({ refs: [] }, call)))
      const value = await invocation.run({ call, depth: 0, phase: "case" }, () =>
        fixture.business.cases.read({ caseRef: `case:${fixture.caseRef.id}:${fixture.caseRef.incarnation}` }, call))
      emptyResponses.push(await invocation.run({ call, depth: 0, phase: "empty-after" }, () =>
        fixture.business.context.context({ refs: [] }, call)))
      return value
    }).finally(() => invocation.disable())
    // The case port admits its complete [leaf] evidence twice. Retain the actual
    // nested Planner callbacks separately from both parent and empty admissions.
    const passes = contexts.filter((entry) => entry.phase === "case" && digestSfValue(entry.requested) === leafRefs)
    const callbacks = contexts.filter((entry) => entry.phase === "case" && digestSfValue(entry.requested) !== leafRefs)
    const emptyCallbacks = contexts.filter((entry) => entry.phase !== "case")
    expect(read.status).toBe("ok")
    if (read.status !== "ok") throw new Error("The actual case projection was not returned")
    expect(read.value.case.id).toBe(fixture.caseRef.id)
    expect(read.value.case.incarnation).toBe(fixture.caseRef.incarnation)
    expect(read.value.case.version).toBe(fixture.caseRef.version)
    expect(read.value.events[0]?.evidenceRefs).toEqual([fixture.leaf])
    expect(read.value.evidenceRefs).toEqual([fixture.leaf])
    expect(passes).toHaveLength(2)
    expect(passes.map((pass) => pass.depth)).toEqual([0, 0])
    expect(passes.map((pass) => pass.fresh)).toEqual([true, true])
    expect(passes.map((pass) => pass.results)).toEqual([6, 6])
    expect(passes[1]!.sources).toBeGreaterThan(passes[0]!.sources)
    expect(contexts.every((entry) => entry.sameCall)).toBe(true)
    for (const entry of contexts) {
      expect(entry.returned).toEqual(entry.requested)
      expect(entry.states).toEqual(entry.requested.map(() => "fresh"))
    }
    expect(emptyResponses).toEqual([[], []])
    expect(emptyCallbacks.map((entry) => entry.phase)).toEqual(["empty-before", "empty-after"])
    expect(emptyCallbacks.map((entry) => entry.requested)).toEqual([[], []])
    expect(emptyCallbacks.map((entry) => entry.depth)).toEqual([0, 0])
    expect(emptyCallbacks.map((entry) => entry.results)).toEqual([0, 6])
    expect(callbacks.some((entry) => entry.depth > 0 && entry.requested.some((ref) =>
      ref.kind === "record" && ref.target.surface === "planner" && ref.refId === fixture.incoming.baseRef))).toBe(true)
    expect(fixture.counts.results).toBe(6)
    expect(await fixture.capture()).toEqual(before)
  } finally { await fixture.cleanup() }
}, 120000)

test("the public Planner preview keeps its two real BCS admissions and closes the ancestry proof before the next preview", async () => {
  const fixture = await ancestryProofFixture()
  try {
    const before = await fixture.capture()
    const evidence = fixture.business.evidence.current
    if (!evidence) throw new Error("The real BCS producer was not mounted")
    const original = evidence.resolve
    const passes: { results: number; sources: number; fresh: boolean; digest: string }[] = []
    evidence.resolve = async (...args) => {
      const value = await original(...args)
      passes.push({ results: fixture.counts.results, sources: fixture.counts.sources,
        fresh: value.state === "fresh", digest: digestSfValue(value.ref) })
      return value
    }
    const preview = () => fixture.ui("sf_scenario_simulate", (call) => fixture.business.withCase(call, fixture.caseRef, {}, async () => {
      fixture.reset()
      passes.length = 0
      return fixture.business.planner.simulateScenario(fixture.incoming, call)
    }))
    const first = await preview()
    expect(first.status).toBe("ok")
    if (first.status !== "ok") throw new Error("The real Planner preview was not returned")
    expect(first.value.comparisonStatus).toBe("conditioned")
    expect(first.value.total).toBeNull()
    expect(first.value.sourceRefs).toContainEqual(fixture.eventRef)
    expect(passes).toHaveLength(2)
    expect(passes.map((pass) => pass.fresh)).toEqual([true, true])
    expect(passes.map((pass) => pass.digest)).toEqual([digestSfValue(fixture.eventRef), digestSfValue(fixture.eventRef)])
    expect(passes.map((pass) => pass.results)).toEqual([6, 6])
    expect(passes[1]!.sources).toBeGreaterThan(passes[0]!.sources)
    expect(fixture.counts.results).toBe(6)
    const second = await preview()
    expect(second.status).toBe("ok")
    if (second.status === "ok") expect(second.value).toEqual(first.value)
    expect(passes).toHaveLength(2)
    expect(passes.map((pass) => pass.results)).toEqual([6, 6])
    expect(fixture.counts.results).toBe(6)
    expect(await fixture.capture()).toEqual(before)
  } finally { await fixture.cleanup() }
}, 120000)

test("a current persisted scenario request keeps both canonical outer reads and only the completed leaf proof within its read suffix", async () => {
  const phase = async <Value>(name: string, work: () => Promise<Value>, counts?: () => Readonly<Record<string, number>>): Promise<Value> => {
    const started = performance.now()
    console.info("SF_CALCULATION_REQUEST_PHASE", JSON.stringify({ phase: name, state: "started", counts: counts?.() }))
    try { return await work() } finally {
      console.info("SF_CALCULATION_REQUEST_PHASE", JSON.stringify({ phase: name, state: "returned",
        elapsedMs: Math.round(performance.now() - started), counts: counts?.() }))
    }
  }
  const fixture = await phase("fixture.initialize", ancestryProofFixture)
  try {
    const produced = await phase("outer.produce", () => fixture.ui("sf_scenario_simulate", (call) => fixture.business.withCase(call, fixture.caseRef, {}, async () => {
      const simulated = await phase("outer.preview", () => fixture.business.planner.simulateScenario(fixture.incoming, call), () => fixture.counts)
      if (simulated.status !== "ok") return simulated
      return phase("outer.persist", () => fixture.business.calculations.persist({ kind: "scenario", request: fixture.incoming, result: simulated.value }, "request-read-outer", call), () => fixture.counts)
    })), () => fixture.counts)
    expect(produced.status).toBe("ok")
    if (produced.status !== "ok") throw new Error("The real outer calculation was not persisted")
    const outer = produced.value.resultRef
    const before = await fixture.capture()
    if (before.state.status !== "ok") throw new Error("The complete C08 envelope was unavailable")
    const stored = before.state.value.state.decisionResults?.[outer]
    if (!stored || stored.kind !== "scenario") throw new Error("The actual persisted outer scenario was absent")
    const reads: string[] = []
    const original = fixture.business.results.readForCalculation
    fixture.business.results.readForCalculation = (request, call) => {
      reads.push(request.resultRef)
      return original(request, call)
    }
    const read = () => fixture.run(async (call) => {
      fixture.reset()
      reads.length = 0
      return fixture.business.calculations.requests.read(outer, call)
    })
    const first = await phase("request.read.first", read, () => fixture.counts)
    expect(first.status).toBe("ok")
    if (first.status !== "ok") throw new Error("The canonical scenario request was not returned")
    expect(first.value.resultRef).toBe(outer)
    expect(first.value.caseRef).toEqual(fixture.caseRef)
    expect(first.value.request).toEqual(fixture.incoming)
    expect(first.value.requestDigest).toBe(digestSfValue(fixture.incoming))
    expect(first.value.resultDigest).toBe(stored.resultDigest)
    expect(first.value.engineVersion).toBe("planner-runtime-v1")
    expect(first.value.recordDigest).toBe(digestSfValue(Object.fromEntries(Object.entries(first.value).filter(([key]) => key !== "recordDigest"))))
    expect(reads.filter((reference) => reference === outer)).toHaveLength(2)
    expect(reads.filter((reference) => reference === fixture.leaf.target.runId)).toHaveLength(6)
    expect(reads).toHaveLength(8)
    expect(fixture.counts.results).toBe(8)
    expect(fixture.counts.sources).toBeGreaterThan(0)
    expect(fixture.counts.coverage).toBeGreaterThan(0)
    expect(await fixture.capture()).toEqual(before)
    const second = await phase("request.read.second", read, () => fixture.counts)
    expect(second).toEqual(first)
    expect(reads.filter((reference) => reference === outer)).toHaveLength(2)
    expect(reads.filter((reference) => reference === fixture.leaf.target.runId)).toHaveLength(6)
    expect(reads).toHaveLength(8)
    expect(fixture.counts.results).toBe(8)
    expect(await fixture.capture()).toEqual(before)
  } finally { await fixture.cleanup() }
}, 120000)
