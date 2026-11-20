import { expect } from "bun:test"
import { randomUUID } from "node:crypto"
import type { Browser, BrowserContext, Page } from "@playwright/test"
import { createModule } from "../../../index.ts"
import type { ModuleServices } from "../../../index.ts"
import type { SfProductGrant } from "../../../product/integration/product-authority.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createTeamProfileIdentityBoundary } from "../../../runtime/team-profile-identity.ts"
import { roleMap } from "../../../runtime/admin.ts"
import { teamProductFixture, productRoleGroup } from "../../teams-profile/product-fixture.ts"
import { serveNativeTeamsWeb } from "../../teams-profile/native-web-network.ts"
import { profileA, teamRow } from "../../teams-profile/installation-fixture.ts"
import { authority, oid, other } from "../../microsoft-login/oidc-fixture.ts"
import { createAuthorizedComponentRenderer } from "./component-renderer-fixture.ts"
import type { ComponentWidgets } from "./component-renderer-fixture.ts"

const viewerGroup = "66666666-6666-4666-8666-666666666666"
type AccountId = typeof oid | typeof other
type ProductAuthorityOptions = Parameters<typeof createSfProductAuthority>[0]

/**
 * G04 component host: real confidential OIDC/PKCE/JWKS, current Team membership,
 * private grants, RoleMaps, SQLite and production producers. Synthetic provider
 * accounts/data are explicit fixtures. This does not restore installed HTML.
 */
export async function createMicrosoftComponentFixture(input: Readonly<{
  grants?: readonly SfProductGrant[]
  names?: readonly [string, string]
  at?: string
}> = {}) {
  const certificate = await Bun.file(new URL("../../../../../../packages/core/test/fixture/pinned-example-cert.pem", import.meta.url)).text()
  const f = await teamProductFixture({ grants: input.grants ?? [] })
  const networks: Awaited<ReturnType<typeof serveNativeTeamsWeb>>[] = []
  const contexts = new Set<BrowserContext>()
  let disposed = false
  try {
    if (input.names) { f.provider.account.name = input.names[0]; f.provider.second.name = input.names[1] }
    for (const surface of ["dashboard", "planner", "procurement"] as const) {
      await f.persistence.transaction(surface, async (snapshot) => {
        snapshot.data.roleMap = roleMap(snapshot, surface).map((row) => row.role === "viewer"
          ? { ...row, entra: "group:" + viewerGroup, version: row.version + 1, by: oid } : row)
        return { commit: true, value: undefined }
      })
    }
    const boundary = createTeamProfileIdentityBoundary({ identity: f.identity, resolver: f.resolver, ...f.binding })
    const clock = { at: input.at ?? "2026-11-13T08:00:00Z" }
    const environment: ModuleServices["environment"] = async (request) => ({
      at: clock.at, id: randomUUID, directory: await boundary.identity.directory(request),
    })
    const roles = new Map<AccountId, "admin" | "viewer">([[oid, "admin"], [other, "admin"]])
    const setRole = (role: "admin" | "viewer", principal: AccountId = oid) => {
      const account = principal === oid ? f.provider.account : f.provider.second
      account.groups = account.groups.filter((value) => value !== productRoleGroup && value !== viewerGroup)
      account.groups.push(role === "admin" ? productRoleGroup : viewerGroup)
      roles.set(principal, role)
    }
    let readable = true
    const policy = {
      get role() { return roles.get(oid)! },
      set role(value: "admin" | "viewer") { setRole(value) },
      get writable() { return roles.get(oid) === "admin" },
      set writable(value: boolean) { setRole(value ? "admin" : "viewer") },
      get readable() { return readable },
      set readable(value: boolean) {
        readable = value
        // Revocation changes the actual synthetic Graph membership observed by
        // the production resolver, rather than fabricating a denied actor.
        f.provider.directTeams.set(oid, value ? [teamRow(profileA.teamObjectId)] : [])
      },
    }
    const selector = JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: profileA })
    let module: ReturnType<typeof createModule> | undefined
    let renderer: ReturnType<typeof createAuthorizedComponentRenderer> | undefined
    let services: ModuleServices | undefined
    const dispatch = async (request: Request): Promise<Response> => {
      if (disposed) return new Response(null, { status: 503 })
      const url = new URL(request.url)
      if (url.origin !== f.binding.origin) return new Response(null, { status: 403 })
      const authenticated = await f.identity.handle(request)
      if (authenticated) return authenticated
      await f.identity.prepare?.(request)
      // Only the OAuth callback landing is allowed before the component's public
      // Team selector is installed by the test client. It contains no business data.
      if (request.method === "GET" && url.pathname === f.binding.mount + "/dashboard" &&
          url.search === "?component-session=1") {
        const person = await f.identity.person(request)
        return new Response(person ? "<h1>Component session ready</h1>" : null,
          { status: person ? 200 : 401,
            headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
      }
      const surface = url.pathname.slice(f.binding.mount.length + 1)
      if (!module || !services || !renderer) return new Response(null, { status: 503 })
      if (surface !== "dashboard" && surface !== "planner" && surface !== "procurement") return new Response(null, { status: 404 })
      if (request.method === "POST" && (request.headers.get("origin") !== f.binding.origin || request.headers.get("sec-fetch-site") === "cross-site")) return new Response(null, { status: 403 })
      if (request.method === "GET") {
        // Product handlers keep their own current admissions. Serving their
        // component HTML here is explicit; createApplication still rejects it.
        const product = await services.product?.(request, surface)
        if (product) return product
        if (!url.searchParams.has("sf") && !url.searchParams.has("download") && !url.searchParams.has("asset") && !url.searchParams.has("asset-link"))
          return renderer(request, surface)
      }
      // The generic domain path uses the same Team preflight as local/entry.
      // Specialized product operations retain their own resource admission.
      if (request.method === "POST" && !url.searchParams.has("sf") && !await boundary.admit(request)) {
        const resolution = await boundary.profiles.resolve(request)
        return new Response(null, { status: resolution.status === "unauthenticated" ? 401 : resolution.status === "unavailable" ? 503 : 403 })
      }
      return await module(request) ?? new Response(null, { status: 404 })
    }
    const routing: { handle?: (request: Request) => Promise<Response | undefined> } = {}
    const transport: { path: string; mode: string | null; method: string; status: number; elapsedMs: number }[] = []
    const networkFor = async (principal: AccountId) => {
      const network = await serveNativeTeamsWeb({
        origin: f.binding.origin,
        handle: async (request) => {
          const started = performance.now(), url = new URL(request.url)
          const response = await (routing.handle ? routing.handle(request) : dispatch(request)) ?? new Response(null, { status: 404 })
          transport.push({ path: url.pathname, mode: url.searchParams.get("sf"), method: request.method, status: response.status, elapsedMs: Math.round(performance.now() - started) })
          return response
        },
        authorize: async (address) => {
          const url = new URL(address)
          const code = await f.provider.issueCode(url.href, principal)
          const callback = new URL(url.searchParams.get("redirect_uri")!)
          callback.searchParams.set("code", code); callback.searchParams.set("state", url.searchParams.get("state")!)
          return new Response(null, { status: 303, headers: { Location: callback.href, "Cache-Control": "no-store" } })
        },
      })
      networks.push(network)
      return network
    }
    const network = await networkFor(oid)
    const mount = (extra: Pick<ModuleServices, "product" | "productView" | "workbookLimits"> = {}, widgets: ComponentWidgets = {}) => {
      services = { ...extra, persistence: f.persistence, authenticate: boundary.identity.authenticate, environment, maxJsonBytes: 100000 }
      module = createModule(f.binding.mount, services)
      renderer = createAuthorizedComponentRenderer({ ...f.binding, boundary, services, widgets })
      return dispatch
    }
    mount()
    const newContext = async (browser: Browser, principal: AccountId = oid) => {
      const selected = principal === oid ? network : await networkFor(principal)
      const context = await browser.newContext({
        proxy: { server: selected.proxy }, ignoreHTTPSErrors: true, serviceWorkers: "block",
      })
      contexts.add(context); context.once("close", () => contexts.delete(context))
      return context
    }
    const loginPage = async (page: Page) => {
      const landing = f.binding.mount + "/dashboard?component-session=1"
      const login = f.binding.origin + f.binding.mount + "/auth/login?returnTo=" + encodeURIComponent(landing)
      try {
        const [begin, authorization, callback, arrived] = await Promise.all([
          page.waitForResponse((response) => response.url() === login && response.request().isNavigationRequest()),
          page.waitForResponse((response) => {
            const url = new URL(response.url())
            return url.origin + url.pathname === authority + "/oauth2/v2.0/authorize" && response.request().isNavigationRequest()
          }),
          page.waitForResponse((response) => {
            const url = new URL(response.url())
            return url.origin + url.pathname === f.binding.origin + f.binding.mount + "/auth/callback" && response.request().isNavigationRequest()
          }),
          page.goto(login, { waitUntil: "domcontentloaded" }),
        ])
        expect(begin.status()).toBe(303); expect(authorization.status()).toBe(303); expect(callback.status()).toBe(303)
        expect(arrived?.status()).toBe(200)
        await page.getByRole("heading", { name: "Component session ready", exact: true }).waitFor()
        // Public selection intent only. Browser cookies were issued and stored by
        // the real redirect chain; no cookie/token/lease is synthesized or injected.
        await page.context().setExtraHTTPHeaders({ "x-sf-team-profile": selector })
        return arrived
      } catch (error) {
        const current = URL.canParse(page.url()) ? new URL(page.url()) : undefined
        console.error("G04 Microsoft component login failed", { page: current ? { origin: current.origin, path: current.pathname } : undefined,
          connections: networks.flatMap((item) => item.calls), requests: transport.slice(-12) })
        throw error
      }
    }
    const request = (suffix = "/dashboard", cookie = f.cookie, init: RequestInit = {}) => {
      const headers = new Headers(init.headers)
      if (!headers.has("x-sf-team-profile")) headers.set("x-sf-team-profile", selector)
      if (init.method === "POST" && !headers.has("origin")) headers.set("origin", f.binding.origin)
      return f.request(suffix, cookie, { ...init, headers: Object.fromEntries(headers) })
    }
    const clientFetch = (address: string | URL, init: RequestInit = {}) => {
      const url = new URL(address)
      if (url.origin !== f.binding.origin || !url.pathname.startsWith(f.binding.mount + "/")) throw new Error("Component HTTP client requires its exact installed fixture origin")
      const headers = new Headers(init.headers)
      if (!headers.has("x-sf-team-profile")) headers.set("x-sf-team-profile", selector)
      // The fixed fixture CA and its certificate SAN authenticate the CONNECT
      // target without changing the original public URL/Host or disabling TLS.
      return fetch(url, { ...init, headers, proxy: network.proxy, tls: { ca: certificate, serverName: "pinned.example" } })
    }
    const createAuthority = (extra: Partial<Pick<ProductAuthorityOptions,
      "proposalCoverageWrites" | "dashboardHostWrites" | "commandIdentity" | "authorizeDocument">> = {}) =>
      createSfProductAuthority({ ...f.options, ...extra, environment, teamProfiles: boundary.profiles })
    return {
      ...f, origin: f.binding.origin, principalRef: oid, otherPrincipalRef: other, boundary, environment, clock, policy,
      persistence: f.persistence, routing, dispatch, mount, newContext, loginPage, request, fetch: clientFetch, productAuthority: createAuthority, setRole,
      async close() {
        if (disposed) return
        disposed = true
        const failures: unknown[] = []
        for (const item of networks) { try { await item.close() } catch (error) { failures.push(error) } }
        for (const context of contexts) { try { await context.close() } catch (error) { failures.push(error) } }
        try { await f.close() } catch (error) { failures.push(error) }
        if (failures.length) throw new AggregateError(failures, "Microsoft component fixture cleanup failed")
      },
    }
  } catch (error) {
    const failures: unknown[] = [error]
    for (const item of networks) { try { await item.close() } catch (failure) { failures.push(failure) } }
    try { await f.close() } catch (failure) { failures.push(failure) }
    throw failures.length === 1 ? error : new AggregateError(failures, "Microsoft component fixture setup failed")
  }
}
