import { expect, test } from "bun:test"
import JSZip from "jszip"
import { validReportArtifactMetadata, validateReportArtifact } from "../../../runtime/artifact.ts"
import { createReport } from "../../../runtime/reports.ts"
import { empty } from "../../fixture/persistence.ts"

const media = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

async function report(format: "docx" | "pptx") {
  const snapshot = empty()
  snapshot.data.hotTopics = [{ id: "envelope-source", action: "Envelope validation source", status: "open", priority: "normal" }]
  const artifact = await createReport(snapshot, { id: "envelope-reader", canWrite: true, roles: ["admin"] },
    { at: "2026-11-14T12:00:00Z", id: () => "envelope-id", directory: [] },
    { format, title: "Envelope report", year: 2026, topics: ["Hot Topics & Actions"] })
  if (!artifact.ok) throw new Error("Actual report generation failed")
  return artifact
}

// These are envelope controls; installed authorization/persistence is covered separately.
test.each(["docx", "pptx"] as const)("EA66-ENVELOPE accepts the actual %s producer at its exact byte limit", async (format) => {
  const artifact = await report(format)
  expect(await validateReportArtifact(artifact, format, artifact.bytes.length)).toBe(true)
  expect(await validateReportArtifact(artifact, format, artifact.bytes.length - 1)).toBe(false)
  expect(artifact.type).toBe(media[format])
})

test("EA66-FILENAME rejects unsafe names without rejecting well-formed Unicode", () => {
  for (const name of ["../report.docx", "..\\report.docx", "/report.docx", "C:report.docx", "report\r\n.docx", "report\0.docx", "report\u007f.docx", "report\u202e.docx", "report\u2066.docx", "report\ud800.docx", "report\udfff.docx", "CON.docx", "LPT1.docx", ".report.docx", " report.docx", "report.docx ", `${"a".repeat(251)}.docx`]) {
    expect(validReportArtifactMetadata({ name, type: media.docx }, "docx")).toBe(false)
  }
  for (const name of ["Report.docx", "Café ação 📄.docx", `${"a".repeat(250)}.docx`]) {
    expect(validReportArtifactMetadata({ name, type: media.docx }, "docx")).toBe(true)
  }
  expect(validReportArtifactMetadata({ name: "Report.docx", type: media.pptx }, "docx")).toBe(false)
  expect(validReportArtifactMetadata({ name: "Report.pptx", type: media.docx }, "docx")).toBe(false)
  expect(validReportArtifactMetadata({ name: "Report.pdf", type: "application/pdf" }, "pdf")).toBe(false)
})

test("EA66-CONTAINER rejects a DOCX relabeled as PPTX, missing main parts and ZIP path traversal", async () => {
  const original = await report("docx")
  expect(await validateReportArtifact({ ...original, name: "Report.pptx", type: media.pptx }, "pptx", 5_000_000)).toBe(false)
  for (const removed of ["word/document.xml", "[Content_Types].xml", "_rels/.rels"]) {
    const archive = await JSZip.loadAsync(original.bytes)
    archive.remove(removed)
    expect(await validateReportArtifact({ ...original, bytes: await archive.generateAsync({ type: "uint8array" }) }, "docx", 5_000_000)).toBe(false)
  }
  const mixed = await JSZip.loadAsync(original.bytes)
  mixed.file("ppt/presentation.xml", "<presentation />")
  expect(await validateReportArtifact({ ...original, bytes: await mixed.generateAsync({ type: "uint8array" }) }, "docx", 5_000_000)).toBe(false)
  const traversal = await JSZip.loadAsync(original.bytes)
  traversal.file("../unsafe.xml", "<unsafe />")
  expect(await validateReportArtifact({ ...original, bytes: await traversal.generateAsync({ type: "uint8array" }) }, "docx", 5_000_000)).toBe(false)
})

test("EA66-BYTES rejects empty, invalid and truncated containers and invalid limits", async () => {
  const artifact = await report("docx")
  for (const bytes of [new Uint8Array(), new TextEncoder().encode("not a document"), artifact.bytes.subarray(0, 30)]) {
    expect(await validateReportArtifact({ ...artifact, bytes }, "docx", 5_000_000)).toBe(false)
  }
  for (const limit of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(await validateReportArtifact(artifact, "docx", limit)).toBe(false)
  }
})
