import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { contributions, createModule } from "../index.ts"
import { serveRootShell } from "../runtime/root-shell.ts"
import type { Application } from "../runtime/application.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import { microsoftRequest, prepareMicrosoftInstallation } from "../runtime/microsoft-installation.ts"
import { group, microsoftFixture, oid } from "./microsoft-login/oidc-fixture.ts"
import { ingressOrigin, listenerOrigin, privateFixture, publicOrigin } from "./microsoft-login/private-fixture.ts"

test("first configured Microsoft member reaches all three HTML surfaces without an admin bootstrap", async () => {
  const disk = await privateFixture()
  let store: Awaited<ReturnType<typeof openLocalStore>> | undefined
  try {
    // The configuration is private owner input, not an identity asserted by HTTP.
    await writeFile(disk.file, JSON.stringify({
      ...disk.config,
      groups: { ...disk.config.groups, planner: { finance: `group:${group}` } },
    }), { mode: 0o600 })
    const provider = await microsoftFixture()
    const profile = await prepareMicrosoftInstallation(
      { origin: listenerOrigin }, disk.file, disk.environment,
      { fetch: provider.fetch, now: () => new Date(provider.clock.value) },
    )
    store = await openLocalStore(path.join(disk.directory, "business-microsoft"))
    const identity = profile.createIdentity(store.secrets)
    const environment: Application["environment"] = async (request) => ({
      at: new Date(provider.clock.value).toISOString(),
      id: randomUUID,
      directory: await identity.directory(request),
      bankKey: profile.loaded.keys.bank,
    })
    const app = createModule(disk.config.mount, {
      persistence: store, authenticate: identity.authenticate, environment,
      maxJsonBytes: 2 * 1024 * 1024,
    })
    const request = async (suffix: string, cookie?: string) => {
      const incoming = new Request(`${ingressOrigin}${disk.config.mount}${suffix}`, {
        headers: { host: new URL(ingressOrigin).host, ...(cookie ? { cookie } : {}) },
      })
      const trusted = microsoftRequest(incoming, profile.transport)
      if (!trusted) throw new Error("Synthetic ingress did not match configured transport")
      const auth = await identity.handle(trusted)
      if (auth) return auth
      await identity.prepare(trusted)
      return await app(trusted) ?? new Response("Not found", { status: 404 })
    }
    const anonymous = await request("/dashboard")
    expect(anonymous.status).toBe(303)
    expect(new URL(anonymous.headers.get("location")!, publicOrigin).pathname).toBe("/sucafina/auth/login")

    const login = await request("/auth/login")
    expect(login.status).toBe(303)
    const destination = login.headers.get("location")!
    const state = new URL(destination).searchParams.get("state")!
    const code = await provider.issueCode(destination, oid)
    const loginCookie = login.headers.getSetCookie().find((value) => value.includes("_login="))!.split(";")[0]!
    const callback = await request(`/auth/callback?state=${state}&code=${encodeURIComponent(code)}`, loginCookie)
    expect(callback.status).toBe(303)
    const cookie = callback.headers.getSetCookie().find((value) => value.includes("_session="))!.split(";")[0]!
    expect(cookie).toContain("__Secure-sucafina_")

    for (const surface of ["dashboard", "planner", "procurement"]) {
      const page = await serveRootShell(new Request(`${publicOrigin}/?surface=${surface}`, { headers: { cookie } }), {
        origin: publicOrigin,
        mount: disk.config.mount,
        application: { persistence: store, authenticate: identity.authenticate, environment, maxJsonBytes: 2 * 1024 * 1024, domains: contributions },
        dispatch: app,
      })
      expect(page?.status).toBe(200)
      expect(page?.headers.get("content-type")).toContain("text/html")
      expect(await page!.text()).toContain("<html")
    }
    // Live Graph membership is still rechecked, including for an already issued cookie.
    provider.account.groups.splice(0)
    for (const surface of ["dashboard", "planner", "procurement"]) {
      const denied = await serveRootShell(new Request(`${publicOrigin}/?surface=${surface}`, { headers: { cookie } }), {
        origin: publicOrigin,
        mount: disk.config.mount,
        application: { persistence: store, authenticate: identity.authenticate, environment, maxJsonBytes: 2 * 1024 * 1024, domains: contributions },
        dispatch: app,
      })
      expect(denied?.status).toBe(401)
      expect(await denied?.text()).toBe("Authentication required")
    }
  } finally {
    if (store) await store.dispose()
    await disk.close()
  }
})
