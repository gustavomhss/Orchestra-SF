import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { observeSfRecallHealth } from "../../../../../apps/cli/src/sucafina-product/native-ui/recall-health.ts"
import { sfHasOperationalResource } from "../../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts"
import { withMemoryIntegrityFixture } from "../product/wp10/memory-integrity/fixture.ts"

test("CaseRecall health uses the initialized Atlas source and original C08 authority", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (f) => {
    const original = f.staleRequest
    // Memory C08 admission is valid only under its real atomic read snapshot.
    const inRoot = f.driver.readSnapshotRoot
    if (!inRoot) throw new Error("Actual C08 read-only snapshot root unavailable")
    const admitted = await inRoot(() => f.authority.readContextAdmission(original))
    if (admitted.status !== "ok") throw new Error("original memory context unavailable")
    const input = { ui: f.authority.ui, state: f.authority.state, source: f.business.caseRecallSource }
    const result = await inRoot(() => observeSfRecallHealth(input, original, admitted.stamp))
    if (sfHasOperationalResource("intelligence.memory-similar-cases"))
      expect(result).toEqual([{ operationId: "intelligence.memory-similar-cases", state: "ready", reason: null, operational: true }])
    else expect(result).toEqual([])
    f.access.allowed = false
    expect(await inRoot(() => observeSfRecallHealth(input, original, admitted.stamp))).toEqual([])
    f.access.allowed = true
    f.business.dispose()
    expect(await inRoot(() => observeSfRecallHealth(input, original, admitted.stamp))).toEqual([])
  }, "recall-health-contract")
})
