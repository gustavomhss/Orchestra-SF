import { expect, test } from "bun:test"
import { rows } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardRecordEvidenceHost } from "../../../product/dashboard/sources.ts"
import { available, createRelationsFixture } from "./relations-fixture.ts"

test("record projection stays inside two independent canonical source observations", async () => {
  const fixture = await createRelationsFixture()
  try {
    const source = available(await fixture.records.issue({ page: "Portfolio Dashboard", recordType: "projects",
      recordId: "project", fields: ["name", "status"], period: fixture.period }, fixture.read))
    const resolve = fixture.persistence.resolveScopedSource
    let observations = 0
    fixture.persistence.resolveScopedSource = async (...args) => {
      observations++
      return resolve(...args)
    }
    const projection = available(await fixture.records.read(source.refId, fixture.read))
    expect(observations).toBe(2)
    expect(projection.values.map((value) => ({ id: value.id, value: value.value }))).toEqual([
      { id: "projects:project:name", value: "Shared project" },
      { id: "projects:project:status", value: "In Progress" },
    ])
    expect(projection.values.every((value) => value.sourceRefs[0]?.refDigest === source.refDigest)).toBe(true)
    expect(projection.context.sourceRefs[0]).toMatchObject({
      surface: "dashboard", type: "projects", id: "project", incarnation: source.target.incarnation,
      version: source.target.version, fields: ["name", "status"], period: fixture.period,
    })
  } finally { await fixture.dispose() }
})

for (const fault of ["source", "access", "request", "headers"] as const)
test("record projection refuses " + fault + " drift during projection work", async () => {
  const fixture = await createRelationsFixture()
  try {
    const source = available(await fixture.records.issue({ page: "Portfolio Dashboard", recordType: "projects",
      recordId: "project", fields: ["name"], period: fixture.period }, fixture.read))
    const environment = fixture.host.environment
    let changed = false
    fixture.host.environment = async (request) => {
      const value = await environment(request)
      if (!changed) {
        changed = true
        if (fault === "source") await fixture.persistence.transaction("dashboard", async (snapshot) => {
          rows(snapshot.data.projects).find((row) => row.id === "project")!.name = "Changed during projection"
          return { commit: true, value: undefined }
        })
        if (fault === "access") fixture.gate.dashboard = false
        if (fault === "request") {
          const replacement = new Request(request.url, { method: request.method, headers: request.headers })
          fixture.host.requestFor = () => replacement
        }
        if (fault === "headers") request.headers.set("actor", "another-person")
      }
      return value
    }
    const result = await fixture.records.read(source.refId, fixture.read)
    expect(changed).toBe(true)
    expect(result.status).not.toBe("ok")
    expect(result).not.toHaveProperty("value")
  } finally { await fixture.dispose() }
})

test("record projection refuses a borrowed final source mutated by final revalidation", async () => {
  const fixture = await createRelationsFixture()
  try {
    const source = available(await fixture.records.issue({ page: "Portfolio Dashboard", recordType: "projects",
      recordId: "project", fields: ["name"], period: fixture.period }, fixture.read))
    const resolve = fixture.persistence.resolveScopedSource
    const observed: NonNullable<Awaited<ReturnType<typeof resolve>>>[] = []
    fixture.persistence.resolveScopedSource = async (...args) => {
      const value = await resolve(...args)
      if (value) observed.push(value)
      return value
    }
    const revalidate = fixture.host.revalidate
    fixture.host.revalidate = async (context) => {
      const allowed = await revalidate(context)
      if (observed.length === 2) Reflect.set(observed[1]!.projection as object, "name", "Mutated borrowed projection")
      return allowed
    }
    const result = await fixture.records.read(source.refId, fixture.read)
    expect(observed).toHaveLength(2)
    expect(result.status).not.toBe("ok")
    expect(result).not.toHaveProperty("value")
  } finally { await fixture.dispose() }
})


test("record issuance keeps two source reads with canonical metadata verification and wrapper equivalence", async () => {
  const fixture = await createRelationsFixture()
  try {
    const selection = { page: "Portfolio Dashboard", recordType: "projects", recordId: "project",
      fields: ["status", "name"], period: fixture.period }
    const read = fixture.persistence.readScopedSource, resolve = fixture.persistence.resolveScopedSource
    const counts = { read: 0, resolve: 0 }
    fixture.persistence.readScopedSource = async (...args) => { counts.read++; return read(...args) }
    fixture.persistence.resolveScopedSource = async (...args) => { counts.resolve++; return resolve(...args) }
    const direct = available(await fixture.records.issue(selection, fixture.read))
    expect(counts).toEqual({ read: 2, resolve: 0 })
    const issuer = createDashboardRecordSourceIssuer({ host: fixture.host, scopedSources: fixture.persistence })
    const wrapped = createDashboardRecordEvidenceHost({ host: fixture.host, scopedSources: fixture.persistence,
      issueRecord: (...args) => issuer(...args) })
    counts.read = 0; counts.resolve = 0
    expect(available(await wrapped.issue(selection, fixture.read))).toEqual(direct)
    expect(counts).toEqual({ read: 4, resolve: 2 })
    const otherHost = createDashboardRecordEvidenceHost({ host: { ...fixture.host }, scopedSources: fixture.persistence, issueRecord: issuer })
    counts.read = 0; counts.resolve = 0
    expect(available(await otherHost.issue(selection, fixture.read))).toEqual(direct)
    expect(counts).toEqual({ read: 4, resolve: 2 })
  } finally { await fixture.dispose() }
})

for (const fault of ["source", "access", "request", "headers", "lease", "selection", "clock"] as const)
test("record issuance refuses " + fault + " drift between its independent observations", async () => {
  const fixture = await createRelationsFixture()
  try {
    const selection = { page: "Portfolio Dashboard", recordType: "projects", recordId: "project",
      fields: ["name"], period: fixture.period }
    // A host-owned mutable alias lets the test isolate the producer's lease pin;
    // the normal UI admission itself already freezes its context.
    const context = fault === "lease" ? { ...fixture.read } : fixture.read
    if (fault === "lease") {
      const requestFor = fixture.host.requestFor, revalidate = fixture.host.revalidate
      fixture.host.requestFor = (candidate) => requestFor(candidate === context ? fixture.read : candidate)
      fixture.host.revalidate = (candidate) => revalidate(candidate === context ? fixture.read : candidate)
    }
    const environment = fixture.host.environment
    let changed = false
    fixture.host.environment = async (request) => {
      const value = await environment(request)
      if (!changed) {
        changed = true
        if (fault === "source") await fixture.persistence.transaction("dashboard", async (snapshot) => {
          rows(snapshot.data.projects).find((row) => row.id === "project")!.name = "Changed during issuance"
          return { commit: true, value: undefined }
        })
        if (fault === "access") fixture.gate.dashboard = false
        if (fault === "request") fixture.host.requestFor = () => new Request(request.url, { method: request.method, headers: request.headers })
        if (fault === "headers") request.headers.set("actor", "another-person")
        if (fault === "lease") Reflect.set(context, "lease", {})
        if (fault === "selection") selection.fields.push("status")
        if (fault === "clock") fixture.clock.at = "2027-01-01T00:00:00Z"
      }
      return value
    }
    const result = await fixture.records.issue(selection, context)
    expect(changed).toBe(true)
    expect(result.status).not.toBe("ok")
    expect(result).not.toHaveProperty("value")
  } finally { await fixture.dispose() }
})

for (const borrowed of [0, 1] as const)
test("record issuance rejects borrowed observation " + borrowed + " mutated by the consumer's final authority check", async () => {
  const fixture = await createRelationsFixture()
  try {
    const read = fixture.persistence.readScopedSource
    const observed: NonNullable<Awaited<ReturnType<typeof read>>>[] = []
    fixture.persistence.readScopedSource = async (...args) => {
      const value = await read(...args)
      if (value) observed.push(value)
      return value
    }
    const revalidate = fixture.host.revalidate
    let finalChecks = 0
    fixture.host.revalidate = async (context) => {
      const allowed = await revalidate(context)
      if (observed.length === 2 && ++finalChecks === 2)
        Reflect.set(observed[borrowed]!.projection as object, "name", "Changed after the consumer reauthenticated")
      return allowed
    }
    const result = await fixture.records.issue({ page: "Portfolio Dashboard", recordType: "projects",
      recordId: "project", fields: ["name"], period: fixture.period }, fixture.read)
    expect(observed).toHaveLength(2)
    expect(finalChecks).toBe(2)
    expect(result.status).not.toBe("ok")
    expect(result).not.toHaveProperty("value")
  } finally { await fixture.dispose() }
})

test("record issuance does not publish a factory observation after issuer substitution", async () => {
  const fixture = await createRelationsFixture()
  try {
    const issueRecord = createDashboardRecordSourceIssuer({ host: fixture.host, scopedSources: fixture.persistence })
    const input = { host: fixture.host, scopedSources: fixture.persistence, issueRecord }
    const records = createDashboardRecordEvidenceHost(input)
    const environment = fixture.host.environment
    let changed = false
    fixture.host.environment = async (request) => {
      const value = await environment(request)
      changed = true
      input.issueRecord = (...args) => issueRecord(...args)
      return value
    }
    const result = await records.issue({ page: "Portfolio Dashboard", recordType: "projects",
      recordId: "project", fields: ["name"], period: fixture.period }, fixture.read)
    expect(changed).toBe(true)
    expect(result.status).not.toBe("ok")
    expect(result).not.toHaveProperty("value")
  } finally { await fixture.dispose() }
})


for (const changed of ["incarnation", "version"] as const)
test("record issuance rejects matching forged " + changed + " in both source returns", async () => {
  const fixture = await createRelationsFixture()
  try {
    const read = fixture.persistence.readScopedSource
    let observations = 0
    fixture.persistence.readScopedSource = async (...args) => {
      const value = await read(...args)
      if (!value) return value
      observations++
      return { ...value, [changed]: changed === "incarnation" ? "fabricated-incarnation" : value.version + 10 }
    }
    const result = await fixture.records.issue({ page: "Portfolio Dashboard", recordType: "projects",
      recordId: "project", fields: ["name"], period: fixture.period }, fixture.read)
    expect(observations).toBe(2)
    expect(result.status).not.toBe("ok")
    expect(result).not.toHaveProperty("value")
  } finally { await fixture.dispose() }
})

test("a substituted checker cannot attest fabricated source metadata", async () => {
  const fixture = await createRelationsFixture()
  try {
    const read = fixture.persistence.readScopedSource, resolve = fixture.persistence.resolveScopedSource
    let observations = 0, resolutions = 0, fakeChecks = 0
    fixture.persistence.readScopedSource = async (...args) => {
      const value = await read(...args)
      if (!value) return value
      observations++
      return { ...value, incarnation: "fabricated-incarnation", version: value.version + 10 }
    }
    fixture.persistence.checkScopedSource = async () => { fakeChecks++; return true }
    fixture.persistence.resolveScopedSource = async (...args) => { resolutions++; return resolve(...args) }
    const result = await fixture.records.issue({ page: "Portfolio Dashboard", recordType: "projects",
      recordId: "project", fields: ["name"], period: fixture.period }, fixture.read)
    expect(observations).toBe(2)
    expect(resolutions).toBe(1)
    expect(fakeChecks).toBe(0)
    expect(result.status).not.toBe("ok")
    expect(result).not.toHaveProperty("value")
  } finally { await fixture.dispose() }
})

test("record issuance refuses checker replacement during an in-flight observation", async () => {
  const fixture = await createRelationsFixture()
  try {
    const environment = fixture.host.environment
    let changed = false, fakeChecks = 0
    fixture.host.environment = async (request) => {
      const value = await environment(request)
      changed = true
      fixture.persistence.checkScopedSource = async () => { fakeChecks++; return true }
      return value
    }
    const result = await fixture.records.issue({ page: "Portfolio Dashboard", recordType: "projects",
      recordId: "project", fields: ["name"], period: fixture.period }, fixture.read)
    expect(changed).toBe(true)
    expect(fakeChecks).toBe(0)
    expect(result.status).not.toBe("ok")
    expect(result).not.toHaveProperty("value")
  } finally { await fixture.dispose() }
})

for (const fault of ["headers", "lease", "binding", "selection"] as const)
test("record issuance refuses " + fault + " mutation at the last authority callback", async () => {
  const fixture = await createRelationsFixture()
  try {
    const selection = { page: "Portfolio Dashboard", recordType: "projects", recordId: "project",
      fields: ["name"], period: fixture.period }
    const context = { ...fixture.read }
    const requestFor = fixture.host.requestFor, revalidate = fixture.host.revalidate
    fixture.host.requestFor = (candidate) => requestFor(candidate === context ? fixture.read : candidate)
    const read = fixture.persistence.readScopedSource
    let observations = 0, finalChecks = 0
    fixture.persistence.readScopedSource = async (...args) => {
      const value = await read(...args)
      if (value) observations++
      return value
    }
    fixture.host.revalidate = async (candidate) => {
      const allowed = await revalidate(candidate === context ? fixture.read : candidate)
      if (observations === 2 && ++finalChecks === 2) {
        if (fault === "headers") requestFor(fixture.read)!.headers.set("actor", "another-person")
        if (fault === "lease") Reflect.set(context, "lease", {})
        if (fault === "binding") Reflect.set(context, "binding", { ...context.binding, policyVersion: "replaced-policy" })
        if (fault === "selection") selection.fields.push("status")
      }
      return allowed
    }
    const result = await fixture.records.issue(selection, context)
    expect(observations).toBe(2)
    expect(finalChecks).toBe(2)
    expect(result.status).not.toBe("ok")
    expect(result).not.toHaveProperty("value")
  } finally { await fixture.dispose() }
})


test("record issuance checks the registry again after a durable edit following its second read", async () => {
  const fixture = await createRelationsFixture()
  try {
    const read = fixture.persistence.readScopedSource
    let observations = 0, changed = false
    fixture.persistence.readScopedSource = async (...args) => {
      const value = await read(...args)
      if (value) observations++
      return value
    }
    const revalidate = fixture.host.revalidate
    fixture.host.revalidate = async (context) => {
      const allowed = await revalidate(context)
      if (observations === 2 && !changed) {
        changed = true
        await fixture.persistence.transaction("dashboard", async (snapshot) => {
          rows(snapshot.data.projects).find((row) => row.id === "project")!.name = "Changed after the second read"
          return { commit: true, value: undefined }
        })
      }
      return allowed
    }
    const result = await fixture.records.issue({ page: "Portfolio Dashboard", recordType: "projects",
      recordId: "project", fields: ["name"], period: fixture.period }, fixture.read)
    expect(observations).toBe(2)
    expect(changed).toBe(true)
    expect(result.status).not.toBe("ok")
    expect(result).not.toHaveProperty("value")
  } finally { await fixture.dispose() }
})

test("record issuance refuses an abort while acquiring its observation time", async () => {
  const fixture = await createRelationsFixture()
  try {
    const controller = new AbortController()
    const request = new Request(fixture.request(), { signal: controller.signal })
    const payload = digestSfValue({ recordRefs: [] })
    const context = available(await fixture.ui.admit(request, "sf_relation_read", payload))
    expect(await fixture.ui.validate(context, "sf_relation_read", payload)).toBe(true)
    const environment = fixture.host.environment
    fixture.host.environment = async (current) => {
      const value = await environment(current)
      controller.abort()
      return value
    }
    const result = await fixture.records.issue({ page: "Portfolio Dashboard", recordType: "projects",
      recordId: "project", fields: ["name"], period: fixture.period }, context)
    expect(controller.signal.aborted).toBe(true)
    expect(result.status).not.toBe("ok")
    expect(result).not.toHaveProperty("value")
  } finally { await fixture.dispose() }
})
