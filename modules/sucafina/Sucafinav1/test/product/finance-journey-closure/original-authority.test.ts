import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createPortfolioCoveragePreview } from "../../../product/portfolio/coverage-preview.ts"
import { createPortfolioCoverageFixture } from "../wp13/coverage-preview-fixture.ts"

test("coverage refuses its original predicate even when the next resolution has equal data", async () => {
  const fixture = await createPortfolioCoverageFixture("bundled")
  try {
    const counts = { resolutions: 0, originalChecks: 0, replacementChecks: 0, previews: 0 }
    const digests: string[] = []
    const coverage = createPortfolioCoveragePreview({
      units: fixture.issuer,
      preview: async (...args) => { counts.previews++; return fixture.preview(...args) },
      resolveAuthority: async (...args) => {
        const resolved = await fixture.resolveAuthority(...args)
        if (resolved.status !== "ok") return resolved
        const original = counts.resolutions++ === 0
        const { isStillValid, ...data } = resolved.value
        digests.push(digestSfValue(data))
        expect(digests.every((digest) => digest === digests[0])).toBe(true)
        return {
          status: "ok",
          value: {
            ...resolved.value,
            isStillValid: async (context) => {
              const valid = await isStillValid(context)
              if (original) { counts.originalChecks++; return false }
              counts.replacementChecks++
              return valid
            },
          },
        }
      },
    })
    const result = await coverage.issue(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)
    console.info(JSON.stringify({ phase: "closure.original-predicate", counts, result }))
    expect(result).toEqual({ status: "stale", reason: "coverage-authority-changed" })
    expect(counts.originalChecks).toBe(1)
    expect(counts.previews).toBe(0)
  } finally { await fixture.cleanup() }
}, 120000)
