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
  if (!result || typeof result !== "object" || !("outputRef" in result) || typeof result.outputRef !== "string")
    throw new Error("Installed Decisions did not return a case reference")
  const caseRef = result.outputRef
  expect(caseRef).toMatch(/^case:[^:]+:[^:]+$/)
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
