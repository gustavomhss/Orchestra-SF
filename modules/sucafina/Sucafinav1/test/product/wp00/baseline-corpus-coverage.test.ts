import { expect, test } from "bun:test"
import JSZip from "jszip"
import baseline from "../../../docs/product-campaign/wp00/baseline-capabilities.json"
import additions from "../../../docs/product-campaign/wp00/baseline-new-capabilities.json"
import journeys from "../../../docs/product-campaign/wp00/oracles/journeys-j01-j08.json"
import corpus from "./fixtures/corpus-v2.json"
import inputs from "./fixtures/consumer-inputs.json"
import { createPlannerCorpus } from "./fixtures/planner.ts"
import { contributions } from "../../../index.ts"
import { DASHBOARD_PAGES, PLANNER_TABS, PROCUREMENT_NAV, dashboardPages, plannerKeys, procurementKeys } from "../../../src/nav.ts"
import { initialProcurementSettings, legalInitialSettings } from "../../../src/initial-settings.ts"
import { quoteAssessment } from "../../../src/form.ts"
import { createRequest, submitPR, reject } from "../../../src/procurement.ts"
import type { Store } from "../../../src/procurement.ts"
import { projectPlanner, simulatePlannerCommands } from "../../../product/planner/adapter.ts"
import { simulatePlannerOperations } from "../../../product/planner/scenario.ts"
import { renderPreservedReview } from "../../../product/reviews/render.ts"

const finance = inputs.authorization.finance
const environment = { at: "2026-11-13T04:01:10Z", id: () => "synthetic-new-record", directory: [] }

test("all 28 baseline capabilities retain a real registered entry and an assigned destination", () => {
  expect(baseline.baseline.commit).toBe(corpus.source_code_baseline)
  expect(baseline.capabilities).toHaveLength(28)
  expect(new Set(baseline.capabilities.map((row) => row.capability_id)).size).toBe(28)
  for (const [label, surface, pages] of [
    ["Dashboard", "dashboard", DASHBOARD_PAGES],
    ["Planner", "planner", PLANNER_TABS],
    ["Procurement", "procurement", PROCUREMENT_NAV],
  ] as const) {
    const inventory = baseline.capabilities.filter((row) => row.surface === label).map((row) => row.baseline_page_label)
    expect(inventory.toSorted()).toEqual([...pages].sort())
    expect(contributions[surface].flatMap((domain) => domain.pages).toSorted()).toEqual([...pages].sort())
  }
  for (const row of baseline.capabilities) {
    expect(row.planned_mapping.owner).toMatch(/^WP\d{2}$/)
    expect(row.planned_mapping.task_ids.length).toBeGreaterThan(0)
    expect(row.baseline_observation.command_route_observation.length).toBeGreaterThan(0)
    expect(row.baseline_observation.commands_and_roles_observed.length).toBeGreaterThan(0)
    expect(row.baseline_observation.read_role_rule.length).toBeGreaterThan(0)
  }
  expect(baseline.capabilities.map((row) => row.baseline_page_label)).toEqual(expect.arrayContaining([
    "Talent Review", "Stakeholder Management", "IT Performance Contract", "Suppliers", "Settings", "FX rates", "Entities & allocations",
  ]))
})

test("new requirements and journeys retain explicit owners without claiming execution", () => {
  expect(corpus.synthetic).toBe(true)
  expect(Object.values(corpus.datasets).every((dataset) => dataset.synthetic === true)).toBe(true)
  expect(corpus.datasets.finance.budget.monthly).toHaveLength(12)
  expect(corpus.datasets.finance.actual.monthly).toHaveLength(9)
  expect(corpus.datasets.finance.forecast.monthly).toHaveLength(3)
  expect(additions.requirements).toHaveLength(41)
  expect(additions.aiCapabilities).toHaveLength(18)
  for (const row of [...additions.requirements, ...additions.aiCapabilities]) {
    expect(row.tasks.length).toBeGreaterThan(0)
    expect(row.tasks.every((task) => /^WP\d{2}\.T\d{2}$/.test(task))).toBe(true)
  }
  expect(journeys.journeys.map((journey) => journey.id)).toEqual(["J01", "J02", "J03", "J04", "J05", "J06", "J07", "J08"])
  expect(journeys.journeys.every((journey) => journey.fixtureBindings.length > 0 && journey.executionStatus === "NOT_RUN")).toBe(true)
})

test("native domain role fixtures retain restricted and unaffiliated entry behavior", () => {
  expect(dashboardPages(inputs.authorization.dashboardAdmin)).toContain("Talent Review")
  expect(dashboardPages(inputs.authorization.viewer)).not.toContain("Talent Review")
  expect(dashboardPages(inputs.authorization.outsider)).toEqual([])
  expect(plannerKeys(inputs.authorization.finance)).toEqual([...PLANNER_TABS])
  expect(plannerKeys(inputs.authorization.outsider)).toEqual([])
  expect(procurementKeys(inputs.authorization.outsider)).toEqual([])
})

test("the real Planner projects the declared monthly corpus and replaces the license once", () => {
  const snapshot = createPlannerCorpus()
  const before = structuredClone(snapshot)
  const base = projectPlanner(snapshot, finance, environment).data.versions as { summary: { outlook: number[]; budget: number[] } }[]
  expect(base[0]!.summary.outlook.reduce((sum, value) => sum + value, 0)).toBe(inputs.planner.expected.baseOutlook)
  expect(base[0]!.summary.outlook[inputs.planner.licenseMonthIndex]).toBe(inputs.planner.expected.baseNovember)
  expect(base[0]!.summary.budget).toEqual(corpus.datasets.finance.budget.monthly.map((month) => month.amount))
  for (const [amount, total, november] of [
    [84000, inputs.planner.expected.replacement84000, inputs.planner.expected.november84000],
    [78000, inputs.planner.expected.replacement78000, inputs.planner.expected.november78000],
  ] as const) {
    const result = simulatePlannerOperations(snapshot, finance, environment, inputs.planner.versionId, [{
      kind: "replace", targetRef: `${inputs.planner.licenseLineId}:11`, amount, currency: "USD",
      period: { start: "2027-11-01", end: "2027-11-30" },
    }])
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error("Synthetic Planner replacement was refused")
    const versions = result.view.data.versions as { summary: { outlook: number[] } }[]
    expect(versions[0]!.summary.outlook.reduce((sum, value) => sum + value, 0)).toBe(total)
    expect(versions[0]!.summary.outlook[inputs.planner.licenseMonthIndex]).toBe(november)
  }
  expect(snapshot).toEqual(before)
})

test("the corpus preserves stale edits and denies a viewer through the real Planner command", () => {
  const snapshot = createPlannerCorpus()
  const before = structuredClone(snapshot)
  const command = { page: "OPEX", action: "save", id: inputs.planner.licenseLineId, version: 0, values: { versionId: inputs.planner.versionId, f10: 84000 } }
  const result = simulatePlannerCommands(snapshot, finance, [command, { ...command, values: { ...command.values, f10: 78000 } }], environment)
  expect(result.results[0]).toMatchObject({ ok: true })
  expect(result.results[1]).toMatchObject({ ok: false, status: 409 })
  const denied = simulatePlannerCommands(snapshot, inputs.authorization.viewer, [command], environment)
  expect(denied.results[0]).toMatchObject({ ok: false, status: 403 })
  expect(snapshot).toEqual(before)
})

test("the real quote assessor consumes FX02 inputs, preserves submitted FX and excludes C", () => {
  const fixture = inputs.procurement
  const settings = initialProcurementSettings()
  expect(settings.criteria.map((criterion) => criterion.weight)).toEqual(fixture.weights.criteria.map((criterion) => criterion.weight))
  expect(settings.commCriteria.map((criterion) => criterion.weight)).toEqual(fixture.weights.commCriteria.map((criterion) => criterion.weight))
  expect([settings.techWeight, settings.commWeight]).toEqual([fixture.weights.tech, fixture.weights.comm])
  const result = quoteAssessment({ sourcing: fixture }, { ...settings, fxRates: fixture.laterFxRates })
  expect(result.filter((quote) => quote.rank !== null).sort((left, right) => left.rank! - right.rank!).map((quote) => quote.id)).toEqual(fixture.expected.ranking)
  expect(result.find((quote) => quote.id === "A")).toMatchObject({ eligible: true, complete: true, technical: fixture.expected.aTechnical })
  expect(result.find((quote) => quote.id === "A")!.commercial).toBeCloseTo(fixture.expected.aCommercial, 8)
  expect(result.find((quote) => quote.id === "A")!.overall).toBeCloseTo(fixture.expected.aOverall, 8)
  expect(result.find((quote) => quote.id === "B")).toMatchObject({ eligible: true, complete: true, technical: fixture.expected.bTechnical, commercial: fixture.expected.bCommercial, overall: fixture.expected.bOverall })
  expect(result.find((quote) => quote.id === "C")).toMatchObject({ eligible: false, rank: fixture.expected.cRank })
  const unavailable = quoteAssessment({ sourcing: { ...fixture, fxSnapshot: { USD: 1, EUR: null } } }, settings)
  expect(unavailable.find((quote) => quote.id === "B")).toMatchObject({ eligible: false, rank: null })
})

test("a real procurement return and resubmission retain separate history and reject a stale retry", () => {
  const fixture = inputs.approvalLifecycle
  const settings = initialProcurementSettings()
  const store: Store = {
    settings: { ...legalInitialSettings(), levels: settings.levels.map((level) => ({ ...level, holderId: fixture.holder.id })) },
    form: settings, issued: { pr: [], po: [] }, sup: [], suppliers: [], requests: {}, actCalls: 0, lastIssued: null,
  }
  const created = createRequest(store, { type: "create", pr: fixture.request }, fixture.requester, fixture.createdAt)
  expect(created.ok).toBe(true)
  if (!created.ok) throw new Error("Synthetic request creation failed")
  const id = String(created.request.number)
  expect(submitPR(store, id, 1, fixture.requester, fixture.submittedAt, { pr: fixture.request }).ok).toBe(true)
  expect(reject(store, id, 2, fixture.holder, fixture.returnedAt, fixture.returnReason).ok).toBe(true)
  expect(store.requests[id]!.request.status).toBe(fixture.expected.returnedStatus)
  const returned = structuredClone(store.requests[id]!.request)
  const priorHistory = returned.history as Record<string, unknown>[]
  expect(submitPR(store, id, 3, fixture.requester, fixture.resubmittedAt, { pr: fixture.request }).ok).toBe(true)
  expect(store.requests[id]!.request.status).toBe(fixture.expected.resubmittedStatus)
  const history = store.requests[id]!.request.history as Record<string, unknown>[]
  expect(history.slice(0, priorHistory.length)).toEqual(priorHistory)
  expect(history.filter((event) => event.action === "Requisition submitted for approval")).toHaveLength(fixture.expected.submissionEvents)
  expect(history.filter((event) => String(event.action).startsWith("Requisition rejected by "))).toHaveLength(fixture.expected.rejectionEvents)
  expect(history).toContainEqual(expect.objectContaining({ by: fixture.holder.id, at: fixture.returnedAt, note: fixture.returnReason }))
  const beforeRetry = structuredClone(store)
  expect(submitPR(store, id, 3, fixture.requester, fixture.resubmittedAt, { pr: fixture.request })).toEqual({ ok: false, stored: store.requests[id]!.request, by: fixture.requester.id })
  expect(store).toEqual(beforeRetry)
})

test("both real report renderers retain all 20 diagnostic corpus records once", async () => {
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const source = { surface: "dashboard", type: "project", id: "synthetic-report-corpus", incarnation: "synthetic-report-v1", version: 1, fields: ["id", "value", "period", "status", "owner"], period, observedAt: environment.at } as const
  const review = {
    id: "synthetic-corpus-review", version: 1, createdAt: environment.at, sourceRefs: [source], comments: [],
    sections: [{
      id: "corpus-records", title: "Synthetic records", period, count: corpus.datasets.report.expected_record_count, sourceRefs: [source],
      content: {
        context: { sourceRefs: [source] }, missing: [],
        values: corpus.datasets.report.records.map((record) => ({ id: record.id, value: `${record.period}; ${record.value} USD; ${record.status}; ${record.owner}`, period, granularity: "record", sourceRefs: [], drilldown: null, evidenceState: "confirmed" })),
      },
    }],
  }
  for (const format of ["docx", "pptx"] as const) {
    const artifact = await renderPreservedReview(review, { title: "WP00 synthetic corpus", format, sectionRefs: ["corpus-records"] })
    if (!artifact.ok) throw new Error("Synthetic report rendering failed")
    const zip = await JSZip.loadAsync(artifact.bytes)
    const paths = Object.keys(zip.files).filter((path) => format === "docx" ? path === "word/document.xml" : /^ppt\/slides\/slide\d+\.xml$/.test(path))
    expect(paths.length).toBeGreaterThan(0)
    const xml = (await Promise.all(paths.map((path) => zip.file(path)!.async("string")))).join(" ")
    for (const record of corpus.datasets.report.records) expect(xml.split(`${record.id}:`).length - 1).toBe(1)
    expect(xml).toContain("2027-09")
    expect(xml).toContain("2500 USD")
  }
})
