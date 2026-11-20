import { expect, test } from "bun:test"
import path from "node:path"
import { Schema } from "effect"
import { SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { expectSpawn } from "../../../../../packages/core/test/fixture/omni-expect.ts"
import { launchBrowserDriver } from "../product/wp02/browser-driver-fixture.ts"
import { teamContextFixture } from "./context-fixture.ts"
import { profileA, teamRow } from "./installation-fixture.ts"
import type { BrowserContext } from "@playwright/test"

type Client = typeof import("./web-client.ts")

test("Teams Web F02 uses real Chromium, signed session, fixed native routes and independent administration", async () => {
  expectSpawn(import.meta.path)
  const compiled = await Bun.build({
    entrypoints: [path.join(import.meta.dir, "web-client.ts")],
    target: "browser", format: "esm", splitting: false,
  })
  if (!compiled.success || compiled.outputs.length !== 1) throw new AggregateError(compiled.logs, "Product client browser bundle failed")
  const bundle = await compiled.outputs[0]!.text()
  const f = await teamContextFixture()
  const admin = await teamContextFixture({ roles: false, grants: [], enabled: [], direct: [] })
  admin.provider.teamResources.set(profileA.teamObjectId, teamRow())
  let driver: Awaited<ReturnType<typeof launchBrowserDriver>> | undefined
  const contexts: BrowserContext[] = []
  const observed: { path: string; cookie: boolean; selector: string | null; origin: string | null }[] = []
  let passed = false
  try {
    driver = await launchBrowserDriver("teams-web-transport")
    const open = async (fixture: typeof f, kind: "team" | "administration") => {
      const browser = await driver!.browser.newContext()
      contexts.push(browser)
      const separator = fixture.cookie.indexOf("=")
      await browser.addCookies([{
        name: fixture.cookie.slice(0, separator), value: fixture.cookie.slice(separator + 1),
        domain: new URL(fixture.binding.origin).hostname, path: fixture.binding.mount,
        httpOnly: true, secure: true, sameSite: "Lax",
      }])
      await browser.route("**/*", async (route) => {
        const wire = route.request()
        const url = new URL(wire.url())
        if (url.origin !== fixture.binding.origin) { await route.abort(); return }
        if (url.pathname === fixture.binding.mount + "/test-client.js") {
          await route.fulfill({ status: 200, contentType: "text/javascript; charset=utf-8", body: bundle })
          return
        }
        if (url.pathname === fixture.binding.mount + "/") {
          await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8",
            body: "<!doctype html><html><body><main>Teams transport qualification</main></body></html>" })
          return
        }
        const headers = await wire.allHeaders()
        const request = new Request(wire.url(), {
          method: wire.method(), headers,
          ...(["GET", "HEAD"].includes(wire.method()) ? {} : { body: wire.postDataBuffer() }),
        })
        observed.push({ path: url.pathname, cookie: request.headers.has("cookie"),
          selector: request.headers.get("x-sf-team-profile"), origin: request.headers.get("origin") })
        // This is the controlled browser/server HTTP boundary. Once constructed,
        // the same Request reaches the actual identity, resolver, F02 and domain producer.
        const response = await fixture.handle(request)
        await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers),
          body: Buffer.from(await response.arrayBuffer()) })
      })
      const page = await browser.newPage()
      await page.goto(fixture.binding.origin + fixture.binding.mount + "/")
      const { location, ...placement } = fixture.technical
      const installed = Schema.decodeUnknownSync(SfTeamInstallationDescriptor)({
        ...placement, tenantId: fixture.binding.tenantId,
        publicOrigin: fixture.binding.origin, mount: fixture.binding.mount,
        contractRevision: "sf-team-profile/1", authMode: "microsoft",
      })
      const selector = kind === "team" ? { contractRevision: "sf-team-profile/1", kind, profile: profileA } :
        { contractRevision: "sf-team-profile/1", kind, installationId: fixture.binding.installationId, tenantId: fixture.binding.tenantId }
      const moduleUrl = fixture.binding.origin + fixture.binding.mount + "/test-client.js"
      await page.evaluate(async ({ moduleUrl, installed, selector }) => {
        const client: Client = await import(moduleUrl)
        client.open({ descriptor: installed, selector })
      }, { moduleUrl, installed, selector })
      return { page, moduleUrl }
    }

    const human = await open(f, "team")
    expect(await human.page.evaluate(() => document.cookie)).toBe("")
    const current = await human.page.evaluate(async (url) => {
      const client: Client = await import(url)
      return client.readContext()
    }, human.moduleUrl)
    expect(current.kind).toBe("response")
    if (current.kind !== "response" || current.body.status !== "ok") throw new Error("Current Web corporate context required")
    expect(current.status).toBe(200)
    expect(current.body.value.stamp.team?.owner.profile).toEqual(profileA)
    expect(current.body.value.stamp.team?.revisions.accessRevision).toBe(current.body.value.profile.accessRevision)
    const domain = await human.page.evaluate(async (url) => {
      const client: Client = await import(url)
      return client.readPage()
    }, human.moduleUrl)
    expect(domain.kind).toBe("response")
    if (domain.kind !== "response") throw new Error("Original native domain response required")
    expect(domain.status).toBe(200)
    expect(domain.body.status).toBe("ok")
    expect(observed.some((entry) => entry.path.endsWith("/api/ui/pages/CAP01") && entry.cookie &&
      entry.selector === JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: profileA }))).toBe(true)
    expect(observed.filter((entry) => entry.path.endsWith("/api/ui/context")).every((entry) => entry.selector === null && entry.cookie)).toBe(true)

    const unauthorized = await human.page.evaluate(async (mount) => {
      const response = await fetch(mount + "/api/ui/pages/CAP01", { credentials: "same-origin" })
      return { status: response.status, body: await response.json() }
    }, f.binding.mount)
    expect(unauthorized.status).toBe(403)
    expect(unauthorized.body.status).not.toBe("ok")
    await human.page.evaluate(async () => { await fetch("/outside-cookie-scope") })
    expect(observed.find((entry) => entry.path === "/outside-cookie-scope")?.cookie).toBe(false)

    const owner = await open(admin, "administration")
    const initial = await owner.page.evaluate(async (url) => {
      const client: Client = await import(url)
      return { context: await client.readContext(), profiles: await client.listProfiles() }
    }, owner.moduleUrl)
    expect(initial.context.kind).toBe("response")
    if (initial.context.kind !== "response" || initial.context.body.status !== "ok") throw new Error("Authenticated admin context required")
    expect(initial.context.body.value.profile.administration.status).toBe("available")
    expect(initial.context.body.value.profile.teams.status).toBe("no-teams")
    expect(initial.context.body.value.stamp.team).toBeUndefined()
    expect(initial.context.body.value.destinations).toEqual([])
    expect(initial.profiles).toMatchObject({ kind: "response", status: 200, body: { status: "ok", configRevision: 0, profiles: [] } })
    const enabled = await owner.page.evaluate(async ({ url, profile }) => {
      const client: Client = await import(url)
      return client.configureProfile({ action: "enable", profile, expectedRevision: 0 })
    }, { url: owner.moduleUrl, profile: profileA })
    expect(enabled).toMatchObject({ kind: "response", status: 200, body: { status: "ok", configRevision: 1, changed: true } })
    expect((await admin.profiles.read()).profiles).toEqual([{ profile: profileA, enabled: true }])
    expect(observed.some((entry) => entry.path.endsWith("/api/ui/team-profiles") && entry.origin === admin.binding.origin &&
      entry.cookie && entry.selector === null)).toBe(true)
    const deniedBusiness = await owner.page.evaluate(async (url) => {
      const client: Client = await import(url)
      return client.readPage()
    }, owner.moduleUrl)
    expect(deniedBusiness).toEqual({ kind: "transport-error", reason: "contract-unavailable" })

    await f.logout(f.cookie)
    const revoked = await human.page.evaluate(async (url) => {
      const client: Client = await import(url)
      return { context: await client.readContext(), page: await client.readPage() }
    }, human.moduleUrl)
    expect(revoked.context).toMatchObject({ kind: "response", status: 401, body: { status: "unauthenticated" } })
    expect(revoked.page).toEqual({ kind: "transport-error", reason: "contract-unavailable" })
    passed = true
  } finally {
    const closed = await Promise.allSettled(contexts.map((context) => context.close()))
    const driverClosed = await Promise.allSettled([driver?.close()])
    const fixturesClosed = await Promise.allSettled([f.close(), admin.close()])
    const errors = [...closed, ...driverClosed, ...fixturesClosed].flatMap((entry) => entry.status === "rejected" ? [entry.reason] : [])
    if (errors.length) throw new AggregateError(errors, "Teams Web transport cleanup failed")
  }
  if (passed) driver?.report()
}, 30000)
