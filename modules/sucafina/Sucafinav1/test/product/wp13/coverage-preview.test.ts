import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createPortfolioCoveragePreview } from "../../../product/portfolio/coverage-preview.ts"
import { createPortfolioCoverageFixture } from "./coverage-preview-fixture.ts"

test("WP13 composes real Planner and C10 interval proofs at 55000/55001 without applying the preview", async () => {
  const fixture = await createPortfolioCoverageFixture("bundled")
  try {
    const before = structuredClone(fixture.scenario)
    const issued = await fixture.coverage.issue(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)
    if (issued.status !== "ok") throw new Error(`Coverage interval unavailable: ${JSON.stringify(issued)}`)
    expect(issued.value.certificate.bounds).toEqual({ parameterRef: "implementation:11", minimum: 10000, maximum: 70000 })
    expect(issued.value.assessment.coverageState).toBe("complete")
    expect(issued.value.baselineAssessment.coverageState).toBe("complete")
    const shared = issued.value.assessment.entries.filter((entry) => entry.status === "included" && ["implementation", "migration", "training"].includes(entry.categoryId))
    expect(shared).toHaveLength(3)
    expect(shared.every((entry) => entry.status === "included" && entry.componentRefs.includes("implementation:11"))).toBe(true)
    expect(issued.value.assessment.entries.filter((entry) => entry.status === "not-applicable")).toHaveLength(3)
    const exact = await fixture.exact(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)
    if (exact.status !== "ok") throw new Error(`Canonical exact threshold unavailable: ${JSON.stringify(exact)}`)
    expect(exact.value.value).toBeCloseTo(55000, 8)
    for (const amount of [55000, 55001]) {
      const preview = await fixture.preview({ baselineRef: fixture.baselineRef, scenario: fixture.withAmount(amount) }, fixture.context)
      if (preview.status !== "ok") throw new Error(`Real sample unavailable: ${JSON.stringify(preview)}`)
      const original = digestSfValue(preview.value)
      const qualified = await fixture.coverage.qualify(issued.value.intervalRef, amount, preview.value, fixture.context)
      if (qualified.status !== "ok") throw new Error(`Complete sample coverage unavailable: ${JSON.stringify(qualified)}`)
      expect(qualified.value.metricValue).toBe(amount === 55000 ? -20000 : -19999)
      expect(qualified.value.assessment.coverageState).toBe("complete")
      expect(qualified.value.hypotheticalConditions).toContain("scenario-is-hypothetical")
      expect(qualified.value.resolvedCoverageConditions).toContain("scenario-coverage-reassessment-required")
      expect(await fixture.coverage.verify(qualified.value, fixture.context)).toBe(true)
      expect(digestSfValue(preview.value)).toBe(original)
      expect(preview.value.sample.knownSubtotal).toBe(amount === 55000 ? 220000 : 220001)
      expect(preview.value.sample.total).toBeNull()
      expect(preview.value.sample.comparisonStatus).toBe("conditioned")
      expect(preview.value.sample.restrictions).toContain("preview-not-applied")
      expect(preview.value.comparison.completeDifference).toBeNull()
    }
    expect(await fixture.coverage.revalidate(issued.value.intervalRef, fixture.context)).toBe(true)
    const stored = await fixture.results.read({ kind: "scenario", resultRef: fixture.selectedRef }, fixture.context)
    if (stored.status !== "ok" || stored.value.kind !== "scenario") throw new Error("Stored source scenario unavailable")
    expect(stored.value.result).toEqual(fixture.selectedResult)
    expect(stored.value.result.knownSubtotal).toBe(210000)
    expect(fixture.scenario).toEqual(before)
    const decision = await fixture.state.read(fixture.request, "cases", (state) => state.cases[fixture.caseRef.id])
    if (decision.status !== "ok" || !decision.value) throw new Error("Persisted case unavailable")
    expect(decision.value.choices).toEqual([])
    expect(decision.value.receipts).toEqual([])
  } finally { await fixture.cleanup() }
}, 180000)

test("WP13 distinguishes omitted/null training from explicit zero and moves the real boundary to 15000/15001 after the 40000 quote", async () => {
  for (const training of ["omitted", "null", "zero", "confirmed"] as const) {
    const fixture = await createPortfolioCoverageFixture(training)
    try {
      const issued = await fixture.coverage.issue(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)
      expect(fixture.selectedResult.knownSubtotal).toBe(training === "confirmed" ? 250000 : 210000)
      if (training === "omitted" || training === "null") {
        expect(issued.status).not.toBe("ok")
        expect(fixture.selectedCoverage.assessment.coverageState).toBe("pending")
        const row = fixture.selectedCoverage.assessment.entries.find((entry) => entry.categoryId === "training")
        expect(row).toMatchObject({ status: "pending", reason: training === "omitted" ? "missing-category" : "component-unresolved" })
        if (training === "null") expect(fixture.selectedResult.components.find((component) => component.id === "training:11")?.amount).toBeNull()
        continue
      }
      if (issued.status !== "ok") throw new Error(`Explicit training coverage unavailable: ${JSON.stringify(issued)}`)
      const exact = await fixture.exact(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)
      if (exact.status !== "ok") throw new Error(`Canonical training threshold unavailable: ${JSON.stringify(exact)}`)
      const boundary = training === "confirmed" ? 15000 : 55000
      expect(exact.value.value).toBeCloseTo(boundary, 8)
      expect(fixture.selectedResult.components.filter((component) => component.id === "training:11")).toHaveLength(1)
      expect(fixture.selectedResult.components.find((component) => component.id === "training:11")?.amount).toBe(training === "confirmed" ? 40000 : 0)
      for (const amount of [boundary, boundary + 1]) {
        const preview = await fixture.preview({ baselineRef: fixture.baselineRef, scenario: fixture.withAmount(amount) }, fixture.context)
        if (preview.status !== "ok") throw new Error(`Training sample unavailable: ${JSON.stringify(preview)}`)
        const qualified = await fixture.coverage.qualify(issued.value.intervalRef, amount, preview.value, fixture.context)
        if (qualified.status !== "ok") throw new Error(`Training sample coverage unavailable: ${JSON.stringify(qualified)}`)
        expect(qualified.value.metricValue).toBe(amount === boundary ? -20000 : -19999)
        expect(preview.value.sample.knownSubtotal).toBe(amount === boundary ? 220000 : 220001)
        expect(preview.value.sample.total).toBeNull()
      }
    } finally { await fixture.cleanup() }
  }
}, 180000)

test("WP13 rejects forged metrics, changed fixed components, unissued qualifications and revoked scope evidence", async () => {
  const fixture = await createPortfolioCoverageFixture()
  try {
    const issued = await fixture.coverage.issue(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)
    const preview = await fixture.preview({ baselineRef: fixture.baselineRef, scenario: fixture.withAmount(55000) }, fixture.context)
    if (issued.status !== "ok" || preview.status !== "ok") throw new Error(`Real coverage fixture unavailable: ${JSON.stringify({ issued, preview })}`)
    const altered = structuredClone(preview.value)
    altered.sample = { ...altered.sample, knownSubtotal: 220001, comparisonStatus: "conditioned", total: null, components: altered.sample.components.map((component) => component.id === "bridge:11" ? { ...component, amount: 60001 } : component) }
    expect(await fixture.coverage.qualify(issued.value.intervalRef, 55000, altered, fixture.context)).toMatchObject({ status: "unavailable", reason: "coverage-preview-outside-proof" })
    const forged = structuredClone(preview.value)
    forged.metric.value = -20001
    forged.comparison = { ...forged.comparison, comparisonStatus: "conditioned", completeDifference: null, knownDifference: -20001 }
    expect(await fixture.coverage.qualify(issued.value.intervalRef, 55000, forged, fixture.context)).toMatchObject({ status: "stale", reason: "coverage-preview-changed" })
    expect((await fixture.coverage.qualify(issued.value.intervalRef, 70001, preview.value, fixture.context)).status).not.toBe("ok")
    expect((await fixture.coverage.qualify("unissued", 55000, preview.value, fixture.context)).status).not.toBe("ok")
    const qualified = await fixture.coverage.qualify(issued.value.intervalRef, 55000, preview.value, fixture.context)
    if (qualified.status !== "ok") throw new Error(`Authentic qualification unavailable: ${JSON.stringify(qualified)}`)
    expect(await fixture.coverage.verify({ ...qualified.value, metricValue: -20001 }, fixture.context)).toBe(false)
    fixture.revokeStatement()
    expect(await fixture.coverage.revalidate(issued.value.intervalRef, fixture.context)).toBe(false)
    expect(await fixture.coverage.verify(qualified.value, fixture.context)).toBe(false)
    expect((await fixture.coverage.qualify(issued.value.intervalRef, 55000, preview.value, fixture.context)).status).not.toBe("ok")
  } finally { await fixture.cleanup() }
}, 180000)

test("WP13 fences source/rule/access changes and refuses an authority mutated during its validity callback", async () => {
  for (const change of ["source", "rule", "access", "borrowed"] as const) {
    const fixture = await createPortfolioCoverageFixture()
    try {
      if (change === "borrowed") {
        const coverage = createPortfolioCoveragePreview({ units: fixture.issuer, preview: fixture.preview, resolveAuthority: async (...args) => {
          const resolved = await fixture.resolveAuthority(...args)
          if (resolved.status !== "ok") return resolved
          const check = resolved.value.isStillValid
          return { status: "ok", value: { ...resolved.value, isStillValid: async (context) => { resolved.value.selection.version++; return check(context) } } }
        } })
        expect(await coverage.issue(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)).toMatchObject({ status: "stale", reason: "coverage-authority-changed" })
        continue
      }
      const issued = await fixture.coverage.issue(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)
      if (issued.status !== "ok") throw new Error(`Coverage interval unavailable: ${JSON.stringify(issued)}`)
      if (change === "source") fixture.revokeSource(fixture.scenario.baseRef)
      if (change === "rule") expect((await fixture.reviseRule()).status).toBe("ok")
      if (change === "access") fixture.deny()
      expect(await fixture.coverage.revalidate(issued.value.intervalRef, fixture.context)).toBe(false)
    } finally { await fixture.cleanup() }
  }
}, 180000)

test("WP13 does not qualify a real foreign currency preview with missing FX", async () => {
  const fixture = await createPortfolioCoverageFixture("bundled", "eur-missing-fx")
  try {
    expect(fixture.scenario.operations[0]?.currency).toBe("EUR")
    expect(fixture.selectedResult.components.some((component) => component.currency === "USD" && component.amount === null)).toBe(true)
    expect(fixture.selectedResult.total).toBeNull()
    expect((await fixture.coverage.issue(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)).status).not.toBe("ok")
    expect((await fixture.exact(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)).status).not.toBe("ok")
  } finally { await fixture.cleanup() }
}, 180000)
