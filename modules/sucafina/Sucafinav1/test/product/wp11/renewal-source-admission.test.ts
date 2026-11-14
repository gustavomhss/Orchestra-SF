import { expect, test } from "bun:test"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { DomainPortHost, PlannerSourceHost } from "../../../product/contracts/ports.ts"
import { domain } from "../../../runtime/planner.ts"
import { createRenewalOperationVerifier } from "./renewal-operation-verifier.ts"
import { createRenewalSourceFixture } from "./renewal-source-fixture.ts"

type Fixture = Awaited<ReturnType<typeof createRenewalSourceFixture>>
type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
const sourceAuthor = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }
const sourceOnlyRequest = (fixture: Fixture): ScenarioRequest => ({ baseRef: fixture.baselineScenario.baseRef, operations: [], assumptions: [] })

// The source reference is deliberately the fixture's synthetic declaration.
// A real Planner CAS changes its projection without rewriting that declaration;
// the guard must observe the producer snapshot instead of trusting the array.
async function changeRenewalSource(fixture: Fixture) {
  const changed = await fixture.store.transaction("planner", async (snapshot) => {
    const result = domain.execute(snapshot, sourceAuthor, {
      page: "OPEX", action: "save", id: "renewal", version: snapshot.versions["renewal:lines:renewal"]?.version ?? 0,
      values: { versionId: "renewal", f10: 240001 },
    }, { at: "2026-11-14T13:00:00Z", id: () => "source-edit", directory: [] })
    return { commit: result.ok, value: result }
  })
  expect(changed.ok).toBe(true)
  return changed.ok
}

test("empty-source admission observes two authenticated projections and refuses a static reference after a real Planner edit", async () => {
  const fixture = await createRenewalSourceFixture("omitted")
  try {
    const counts = { source: 0, authenticate: 0, revalidate: 0, coverage: 0, environment: 0 }
    const host: DomainPortHost = { ...fixture.host,
      authenticate: async (...args) => { counts.authenticate++; return fixture.host.authenticate(...args) },
      revalidate: async (...args) => { counts.revalidate++; return fixture.host.revalidate(...args) },
      environment: async (...args) => { counts.environment++; return fixture.host.environment(...args) },
    }
    const sources: PlannerSourceHost = { ...fixture.sources,
      resolveForecastSource: async (...args) => { counts.source++; return fixture.sources.resolveForecastSource(...args) },
      resolveForecastCoverage: async (...args) => { counts.coverage++; return fixture.sources.resolveForecastCoverage(...args) },
    }
    const verify = createRenewalOperationVerifier(host, sources)
    const request = sourceOnlyRequest(fixture)
    const originalReference = await fixture.sources.resolveForecastSource(request.baseRef, fixture.context)
    expect(await verify(request, fixture.context)).toBe(true)
    expect(counts).toEqual({ source: 2, authenticate: 2, revalidate: 3, coverage: 0, environment: 0 })
    // Invalid input cannot select the optimized path merely by omitting an array.
    expect(await verify({ baseRef: request.baseRef, assumptions: [] } as unknown as ScenarioRequest, fixture.context)).toBe(false)
    expect(await changeRenewalSource(fixture)).toBe(true)
    expect(await fixture.sources.resolveForecastSource(request.baseRef, fixture.context)).toEqual(originalReference)
    expect(await fixture.host.revalidate(fixture.context)).toBe(true)
    expect(await verify(request, fixture.context)).toBe(false)
  } finally { await fixture.cleanup() }
})

for (const race of ["second-source-resolve", "last-revalidate-source-change", "last-revalidate-revocation"] as const) {
  test(`empty-source admission refuses ${race} before its final projection`, async () => {
    const fixture = await createRenewalSourceFixture("omitted")
    try {
      const controls = { source: 0, authenticate: 0, revalidate: 0, sourceCommitted: false, revoked: false }
      const sources: PlannerSourceHost = { ...fixture.sources,
        resolveForecastSource: async (...args) => {
          controls.source++
          const observed = await fixture.sources.resolveForecastSource(...args)
          if (race === "second-source-resolve" && controls.source === 2) controls.sourceCommitted = await changeRenewalSource(fixture)
          return observed
        },
      }
      const host: DomainPortHost = { ...fixture.host,
        authenticate: async (...args) => { controls.authenticate++; return fixture.host.authenticate(...args) },
        revalidate: async (context) => {
          controls.revalidate++
          if (controls.revalidate === 2) {
            if (race === "last-revalidate-source-change") controls.sourceCommitted = await changeRenewalSource(fixture)
            if (race === "last-revalidate-revocation") { fixture.ui.finish(fixture.context); controls.revoked = true }
          }
          return fixture.host.revalidate(context)
        },
      }
      expect(await createRenewalOperationVerifier(host, sources)(sourceOnlyRequest(fixture), fixture.context)).toBe(false)
      expect(controls.source).toBe(2)
      if (race === "last-revalidate-revocation") {
        expect(controls.revalidate).toBe(2)
        expect(controls.revoked).toBe(true)
        expect(controls.sourceCommitted).toBe(false)
        expect(controls.authenticate).toBe(1)
        expect(fixture.host.requestFor(fixture.context)).toBeUndefined()
        expect(await fixture.host.revalidate(fixture.context)).toBe(false)
      } else {
        // Outside the guarded callback: a swallowed command failure cannot make
        // this race green without an actual successful canonical source commit.
        expect(controls.sourceCommitted).toBe(true)
        expect(controls.authenticate).toBe(2)
        expect(controls.revalidate).toBe(3)
        expect(await fixture.host.revalidate(fixture.context)).toBe(true)
      }
    } finally { await fixture.cleanup() }
  })
}

test("empty-source admission refuses authority revoked by its final authentication callback", async () => {
  const fixture = await createRenewalSourceFixture("omitted")
  try {
    const controls = { authenticate: 0, revalidate: 0, requestWasAvailableAtRevocation: false }
    const host: DomainPortHost = { ...fixture.host,
      authenticate: async (...args) => {
        controls.authenticate++
        const observed = await fixture.host.authenticate(...args)
        if (controls.authenticate === 2) {
          fixture.request.headers.set("authorization", "revoked")
          // requestFor alone retains this lease until real authorization runs;
          // returning the previously observed principal must not admit it.
          controls.requestWasAvailableAtRevocation = fixture.host.requestFor(fixture.context) === fixture.request
        }
        return observed
      },
      revalidate: async (...args) => { controls.revalidate++; return fixture.host.revalidate(...args) },
    }
    expect(await createRenewalOperationVerifier(host, fixture.sources)(sourceOnlyRequest(fixture), fixture.context)).toBe(false)
    expect(controls).toEqual({ authenticate: 2, revalidate: 3, requestWasAvailableAtRevocation: true })
    expect(fixture.request.headers.get("authorization")).toBe("revoked")
    expect(fixture.host.requestFor(fixture.context)).toBeUndefined()
    expect(await fixture.host.revalidate(fixture.context)).toBe(false)
  } finally { await fixture.cleanup() }
})

test("empty-source admission refuses mismatched scope, projection fields, digest and source period", async () => {
  const fixture = await createRenewalSourceFixture("omitted")
  try {
    const source = await fixture.sources.resolveForecastSource(fixture.baselineScenario.baseRef, fixture.context)
    if (source.status !== "ok") throw new Error("Canonical fixture source unavailable")
    const variants: Array<{ name: string; change: (ref: RecordEvidence) => RecordEvidence; corruptDigest?: boolean }> = [
      { name: "installation", change: (ref) => ({ ...ref, installationId: "other-installation" }) },
      { name: "project", change: (ref) => ({ ...ref, projectId: "other-project" }) },
      { name: "surface", change: (ref) => ({ ...ref, target: { ...ref.target, surface: "dashboard" } }) },
      { name: "record", change: (ref) => ({ ...ref, target: { ...ref.target, recordId: "other-version" } }) },
      { name: "fields", change: (ref) => ({ ...ref, target: { ...ref.target, fields: [...ref.target.fields, "unobserved-field"] } }) },
      { name: "projection", change: (ref) => ({ ...ref, target: { ...ref.target, projectionDigest: digestSfValue("different-projection") } }) },
      { name: "whole-month-period", change: (ref) => ({ ...ref, target: { ...ref.target, period: { start: "2027-01-02", end: "2027-12-31" } } }) },
      { name: "projection-year", change: (ref) => ({ ...ref, target: { ...ref.target, period: { start: "2028-01-01", end: "2028-12-31" } } }) },
      { name: "ref-digest", change: (ref) => ref, corruptDigest: true },
    ]
    for (const variant of variants) {
      const changed = variant.change(structuredClone(source.value.evidence))
      const evidence = { ...changed, refDigest: variant.corruptDigest ? "invalid-digest" : digestSfEvidenceRef(changed) }
      const sources: PlannerSourceHost = { ...fixture.sources,
        resolveForecastSource: async () => ({ status: "ok", value: { versionId: source.value.versionId, evidence } }),
      }
      const admitted = await createRenewalOperationVerifier(fixture.host, sources)(sourceOnlyRequest(fixture), fixture.context)
      expect({ variant: variant.name, admitted }).toEqual({ variant: variant.name, admitted: false })
    }
    expect(await fixture.host.revalidate(fixture.context)).toBe(true)
    expect(await createRenewalOperationVerifier(fixture.host, fixture.sources)(sourceOnlyRequest(fixture), fixture.context)).toBe(true)
  } finally { await fixture.cleanup() }
})

test("nonempty operations retain the canonical target verifier and never write the real source", async () => {
  const fixture = await createRenewalSourceFixture("omitted")
  try {
    const before = await fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))
    const counts = { coverage: 0, environment: 0 }
    const host: DomainPortHost = { ...fixture.host,
      environment: async (...args) => { counts.environment++; return fixture.host.environment(...args) },
    }
    const sources: PlannerSourceHost = { ...fixture.sources,
      resolveForecastCoverage: async (...args) => { counts.coverage++; return fixture.sources.resolveForecastCoverage(...args) },
    }
    const verify = createRenewalOperationVerifier(host, sources)
    expect(fixture.scenario.operations).toHaveLength(3)
    expect(await verify(fixture.scenario, fixture.context)).toBe(true)
    expect(counts.coverage).toBeGreaterThan(0)
    expect(counts.environment).toBeGreaterThan(0)
    const invalid: ScenarioRequest = { ...fixture.scenario, operations: [{ ...fixture.scenario.operations[0]!, targetRef: "implementation:13" }] }
    expect(await verify(invalid, fixture.context)).toBe(false)
    const after = await fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))
    expect(after).toBe(before)
    expect(await fixture.host.revalidate(fixture.context)).toBe(true)
  } finally { await fixture.cleanup() }
})
