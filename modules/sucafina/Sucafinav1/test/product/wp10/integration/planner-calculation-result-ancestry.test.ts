import { expect, test } from "bun:test"
import { object } from "../../../../runtime/contract.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { ancestryProofFixture } from "./planner-calculation-ancestry-fixture.ts"

test("a current C09 result retains both complete source admissions inside its own completed ancestry read", async () => {
  const fixture = await ancestryProofFixture()
  try {
    const produced = await fixture.ui("sf_scenario_simulate", (call) => fixture.business.withCase(call, fixture.caseRef, {}, async () => {
      const simulated = await fixture.business.planner.simulateScenario(fixture.incoming, call)
      if (simulated.status !== "ok") return simulated
      return fixture.business.calculations.persist({ kind: "scenario", request: fixture.incoming, result: simulated.value }, "c09-read-outer", call)
    }))
    expect(produced.status).toBe("ok")
    if (produced.status !== "ok") throw new Error("The actual outer calculation was not persisted")
    const before = await fixture.capture()
    if (before.state.status !== "ok") throw new Error("The complete initial C08 envelope was unavailable")
    const stored = before.state.value.state.decisionResults?.[produced.value.resultRef]
    if (!stored || stored.kind !== "scenario") throw new Error("The actual outer scenario was absent")
    expect(stored.sourceRefs).toContainEqual(fixture.eventRef)
    const evidence = fixture.business.evidence.current
    if (!evidence) throw new Error("The real BCS producer was not mounted")
    const context = evidence.context
    const sourceSet = digestSfValue(stored.sourceRefs)
    const passes: { results: number; sources: number; fresh: boolean }[] = []
    evidence.context = async (...args) => {
      const requested = structuredClone(args[0].refs)
      const result = await context(...args)
      if (digestSfValue(requested) === sourceSet) {
        expect(result.map((entry) => entry.ref)).toEqual(requested)
        passes.push({ results: fixture.counts.results, sources: fixture.counts.sources,
          fresh: result.length > 0 && result.every((entry) => entry.state === "fresh") })
      }
      return result
    }
    const read = () => fixture.run(async (call) => {
      fixture.reset()
      passes.length = 0
      return fixture.business.results.read({ resultRef: stored.resultRef, kind: "scenario" }, call)
    })
    const first = await read()
    expect(first).toEqual({ status: "ok", value: stored })
    expect(passes).toHaveLength(2)
    expect(passes.map((pass) => pass.fresh)).toEqual([true, true])
    expect(passes.map((pass) => pass.results)).toEqual([6, 6])
    expect(passes[1]!.sources).toBeGreaterThan(passes[0]!.sources)
    expect(fixture.counts.results).toBe(6)
    expect(fixture.counts.sources).toBeGreaterThan(0)
    expect(fixture.counts.coverage).toBeGreaterThan(0)
    expect(await fixture.capture()).toEqual(before)
    const second = await read()
    expect(second).toEqual(first)
    expect(passes).toHaveLength(2)
    expect(passes.map((pass) => pass.fresh)).toEqual([true, true])
    expect(passes.map((pass) => pass.results)).toEqual([6, 6])
    expect(passes[1]!.sources).toBeGreaterThan(passes[0]!.sources)
    expect(fixture.counts.results).toBe(6)
    expect(fixture.counts.sources).toBeGreaterThan(0)
    expect(fixture.counts.coverage).toBeGreaterThan(0)
    expect(await fixture.capture()).toEqual(before)
    evidence.context = context
  } finally { await fixture.cleanup() }
}, 120000)

test("a real Planner change after the C09 commit refuses readback while retaining the committed result and receipt", async () => {
  const fixture = await ancestryProofFixture()
  try {
    const completed = await fixture.ui("sf_scenario_simulate", (call) => fixture.business.withCase(call, fixture.caseRef, {}, async () => {
      const simulated = await fixture.business.planner.simulateScenario(fixture.incoming, call)
      expect(simulated.status).toBe("ok")
      if (simulated.status !== "ok") throw new Error("The canonical outer preview was unavailable")
      const before = await fixture.capture()
      if (before.state.status !== "ok") throw new Error("The complete initial C08 envelope was unavailable")
      const transaction = fixture.authority.state.transaction, stateRead = fixture.authority.state.read
      const resolveSource = fixture.business.plannerSources.resolveForecastSource
      const effects: {
        commits: number; changed: boolean; resultRef?: string; receipt?: unknown
        command?: Parameters<typeof transaction>[1]
        committed?: Awaited<ReturnType<typeof fixture.capture>>
        readbacks: number; sourcesAfterCommit: number
      } = { commits: 0, changed: false, readbacks: 0, sourcesAfterCommit: 0 }
      fixture.authority.state.read = async (request, namespace, select) => {
        const result = await stateRead(request, namespace, select)
        if (effects.resultRef && namespace === "cases" && result.status === "ok" &&
          object(object(result.value).stored).resultRef === effects.resultRef) effects.readbacks++
        return result
      }
      fixture.business.plannerSources.resolveForecastSource = (...args) => {
        if (effects.resultRef) effects.sourcesAfterCommit++
        return resolveSource(...args)
      }
      fixture.authority.state.transaction = async (request, command, work) => {
        const result = await transaction(request, command, work)
        if (command.namespace === "cases" && command.idempotencyKey === "decision-result:c09-commit-boundary" && result.status === "ok") {
          const receipt = object(result.value)
          if (typeof receipt.resultRef !== "string") throw new Error("The committed C09 receipt was missing")
          effects.commits++
          effects.command = structuredClone(command)
          effects.resultRef = receipt.resultRef
          effects.receipt = structuredClone(result.value)
          effects.committed = await fixture.capture()
          // The real transaction has returned. Mutate the actual Planner source
          // before C09's unchanged readback; no result or receipt is rolled back.
          const changed = await fixture.changeSource(call)
          effects.changed = changed.ok
        }
        return result
      }
      let result: Awaited<ReturnType<typeof fixture.business.calculations.persist>>
      try {
        result = await fixture.business.calculations.persist({
          kind: "scenario", request: fixture.incoming, result: simulated.value,
        }, "c09-commit-boundary", call)
      } finally {
        fixture.authority.state.transaction = transaction
        fixture.authority.state.read = stateRead
        fixture.business.plannerSources.resolveForecastSource = resolveSource
      }
      expect(effects.commits).toBe(1)
      expect(effects.changed).toBe(true)
      expect(effects.readbacks).toBeGreaterThan(0)
      expect(effects.sourcesAfterCommit).toBeGreaterThan(0)
      expect(result).toEqual({ status: "unavailable", reason: "calculation-ancestry-observation-changed" })
      if (!effects.resultRef || !effects.committed || effects.committed.state.status !== "ok") throw new Error("The committed C09 envelope was not observed")
      const committed = effects.committed.state
      const stored = committed.value.state.decisionResults?.[effects.resultRef]
      if (!stored || stored.kind !== "scenario") throw new Error("The committed outer scenario was absent")
      const references = [...simulated.value.sourceRefs, ...simulated.value.costCoverage.evaluatedSourceRefs,
        ...simulated.value.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
      const sourceRefs = references.filter((ref, index) => references.findIndex((entry) => entry.refDigest === ref.refDigest) === index)
      const requestDigest = digestSfValue(fixture.incoming)
      expect(Number.isFinite(Date.parse(stored.createdAt))).toBe(true)
      expect(stored).toEqual({ schema: "sf-decision-result-v1", resultRef: effects.resultRef, caseRef: fixture.caseRef,
        principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion,
        requestDigest, resultDigest: digestSfValue(simulated.value), sourceRefs, createdAt: stored.createdAt, kind: "scenario", result: simulated.value })
      expect(effects.receipt).toEqual({ schema: "sf-decision-result-receipt-v1", resultRef: stored.resultRef, kind: "scenario",
        caseRef: fixture.caseRef, requestDigest, storedDigest: digestSfValue(stored) })
      const commandDigest = digestSfValue({ kind: "scenario", result: simulated.value, caseRef: fixture.caseRef, requestDigest, sourceRefs })
      expect(effects.command).toEqual({ namespace: "cases", expectedStorageVersion: before.state.storageVersion,
        targetRef: fixture.caseRef.id, targetIncarnation: fixture.caseRef.incarnation,
        idempotencyKey: "decision-result:c09-commit-boundary", commandDigest })
      const expected = structuredClone(before.state)
      expected.storageVersion++
      expected.aggregateRevision++
      expected.value.state.revision++
      expected.value.state.versions.cases++
      expected.value.state.decisionResults ??= {}
      expected.value.state.decisionResults[stored.resultRef] = structuredClone(stored)
      expected.value.state.transactions[JSON.stringify([call.binding.principalRef, "cases", fixture.caseRef.id, "decision-result:c09-commit-boundary"])] = {
        namespace: "cases", scopeDigest: digestSfValue(["cases"]), principalRef: call.binding.principalRef,
        targetRef: fixture.caseRef.id, targetIncarnation: fixture.caseRef.incarnation, commandDigest,
        storageVersion: expected.storageVersion, aggregateRevision: expected.aggregateRevision,
        incarnation: expected.incarnation, value: structuredClone(effects.receipt),
      }
      expect(committed).toEqual(expected)
      const expectedDashboard = structuredClone(before.snapshots.dashboard)
      expectedDashboard.data.__sfProductV1 = expected.value.state
      expect(effects.committed.snapshots.dashboard).toEqual(expectedDashboard)
      expect(effects.committed.snapshots.planner).toEqual(before.snapshots.planner)
      expect(effects.committed.snapshots.procurement).toEqual(before.snapshots.procurement)
      const after = await fixture.capture()
      expect(after.state).toEqual(expected)
      expect(after.snapshots.dashboard).toEqual(expectedDashboard)
      expect(after.snapshots.procurement).toEqual(before.snapshots.procurement)
      expect(after.snapshots.planner).not.toEqual(before.snapshots.planner)
      const versions = after.snapshots.planner.data.versions as { id: string; lines: { f: number[] }[] }[]
      // The public Planner command uses zero-based monthly fields: f2 writes
      // index 2. Prove the entire real forecast, including untouched months.
      const beforeVersions = before.snapshots.planner.data.versions as typeof versions
      const expectedForecast = structuredClone(beforeVersions.find((version) => version.id === "v0")!.lines[0]!.f)
      expect(expectedForecast[2]).toBe(120)
      expectedForecast[2] = 121
      const forecast = versions.find((version) => version.id === "v0")!.lines[0]!.f
      expect(forecast[2]).toBe(121)
      expect(forecast).toEqual(expectedForecast)
      return { status: "ok", value: true }
    }))
    expect(completed).toEqual({ status: "ok", value: true })
  } finally { await fixture.cleanup() }
}, 120000)
