import { createHash } from "node:crypto"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { renderPreservedReview } from "../../../product/reviews/render.ts"
import { createReport } from "../../../runtime/reports.ts"
import { exportFixture, extractReportText } from "./export-fixture.ts"

if (process.env.GITHUB_ACTIONS !== "true") throw new Error("Generate WP07 export fixtures only in hosted GitHub Actions")

const directory = process.env.WP07_EXPORT_DIR || "/tmp/wp07-exports"
await mkdir(directory, { recursive: true })
const fixture = exportFixture()
const files: { name: string; sha256: string; bytes: number; format: string; kind: string; selectedRecords: number; slides: number | null; figures: number; extractedTextSha256: string }[] = []
for (const format of ["pptx", "docx"] as const) {
  for (const kind of ["preserved", "legacy"] as const) {
    const result = kind === "preserved"
      ? await renderPreservedReview(fixture.review, { title: "WP07 complete preserved review", format, sectionRefs: fixture.sectionRefs })
      : await createReport(structuredClone(fixture.legacy), { id: "synthetic-admin", roles: ["admin"], canWrite: true }, { at: "2026-11-13T04:01:10Z", id: () => "unused", directory: [] }, { title: "WP07 complete legacy report", year: 2026, format, topics: ["All Projects"] })
    if (!result.ok) throw new Error(`${kind} ${format} generation failed`)
    const extracted = await extractReportText(result.bytes, format)
    const text = extracted.text.replace(/\s/gu, "")
    for (let index = 1; index <= 25; index++) {
      const id = `${kind === "preserved" ? "PRJ-" : "LEGACY-PROJECT-"}${String(index).padStart(2, "0")}${kind === "preserved" ? ":" : ""}`
      if (text.split(id).length - 1 !== 1 || text.split(`END-NOTE-${String(index).padStart(2, "0")}`).length - 1 !== 1) throw new Error(`${kind} ${format}: incomplete or duplicated ${id}`)
    }
    if (kind === "preserved" && (!text.includes("END-COMMENT-V3") || !text.includes("Noauthorizedserieswascaptured") || extracted.figures !== 1)) throw new Error(`${format}: chart, missing state or preserved comment lost`)
    const name = `${kind}-long.${format}`
    await Bun.write(join(directory, name), result.bytes)
    await Bun.write(join(directory, `${kind}-${format}.txt`), extracted.text)
    files.push({ name, sha256: createHash("sha256").update(result.bytes).digest("hex"), bytes: result.bytes.length, format, kind, selectedRecords: kind === "preserved" ? 26 : 25, slides: extracted.pages, figures: extracted.figures, extractedTextSha256: createHash("sha256").update(extracted.text).digest("hex") })
  }
}
await Bun.write(join(directory, "manifest.json"), JSON.stringify({ schema: "wp07-export-inspection-v1", fixture: "explicit synthetic data; 25 projects, long notes, monthly financial trajectory, empty section and preserved human comment", productSha: process.env.WP07_PRODUCT_SHA ?? process.env.GITHUB_SHA ?? "unavailable", runId: process.env.GITHUB_RUN_ID ?? "unavailable", runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? "unavailable", contentExtraction: "passed", visualInspection: "pending; render and inspect these exact files", files }, null, 2))
console.log(JSON.stringify({ status: "generated", directory, files: files.map((file) => ({ name: file.name, sha256: file.sha256, slides: file.slides })) }))
