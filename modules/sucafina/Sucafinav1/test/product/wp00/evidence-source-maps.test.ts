import { expect, test } from "bun:test"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { digestSfEvidenceRef, sfEvidenceSourceMaps } from "../../../product/contracts/canonical.ts"

function signed<T extends BusinessEvidenceRef>(ref: T): T {
  return { ...ref, refDigest: digestSfEvidenceRef(ref) }
}
const identity = { schema: "sf-evidence-v1" as const, installationId: "installation", projectId: "project", evidenceLevel: "observed" as const, refDigest: "" }

test("memory identity maps join original evidence digests and retain independent scopes sharing a record id", () => {
  const january = signed({ ...identity, kind: "record" as const, refId: "january-scope", target: { surface: "dashboard" as const, recordType: "projects", recordId: "p1", incarnation: "scope-jan", version: 7, fields: ["budget"], period: { start: "2026-01-01", end: "2026-01-31" }, projectionDigest: "a".repeat(64) } })
  const february = signed({ ...january, refId: "february-scope", target: { ...january.target, incarnation: "scope-feb", version: 2, period: { start: "2026-02-01", end: "2026-02-28" } } })
  const calculation = signed({ ...identity, kind: "calculation" as const, refId: "calculation", target: { calculationId: "c1", runId: "r1", engineVersion: "v1", inputDigest: "b".repeat(64), resultDigest: "c".repeat(64), sourceRefs: [january, february], period: { start: "2026-01-01", end: "2026-02-28" }, currency: "USD" } })
  const policy = signed({ ...identity, kind: "policy" as const, refId: "policy", target: { packageId: "policy-1", version: "reviewed-v3", sourceDigest: "d".repeat(64), ruleId: "rule", reviewRef: "human-review", scope: "project" } })
  const maps = sfEvidenceSourceMaps([calculation, policy])
  expect(maps.sourceVersions).toEqual({ [january.refDigest]: 7, [february.refDigest]: 2 })
  expect(maps.sourceIncarnations).toEqual({ [january.refDigest]: "scope-jan", [february.refDigest]: "scope-feb" })
  expect(maps.sourceVersions).not.toHaveProperty(calculation.refDigest)
  expect(maps.sourceVersions).not.toHaveProperty(policy.refDigest)
  const current = signed({ ...january, target: { ...january.target, version: 8 } })
  // Historical authorization joins resolution.ref (january), not a changed resolution.currentRef.
  expect(maps.sourceVersions[january.refDigest]).toBe(7)
  expect(maps.sourceVersions[current.refDigest]).toBeUndefined()
  expect(() => sfEvidenceSourceMaps([{ ...january, target: { ...january.target, version: 999 } }])).toThrow("SF_EVIDENCE_DIGEST_INVALID")
})
