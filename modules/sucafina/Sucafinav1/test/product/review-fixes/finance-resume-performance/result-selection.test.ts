import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { SfProductStatePort } from "../../../../product/contracts/state.ts"
import { createSfDecisionResultStore, readHistoricalScenarios } from "../../../../product/decisions/result-store.ts"
import { createRenewalSourceFixture } from "../../wp11/renewal-source-fixture.ts"

async function resultFixture() {
  const fixture = await createRenewalSourceFixture("omitted")
  try {
    // Exercise the constructor-owned projection with an actual admitted lease.
    expect(Object.isFrozen(fixture.context)).toBe(true)
    expect(Object.isFrozen(fixture.context.binding)).toBe(true)
    const counts = { cases: 0, authorizeCase: 0, verifySources: 0, revalidate: 0 }
    const controls: { opaque: boolean; afterSources?: (occurrence: number) => Promise<void> } = { opaque: false }
    const state: SfProductStatePort = { ...fixture.state, read: (request, namespace, project) => {
      if (namespace === "cases") counts.cases++
      // Wrapping loses constructor provenance and exercises the original full
      // private clone. Both routes retain the real C08 ingress/egress fence.
      return controls.opaque
        ? fixture.state.read(request, namespace, (value, authority) => project(value, authority))
        : fixture.state.read(request, namespace, project)
    } }
    let sequence = 0
    const results = createSfDecisionResultStore({
      state,
      host: { ...fixture.host, revalidate: async (context) => { counts.revalidate++; return fixture.host.revalidate(context) } },
      authorizeCase: async (decision, context) => {
        counts.authorizeCase++
        return decision.id === fixture.caseRef.id && decision.incarnation === fixture.caseRef.incarnation &&
          decision.participants.includes(context.binding.principalRef) && await fixture.host.revalidate(context)
      },
      verifySources: async (_value, references, context) => {
        counts.verifySources++
        const occurrence = counts.verifySources
        for (const reference of references) {
          if (reference.kind !== "record" || reference.target.surface !== "planner" || !reference.target.period) return false
          const observed = await fixture.planner.compareForecast({ baseRef: reference.refId, candidateRef: reference.refId, period: reference.target.period, currency: "USD" }, context)
          if (observed.status !== "ok" || !observed.value.sourceRefs.some((source) => source.refDigest === reference.refDigest)) return false
        }
        await controls.afterSources?.(occurrence)
        return true
      },
      createId: () => `selected-result-${++sequence}`,
      now: () => "2026-11-13T00:00:00Z",
    })
    const write = async (result: typeof fixture.selectedResult, id: string) => {
      const value = await results.write({ kind: "scenario", result, caseRef: fixture.caseRef, sourceRefs: result.sourceRefs, requestDigest: digestSfValue({ id, result }), idempotencyKey: id }, fixture.context)
      if (value.status !== "ok") throw new Error(`Real Planner result was not persisted: ${value.reason}`)
      return value.value
    }
    const selected = await write(fixture.selectedResult, "selected")
    const baseline = await write(fixture.baselineResult, "baseline")
    const reset = () => Object.assign(counts, { cases: 0, authorizeCase: 0, verifySources: 0, revalidate: 0 })
    const change = async (id: string, work: Parameters<SfProductStatePort["transaction"]>[2]) => {
      const before = await fixture.state.read(fixture.request, "cases", () => null)
      if (before.status !== "ok") throw new Error("Real C08 mutation observation unavailable")
      const changed = await fixture.state.transaction(fixture.request, { namespace: "cases", expectedStorageVersion: before.storageVersion, targetRef: fixture.caseRef.id, targetIncarnation: fixture.caseRef.incarnation, idempotencyKey: id, commandDigest: digestSfValue(id) }, work)
      expect(changed.status).toBe("ok")
    }
    reset()
    return { ...fixture, results, selected, baseline, counts, controls, reset, change }
  } catch (error) { await fixture.cleanup(); throw error }
}

test("admitted result projections equal opaque reads without dropping a C08 or source callback", async () => {
  const fixture = await resultFixture()
  try {
    const observations: { scalar: Awaited<ReturnType<typeof fixture.results.read>>; batch: Awaited<ReturnType<typeof readHistoricalScenarios>> }[] = []
    for (const opaque of [false, true]) {
      fixture.controls.opaque = opaque
      fixture.reset()
      const scalar = await fixture.results.read({ resultRef: fixture.selected.resultRef, kind: "scenario" }, fixture.context)
      expect(scalar).toEqual({ status: "ok", value: fixture.selected })
      expect(fixture.counts).toEqual({ cases: 3, authorizeCase: 2, verifySources: 2, revalidate: 4 })
      fixture.reset()
      const batch = await readHistoricalScenarios(fixture.results, [fixture.selected.resultRef, "unknown-result", fixture.baseline.resultRef, fixture.selected.resultRef], fixture.context)
      expect(batch).toEqual([{ status: "ok", value: fixture.selected }, { status: "unavailable", reason: "result-unavailable" }, { status: "ok", value: fixture.baseline }, { status: "ok", value: fixture.selected }])
      expect(fixture.counts).toEqual({ cases: 3, authorizeCase: 6, verifySources: 6, revalidate: 13 })
      observations.push({ scalar, batch })
    }
    expect(observations[0]).toEqual(observations[1])
    const first = observations[0]!.batch[0]!
    const duplicate = observations[0]!.batch[3]!
    if (first.status !== "ok" || duplicate.status !== "ok") throw new Error("Real duplicate result unavailable")
    expect(first.value).not.toBe(duplicate.value)
    expect(first.value.result).not.toBe(duplicate.value.result)
    expect(await fixture.host.revalidate(fixture.context)).toBe(true)
  } finally { await fixture.cleanup() }
}, 60000)

for (const opaque of [false, true]) {
  for (const reader of ["scalar", "batch"] as const) {
    for (const mutation of ["case", "result", "authority"] as const) {
      test(`admitted ${opaque ? "opaque" : "projected"} ${reader} refuses ${mutation} changed after the final source callback`, async () => {
        const fixture = await resultFixture()
        try {
          fixture.controls.opaque = opaque
          let reached = false
          fixture.controls.afterSources = async (occurrence) => {
            if (occurrence !== (reader === "scalar" ? 2 : 4)) return
            reached = true
            if (mutation === "authority") { fixture.ui.finish(fixture.context); return }
            await fixture.change(`last-source-${mutation}`, async (state) => {
              if (mutation === "case") state.cases[fixture.caseRef.id] = { ...state.cases[fixture.caseRef.id]!, objective: "Changed after source verification" }
              else {
                const stored = state.decisionResults?.[fixture.selected.resultRef]
                if (!stored) throw new Error("Real selected result unavailable for mutation")
                state.decisionResults![fixture.selected.resultRef] = { ...stored, createdAt: "2026-11-14T00:00:00Z" }
              }
              return { commit: true, value: true }
            })
          }
          const observed = reader === "scalar"
            ? [await fixture.results.read({ resultRef: fixture.selected.resultRef, kind: "scenario" }, fixture.context)]
            : await readHistoricalScenarios(fixture.results, [fixture.selected.resultRef, fixture.baseline.resultRef], fixture.context)
          expect(reached).toBe(true)
          expect(fixture.counts.verifySources).toBe(reader === "scalar" ? 2 : 4)
          expect(observed[0]).toMatchObject({ status: "denied", reason: "result-access-unavailable" })
          if (reader === "batch") expect(observed[1]!.status).toBe(mutation === "result" ? "ok" : "denied")
        } finally { await fixture.cleanup() }
      }, 60000)
    }
  }
}

test("admitted projections preserve absent result maps and null case refusal", async () => {
  const fixture = await resultFixture()
  try {
    await fixture.change("null-case", async (state) => {
      Reflect.set(state.cases, fixture.caseRef.id, null)
      return { commit: true, value: true }
    })
    for (const opaque of [false, true]) {
      fixture.controls.opaque = opaque
      expect(await fixture.results.read({ resultRef: fixture.selected.resultRef, kind: "scenario" }, fixture.context)).toEqual({ status: "denied", reason: "result-access-unavailable" })
    }
    await fixture.change("absent-result-map", async (state) => {
      delete state.decisionResults
      return { commit: true, value: true }
    })
    for (const opaque of [false, true]) {
      fixture.controls.opaque = opaque
      expect(await fixture.results.read({ resultRef: fixture.selected.resultRef, kind: "scenario" }, fixture.context)).toEqual({ status: "unavailable", reason: "result-unavailable" })
      expect(await readHistoricalScenarios(fixture.results, [fixture.selected.resultRef], fixture.context)).toEqual([{ status: "unavailable", reason: "result-unavailable" }])
    }
  } finally { await fixture.cleanup() }
}, 60000)
