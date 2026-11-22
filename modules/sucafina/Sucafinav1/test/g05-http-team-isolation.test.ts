import { expect, test } from "bun:test"
import { exportJWK, generateKeyPair, SignJWT } from "jose"
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createMicrosoftInstallation } from "../local/microsoft-entry.ts"
import { digestSfValue } from "../product/contracts/canonical.ts"
import { prepareLocalConfiguration } from "../runtime/local-configuration.ts"
import { teamProfileInstallationId } from "../runtime/team-profile-access.ts"

// This is real loopback HTTP plus the actual Microsoft installation composition.
// Entra/JWKS/Graph are controlled at their documented fetch boundary: this is not tenant QA or a tar proof.
test("G05 loopback HTTP admits Teams and rejects wrong owners without cross-Team effects", async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sf-g05-http-"))
  const directory = join(root, "installation")
  const workspaceDirectory = join(root, "workspace")
  const origin = "https://sf-g05.example.test"
  const mount = "/sucafina"
  const tenantId = "11111111-1111-4111-8111-111111111111"
  const clientId = "22222222-2222-4222-8222-222222222222"
  const principalId = "33333333-3333-4333-8333-333333333333"
  const groupId = "a3333333-3333-4333-8333-333333333333"
  const teamA = "44444444-4444-4444-8444-444444444444"
  const teamB = "55555555-5555-4555-8555-555555555555"
  const disabledTeam = "66666666-6666-4666-8666-666666666666"
  const authority = "https://login.microsoftonline.com/" + tenantId
  const graph = "https://graph.microsoft.com/v1.0"
  const epoch = 1794398400
  const keys = await generateKeyPair("RS256", { extractable: true })
  const jwk = await exportJWK(keys.publicKey)
  const state: {
    installation?: Awaited<ReturnType<typeof createMicrosoftInstallation>>
    nonce: string
    teams: string[]
    graphCalls: string[]
    requests: number
    loopbackPeers: number
    ingressRequests: number
  } = { nonce: "", teams: [teamA, teamB, disabledTeam], graphCalls: [], requests: 0, loopbackPeers: 0, ingressRequests: 0 }
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
  const listener = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    idleTimeout: 0,
    async fetch(request, server) {
      state.requests += 1
      if (server.requestIP(request)?.address !== "127.0.0.1")
        return new Response("Non-loopback proof peer", { status: 500 })
      state.loopbackPeers += 1
      if (new URL(request.url).origin === ingressOrigin) state.ingressRequests += 1
      return await state.installation?.handler(request) ?? new Response(null, { status: 404 })
    },
  })
  const listenerOrigin = listener.url.origin
  const ingressOrigin = "http://sf-ingress.example.test:" + listener.port
  const request = (path: string, headers: Record<string, string> = {}, init: Pick<RequestInit, "method" | "body"> = {}) =>
    fetch(new URL(mount + path, listener.url), {
      ...init,
      headers: { host: new URL(ingressOrigin).host, ...headers },
      redirect: "manual",
    })
  try {
    const file = await prepareLocalConfiguration(directory)
    await mkdir(workspaceDirectory, { mode: 0o700 })
    await writeFile(file, JSON.stringify({
      version: 1, deployment: "azure-https", authentication: "microsoft",
      origin, listenerOrigin, ingressOrigin, mount, tenantId, clientId, workspaceDirectory,
      groups: { dashboard: { admin: "group:" + groupId }, planner: {}, procurement: { buyer: "group:" + groupId, admin: "group:" + groupId } },
      grants: [{ principalRef: groupId, operations: ["sf_case_read"] }],
      supremeAdminGroupId: groupId, scanner: null, teams: "direct", enabledTeamIds: [teamA, teamB],
    }))
    await writeFile(join(directory, "client-secret.txt"), "synthetic-g05-private-secret", { mode: 0o600 })
    await writeFile(join(directory, "ingress-secret.txt"), "a".repeat(64), { mode: 0o600 })
    state.installation = await createMicrosoftInstallation({ origin: listenerOrigin }, file, {
      ORCHESTRA_DB: join(directory, "host-data", "orchestra.db"),
      ORCHESTRA_INHERIT_CREDENTIALS: "0",
      ORCHESTRA_CONFIG_DIR: join(directory, "host-config"),
      ORCHESTRA_CREDENTIAL_KEY_FILE: join(directory, "host-credential.key"),
      TMPDIR: join(directory, "host-tmp"),
      XDG_DATA_HOME: join(directory, "host-data"),
      XDG_CONFIG_HOME: join(directory, "host-config"),
      XDG_CACHE_HOME: join(directory, "host-cache"),
      XDG_STATE_HOME: join(directory, "host-state"),
    }, {
      now: () => new Date(epoch * 1000),
      async fetch(request) {
        const url = new URL(request.url)
        if (url.href === authority + "/v2.0/.well-known/openid-configuration")
          return Response.json({
            issuer: authority + "/v2.0",
            authorization_endpoint: authority + "/oauth2/v2.0/authorize",
            token_endpoint: authority + "/oauth2/v2.0/token",
            jwks_uri: authority + "/discovery/v2.0/keys",
          })
        if (url.href === authority + "/discovery/v2.0/keys")
          return Response.json({ keys: [{ ...jwk, kid: "g05-controlled-entra" }] })
        if (url.href === authority + "/oauth2/v2.0/token") {
          const form = new URLSearchParams(await request.text())
          expect(form.get("code")).toBe("g05-controlled-code")
          expect(form.get("client_secret")).toBe("synthetic-g05-private-secret")
          expect(form.get("redirect_uri")).toBe(origin + mount + "/auth/callback")
          const token = await new SignJWT({ tid: tenantId, oid: principalId, nonce: state.nonce })
            .setSubject("g05-controlled-subject").setIssuer(authority + "/v2.0").setAudience(clientId)
            .setIssuedAt(epoch).setExpirationTime(epoch + 3600)
            .setProtectedHeader({ alg: "RS256", kid: "g05-controlled-entra" }).sign(keys.privateKey)
          return Response.json({
            access_token: "synthetic-g05-access", id_token: token, token_type: "Bearer",
            expires_in: 3600, scope: "User.Read Team.ReadBasic.All",
          })
        }
        if (url.origin === "https://graph.microsoft.com") {
          expect(request.headers.get("authorization")).toBe("Bearer synthetic-g05-access")
          state.graphCalls.push(url.pathname)
          if (url.href === graph + "/me") return Response.json({ id: principalId, displayName: "Controlled G05 actor" })
          if (url.href === graph + "/me/checkMemberGroups") return Response.json({ value: [groupId] })
          if (url.href === graph + "/me/joinedTeams")
            return Response.json({ value: state.teams.map((id) => ({ id, tenantId, displayName: id, isArchived: false })) })
        }
        throw new Error("Unexpected request outside the controlled Entra/Graph fixture")
      },
    })

    const anonymous = await request("/teams/" + teamA + "/procurement")
    expect(anonymous.status).toBe(303)
    const loginRedirect = new URL(anonymous.headers.get("location")!, origin)
    expect(loginRedirect.origin).toBe(origin)
    expect(loginRedirect.pathname).toBe(mount + "/auth/login")
    expect(loginRedirect.searchParams.get("returnTo")).toBe(mount + "/teams/" + teamA + "/procurement")
    await anonymous.body?.cancel()
    passed("anonymous-denied")

    const begin = await request("/auth/login")
    expect(begin.status).toBe(303)
    const authorize = new URL(begin.headers.get("location")!)
    state.nonce = authorize.searchParams.get("nonce")!
    expect(state.nonce.length).toBeGreaterThan(0)
    const loginCookie = begin.headers.getSetCookie().find((item) => item.includes("_login="))!
    await begin.body?.cancel()
    const finish = await request("/auth/callback?" + new URLSearchParams({
      code: "g05-controlled-code", state: authorize.searchParams.get("state")!,
    }), { cookie: loginCookie.split(";")[0]! })
    expect(finish.status).toBe(303)
    const sessionCookie = finish.headers.getSetCookie().find((item) => item.includes("_session="))!
    expect(sessionCookie).toContain("; Secure")
    const cookie = sessionCookie.split(";")[0]!
    await finish.body?.cancel()
    const admitted = await request("/teams/" + teamA + "/dashboard", { cookie })
    expect(admitted.status).toBe(200)
    expect(await admitted.text()).toContain('name="person" value="' + principalId + '"')
    passed("signed-session-admitted")

    const installationId = teamProfileInstallationId({ origin, mount, directory })
    const profile = { installationId, tenantId, teamObjectId: teamA }
    const selector = (target: typeof profile) => JSON.stringify({
      contractRevision: "sf-team-profile/1", kind: "team", profile: target,
    })
    const write = (team: string, legalName: string, target?: typeof profile) =>
      request("/teams/" + team + "/procurement", {
        cookie, origin, "content-type": "application/json",
        ...(target ? { "x-sf-team-profile": selector(target) } : {}),
      }, { method: "POST", body: JSON.stringify({ page: "Suppliers", action: "create", version: 0, values: { legalName } }) })
    const read = async (team: string) => {
      const response = await request("/teams/" + team + "/procurement?page=Suppliers", { cookie })
      expect(response.status).toBe(200)
      return response.text()
    }
    for (const [team, label, id] of [[teamA, "G05 Team A supplier", "team-a-write"], [teamB, "G05 Team B supplier", "team-b-write"]] as const) {
      const response = await write(team, label)
      expect(response.status).toBe(200)
      await response.body?.cancel()
      passed(id)
    }
    const beforeA = await read(teamA)
    const beforeB = await read(teamB)
    expect(beforeA).toContain("G05 Team A supplier")
    expect(beforeA).not.toContain("G05 Team B supplier")
    expect(beforeB).toContain("G05 Team B supplier")
    expect(beforeB).not.toContain("G05 Team A supplier")
    for (const teamObjectId of [teamA, teamB]) {
      const partition = digestSfValue({ installationId, tenantId, teamObjectId })
      expect(await Bun.file(join(directory, "business-teams", partition, "installation.sqlite")).exists()).toBe(true)
    }
    passed("team-read-isolation")

    for (const [id, target] of [
      ["wrong-installation-denied", { ...profile, installationId: "foreign-installation" }],
      ["wrong-tenant-denied", { ...profile, tenantId: clientId }],
      ["selector-route-mismatch-denied", { ...profile, teamObjectId: teamB }],
    ] as const) {
      const response = await write(teamA, "G05 denied " + id, target)
      expect(response.status).toBe(403)
      expect(await response.text()).not.toContain("G05 Team A supplier")
      passed(id)
    }
    const disabled = await write(disabledTeam, "G05 denied disabled")
    expect(disabled.status).toBe(403)
    await disabled.body?.cancel()
    passed("disabled-team-denied")

    state.teams = [teamB, disabledTeam]
    const revoked = await write(teamA, "G05 denied revoked")
    expect(revoked.status).toBe(403)
    await revoked.body?.cancel()
    const revokedRead = await request("/teams/" + teamA + "/procurement?page=Suppliers", { cookie })
    expect(revokedRead.status).toBe(403)
    expect(await revokedRead.text()).not.toContain("G05 Team A supplier")
    passed("revoked-membership-denied")
    state.teams = [teamA, teamB, disabledTeam]
    expect(await read(teamA)).toBe(beforeA)
    expect(await read(teamB)).toBe(beforeB)
    passed("denied-writes-have-no-effect")
    expect(state.graphCalls).toContain("/v1.0/me/joinedTeams")
    expect(state.requests).toBeGreaterThan(0)
    expect(state.loopbackPeers).toBe(state.requests)
    expect(state.ingressRequests).toBe(state.requests)
    expect(cases.every((entry) => entry.status === "pass")).toBe(true)
  } finally {
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
      transport: { protocol: "http:", listener: "127.0.0.1", port: listener.port, requests: state.requests, loopbackPeers: state.loopbackPeers, ingressRequests: state.ingressRequests },
      graphRequests: state.graphCalls,
      cases,
      summary: { expected: cases.length, pass: cases.filter((entry) => entry.status === "pass").length, pending: cases.filter((entry) => entry.status === "pending").length },
    }
    const destination = process.env.G05_TEAM_RECEIPT
    if (destination) await Bun.write(destination, JSON.stringify(receipt, null, 2) + "\n")
    await listener.stop(true)
    await state.installation?.dispose()
    await rm(root, { recursive: true, force: true })
  }
}, 60_000)
