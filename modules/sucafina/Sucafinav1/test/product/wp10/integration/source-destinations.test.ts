import { expect, test } from "bun:test"
import { createDashboardSourceIssuer } from "../../../../product/integration/dashboard-sources.ts"
import { createApplication, type Application } from "../../../../runtime/application.ts"
import { createSfLiveContext, sfContextDestinationsFromPages } from "../../../../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts"
import { createSfDomainProjectionHandlers } from "../../../../../../../apps/cli/src/sucafina-product/native-ui/domain.ts"
import { createSfOperationsProjectionHandlers } from "../../../../../../../apps/cli/src/sucafina-product/native-ui/operations.ts"
import { matchSfNativeRoutePath } from "../../../../../../../packages/app-shell/src/orchestra/chapters/sucafina/route-registry.ts"
import { DashboardBudget } from "../../../../runtime/dashboard-budget.ts"
import { DashboardOperations } from "../../../../runtime/dashboard-operations.ts"
import { sfExtendedSourceLinks } from "../../../../../../../apps/cli/src/sucafina-product/extended-source-links.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"

test("authorized monthly source links select the native chapter and producer with the exact primary calendar period", async () => {
  const fixture = await financialCompositionFixture(), call = await fixture.read()
  const { authority, business, persistence } = fixture
  try {
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.opsTickets = []
      snapshot.data.secKpi = []
      return { commit: true, value: undefined }
    })
    const issue = createDashboardSourceIssuer({ host: business.host, scopedSources: persistence })
    const application: Application = { persistence, authenticate: authority.host.authenticate, environment: authority.host.environment,
      maxJsonBytes: 262144, domains: { dashboard: [DashboardBudget, DashboardOperations], planner: [], procurement: [] } }
    const live = createSfLiveContext({
      origin: "https://example.test", mount: "/sucafina", currentBinding: () => fixture.identity,
      admit: async (request) => {
        const admitted = await authority.readContextAdmission(request)
        if (admitted.status !== "ok") return admitted
        const destinations = sfContextDestinationsFromPages(admitted.pages)
        return destinations
          ? { status: "ok" as const, stamp: admitted.stamp, authMode: "local-operator" as const, destinations }
          : { status: "unavailable" as const, reason: "contract-mismatch" as const }
      },
    })
    const dependencies = { origin: "https://example.test", mount: "/sucafina", application,
      runtime: () => undefined, readContext: (request: Request) => live.readRequestContext(request, fixture.identity) }
    const handlers = [...createSfDomainProjectionHandlers(dependencies), ...createSfOperationsProjectionHandlers(dependencies)]
    const legacy = createApplication("/sucafina", application)
    for (const item of [
      { page: "IT Operations", cap: "CAP11", yearKey: "opsYear", monthKey: "operationsMonth", path: "/orchestra/sf-operations/service", field: "opsTickets", year: "2027", month: "2", end: "2027-02-28" },
      { page: "IT Security KPIs", cap: "CAP12", yearKey: "secYear", monthKey: "securityMonth", path: "/orchestra/sf-operations/security", field: "secKpi", year: "2024", month: "2", end: "2024-02-29" },
      { page: "Executive Dashboard", cap: "CAP01", yearKey: "execYear", monthKey: "executiveMonth", path: "/orchestra/sf-dashboard/executive", field: "executiveMonths", year: "2025", month: "3", end: "2025-03-31" },
    ]) {
      const period = { start: `${item.year}-${item.month.padStart(2, "0")}-01`, end: item.end }
      const issued = await issue({ page: item.page, fields: [item.field], period }, call)
      expect(issued.status).toBe("ok")
      if (issued.status !== "ok") throw new Error(issued.reason)
      const evidence = await business.context.resolve(issued.value.evidence, call)
      expect(evidence).toMatchObject({ state: "fresh", ref: issued.value.evidence, currentRef: issued.value.evidence })
      expect(evidence.authorizedProjection).toBeDefined()
      const links = await sfExtendedSourceLinks({ business, reference: issued.value.evidence, call, url: new URL("https://example.test/sucafina/dashboard?sf=review-source&year=2026") })
      expect(links).toHaveLength(1)
      const destination = new URL(links[0]!.url, "https://example.test")
      expect(destination.origin).toBe("https://example.test")
      expect(destination.pathname).toBe(item.path)
      expect(Object.fromEntries(destination.searchParams)).toEqual({ year: item.year, month: item.month })
      expect(matchSfNativeRoutePath(destination.pathname)).toMatchObject({ surfaceId: item.cap, kind: "entry" })
      const projection = evidence.authorizedProjection
      if (!projection || !("context" in projection)) throw new Error("Native source context unavailable")
      expect(projection.context.period).toEqual(period)
      const handler = handlers.find((entry) => entry.operationId === `domain.page.${item.cap}`)
      expect(handler, `The real ${item.page} native producer must be mounted`).toBeDefined()
      if (!handler) throw new Error("Native source producer unavailable")
      const source = new URL(`/sucafina/api/ui/pages/${item.cap}`, destination.origin)
      // The mounted chapter maps its public year/month to the original producer selectors.
      source.search = new URLSearchParams({
        [item.yearKey]: destination.searchParams.get("year")!,
        [item.monthKey]: destination.searchParams.get("month")!,
      }).toString()
      const response = await handler.handle(new Request(source))
      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toContain("application/json")
      expect(response.headers.get("cache-control")).toContain("no-store")
      const body: unknown = await response.json()
      expect(body).toMatchObject({
        status: "ok", context: { principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision },
        value: { capabilityId: item.cap, selection: { year: Number(item.year), month: Number(item.month) } },
      })
      expect((await legacy(new Request("https://example.test/sucafina/dashboard?" +
        new URLSearchParams({ page: item.page, year: item.year }))))?.status).toBe(404)
      expect(links[0]!.label).toContain(`${period.start} a ${period.end}`)
    }
  } finally { authority.ui.finish(call); await fixture.dispose() }
})

test("monthly source issuance rejects partial spans and navigation refuses a fresh multi-month period", async () => {
  const fixture = await financialCompositionFixture(), call = await fixture.read()
  try {
    await fixture.persistence.transaction("dashboard", async (snapshot) => { snapshot.data.opsTickets = []; return { commit: true, value: undefined } })
    const issue = createDashboardSourceIssuer({ host: fixture.business.host, scopedSources: fixture.persistence })
    // Monthly facts cannot issue a partial-month evidence scope. No synthetic
    // positive evidence is supplied to the link builder for this denied request.
    const partial = await issue({ page: "IT Operations", fields: ["opsTickets"], period: { start: "2027-02-01", end: "2027-02-10" } }, call)
    expect(partial).toEqual({ status: "denied", reason: "source-unavailable" })
    // Multiple whole months are a valid source scope, but a one-month page must
    // not silently navigate to only the first month of that authorized evidence.
    const period = { start: "2027-02-01", end: "2027-03-31" }
    const issued = await issue({ page: "IT Operations", fields: ["opsTickets"], period }, call)
    expect(issued.status).toBe("ok")
    if (issued.status !== "ok") throw new Error(issued.reason)
    const evidence = await fixture.business.context.resolve(issued.value.evidence, call)
    expect(evidence).toMatchObject({ state: "fresh", ref: issued.value.evidence, currentRef: issued.value.evidence })
    expect(evidence.authorizedProjection).toBeDefined()
    expect(issued.value.evidence.target.period).toEqual(period)
    expect(await sfExtendedSourceLinks({ business: fixture.business, reference: issued.value.evidence, call,
      url: new URL("https://example.test/sucafina/dashboard?sf=review-source") })).toEqual([])
    expect(issued.value.evidence.target.period).toEqual(period)
  } finally { fixture.authority.ui.finish(call); await fixture.dispose() }
})
