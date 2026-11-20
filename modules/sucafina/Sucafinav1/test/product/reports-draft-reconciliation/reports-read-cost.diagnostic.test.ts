import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import JSZip from "jszip"
import { canonicalSfValue } from "../../../product/contracts/canonical.ts"
import type { PreservedReview } from "../../../product/contracts/context.ts"
import type { ReviewAgendaCatalog } from "../../../product/reviews/agenda-picker.ts"
import type { ReviewAgendaPreview } from "../../../product/reviews/selection.ts"
import { object } from "../../../runtime/contract.ts"
import { createSfExtendedBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/extended-business-services.ts"
import { createSfMemoryServices } from "../../../../../../apps/cli/src/sucafina-product/memory-services.ts"
import { localRecordReview } from "../../../../../../apps/cli/src/sucafina-product/review-collaboration.ts"
import { sfReviewReadCostDiagnostic, snapshotBoundReview } from "../../../../../../apps/cli/src/sucafina-product/review-read-integrity.ts"
import { createSfResidentReviewReaders, sfResidentReviewSnapshotReaders } from "../../../../../../apps/cli/src/sucafina-product/review-resident-readers.ts"
import { reportsCorpus } from "../../../../../../packages/app-shell/e2e/sucafina/reports-support/corpus.ts"
import { financialCompositionFixture } from "../wp10/integration/financial-composition-fixture.ts"

// CI-only experiment on product fe2. Neither this file nor the timing observer
// is an integration candidate. The ordinary tests and their budgets are unchanged.
const productSha = "fe2dfe77fe0817b0ae388d74f96d82657ea8af44"
const nominalSnapshot = "5a839065256777bc063dd1cb5cfa911aa896acfc"
const artifactRun = 44647936470
const artifactId = 14591195417

test("diagnostic measures real resident Reports reads with synthetic inert snapshot volume", async () => {
  const fixture = await financialCompositionFixture()
  const resident = createSfResidentReviewReaders({ authority: fixture.authority, business: fixture.business })
  const extended = createSfExtendedBusinessServices({ authority: fixture.authority, business: fixture.business,
    persistence: fixture.persistence, ...fixture.guards, origin: "https://example.test", reviewReaders: resident.readers })
  const memory = createSfMemoryServices({ authority: fixture.authority,
    business: { ...fixture.business, planner: extended.portfolioServices.planner }, signalRegistryWrites: new WeakSet<object>() })
  resident.bindOutcome(memory.reviewOutcome)
  try {
    const corpus = reportsCorpus(fixture.at.slice(0, 10))
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      Object.assign(snapshot.data, corpus.data)
      return { commit: true, value: undefined }
    })
    const result = async (response: Response | undefined) => {
      if (!response) throw new Error("Actual Reports route unavailable")
      expect(response.status).toBe(200)
      const body = object(await response.json())
      expect(body.status).toBe("ok")
      return body.value
    }
    const post = (mode: string, payload: unknown) => extended.productHttp(new Request("https://example.test/dashboard?sf=" + mode, {
      method: "POST", headers: { origin: "https://example.test", "content-type": "application/json" }, body: JSON.stringify(payload),
    }), "dashboard")
    const query = new URLSearchParams({ sf: "review-agenda", domain: "dashboard", start: corpus.annual.start,
      end: corpus.annual.end, dashboardTopics: JSON.stringify(["budget", "projects", "hot-topics"]) })
    const catalog = await result(await extended.productHttp(new Request("https://example.test/dashboard?" + query), "dashboard")) as ReviewAgendaCatalog
    expect(catalog.options).toHaveLength(3)
    const preview = await result(await post("review-agenda", { items: catalog.options.map((option) => option.item) })) as ReviewAgendaPreview
    expect(preview.sections.find((section) => section.title === "Projects")?.recordCount).toBe(25)
    const saved = await result(await post("review-preserve", { selectionRef: preview.selectionRef, sectionRefs: preview.sectionRefs })) as PreservedReview
    const canonical = canonicalSfValue(saved)
    const reviewBytes = Buffer.byteLength(canonical)
    expect(reviewBytes).toBeGreaterThan(600_000)
    expect(localRecordReview(saved)).toBe(true)
    expect(snapshotBoundReview(saved)).toBe(true)
    expect(sfResidentReviewSnapshotReaders(resident.readers, fixture.authority.host)?.()).toBe(true)
    const readQuery = new URLSearchParams({ sf: "review-read", reviewRef: saved.id })
    const measure = async (phase: string, inertBytes: number) => {
      sfReviewReadCostDiagnostic.begin()
      const started = performance.now()
      try {
        const current = await result(await extended.productHttp(new Request("https://example.test/dashboard?" + readQuery), "dashboard"))
        const elapsed = performance.now() - started
        const stages = sfReviewReadCostDiagnostic.finish()
        // Inclusive state/producer times contain child spans; they must not be
        // summed with those child spans. Output contains no body/entity/auth data.
        console.info("REPORTS_READ_COST_DIAGNOSTIC " + JSON.stringify({
          productSha, snapshot: process.env.GITHUB_SHA, phase, inertBytes, reviewBytes, elapsedMilliseconds: elapsed, stages,
        }))
        expect(canonicalSfValue(current) === canonical).toBe(true)
        for (const stage of ["current-snapshots-copy", "live-full-snapshot-digest", "captured-full-snapshot-digest",
          "full-snapshot-fence-digest", "scope-state-read-inclusive", "canonical-producer-read"]) {
          expect(stages[stage]?.calls ?? 0).toBeGreaterThan(0)
        }
      } finally {
        sfReviewReadCostDiagnostic.finish()
      }
    }
    await measure("baseline", 0)
    const inertBytes = 5_700_000
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      expect(Object.hasOwn(snapshot.data, "__reportsReadCostDiagnosticVolume")).toBe(false)
      // Explicitly synthetic inert volume, comparable only in size to a PPTX's
      // base64. This is not a StoredReport, receipt, source, grant or review body.
      snapshot.data.__reportsReadCostDiagnosticVolume = "x".repeat(inertBytes)
      return { commit: true, value: undefined }
    })
    await measure("synthetic-inert-volume", inertBytes)
  } finally {
    sfReviewReadCostDiagnostic.finish()
    extended.dispose()
    await fixture.dispose()
  }
}, 120_000)

test("diagnostic losslessly recompresses the retained real Reports PPTX in memory", async () => {
  expect(JSZip.version).toBe("3.10.1")
  const root = process.env.RUNNER_TEMP
  if (!root) throw new Error("Retained Reports evidence requires Actions runner temp")
  const files = async (directory: string): Promise<string[]> => (await Promise.all((await readdir(directory, { withFileTypes: true })).map(async (entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? files(path) : entry.isFile() ? [path] : []
  }))).flat()
  const candidates = (await files(join(root, "audit-reports-evidence"))).filter((path) => path.endsWith(".pptx")).sort()
  expect(candidates.length).toBeGreaterThan(0)
  const original = await readFile(candidates[0]!)
  expect(original.byteLength).toBe(4_271_825)
  // An attachment may also be copied into the HTML report. Prove that every
  // retained PPTX candidate has the same bytes before selecting one copy.
  for (const path of candidates.slice(1)) expect((await readFile(path)).equals(original)).toBe(true)
  const loadStarted = performance.now()
  const archive = await JSZip.loadAsync(original, { checkCRC32: true })
  const loadMilliseconds = performance.now() - loadStarted
  const compressStarted = performance.now()
  const compressed = await archive.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } })
  const compressMilliseconds = performance.now() - compressStarted
  const reopenStarted = performance.now()
  const reopened = await JSZip.loadAsync(compressed, { checkCRC32: true })
  const reopenMilliseconds = performance.now() - reopenStarted
  const verifyStarted = performance.now()
  const names = Object.keys(archive.files).sort()
  expect(JSON.stringify(Object.keys(reopened.files).sort()) === JSON.stringify(names)).toBe(true)
  let uncompressedBytes = 0
  for (const name of names) {
    const before = archive.files[name]!
    const after = reopened.files[name]!
    expect(after.dir).toBe(before.dir)
    const originalEntry = await before.async("uint8array")
    const compressedEntry = await after.async("uint8array")
    expect(Buffer.from(originalEntry).equals(Buffer.from(compressedEntry))).toBe(true)
    uncompressedBytes += originalEntry.byteLength
  }
  const verifyMilliseconds = performance.now() - verifyStarted
  console.info("REPORTS_PPTX_LOSSLESS_DIAGNOSTIC " + JSON.stringify({
    productSha, snapshot: process.env.GITHUB_SHA, nominalSnapshot, artifactRun, artifactId,
    originalBytes: original.byteLength, compressedBytes: compressed.byteLength,
    originalSha256: createHash("sha256").update(original).digest("hex"),
    compressedSha256: createHash("sha256").update(compressed).digest("hex"),
    entryCount: names.length, uncompressedBytes, loadMilliseconds, compressMilliseconds, reopenMilliseconds, verifyMilliseconds,
  }))
  // No timing/compression-ratio threshold and no report/storage mutation.
  // Byte-preserving ZIP equivalence does not establish closure of C05 or RPT-02.
}, 120_000)
