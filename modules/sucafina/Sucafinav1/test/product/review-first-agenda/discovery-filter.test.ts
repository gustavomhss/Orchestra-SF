import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import type { ReviewAgendaCatalog, ReviewAgendaDiscoveryQuery } from "../../../product/reviews/agenda-picker.ts"
import { dashboardTopicPage } from "../../../product/reviews/selection.ts"
import { rows } from "../../../runtime/contract.ts"
import { available } from "../wp08/relations-fixture.ts"
import { createFirstAgendaFixture } from "./fixture.ts"

type Fixture = Awaited<ReturnType<typeof createFirstAgendaFixture>>
const dashboardPages = ["Executive Dashboard", "Budget Overview", "OPEX Detail", "CAPEX Projects", "Headcount Overview",
  "Team Structure", "Talent Review", "Portfolio Dashboard", "All Projects", "Hot Topics & Actions", "IT Operations",
  "IT Security KPIs", "IT Risks", "Vendor Contracts", "Stakeholder Management", "IT Performance Contract"]

function observeDashboard(f: Fixture) {
  const discovered: string[] = [], outerReads: string[] = []
  const discover = f.business.dashboardServices.discover, resolve = f.business.dashboardSources.resolveDashboardSource
  let depth = 0
  f.business.dashboardServices.discover = async (...args) => {
    discovered.push(args[0].page)
    depth++
    try { return await discover(...args) } finally { depth-- }
  }
  f.business.dashboardSources.resolveDashboardSource = async (...args) => {
    if (!depth) outerReads.push(args[0])
    return resolve(...args)
  }
  return { discovered, outerReads, insideDiscovery: () => depth > 0 }
}

function filteredQuery(f: Fixture, dashboardTopics: readonly string[] = ["budget"]) {
  return { start: f.period.start, end: f.period.end, domain: "dashboard", dashboardTopics: JSON.stringify(dashboardTopics) }
}

test("Dashboard topic filter admits the exact query and retains initial and final canonical reads for every requested page", async () => {
  const f = await createFirstAgendaFixture()
  try {
    const observed = observeDashboard(f), admissions: { operation: string; digest: string }[] = []
    const admit = f.authority.ui.admit
    f.authority.ui.admit = async (request, operation, digest) => {
      admissions.push({ operation, digest })
      return admit(request, operation, digest)
    }
    const dashboardTopics = ["projects", "budget", "hot-topics"]
    const response = await f.request("review-agenda", undefined, filteredQuery(f, dashboardTopics))
    const result = await response.json() as PortResult<ReviewAgendaCatalog>
    expect({ http: response.status, result }).toMatchObject({ http: 200, result: { status: "ok" } })
    const catalog = available(result)
    expect(admissions).toEqual([{ operation: "sf_review_prepare", digest: digestSfValue({ period: f.period, domain: "dashboard", dashboardTopics }) }])
    expect(observed.discovered).toEqual(["Budget Overview", "Portfolio Dashboard", "Hot Topics & Actions"])
    expect(observed.outerReads).toHaveLength(6)
    expect(observed.outerReads.slice(3)).toEqual(observed.outerReads.slice(0, 3))
    expect(catalog.options.map((option) => option.label)).toEqual(observed.discovered)
    expect(catalog.options.map((option) => option.item.kind === "dashboard" ? option.item.topic : option.item.kind)).toEqual(["budget", "projects", "hot-topics"])
    for (const option of catalog.options) {
      expect(option.domain).toBe("dashboard")
      expect(option.item.kind).toBe("dashboard")
      if (option.item.kind !== "dashboard") throw new Error("Filtered Dashboard item missing")
      expect(option.item.period).toEqual(f.period)
      expect(dashboardTopicPage(option.item.topic)).toBe(option.label)
      expect(option.item.selectionRef).toMatch(/^sf-source:/)
    }
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await f.storedReviews()).toEqual([])
  } finally { await f.dispose() }
})

test("omitting Dashboard topics preserves the complete canonical Dashboard discovery", async () => {
  const f = await createFirstAgendaFixture()
  try {
    const observed = observeDashboard(f)
    const response = await f.request("review-agenda", undefined, { start: f.period.start, end: f.period.end, domain: "dashboard" })
    const result = await response.json() as PortResult<ReviewAgendaCatalog>
    expect({ http: response.status, result }).toMatchObject({ http: 200, result: { status: "ok" } })
    expect(observed.discovered).toEqual(dashboardPages)
    const options = available(result).options
    expect(options.map((option) => option.label)).toEqual(expect.arrayContaining(["Budget Overview", "Portfolio Dashboard", "Talent Review"]))
    expect(options.every((option) => option.item.kind === "dashboard" && dashboardTopicPage(option.item.topic) === option.label)).toBe(true)
    expect(observed.outerReads).toHaveLength(options.length * 2)
    expect(observed.outerReads.slice(options.length)).toEqual(observed.outerReads.slice(0, options.length))
    expect(await f.storedReviews()).toEqual([])
  } finally { await f.dispose() }
})

test("invalid or ambiguous Dashboard topic queries are rejected before admission or any producer read", async () => {
  const f = await createFirstAgendaFixture()
  try {
    let admissions = 0, discoveries = 0
    const admit = f.authority.ui.admit, discover = f.discovery.discover
    f.authority.ui.admit = async (...args) => { admissions++; return admit(...args) }
    f.discovery.discover = async (...args) => { discoveries++; return discover(...args) }
    const invalid: { encoded: string; domain?: string; duplicate?: boolean; injected?: boolean }[] = [
      ...["", "[", "null", "true", "1", "{}", '"budget"', "[]", '["budget","budget"]', '["unknown"]',
        '["Budget"]', '["budget "]', '["constructor"]', '["__proto__"]', '["budget",null]', '["budget",1]',
        JSON.stringify(Array(17).fill("budget"))].map((encoded) => ({ encoded, domain: "dashboard" })),
      { encoded: '["budget"]' }, { encoded: '["budget"]', domain: "planner" }, { encoded: '["budget"]', domain: "procurement" },
      { encoded: '["budget"]', domain: "dashboard", duplicate: true },
      { encoded: '["budget"]', domain: "dashboard", injected: true },
    ]
    for (const entry of invalid) {
      const query = new URLSearchParams({ sf: "review-agenda", start: f.period.start, end: f.period.end, dashboardTopics: entry.encoded })
      if (entry.domain !== undefined) query.set("domain", entry.domain)
      if (entry.duplicate) query.append("dashboardTopics", '["projects"]')
      if (entry.injected) query.set("principalRef", f.person.id)
      const response = await f.handle(new Request("https://example.test/product?" + query))
      expect({ entry, status: response.status }).toEqual({ entry, status: 400 })
      expect(await response.json()).toEqual({ status: "needs-input", reason: "invalid-agenda-query" })
    }
    expect(admissions).toBe(0)
    expect(discoveries).toBe(0)
    expect(await f.storedReviews()).toEqual([])
  } finally { await f.dispose() }
})

test.each(["topic", "period"] as const)("filtered discovery rejects mismatched borrowed section %s after a real producer read", async (field) => {
  const f = await createFirstAgendaFixture()
  try {
    const discover = f.business.dashboardServices.discover
    let changed = false
    f.business.dashboardServices.discover = async (...args) => {
      const result = await discover(...args)
      if (result.status !== "ok" || !result.value.agenda) return result
      changed = true
      const section = { ...result.value.agenda.section, ...(field === "topic"
        ? { topic: "projects" as const } : { period: { start: "2026-02-01", end: "2026-02-28" } }) }
      return { ...result, value: { ...result.value, agenda: { ...result.value.agenda, section } } }
    }
    const response = await f.request("review-agenda", undefined, filteredQuery(f))
    expect(changed).toBe(true)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ status: "unavailable", reason: "agenda-topic-or-period-mismatch" })
  } finally { await f.dispose() }
})

test.each(["page", "period"] as const)("filtered discovery rejects mismatched source %s after a real canonical resolve", async (field) => {
  const f = await createFirstAgendaFixture()
  try {
    const observed = observeDashboard(f), resolve = f.business.dashboardSources.resolveDashboardSource
    let changed = false
    f.business.dashboardSources.resolveDashboardSource = async (...args) => {
      const outer = !observed.insideDiscovery(), result = await resolve(...args)
      if (!outer || result.status !== "ok") return result
      changed = true
      return { ...result, value: { ...result.value, ...(field === "page" ? { page: "Portfolio Dashboard" }
        : { evidence: { ...result.value.evidence, target: { ...result.value.evidence.target, period: { start: "2026-02-01", end: "2026-02-28" } } } }) } }
    }
    const response = await f.request("review-agenda", undefined, filteredQuery(f))
    expect(changed).toBe(true)
    expect(observed.outerReads).toHaveLength(1)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ status: "unavailable", reason: "agenda-source-scope-mismatch" })
  } finally { await f.dispose() }
})

test("filtered discovery repeats its page check on the final canonical response even when the evidence digest is unchanged", async () => {
  const f = await createFirstAgendaFixture()
  try {
    const observed = observeDashboard(f), resolve = f.business.dashboardSources.resolveDashboardSource
    let outerReads = 0
    f.business.dashboardSources.resolveDashboardSource = async (...args) => {
      const outer = !observed.insideDiscovery(), result = await resolve(...args)
      if (!outer || result.status !== "ok" || ++outerReads !== 2) return result
      return { ...result, value: { ...result.value, page: "Portfolio Dashboard" } }
    }
    const response = await f.request("review-agenda", undefined, filteredQuery(f))
    expect(observed.outerReads).toHaveLength(2)
    expect(outerReads).toBe(2)
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ status: "stale", reason: "agenda-source-or-access-changed" })
  } finally { await f.dispose() }
})

test.each(["source", "access"] as const)("filtered discovery denies a real %s change before the final source read", async (change) => {
  const f = await createFirstAgendaFixture()
  try {
    const observed = observeDashboard(f), resolve = f.business.dashboardSources.resolveDashboardSource
    let outerReads = 0, changed = false
    f.business.dashboardSources.resolveDashboardSource = async (...args) => {
      if (!observed.insideDiscovery() && ++outerReads === 2) {
        if (change === "access") f.gate.active = false
        else await f.persistence.transaction("dashboard", async (snapshot) => {
          const entry = rows(snapshot.data.opexEntries).find((row) => row.id === "opex-january")
          if (!entry) throw new Error("Real budget entry missing")
          entry.forecast = 190
          return { commit: true, value: undefined }
        })
        changed = true
      }
      return resolve(...args)
    }
    const response = await f.request("review-agenda", undefined, filteredQuery(f))
    const result = await response.json() as PortResult<ReviewAgendaCatalog>
    expect(changed).toBe(true)
    expect(outerReads).toBe(2)
    expect(observed.outerReads).toHaveLength(2)
    if (change === "access") {
      expect(response.status).toBe(403)
      expect(result.status).toBe("denied")
    } else {
      expect(response.status).toBe(409)
      expect(result).toEqual({ status: "stale", reason: "agenda-source-or-access-changed" })
    }
    expect(result).not.toHaveProperty("value")
    expect(await f.storedReviews()).toEqual([])
  } finally { await f.dispose() }
})

test("the service captures the selected topic restriction before its first asynchronous authority callback", async () => {
  const f = await createFirstAgendaFixture()
  try {
    const observed = observeDashboard(f), revalidate = f.authority.host.revalidate
    const query: ReviewAgendaDiscoveryQuery = { period: { ...f.period }, domain: "dashboard", dashboardTopics: ["budget"] }
    let changed = false
    const result = await f.readCall(async (call) => {
      f.authority.host.revalidate = async (context) => {
        const allowed = await revalidate(context)
        if (!changed) { changed = true; query.dashboardTopics = ["projects"] }
        return allowed
      }
      return f.discovery.discover(query, call)
    })
    expect(changed).toBe(true)
    expect(query.dashboardTopics).toEqual(["projects"])
    expect(observed.discovered).toEqual(["Budget Overview"])
    expect(available(result).options.map((option) => option.label)).toEqual(["Budget Overview"])
  } finally { await f.dispose() }
})

test.each(["producer", "final-authorization"] as const)("HTTP refuses a changed admitted topic query at the %s boundary", async (boundary) => {
  const f = await createFirstAgendaFixture()
  try {
    const discover = f.discovery.discover, revalidate = f.authority.ui.revalidate
    let borrowed: ReviewAgendaDiscoveryQuery | undefined, finished = false, changed = false
    f.discovery.discover = async (query, call) => {
      borrowed = query
      const result = await discover(query, call)
      if (result.status !== "ok") throw new Error("Real filtered catalog did not complete")
      finished = true
      if (boundary === "producer") { query.dashboardTopics = ["budget", "projects"]; changed = true }
      return result
    }
    f.authority.ui.revalidate = async (context) => {
      const allowed = await revalidate(context)
      if (boundary === "final-authorization" && finished && borrowed) { borrowed.dashboardTopics = ["budget", "projects"]; changed = true }
      return allowed
    }
    const response = await f.request("review-agenda", undefined, filteredQuery(f))
    expect(finished).toBe(true)
    expect(changed).toBe(true)
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ status: "denied", reason: "agenda-authority-unavailable" })
    expect(await f.storedReviews()).toEqual([])
  } finally { await f.dispose() }
})

test("filtering to a private Dashboard topic does not confer access or reveal a selector", async () => {
  const f = await createFirstAgendaFixture()
  try {
    f.control.memberships = ["viewers"]
    const observed = observeDashboard(f)
    const response = await f.request("review-agenda", undefined, filteredQuery(f, ["talent-review"]))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: "ok", value: { options: [] } })
    expect(observed.discovered).toEqual(["Talent Review"])
    expect(observed.outerReads).toEqual([])
    expect(await f.storedReviews()).toEqual([])
  } finally { await f.dispose() }
})
