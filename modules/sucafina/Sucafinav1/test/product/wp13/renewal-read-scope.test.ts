import { expect, test } from "bun:test"
import type { PlannerSourceHost } from "../../../product/contracts/ports.ts"
import { domain } from "../../../runtime/planner.ts"
import { createRenewalOperationVerifier } from "../wp11/renewal-operation-verifier.ts"
import { createRenewalSourceFixture } from "../wp11/renewal-source-fixture.ts"

test("renewal admission verifies operations and source-only alternatives without changing any durable snapshot", async () => {
  const fixture = await createRenewalSourceFixture("omitted")
  try {
    const transactionAll = fixture.store.transactionAll?.bind(fixture.store)
    if (!transactionAll) throw new Error("Renewal read-scope proof requires durable multi-surface snapshots")
    const before = await transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
    const verify = createRenewalOperationVerifier(fixture.host, fixture.sources)
    expect(await verify(fixture.scenario, fixture.context)).toBe(true)
    expect(await verify({ baseRef: fixture.scenario.baseRef, operations: [], assumptions: [] }, fixture.context)).toBe(true)
    const after = await transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
    expect(after).toEqual(before)
  } finally { await fixture.cleanup() }
})

test("a later renewal admission observes a canonical source edit instead of reusing the earlier read scope", async () => {
  const fixture = await createRenewalSourceFixture("omitted")
  try {
    const verify = createRenewalOperationVerifier(fixture.host, fixture.sources)
    const scenario = { baseRef: fixture.scenario.baseRef, operations: [], assumptions: [] }
    expect(await verify(scenario, fixture.context)).toBe(true)
    const changed = await fixture.store.transaction("planner", async (snapshot) => {
      const actor = { id: "fixture-source-author", roles: ["admin"], canWrite: true, assigned: [], domains: [] }
      const result = domain.execute(snapshot, actor, {
        page: "OPEX", action: "save", id: "implementation", version: snapshot.versions[`${scenario.baseRef}:lines:implementation`]?.version ?? 0,
        values: { versionId: scenario.baseRef, f10: 46000 },
      }, { at: "2026-11-14T13:00:00Z", id: () => "read-scope-source-edit", directory: [] })
      return { commit: result.ok, value: result }
    })
    expect(changed.ok).toBe(true)
    expect(await verify(scenario, fixture.context)).toBe(false)
  } finally { await fixture.cleanup() }
})

test("renewal admission refuses a UI lease revoked during an awaited source callback inside the read scope", async () => {
  const fixture = await createRenewalSourceFixture("omitted")
  try {
    let observations = 0
    const sources: PlannerSourceHost = { ...fixture.sources, resolveForecastSource: async (reference, context) => {
      const observed = await fixture.sources.resolveForecastSource(reference, context)
      observations++
      if (observations === 2) fixture.ui.finish(fixture.context)
      return observed
    } }
    const verify = createRenewalOperationVerifier(fixture.host, sources)
    expect(await verify({ baseRef: fixture.scenario.baseRef, operations: [], assumptions: [] }, fixture.context)).toBe(false)
    expect(observations).toBeGreaterThanOrEqual(2)
    expect(await fixture.host.revalidate(fixture.context)).toBe(false)
  } finally { await fixture.cleanup() }
})
