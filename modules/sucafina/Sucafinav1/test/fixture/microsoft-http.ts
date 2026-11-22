import { expect } from "bun:test"
import { Database } from "bun:sqlite"
import { exportJWK, generateKeyPair, SignJWT } from "jose"
import { lstat, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createMicrosoftInstallation } from "../../local/microsoft-entry.ts"
import { digestSfValue } from "../../product/contracts/canonical.ts"
import { prepareLocalConfiguration } from "../../runtime/local-configuration.ts"
import { teamProfileInstallationId } from "../../runtime/team-profile-access.ts"

// Shared G05/G06 component boundary. Only Entra/JWKS/Graph and the clock are
// controlled; HTTP, callback/session issuance, Team admission, storage and scanner
// remain the original implementation. This is never installed-tenant evidence.
export async function microsoftHttpFixture(options: {
  label?: "g05" | "g06" | "g10"
  grants?: readonly Readonly<Record<string, unknown>>[]
  plannerAdministrator?: boolean
  scanner?: { host: "127.0.0.1"; port: number } | null
} = {}) {
  const label = options.label ?? "g05"
  const root = await mkdtemp(join(await realpath(tmpdir()), "sf-" + label + "-http-"))
  const directory = join(root, "installation")
  const workspaceDirectory = join(root, "workspace")
  const origin = "https://sf-" + label + ".example.test"
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
  const state: {
    installation?: Awaited<ReturnType<typeof createMicrosoftInstallation>>
    nonce: string
    administrator: boolean
    teams: string[]
    graphCalls: string[]
    beforeGraphRequest?: (url: URL) => Promise<void>
    observeRequest?: (request: Request) => void
    requests: number
    loopbackPeers: number
    ingressRequests: number
    cleanupComplete: boolean
  } = { nonce: "", administrator: true, teams: [teamA, teamB, disabledTeam], graphCalls: [], requests: 0,
    loopbackPeers: 0, ingressRequests: 0, cleanupComplete: false }
  const listener = Bun.serve({
    hostname: "127.0.0.1", port: 0, idleTimeout: 0,
    async fetch(request, server) {
      state.requests += 1
      state.observeRequest?.(request)
      if (server.requestIP(request)?.address !== "127.0.0.1")
        return new Response("Non-loopback proof peer", { status: 500 })
      state.loopbackPeers += 1
      if (new URL(request.url).origin === ingressOrigin) state.ingressRequests += 1
      return await state.installation?.handler(request) ?? new Response(null, { status: 404 })
    },
  })
  const listenerPort = listener.port
  const listenerOrigin = listener.url.origin
  const ingressOrigin = "http://sf-ingress.example.test:" + listenerPort
  const request = (path: string, headers: Record<string, string> = {}, init: Pick<RequestInit, "method" | "body"> = {}) =>
    fetch(new URL(mount + path, listener.url), {
      ...init, headers: { host: new URL(ingressOrigin).host, ...headers }, redirect: "manual",
    })
  const close = async () => {
    if (state.cleanupComplete) return
    const failures: unknown[] = []
    for (const dispose of [
      async () => { await listener.stop(true) },
      async () => { await state.installation?.dispose() },
      async () => { await rm(root, { recursive: true, force: true }) },
    ]) {
      try { await dispose() } catch (error) { failures.push(error) }
    }
    await lstat(root).then(
      () => { failures.push(new Error("Microsoft HTTP fixture directory remains")) },
      (error: unknown) => {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) failures.push(error)
      },
    )
    if (failures.length) throw new AggregateError(failures, "Microsoft HTTP fixture cleanup failed")
    state.cleanupComplete = true
  }
  try {
    const keys = await generateKeyPair("RS256", { extractable: true })
    const jwk = await exportJWK(keys.publicKey)
    const file = await prepareLocalConfiguration(directory)
    await mkdir(workspaceDirectory, { mode: 0o700 })
    await writeFile(file, JSON.stringify({
      version: 1, deployment: "azure-https", authentication: "microsoft",
      origin, listenerOrigin, ingressOrigin, mount, tenantId, clientId, workspaceDirectory,
      groups: { dashboard: { admin: "group:" + groupId }, planner: options.plannerAdministrator ? { admin: "group:" + groupId } : {},
        procurement: { buyer: "group:" + groupId, admin: "group:" + groupId } },
      grants: options.grants ?? [{ principalRef: groupId, operations: ["sf_case_read"] }],
      supremeAdminGroupId: groupId, scanner: options.scanner ?? null,
      teams: "direct", enabledTeamIds: [teamA, teamB],
    }))
    await writeFile(join(directory, "client-secret.txt"), "synthetic-" + label + "-private-secret", { mode: 0o600 })
    await writeFile(join(directory, "ingress-secret.txt"), "a".repeat(64), { mode: 0o600 })
    state.installation = await createMicrosoftInstallation({ origin: listenerOrigin }, file, {
      ORCHESTRA_DB: join(directory, "host-data", "orchestra.db"), ORCHESTRA_INHERIT_CREDENTIALS: "0",
      ORCHESTRA_CONFIG_DIR: join(directory, "host-config"),
      ORCHESTRA_CREDENTIAL_KEY_FILE: join(directory, "host-credential.key"),
      TMPDIR: join(directory, "host-tmp"), XDG_DATA_HOME: join(directory, "host-data"),
      XDG_CONFIG_HOME: join(directory, "host-config"), XDG_CACHE_HOME: join(directory, "host-cache"),
      XDG_STATE_HOME: join(directory, "host-state"),
    }, {
      now: () => new Date(epoch * 1000),
      async fetch(request) {
        const url = new URL(request.url)
        if (url.href === authority + "/v2.0/.well-known/openid-configuration")
          return Response.json({
            issuer: authority + "/v2.0", authorization_endpoint: authority + "/oauth2/v2.0/authorize",
            token_endpoint: authority + "/oauth2/v2.0/token", jwks_uri: authority + "/discovery/v2.0/keys",
          })
        if (url.href === authority + "/discovery/v2.0/keys")
          return Response.json({ keys: [{ ...jwk, kid: label + "-controlled-entra" }] })
        if (url.href === authority + "/oauth2/v2.0/token") {
          const form = new URLSearchParams(await request.text())
          expect(form.get("code")).toBe(label + "-controlled-code")
          expect(form.get("client_secret")).toBe("synthetic-" + label + "-private-secret")
          expect(form.get("redirect_uri")).toBe(origin + mount + "/auth/callback")
          const token = await new SignJWT({ tid: tenantId, oid: principalId, nonce: state.nonce })
            .setSubject(label + "-controlled-subject").setIssuer(authority + "/v2.0").setAudience(clientId)
            .setIssuedAt(epoch).setExpirationTime(epoch + 3600)
            .setProtectedHeader({ alg: "RS256", kid: label + "-controlled-entra" }).sign(keys.privateKey)
          return Response.json({
            access_token: "synthetic-" + label + "-access", id_token: token, token_type: "Bearer",
            expires_in: 3600, scope: "User.Read Team.ReadBasic.All",
          })
        }
        if (url.origin === "https://graph.microsoft.com") {
          expect(request.headers.get("authorization")).toBe("Bearer synthetic-" + label + "-access")
          state.graphCalls.push(url.pathname)
          await state.beforeGraphRequest?.(url)
          if (url.pathname === "/v1.0/me") return Response.json({ id: principalId, displayName: "Controlled " + label.toUpperCase() + " actor" })
          if (url.href === graph + "/me/checkMemberGroups") return Response.json({ value: state.administrator ? [groupId] : [] })
          if (url.href === graph + "/me/joinedTeams")
            return Response.json({ value: state.teams.map((id) => ({ id, tenantId, displayName: id, isArchived: false })) })
        }
        throw new Error("Unexpected request outside the controlled Entra/Graph fixture")
      },
    })
    const installationId = teamProfileInstallationId({ origin, mount, directory })
    const profile = (teamObjectId: string) => ({ installationId, tenantId, teamObjectId })
    return {
      root, directory, origin, mount, tenantId, clientId, principalId, groupId, teamA, teamB, disabledTeam,
      installationId, listenerPort, state, request, close, profile,
      selector: (target: ReturnType<typeof profile>) => JSON.stringify({
        contractRevision: "sf-team-profile/1", kind: "team", profile: target,
      }),
      async login() {
        const begin = await request("/auth/login")
        expect(begin.status).toBe(303)
        const authorize = new URL(begin.headers.get("location")!)
        state.nonce = authorize.searchParams.get("nonce")!
        expect(state.nonce.length).toBeGreaterThan(0)
        const loginCookie = begin.headers.getSetCookie().find((item) => item.includes("_login="))!
        await begin.body?.cancel()
        const finish = await request("/auth/callback?" + new URLSearchParams({
          code: label + "-controlled-code", state: authorize.searchParams.get("state")!,
        }), { cookie: loginCookie.split(";")[0]! })
        expect(finish.status).toBe(303)
        const sessionCookie = finish.headers.getSetCookie().find((item) => item.includes("_session="))!
        expect(sessionCookie).toContain("; Secure")
        await finish.body?.cancel()
        return sessionCookie.split(";")[0]!
      },
      // Independent read transaction: all business snapshots and blob bytes, no credentials.
      durable(teams: readonly string[] = [teamA, teamB]) {
        return teams.map((teamObjectId) => {
          const partition = digestSfValue(profile(teamObjectId))
          const database = new Database(join(directory, "business-teams", partition, "installation.sqlite"), { readonly: true })
          try {
            database.exec("BEGIN")
            const snapshots = database.query<{ surface: string; payload: string }, []>("SELECT surface, payload FROM snapshots ORDER BY surface").all()
            const blobs = database.query<{ surface: string; key: string; payload: string; type: string }, []>("SELECT surface, key, hex(payload) AS payload, type FROM blobs ORDER BY surface, key").all()
            database.exec("COMMIT")
            return { teamObjectId, snapshots, blobs }
          } finally { database.close() }
        })
      },
      transport: () => ({ protocol: "http:", listener: "127.0.0.1", port: listenerPort,
        requests: state.requests, loopbackPeers: state.loopbackPeers, ingressRequests: state.ingressRequests }),
    }
  } catch (error) {
    await close()
    throw error
  }
}
