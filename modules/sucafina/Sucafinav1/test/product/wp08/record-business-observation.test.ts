import { expect, test } from "bun:test"
import { object, rows } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import { createDashboardRecordEvidenceHost, dashboardRecordObservationReader } from "../../../product/dashboard/sources.ts"
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createSfDashboardRecordSourceAccess } from "../../../product/decision-memory/source-access.ts"
import { available, createRelationsFixture } from "./relations-fixture.ts"

async function recordFixture() {
  const fixture = await createRelationsFixture()
  const owners = { host: fixture.host, scopedSources: fixture.persistence,
    issueRecord: createDashboardRecordSourceIssuer({ host: fixture.host, scopedSources: fixture.persistence }) }
  const records = createDashboardRecordEvidenceHost(owners)
  const ref = available(await records.issue({ page: "Portfolio Dashboard", recordType: "projects",
    recordId: "project", fields: ["name", "status"], period: fixture.period }, fixture.read))
  const resolve = fixture.persistence.resolveScopedSource
  const observations: NonNullable<Awaited<ReturnType<typeof resolve>>>[] = []
  const counts = { reads: 0 }
  fixture.persistence.resolveScopedSource = async (...args) => {
    counts.reads++
    const value = await resolve(...args)
    if (value) observations.push(value)
    return value
  }
  const input = { host: fixture.host, records }
  const access = createSfDashboardRecordSourceAccess(input)
  return { ...fixture, records, owners, ref, input, access, observations, counts,
    reset: () => { observations.length = 0; counts.reads = 0 } }
}

function projectName(value: unknown) {
  const projection = value as DomainProjection
  return projection.values.find((entry) => entry.id === "projects:project:name")?.value
}

test("record BCS composes two real observations and keeps the complete legacy path for wrappers", async () => {
  const f = await recordFixture()
  try {
    const composed = await f.access(f.ref, f.read)
    expect(composed.state).toBe("fresh")
    expect(composed.ref).toEqual(f.ref)
    expect(composed.currentRef).toEqual(f.ref)
    expect(projectName(composed.authorizedProjection)).toBe("Shared project")
    expect(f.counts.reads).toBe(2)
    const expected = structuredClone(composed)
    expect(Object.isFrozen(composed.authorizedProjection)).toBe(false)
    expect(Reflect.set((composed.authorizedProjection as DomainProjection).values[0]!, "value", "Caller edit")).toBe(true)
    expect(Reflect.set(object(object(composed.currentRef).target), "recordId", "caller-record")).toBe(true)
    expect(f.ref.target.recordId).toBe("project")
    expect(dashboardRecordObservationReader({ ...f.records }, f.host)).toBeUndefined()
    expect(dashboardRecordObservationReader(f.records, { ...f.host })).toBeUndefined()

    // A repeat in the same call still reopens both source observations.
    f.reset()
    expect(await f.access(f.ref, f.read)).toEqual(expected)
    expect(f.counts.reads).toBe(2)

    const resolve = f.records.resolve, read = f.records.read
    const wrappers = [
      { ...f.records },
      { ...f.records, resolve: (...args: Parameters<typeof resolve>) => resolve(...args),
        read: (...args: Parameters<typeof read>) => read(...args) },
    ]
    for (const records of wrappers) {
      f.reset()
      f.input.records = records
      expect(await f.access(f.ref, f.read)).toEqual(expected)
      expect(f.counts.reads).toBe(6)
    }

    f.input.records = f.records
    Object.defineProperty(f.records, "read", { configurable: true, enumerable: true, get: () => read })
    f.reset()
    expect(await f.access(f.ref, f.read)).toEqual(expected)
    expect(f.counts.reads).toBe(6)
  } finally { await f.dispose() }
})

for (const method of ["resolve", "read"] as const)
test("record BCS retains a replaced " + method + " method's negative result", async () => {
  const f = await recordFixture()
  try {
    let invoked = 0
    if (method === "resolve") {
      const resolve = f.records.resolve
      f.records.resolve = async (...args) => {
        invoked++
        await resolve(...args)
        return { status: "unavailable", reason: "wrapped-record-unavailable" }
      }
    } else {
      const read = f.records.read
      f.records.read = async (...args) => {
        invoked++
        await read(...args)
        return { status: "unavailable", reason: "wrapped-record-unavailable" }
      }
    }
    expect(dashboardRecordObservationReader(f.records, f.host)).toBeUndefined()
    const result = await f.access(f.ref, f.read)
    expect(invoked).toBe(1)
    expect(result.state).toBe("unavailable")
    expect(result).not.toHaveProperty("authorizedProjection")
  } finally { await f.dispose() }
})

for (const fault of ["source", "access", "request", "headers", "period"] as const)
test("record BCS refuses " + fault + " drift between independent source observations", async () => {
  const f = await recordFixture()
  try {
    const environment = f.host.environment
    let changed = false
    f.host.environment = async (request) => {
      const value = await environment(request)
      if (!changed && f.observations.length === 1) {
        changed = true
        if (fault === "source") await f.persistence.transaction("dashboard", async (snapshot) => {
          rows(snapshot.data.projects).find((entry) => entry.id === "project")!.name = "Changed during BCS projection"
          return { commit: true, value: undefined }
        })
        if (fault === "access") f.gate.dashboard = false
        if (fault === "request") {
          const replacement = new Request(request.url, { method: request.method, headers: request.headers })
          f.host.requestFor = () => replacement
        }
        if (fault === "headers") request.headers.set("actor", "another-person")
        if (fault === "period") Reflect.set(f.ref.target.period!, "end", "2026-11-30")
      }
      return value
    }
    const result = await f.access(f.ref, f.read)
    expect(changed).toBe(true)
    expect(result.state).toBe("unavailable")
    expect(result).not.toHaveProperty("authorizedProjection")
    if (fault === "source") {
      expect(f.counts.reads).toBe(2)
      expect(f.observations[1]!.version).toBeGreaterThan(f.observations[0]!.version)
    }
  } finally { await f.dispose() }
})

for (const borrowed of [0, 1] as const)
test("record BCS refuses borrowed source " + borrowed + " changed by its independent final authorization", async () => {
  const f = await recordFixture()
  try {
    const revalidate = f.host.revalidate
    let finalChecks = 0
    f.host.revalidate = async (context) => {
      const allowed = await revalidate(context)
      if (f.observations.length === 2 && ++finalChecks === 2)
        Reflect.set(f.observations[borrowed]!.projection as object, "name", "Mutated at BCS publication")
      return allowed
    }
    const result = await f.access(f.ref, f.read)
    expect(f.counts.reads).toBe(2)
    expect(finalChecks).toBe(2)
    expect(result.state).toBe("unavailable")
    expect(result).not.toHaveProperty("authorizedProjection")
  } finally { await f.dispose() }
})

for (const fault of ["headers", "lease", "binding", "ref", "method"] as const)
test("record BCS refuses " + fault + " drift in its final authorization", async () => {
  const f = await recordFixture()
  try {
    const context = { ...f.read }
    const requestFor = f.host.requestFor, revalidate = f.host.revalidate
    f.host.requestFor = (candidate) => requestFor(candidate === context ? f.read : candidate)
    let finalChecks = 0
    f.host.revalidate = async (candidate) => {
      const allowed = await revalidate(candidate === context ? f.read : candidate)
      if (f.observations.length === 2 && ++finalChecks === 2) {
        if (fault === "headers") requestFor(f.read)!.headers.set("actor", "another-person")
        if (fault === "lease") Reflect.set(context, "lease", {})
        if (fault === "binding") Reflect.set(context, "binding", { ...context.binding, policyVersion: "replaced-policy" })
        if (fault === "ref") Reflect.set(f.ref.target, "recordId", "another-project")
        if (fault === "method") {
          const resolve = f.records.resolve
          f.records.resolve = (...args) => resolve(...args)
        }
      }
      return allowed
    }
    const result = await f.access(f.ref, context)
    expect(f.counts.reads).toBe(2)
    expect(finalChecks).toBe(2)
    expect(result.state).toBe("unavailable")
    expect(result).not.toHaveProperty("authorizedProjection")
  } finally { await f.dispose() }
})

for (const fault of ["version", "owner", "projection"] as const)
test("record BCS refuses canonical " + fault + " disagreement at the second source read", async () => {
  const f = await recordFixture()
  try {
    const resolve = f.persistence.resolveScopedSource
    f.persistence.resolveScopedSource = async (...args) => {
      const value = await resolve(...args)
      if (value && f.observations.length === 2) {
        if (fault === "version") value.version++
        if (fault === "owner") Reflect.set(value.scope, "principalRef", "another-person")
        if (fault === "projection") object(value.projection).name = "Forged second projection"
      }
      return value
    }
    const result = await f.access(f.ref, f.read)
    expect(f.counts.reads).toBe(2)
    expect(result.state).toBe("unavailable")
    expect(result).not.toHaveProperty("authorizedProjection")
  } finally { await f.dispose() }
})

for (const phase of ["before", "after"] as const)
test("record observation discards a throwing " + phase + " consumer and opens fresh reads next time", async () => {
  const f = await recordFixture()
  try {
    const reader = dashboardRecordObservationReader(f.records, f.host)
    if (!reader) throw new Error("Factory observation unavailable")
    const observe = reader.read
    const failure = async () => { throw new Error("consumer interrupted") }
    await expect(observe(f.ref.refId, f.read, {
      current: () => true,
      before: phase === "before" ? failure : async () => true,
      project: () => ({ status: "ok", value: true }),
      after: phase === "after" ? failure : async () => true,
    })).rejects.toThrow("consumer interrupted")
    expect(f.counts.reads).toBe(phase === "before" ? 1 : 2)
    f.reset()
    const result = await f.access(f.ref, f.read)
    expect(result.state).toBe("fresh")
    expect(f.counts.reads).toBe(2)
  } finally { await f.dispose() }
})

test("record observation callbacks receive frozen independent values and never the source witnesses", async () => {
  const f = await recordFixture()
  try {
    const reader = dashboardRecordObservationReader(f.records, f.host)
    if (!reader) throw new Error("Factory observation unavailable")
    const observe = reader.read
    let first: unknown, projected: unknown
    const result = await observe(f.ref.refId, f.read, {
      current: () => true,
      before: async (evidence) => {
        first = evidence
        expect(Object.isFrozen(evidence)).toBe(true)
        expect(Object.isFrozen(evidence.target.fields)).toBe(true)
        expect(Reflect.set(evidence.target, "recordId", "forged")).toBe(false)
        return true
      },
      project: (observation) => {
        projected = observation
        expect(observation.evidence).not.toBe(first)
        expect(Object.isFrozen(observation.projection.values)).toBe(true)
        expect(Reflect.set(observation.projection.values[0]!, "value", "forged")).toBe(false)
        return { status: "ok", value: observation.projection }
      },
      after: async () => true,
    })
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error("Real record observation unavailable")
    expect(projectName(result.value)).toBe("Shared project")
    expect(f.counts.reads).toBe(2)
    expect(projected).not.toBe(f.observations[0])
    expect(f.observations.every((entry) => object(entry.projection).name === "Shared project")).toBe(true)
  } finally { await f.dispose() }
})

test("record BCS observes cancellation and does not reuse an observation for another admitted call", async () => {
  const f = await recordFixture()
  try {
    const controller = new AbortController()
    const request = new Request(f.request(), { signal: controller.signal })
    const payload = digestSfValue({ recordRefs: [] })
    const context = available(await f.ui.admit(request, "sf_relation_read", payload))
    expect(await f.ui.validate(context, "sf_relation_read", payload)).toBe(true)
    const environment = f.host.environment
    f.host.environment = async (candidate) => {
      const value = await environment(candidate)
      if (candidate === request && f.observations.length === 1) controller.abort()
      return value
    }
    const cancelled = await f.access(f.ref, context)
    expect(cancelled.state).toBe("unavailable")
    expect(cancelled).not.toHaveProperty("authorizedProjection")
    f.reset()
    expect((await f.access(f.ref, f.read)).state).toBe("fresh")
    expect(f.counts.reads).toBe(2)
  } finally { await f.dispose() }
})

for (const fault of ["revalidate", "environment", "authenticate", "requestFor", "resolveScopedSource",
  "owner-host", "owner-sources", "consumer-host", "consumer-records"] as const)
test("record BCS refuses " + fault + " replacement during final authorization", async () => {
  const f = await recordFixture()
  try {
    const revalidate = f.host.revalidate, environment = f.host.environment
    const authenticate = f.host.authenticate, requestFor = f.host.requestFor
    const resolve = f.persistence.resolveScopedSource
    let finalChecks = 0, substitutedCalls = 0
    f.host.revalidate = async (context) => {
      const allowed = await revalidate(context)
      if (f.observations.length === 2 && ++finalChecks === 2) {
        if (fault === "revalidate") f.host.revalidate = async (...args) => { substitutedCalls++; return revalidate(...args) }
        if (fault === "environment") f.host.environment = async (...args) => { substitutedCalls++; return environment(...args) }
        if (fault === "authenticate") f.host.authenticate = async (...args) => { substitutedCalls++; return authenticate(...args) }
        if (fault === "requestFor") f.host.requestFor = (...args) => { substitutedCalls++; return requestFor(...args) }
        if (fault === "resolveScopedSource") f.persistence.resolveScopedSource = async (...args) => { substitutedCalls++; return resolve(...args) }
        if (fault === "owner-host") f.owners.host = { ...f.host }
        if (fault === "owner-sources") f.owners.scopedSources = { ...f.persistence }
        if (fault === "consumer-host") f.input.host = { ...f.host }
        if (fault === "consumer-records") f.input.records = { ...f.records }
      }
      return allowed
    }
    const result = await f.access(f.ref, f.read)
    expect(f.counts.reads).toBe(2)
    expect(finalChecks).toBe(2)
    expect(substitutedCalls).toBe(0)
    expect(result.state).toBe("unavailable")
    expect(result).not.toHaveProperty("authorizedProjection")
  } finally { await f.dispose() }
})

for (const phase of ["authority", "environment"] as const)
test("record BCS pins its initial " + phase + " await and admits changed hooks only on a later call", async () => {
  const f = await recordFixture()
  try {
    const revalidate = f.host.revalidate, environment = f.host.environment, authenticate = f.host.authenticate
    let changed = false, substitutedCalls = 0
    if (phase === "authority") f.host.revalidate = async (context) => {
      const allowed = await revalidate(context)
      if (!changed) {
        changed = true
        f.host.environment = async (...args) => { substitutedCalls++; return environment(...args) }
      }
      return allowed
    }
    if (phase === "environment") f.host.environment = async (request) => {
      const value = await environment(request)
      if (!changed) {
        changed = true
        f.host.authenticate = async (...args) => { substitutedCalls++; return authenticate(...args) }
      }
      return value
    }
    const result = await f.access(f.ref, f.read)
    expect(changed).toBe(true)
    expect(f.counts.reads).toBe(0)
    expect(substitutedCalls).toBe(0)
    expect(result.state).toBe("unavailable")
    expect(result).not.toHaveProperty("authorizedProjection")

    f.reset()
    expect((await f.access(f.ref, f.read)).state).toBe("fresh")
    expect(f.counts.reads).toBe(2)
    expect(substitutedCalls).toBeGreaterThan(0)
  } finally { await f.dispose() }
})

test("record BCS refuses a new accessor hook at publication without invoking it", async () => {
  const f = await recordFixture()
  try {
    const revalidate = f.host.revalidate, requestFor = f.host.requestFor
    let finalChecks = 0, getterCalls = 0
    f.host.revalidate = async (context) => {
      const allowed = await revalidate(context)
      if (f.observations.length === 2 && ++finalChecks === 2)
        Object.defineProperty(f.host, "requestFor", { configurable: true, enumerable: true,
          get: () => { getterCalls++; return requestFor } })
      return allowed
    }
    const result = await f.access(f.ref, f.read)
    expect(finalChecks).toBe(2)
    expect(getterCalls).toBe(0)
    expect(result.state).toBe("unavailable")
    expect(result).not.toHaveProperty("authorizedProjection")
  } finally { await f.dispose() }
})

for (const placement of ["accessor", "prototype"] as const)
test("record BCS retains the legacy reader when a host hook is an " + placement, async () => {
  const f = await recordFixture()
  try {
    const expected = await f.access(f.ref, f.read)
    expect(expected.state).toBe("fresh")
    const requestFor = f.host.requestFor
    if (placement === "accessor") Object.defineProperty(f.host, "requestFor", {
      configurable: true, enumerable: true, get: () => requestFor })
    else {
      Reflect.deleteProperty(f.host, "requestFor")
      Object.setPrototypeOf(f.host, { requestFor })
    }
    expect(dashboardRecordObservationReader(f.records, f.host)).toBeUndefined()
    f.reset()
    expect(await f.access(f.ref, f.read)).toEqual(expected)
    expect(f.counts.reads).toBe(6)
  } finally { await f.dispose() }
})

for (const owner of ["host", "sources"] as const)
test("record issuance still rejects a replaced " + owner + " factory input during its await", async () => {
  const f = await recordFixture()
  try {
    const environment = f.host.environment
    let changed = false
    f.host.environment = async (request) => {
      const value = await environment(request)
      if (!changed) {
        changed = true
        if (owner === "host") f.owners.host = { ...f.host }
        else f.owners.scopedSources = { ...f.persistence }
      }
      return value
    }
    const selection = { page: "Portfolio Dashboard", recordType: "projects", recordId: "project",
      fields: ["name", "status"], period: f.period }
    const result = await f.records.issue(selection, f.read)
    expect(changed).toBe(true)
    expect(result.status).not.toBe("ok")
    expect(result).not.toHaveProperty("value")
    f.owners.host = f.host
    f.owners.scopedSources = f.persistence
    expect((await f.records.issue(selection, f.read)).status).toBe("ok")
  } finally { await f.dispose() }
})
