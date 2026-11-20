import { expect, test } from "bun:test"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { rows } from "../../../runtime/contract.ts"
import { discoverSfDashboardAgenda } from "../../../../../../apps/cli/src/sucafina-product/dashboard-services.ts"
import { createSfReviewAgendaServices } from "../../../../../../apps/cli/src/sucafina-product/review-agenda-services.ts"
import { financialCompositionFixture } from "../wp10/integration/financial-composition-fixture.ts"
import { available } from "../wp08/relations-fixture.ts"

type Fixture = Awaited<ReturnType<typeof financialCompositionFixture>>
type Services = Fixture["business"]["dashboardServices"]
const period = { start: "2026-01-01", end: "2026-12-31" }
const query = { page: "Hot Topics & Actions", period }

// The existing fixture owns authentication and grants. Domain data is ordinary
// fixture input; selections, record receipts, C05 and captures use real producers.
async function withAgendaFixture(work: (fixture: Fixture, call: TrustedDomainContext) => Promise<void>) {
  const fixture = await financialCompositionFixture()
  try {
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.hotTopics = [{ id: "agenda-topic", action: "Retained agenda action", owner: "Operations",
        due: "2026-12-01", priority: "normal", status: "open", notes: "Retained agenda source" }]
      return { commit: true, value: undefined }
    })
    const call = await fixture.read()
    try { await work(fixture, call) } finally { fixture.authority.ui.finish(call) }
  } finally { await fixture.dispose() }
}

async function preserveHistory(fixture: Fixture, call: TrustedDomainContext) {
  const dashboard = fixture.business.dashboardServices
  const discovery = available(await dashboard.discover(query, call))
  if (!discovery.agenda || discovery.records.length !== 1) throw new Error("Actual Dashboard agenda/record missing")
  const selected = available(await dashboard.agenda({ sections: [discovery.agenda.section] }, call))
  const command = { selectionRef: selected.selectionRef, sectionRefs: selected.sections.map((section) => section.id) }
  const preserve = available(await fixture.authority.human.admit(fixture.request(), "reviews.preserve", command))
  const review = await (async () => {
    try { return available(await dashboard.preserveReview(command, preserve)) } finally { fixture.authority.ui.finish(preserve) }
  })()
  const captureCommand = { sourceRef: discovery.records[0]!.sourceRef }
  const capture = available(await fixture.authority.human.admit(fixture.request(), "reviews.preserve", captureCommand))
  const captured = await (async () => {
    try { return available(await dashboard.capture(captureCommand, capture)) } finally { fixture.authority.ui.finish(capture) }
  })()
  return { review, captured }
}

function observeDiscovery(fixture: Fixture) {
  const calls = { resolve: 0, issue: 0, read: 0 }
  const namespaces: string[] = []
  const prefixes: typeof calls[] = []
  const records = fixture.business.dashboardRecords
  const resolve = records.resolve, issue = records.issue, read = records.read
  records.resolve = (...args) => { calls.resolve++; return resolve(...args) }
  records.issue = (...args) => { calls.issue++; return issue(...args) }
  records.read = (...args) => { calls.read++; return read(...args) }
  const stateRead = fixture.authority.state.read
  fixture.authority.state.read = async (request, namespace, inspect) => {
    if (namespace === "preferences" && prefixes.length === 0) prefixes.push({ ...calls })
    namespaces.push(namespace)
    return stateRead(request, namespace, inspect)
  }
  return { calls, namespaces, prefixes, reset: () => {
    calls.resolve = 0; calls.issue = 0; calls.read = 0; namespaces.length = 0; prefixes.length = 0
  } }
}

test("internal agenda keeps current sources, records, permissions and C08 observations without reopening historical bodies", async () => {
  await withAgendaFixture(async (fixture, call) => {
    const dashboard = fixture.business.dashboardServices
    const saved = await preserveHistory(fixture, call)
    const observed = observeDiscovery(fixture)
    const full = available(await dashboard.discover(query, call))
    expect(full.history).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "capture", ref: saved.captured.captureId }),
      expect.objectContaining({ kind: "review", ref: saved.review.id }),
    ]))
    expect(observed.namespaces.filter((value) => value === "preferences").length).toBeGreaterThan(1)
    expect(observed.namespaces.filter((value) => value === "reviews").length).toBeGreaterThan(1)
    const beforeHistory = { ...observed.prefixes[0]! }
    expect(beforeHistory.resolve).toBeGreaterThan(0)
    expect(beforeHistory.issue).toBeGreaterThan(0)
    expect(beforeHistory.read).toBeGreaterThan(0)
    const { history, ...current } = full
    expect(history).toHaveLength(2)

    observed.reset()
    const narrow = available(await discoverSfDashboardAgenda(dashboard, query, call))
    expect(narrow).toEqual(current)
    expect(Object.hasOwn(narrow, "history")).toBe(false)
    expect(narrow.records).toHaveLength(1)
    expect(narrow.records[0]?.draft).toBeDefined()
    expect(narrow.permissions).toEqual({ preserve: true, capture: true })
    expect(observed.namespaces).toEqual(["preferences", "reviews"])
    expect(observed.prefixes).toEqual([beforeHistory])
    expect(observed.calls).toEqual(beforeHistory)
    if (!narrow.agenda) throw new Error("Actual narrow agenda missing")
    const source = available(await fixture.business.dashboardSources.resolveDashboardSource(narrow.agenda.section.selectionRef, call))
    expect(source.page).toBe(query.page)
    expect(source.evidence.target.period).toEqual(period)

    observed.reset()
    const catalog = available(await createSfReviewAgendaServices({ authority: fixture.authority, business: fixture.business,
      persistence: fixture.persistence }).discover({ period, domain: "dashboard", dashboardTopics: ["hot-topics"] }, call))
    expect(catalog.options).toHaveLength(1)
    expect(catalog.options[0]?.item).toMatchObject({ kind: "dashboard", topic: "hot-topics", selectionRef: narrow.agenda.section.selectionRef, period })
    expect(observed.namespaces).toEqual(["preferences", "reviews"])

    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      const topics = rows(snapshot.data.hotTopics)
      if (!topics[0]) throw new Error("Actual source record missing")
      topics[0].action = "Current agenda action after edit"
      return { commit: true, value: undefined }
    })
    const changed = available(await discoverSfDashboardAgenda(dashboard, query, call))
    expect(changed.agenda?.section.selectionRef).not.toBe(narrow.agenda.section.selectionRef)
    expect(changed.records[0]?.label).toBe("Current agenda action after edit")
    expect(changed.records[0]?.draft?.fields.action).toBe("Current agenda action after edit")
  })
}, 120_000)

for (const shape of ["wrapper", "spread", "inherited", "proxy", "replacement", "accessor"] as const) {
  test(`agenda discovery retains public semantics for ${shape} services`, async () => {
    await withAgendaFixture(async (fixture, call) => {
      await preserveHistory(fixture, call)
      const dashboard = fixture.business.dashboardServices
      const publicDiscover = dashboard.discover
      const full = available(await dashboard.discover(query, call))
      let calls = 0, gets = 0, descriptors = 0
      const receivers: unknown[] = []
      const replacement: Services["discover"] = function (this: unknown, request, context) {
        calls++; receivers.push(this)
        expect(request).toBe(query)
        expect(context).toBe(call)
        return publicDiscover(request, context)
      }
      const service = shape === "wrapper" ? { discover: replacement }
        : shape === "spread" ? { ...dashboard }
        : shape === "inherited" ? Object.create(dashboard) as Services
        : shape === "proxy" ? new Proxy(dashboard, {
          get(target, property, receiver) { if (property === "discover") gets++; return Reflect.get(target, property, receiver) },
          getOwnPropertyDescriptor(target, property) { descriptors++; return Reflect.getOwnPropertyDescriptor(target, property) },
        }) : dashboard
      if (shape === "replacement") dashboard.discover = replacement
      if (shape === "accessor") Object.defineProperty(dashboard, "discover", { configurable: true,
        get: () => { gets++; return publicDiscover } })
      try {
        expect(available(await discoverSfDashboardAgenda(service, query, call))).toEqual(full)
        if (shape === "wrapper" || shape === "replacement") {
          expect(calls).toBe(1)
          expect(receivers).toEqual([service])
        }
        if (shape === "proxy") { expect(gets).toBe(1); expect(descriptors).toBe(0) }
        if (shape === "accessor") expect(gets).toBe(1)
      } finally {
        Object.defineProperty(dashboard, "discover", { configurable: true, enumerable: true, writable: true, value: publicDiscover })
      }
    })
  }, 120_000)
}

for (const boundary of ["preferences", "reviews", "final-authority"] as const) {
  test(`agenda discovery uses the current public method when replaced across ${boundary} await`, async () => {
    await withAgendaFixture(async (fixture, call) => {
      await preserveHistory(fixture, call)
      const dashboard = fixture.business.dashboardServices, publicDiscover = dashboard.discover
      const full = available(await publicDiscover(query, call))
      const request = fixture.authority.host.requestFor(call)
      let armed = true, reviewsRead = false, finalSourceRead = false, calls = 0, replacements = 0
      const replacement: Services["discover"] = function (this: unknown, incoming, context) {
        calls++
        expect(this).toBe(dashboard)
        expect(incoming).toBe(query)
        expect(context).toBe(call)
        expect(fixture.authority.host.requestFor(context)).toBe(request)
        return publicDiscover(incoming, context)
      }
      const swap = () => { if (armed) { armed = false; replacements++; dashboard.discover = replacement } }
      const stateRead = fixture.authority.state.read
      fixture.authority.state.read = async (source, namespace, inspect) => {
        const result = await stateRead(source, namespace, inspect)
        if (namespace === "reviews") reviewsRead = true
        if (boundary === namespace) swap()
        return result
      }
      const resolve = fixture.business.dashboardSources.resolveDashboardSource
      fixture.business.dashboardSources.resolveDashboardSource = async (...args) => {
        const result = await resolve(...args)
        if (reviewsRead) finalSourceRead = true
        return result
      }
      const revalidate = fixture.authority.host.revalidate
      fixture.authority.host.revalidate = async (context) => {
        const result = await revalidate(context)
        if (boundary === "final-authority" && finalSourceRead) swap()
        return result
      }
      expect(available(await discoverSfDashboardAgenda(dashboard, query, call))).toEqual(full)
      expect(replacements).toBe(1)
      expect(calls).toBe(1)
    })
  }, 120_000)
}

for (const namespace of ["preferences", "reviews"] as const) {
  test(`internal agenda retains the ${namespace} permission refusal`, async () => {
    await withAgendaFixture(async (fixture, call) => {
      await preserveHistory(fixture, call)
      const stateRead = fixture.authority.state.read
      let refusals = 0
      fixture.authority.state.read = async (request, selected, inspect) => {
        const result = await stateRead(request, selected, inspect)
        if (selected !== namespace) return result
        refusals++
        return { status: "denied", reason: "test-state-access-denied" }
      }
      const full = available(await fixture.business.dashboardServices.discover(query, call))
      const { history, ...current } = full
      expect(history.some((entry) => entry.kind === (namespace === "reviews" ? "review" : "capture"))).toBe(false)
      const narrow = available(await discoverSfDashboardAgenda(fixture.business.dashboardServices, query, call))
      expect(narrow).toEqual(current)
      expect(narrow.permissions).toEqual({ preserve: namespace !== "reviews", capture: namespace !== "preferences" })
      expect(refusals).toBeGreaterThanOrEqual(2)
    })
  }, 120_000)
}

for (const mode of ["public", "internal"] as const) for (const fault of ["source-change", "authority-loss"] as const) {
  test(`${mode} agenda retains the real late ${fault} fence`, async () => {
    await withAgendaFixture(async (fixture, call) => {
      let armed = true, reviewsRead = false, revokeAtFinal = false, mutations = 0
      const stateRead = fixture.authority.state.read
      fixture.authority.state.read = async (source, namespace, inspect) => {
        const result = await stateRead(source, namespace, inspect)
        if (namespace === "reviews") {
          reviewsRead = true
          if (fault === "source-change" && armed) {
            armed = false; mutations++
            await fixture.persistence.transaction("dashboard", async (snapshot) => {
              const topics = rows(snapshot.data.hotTopics)
              if (!topics[0]) throw new Error("Actual source record missing")
              topics[0].notes = "Source changed during discovery"
              return { commit: true, value: undefined }
            })
          }
        }
        return result
      }
      const resolve = fixture.business.dashboardSources.resolveDashboardSource
      fixture.business.dashboardSources.resolveDashboardSource = async (...args) => {
        const result = await resolve(...args)
        if (fault === "authority-loss" && reviewsRead && armed) revokeAtFinal = true
        return result
      }
      const revalidate = fixture.authority.host.revalidate
      fixture.authority.host.revalidate = async (context) => {
        if (revokeAtFinal && armed) { armed = false; mutations++; fixture.active.value = false }
        return revalidate(context)
      }
      const result = await (mode === "public" ? fixture.business.dashboardServices.discover(query, call)
        : discoverSfDashboardAgenda(fixture.business.dashboardServices, query, call))
      expect(mutations).toBe(1)
      expect(result).toEqual(fault === "source-change"
        ? { status: "stale", reason: "dashboard-discovery-source-changed" }
        : { status: "denied", reason: "dashboard-discovery-unavailable" })
      expect("value" in result).toBe(false)
    })
  }, 120_000)
}
