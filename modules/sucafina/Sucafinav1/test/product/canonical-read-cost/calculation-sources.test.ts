import { expect, spyOn, test } from "bun:test"
import { canonicalSfValue, digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfDecisionResultStore, readHistoricalScenarios } from "../../../product/decisions/result-store.ts"
import { createCalculationFixture } from "./calculation-fixture.ts"

test("C08 private observations keep callback order and independently mutable scalar and duplicate batch outputs", async () => {
  const setup = await createCalculationFixture()
  try {
    const context = setup.fixture.context
    const request = { kind: "scenario" as const, resultRef: setup.original.resultRef }
    const expected = { status: "ok", value: setup.original }
    const wire = canonicalSfValue(setup.original)
    const hashes = { count: 0 }
    const retained: { value?: Parameters<typeof setup.settings.verifySources>[0] } = {}
    setup.hooks.sources = (value) => { retained.value = value }
    const update = Bun.CryptoHasher.prototype.update
    // The hash API is the only observation point for this private producer work.
    // Exact bytes and this binding are forwarded; no result or authority is mocked.
    const probe = spyOn(Bun.CryptoHasher.prototype, "update").mockImplementation(function (this: Bun.CryptoHasher, ...args: Parameters<typeof update>) {
      if (args[0] === wire) hashes.count += 1
      return update.apply(this, args)
    })
    const scalar = await setup.results.read(request, context).finally(() => probe.mockRestore())
    const scalarHashes = hashes.count
    expect(scalar).toEqual(expected)
    expect(setup.trace.events).toEqual(["authority", "read:cases", "case", "sources", "authority", "read:cases", "case", "sources", "authority", "authority", "read:cases"])
    expect(setup.trace.sources).toEqual([setup.original.sourceRefs, setup.original.sourceRefs])
    expect(scalarHashes).toBeGreaterThan(0)
    if (retained.value?.kind !== "scenario") throw new Error("Source callback was not observed")
    retained.value.result.knownSubtotal = -24680
    expect(scalar).toEqual(expected)
    setup.hooks.sources = undefined
    if (scalar.status !== "ok" || scalar.value.kind !== "scenario") throw new Error("Scenario unavailable")
    scalar.value.result.knownSubtotal = -987654
    expect(await setup.results.read(request, context)).toEqual(expected)

    setup.reset()
    hashes.count = 0
    const batchProbe = spyOn(Bun.CryptoHasher.prototype, "update").mockImplementation(function (this: Bun.CryptoHasher, ...args: Parameters<typeof update>) {
      if (args[0] === wire) hashes.count += 1
      return update.apply(this, args)
    })
    const batch = await readHistoricalScenarios(setup.results, [request.resultRef, request.resultRef], context).finally(() => batchProbe.mockRestore())
    expect(batch).toEqual([expected, expected])
    expect(setup.trace.events).toEqual(["authority", "authority", "read:cases", "case", "sources", "authority", "case", "sources", "authority", "read:cases", "case", "sources", "authority", "authority", "case", "sources", "authority", "authority", "read:cases"])
    expect(setup.trace.sources).toEqual(Array.from({ length: 4 }, () => setup.original.sourceRefs))
    expect(hashes.count).toBeGreaterThan(0)
    if (batch[0]?.status !== "ok" || batch[0].value.kind !== "scenario" || batch[1]?.status !== "ok") throw new Error("Batch unavailable")
    expect(batch[0].value).not.toBe(batch[1].value)
    expect(batch[0].value.sourceRefs).not.toBe(batch[1].value.sourceRefs)
    batch[0].value.result.knownSubtotal = -123456
    expect(batch[1]).toEqual(expected)
    expect(await setup.results.read(request, context)).toEqual(expected)
    console.log("canonical-read-cost:result-digests", JSON.stringify({ scalar: scalarHashes, duplicateBatch: hashes.count, scalarCallbacks: 11, duplicateBatchCallbacks: 19 }))

    setup.reset()
    setup.hooks.sources = async () => {
      if (setup.trace.sources.length !== 2) return
      const changed = structuredClone(setup.original)
      changed.result.knownSubtotal = -13579
      changed.resultDigest = digestSfValue(changed.result)
      await setup.replace(changed)
    }
    expect(await setup.results.read(request, context)).toMatchObject({ status: "denied", reason: "result-access-unavailable" })
    expect(setup.trace.reads).toBe(3)
    setup.hooks.sources = undefined
    await setup.replace(setup.original)
    expect(await setup.results.read(request, context)).toEqual(expected)
  } finally { await setup.cleanup() }
})

test("calculation sources preserve complete reference identity, current evidence and canonical replay", async () => {
  const setup = await createCalculationFixture()
  try {
    const context = setup.fixture.context
    const request = { resultRef: setup.original.resultRef }
    const replay = { calls: 0 }
    const results = createSfDecisionResultStore({ ...setup.settings, verifyCalculationSources: async (value, _refs, trusted) => {
      replay.calls += 1
      const actual = await setup.fixture.planner.simulateScenario(setup.fixture.scenario, trusted)
      return actual.status === "ok" && value.requestDigest === digestSfValue(setup.fixture.scenario) && digestSfValue(actual.value) === digestSfValue(value.result)
    } })
    const source = (await Bun.file(new URL("../../../product/decisions/result-store.ts", import.meta.url)).text()).split("\n")
    const firstLine = source.findIndex((line) => line.startsWith("function calculationSources(")) + 1
    const following = source.findIndex((line, index) => index >= firstLine && line.startsWith("function "))
    const lastLine = following < 0 ? source.length : following
    expect(firstLine).toBeGreaterThan(0)
    const canonical = await import("../../../product/contracts/canonical.ts")
    const originalDigest = canonical.digestSfValue
    const calculation = { digests: 0, firstStack: "", callsites: new Set<string>() }
    // ESM live-import observation retains the producer's exact source callsite,
    // including unnamed/inlined filter callbacks in the original implementation.
    const probe = spyOn(canonical, "digestSfValue").mockImplementation((value) => {
      const stack = new Error().stack ?? ""
      const callsite = [...stack.matchAll(/product\/decisions\/result-store\.ts:(\d+):\d+/g)].find((match) => Number(match[1]) >= firstLine && Number(match[1]) <= lastLine)
      if (callsite) {
        calculation.digests += 1
        calculation.callsites.add(callsite[0])
        if (!calculation.firstStack) calculation.firstStack = stack
      }
      return originalDigest(value)
    })
    const calculated = await results.readForCalculation(request, context).finally(() => probe.mockRestore())
    expect(calculated).toEqual({ status: "ok", value: setup.original })
    expect(replay.calls).toBe(2)
    expect(setup.trace.sources).toEqual([setup.fixture.sourceRefs, setup.fixture.sourceRefs])
    expect(calculation.digests).toBeGreaterThan(0)
    expect(calculation.firstStack).toContain("result-store.ts")
    console.log("canonical-read-cost:calculation-sources", JSON.stringify({
      inputReferencesPerDerivation: setup.original.sourceRefs.length + setup.original.result.sourceRefs.length + setup.original.result.costCoverage.evaluatedSourceRefs.length + setup.original.result.costCoverage.entries.reduce((count, entry) => count + (entry.status === "pending" ? 0 : entry.evidenceRefs.length), 0),
      distinctSourceReferences: setup.fixture.sourceRefs.length,
      digests: calculation.digests,
      replayCallbacks: replay.calls,
      producerLines: { first: firstLine, last: lastLine },
      callsites: [...calculation.callsites],
      firstStack: calculation.firstStack,
    }))

    // Same refId/refDigest with a changed version must reach source verification.
    // This is deliberate persisted corruption, introduced through real C08 CAS.
    const changed = structuredClone(setup.original)
    const reference = structuredClone(setup.fixture.sourceRefs[0]!)
    reference.target.version += 1
    changed.sourceRefs = [setup.fixture.sourceRefs[0]!, reference, setup.fixture.sourceRefs[0]!]
    await setup.replace(changed)
    setup.reset()
    expect(await results.readForCalculation(request, context)).toMatchObject({ status: "denied", reason: "result-access-unavailable" })
    expect(setup.trace.sources).toHaveLength(1)
    expect(setup.trace.sources[0]).toContainEqual(reference)
    expect(setup.trace.sources[0]).toContainEqual(setup.fixture.sourceRefs[0])
    expect(replay.calls).toBe(2)

    await setup.replace(setup.original)
    setup.reset()
    setup.hooks.sources = (value) => {
      if (value.kind === "scenario") value.result.knownSubtotal = -1
    }
    expect(await results.readForCalculation(request, context)).toMatchObject({ status: "denied", reason: "result-access-unavailable" })
    expect(replay.calls).toBe(2)
    setup.hooks.sources = undefined

    const refused = createSfDecisionResultStore({ ...setup.settings, verifyCalculationSources: async () => { replay.calls += 1; return false } })
    expect(await refused.readForCalculation(request, context)).toMatchObject({ status: "unavailable", reason: "calculation-source-unproven" })
    expect(replay.calls).toBe(3)
    expect(await setup.results.read({ ...request, kind: "scenario" }, context)).toEqual({ status: "ok", value: setup.original })

    setup.reset()
    const revision = setup.fixture.sourceRefs[0]!.target.version
    setup.hooks.sources = () => {
      if (setup.trace.sources.length === 1) setup.fixture.sourceRefs[0]!.target.version += 1
    }
    try {
      expect(await setup.results.readForCalculation(request, context)).toMatchObject({ status: "denied", reason: "result-access-unavailable" })
      expect(setup.trace.sources).toHaveLength(2)
    } finally {
      setup.fixture.sourceRefs[0]!.target.version = revision
      setup.hooks.sources = undefined
    }
  } finally { await setup.cleanup() }
})

test("final envelope getters and clone failures remain observable before scalar publication", async () => {
  const setup = await createCalculationFixture()
  try {
    const request = { kind: "scenario" as const, resultRef: setup.original.resultRef }
    const effects = { calls: 0, fail: false }
    setup.hooks.read = (value, _namespace, ordinal) => {
      if (ordinal !== 3 || value.status !== "ok" || !value.value || typeof value.value !== "object") return
      Object.defineProperty(value.value, "unselected", { enumerable: true, get: () => {
        effects.calls += 1
        return effects.fail ? () => "uncloneable" : { observed: true }
      } })
    }
    expect(await setup.results.read(request, setup.fixture.context)).toEqual({ status: "ok", value: setup.original })
    expect(effects.calls).toBe(1)
    setup.reset()
    effects.fail = true
    await expect(setup.results.read(request, setup.fixture.context)).rejects.toThrow()
    expect(effects.calls).toBe(2)
    expect(setup.trace.reads).toBe(3)
    expect(setup.trace.sources).toHaveLength(2)
    setup.hooks.read = undefined
    expect(await setup.results.read(request, setup.fixture.context)).toEqual({ status: "ok", value: setup.original })
  } finally { await setup.cleanup() }
})
