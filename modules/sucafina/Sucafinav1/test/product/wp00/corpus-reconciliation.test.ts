import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import JSZip from "jszip"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { object, rows } from "../../../runtime/contract.ts"
import type { Environment, Snapshot } from "../../../runtime/contract.ts"
import { domain } from "../../../runtime/dashboard-operations.ts"
import { parseWorkbookDetailed } from "../../../runtime/workbooks.ts"
import { effectiveMonthlyBudget, securityKpiStatus } from "../../../src/dashboard-accounts.ts"
import { buildDashboardWorkbookCommand } from "../../../product/imports/dashboard-command.ts"
import { applyDashboardImport, previewDashboardImport } from "../../../product/dashboard/imports.ts"
import { projectDashboardSource } from "../../../product/dashboard/port.ts"
import { renderPreservedReview } from "../../../product/reviews/render.ts"
import type { PreservedReview, SourceRef } from "../../../product/contracts/context.ts"
import corpus from "./fixtures/corpus-v2.json"
import inputs from "./fixtures/consumer-inputs.json"
import fixture from "./fixtures/reconciliation.json"

const actor = inputs.authorization.dashboardAdmin
const at = "2027-01-01T00:00:00Z"
const period = { start: "2027-01-01", end: "2027-12-31" }

// These tests use real parsers, domain commands, projections, SQLite and renderers.
// A domain actor/source fixture is not an admitted file, C04 receipt, UI journey or native identity.
test("real XLSX reimport preserves project identities and reconciles changed values in SQLite", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-wp00-reconciliation-"))
  const final: { snapshot?: Snapshot } = {}
  try {
    const store = await openLocalStore(directory)
    try {
      await store.transaction("dashboard", async (snapshot) => {
        snapshot.data = {
          projects: [], leaders: [{ id: "synthetic-finance", name: "Synthetic Finance" }],
          capexProjects: structuredClone(corpus.datasets.projects.capex_projects),
          risks: [{ id: "synthetic-unrelated-risk", name: "Synthetic untouched risk" }],
        }
        return { commit: true, value: undefined }
      })
      const bytes = await projectWorkbook(fixture.projectImport.rows)
      const before = await readSnapshot(store)
      const first = await prepareProjectImport(bytes, before, at)
      expect(first.preview.summary).toEqual(fixture.projectImport.expected.initialSummary)
      expect(await applyPrepared(store, first)).toMatchObject({ ok: true, value: fixture.projectImport.expected.initialSummary })
      const imported = await readSnapshot(store)
      expect(projectDashboardSource(imported, actor, environment(at), "All Projects")).toEqual(first.preview.after)
      expect(projects(imported).map((project) => project.id)).toEqual(fixture.projectImport.expected.ids)
      expect(projects(imported).map((project) => project.budget)).toEqual([12000, 8000])
      expect(projects(imported).reduce((sum, project) => sum + Number(project.budget), 0)).toBe(fixture.projectImport.expected.initialTotal)
      expect(imported.data.capexProjects).toEqual(corpus.datasets.projects.capex_projects)
      expect(imported.audit).toHaveLength(2)

      // Reusing the old preview is a stale command, not a new admission or an idempotency receipt.
      expect(await applyPrepared(store, first)).toMatchObject({ ok: false, status: 409 })
      expect(await readSnapshot(store)).toEqual(imported)

      const replayAt = "2027-01-02T00:00:00Z"
      const repeated = await prepareProjectImport(bytes, imported, replayAt)
      // The producer counts matched rows as updated, even when every business value is unchanged.
      expect(repeated.preview.summary).toEqual(fixture.projectImport.expected.reimportSummary)
      expect(await applyPrepared(store, repeated)).toMatchObject({ ok: true, value: fixture.projectImport.expected.reimportSummary })
      const reimported = await readSnapshot(store)
      expect(projects(reimported).map((project) => project.id)).toEqual(fixture.projectImport.expected.ids)
      expect(new Set(projects(reimported).map((project) => project.id)).size).toBe(2)
      expect(projectBusinessValues(reimported)).toEqual(projectBusinessValues(imported))
      expect(projects(reimported).map((project) => project.updatedAt)).toEqual([replayAt, replayAt])
      expect(reimported.audit.slice(0, imported.audit.length)).toEqual(imported.audit)
      expect<Record<string, unknown>>({ ...reimported.data, projects: imported.data.projects }).toEqual(imported.data)
      expect(reimported.sequences).toEqual(imported.sequences)
      expect(reimported.notices).toEqual(imported.notices)

      const alteredBytes = await projectWorkbook(fixture.projectImport.alteredRows)
      expect(new Bun.CryptoHasher("sha256").update(alteredBytes).digest("hex")).not.toBe(first.sourceDigest)
      const changed = await prepareProjectImport(alteredBytes, reimported, "2027-01-03T00:00:00Z")
      expect(changed.preview.summary).toEqual(fixture.projectImport.expected.reimportSummary)
      const mismatched = { ...changed, preview: { ...changed.preview, commandDigest: repeated.preview.commandDigest } }
      expect(await applyPrepared(store, mismatched)).toMatchObject({ ok: false, status: 409 })
      expect(await readSnapshot(store)).toEqual(reimported)
      expect(await applyPrepared(store, changed)).toMatchObject({ ok: true, value: fixture.projectImport.expected.reimportSummary })
      const altered = await readSnapshot(store)
      expect(projectDashboardSource(altered, actor, environment(changed.at), "All Projects")).toEqual(changed.preview.after)
      expect(projects(altered).map((project) => project.id)).toEqual(fixture.projectImport.expected.ids)
      expect(projects(altered).map((project) => project.budget)).toEqual([16000, 8000])
      expect(projects(altered).map((project) => project.notes)).toEqual(["Synthetic revised note A", "Synthetic original note B"])
      expect(projects(altered).reduce((sum, project) => sum + Number(project.budget), 0)).toBe(fixture.projectImport.expected.alteredTotal)
      expect(projectBusinessValues(altered)[1]).toEqual(projectBusinessValues(reimported)[1])
      expect<Record<string, unknown>>({ ...altered.data, projects: reimported.data.projects }).toEqual(reimported.data)
      expect(altered.audit.slice(0, reimported.audit.length)).toEqual(reimported.audit)
      expect(altered.sequences).toEqual(reimported.sequences)
      expect(altered.notices).toEqual(reimported.notices)
      final.snapshot = altered
    } finally { await store.dispose() }
    const reopened = await openLocalStore(directory)
    try { expect(await readSnapshot(reopened)).toEqual(final.snapshot) } finally { await reopened.dispose() }
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test("the real Dashboard preserves inherited budgets and separates years without filling missing actuals", () => {
  expect(fixture.budget.annual).toBe(corpus.datasets.operations.monthly_budget.annual)
  const snapshot: Snapshot = {
    data: { opexOwners: [{ id: "synthetic-owner", budget: fixture.budget.annual }], opexEntries: structuredClone(fixture.budget.entries), capexProjects: [], capexEntries: [] },
    versions: {}, sequences: {}, audit: [], notices: [],
  }
  const before = structuredClone(snapshot)
  const projection = projectDashboardSource(snapshot, actor, environment(at), "Budget Overview")
  if (!projection) throw new Error("The real Dashboard did not expose the synthetic budget")
  const metrics = object(projection.budgetMetrics)
  for (const year of ["2026", "2027"] as const) {
    const expected = fixture.budget.expected[year]
    expect(metrics[year]).toMatchObject({ totalBudget: expected.budget, totalActual: expected.actual, totalForecast: expected.forecast, effectiveMonthlyBudget: expected.monthly })
  }
  expect(effectiveMonthlyBudget(0, fixture.budget.annual)).toBe(corpus.datasets.operations.expected.month_2_effective_budget)
  expect(effectiveMonthlyBudget(undefined, fixture.budget.annual)).toBe(100)
  const entries = rows(projection.opexEntries)
  expect(entries.find((entry) => entry.year === 2027 && entry.month === 1)).toMatchObject({ budget: 200, actual: 0, forecast: 50 })
  expect(entries.find((entry) => entry.year === 2027 && entry.month === 2)).toMatchObject({ budget: 0, actual: 20, forecast: 0 })
  const absent = entries.find((entry) => entry.year === 2027 && entry.month === 3)
  if (!absent) throw new Error("The synthetic absent month was dropped from the source projection")
  expect(Object.hasOwn(absent, "budget")).toBe(false)
  expect(Object.hasOwn(absent, "actual")).toBe(false)
  expect(Object.hasOwn(absent, "forecast")).toBe(false)
  expect(snapshot).toEqual(before)
})

test("real monthly security commands preserve blank versus zero and independent periods", () => {
  const snapshot: Snapshot = { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
  const values = [
    { year: 2027, month: 1, training: "", patch: 0, notes: "Synthetic January absence" },
    { year: 2027, month: 2, training: 0, patch: "", notes: "Synthetic February zero" },
    { year: 2026, month: 1, training: 95, patch: 100, notes: "Synthetic prior year" },
  ]
  for (const value of values) {
    const before = structuredClone(rows(snapshot.data.secKpi))
    expect(domain.execute(snapshot, actor, { page: "IT Security KPIs", action: "save-kpi", version: 0, values: value }, environment(at))).toMatchObject({ ok: true })
    expect(rows(snapshot.data.secKpi).slice(0, before.length)).toEqual(before)
  }
  const projection = projectDashboardSource(snapshot, actor, environment(at), "IT Security KPIs")
  if (!projection) throw new Error("The real Dashboard did not expose the synthetic security periods")
  const entries = rows(projection.secKpi)
  expect(entries).toHaveLength(3)
  for (const value of values) expect(entries.find((entry) => entry.year === value.year && entry.month === value.month)).toMatchObject(value)
  const training = entries.map((entry) => entry.training)
  expect(training).toEqual(["", 0, 95])
  expect(training.map((value) => securityKpiStatus("high", 95, 80, value as string | number))).toEqual(["No data", "High risk", "Good"])
  expect(snapshot.versions).toEqual({
    "security:2027-1": { version: 1, by: actor.id },
    "security:2027-2": { version: 1, by: actor.id },
    "security:2026-1": { version: 1, by: actor.id },
  })
  const beforeStale = structuredClone(snapshot)
  expect(domain.execute(snapshot, actor, { page: "IT Security KPIs", action: "save-kpi", version: 0, values: { ...values[0], training: 100 } }, environment(at))).toMatchObject({ ok: false, status: 409 })
  expect(snapshot).toEqual(beforeStale)
})

test.each(["docx", "pptx"] as const)("the real %s renderer retains 25 projected projects and complete long notes", async (format) => {
  const snapshot: Snapshot = { data: { projects: structuredClone(fixture.report.projects) }, versions: {}, sequences: {}, audit: [], notices: [] }
  const before = structuredClone(snapshot)
  const selected = projects(snapshot)
  expect(selected).toHaveLength(fixture.report.expectedCount)
  expect(selected.reduce((sum, project) => sum + Number(project.budget), 0)).toBe(fixture.report.expectedBudgetTotal)
  const sources: SourceRef[] = selected.map((project) => ({
    surface: "dashboard", type: "project", id: String(project.id), incarnation: `synthetic-source-${project.id}`, version: 1,
    fields: ["name", "status", "pm", "budget", "notes"], period, observedAt: at,
  }))
  const outside = { ...sources[0]!, incarnation: "synthetic-unselected-incarnation" }
  const review: PreservedReview = {
    id: "synthetic-wp00-review-25", version: 1, createdAt: at, sourceRefs: [...sources, outside],
    sections: [{ id: "projects", title: "Synthetic project reconciliation", period, count: fixture.report.expectedCount, sourceRefs: sources, content: {
      context: { sourceRefs: sources }, missing: [],
      values: selected.map((project) => ({
        id: String(project.id), value: `${project.name}; ${project.status}; ${project.pm}; ${project.budget} USD; ${project.notes}`,
        period, granularity: "record", sourceRefs: [], drilldown: null, evidenceState: "confirmed",
      })),
    } }],
    comments: [
      { ...fixture.report.comment, version: 3, createdAt: at, sourceRefs: [sources[0]!] },
      { id: "synthetic-unselected-comment", version: 1, createdAt: at, authorRef: "synthetic-unselected-author", content: fixture.report.omittedCommentMarker, sourceRefs: [outside] },
    ],
  }
  const preserved = structuredClone(review)
  const artifact = await renderPreservedReview(review, { title: "WP00 synthetic 25 projects", format, sectionRefs: ["projects"] })
  if (!artifact.ok) throw new Error(`The real ${format} renderer refused the synthetic report`)
  expect(artifact.name.endsWith(`.${format}`)).toBe(true)
  const zip = await JSZip.loadAsync(artifact.bytes)
  expect(zip.file("[Content_Types].xml")).not.toBeNull()
  const paths = Object.keys(zip.files).filter((entry) => format === "docx" ? entry === "word/document.xml" : /^ppt\/slides\/slide\d+\.xml$/.test(entry))
    .sort((left, right) => Number(/slide(\d+)/.exec(left)?.[1] ?? 0) - Number(/slide(\d+)/.exec(right)?.[1] ?? 0))
  expect(paths.length).toBeGreaterThan(0)
  const parts = await Promise.all(paths.map(async (entry) => {
    const xml = await zip.file(entry)!.async("string")
    const nodes = [...xml.matchAll(/<(?:w|a):t(?:\s[^>]*)?>([\s\S]*?)<\/(?:w|a):t>/gu)].map((match) => xmlText(match[1]!))
    // PPTX emits a repeated section heading plus the body; discard only that heading.
    if (format === "pptx") expect(nodes.length).toBeGreaterThanOrEqual(2)
    return (format === "pptx" ? nodes.slice(1) : nodes).join(" ")
  }))
  const text = parts.join(" ").replace(/\s+/gu, " ").trim()
  expect(text).toContain("Selected records: 25")
  expect(text.match(/synthetic-report-project-\d{2}:/gu)).toHaveLength(25)
  for (const project of fixture.report.projects) {
    expect(text.split(`${project.id}:`).length - 1).toBe(1)
    expect(text).toContain(project.name)
    expect(text.split(project.notes).length - 1).toBe(1)
  }
  expect(text.split(fixture.report.comment.content).length - 1).toBe(1)
  expect(text).toContain(fixture.report.comment.authorRef)
  expect(text).not.toContain(fixture.report.omittedCommentMarker)
  expect(text).toContain("Some preserved comments do not match the selected section sources and are omitted.")
  expect(review).toEqual(preserved)
  expect(snapshot).toEqual(before)
  // ZIP/XML content preservation is not visual layout approval, download authorization or complete J05.
}, 30_000)

function environment(time: string): Environment {
  const sequence = { value: 0 }
  return { at: time, directory: [], id: () => {
    const id = fixture.projectImport.expected.ids[sequence.value++]
    if (!id) throw new Error("The diagnostic import unexpectedly requested another project identity")
    return id
  } }
}

async function projectWorkbook(values: (string | number)[][]) {
  const { Workbook } = await import("exceljs")
  const book = new Workbook()
  const sheet = book.addWorksheet(fixture.projectImport.sheet)
  sheet.addRow(fixture.projectImport.headers)
  sheet.addRows(values)
  return new Uint8Array(await book.xlsx.writeBuffer())
}

async function prepareProjectImport(bytes: Uint8Array, snapshot: Snapshot, time: string) {
  const before = structuredClone(snapshot)
  const parsed = await parseWorkbookDetailed(bytes)
  if (!parsed.ok) throw new Error(`The real workbook parser refused the fixture: ${parsed.errors.join("; ")}`)
  expect(parsed.origins.some((origin) => origin.sheet === fixture.projectImport.sheet && origin.field === "Budget (USD)")).toBe(true)
  const sourceDigest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
  const built = buildDashboardWorkbookCommand({
    parsed: { ...parsed, sourceDigest, format: "xlsx" }, snapshot,
    target: { surface: "dashboard", selectionRef: "synthetic-project-selection", incarnation: "synthetic-selection-v1", version: 0, options: { newVersion: false, removeMissing: false, preview: { sheet: fixture.projectImport.sheet, replace: false } } },
    source: { surface: "dashboard", type: "dashboard-page", id: "All Projects", incarnation: "synthetic-selection-v1", version: 0, fields: ["projects"], period, observedAt: time },
  })
  if (built.status !== "ok") throw new Error(`The real command builder refused the fixture: ${built.reason}`)
  const command = { ...built.value.command, confirmed: true }
  const preview = previewDashboardImport(built.value.format, snapshot, actor, command, environment(time))
  if (preview.status !== "preview") throw new Error(`The real domain preview refused the fixture: ${preview.reason}`)
  expect(snapshot).toEqual(before)
  return { format: built.value.format, command, preview, sourceDigest, at: time }
}

async function applyPrepared(store: Awaited<ReturnType<typeof openLocalStore>>, prepared: Awaited<ReturnType<typeof prepareProjectImport>>) {
  return store.transaction("dashboard", async (snapshot) => {
    const result = applyDashboardImport(prepared.format, snapshot, actor, prepared.command, environment(prepared.at), prepared.preview.baseDigest, prepared.preview.commandDigest)
    return { commit: result.ok, value: result }
  })
}

async function readSnapshot(store: Awaited<ReturnType<typeof openLocalStore>>) {
  return store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
}

function projects(snapshot: Snapshot) {
  const projection = projectDashboardSource(snapshot, actor, environment(at), "All Projects")
  if (!projection) throw new Error("The real Dashboard did not expose the synthetic projects")
  return rows(projection.projects)
}

function projectBusinessValues(snapshot: Snapshot) {
  return projects(snapshot).map((project) => Object.fromEntries(Object.entries(project).filter(([key]) => key !== "updatedAt")))
}

function xmlText(value: string) {
  return value.replace(/&#(?:x([\da-f]+)|(\d+));/giu, (_, hex: string | undefined, decimal: string | undefined) => String.fromCodePoint(Number.parseInt(hex ?? decimal ?? "0", hex ? 16 : 10)))
    .replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&quot;/gu, '"').replace(/&apos;/gu, "'").replace(/&amp;/gu, "&")
}
