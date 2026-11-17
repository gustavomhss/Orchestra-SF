/**
 * T8 contract probes only; not proof of an installed/browser-authenticated shell.
 * Do not widen the operator cookie or manufacture an F01 grant.
 */
import { expect, test } from "bun:test"
import { randomBytes, randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createModule, contributions } from "../index.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import { createOperatorIdentity } from "../runtime/operator-identity.ts"
import { createSfContextHandler } from "../../../../apps/cli/src/sucafina-product/native-ui/context.ts"
import { createSfLiveContext, type SfLiveContextAdmission } from "../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts"
import { loadSfInstallation } from "../../../../apps/cli/src/sucafina-product/installation.ts"

const origin = "http://localhost:4110"
const mount = "/sucafina"
const binding: Readonly<{ installationId: string; projectId: string; hostId: string }> = Object.freeze({ installationId: "installation-one", projectId: "project-one", hostId: "host-one" })
const contextUrl = `${origin}${mount}/api/ui/context?${new URLSearchParams(binding).toString()}`

async function fixture() {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "t8-auth-frontier-"))
  const store = await openLocalStore(root)
  const clock = { value: 1_800_000_000_000 }
  const operator = { installationId: "12ec06d9-4201-4370-a3e9-e9a72f213dc9", uid: 501, name: "Fixture OS owner" }
  const identity = createOperatorIdentity({
    origin, mount, operator, secrets: store.secrets, key: randomBytes(32), now: () => new Date(clock.value),
  })
  const application = {
    persistence: store,
    authenticate: identity.authenticate,
    environment: async (_request: Request) => ({
      at: new Date(clock.value).toISOString(), id: randomUUID, directory: [],
    }),
    maxJsonBytes: 4096,
  }
  const module = createModule(mount, application)
  const enroll = async () => {
    const code = await identity.enroll()
    const response = await identity.handle(new Request(`${origin}${mount}/auth/local?code=${code}`))
    if (!response || response.status !== 303) throw new Error("Private enrollment was not admitted")
    const setCookie = response.headers.getSetCookie()[0]
    if (!setCookie) throw new Error("Private enrollment issued no cookie")
    return { response, setCookie, cookie: setCookie.split(";")[0]! }
  }
  return {
    clock, identity, module, application, enroll,
    dispose: async () => { await store.dispose(); await rm(root, { recursive: true, force: true }) },
  }
}

test("T8: 303 to root never widens the operator's path-scoped cookie or authenticates root implicitly", async () => {
  const f = await fixture()
  try {
    const login = await f.enroll()
    expect(login.response.headers.get("location")).toBe("/")
    expect(login.setCookie).toContain("Path=/sucafina;")
    expect(login.setCookie).toContain("HttpOnly")
    expect(login.setCookie).toContain("SameSite=Lax")
    expect(login.setCookie).not.toMatch(/(?:^|;\s*)Path=\/(?:;|$)/)
    expect(login.response.headers.has("Access-Control-Allow-Origin")).toBe(false)
    // The browser does not send a Path=/sucafina cookie on GET /.
    expect(await f.identity.person(new Request(origin + "/"))).toBeNull()
    const admitted = new Request(origin + mount + "/dashboard", { headers: { cookie: login.cookie } })
    expect((await f.identity.person(admitted))?.id).toBe("macos:12ec06d9-4201-4370-a3e9-e9a72f213dc9:501")
    expect(await f.identity.person(new Request("http://127.0.0.1:4110/sucafina/dashboard", {
      headers: { cookie: login.cookie },
    }))).toBeNull()
    expect(await f.identity.person(new Request(origin + mount + "/dashboard", {
      headers: { cookie: login.cookie + "; " + login.cookie },
    }))).toBeNull()
  } finally { await f.dispose() }
})

test("T8: no session / eight-hour expiry / durable logout all stay 401; wrong Origin stays 403", async () => {
  const f = await fixture()
  try {
    const page = (cookie?: string) => new Request(origin + mount + "/dashboard", {
      headers: cookie ? { cookie } : undefined,
    })
    expect((await f.module(page()))?.status).toBe(401)
    const first = await f.enroll()
    const csrf = new Request(origin + mount + "/dashboard", {
      method: "POST", headers: { cookie: first.cookie, origin: "https://untrusted.example" },
      body: "{}",
    })
    expect((await f.module(csrf))?.status).toBe(403)
    f.clock.value += 28_800_000
    expect(await f.identity.person(page(first.cookie))).toBeNull()
    expect((await f.module(page(first.cookie)))?.status).toBe(401)

    const next = await f.enroll()
    const logout = (headerOrigin: string) => f.identity.handle(new Request(origin + mount + "/auth/logout", {
      method: "POST", headers: { cookie: next.cookie, origin: headerOrigin },
    }))
    expect((await logout("https://untrusted.example"))?.status).toBe(403)
    expect(await f.identity.person(page(next.cookie))).not.toBeNull()
    const loggedOut = await logout(origin)
    expect(loggedOut?.status).toBe(204)
    expect(loggedOut?.headers.getSetCookie()[0]).toContain("Path=/sucafina;")
    expect(loggedOut?.headers.getSetCookie()[0]).toContain("Max-Age=0")
    expect((await f.module(page(next.cookie)))?.status).toBe(401)
  } finally { await f.dispose() }
})

test("T8: a missing installed F01 owner remains 503, not a synthetic identity or ready context", async () => {
  const f = await fixture()
  try {
    const context = createSfContextHandler({
      origin, mount, application: { ...f.application, domains: contributions },
      runtime: () => undefined,
    })
    const response = await context.handle(new Request(contextUrl))
    expect(response.status).toBe(503)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toEqual({ status: "unavailable", reason: "host-unavailable" })
  } finally { await f.dispose() }
})

test("T8: changing the current installation during authority read discards its stale answer", async () => {
  let current = binding
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const request = new Request(contextUrl)
  const live = createSfLiveContext({
    origin, mount, currentBinding: () => current,
    admit: async (received): Promise<SfLiveContextAdmission> => {
      expect(received).toBe(request)
      entered.resolve()
      await release.promise
      return { status: "unauthenticated" }
    },
  })
  const pending = live.readContext(request, binding)
  await entered.promise
  current = Object.freeze({ ...binding, installationId: "installation-stale" })
  release.resolve()
  expect(await pending).toEqual({ status: "unavailable", reason: "contract-mismatch" })
})

test("T8: owner-selected factory loader rejects relative paths and noncanonical origins before import", async () => {
  await expect(loadSfInstallation("not-an-owner-selected-factory.ts", origin))
    .rejects.toThrow("SF_INSTALLATION_ABSOLUTE_PATH_AND_ORIGIN_REQUIRED")
  await expect(loadSfInstallation("/tmp/not-an-owner-selected-factory.ts", origin + "/sucafina"))
    .rejects.toThrow("SF_INSTALLATION_ABSOLUTE_PATH_AND_ORIGIN_REQUIRED")
})
