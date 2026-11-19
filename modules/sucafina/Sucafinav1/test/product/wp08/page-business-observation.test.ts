import { expect, test } from "bun:test"
import { object, rows } from "../../../runtime/contract.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import { createDashboardPort, dashboardPageObservationReader } from "../../../product/dashboard/port.ts"
import { createDashboardSourceHost, dashboardPageSourceObservationReader } from "../../../product/dashboard/sources.ts"
import { createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createSfDashboardSourceAccess } from "../../../product/decision-memory/source-access.ts"
import { available, createRelationsFixture } from "./relations-fixture.ts"

async function pageFixture() {
  const f = await createRelationsFixture()
  const issuerOwners = { host: f.host, scopedSources: f.persistence }
  const issue = createDashboardSourceIssuer(issuerOwners)
  const sourceOwners = { host: f.host, scopedSources: f.persistence }
  const sources = createDashboardSourceHost(sourceOwners)
  const portOwners = { host: f.host, sources }
  const dashboard = createDashboardPort(portOwners)
  const selection = { page: "Portfolio Dashboard", fields: ["projects"], period: f.period }
  const issued = available(await issue(selection, f.read))
  const input = { host: f.host, issue, dashboard }
  const access = createSfDashboardSourceAccess(input)
  const readScopedSource = f.persistence.readScopedSource, resolve = f.persistence.resolveScopedSource
  const transaction = f.persistence.transaction
  const bodies: NonNullable<Awaited<ReturnType<typeof resolve>>>[] = []
  const projections: { projection: unknown; scoped: unknown }[] = []
  const counts = { reads: 0 }
  f.persistence.readScopedSource = async (...args) => { counts.reads++; return readScopedSource(...args) }
  f.persistence.resolveScopedSource = async (...args) => {
    const value = await resolve(...args)
    if (value) bodies.push(value)
    return value
  }
  f.persistence.transaction = async (...args) => {
    const value = await transaction(...args)
    if (value && typeof value === "object" && "projection" in value && "scoped" in value)
      projections.push(value as { projection: unknown; scoped: unknown })
    return value
  }
  return { ...f, issuerOwners, sourceOwners, portOwners, sources, dashboard, issue, input, access, selection,
    ref: issued.evidence, bodies, projections, counts,
    reset: () => { counts.reads = 0; bodies.length = 0; projections.length = 0 } }
}

function mutablePageCall(f: Awaited<ReturnType<typeof pageFixture>>) {
  // Keep the real admission/request. The shallow caller object is mutable so
  // these faults exercise the observation's own binding/lease identity fences.
  const call = { ...f.read }
  const requestFor = f.host.requestFor, revalidate = f.host.revalidate
  f.host.requestFor = (candidate) => requestFor(candidate === call ? f.read : candidate)
  f.host.revalidate = (candidate) => revalidate(candidate === call ? f.read : candidate)
  return call
}

test("Page BCS keeps the full four-observation port and seven-observation fallback", async () => {
  const f = await pageFixture()
  try {
    const composed = await f.access(f.ref, f.read)
    expect(composed.state).toBe("fresh")
    expect(composed.ref).toEqual(f.ref)
    expect(composed.currentRef).toEqual(f.ref)
    const projection = composed.authorizedProjection as DomainProjection
    expect(projection.values.some((value) => value.value === "Shared project")).toBe(true)
    expect(projection.context.sourceRefs).toHaveLength(1)
    expect(projection.context.sourceRefs[0]).toMatchObject({ surface: "dashboard", type: "dashboard-page",
      id: "Portfolio Dashboard", incarnation: f.ref.target.incarnation, version: f.ref.target.version,
      fields: ["projects"], period: f.period })
    expect(f.counts.reads).toBe(4)
    expect(f.bodies).toHaveLength(4)
    expect(f.projections).toHaveLength(2)
    const expected = structuredClone(composed)
    expect(Object.isFrozen(projection)).toBe(false)
    expect(Reflect.set(projection.values[0]!, "value", "Caller edit")).toBe(true)
    expect(Reflect.set(object(object(composed.currentRef).target), "recordId", "caller-record")).toBe(true)
    expect(f.ref.target.recordId).toBe("Portfolio Dashboard")
    f.reset()
    expect(await f.access(f.ref, f.read)).toEqual(expected)
    expect(f.counts.reads).toBe(4)

    const original = f.dashboard.read
    f.dashboard.read = (...args) => original(...args)
    expect(dashboardPageObservationReader(f.dashboard, f.host, f.issue)).toBeUndefined()
    f.reset()
    expect(await f.access(f.ref, f.read)).toEqual(expected)
    expect(f.counts.reads).toBe(7)
    expect(f.projections).toHaveLength(2)
  } finally { await f.dispose() }
})

for (const wrapper of ["issuer", "port-copy", "port-prototype", "port-getter", "source-copy", "source-getter", "host-getter", "transaction-getter"] as const)
test("Page BCS preserves the complete legacy path for " + wrapper, async () => {
  const f = await pageFixture()
  try {
    const before = await f.access(f.ref, f.read)
    expect(before.state).toBe("fresh")
    const read = f.dashboard.read, resolve = f.sources.resolveDashboardSource
    if (wrapper === "issuer") f.input.issue = (...args) => f.issue(...args)
    if (wrapper === "port-copy") f.input.dashboard = { ...f.dashboard }
    if (wrapper === "port-prototype") f.input.dashboard = Object.create(f.dashboard)
    if (wrapper === "port-getter") Object.defineProperty(f.dashboard, "read", { configurable: true, get: () => read })
    if (wrapper === "source-copy") f.portOwners.sources = { ...f.sources }
    if (wrapper === "source-getter") Object.defineProperty(f.sources, "resolveDashboardSource", { configurable: true, get: () => resolve })
    if (wrapper === "host-getter") {
      const revalidate = f.host.revalidate
      Object.defineProperty(f.host, "revalidate", { configurable: true, get: () => revalidate })
    }
    if (wrapper === "transaction-getter") {
      const transaction = f.persistence.transaction
      Object.defineProperty(f.persistence, "transaction", { configurable: true, get: () => transaction })
    }
    f.reset()
    const result = await f.access(f.ref, f.read)
    expect(result).toEqual(before)
    expect(f.counts.reads).toBe(7)
  } finally { await f.dispose() }
})

for (const wrapper of ["issuer", "port"] as const)
test("Page BCS retains a replaced " + wrapper + " negative result", async () => {
  const f = await pageFixture()
  try {
    let called = 0
    if (wrapper === "issuer") f.input.issue = async (...args) => {
      called++; await f.issue(...args); return { status: "unavailable", reason: "wrapped-page-issuer" }
    }
    else {
      const read = f.dashboard.read
      f.dashboard.read = async (...args) => {
        called++; await read(...args); return { status: "unavailable", reason: "wrapped-page-reader" }
      }
    }
    const result = await f.access(f.ref, f.read)
    expect(called).toBe(1)
    expect(result.state).toBe("unavailable")
    expect(result).not.toHaveProperty("authorizedProjection")
  } finally { await f.dispose() }
})

for (const fault of ["source", "access", "headers", "request", "period", "lease", "binding"] as const)
test("Page BCS refuses " + fault + " drift during real projection work", async () => {
  const f = await pageFixture()
  try {
    const call = fault === "lease" || fault === "binding" ? mutablePageCall(f) : f.read
    const environment = f.host.environment
    let changed = false
    f.host.environment = async (request) => {
      const value = await environment(request)
      if (!changed && f.bodies.length === 2) {
        changed = true
        if (fault === "source") await f.persistence.transaction("dashboard", async (snapshot) => {
          rows(snapshot.data.projects).find((entry) => entry.id === "project")!.name = "Changed during page projection"
          return { commit: true, value: undefined }
        })
        if (fault === "access") f.gate.dashboard = false
        if (fault === "headers") request.headers.set("actor", "another-person")
        if (fault === "request") f.host.requestFor = () => new Request(request.url, { headers: request.headers })
        if (fault === "period") Reflect.set(f.ref.target.period!, "end", "2026-11-30")
        if (fault === "lease") expect(Reflect.set(call, "lease", {})).toBe(true)
        if (fault === "binding") expect(Reflect.set(call, "binding", { ...call.binding })).toBe(true)
      }
      return value
    }
    const result = await f.access(f.ref, call)
    expect(changed).toBe(true)
    expect(result.state).toBe("unavailable")
    expect(result).not.toHaveProperty("currentRef")
    expect(result).not.toHaveProperty("authorizedProjection")
  } finally { await f.dispose() }
})

for (const borrowed of [0, 1, 2, 3] as const)
test("Page BCS refuses borrowed canonical body " + borrowed + " changed at final consumer authorization", async () => {
  const f = await pageFixture()
  try {
    const revalidate = f.host.revalidate
    let last = 0
    f.host.revalidate = async (context) => {
      const allowed = await revalidate(context)
      if (f.bodies.length === 4 && ++last === 5)
        Reflect.set(f.bodies[borrowed]!.projection as object, "late-mutation", true)
      return allowed
    }
    const result = await f.access(f.ref, f.read)
    expect(last).toBe(5)
    expect(f.counts.reads).toBe(4)
    expect(result.state).toBe("unavailable")
    expect(result).not.toHaveProperty("authorizedProjection")
  } finally { await f.dispose() }
})

for (const borrowed of [0, 1] as const)
test("Page BCS refuses borrowed projection " + borrowed + " changed at final consumer authorization", async () => {
  const f = await pageFixture()
  try {
    const revalidate = f.host.revalidate
    let last = 0
    f.host.revalidate = async (context) => {
      const allowed = await revalidate(context)
      if (f.bodies.length === 4 && ++last === 5)
        Reflect.set(f.projections[borrowed]!.projection as object, "late-mutation", true)
      return allowed
    }
    const result = await f.access(f.ref, f.read)
    expect(last).toBe(5)
    expect(f.projections).toHaveLength(2)
    expect(result.state).toBe("unavailable")
    expect(result).not.toHaveProperty("authorizedProjection")
  } finally { await f.dispose() }
})

for (const fault of ["headers", "lease", "binding", "ref", "input-owner", "issuer-owner", "source-owner", "port-owner",
  "read", "resolve", "scoped-read", "scoped-resolve", "transaction", "revalidate", "authenticate", "environment", "requestFor"] as const)
test("Page BCS refuses " + fault + " replacement after its final await", async () => {
  const f = await pageFixture()
  try {
    const call = fault === "lease" || fault === "binding" ? mutablePageCall(f) : f.read
    const revalidate = f.host.revalidate
    let last = 0
    f.host.revalidate = async (context) => {
      const allowed = await revalidate(context)
      if (f.bodies.length === 4 && ++last === 5) {
        if (fault === "headers") f.host.requestFor(context)!.headers.set("late", "changed")
        if (fault === "lease") expect(Reflect.set(context, "lease", {})).toBe(true)
        if (fault === "binding") expect(Reflect.set(context, "binding", { ...context.binding })).toBe(true)
        if (fault === "ref") Reflect.set(f.ref.target, "recordId", "another-page")
        if (fault === "input-owner") f.input.host = { ...f.host }
        if (fault === "issuer-owner") f.issuerOwners.scopedSources = { ...f.persistence }
        if (fault === "source-owner") f.sourceOwners.scopedSources = { ...f.persistence }
        if (fault === "port-owner") f.portOwners.sources = { ...f.sources }
        if (fault === "read") { const read = f.dashboard.read; f.dashboard.read = (...args) => read(...args) }
        if (fault === "resolve") { const resolve = f.sources.resolveDashboardSource; f.sources.resolveDashboardSource = (...args) => resolve(...args) }
        if (fault === "scoped-read") { const read = f.persistence.readScopedSource; f.persistence.readScopedSource = (...args) => read(...args) }
        if (fault === "scoped-resolve") { const resolve = f.persistence.resolveScopedSource; f.persistence.resolveScopedSource = (...args) => resolve(...args) }
        if (fault === "transaction") { const transaction = f.persistence.transaction; f.persistence.transaction = (...args) => transaction(...args) }
        if (fault === "revalidate") f.host.revalidate = (...args) => revalidate(...args)
        if (fault === "authenticate") { const authenticate = f.host.authenticate; f.host.authenticate = (...args) => authenticate(...args) }
        if (fault === "environment") { const environment = f.host.environment; f.host.environment = (...args) => environment(...args) }
        if (fault === "requestFor") { const requestFor = f.host.requestFor; f.host.requestFor = (...args) => requestFor(...args) }
      }
      return allowed
    }
    const result = await f.access(f.ref, call)
    expect(last).toBe(5)
    expect(result.state).toBe("unavailable")
    expect(result).not.toHaveProperty("authorizedProjection")
  } finally { await f.dispose() }
})

test("Page observation callbacks are detached and frozen while every repeat opens fresh sources", async () => {
  const f = await pageFixture()
  try {
    const reader = dashboardPageObservationReader(f.dashboard, f.host, f.issue)
    if (!reader) throw new Error("The real page factories did not qualify")
    let callbacks = 0
    const result = await reader.read({ selectionRef: f.ref.refId, fields: f.selection.fields, period: f.period }, f.read, {
      current: () => true,
      before: async (evidence) => {
        callbacks++
        expect(Object.isFrozen(evidence.target)).toBe(true)
        expect(Reflect.set(evidence.target, "recordId", "forged")).toBe(false)
        return true
      },
      project: ({ evidence, projection }) => {
        callbacks++
        expect(Object.isFrozen(projection.values)).toBe(true)
        expect(Reflect.set(projection.values[0]!, "value", "forged")).toBe(false)
        return { status: "ok", value: { evidence, projection } }
      },
      after: async () => { callbacks++; return true },
    })
    expect(result.status).toBe("ok")
    expect(callbacks).toBe(3)
    expect(f.counts.reads).toBe(4)
    f.reset()
    expect((await f.access(f.ref, f.read)).state).toBe("fresh")
    expect(f.counts.reads).toBe(4)
  } finally { await f.dispose() }
})

for (const callback of ["before", "after"] as const)
test("Page observation destroys the completion when " + callback + " throws", async () => {
  const f = await pageFixture()
  try {
    const reader = dashboardPageObservationReader(f.dashboard, f.host, f.issue)
    if (!reader) throw new Error("The real page factories did not qualify")
    let threw = false
    try {
      await reader.read({ selectionRef: f.ref.refId, fields: f.selection.fields, period: f.period }, f.read, {
        current: () => true,
        before: async () => { if (callback === "before") throw new Error("before interrupted"); return true },
        project: ({ projection }) => ({ status: "ok", value: projection }),
        after: async () => { if (callback === "after") throw new Error("after interrupted"); return true },
      })
    } catch { threw = true }
    expect(threw).toBe(true)
    f.reset()
    expect((await f.access(f.ref, f.read)).state).toBe("fresh")
    expect(f.counts.reads).toBe(4)
  } finally { await f.dispose() }
})

test("Page source completion cannot reopen a retained resolver outside its lexical work", async () => {
  const f = await pageFixture()
  try {
    const reader = dashboardPageSourceObservationReader(f.sources, f.host)
    if (!reader) throw new Error("The real page source did not qualify")
    let retained: typeof f.sources.resolveDashboardSource | undefined
    const result = await reader.run(async (resolve) => {
      retained = resolve
      const selection = { fields: f.selection.fields, period: f.period }
      const first = await resolve(f.ref.refId, f.read, selection)
      const second = await resolve(f.ref.refId, f.read, selection)
      expect(first.status).toBe("ok"); expect(second).toEqual(first)
      return { status: "ok", value: true }
    }, () => true)
    expect(result).toEqual({ status: "ok", value: true })
    expect(f.counts.reads).toBe(4)
    f.reset()
    if (!retained) throw new Error("Resolver was not retained")
    expect(await retained(f.ref.refId, f.read, { fields: f.selection.fields, period: f.period }))
      .toEqual({ status: "stale", reason: "source-observation-expired" })
    expect(f.counts.reads).toBe(0)
  } finally { await f.dispose() }
})

test("Page signals keep their original record callbacks and never enter the completion reader", async () => {
  const f = await pageFixture()
  try {
    await f.persistence.transaction("dashboard", async (snapshot) => {
      const topic = rows(snapshot.data.hotTopics).find((entry) => entry.id === "topic")
      if (!topic) throw new Error("Real signal source missing")
      topic.due = "2026-11-01"
      return { commit: true, value: undefined }
    })
    let issues = 0, resolves = 0
    const issueRecord = f.records.issue, resolveRecord = f.records.resolve
    f.records.issue = async (...args) => { issues++; return issueRecord(...args) }
    f.records.resolve = async (...args) => { resolves++; return resolveRecord(...args) }
    const dashboard = createDashboardPort({ host: f.host, sources: f.sources, recordEvidence: f.records })
    const selection = { page: "Executive Dashboard", fields: ["signals"], period: f.period }
    const ref = available(await f.issue(selection, f.read)).evidence
    const reader = dashboardPageObservationReader(dashboard, f.host, f.issue)
    if (!reader) throw new Error("The original page port was not recognized")
    let callbacks = 0
    f.reset()
    const refused = await reader.read({ selectionRef: ref.refId, fields: selection.fields, period: f.period }, f.read, {
      current: () => true,
      before: async () => { callbacks++; return true },
      project: ({ projection }) => { callbacks++; return { status: "ok", value: projection } },
      after: async () => { callbacks++; return true },
    })
    expect(refused).toEqual({ status: "unavailable", reason: "signal-observation-not-composed" })
    expect(callbacks).toBe(0)
    expect(f.counts.reads).toBe(0)
    const access = createSfDashboardSourceAccess({ host: f.host, issue: f.issue, dashboard })
    const result = await access(ref, f.read)
    expect(result.state).toBe("fresh")
    expect(issues).toBeGreaterThan(0)
    expect(resolves).toBe(issues)
    const originalCounts = { reads: f.counts.reads, issues, resolves }
    f.reset(); issues = 0; resolves = 0
    const legacy = createSfDashboardSourceAccess({ host: f.host, issue: f.issue, dashboard: { read: dashboard.read } })
    expect(await legacy(ref, f.read)).toEqual(result)
    expect({ reads: f.counts.reads, issues, resolves }).toEqual(originalCounts)
  } finally { await f.dispose() }
})

test("the ordinary signals path refuses a different Request identity before issuing record evidence", async () => {
  const f = await pageFixture()
  try {
    await f.persistence.transaction("dashboard", async (snapshot) => {
      const topic = rows(snapshot.data.hotTopics).find((entry) => entry.id === "topic")
      if (!topic) throw new Error("Real signal source missing")
      topic.due = "2026-11-01"
      return { commit: true, value: undefined }
    })
    const selection = { page: "Executive Dashboard", fields: ["signals"], period: f.period }
    const ref = available(await f.issue(selection, f.read)).evidence
    const request = f.host.requestFor(f.read)!
    f.host.requestFor = () => new Request(request.url, { method: request.method, headers: request.headers })
    expect(f.host.requestFor(f.read)).not.toBe(f.host.requestFor(f.read))
    expect(await f.records.issue({ page: "Hot Topics & Actions", recordType: "hotTopics",
      recordId: "topic", fields: ["due", "status"], period: { start: f.clock.at.slice(0, 10), end: f.clock.at.slice(0, 10) } }, f.read))
      .toEqual({ status: "denied", reason: "source-unavailable" })
    const dashboard = createDashboardPort({ host: f.host, sources: f.sources, recordEvidence: f.records })
    expect(await dashboard.read({ selectionRef: ref.refId, fields: selection.fields, period: f.period }, f.read))
      .toEqual({ status: "unavailable", reason: "signal-evidence-unavailable" })
  } finally { await f.dispose() }
})
