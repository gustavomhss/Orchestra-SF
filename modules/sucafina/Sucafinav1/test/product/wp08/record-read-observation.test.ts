import { expect, test } from "bun:test"
import { rows } from "../../../runtime/contract.ts"
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
