import { expect, test } from "bun:test"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { createSfBiServices } from "../../../../../../../apps/cli/src/sucafina-product/bi-services.ts"
import { createSfReviewServices } from "../../../../../../../apps/cli/src/sucafina-product/review-services.ts"
import { createSfExtendedReviewCycle } from "../../../../../../../apps/cli/src/sucafina-product/extended-review-cycle.ts"
import { createSfExtendedHttp } from "../../../../../../../apps/cli/src/sucafina-product/extended-http.ts"
import { createSfPersonalViewAuthority, sfPersonalViewSelectionAllowed } from "../../../../../../../apps/cli/src/sucafina-product/personal-view-authority.ts"
import type { SfPersonalView } from "../../../../product/interface/personal-views.ts"
import { createSfExtendedBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/extended-business-services.ts"
import { createApplication } from "../../../../runtime/application.ts"
import { DashboardBudget } from "../../../../runtime/dashboard-budget.ts"
import { DashboardOperations } from "../../../../runtime/dashboard-operations.ts"

test("review and BI links retain the actual page's scoped year and selected month", async () => {
  const fixture = await financialCompositionFixture()
  const { authority, business, persistence, guards } = fixture
  const extended = createSfExtendedBusinessServices({ authority, business, persistence, ...guards, origin: "https://example.test",
    assets: { bi: async () => "", reviews: async () => "" } })
  try {
    const selections = [
      { query: "page=IT+Operations&year=2026&opsYear=2027&operationsMonth=2", start: "2027-02-01", end: "2027-02-28" },
      { query: "page=IT+Security+KPIs&year=2026&secYear=2024&securityMonth=2", start: "2024-02-01", end: "2024-02-29" },
      { query: "page=Executive+Dashboard&year=2026&execYear=2025&executiveMonth=3&opsMonth=8", start: "2025-03-01", end: "2025-03-31" },
      { query: "page=IT+Operations&year=2027&own=2025&month=5", start: "2025-05-01", end: "2025-05-31" },
      { query: "page=IT+Operations&year=2027", start: "2026-11-01", end: "2026-11-30" },
      { query: "page=Budget+Overview&year=2027", start: "2027-01-01", end: "2027-12-31" },
    ]
    for (const selected of selections) {
      const request = new Request(`https://example.test/sucafina/dashboard?${selected.query}`)
      const application = createApplication("/sucafina", { persistence, authenticate: authority.host.authenticate, environment: authority.host.environment,
        maxJsonBytes: 262144, domains: { dashboard: [DashboardBudget, DashboardOperations], planner: [], procurement: [] },
        productHtml: (html, surface, page) => extended.productHtml(html, surface, page, request) })
      const response = await application(request)
      expect(response?.status).toBe(200)
      const html = await response!.text()
      const navigation = /<nav data-sf-extended-navigation[\s\S]*?<\/nav>/.exec(html)?.[0]
      expect(navigation).toBeDefined()
      const links = [...navigation!.matchAll(/href="([^"]+)"/g)].map((match) => new URL(match[1]!.replaceAll("&amp;", "&"), request.url))
      expect(links.map((link) => link.searchParams.get("sf"))).toEqual(["bi", "review"])
      for (const link of links) {
        expect(link.searchParams.get("page")).toBe(new URL(request.url).searchParams.get("page"))
        expect(link.searchParams.get("start")).toBe(selected.start)
        expect(link.searchParams.get("end")).toBe(selected.end)
      }
    }
  } finally { extended.dispose(); await fixture.dispose() }
})

test("a non-Budget review update preserves topic, period, notes and predecessor after explicit new record selection", async () => {
  const fixture = await financialCompositionFixture(), call = await fixture.read()
  const { authority, business, portfolio, persistence } = fixture
  try {
    const bi = createSfBiServices({ authority, business, portfolio })
    const reviews = createSfReviewServices({ authority, business, portfolio, bi, persistence, origin: "https://example.test" }).application
    expect(reviews).toBeDefined()
    if (!reviews) throw new Error("Published review producers were not composed")
    const period = { start: "2026-01-01", end: "2026-12-31" }
    const source = await business.dashboardServices.discover({ page: "OPEX Detail", period }, call)
    if (source.status !== "ok" || !source.value.agenda) throw new Error("OPEX agenda unavailable")
    const item = { kind: "dashboard" as const, ...source.value.agenda.section, id: "selected-opex", agendaNote: "Preserve this human note" }
    const agenda = await reviews.agenda!.create([item], call)
    if (agenda.status !== "ok") throw new Error(agenda.reason)
    const preserved = await reviews.human.preserve(fixture.request("review-previous"), { selectionRef: agenda.value.selectionRef, sectionRefs: agenda.value.sectionRefs })
    if (preserved.status !== "ok") throw new Error(preserved.reason)
    const cycle = createSfExtendedReviewCycle({ authority, business, reviews, persistence })
    expect(await cycle.update(preserved.value.id, call)).toMatchObject({ status: "ok", value: { available: false, previousReviewRef: preserved.value.id } })
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.opexOwners = [{ id: "owner", name: "Operations", budget: 1800 }]; return { commit: true, value: undefined } })
    const update = await cycle.update(preserved.value.id, call)
    expect(update.status).toBe("ok")
    if (update.status !== "ok") throw new Error(update.reason)
    expect(update.value.available).toBe(true)
    expect(update.value.items).toHaveLength(1)
    expect(update.value.items[0]).toMatchObject({ kind: "dashboard", id: item.id, topic: item.topic, period, agendaNote: item.agendaNote })
    expect(update.value.confirmations).toHaveLength(1)
    expect(update.value.unavailableSections).toHaveLength(0)
    // The test now makes the explicit new selection represented by the UI confirmation.
    const nextAgenda = await reviews.agenda!.create(update.value.items, call)
    if (nextAgenda.status !== "ok") throw new Error(nextAgenda.reason)
    const successor = await reviews.human.preserve(fixture.request("review-successor"), { selectionRef: nextAgenda.value.selectionRef, sectionRefs: nextAgenda.value.sectionRefs, previousReviewRef: update.value.previousReviewRef })
    expect(successor.status).toBe("ok")
    if (successor.status !== "ok") throw new Error(successor.reason)
    expect(successor.value.previousReviewRef).toBe(preserved.value.id)
    expect(successor.value.sections[0]).toMatchObject({ id: item.id, period, content: { reviewAgendaNote: item.agendaNote } })
    expect(await reviews.reviews.read(preserved.value.id, call)).toEqual(preserved)
    fixture.active.value = false
    expect((await cycle.update(preserved.value.id, call)).status).toBe("denied")
  } finally { authority.ui.finish(call); await fixture.dispose() }
})

test("saved views accept only each page's real filter values and authorized record identities", () => {
  const view = (surface: SfPersonalView["surface"], page: string, selections: NonNullable<NonNullable<SfPersonalView["filters"]>["selections"]>): SfPersonalView => ({ id: "view", title: "View", surface, page, filters: { selections } })
  const planner = { versions: [{ id: "v1", year: 2026 }, { id: "v2", year: 2027 }], directory: [{ id: "owner" }] }
  expect(sfPersonalViewSelectionAllowed(view("planner", "OPEX", { year: "2026", version: "v1", owner: "owner", class: "opex", mode: "compare" }), planner, "person")).toBe(true)
  expect(sfPersonalViewSelectionAllowed(view("planner", "OPEX", { version: "missing" }), planner, "person")).toBe(false)
  expect(sfPersonalViewSelectionAllowed(view("planner", "OPEX", { owner: "revoked" }), planner, "person")).toBe(false)
  expect(sfPersonalViewSelectionAllowed(view("planner", "Overview", { version: "v1", filter: "v2" }), planner, "person")).toBe(false)
  expect(sfPersonalViewSelectionAllowed(view("dashboard", "Hot Topics & Actions", { topicStatus: "blocked" }), { hotTopics: [] }, "person")).toBe(true)
  expect(sfPersonalViewSelectionAllowed(view("dashboard", "Talent Review", { memberStatus: "Active" }), { members: [] }, "person")).toBe(true)
  expect(sfPersonalViewSelectionAllowed(view("dashboard", "Budget Overview", { memberStatus: "Active" }), {}, "person")).toBe(false)
  const procurement = { requests: [{ number: 17 }], suppliers: [{ id: "supplier" }] }
  expect(sfPersonalViewSelectionAllowed(view("procurement", "Requests", { filter: "Awaiting approval", request: "17" }), procurement, "person")).toBe(true)
  expect(sfPersonalViewSelectionAllowed(view("procurement", "Requests", { request: "18" }), procurement, "person")).toBe(false)
  expect(sfPersonalViewSelectionAllowed(view("procurement", "Suppliers", { status: "pending", supplier: "supplier" }), procurement, "person")).toBe(true)
  expect(sfPersonalViewSelectionAllowed(view("procurement", "Suppliers", { status: "administrator" }), procurement, "person")).toBe(false)
})

test("saved-view authorization and BI choice reads stop after actual host revocation", async () => {
  const fixture = await financialCompositionFixture(), call = await fixture.read()
  const { authority, business, portfolio, persistence } = fixture
  try {
    const allowed = createSfPersonalViewAuthority({ authority })
    const view: SfPersonalView = { id: "opex", title: "OPEX", surface: "dashboard", page: "OPEX Detail", filters: { selections: { year: "2026" } } }
    expect(await allowed(view, call)).toBe(true)
    const bi = createSfBiServices({ authority, business, portfolio })
    const http = createSfExtendedHttp({ authority, business, bi, reviews: undefined, persistence, origin: "https://example.test", assets: { bi: async () => { throw new Error("JSON options must not build the browser") }, reviews: async () => { throw new Error("JSON options must not build the browser") } } })
    const endpoint = "https://example.test/dashboard?sf=bi-options&viewId=BI01&start=2026-01-01&end=2026-12-31"
    const response = await http(new Request(endpoint), "dashboard")
    expect(response?.status).toBe(200)
    const body = await response!.json()
    expect(body).toMatchObject({ status: "ok" })
    expect(body.value.choices.some((choice: { label: string }) => choice.label.includes("Budget Overview"))).toBe(true)
    expect(body.value).not.toHaveProperty("selected")
    expect((await http(new Request(`${endpoint}&role=admin`), "dashboard"))?.status).toBe(400)
    fixture.active.value = false
    expect(await allowed(view, call)).toBe(false)
    expect((await http(new Request(endpoint), "dashboard"))?.status).toBe(403)
  } finally { authority.ui.finish(call); await fixture.dispose() }
})
