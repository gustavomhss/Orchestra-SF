import { expect, test } from "bun:test"
import { join } from "node:path"
import { digestSfValue } from "../product/contracts/canonical.ts"
import { microsoftHttpFixture } from "./fixture/microsoft-http.ts"

// Real loopback HTTP and the original Microsoft factory; authority is controlled.
test("G05 loopback HTTP admits Teams and rejects wrong owners without cross-Team effects", async () => {
  const f = await microsoftHttpFixture()
  const state: { durableComparison: { teamObjectId: string; before: string; after: string }[] } = { durableComparison: [] }
  const cases = [
    "anonymous-denied",
    "signed-session-admitted",
    "team-a-write",
    "team-b-write",
    "team-read-isolation",
    "wrong-installation-denied",
    "wrong-tenant-denied",
    "selector-route-mismatch-denied",
    "disabled-team-denied",
    "revoked-membership-denied",
    "denied-writes-have-no-effect",
  ].map((id) => ({ id, status: "pending" as "pending" | "pass" }))
  const passed = (id: string) => {
    const entry = cases.find((item) => item.id === id)
    if (!entry) throw new Error("Unregistered G05 case")
    entry.status = "pass"
  }
  try {
    const anonymous = await f.request("/teams/" + f.teamA + "/procurement")
    expect(anonymous.status).toBe(303)
    const loginRedirect = new URL(anonymous.headers.get("location")!, f.origin)
    expect(loginRedirect.origin).toBe(f.origin)
    expect(loginRedirect.pathname).toBe(f.mount + "/auth/login")
    expect(loginRedirect.searchParams.get("returnTo")).toBe(f.mount + "/teams/" + f.teamA + "/procurement")
    await anonymous.body?.cancel()
    passed("anonymous-denied")

    const cookie = await f.login()
    const admitted = await f.request("/teams/" + f.teamA + "/dashboard", { cookie })
    expect(admitted.status).toBe(200)
    expect(await admitted.text()).toContain('name="person" value="' + f.principalId + '"')
    passed("signed-session-admitted")

    const profile = f.profile(f.teamA)
    const write = (team: string, legalName: string, target?: typeof profile) =>
      f.request("/teams/" + team + "/procurement", {
        cookie, origin: f.origin, "content-type": "application/json",
        ...(target ? { "x-sf-team-profile": f.selector(target) } : {}),
      }, { method: "POST", body: JSON.stringify({ page: "Suppliers", action: "create", version: 0, values: { legalName } }) })
    const read = async (team: string) => {
      const response = await f.request("/teams/" + team + "/procurement?page=Suppliers", { cookie })
      expect(response.status).toBe(200)
      return response.text()
    }
    for (const [team, label, id] of [[f.teamA, "G05 Team A supplier", "team-a-write"], [f.teamB, "G05 Team B supplier", "team-b-write"]] as const) {
      const response = await write(team, label)
      expect(response.status).toBe(200)
      await response.body?.cancel()
      passed(id)
    }
    const beforeA = await read(f.teamA)
    const beforeB = await read(f.teamB)
    expect(beforeA).toContain("G05 Team A supplier")
    expect(beforeA).not.toContain("G05 Team B supplier")
    expect(beforeB).toContain("G05 Team B supplier")
    expect(beforeB).not.toContain("G05 Team A supplier")
    for (const teamObjectId of [f.teamA, f.teamB]) {
      const partition = digestSfValue(f.profile(teamObjectId))
      expect(await Bun.file(join(f.directory, "business-teams", partition, "installation.sqlite")).exists()).toBe(true)
    }
    passed("team-read-isolation")

    const durableBefore = f.durable()

    for (const [id, target] of [
      ["wrong-installation-denied", { ...profile, installationId: "foreign-installation" }],
      ["wrong-tenant-denied", { ...profile, tenantId: f.clientId }],
      ["selector-route-mismatch-denied", { ...profile, teamObjectId: f.teamB }],
    ] as const) {
      const response = await write(f.teamA, "G05 denied " + id, target)
      expect(response.status).toBe(403)
      expect(await response.text()).not.toContain("G05 Team A supplier")
      passed(id)
    }
    const disabled = await write(f.disabledTeam, "G05 denied disabled")
    expect(disabled.status).toBe(403)
    await disabled.body?.cancel()
    passed("disabled-team-denied")

    f.state.teams = [f.teamB, f.disabledTeam]
    const revoked = await write(f.teamA, "G05 denied revoked")
    expect(revoked.status).toBe(403)
    await revoked.body?.cancel()
    const revokedRead = await f.request("/teams/" + f.teamA + "/procurement?page=Suppliers", { cookie })
    expect(revokedRead.status).toBe(403)
    expect(await revokedRead.text()).not.toContain("G05 Team A supplier")
    passed("revoked-membership-denied")
    f.state.teams = [f.teamA, f.teamB, f.disabledTeam]
    expect(await read(f.teamA)).toBe(beforeA)
    expect(await read(f.teamB)).toBe(beforeB)
    const durableAfter = f.durable()
    expect(durableAfter).toEqual(durableBefore)
    state.durableComparison = durableBefore.map((before, index) => ({
      teamObjectId: before.teamObjectId, before: digestSfValue(before), after: digestSfValue(durableAfter[index]),
    }))
    passed("denied-writes-have-no-effect")
    expect(f.state.graphCalls).toContain("/v1.0/me/joinedTeams")
    expect(f.state.requests).toBeGreaterThan(0)
    expect(f.state.loopbackPeers).toBe(f.state.requests)
    expect(f.state.ingressRequests).toBe(f.state.requests)
    expect(cases.every((entry) => entry.status === "pass")).toBe(true)

  } finally {
    try { await f.close() }
    finally {
      const receipt = {
        schema: "orchestra.g05.team-http/1",
        sourceSha: process.env.GITHUB_SHA ?? null,
        sourceTree: process.env.G05_SOURCE_TREE ?? null,
        runId: process.env.GITHUB_RUN_ID ?? null,
        runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
        proofClass: "HTTP_LOOPBACK_MICROSOFT_COMPONENT",
        identityProvider: "CONTROLLED_ENTRA_GRAPH",
        installedTeamsProof: false,
        finalCandidate: false,
        runtimeFactory: "createMicrosoftInstallation",
        cleanup: { completed: f.state.cleanupComplete },
        transport: f.transport(),
        graphRequests: f.state.graphCalls,
        durableComparison: { scope: "all Team A/B business snapshots and blobs; authentication payloads excluded", teams: state.durableComparison },
        cases,
        summary: { expected: cases.length, pass: cases.filter((entry) => entry.status === "pass").length, pending: cases.filter((entry) => entry.status === "pending").length },
      }
      const destination = process.env.G05_TEAM_RECEIPT
      if (destination) await Bun.write(destination, JSON.stringify(receipt, null, 2) + "\n")
    }
  }
}, 60_000)
