import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createWp13AnalysisFixture } from "../wp13/sensitivity-fixture.ts"

test("final scenario snapshots remain independently mutable for duplicate results and revocation still denies", async () => {
  const fixture = await createWp13AnalysisFixture()
  try {
    const resolve = fixture.scenarios.resolveMany
    if (!resolve) throw new Error("Scenario host missing canonical batch")
    const references = [fixture.selectedRef, fixture.baselineRef, fixture.selectedRef]
    const first = await resolve(references, fixture.context)
    expect(first.map((entry) => entry.status)).toEqual(["ok", "ok", "ok"])
    if (first[0]?.status !== "ok" || first[1]?.status !== "ok" || first[2]?.status !== "ok") throw new Error("Canonical stored scenarios unavailable")
    const secondDigest = digestSfValue(first[2])
    const baselineDigest = digestSfValue(first[1])
    expect(first[0].value).not.toBe(first[2].value)
    expect(first[0].value.result).not.toBe(first[2].value.result)
    ;(first[0].value.result as { knownSubtotal: number | null }).knownSubtotal = -987654
    expect(digestSfValue(first[2])).toBe(secondDigest)
    expect(digestSfValue(first[1])).toBe(baselineDigest)
    const again = await resolve(references, fixture.context)
    expect(again.map((entry) => entry.status)).toEqual(["ok", "ok", "ok"])
    expect(digestSfValue(again[2])).toBe(secondDigest)
    expect(digestSfValue(again[1])).toBe(baselineDigest)
    if (again[0]?.status !== "ok") throw new Error("Repeated scenario unavailable")
    expect(digestSfValue(again[0])).toBe(secondDigest)
    const scalar = await fixture.scenarios.resolve(fixture.selectedRef, fixture.context)
    expect(digestSfValue(scalar)).toBe(secondDigest)
    fixture.access.allowed = false
    const denied = await resolve(references, fixture.context)
    expect(denied).toHaveLength(3)
    expect(denied.every((entry) => entry.status !== "ok")).toBe(true)
  } finally {
    await fixture.cleanup()
  }
}, 120000)
