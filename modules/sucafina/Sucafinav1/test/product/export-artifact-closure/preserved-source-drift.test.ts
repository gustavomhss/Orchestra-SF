import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { CapabilityResult } from "../../../product/contracts/sf-execution.ts"
import { rows } from "../../../runtime/contract.ts"
import { createExportArtifactFixture, inspectOfficeBytes } from "./fixture.ts"
import { recordExportEvidence } from "./evidence.ts"

test("WP07.T04.CHK.02 newly generated DOCX and PPTX keep captured values after current source drift", async () => {
  const f = await createExportArtifactFixture()
  try {
    const review = await f.preserve()
    const projections = review.sections.map((section) => section.content as DomainProjection)
    const values = projections.flatMap((projection) => projection.values)
    const evidenceRefs = values.flatMap((value) => value.sourceRefs)
    expect(values.find((value) => value.id === "license:1:forecast")).toMatchObject({ value: 110, currency: "USD" })
    await f.changeCandidate(130)
    const current = () => f.persistence.transaction("planner", async (snapshot) => ({ commit: false,
      value: rows(rows(snapshot.data.versions).find((version) => version.id === "export66-v1")?.lines).find((line) => line.id === "license")?.f }))
    expect(await current()).toEqual(Array(12).fill(130))
    for (const format of ["docx", "pptx"] as const) {
      const response = await f.request("review-report", { key: `export66-first-report-after-drift-${format}`,
        payload: { reviewRef: review.id, sectionRefs: review.sections.map((section) => section.id), format } })
      const result = await response.json() as CapabilityResult
      expect({ http: response.status, result }).toMatchObject({ http: 200, result: { status: "ok" } })
      if (result.status !== "ok" || !result.outputRef) throw new Error("New report after source drift unavailable")
      const stored = await f.document(result.outputRef)
      expect(stored).toMatchObject({ reviewRef: review.id, reviewDigest: digestSfValue(review), recordCount: 2, evidenceRefs })
      const download = await f.request("review-download", { query: { artifactRef: result.outputRef } })
      expect(download.status).toBe(200)
      const bytes = new Uint8Array(await download.arrayBuffer())
      const opened = await inspectOfficeBytes(bytes, format)
      if (typeof stored.digest !== "string") throw new Error("Committed Office artifact omitted its digest")
      expect(opened.sha256).toBe(stored.digest)
      for (const value of values) {
        expect(opened.compact).toContain(`${value.id}:${value.value === null ? "unavailable" : String(value.value)}${value.unit ?? ""}${value.currency ?? ""}`.replace(/\s+/g, ""))
        expect(opened.compact).toContain(`${value.period.start}–${value.period.end}`)
      }
      for (const refId of new Set(evidenceRefs.map((ref) => ref.refId))) expect(opened.compact).toContain(refId)
      expect(opened.compact).not.toContain("license:1:forecast:130USD")
      expect(await current()).toEqual(Array(12).fill(130))
      await recordExportEvidence({ caseId: `after-drift-${format}`, name: String(stored.name), mediaType: download.headers.get("content-type")!, bytes,
        observations: { criterion: "WP07.T04.CHK.02", corpus: "synthetic", generation_after_source_change: true, new_command: true,
          captured_forecast: 110, current_forecast: 130, currency: "USD", horizon: f.period, review_ref: review.id, review_version: review.version,
          source_refs: review.sourceRefs, evidence_ref_ids: [...new Set(evidenceRefs.map((ref) => ref.refId))], all_captured_values_present: true,
          current_source_unchanged: true, reader: "JSZip CRC + Saxes", visual_render_qualification: "external-renderer-required" } })
    }
  } finally { await f.dispose() }
}, 120000)
