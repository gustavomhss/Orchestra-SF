import { AsyncLocalStorage } from "node:async_hooks"
import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createPlannerResultPersistence } from "../../../../product/planner/persistence.ts"
import { ancestryProofFixture } from "./planner-calculation-ancestry-fixture.ts"

type Fixture = Awaited<ReturnType<typeof ancestryProofFixture>>
type Capture = Awaited<ReturnType<Fixture["capture"]>>
type Input = Parameters<ReturnType<typeof createPlannerResultPersistence>>[0]
type Counts = Fixture["counts"]
type Phase = {
  index: number; incoming: Input; sameCall: boolean; before: Counts; after?: Counts
  beforeState: Capture; afterState?: Capture; result?: unknown; closed: boolean
}
type Callback = {
  kind: "simulate" | "resolve-case"; phase: number; sameCall: boolean; request?: unknown
  result: unknown; results: number; sources: number
}

async function validateWithRealProducers(changeAfterWrite: boolean) {
  const fixture = await ancestryProofFixture()
  try {
    return await fixture.ui("sf_scenario_simulate", (call) => fixture.business.withCase(call, fixture.caseRef, {}, async () => {
      // Produce the input through the public calculation producer. Each replay
      // below delegates to the same mounted Planner, including its nested owner.
      const preview = await fixture.business.calculations.simulateScenario(fixture.incoming, call)
      if (preview.status !== "ok") throw new Error("The real nested scenario preview was unavailable: " + JSON.stringify(preview))
      const incoming = { kind: "scenario" as const, request: structuredClone(fixture.incoming), result: preview.value }
      const originalInput = structuredClone(incoming)
      const before = await fixture.capture()
      if (before.state.status !== "ok") throw new Error("The complete initial C08 envelope was unavailable")
      fixture.reset()
      const phase = new AsyncLocalStorage<Phase>()
      const phases: Phase[] = [], callbacks: Callback[] = [], order: string[] = []
      let open = 0
      const writes: {
        request: Parameters<Fixture["business"]["results"]["write"]>[0]; sameCall: boolean
        phase: number; openAtEntry: number; openAtExit?: number; before: Counts; after?: Counts
        result?: Awaited<ReturnType<Fixture["business"]["results"]["write"]>>
        committed?: Capture; changed?: Awaited<ReturnType<Fixture["changeSource"]>>
      }[] = []
      // These are local facades passed only to this factory. No registered
      // scalar, batch, result, source, coverage or C08 reader is replaced.
      const persist = createPlannerResultPersistence({
        store: {
          ...fixture.business.results,
          write: async (request, context) => {
            const observation: typeof writes[number] = {
              request: structuredClone(request), sameCall: context === call,
              phase: phase.getStore()?.index ?? 0, openAtEntry: open, before: { ...fixture.counts },
            }
            writes.push(observation)
            order.push("write:enter")
            const result = await fixture.business.results.write(request, context)
            observation.result = structuredClone(result)
            observation.after = { ...fixture.counts }
            if (result.status === "ok") {
              // The unchanged C09 write has already committed and completed
              // its own canonical readback before this fresh observation.
              observation.committed = await fixture.capture()
              if (changeAfterWrite) observation.changed = await fixture.changeSource(call)
            }
            observation.openAtExit = open
            order.push("write:exit")
            return result
          },
        },
        replay: {
          simulateScenario: async (request, context) => {
            const current = phase.getStore()
            const result = await fixture.business.planner.simulateScenario(request, context)
            callbacks.push({ kind: "simulate", phase: current?.index ?? 0, sameCall: context === call,
              request: structuredClone(request), result: structuredClone(result),
              results: fixture.counts.results - (current?.before.results ?? 0),
              sources: fixture.counts.sources - (current?.before.sources ?? 0) })
            order.push("simulate:" + (current?.index ?? 0))
            return result
          },
        },
        resolveCase: async (context) => {
          const current = phase.getStore()
          const result = await fixture.business.resolveCase(context)
          callbacks.push({ kind: "resolve-case", phase: current?.index ?? 0, sameCall: context === call,
            result: structuredClone(result), results: fixture.counts.results - (current?.before.results ?? 0),
            sources: fixture.counts.sources - (current?.before.sources ?? 0) })
          order.push("resolve-case:" + (current?.index ?? 0))
          return result
        },
        observeScenarioRead: async (value, context, work) => {
          const current: Phase = { index: phases.length + 1, incoming: structuredClone(value),
            sameCall: context === call, before: { ...fixture.counts }, beforeState: await fixture.capture(), closed: false }
          phases.push(current)
          order.push("validate:" + current.index + ":enter")
          open++
          try {
            const result = await phase.run(current, () => fixture.business.calculations.observeRead(value, context, work))
            current.result = structuredClone(result)
            return result
          } finally {
            open--
            current.after = { ...fixture.counts }
            current.afterState = await fixture.capture()
            current.closed = true
            order.push("validate:" + current.index + ":exit")
          }
        },
      })
      const key = changeAfterWrite ? "validation-source-change" : "validation-independent-phases"
      const result = await persist(incoming, key, call)
      const after = await fixture.capture()
      return { status: "ok" as const, value: { result, incoming, originalInput, before, after, phases, callbacks,
        writes, order, open, key, caseRef: fixture.caseRef, binding: structuredClone(call.binding), counts: { ...fixture.counts } } }
    }))
  } finally { await fixture.cleanup() }
}

type Completed = Awaited<ReturnType<typeof validateWithRealProducers>>
type Observation = Extract<Completed, { status: "ok" }>["value"]

function expectCommittedEnvelope(observed: Observation) {
  expect(observed.writes).toHaveLength(1)
  const write = observed.writes[0]!
  expect(write.sameCall).toBe(true)
  expect(write.phase).toBe(0)
  expect(write.openAtEntry).toBe(0)
  expect(write.openAtExit).toBe(0)
  expect(write.result?.status).toBe("ok")
  if (!write.result || write.result.status !== "ok" || !write.committed || write.committed.state.status !== "ok" ||
    observed.before.state.status !== "ok" || !write.after) throw new Error("The committed result and complete C08 envelope are required")
  const stored = write.result.value
  if (stored.kind !== "scenario" || observed.incoming.kind !== "scenario") throw new Error("The persisted scenario is required")
  const references = [...observed.incoming.result.sourceRefs, ...observed.incoming.result.costCoverage.evaluatedSourceRefs,
    ...observed.incoming.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
  const sourceRefs = references.filter((ref, index) => references.findIndex((entry) => entry.refDigest === ref.refDigest) === index)
  const requestDigest = digestSfValue(observed.incoming.request)
  expect(write.request).toEqual({ kind: "scenario", result: observed.incoming.result, caseRef: observed.caseRef,
    requestDigest, sourceRefs, idempotencyKey: observed.key })
  expect(Number.isFinite(Date.parse(stored.createdAt))).toBe(true)
  expect(stored).toEqual({ schema: "sf-decision-result-v1", resultRef: stored.resultRef, caseRef: observed.caseRef,
    principalRef: observed.binding.principalRef, accessRevision: observed.binding.accessRevision, policyVersion: observed.binding.policyVersion,
    requestDigest, resultDigest: digestSfValue(observed.incoming.result), sourceRefs,
    createdAt: stored.createdAt, kind: "scenario", result: observed.incoming.result })
  // Six original leaf reads in preflight and six in the independent readback.
  // A proof retained across the commit would incorrectly reduce this to six.
  expect(write.after.results - write.before.results).toBe(12)
  expect(write.after.sources).toBeGreaterThan(write.before.sources)
  expect(write.after.coverage).toBeGreaterThan(write.before.coverage)
  const receipt = { schema: "sf-decision-result-receipt-v1", resultRef: stored.resultRef, kind: "scenario",
    caseRef: observed.caseRef, requestDigest, storedDigest: digestSfValue(stored) }
  const commandDigest = digestSfValue({ kind: "scenario", result: observed.incoming.result, caseRef: observed.caseRef, requestDigest, sourceRefs })
  const expected = structuredClone(observed.before.state)
  expected.storageVersion++
  expected.aggregateRevision++
  expected.value.state.revision++
  expected.value.state.versions.cases++
  expected.value.state.decisionResults ??= {}
  expected.value.state.decisionResults[stored.resultRef] = structuredClone(stored)
  expected.value.state.transactions[JSON.stringify([observed.binding.principalRef, "cases", observed.caseRef.id, "decision-result:" + observed.key])] = {
    namespace: "cases", scopeDigest: digestSfValue(["cases"]), principalRef: observed.binding.principalRef,
    targetRef: observed.caseRef.id, targetIncarnation: observed.caseRef.incarnation, commandDigest,
    storageVersion: expected.storageVersion, aggregateRevision: expected.aggregateRevision,
    incarnation: expected.incarnation, value: receipt,
  }
  expect(write.committed.state).toEqual(expected)
  const expectedDashboard = structuredClone(observed.before.snapshots.dashboard)
  expectedDashboard.data.__sfProductV1 = expected.value.state
  expect(write.committed.snapshots.dashboard).toEqual(expectedDashboard)
  expect(write.committed.snapshots.planner).toEqual(observed.before.snapshots.planner)
  expect(write.committed.snapshots.procurement).toEqual(observed.before.snapshots.procurement)
  expect(observed.after.state).toEqual(expected)
  expect(observed.after.snapshots.dashboard).toEqual(expectedDashboard)
  expect(observed.after.snapshots.procurement).toEqual(observed.before.snapshots.procurement)
  return { write, stored, expected }
}

test("both complete scenario validations retain their own six-read ancestry proof and close before C09 publication", async () => {
  const completed = await validateWithRealProducers(false)
  expect(completed.status).toBe("ok")
  if (completed.status !== "ok") throw new Error("The real UI and selected-case operation did not complete: " + JSON.stringify(completed))
  const observed = completed.value
  const { write, stored } = expectCommittedEnvelope(observed)
  expect(observed.result).toEqual({ status: "ok", value: { resultRef: stored.resultRef } })
  expect(observed.incoming).toEqual(observed.originalInput)
  expect(observed.open).toBe(0)
  expect(observed.phases).toHaveLength(2)
  expect(observed.callbacks.map((entry) => [entry.kind, entry.phase])).toEqual([
    ["resolve-case", 0], ["simulate", 1], ["resolve-case", 1], ["simulate", 2], ["resolve-case", 2],
  ])
  expect(observed.callbacks.every((entry) => entry.sameCall)).toBe(true)
  expect(observed.callbacks[0]!.result).toEqual({ status: "ok", value: observed.caseRef })
  expect(observed.callbacks[0]!.results).toBe(6)
  for (const phase of observed.phases) {
    if (!phase.after) throw new Error("A complete readonly validation is required")
    const callbacks = observed.callbacks.filter((entry) => entry.phase === phase.index)
    expect(phase.incoming).toEqual(observed.originalInput)
    expect(phase.sameCall).toBe(true)
    expect(phase.closed).toBe(true)
    expect(phase.result).toEqual({ status: "ok", value: true })
    expect(phase.after.results - phase.before.results).toBe(6)
    expect(callbacks.map((entry) => entry.results)).toEqual([6, 6])
    expect(callbacks[0]!.request).toEqual(observed.originalInput.request)
    expect(callbacks[0]!.result).toEqual({ status: "ok", value: observed.originalInput.result })
    expect(callbacks[1]!.result).toEqual({ status: "ok", value: observed.caseRef })
    expect(callbacks[0]!.sources).toBeGreaterThan(0)
    expect(callbacks[1]!.sources).toBeGreaterThan(callbacks[0]!.sources)
    expect(phase.after.coverage).toBeGreaterThan(phase.before.coverage)
  }
  expect(observed.order).toEqual(["resolve-case:0", "validate:1:enter", "simulate:1", "resolve-case:1", "validate:1:exit",
    "write:enter", "write:exit", "validate:2:enter", "simulate:2", "resolve-case:2", "validate:2:exit"])
  expect(observed.phases[0]!.beforeState).toEqual(observed.before)
  expect(observed.phases[0]!.afterState).toEqual(observed.before)
  expect(observed.phases[1]!.beforeState).toEqual(write.committed)
  expect(observed.phases[1]!.afterState).toEqual(write.committed)
  expect(observed.after).toEqual(write.committed)
  expect(observed.counts.results).toBe(30)
}, 120000)

test("a real Planner change after successful C09 readback invalidates the next validation without losing the committed receipt", async () => {
  const completed = await validateWithRealProducers(true)
  expect(completed.status).toBe("ok")
  if (completed.status !== "ok") throw new Error("The real UI and selected-case operation did not complete: " + JSON.stringify(completed))
  const observed = completed.value
  const { write } = expectCommittedEnvelope(observed)
  expect(write.changed?.ok).toBe(true)
  expect(observed.result).toEqual({ status: "unavailable", reason: "calculation-ancestry-observation-changed" })
  expect(observed.incoming).toEqual(observed.originalInput)
  expect(observed.open).toBe(0)
  expect(observed.phases).toHaveLength(2)
  expect(observed.callbacks.map((entry) => [entry.kind, entry.phase])).toEqual([
    ["resolve-case", 0], ["simulate", 1], ["resolve-case", 1], ["simulate", 2],
  ])
  expect(observed.callbacks.every((entry) => entry.sameCall)).toBe(true)
  const first = observed.phases[0]!, second = observed.phases[1]!
  if (!first.after || !second.after) throw new Error("Both readonly validation attempts must finish")
  expect(first.result).toEqual({ status: "ok", value: true })
  expect(first.after.results - first.before.results).toBe(6)
  expect(first.beforeState).toEqual(observed.before)
  expect(first.afterState).toEqual(observed.before)
  expect(second.incoming).toEqual(observed.originalInput)
  expect(second.sameCall).toBe(true)
  expect(second.closed).toBe(true)
  expect(second.result).toEqual({ status: "unavailable", reason: "calculation-ancestry-observation-changed" })
  expect(second.after.results - second.before.results).toBe(0)
  expect(second.after.revalidations).toBeGreaterThan(second.before.revalidations)
  expect(observed.callbacks[3]!.request).toEqual(observed.originalInput.request)
  // The mounted Planner closes its nested owner too: an invalidated parent
  // converts the internal stale evidence result into this public failure.
  expect(observed.callbacks[3]!.result).toEqual({ status: "unavailable", reason: "calculation-ancestry-observation-changed" })
  expect(observed.order).toEqual(["resolve-case:0", "validate:1:enter", "simulate:1", "resolve-case:1", "validate:1:exit",
    "write:enter", "write:exit", "validate:2:enter", "simulate:2", "validate:2:exit"])
  expect(second.beforeState.state).toEqual(write.committed!.state)
  expect(second.afterState).toEqual(second.beforeState)
  expect(observed.after).toEqual(second.beforeState)
  expect(observed.after.snapshots.planner).not.toEqual(write.committed!.snapshots.planner)
  const versions = observed.after.snapshots.planner.data.versions as { id: string; lines: { f: number[] }[] }[]
  const oldVersions = write.committed!.snapshots.planner.data.versions as typeof versions
  const expectedForecast = structuredClone(oldVersions.find((version) => version.id === "v0")!.lines[0]!.f)
  expect(expectedForecast[2]).toBe(120)
  expectedForecast[2] = 121
  expect(versions.find((version) => version.id === "v0")!.lines[0]!.f).toEqual(expectedForecast)
  expect(observed.counts.results).toBe(24)
}, 120000)
