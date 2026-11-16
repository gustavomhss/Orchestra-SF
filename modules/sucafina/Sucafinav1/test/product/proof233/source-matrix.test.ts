import { expect, test } from "bun:test"
import { am01HostedSelectors, loadProof233SourceFixture } from "./source-fixture.ts"

// Source-byte regression ONLY. The original loader reads and hashes the
// shipped profile JSON and SKILL.md files; no provider or fabricated session.
test("233: distributed 5 profiles/18 skills/8 packs/39 C16 routes bind to original producers and consumers", async () => {
  const fixture = await loadProof233SourceFixture()
  expect(fixture.schema).toBe("sf2h.proof233.original-source-fixture.v1")
  expect(fixture.proofStatus).toBe("NOT_RUN")
  expect(fixture.profiles).toHaveLength(5)
  expect(fixture.skills).toHaveLength(18)
  expect(fixture.assignments).toHaveLength(18)
  expect(fixture.routes).toHaveLength(39)
  expect(fixture.packs).toHaveLength(8)
  expect(fixture.scenarios).toHaveLength(25)
  expect(fixture.manifestDigest).toMatch(/^[0-9a-f]{64}$/)
  expect(fixture.assignments.every((item) =>
    /^[a-f0-9]{64}$/.test(item.skillDigest) &&
    /^[a-f0-9]{64}$/.test(item.instructionsDigest) && item.status === "NOT_RUN")).toBe(true)
  expect(fixture.routes.every((route) =>
    route.producerPath.startsWith("modules/sucafina/Sucafinav1/product/") &&
    route.producerExport.length > 0 && route.consumers.length > 0 &&
    route.status === "NOT_RUN")).toBe(true)
  expect(am01HostedSelectors.length).toBeGreaterThanOrEqual(14)
  expect(fixture.noPassFromCatalog).toBe(true)
})
