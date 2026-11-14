import { expect, test } from "bun:test"
import { createDashboardSourceIssuer } from "../../../../product/integration/dashboard-sources.ts"
import { createApplication } from "../../../../runtime/application.ts"
import { DashboardBudget } from "../../../../runtime/dashboard-budget.ts"
import { DashboardOperations } from "../../../../runtime/dashboard-operations.ts"
import { sfExtendedSourceLinks } from "../../../../../../../apps/cli/src/sucafina-product/extended-source-links.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"

test("authorized monthly source links open the real page with the exact primary calendar period", async () => {
  const fixture = await financialCompositionFixture(), call = await fixture.read()
  const { authority, business, persistence } = fixture
  try {
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.opsTickets = []
      snapshot.data.secKpi = []
      return { commit: true, value: undefined }
    })
    const issue = createDashboardSourceIssuer({ host: business.host, scopedSources: persistence })
    const application = createApplication("/sucafina", { persistence, authenticate: authority.host.authenticate, environment: authority.host.environment,
      maxJsonBytes: 262144, domains: { dashboard: [DashboardBudget, DashboardOperations], planner: [], procurement: [] } })
    for (const item of [
      { page: "IT Operations", field: "opsTickets", year: "2027", month: "2", yearKey: "opsYear", monthKey: "operationsMonth", end: "2027-02-28" },
      { page: "IT Security KPIs", field: "secKpi", year: "2024", month: "2", yearKey: "secYear", monthKey: "securityMonth", end: "2024-02-29" },
      { page: "Executive Dashboard", field: "executiveMonths", year: "2025", month: "3", yearKey: "execYear", monthKey: "executiveMonth", end: "2025-03-31" },
    ]) {
      const period = { start: `${item.year}-${item.month.padStart(2, "0")}-01`, end: item.end }
      const issued = await issue({ page: item.page, fields: [item.field], period }, call)
      expect(issued.status).toBe("ok")
      if (issued.status !== "ok") throw new Error(issued.reason)
      const links = await sfExtendedSourceLinks({ business, reference: issued.value.evidence, call, url: new URL("https://example.test/sucafina/dashboard?sf=review-source&year=2026") })
      expect(links).toHaveLength(1)
      const destination = new URL(links[0]!.url, "https://example.test")
      expect(destination.searchParams.get(item.yearKey)).toBe(item.year)
      expect(destination.searchParams.get(item.monthKey)).toBe(item.month)
      expect(destination.searchParams.get("page")).toBe(item.page)
      const response = await application(new Request(destination))
      expect(response?.status).toBe(200)
      const html = await response!.text()
      for (const [key, value] of [[item.yearKey, item.year], [item.monthKey, item.month]]) {
        const select = [...html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)].find((match) => new RegExp(`(?:data-query|name)="${key}"`).test(match[1]!))
        expect(select, `The real ${item.page} page must render ${key}`).toBeDefined()
        const selected = /<option\b([^>]*\bselected\b[^>]*)>([^<]*)<\/option>/.exec(select![2]!)
        expect(selected).toBeDefined()
        expect(/\bvalue="([^"]*)"/.exec(selected![1]!)?.[1] ?? selected![2]!.trim()).toBe(value)
      }
      expect(links[0]!.label).toContain(`${period.start} a ${period.end}`)
    }
  } finally { authority.ui.finish(call); await fixture.dispose() }
})

test("monthly source issuance rejects partial spans and navigation refuses a fresh multi-month period", async () => {
  const fixture = await financialCompositionFixture(), call = await fixture.read()
  try {
    await fixture.persistence.transaction("dashboard", async (snapshot) => { snapshot.data.opsTickets = []; return { commit: true, value: undefined } })
    const issue = createDashboardSourceIssuer({ host: fixture.business.host, scopedSources: fixture.persistence })
    const partial = await issue({ page: "IT Operations", fields: ["opsTickets"], period: { start: "2027-02-01", end: "2027-02-10" } }, call)
    expect(partial).toEqual({ status: "denied", reason: "source-unavailable" })
    const issued = await issue({ page: "IT Operations", fields: ["opsTickets"], period: { start: "2027-02-01", end: "2027-03-31" } }, call)
    expect(issued.status).toBe("ok")
    if (issued.status !== "ok") throw new Error(issued.reason)
    expect((await fixture.business.context.resolve(issued.value.evidence, call)).state).toBe("fresh")
    expect(await sfExtendedSourceLinks({ business: fixture.business, reference: issued.value.evidence, call,
      url: new URL("https://example.test/sucafina/dashboard?sf=review-source") })).toEqual([])
  } finally { fixture.authority.ui.finish(call); await fixture.dispose() }
})
