import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { group, oid } from "../microsoft-login/oidc-fixture.ts"
import { publicOrigin } from "../microsoft-login/private-fixture.ts"
import { openInstalledTeamFixture } from "./installed-team-fixture.ts"

test("installed Microsoft Team creates a decision and reopens it through the native projection", async () => {
  await using fixture = await openInstalledTeamFixture({
    groups: { dashboard: { contributor: "group:" + group }, planner: {}, procurement: {} },
    grants: [{ principalRef: oid, namespaces: ["cases"], operations: ["sf_case_draft", "sf_case_read"] }],
  })
  const cookie = await fixture.login()
  const initial = await fixture.snapshot()
  expect(initial.data).not.toHaveProperty("__sfProductV1")
  const objective = "Exercise the original decisions producer under a Microsoft Team"
  const command = {
    operation: "sf_case_draft",
    input: { objective, horizon: { start: "2027-01-01", end: "2027-12-31" },
      currency: "USD", criteria: ["Preserve the recorded decision"], sourceRefs: [] },
  }
  const create = (key: string, selector?: string) => fixture.request(fixture.mount + "/dashboard?sf=workbench-command", {
    method: "POST",
    headers: { cookie, origin: publicOrigin, "content-type": "application/json", "idempotency-key": key,
      ...(selector ? { "x-sf-team-profile": selector } : {}) },
    body: JSON.stringify(command),
  })
  const foreign = JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team",
    profile: { ...fixture.team.profile, teamObjectId: "88888888-8888-4888-8888-888888888888" } })
  expect((await create(randomUUID())).status).toBe(403)
  expect((await create(randomUUID(), foreign)).status).toBe(403)
  const denied = await fixture.snapshot()
  expect(denied.data).not.toHaveProperty("__sfProductV1")
  expect(denied.versions).toEqual(initial.versions)
  const headers = { cookie, "x-sf-team-profile": fixture.team.selector }
  const cases = fixture.mount + "/api/ui/projections/cases"
  const contextQuery = new URLSearchParams({ contractRevision: "sf-team-profile/1", kind: "team",
    ...fixture.team.profile, hostId: fixture.binding.hostId })
  const context = await fixture.request(fixture.mount + "/api/ui/context?" + contextQuery, { headers: { cookie } })
  expect(context.status).toBe(200)
  expect(await context.json()).toMatchObject({ status: "ok", value: { availability: expect.arrayContaining([
    expect.objectContaining({ operations: expect.arrayContaining([
      expect.objectContaining({ operationId: "projection.cases", state: "ready", operational: true }),
    ]) }),
    expect.objectContaining({ operations: expect.arrayContaining([
      expect.objectContaining({ operationId: "decisions.command.sf_case_draft", state: "ready", operational: true }),
    ]) }),
  ]) } })
  const empty = await fixture.request(cases, { headers })
  expect(empty.status).toBe(200)
  expect(await empty.json()).toMatchObject({ status: "ok", value: { cases: [] } })
  expect((await fixture.snapshot()).data).not.toHaveProperty("__sfProductV1")

  // The first authorized command initializes C08 in the same real transaction
  // as the case creation. A test seed or pre-admission write is unnecessary.
  const key = randomUUID()
  const created = await create(key, fixture.team.selector)
  expect(created.status).toBe(200)
  const result: unknown = await created.json()
  const caseRef = readCreatedCaseRef(result)
  expect(result).toMatchObject({ status: "ok" })
  const replay = await create(key, fixture.team.selector)
  expect(replay.status).toBe(200)
  expect(await replay.json()).toEqual(result)
  const projection = fixture.mount + "/api/ui/projections/case?" + new URLSearchParams({ caseRef })
  const reopened = await fixture.request(projection, { headers })
  expect(reopened.status).toBe(200)
  const detail = await reopened.json()
  expect(detail).toMatchObject({
    status: "ok", context: { team: { owner: { profile: fixture.team.profile,
      principal: { tenantId: fixture.team.profile.tenantId, principalObjectId: oid } } } },
    value: { projection: { context: { principalRef: oid }, case: { objective, version: 1, participants: [oid] } } },
  })
  expect(detail.value.projection.context).not.toHaveProperty("owner")
  const listed = await fixture.request(cases, { headers })
  expect(listed.status).toBe(200)
  expect(await listed.json()).toMatchObject({ status: "ok", value: {
    cases: [{ caseRef, title: objective, version: 1 }],
  } })
}, 60_000)

test("installed Decisions isolates two eligible Teams for the same Microsoft principal", async () => {
  await using fixture = await openInstalledTeamFixture({
    additionalTeamIds: ["88888888-8888-4888-8888-888888888888"],
    groups: { dashboard: { contributor: "group:" + group }, planner: {}, procurement: {} },
    grants: [{ principalRef: oid, namespaces: ["cases"], operations: ["sf_case_draft", "sf_case_read"] }],
  })
  const first = fixture.team
  const second = first.additionalTeams[0]
  if (!second) throw new Error("Installed administration did not enable a second Team")
  const cookie = await fixture.login()
  const headers = (selector: string) => ({ cookie, "x-sf-team-profile": selector })
  const create = (selector: string, key: string, objective: string) => fixture.request(fixture.mount + "/dashboard?sf=workbench-command", {
    method: "POST",
    headers: { ...headers(selector), origin: publicOrigin, "content-type": "application/json", "idempotency-key": key },
    body: JSON.stringify({ operation: "sf_case_draft", input: {
      objective, horizon: { start: "2027-01-01", end: "2027-12-31" },
      currency: "USD", criteria: ["Preserve the recorded decision"], sourceRefs: [],
    } }),
  })
  const cases = fixture.mount + "/api/ui/projections/cases"
  const projection = (caseRef: string) => fixture.mount + "/api/ui/projections/case?" + new URLSearchParams({ caseRef })
  const firstObjective = "Decision assigned to the first admitted Team"
  const firstKey = randomUUID()
  const createdFirst = await create(first.selector, firstKey, firstObjective)
  expect(createdFirst.status).toBe(200)
  const firstResult: unknown = await createdFirst.json()
  const firstRef = readCreatedCaseRef(firstResult)
  const emptySecond = await fixture.request(cases, { headers: headers(second.selector) })
  expect(emptySecond.status).toBe(200)
  expect(await emptySecond.json()).toMatchObject({ status: "ok", context: { principalRef: oid,
    team: { owner: { profile: second.profile } } }, value: { cases: [] } })
  expect((await create(second.selector, firstKey, firstObjective)).status).toBe(403)

  const secondObjective = "Decision assigned to the second admitted Team"
  const createdSecond = await create(second.selector, randomUUID(), secondObjective)
  expect(createdSecond.status).toBe(200)
  const secondRef = readCreatedCaseRef(await createdSecond.json())
  expect(secondRef).not.toBe(firstRef)
  for (const pair of [
    { owner: first, ownRef: firstRef, ownObjective: firstObjective, foreignRef: secondRef, foreignObjective: secondObjective },
    { owner: second, ownRef: secondRef, ownObjective: secondObjective, foreignRef: firstRef, foreignObjective: firstObjective },
  ]) {
    const init = { headers: headers(pair.owner.selector) }
    const denied = await fixture.request(projection(pair.foreignRef), init)
    expect(denied.status).toBe(403)
    expect(await denied.text()).not.toContain(pair.foreignObjective)
    const listed = await fixture.request(cases, init)
    expect(listed.status).toBe(200)
    const list = await listed.json()
    expect(list).toMatchObject({ status: "ok", context: { principalRef: oid, team: { owner: { profile: pair.owner.profile } } } })
    expect(list.value.cases).toEqual([{ caseRef: pair.ownRef, title: pair.ownObjective, version: 1 }])
  }
  const replay = await create(first.selector, firstKey, firstObjective)
  expect(replay.status).toBe(200)
  expect(await replay.json()).toEqual(firstResult)
  const reopened = await fixture.request(projection(firstRef), { headers: headers(first.selector) })
  expect(reopened.status).toBe(200)
  expect(await reopened.json()).toMatchObject({ status: "ok", context: { principalRef: oid,
    team: { owner: { profile: first.profile } } }, value: { projection: { case: { objective: firstObjective } } } })
}, 120_000)

function readCreatedCaseRef(result: unknown) {
  if (!result || typeof result !== "object" || !("outputRef" in result) || typeof result.outputRef !== "string")
    throw new Error("Installed Decisions did not return a case reference")
  expect(result.outputRef).toMatch(/^case:[^:]+:[^:]+$/)
  return result.outputRef
}
