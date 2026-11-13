import { expect, test } from "bun:test"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createReviewPort } from "../../../product/reviews/port.ts"
import type { ReviewSection } from "../../../product/reviews/port.ts"
import type { ReviewCapabilityHost } from "../../../product/reviews/capabilities.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { SfProductState } from "../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { testPersistence } from "../../fixture/persistence.ts"

test("preserved review survives changed projections and is denied after access revocation", async () => {
  const storage = testPersistence()
  const state = createSfProductState({
    persistence: storage.persistence,
    createId: () => "state-incarnation",
    resolveTarget: async () => ({ incarnation: "review-incarnation" }),
    authorize: async () => ({ principalRef: "principal", accessRevision: "access", policyVersion: "policy" }),
  })
  const binding = { kind: "ui", binding: { principalRef: "principal", installationId: "i", projectId: "p", accessRevision: "access", policyVersion: "policy" } } as unknown as TrustedDomainContext
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const evidence = { schema: "sf-evidence-v1", refId: "record", installationId: "i", projectId: "p", refDigest: "digest", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "forecast", recordId: "1", incarnation: "original", version: 1, fields: ["value"], projectionDigest: "digest" } } as const
  const source = { surface: "planner", type: "forecast", id: "1", incarnation: "original", version: 1, fields: ["value"], period, observedAt: "2026-11-13T00:00:00Z" } as const
  const section: ReviewSection = {
    id: "forecast", title: "Forecast", period, recordCount: 1,
    comments: [{ id: "comment", version: 3, content: "original note", authorRef: "author", createdAt: "2026-11-13T00:00:00Z", sourceRefs: [source] }],
    projection: {
      context: { installationId: "i", projectId: "p", principalRef: "principal", accessRevision: "access", policyVersion: "policy", surface: "planner", period, currency: "USD", sourceRefs: [source], capabilities: [] },
      version: 1, engineVersion: "v1", components: [], missing: [],
      values: [{ id: "forecast", value: 1320, period, granularity: "year", sourceRefs: [evidence], drilldown: null, evidenceState: "confirmed" }, { id: "budget", value: 1500, period, granularity: "year", sourceRefs: [evidence], drilldown: null, evidenceState: "confirmed" }],
    },
  }
  const access = { allowed: true, sections: true, comments: true, sourceAvailable: true }
  const port = createReviewPort({
    state, now: () => "2026-11-13T00:00:00Z", requestFor: () => new Request("https://example.test"), authorizeSections: async () => access.sections, authorizeComments: async () => access.comments, authorizeSensitivity: async () => access.allowed, revalidate: async () => access.allowed, revalidateEvidence: async () => access.allowed,
    select: async () => access.sourceAvailable ? { status: "ok", value: [section] } : { status: "unavailable", reason: "source-removed" },
  })
  const emptySection: ReviewSection = { ...section, id: "restricted", recordCount: 0, comments: [], projection: { ...section.projection, values: [], components: [], context: { ...section.projection.context, sourceRefs: [] } } }
  const restricted = createReviewPort({
    state, now: () => "2026-11-13T00:00:00Z", requestFor: () => new Request("https://example.test"), authorizeSections: async () => false, authorizeComments: async () => true, authorizeSensitivity: async () => true, revalidate: async () => true, revalidateEvidence: async () => true,
    select: async () => ({ status: "ok", value: [emptySection] }),
  })
  expect(await restricted.preview("selection", ["restricted"], binding)).toEqual({ status: "denied", reason: "access-unavailable" })
  const input = { id: "review-1", selectionRef: "selection", sectionRefs: ["forecast"], expectedStorageVersion: 0, idempotencyKey: "save-1", targetIncarnation: "review-incarnation" }
  section.chart = { status: "ok", viewId: "BI01", series: [{ id: "series", label: "Forecast", unit: "USD", role: "outlook", valueIds: ["forecast"], values: [{ ...section.projection.values[0]!, value: 999 }] }], limitations: [], unassigned: [] }
  expect(await port.preserve(input, binding)).toEqual({ status: "unavailable", reason: "chart-projection-mismatch" })
  section.chart = { status: "ok", viewId: "BI01", series: [{ id: "series", label: "Forecast", unit: "USD", role: "outlook", valueIds: ["forecast"], values: [section.projection.values[0]!] }], limitations: [], unassigned: [section.projection.values[1]!] }
  const second = structuredClone(section)
  second.id = "second"
  const paired = createReviewPort({
    state, now: () => "2026-11-13T00:00:00Z", requestFor: () => new Request("https://example.test"), authorizeSections: async () => true, authorizeComments: async () => true, authorizeSensitivity: async () => true, revalidate: async () => true, revalidateEvidence: async () => true,
    select: async () => ({ status: "ok", value: [section, second] }),
  })
  expect((await paired.preview("selection", ["forecast", "second"], binding)).status).toBe("ok")
  second.comments = [{ ...second.comments![0]!, content: "conflicting" }]
  expect(await paired.preview("selection", ["forecast", "second"], binding)).toEqual({ status: "unavailable", reason: "conflicting-comment-snapshot" })
  const comments = section.comments!
  section.comments = [{ ...comments[0]!, authorRef: "" }]
  expect(await port.preserve(input, binding)).toEqual({ status: "unavailable", reason: "invalid-comment-snapshot" })
  section.comments = comments
  const saved = await port.preserve(input, binding)
  expect(saved.status).toBe("ok")
  section.projection.values = [{ ...section.projection.values[0], value: 1400 }]
  section.comments = [{ id: "comment", version: 4, content: "updated note", authorRef: "author", createdAt: "2026-11-14T00:00:00Z", sourceRefs: [source] }]
  access.sourceAvailable = false
  const retry = await port.preserve(input, binding)
  expect(retry.status).toBe("ok")
  if (retry.status !== "ok" || !retry.value) throw new Error("retry unavailable")
  expect((retry.value.sections[0].content as ReviewSection["projection"]).values[0].value).toBe(1320)
  const read = await port.read("review-1", binding)
  expect(read.status).toBe("ok")
  if (read.status !== "ok" || !read.value) throw new Error("review unavailable")
  expect((read.value.sections[0].content as ReviewSection["projection"]).values[0].value).toBe(1320)
  expect(read.value.sections[0].count).toBe(1)
  expect(read.value.sections[0].content).toMatchObject({ reviewChart: { status: "ok", viewId: "BI01", series: [{ values: [{ value: 1320 }] }] } })
  expect((read.value.sections[0].content as ReviewSection["projection"]).values).toHaveLength(2)
  expect(read.value.comments).toMatchObject([{ id: "comment", version: 3, content: "original note", authorRef: "author" }])
  const { prepareReport } = await import("../../../product/reviews/capabilities.ts")
  const { default: JSZip } = await import("jszip")
  const artifacts: Uint8Array[] = []
  const host: ReviewCapabilityHost = {
    reviews: port, requiredAuthority: [],
    authority: {
      validateDomainContext: async () => access.allowed,
      revalidateDomainContext: async () => access.allowed,
      receiptFor: (_context, operation, inputDigest, resultDigest) => ({ kind: "ui", operation, handlerExport: "prepareReport", inputDigest, resultDigest, principalRef: "principal", callId: "call", requestId: "request", accessRevision: "access", at: "2026-11-13T00:00:00Z" }),
    },
    artifacts: {
      put: async (entry) => { artifacts.push(entry.artifact.bytes); return { status: "ok", value: { artifactRef: "artifact" } } },
      read: async () => ({ status: "unavailable", reason: "unused" }),
    },
  }
  const reportInput = { reviewRef: "review-1", format: "docx", sectionRefs: ["forecast"] }
  expect((await prepareReport(reportInput, binding, host)).status).toBe("ok")
  const document = await (await JSZip.loadAsync(artifacts[0]!)).file("word/document.xml")!.async("string")
  expect(document).toContain("1320")
  expect(document).not.toContain("1400")
  expect(document).toContain("original note")
  expect(document).not.toContain("updated note")
  const { createReviewArtifactStorage } = await import("../../../product/reports/storage.ts")
  const artifactOperation = { value: "report-save" }
  const persisted = createReviewArtifactStorage({ state, reviews: port, host: { requestFor: () => new Request("https://example.test"), revalidate: async () => access.allowed }, creationTarget: { ref: "review-1", incarnation: "review-incarnation" }, operationIdentity: () => artifactOperation.value, maxBytes: 5_000_000 })
  const savedArtifact = await persisted.put({ reviewRef: "review-1", sectionRefs: ["forecast"], artifact: { ok: true, name: "review.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes: artifacts[0]! }, format: "docx", recordCount: 1, evidenceRefs: [evidence, evidence] }, binding)
  if (savedArtifact.status !== "ok") throw new Error(`artifact unavailable: ${savedArtifact.reason}`)
  const download = await persisted.download(savedArtifact.value.artifactRef, binding)
  expect(download.status).toBe(200)
  expect(new Uint8Array(await download.arrayBuffer())).toEqual(new Uint8Array(artifacts[0]!))
  const { renderPreservedReview } = await import("../../../product/reviews/render.ts")
  const slides = await renderPreservedReview(read.value, { title: "Review", format: "pptx", sectionRefs: ["forecast"] })
  if (!slides.ok) throw new Error("slides unavailable")
  artifactOperation.value = "slides-save"
  const savedSlides = await persisted.put({ reviewRef: "review-1", sectionRefs: ["forecast"], artifact: slides, format: "pptx", recordCount: 1, evidenceRefs: [evidence, evidence] }, binding)
  if (savedSlides.status !== "ok") throw new Error(`slides unavailable: ${savedSlides.reason}`)
  expect(new Uint8Array(await (await persisted.download(savedSlides.value.artifactRef, binding)).arrayBuffer())).toEqual(new Uint8Array(slides.bytes))
  const { createSfUiAuthority } = await import("../../../product/integration/ui-authority.ts")
  const { createReviewDownloadHandler } = await import("../../../product/reports/download.ts")
  const authority = createSfUiAuthority({
    authorize: async () => access.allowed ? { principalRef: "principal", installationId: "i", projectId: "p", accessRevision: "access", policyVersion: "policy" } : undefined,
    commandIdentity: async () => "download", createId: () => "download-request", now: () => Date.now(),
  })
  const downloadStorage = createReviewArtifactStorage({ state, reviews: port, host: { requestFor: (context) => context.kind === "ui" ? authority.requestFor(context) : undefined, revalidate: (context) => context.kind === "ui" ? authority.revalidate(context) : Promise.resolve(false) }, creationTarget: { ref: "review-1", incarnation: "review-incarnation" }, operationIdentity: () => undefined, maxBytes: 5_000_000 })
  const handler = createReviewDownloadHandler({ authority, storage: downloadStorage })
  const response = await handler(new Request("https://example.test/report"), savedArtifact.value.artifactRef)
  expect(response.status).toBe(200)
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(artifacts[0]!))
  expect((await handler(new Request("https://example.test/report", { method: "POST" }), savedArtifact.value.artifactRef)).status).toBe(405)
  access.comments = false
  expect((await handler(new Request("https://example.test/report"), savedArtifact.value.artifactRef)).status).toBe(403)
  expect((await persisted.download(savedArtifact.value.artifactRef, binding)).status).toBe(403)
  expect(await port.read("review-1", binding)).toEqual({ status: "denied", reason: "access-unavailable" })
  access.comments = true
  access.sections = false
  expect(await port.read("review-1", binding)).toEqual({ status: "denied", reason: "access-unavailable" })
  access.sections = true
  access.allowed = false
  expect((await prepareReport(reportInput, binding, host)).status).toBe("denied")
  expect(artifacts).toHaveLength(1)
  expect(await port.read("review-1", binding)).toEqual({ status: "denied", reason: "access-unavailable" })
  access.allowed = true
  const stored = storage.state.dashboard.data.__sfProductV1 as SfProductState
  stored.reviews["review-1"]!.sections[0]!.title = "Tampered"
  expect(await port.preserve(input, binding)).toEqual({ status: "conflict", reason: "preserved-review-changed" })
  stored.reviews["review-1"]!.sourceRefs = []
  expect(await port.read("review-1", binding)).toEqual({ status: "unavailable", reason: "invalid-review-sources" })
})

test("comparison requires identity and a compatible period before calculating a delta", async () => {
  const { compareReviews } = await import("../../../product/reviews/compare.ts")
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const ref = { schema: "sf-evidence-v1", refId: "record", installationId: "i", projectId: "p", refDigest: "digest", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "forecast", recordId: "1", incarnation: "original", version: 1, fields: ["value"], projectionDigest: "digest" } } as const
  const value: DomainProjection["values"][number] = { id: "forecast", value: 1320, period, currency: "USD", granularity: "year", sourceRefs: [ref], drilldown: ref, evidenceState: "confirmed" }
  const previous = { id: "old", version: 1, createdAt: "2026-01-01", sourceRefs: [], comments: [], sections: [{ id: "s", title: "Forecast", period, count: 1, sourceRefs: [], content: { engineVersion: "v1", values: [value] } }] }
  const current = structuredClone(previous)
  current.id = "new"
  current.sections[0].content.values = [{ ...value, value: 1400 }]
  expect(compareReviews(previous, current).changes).toMatchObject([{ kind: "changed", delta: 80 }])
  current.sections[0].content.values = [{ ...value, value: 1400, currency: "EUR" }]
  expect(compareReviews(previous, current).changes).toMatchObject([{ kind: "incompatible" }])
  current.sections[0].content.values = [{ ...value, value: 1400 }]
  current.sections[0].content.engineVersion = "v2"
  expect(compareReviews(previous, current).changes).toMatchObject([{ kind: "incompatible" }])
  current.sections[0].content.values = [value, value]
  expect(compareReviews(previous, current).state).toBe("unavailable")
  const calculation = { schema: "sf-evidence-v1", refId: "calculation", installationId: "i", projectId: "p", refDigest: "digest", evidenceLevel: "observed", kind: "calculation", target: { calculationId: "forecast-total", runId: "run-1", engineVersion: "engine-1", inputDigest: "input", resultDigest: "result", sourceRefs: [ref], period, currency: "USD" } } as const
  previous.sections[0].content.values = [{ ...value, sourceRefs: [calculation] }]
  current.sections[0].content.engineVersion = "v1"
  current.sections[0].content.values = [{ ...value, value: 1400, sourceRefs: [{ ...calculation, target: { ...calculation.target, runId: "run-2" } }] }]
  expect(compareReviews(previous, current).changes).toMatchObject([{ kind: "changed", delta: 80 }])
  previous.sections[0].content.values = [{ ...value, value: -Number.MAX_VALUE }]
  current.sections[0].content.values = [{ ...value, value: Number.MAX_VALUE }]
  expect(compareReviews(previous, current).changes).toMatchObject([{ kind: "incompatible" }])
  expect(compareReviews(null, current).state).toBe("first-review")
})

test("preserved report exports every selected record from the captured projection", async () => {
  const { renderPreservedReview } = await import("../../../product/reviews/render.ts")
  const { default: JSZip } = await import("jszip")
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const source = { surface: "dashboard", type: "project", id: "p", incarnation: "i", version: 1, fields: ["name"], period, observedAt: "2026-11-13T00:00:00Z" } as const
  const projection = {
    values: Array.from({ length: 25 }, (_, index) => ({ id: `record-${index.toString().padStart(2, "0")}`, value: index, period, granularity: "record", sourceRefs: [], drilldown: null, evidenceState: "confirmed" })),
    missing: [], context: { sourceRefs: [source] },
  }
  const commentSource = { ...source, version: 2 }
  const review = { id: "review", version: 1, createdAt: "2026-11-13", sourceRefs: [source, commentSource], comments: [{ id: "note", version: 3, authorRef: "author", createdAt: "2026-11-13", content: `Preserved note ${"🫘".repeat(70)}`, sourceRefs: [commentSource] }], sections: [{ id: "projects", title: "Projects", period, count: 25, sourceRefs: [source], content: projection }] }
  for (const format of ["pptx", "docx"] as const) {
    const result = await renderPreservedReview(review, { title: "Review", format, sectionRefs: ["projects"] })
    if (!result.ok) throw new Error("report unavailable")
    const zip = await JSZip.loadAsync(result.bytes)
    const paths = Object.keys(zip.files).filter((path) => format === "docx" ? path === "word/document.xml" : /^ppt\/slides\/slide\d+\.xml$/.test(path))
    const xml = (await Promise.all(paths.map((path) => zip.file(path)!.async("string")))).join(" ")
    for (let index = 0; index < 25; index++) expect(xml.split(`record-${index.toString().padStart(2, "0")}:`).length - 1).toBe(1)
    expect(xml).toContain("Preserved note")
    expect(xml).toContain("author")
    expect((xml.match(/🫘/g) ?? []).length).toBe(70)
  }
})

test("review capability denies a forged binding before selecting source data", async () => {
  const { prepareReview } = await import("../../../product/reviews/capabilities.ts")
  const storage = testPersistence()
  const state = createSfProductState({ persistence: storage.persistence, createId: () => "state", resolveTarget: async () => ({ incarnation: "i" }), authorize: async () => undefined })
  const observed = { selections: 0 }
  const reviews = createReviewPort({
    state, now: () => "2026-11-13T00:00:00Z", requestFor: () => undefined, authorizeSections: async () => false, authorizeComments: async () => true, authorizeSensitivity: async () => true, revalidate: async () => false, revalidateEvidence: async () => false,
    select: async () => { observed.selections++; return { status: "unavailable", reason: "unexpected" } },
  })
  const result = await prepareReview({ selectionRef: "selection", period: { start: "2026-01-01", end: "2026-12-31" }, sectionRefs: ["private"] }, {} as unknown as TrustedDomainContext, {
    reviews, requiredAuthority: [],
    authority: { validateDomainContext: async () => false, revalidateDomainContext: async () => false, receiptFor: () => undefined },
    artifacts: { put: async () => ({ status: "unavailable", reason: "unexpected" }), read: async () => ({ status: "unavailable", reason: "unexpected" }) },
  })
  expect(result.status).toBe("denied")
  expect(observed.selections).toBe(0)
})

test("financial trajectory exports a captured figure and the same data table in both formats", async () => {
  const { renderPreservedReview } = await import("../../../product/reviews/render.ts")
  const { default: JSZip } = await import("jszip")
  const { inflateSync } = await import("node:zlib")
  const annual = { start: "2026-01-01", end: "2026-12-31" }
  const source = { surface: "planner", type: "forecast", id: "one", incarnation: "inc", version: 1, fields: ["value"], period: annual, observedAt: "2026-11-13T00:00:00Z" } as const
  const values = [
    { id: "jan", value: 100, period: { start: "2026-01-01", end: "2026-01-31" }, currency: "USD", granularity: "month", sourceRefs: [], drilldown: null, evidenceState: "confirmed" },
    { id: "feb", value: 200, period: { start: "2026-02-01", end: "2026-02-28" }, currency: "USD", granularity: "month", sourceRefs: [], drilldown: null, evidenceState: "confirmed" },
  ]
  const chart = { status: "ok", viewId: "BI01", series: [{ id: "outlook", label: "Forecast", unit: "USD", role: "outlook", valueIds: ["jan", "feb"], values }], limitations: [], unassigned: [] }
  const projection = { values, missing: [], context: { sourceRefs: [source] }, reviewChart: chart }
  const review = { id: "review-chart", version: 1, createdAt: "2026-11-13", sourceRefs: [source], comments: [], sections: [{ id: "forecast", title: "Forecast", period: annual, count: 1, sourceRefs: [source], content: projection }] }
  for (const format of ["pptx", "docx"] as const) {
    const result = await renderPreservedReview(review, { title: "Review", format, sectionRefs: ["forecast"] })
    if (!result.ok) throw new Error("report unavailable")
    const zip = await JSZip.loadAsync(result.bytes)
    const media = Object.keys(zip.files).filter((path) => format === "docx" ? /^word\/media\/.*\.png$/.test(path) : /^ppt\/media\/.*\.png$/.test(path))
    expect(media.length).toBeGreaterThan(0)
    const png = await zip.file(media[0])!.async("uint8array")
    expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    const pngBytes = Buffer.from(png)
    expect(pngBytes.subarray(37, 41).toString("ascii")).toBe("IDAT")
    const rows = inflateSync(pngBytes.subarray(41, 41 + pngBytes.readUInt32BE(33)))
    expect(rows.some((byte) => byte !== 0 && byte !== 255)).toBe(true)
    const paths = Object.keys(zip.files).filter((path) => format === "docx" ? path === "word/document.xml" : /^ppt\/slides\/slide\d+\.xml$/.test(path))
    const xml = (await Promise.all(paths.map((path) => zip.file(path)!.async("string")))).join(" ")
    expect(xml).toContain("Financial trajectory")
    expect(xml).toContain("jan: 100 USD")
    expect(xml).toContain("feb: 200 USD")
  }
  const invalid = structuredClone(review)
  invalid.sections[0].content.reviewChart.series[0].values = [{ ...values[0]!, value: 999 }, values[1]!]
  const refusedFigure = await renderPreservedReview(invalid, { title: "Review", format: "docx", sectionRefs: ["forecast"] })
  if (!refusedFigure.ok) throw new Error("report unavailable")
  const invalidZip = await JSZip.loadAsync(refusedFigure.bytes)
  expect(await invalidZip.file("word/document.xml")!.async("string")).toContain("Chart BI01 unavailable")
  expect(Object.keys(invalidZip.files).some((path) => /^word\/media\/.*\.png$/.test(path))).toBe(false)
})

test("category charts paginate every captured value in both export formats", async () => {
  const { renderPreservedReview } = await import("../../../product/reviews/render.ts")
  const { default: JSZip } = await import("jszip")
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const source = { surface: "procurement", type: "request", id: "one", incarnation: "inc", version: 1, fields: ["status"], period, observedAt: "2026-11-13T00:00:00Z" } as const
  const values = Array.from({ length: 25 }, (_, index) => ({ id: `bucket-${index.toString().padStart(2, "0")}`, value: index, period, unit: "count", granularity: "record", sourceRefs: [], drilldown: null, evidenceState: "confirmed" }))
  const chart = { status: "ok", viewId: "BI05", series: [{ id: "open", label: "Open requests", unit: "count", role: "stock", valueIds: values.map((value) => value.id), values }], limitations: [], unassigned: [] }
  const projection = { values, missing: [], context: { sourceRefs: [source] }, reviewChart: chart }
  const review = { id: "category", version: 1, createdAt: "2026-11-13", sourceRefs: [source], comments: [], sections: [{ id: "requests", title: "Requests", period, count: 25, sourceRefs: [source], content: projection }] }
  for (const format of ["pptx", "docx"] as const) {
    const result = await renderPreservedReview(review, { title: "Review", format, sectionRefs: ["requests"] })
    if (!result.ok) throw new Error("report unavailable")
    const zip = await JSZip.loadAsync(result.bytes)
    const media = Object.keys(zip.files).filter((path) => format === "docx" ? /^word\/media\/.*\.png$/.test(path) : /^ppt\/media\/.*\.png$/.test(path))
    expect(media).toHaveLength(4)
    const paths = Object.keys(zip.files).filter((path) => format === "docx" ? path === "word/document.xml" : /^ppt\/slides\/slide\d+\.xml$/.test(path))
    const xml = (await Promise.all(paths.map((path) => zip.file(path)!.async("string")))).join(" ")
    expect(xml).toContain("Category bars")
    expect(xml).toContain("bucket-24")
  }
})

test("ticket flow chart keeps monthly entries as separate periods", async () => {
  const { renderReviewBars } = await import("../../../product/reviews/chart.ts")
  const values: DomainProjection["values"] = [
    { id: "opened-jan", value: 10, unit: "count", granularity: "month", period: { start: "2026-01-01", end: "2026-01-31" }, sourceRefs: [], drilldown: null, evidenceState: "confirmed" },
    { id: "opened-feb", value: 5, unit: "count", granularity: "month", period: { start: "2026-02-01", end: "2026-02-28" }, sourceRefs: [], drilldown: null, evidenceState: "confirmed" },
  ]
  const projection = { values } as unknown as DomainProjection
  const chart = { status: "ok", viewId: "BI07", series: [{ id: "opened", label: "Opened", unit: "count", role: "opened", valueIds: values.map((value) => value.id), values }], limitations: [], unassigned: [] } as const
  expect(renderReviewBars(projection, chart)).toHaveLength(1)
  expect(renderReviewBars(projection, { ...chart, viewId: "BI05" })).toBeUndefined()
})

test("timeline export paginates resolved milestones and refuses fabricated completion", async () => {
  const { renderPreservedReview } = await import("../../../product/reviews/render.ts")
  const { default: JSZip } = await import("jszip")
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const source = { surface: "dashboard", type: "project", id: "one", incarnation: "inc", version: 1, fields: ["date"], period, observedAt: "2026-11-13T00:00:00Z" } as const
  const values = Array.from({ length: 9 }, (_, index) => ({ id: `milestone-${index}`, value: `2026-01-${String(index + 1).padStart(2, "0")}`, period, granularity: "record", sourceRefs: [], drilldown: null, evidenceState: index === 0 ? "estimated" : "confirmed" }))
  const items = values.map((value, index) => ({ label: `Milestone ${index}`, dateValueId: value.id, state: index === 0 ? "unknown" : "completed", date: value.value, source: value }))
  const chart = { status: "ok", viewId: "BI08", series: [], limitations: [], unassigned: values, timeline: { status: "ok", items } }
  const projection = { values, missing: [], context: { sourceRefs: [source], period }, reviewChart: chart }
  const review = { id: "timeline", version: 1, createdAt: "2026-11-13", sourceRefs: [source], comments: [], sections: [{ id: "milestones", title: "Milestones", period, count: 9, sourceRefs: [source], content: projection }] }
  for (const format of ["pptx", "docx"] as const) {
    const output = await renderPreservedReview(review, { title: "Review", format, sectionRefs: ["milestones"] })
    if (!output.ok) throw new Error("report unavailable")
    const zip = await JSZip.loadAsync(output.bytes)
    expect(Object.keys(zip.files).filter((path) => format === "docx" ? /^word\/media\/.*\.png$/.test(path) : /^ppt\/media\/.*\.png$/.test(path))).toHaveLength(2)
    const paths = Object.keys(zip.files).filter((path) => format === "docx" ? path === "word/document.xml" : /^ppt\/slides\/slide\d+\.xml$/.test(path))
    const xml = (await Promise.all(paths.map((path) => zip.file(path)!.async("string")))).join(" ")
    expect(xml).toContain("Milestone 0 · unknown")
    expect(xml).toContain("Milestone 8 · completed")
  }
  const invalid = structuredClone(review)
  invalid.sections[0].content.reviewChart.timeline.items[0].state = "completed"
  const refused = await renderPreservedReview(invalid, { title: "Review", format: "docx", sectionRefs: ["milestones"] })
  if (!refused.ok) throw new Error("report unavailable")
  const invalidZip = await JSZip.loadAsync(refused.bytes)
  expect(await invalidZip.file("word/document.xml")!.async("string")).toContain("Chart BI08 unavailable")
})

test("waterfall export uses resolved endpoints and marks a mismatched snapshot unavailable", async () => {
  const { renderPreservedReview } = await import("../../../product/reviews/render.ts")
  const { default: JSZip } = await import("jszip")
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const source = { surface: "planner", type: "forecast", id: "one", incarnation: "inc", version: 1, fields: ["value"], period, observedAt: "2026-11-13T00:00:00Z" } as const
  const value = (id: string, amount: number) => ({ id, value: amount, period, currency: "USD", granularity: "aggregate", sourceRefs: [], drilldown: null, evidenceState: "confirmed" })
  const values = Array.from({ length: 10 }, (_, index) => [value(`start-${index}`, index * 10), value(`end-${index}`, (index + 1) * 10), value(`component-${index}`, 10)]).flat()
  const segments = Array.from({ length: 10 }, (_, index) => ({ label: `Component ${index}`, startValueId: `start-${index}`, endValueId: `end-${index}`, componentValueId: `component-${index}`, start: index * 10, end: (index + 1) * 10, amount: 10, source: values[index * 3 + 2]! }))
  const chart = { status: "ok", viewId: "BI02", series: [], limitations: [], unassigned: values, waterfall: { status: "ok", finalValueId: "end-9", final: 100, reconciliation: "reconciled", segments } }
  const projection = { values, missing: [], context: { sourceRefs: [source], period }, reviewChart: chart }
  const review = { id: "waterfall", version: 1, createdAt: "2026-11-13", sourceRefs: [source], comments: [], sections: [{ id: "forecast", title: "Forecast", period, count: 10, sourceRefs: [source], content: projection }] }
  for (const format of ["pptx", "docx"] as const) {
    const output = await renderPreservedReview(review, { title: "Review", format, sectionRefs: ["forecast"] })
    if (!output.ok) throw new Error("report unavailable")
    const zip = await JSZip.loadAsync(output.bytes)
    expect(Object.keys(zip.files).filter((path) => format === "docx" ? /^word\/media\/.*\.png$/.test(path) : /^ppt\/media\/.*\.png$/.test(path))).toHaveLength(2)
    const paths = Object.keys(zip.files).filter((path) => format === "docx" ? path === "word/document.xml" : /^ppt\/slides\/slide\d+\.xml$/.test(path))
    const xml = (await Promise.all(paths.map((path) => zip.file(path)!.async("string")))).join(" ")
    expect(xml).toContain("Reconciliation: reconciled")
    expect(xml).toContain("Component 9")
  }
  const invalid = structuredClone(review)
  invalid.sections[0].content.reviewChart.waterfall.segments[0].end = 777
  const refused = await renderPreservedReview(invalid, { title: "Review", format: "docx", sectionRefs: ["forecast"] })
  if (!refused.ok) throw new Error("report unavailable")
  const invalidZip = await JSZip.loadAsync(refused.bytes)
  expect(await invalidZip.file("word/document.xml")!.async("string")).toContain("Chart BI02 unavailable")
})

test("capacity and cost charts require alignment and keep separate units", async () => {
  const { renderReviewBars } = await import("../../../product/reviews/chart.ts")
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const values: DomainProjection["values"] = [
    { id: "fte", value: 3, unit: "FTE", period, granularity: "record", sourceRefs: [], drilldown: null, evidenceState: "confirmed" },
    { id: "cost", value: 200000, currency: "USD", period, granularity: "record", sourceRefs: [], drilldown: null, evidenceState: "confirmed" },
  ]
  const projection = { values } as unknown as DomainProjection
  const chart = { status: "ok", viewId: "BI04", series: [
    { id: "capacity", label: "Capacity", unit: "FTE", role: "fte", valueIds: ["fte"], alignmentKeys: ["team-a"], values: [values[0]!] },
    { id: "cost", label: "Cost", unit: "USD", role: "cost", valueIds: ["cost"], alignmentKeys: ["team-a"], values: [values[1]!] },
  ], limitations: [], unassigned: [] } as const
  expect(renderReviewBars(projection, chart)).toHaveLength(2)
  expect(renderReviewBars(projection, { ...chart, series: [chart.series[0], { ...chart.series[1], alignmentKeys: ["team-b"] }] })).toBeUndefined()
  const { renderPreservedReview } = await import("../../../product/reviews/render.ts")
  const { default: JSZip } = await import("jszip")
  const source = { surface: "planner", type: "team", id: "team-a", incarnation: "inc", version: 1, fields: ["capacity", "cost"], period, observedAt: "2026-11-13T00:00:00Z" } as const
  const reportProjection = { ...projection, context: { sourceRefs: [source], period }, missing: [], reviewChart: chart }
  const review = { id: "capacity", version: 1, createdAt: "2026-11-13", sourceRefs: [source], comments: [], sections: [{ id: "team", title: "Team", period, count: 1, sourceRefs: [source], content: reportProjection }] }
  const output = await renderPreservedReview(review, { title: "Review", format: "docx", sectionRefs: ["team"] })
  if (!output.ok) throw new Error("report unavailable")
  const zip = await JSZip.loadAsync(output.bytes)
  const xml = await zip.file("word/document.xml")!.async("string")
  expect(xml).toContain("separate scales and units")
  expect(xml).toContain("scale 0 – 3 FTE")
  expect(xml).toContain("scale 0 – 200000 USD")
})

test("sensitivity exports evaluated points and preserves a sampled threshold as an interval", async () => {
  const { renderPreservedReview } = await import("../../../product/reviews/render.ts")
  const { default: JSZip } = await import("jszip")
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const chart = {
    status: "ok", viewId: "BI11", series: [], limitations: [], unassigned: [],
    sensitivity: {
      parameterUnit: "%", resultUnit: "USD",
      result: {
        scenarioRef: "scenario", parameterRef: "rate", bounds: { minimum: 1, maximum: 2, steps: 2 },
        evaluated: [{ parameterValue: 1, resultRef: "result-1", value: 100 }, { parameterValue: 2, resultRef: "result-2", value: 200 }],
        threshold: null, thresholdEvidence: { state: "sampled", interval: { minimum: 1, maximum: 2 }, evidenceRefs: [] },
        unit: "USD", engineVersion: "v1", costCoverageRefs: [], comparisonStatus: "complete", unresolvedConditions: [], evidenceRefs: [],
      },
    },
  }
  const review = { id: "sensitivity", version: 1, createdAt: "2026-11-13", sourceRefs: [], comments: [], sections: [{ id: "scenario", title: "Scenario", period, count: 1, sourceRefs: [], content: { values: [], missing: [], context: { sourceRefs: [] }, reviewChart: chart } }] }
  for (const format of ["pptx", "docx"] as const) {
    const output = await renderPreservedReview(review, { title: "Review", format, sectionRefs: ["scenario"] })
    if (!output.ok) throw new Error("report unavailable")
    const zip = await JSZip.loadAsync(output.bytes)
    expect(Object.keys(zip.files).some((path) => format === "docx" ? /^word\/media\/.*\.png$/.test(path) : /^ppt\/media\/.*\.png$/.test(path))).toBe(true)
    const paths = Object.keys(zip.files).filter((path) => format === "docx" ? path === "word/document.xml" : /^ppt\/slides\/slide\d+\.xml$/.test(path))
    const xml = (await Promise.all(paths.map((path) => zip.file(path)!.async("string")))).join(" ")
    expect(xml).toContain("Sampled threshold interval")
    expect(xml).toContain("bounds: 1 – 2")
    expect(xml).toContain("reported unit: USD")
    expect(xml).toContain("result-1")
    expect(xml).toContain("result-2")
    expect(xml).not.toContain("Exact threshold:")
  }
  const missingUnit = structuredClone(review)
  missingUnit.sections[0]!.content.reviewChart.sensitivity.parameterUnit = ""
  const output = await renderPreservedReview(missingUnit, { title: "Review", format: "docx", sectionRefs: ["scenario"] })
  if (!output.ok) throw new Error("report unavailable")
  const zip = await JSZip.loadAsync(output.bytes)
  expect(await zip.file("word/document.xml")!.async("string")).toContain("Chart BI11 unavailable")
})
