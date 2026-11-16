import { expect, test } from "bun:test"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import { observeSfReportHealth } from "../../../../../apps/cli/src/sucafina-product/native-ui/report-health.ts"
import { createExportArtifactFixture } from "../product/export-artifact-closure/fixture.ts"

test("C14 report health uses actual descriptors and original C08 authority without creating an artifact", async () => {
  const f = await createExportArtifactFixture()
  try {
    await f.preserve()
    const original = f.incoming("review-report")
    const admitted = await f.authority.readContextAdmission(original)
    if (admitted.status !== "ok") throw new Error("original context unavailable")
    const before = await f.productState()
    const input = { ui: f.authority.ui, state: f.authority.state, source: f.app }
    const result = await observeSfReportHealth(input, original, admitted.stamp)
    const ids = result.map((item) => String(item.operationId))
    if (Object.hasOwn(SfOperationRegistry, "reviews.report.prepare")) expect(ids).toContain("reviews.report.prepare")
    if (Object.hasOwn(SfOperationRegistry, "files.export.review")) expect(ids).toContain("files.export.review")
    expect(ids).not.toContain("reviews.export.docx")
    expect(ids).not.toContain("reviews.export.pptx")
    expect(await f.productState()).toEqual(before)
    f.sessions.owner!.active = false
    expect(await observeSfReportHealth(input, original, admitted.stamp)).toEqual([])
  } finally { await f.dispose() }
})
