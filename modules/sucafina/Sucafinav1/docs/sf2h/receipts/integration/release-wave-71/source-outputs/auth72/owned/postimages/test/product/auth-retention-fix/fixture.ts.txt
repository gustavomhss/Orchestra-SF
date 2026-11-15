import { afterEach, expect } from "bun:test"
import { Database } from "bun:sqlite"
import { createHash, randomBytes } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createMicrosoftIdentity } from "../../../runtime/local-identity.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { LocalIdentity, LocalSecrets } from "../../../runtime/local-contract.ts"
import { clientId, group, microsoftFixture, tenant } from "../../microsoft-login/oidc-fixture.ts"

export const origin = "https://retention.synthetic.example"
export const mount = "/sucafina"
export const context = { surface: "planner" as const, roleMap: [
  { surface: "planner" as const, role: "viewer", entra: `group:${group}`, version: 0, by: "synthetic-owner" },
] }
const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup() })

type AuthenticationLimits = NonNullable<Parameters<typeof openLocalStore>[1]>["authentication"]

export async function retentionFixture(input: { sessionSeconds?: number; loginSeconds?: number; tokenSeconds?: number; authentication?: AuthenticationLimits; lockTimeoutMs?: number } = {}) {
  const provider = await microsoftFixture({ tokenSeconds: input.tokenSeconds })
  const directory = await mkdtemp(join(tmpdir(), "sf-auth-retention-"))
  cleanups.push(() => rm(directory, { recursive: true, force: true }))
  const open = async (authentication?: AuthenticationLimits) => {
    const store = await openLocalStore(directory, { ...(authentication ? { authentication } : {}),
      ...(input.lockTimeoutMs !== undefined ? { lockTimeoutMs: input.lockTimeoutMs } : {}) })
    cleanups.push(() => store.dispose())
    return store
  }
  const store = await open(input.authentication)
  const options = { origin, mount, tenantId: tenant, clientId, client: provider.client, secrets: store.secrets,
    key: randomBytes(32), now: () => new Date(provider.clock.value), sessionSeconds: input.sessionSeconds, loginSeconds: input.loginSeconds }
  const identity = createMicrosoftIdentity(options)
  const makeIdentity = (secrets: LocalSecrets = store.secrets, lifetimes: { sessionSeconds?: number; loginSeconds?: number } = {}) => createMicrosoftIdentity({ ...options, secrets, ...lifetimes })
  const request = (path: string, cookies?: string, init: RequestInit = {}) => new Request(`${origin}${mount}${path}`, {
    ...init, headers: { ...(cookies ? { cookie: cookies } : {}), ...Object.fromEntries(new Headers(init.headers)) },
  })
  const start = async (target: LocalIdentity = identity) => {
    const response = await target.handle(request("/auth/login"))
    expect(response?.status).toBe(303)
    const destination = response!.headers.get("location")!
    const state = new URL(destination).searchParams.get("state")!
    const code = await provider.issueCode(destination)
    const loginCookie = response!.headers.getSetCookie().find((cookie) => cookie.includes("_login="))!.split(";")[0]
    const callbackRequest = () => request(`/auth/callback?state=${state}&code=${encodeURIComponent(code)}`, loginCookie)
    return { response: response!, state, code, loginCookie, callbackRequest, callback: (consumer: LocalIdentity = target) => consumer.handle(callbackRequest()) }
  }
  const login = async (target: LocalIdentity = identity) => {
    const begun = await start(target)
    const response = await begun.callback()
    expect(response?.status).toBe(303)
    const sessionCookie = response!.headers.getSetCookie().find((cookie) => cookie.includes("_session="))!.split(";")[0]
    return { ...begun, response: response!, sessionCookie }
  }
  const logout = (cookies: string, target: LocalIdentity = identity) => target.handle(request("/auth/logout", cookies, { method: "POST", headers: { origin } }))
  const payloadCounts = () => {
    const db = new Database(join(directory, "installation.sqlite"), { readonly: true, strict: true })
    try {
      return db.query<{ rows: number; bytes: number; sessions: number }, []>("SELECT count(*) AS rows, coalesce(sum(length(payload)), 0) AS bytes, coalesce(sum(key LIKE '%:session:%'), 0) AS sessions FROM authentication_payloads").get()!
    } finally { db.close() }
  }
  const authenticationRows = () => {
    const db = new Database(join(directory, "installation.sqlite"), { readonly: true, strict: true })
    try {
      const tables = db.query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'authentication_%' ORDER BY name").all()
      return Object.fromEntries(tables.map(({ name }) => {
        if (!/^authentication_[a-z_]+$/.test(name)) throw new Error("Unexpected authentication table name")
        return [name, db.query<{ rows: number }, []>(`SELECT count(*) AS rows FROM ${name}`).get()!.rows]
      }))
    } finally { db.close() }
  }
  const storageKey = (kind: "login" | "session", handle: string) => {
    const namespace = createHash("sha256").update(JSON.stringify([origin, mount, "microsoft", tenant, clientId])).digest("hex")
    return `${namespace}:${kind}:${createHash("sha256").update(handle).digest("hex")}`
  }
  return { provider, directory, store, auth: store.secrets.authentication!, options, identity, makeIdentity, open, request, start, login, logout, payloadCounts, authenticationRows, storageKey }
}

export function cookieHandle(cookie: string) { return cookie.slice(cookie.indexOf("=") + 1) }

export async function within<T>(promise: Promise<T>, milliseconds = 2000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Timed out waiting for authentication lifecycle")), milliseconds)
    })])
  } finally { clearTimeout(timer) }
}

export function barrier() {
  const entered = Promise.withResolvers<void>()
  const released = Promise.withResolvers<void>()
  return { entered: entered.promise, release: () => released.resolve(), hold: () => { entered.resolve(); return released.promise } }
}

export function noSessionCookie(response: Response | undefined) {
  expect(response?.status).toBe(403)
  expect(response!.headers.getSetCookie().some((cookie) => cookie.includes("_session=") && !cookie.includes("Max-Age=0"))).toBe(false)
}
