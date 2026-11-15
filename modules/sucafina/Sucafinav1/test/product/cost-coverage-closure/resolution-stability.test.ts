import { expect, test } from "bun:test"
import type { BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import { reassessScenarioCoverage } from "../../../product/decisions/cost-coverage.ts"
import { stabilityFixture } from "./stability-fixture.ts"

test("C10 captures each evidence resolution identity once across validation and assessment", async () => {
  const fixture = stabilityFixture()
  const observations: { state: number; ref: number }[] = []
  const result = await reassessScenarioCoverage({ scenario: fixture.scenario, basis: fixture.input.basis,
    baseline: fixture.assessment, entries: fixture.entries, supports: fixture.input.supports,
    resolveEvidence: async (refs): Promise<readonly BusinessEvidenceResolution[]> => {
      const resolved = await fixture.resolveEvidence(refs)
      return resolved.map((item) => {
        const reads = { state: 0, ref: 0 }
        observations.push(reads)
        // The real exact-ref resolver supplies the first observation; getters
        // expose a subsequent change rather than a permissive positive grant.
        return { ...item,
          get state() { return ++reads.state === 1 ? item.state : "stale" },
          get ref() { reads.ref++; return item.ref },
        }
      })
    } })
  expect(result).toEqual({ ...fixture.scenario, unresolvedConditions: [] })
  expect(observations.length).toBeGreaterThan(0)
  expect(observations.every((reads) => reads.state === 1 && reads.ref === 1)).toBe(true)
})
