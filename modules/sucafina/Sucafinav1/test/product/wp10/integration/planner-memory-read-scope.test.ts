import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import { createSfMemoryInputProducer } from "../../../../../../../apps/cli/src/sucafina-product/input-producer-memory.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

function ok<T>(result: PortResult<T>, label: string): T {
  if (result.status !== "ok") throw new Error(`${label}: ${JSON.stringify(result)}`)
  return result.value
}

// Real SQLite, scoped Planner source, C08 and consumed UI authority. The empty
// case is input data; both memory passes use the actual case/Atlas composition.
async function prepare(deadline: ReturnType<typeof compositionTestDeadline>) {
  const fixture = await financialCompositionFixture({ atlas: true, signal: deadline.signal,
    beforeEnvironment: async () => deadline.check() })
  deadline.own(() => fixture.dispose())
  await fixture.persistence.transaction("planner", async (snapshot) => {
    snapshot.data.versions = [{ id: "memory-source", year: 2026, closed: 0,
      lines: [{ id: "line", name: "Recorded service", sec: "opex", el: "licenses", cur: "USD",
        b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(100) }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
    return { commit: true, value: undefined }
  })
  await fixture.persistence.initializeSources("planner")
  const call = await fixture.read()
  deadline.own(() => fixture.authority.ui.finish(call))
  const source = ok(await fixture.business.plannerProduct.issueSource("memory-source", call), "Issue actual Planner source")
  const caseRef = { id: "memory-case", incarnation: "memory-case-incarnation", version: 1 }
  const initial: DecisionCase = { ...caseRef, state: "draft", objective: "Inspect current costs", currency: "USD",
    horizon: { start: "2026-01-01", end: "2026-12-31" }, criteria: [{ id: "cost", description: "Preserve full coverage", required: true }],
    participants: ["person"], sourceRefs: [source.evidence], alternatives: [], costCoverageBases: [], assumptions: [], questions: [],
    choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const seeded = await fixture.authority.state.transaction(fixture.request("memory-case-empty"), { namespace: "cases", expectedStorageVersion: 0,
    targetRef: fixture.authority.creationTarget.ref, targetIncarnation: fixture.authority.creationTarget.incarnation,
    idempotencyKey: "memory-case-empty", commandDigest: digestSfValue(initial) }, async (state) => {
    state.cases[initial.id] = initial
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error(`Empty case unavailable: ${JSON.stringify(seeded)}`)
  const selection = { currentCase: caseRef, query: "Inspect only this case and the empty authorized precedent scope.",
    recallScope: { cases: [], period: initial.horizon, includeHistorical: false } }
  // This adapter test does not start a model or manufacture a grant/output.
  const request = { caseRef, objective: selection.query, profileId: "sf_portfolio", profileVersion: "fixture",
    skillId: "sf-consultar-memoria-decisoria", skillVersion: "fixture", manifestDigest: "fixture",
    outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: ["sf_decision_recall"] }
  const dependencies = { cases: fixture.business.cases, planner: fixture.business.planner,
    procurement: fixture.business.procurement, context: fixture.business.context,
    host: fixture.business.host, caseRecall: fixture.business.caseRecall }
  return { ...fixture, call, caseRef, initial, seeded, selection, request, dependencies }
}

test("Planner memory input preserves two independent complete observations on every invocation", async () => {
  const deadline = compositionTestDeadline("planner-memory-composition")
  try {
    const fixture = await prepare(deadline), observations: unknown[] = []
    const producer = createSfMemoryInputProducer({ ...fixture.dependencies,
      withMemoryObservation: (request, call, work) => fixture.business.withMemoryObservation(request, call, async (recall) => {
        const value = await work(async (incoming, trusted) => {
          const observed = await recall(incoming, trusted)
          observations.push(structuredClone(observed))
          return observed
        })
        return value
      }) })
    for (const count of [2, 4]) {
      expect(await producer.prepare(fixture.selection, fixture.request, fixture.call))
        .toEqual({ status: "ok", value: fixture.selection })
      expect(observations).toHaveLength(count)
      for (const observed of observations)
        expect(observed).toEqual({ status: "ok", matches: [], limitations: [], accessRevision: fixture.call.binding.accessRevision })
    }
    expect(await fixture.authority.state.read(fixture.authority.host.requestFor(fixture.call)!, "cases",
      (state) => state.cases[fixture.caseRef.id])).toEqual({
      status: "ok", value: fixture.initial,
      storageVersion: fixture.seeded.storageVersion,
      aggregateRevision: fixture.seeded.aggregateRevision,
      incarnation: fixture.seeded.incarnation,
    })
  } finally { await deadline.close() }
}, 120_000)

test("Planner memory input observes a C08 edit between independent passes", async () => {
  const deadline = compositionTestDeadline("planner-memory-next-pass")
  try {
    const fixture = await prepare(deadline)
    let passes = 0
    const producer = createSfMemoryInputProducer({ ...fixture.dependencies,
      withMemoryObservation: async (request, call, work) => {
        const result = await fixture.business.withMemoryObservation(request, call, work)
        if (++passes === 1) await fixture.store.transaction("dashboard", async (snapshot) => {
          (snapshot.data.__sfProductV1 as SfProductState).cases[fixture.caseRef.id]!.objective = "Changed between memory passes"
          return { commit: true, value: undefined }
        })
        return result
      } })
    expect(await producer.prepare(fixture.selection, fixture.request, fixture.call))
      .toEqual({ status: "unavailable", reason: "analysis-source-unavailable" })
    expect(passes).toBe(2)
    expect(await fixture.authority.host.revalidate(fixture.call)).toBe(true)
  } finally { await deadline.close() }
}, 120_000)

for (const boundary of ["case", "source", "lease"] as const) {
  test(`Planner memory observation refuses ${boundary} changes after its final callback`, async () => {
    const deadline = compositionTestDeadline(`planner-memory-final-${boundary}`)
    try {
      const fixture = await prepare(deadline)
      let passes = 0
      const producer = createSfMemoryInputProducer({ ...fixture.dependencies,
        withMemoryObservation: (request, call, work) => fixture.business.withMemoryObservation(request, call, async (recall) => {
          const result = await work(recall)
          passes++
          expect(result).toBeDefined()
          if (boundary === "lease") fixture.authority.ui.finish(call)
          else await fixture.store.transaction(boundary === "case" ? "dashboard" : "planner", async (snapshot) => {
            if (boundary === "case")
              (snapshot.data.__sfProductV1 as SfProductState).cases[fixture.caseRef.id]!.objective = "Changed before observation egress"
            else {
              const versions = snapshot.data.versions as { lines: { f: number[] }[] }[]
              versions[0]!.lines[0]!.f[0] = 101
            }
            return { commit: true, value: undefined }
          })
          return result
        }) })
      expect(await producer.prepare(fixture.selection, fixture.request, fixture.call))
        .toEqual({ status: "unavailable", reason: "analysis-source-unavailable" })
      expect(passes).toBe(1)
      expect(await fixture.authority.host.revalidate(fixture.call)).toBe(boundary !== "lease")
    } finally { await deadline.close() }
  }, 120_000)
}
