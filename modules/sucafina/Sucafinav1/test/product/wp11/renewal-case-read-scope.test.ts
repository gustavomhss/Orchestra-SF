import { expect, test } from "bun:test"
import type { PlannerSourceHost } from "../../../product/contracts/ports.ts"
import { domain } from "../../../runtime/planner.ts"
import { createRenewalCaseOperationVerifier } from "./renewal-operation-verifier.ts"
import { createRenewalSourceFixture } from "./renewal-source-fixture.ts"

const author = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }

test("case operation admission observes all alternatives in a read-only scope without changing durable state", async () => {
  const fixture = await createRenewalSourceFixture("omitted")
  try {
    if (!fixture.store.transactionAll) throw new Error("Real cross-surface snapshot transaction unavailable")
    const before = await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
    const verify = createRenewalCaseOperationVerifier(fixture.host, fixture.sources)
    expect(await verify(fixture.decision, fixture.context)).toBe(true)
    const sourceOnly = { alternatives: fixture.decision.alternatives.map((alternative) => ({ ...alternative, scenario: { ...alternative.scenario, operations: [], assumptions: [] } })) }
    expect(await verify(sourceOnly, fixture.context)).toBe(true)
    const after = await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
    expect(after).toEqual(before)
  } finally { await fixture.cleanup() }
})

test("case operation admission refuses a nested source write even when the source callback swallows its rejection", async () => {
  const fixture = await createRenewalSourceFixture("omitted")
  try {
    if (!fixture.store.transactionAll) throw new Error("Real cross-surface snapshot transaction unavailable")
    const before = await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
    const controls = { observations: 0, attempted: false, domainAccepted: false, committed: false, caught: false }
    const sources: PlannerSourceHost = { ...fixture.sources, resolveForecastSource: async (reference, context) => {
      const observed = await fixture.sources.resolveForecastSource(reference, context)
      controls.observations++
      if (controls.observations === 2) {
        controls.attempted = true
        await fixture.store.transaction("planner", async (snapshot) => {
          const changed = domain.execute(snapshot, author, { page: "OPEX", action: "save", id: "renewal", version: snapshot.versions["renewal:lines:renewal"]?.version ?? 0, values: { versionId: "renewal", f10: 240001 } }, { at: "2026-11-14T13:00:00Z", id: () => "grouped-source-edit", directory: [] })
          controls.domainAccepted = changed.ok
          return { commit: changed.ok, value: changed.ok }
        }).then((committed) => { controls.committed = committed }).catch(() => { controls.caught = true })
      }
      return observed
    } }
    const sourceOnly = { alternatives: fixture.decision.alternatives.map((alternative) => ({ ...alternative, scenario: { ...alternative.scenario, operations: [], assumptions: [] } })) }
    expect(await createRenewalCaseOperationVerifier(fixture.host, sources)(sourceOnly, fixture.context)).toBe(false)
    expect(controls.attempted).toBe(true)
    expect(controls.domainAccepted).toBe(true)
    expect(controls.committed).toBe(false)
    expect(controls.caught).toBe(true)
    const after = await fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
    expect(after).toEqual(before)
    expect(await fixture.host.revalidate(fixture.context)).toBe(true)
  } finally { await fixture.cleanup() }
})

test("a later case operation admission observes a committed source change instead of reusing the prior scope", async () => {
  const fixture = await createRenewalSourceFixture("omitted")
  try {
    const verify = createRenewalCaseOperationVerifier(fixture.host, fixture.sources)
    const sourceOnly = { alternatives: fixture.decision.alternatives.map((alternative) => ({ ...alternative, scenario: { ...alternative.scenario, operations: [], assumptions: [] } })) }
    expect(await verify(sourceOnly, fixture.context)).toBe(true)
    const original = await fixture.sources.resolveForecastSource(fixture.baselineScenario.baseRef, fixture.context)
    const changed = await fixture.store.transaction("planner", async (snapshot) => {
      const result = domain.execute(snapshot, author, { page: "OPEX", action: "save", id: "renewal", version: snapshot.versions["renewal:lines:renewal"]?.version ?? 0, values: { versionId: "renewal", f10: 240001 } }, { at: "2026-11-14T13:00:00Z", id: () => "later-grouped-source-edit", directory: [] })
      return { commit: result.ok, value: result.ok }
    })
    expect(changed).toBe(true)
    expect(await fixture.sources.resolveForecastSource(fixture.baselineScenario.baseRef, fixture.context)).toEqual(original)
    expect(await fixture.host.revalidate(fixture.context)).toBe(true)
    expect(await verify(sourceOnly, fixture.context)).toBe(false)
  } finally { await fixture.cleanup() }
})

test("case operation admission refuses authority revoked by an awaited source callback", async () => {
  const fixture = await createRenewalSourceFixture("omitted")
  try {
    let observations = 0
    const sources: PlannerSourceHost = { ...fixture.sources, resolveForecastSource: async (reference, context) => {
      const observed = await fixture.sources.resolveForecastSource(reference, context)
      observations++
      if (observations === 2) fixture.ui.finish(fixture.context)
      return observed
    } }
    expect(await createRenewalCaseOperationVerifier(fixture.host, sources)(fixture.decision, fixture.context)).toBe(false)
    expect(observations).toBeGreaterThanOrEqual(2)
    expect(fixture.host.requestFor(fixture.context)).toBeUndefined()
    expect(await fixture.host.revalidate(fixture.context)).toBe(false)
  } finally { await fixture.cleanup() }
})
