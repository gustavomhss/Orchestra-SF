import { expect, test } from "bun:test"
import { createTeamProfileIdentityBoundary } from "../../runtime/team-profile-identity.ts"
import { teamProductFixture } from "./product-fixture.ts"
import { barrier, profileA, profileB } from "./installation-fixture.ts"
import { oid } from "../microsoft-login/oidc-fixture.ts"

async function configured() {
  const f = await teamProductFixture({ enabled: [profileA, profileB] })
  const configured = await f.resolver.configureConfiguration(f.request(undefined, f.cookie), {
    profile: profileA, expectedRevision: 2,
    document: { version: 1, settings: { model: "approved/current", agents: { analyst: { system: "Approved shared instructions" } } } },
  })
  expect(configured).toEqual({ status: "ok", configRevision: 3, changed: true })
  return f
}

test("configuration-boundary-01: only the original request's retained admission reads the current Team document", async () => {
  const f = await configured()
  try {
    const input = { identity: f.identity, resolver: f.resolver, ...f.binding }
    const boundary = createTeamProfileIdentityBoundary(input)
    const request = f.businessRequest()
    const admission = await boundary.admit(request)
    if (!admission || !boundary.profiles.readConfiguration) throw new Error("Actual private Team boundary required")
    const read = boundary.profiles.readConfiguration
    const value = await read(admission)
    expect(value).toMatchObject({ origin: "installation-team-store", profile: profileA, configRevision: 3,
      document: { version: 1, settings: { model: "approved/current" } } })
    expect(await read({ ...admission })).toBeUndefined()
    expect(await read(JSON.parse(JSON.stringify(admission)))).toBeUndefined()
    expect(await read(value)).toBeUndefined()
    const otherBoundary = createTeamProfileIdentityBoundary(input)
    expect(await otherBoundary.profiles.readConfiguration?.(admission)).toBeUndefined()
    const other = await boundary.admit(f.businessRequest(profileB))
    if (!other) throw new Error("Independent Team B admission required")
    expect(await read(other)).toBeUndefined()
    expect(request.headers.get("x-sf-team-profile")).toContain(profileA.teamObjectId)
  } finally { await f.close() }
})

for (const change of ["selector", "abort", "membership"] as const) {
  test("configuration-boundary: " + change + " changed during an awaited private read prevents delivery", async () => {
    const f = await configured()
    const gate = barrier()
    const controller = new AbortController()
    try {
      const boundary = createTeamProfileIdentityBoundary({
        identity: f.identity, ...f.binding,
        resolver: { ...f.resolver, readConfiguration: async (admission) => {
          const value = await f.resolver.readConfiguration(admission)
          await gate.hold()
          return value
        } },
      })
      const request = f.businessRequest(profileA, f.cookie, { signal: controller.signal })
      const admission = await boundary.admit(request)
      if (!admission || !boundary.profiles.readConfiguration) throw new Error("Actual private Team boundary required")
      const pending = boundary.profiles.readConfiguration(admission)
      await gate.entered
      if (change === "selector") request.headers.set("x-sf-team-profile", JSON.stringify({
        contractRevision: "sf-team-profile/1", kind: "team", profile: profileB,
      }))
      if (change === "abort") controller.abort()
      if (change === "membership") f.provider.directTeams.set(oid, [])
      gate.release()
      expect(await pending).toBeUndefined()
      expect(await boundary.profiles.revalidate(admission)).toBe(false)
    } finally { gate.release(); await f.close() }
  })
}
