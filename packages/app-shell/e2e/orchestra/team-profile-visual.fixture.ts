import { expect, type Page, type Route } from "@playwright/test"
import { Schema } from "effect"
import { SfInstallationList, SfTeamContextResult, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"

// COMPONENT VISUAL / not Microsoft live. The built application's entry, providers,
// strict readers, SDK, components and CSS are original. Only HTTP responses are fixtures,
// using the same contracts as test-browser/team-profile*.test.ts and team-session-page.test.ts.
export const teamsVisualOrigin = "https://sf-teams.visual.test"
export const teamsVisualBinding = Schema.decodeUnknownSync(SfTeamInstallationDescriptor)({
  installationId: "installation-one",
  tenantId: "11111111-2222-4333-8444-555555555555",
  projectId: "technical-project",
  hostId: "teams-host",
  publicOrigin: teamsVisualOrigin,
  mount: "/sucafina",
  contractRevision: "sf-team-profile/1",
  authMode: "microsoft",
})
export const teamsVisualTeams = [
  { id: "a1111111-2222-4333-8444-555555555555", name: "Component visual · Finance", enabled: true },
  { id: "b1111111-2222-4333-8444-555555555555", name: "Component visual · Procurement", enabled: true },
  { id: "c1111111-2222-4333-8444-555555555555", name: "Component visual · Coffee sourcing and supplier operations", enabled: true },
  { id: "d1111111-2222-4333-8444-555555555555", name: "Component visual · Commercial", enabled: true },
  { id: "e1111111-2222-4333-8444-555555555555", name: "Component visual · People", enabled: true },
  { id: "f1111111-2222-4333-8444-555555555555", name: "Component visual · Logistics", enabled: true },
  { id: "01111111-2222-4333-8444-555555555555", name: "Component visual · Planning", enabled: true },
  { id: "21111111-2222-4333-8444-555555555555", name: "Not supplied by the eligible Team list", enabled: false },
] as const

const principal = {
  tenantId: teamsVisualBinding.tenantId,
  principalObjectId: "91111111-2222-4333-8444-555555555555",
}
const profile = (teamObjectId: string) => ({
  installationId: teamsVisualBinding.installationId,
  tenantId: teamsVisualBinding.tenantId,
  teamObjectId,
})
const owner = (team: string) => ({ profile: profile(team), principal })
const namespace = (team: string) => Schema.decodeUnknownSync(TeamProfile.SessionNamespace)({
  version: 1, owner: owner(team), authorityGeneration: 1,
})
const choices = teamsVisualTeams.filter((team) => team.enabled).map((team) => ({
  profile: profile(team.id), displayName: team.name,
}))
const context = (team: string | null) => Schema.decodeUnknownSync(SfTeamContextResult)({
  status: "ok",
  value: {
    contractRevision: teamsVisualBinding.contractRevision,
    authMode: teamsVisualBinding.authMode,
    stamp: {
      installationId: teamsVisualBinding.installationId,
      projectId: teamsVisualBinding.projectId,
      hostId: teamsVisualBinding.hostId,
      principalRef: principal.principalObjectId,
      policyVersion: "policy-one",
      accessRevision: "access-one",
      ...(team ? { team: { owner: owner(team), revisions: { configRevision: 0, accessRevision: "access-one" } } } : {}),
    },
    profile: {
      contractRevision: teamsVisualBinding.contractRevision,
      status: "authenticated",
      installationId: teamsVisualBinding.installationId,
      principal,
      accessRevision: "access-one",
      administration: { status: "available" },
      teams: team
        ? { status: "ready", choices, selected: profile(team), configRevision: 0 }
        : { status: "selection-required", choices },
    },
    destinations: [],
    availability: [],
  },
})

const json = (route: Route, body: unknown, status = 200) => route.fulfill({
  status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(body),
})

export async function installTeamsVisual(
  page: Page,
  input: { baseURL: string; scheme: "dark" | "light"; signedIn?: boolean },
) {
  const production = new URL(input.baseURL)
  const state = { signedIn: input.signedIn ?? false }
  const requests: { path: string; method: string; team?: string }[] = []
  const unexpected: string[] = []
  const assets = new Set<string>()
  const events = new Map<Route, { team: string; release(): void }>()
  await page.addInitScript(({ scheme }) => {
    // User preferences only; no app state, authority, DOM or production globals are replaced.
    localStorage.setItem("language.v1", JSON.stringify({ locale: "en" }))
    localStorage.setItem("orchestra-theme-id", "oc-2")
    localStorage.setItem("orchestra-palette", scheme)
    localStorage.setItem("orchestra-color-scheme", scheme)
  }, { scheme: input.scheme })
  await page.emulateMedia({ colorScheme: input.scheme, reducedMotion: "reduce" })
  await page.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== teamsVisualOrigin) {
      unexpected.push(request.method() + " " + url.origin + url.pathname)
      return route.abort("blockedbyclient")
    }
    const path = url.pathname, method = request.method()
    if (path.startsWith("/api/") || path.startsWith(teamsVisualBinding.mount + "/api/")) {
      requests.push({ path, method, team: url.searchParams.get("teamObjectId") ?? undefined })
      expect(request.headers()["authorization"], "Teams reads do not receive a generic bearer token").toBeUndefined()
      if (method !== "GET") {
        unexpected.push(method + " " + path)
        return json(route, { error: "Visual fixtures permit no writes" }, 405)
      }
      if (path === "/api/sucafina/installations") {
        expect(Object.fromEntries(url.searchParams)).toEqual({ select: "current", contractRevision: "sf-team-profile/1" })
        return json(route, Schema.decodeUnknownSync(SfInstallationList)({ installations: [teamsVisualBinding] }))
      }
      if (path === teamsVisualBinding.mount + "/api/ui/context") {
        const query = Schema.decodeUnknownSync(TeamProfile.ContextQuery)(Object.fromEntries(url.searchParams))
        expect(query.installationId).toBe(teamsVisualBinding.installationId)
        expect(query.tenantId).toBe(teamsVisualBinding.tenantId)
        expect(query.hostId).toBe(teamsVisualBinding.hostId)
        if (!state.signedIn) return json(route, Schema.decodeUnknownSync(SfTeamContextResult)({ status: "unauthenticated" }), 401)
        return json(route, context(query.teamObjectId ?? null))
      }
      if (path === teamsVisualBinding.mount + "/api/ui/team-profiles") {
        expect(Object.fromEntries(url.searchParams)).toEqual({
          contractRevision: teamsVisualBinding.contractRevision,
          installationId: teamsVisualBinding.installationId, tenantId: teamsVisualBinding.tenantId,
        })
        return json(route, Schema.decodeUnknownSync(TeamProfile.AdminListResult)({
          status: "ok", configRevision: "catalog-one",
          profiles: teamsVisualTeams.map((team) => ({ profile: profile(team.id), enabled: team.enabled })),
        }))
      }
      if (path === teamsVisualBinding.mount + "/api/ui/team-profiles/configuration") {
        expect(Object.fromEntries(url.searchParams)).toEqual({
          contractRevision: teamsVisualBinding.contractRevision,
          installationId: teamsVisualBinding.installationId, tenantId: teamsVisualBinding.tenantId,
          teamObjectId: teamsVisualTeams[0].id,
        })
        return json(route, Schema.decodeUnknownSync(TeamProfile.ConfigurationReadResult)({
          status: "ok",
          configuration: {
            origin: "installation-team-store", profile: profile(teamsVisualTeams[0].id), configRevision: "configuration-read",
            document: { version: 1, settings: {
              model: "approved/model-one", default_agent: "maestro",
              agents: { analyst: { description: "Prepared shared agent", system: "Keep existing instructions.", mode: "subagent", disabled: true } },
            } },
          },
        }))
      }
      if (path === teamsVisualBinding.mount + "/api/session" || path === teamsVisualBinding.mount + "/api/session/active" ||
          path === teamsVisualBinding.mount + "/api/event") {
        const raw = request.headers()["x-sf-team-profile"]
        if (!raw) throw new Error("Session request must carry the application's closed Team selector")
        const selector = Schema.decodeUnknownSync(TeamProfile.Selector)(JSON.parse(raw))
        if (selector.kind !== "team") throw new Error("Session request must identify a Team")
        expect(selector.profile.installationId).toBe(teamsVisualBinding.installationId)
        expect(selector.profile.tenantId).toBe(teamsVisualBinding.tenantId)
        const team = selector.profile.teamObjectId
        if (path.endsWith("/api/session")) return json(route, { namespace: namespace(team), cursor: {}, data: [] })
        if (path.endsWith("/api/session/active")) return json(route, { namespace: namespace(team), data: {} })
        // Playwright fulfill is finite, not a streaming server. Keep the real HTTP request
        // pending to capture READY / CONNECTING honestly; never claim an open live stream.
        await new Promise<void>((release) => events.set(route, { team, release }))
        return
      }
      unexpected.push(method + " " + path)
      return json(route, { error: "Unexpected visual fixture request" }, 501)
    }
    if (path.startsWith(teamsVisualBinding.mount + "/auth/")) {
      unexpected.push(method + " " + path)
      return route.abort("blockedbyclient")
    }
    // Proxy bytes from the real build. A host only adds the brand and Teams mount flags.
    const upstream = new URL(url.pathname + url.search, production)
    const response = await route.fetch({ url: upstream.href, maxRetries: 0 })
    expect(response.status(), "Original build asset " + path).toBe(200)
    if (request.isNavigationRequest()) {
      const original = await response.text()
      expect(original).toContain('id="root"')
      expect(original).toMatch(/<html\b/i)
      const body = original.replace(/<html\b[^>]*>/i, (tag) => tag
        .replace(/\sdata-orchestra-brand=(?:"[^"]*"|'[^']*')/gi, "")
        .replace(/\sdata-sf-team-web=(?:"[^"]*"|'[^']*')/gi, "")
        .replace(/>$/, ' data-orchestra-brand="sucafina" data-sf-team-web="1">'))
      return route.fulfill({ response, body })
    }
    assets.add(url.pathname)
    return route.fulfill({ response })
  })
  return {
    state, requests, unexpected, assets,
    chatURL(team: string) {
      return teamsVisualOrigin + "/orchestra/sf-sessions/new?" + new URLSearchParams({
        contractRevision: teamsVisualBinding.contractRevision, server: teamsVisualOrigin,
        installationId: teamsVisualBinding.installationId, tenantId: teamsVisualBinding.tenantId, teamObjectId: team,
      })
    },
    async finishEventStreams() {
      expect(events.size, "The real SDK requested the Team event stream").toBeGreaterThan(0)
      for (const [route, entry] of [...events]) {
        events.delete(route)
        try {
          await route.fulfill({
            status: 200, contentType: "text/event-stream", headers: { "cache-control": "no-store" },
            body: "data: " + JSON.stringify({
              namespace: namespace(entry.team), event: { id: "evt_connected_visual", type: "server.connected", data: {} },
            }) + "\n\n",
          })
        } finally { entry.release() }
      }
    },
    async dispose() {
      for (const [route, entry] of [...events]) {
        events.delete(route)
        try { await route.abort("aborted") } catch { /* A failed test may already have closed its page. */ }
        finally { entry.release() }
      }
    },
  }
}
