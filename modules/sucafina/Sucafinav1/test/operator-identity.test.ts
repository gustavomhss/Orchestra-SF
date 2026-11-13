import { expect, test } from "bun:test"
import { createHash, randomBytes } from "node:crypto"
import { chmod, mkdtemp, realpath, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createOperatorIdentity } from "../runtime/operator-identity.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import type { OperatorOptions } from "../runtime/operator-contract.ts"
import type { LocalSecrets } from "../runtime/local-contract.ts"

const origin = "http://localhost:4110"
const mount = "/sucafina"
const operator = { installationId: "0fe3ac10-c944-4eb6-8812-c67f5202a32f", uid: 501, name: "Actual OS Operator" }
const profile = { id: `macos:${operator.installationId}:${operator.uid}`, name: operator.name }
const slot = (kind: string, value: string) => `operator-${kind}:${createHash("sha256").update(value).digest("hex")}`
const request = (path: string, cookie = "", init: RequestInit = {}) => new Request(`${origin}${mount}${path}`, { ...init, headers: { cookie, ...init.headers } })

async function fixture(work: (f: Awaited<ReturnType<typeof setup>>) => Promise<void>) {
  const root = await mkdtemp(join(await realpath(tmpdir()), "operator-identity-"))
  await chmod(root, 0o700)
  const store = await openLocalStore(root)
  try { await work(await setup(store.secrets, root)) }
  finally { await store.dispose(); await rm(root, { recursive: true, force: true }) }
}

async function setup(secrets: LocalSecrets, root: string) {
  const clock = { value: 1800000000000 }
  const options: OperatorOptions = { origin, mount, operator, key: randomBytes(32), secrets, now: () => new Date(clock.value) }
  const identity = createOperatorIdentity(options)
  const enroll = async () => {
    const code = await identity.enroll()
    const response = await identity.handle(request(`/auth/local?code=${code}`))
    expect(response?.status).toBe(303)
    const header = response!.headers.getSetCookie()[0]!
    const cookie = header.split(";")[0]!
    const handle = cookie.slice(cookie.indexOf("=") + 1)
    return { code, response: response!, header, cookie, handle }
  }
  return { options, identity, clock, secrets, root, enroll }
}

test("local helper issues encrypted single-use credentials and scoped opaque eight-hour sessions", async () => {
  await fixture(async (f) => {
    expect((await stat(f.root)).mode & 0o777).toBe(0o700)
    expect((await stat(join(f.root, "installation.sqlite"))).mode & 0o777).toBe(0o600)
    const code = await f.identity.enroll()
    expect(code).toMatch(/^[a-f0-9]{64}$/)
    const encrypted = await f.secrets.get(slot("enroll", code), f.clock.value)
    expect(encrypted).toBeDefined()
    expect(Buffer.from(encrypted!).toString()).not.toContain(operator.name)
    expect(Buffer.from(encrypted!).toString()).not.toContain(code)
    const responses = await Promise.all([f.identity.handle(request(`/auth/local?code=${code}`)), f.identity.handle(request(`/auth/local?code=${code}`))])
    expect(responses.map((r) => r?.status).sort()).toEqual([303, 403])
    expect(await f.secrets.get(slot("enroll", code), f.clock.value)).toBeUndefined()
    const response = responses.find((r) => r?.status === 303)!
    const header = response.headers.getSetCookie()[0]!
    expect(header).toContain(`Path=${mount}`)
    expect(header).toContain("HttpOnly")
    expect(header).toContain("SameSite=Lax")
    expect(header).toContain("Max-Age=28800")
    expect(response.headers.get("cache-control")).toBe("no-store")
    const cookie = header.split(";")[0]!
    const handle = cookie.slice(cookie.indexOf("=") + 1)
    expect(handle).toMatch(/^[a-f0-9]{64}$/)
    expect(handle).not.toBe(code)
    const stored = await f.secrets.get(slot("session", handle), f.clock.value)
    expect(stored).toBeDefined()
    expect(Buffer.from(stored!).toString()).not.toContain(profile.id)
    expect(await f.identity.person(request("/planner", cookie))).toEqual(profile)
    expect(await f.identity.directory(request("/planner", cookie))).toEqual([profile])
  })
})

test("authentication grants only the selected local surface and performs only secret reads", async () => {
  await fixture(async (f) => {
    const login = await f.enroll()
    const readonly: LocalSecrets = {
      get: f.secrets.get,
      async put() { throw new Error("authentication wrote a credential") },
      async take() { throw new Error("authentication consumed a credential") },
      async remove() { throw new Error("authentication removed a credential") },
    }
    const identity = createOperatorIdentity({ ...f.options, secrets: readonly })
    for (const surface of ["dashboard", "planner", "procurement"] as const) {
      expect(await identity.authenticate(request(`/${surface}`, login.cookie), { surface, roleMap: [] })).toEqual({ id: profile.id, canWrite: true, roles: [{ surface, role: "admin" }] })
    }
    expect(await identity.authenticate(request("/planner", login.cookie))).toBeNull()
    expect(await identity.authenticate(request("/planner"), { surface: "planner", roleMap: [] })).toBeNull()
    expect(await identity.person(request("/planner"))).toBeNull()
    expect(await identity.directory(request("/planner"))).toEqual([])
    await identity.prepare(request("/planner", login.cookie))
    // This exercises lookup under the same SQLite transaction boundary as business authentication.
    const store = await openLocalStore(f.root)
    try {
      await store.transaction("planner", async () => ({ commit: false, value: await identity.authenticate(request("/planner", login.cookie), { surface: "planner", roleMap: [] }) }))
    } finally { await store.dispose() }
  })
})

test("expired credentials fail even when their storage expiry is extended", async () => {
  await fixture(async (f) => {
    const code = await f.identity.enroll()
    const key = slot("enroll", code)
    const value = (await f.secrets.get(key, f.clock.value))!
    await f.secrets.put(key, value, f.clock.value + 999999999)
    f.clock.value += 600000
    expect((await f.identity.handle(request(`/auth/local?code=${code}`)))?.status).toBe(403)
    const login = await f.enroll()
    const sessionKey = slot("session", login.handle)
    await f.secrets.put(sessionKey, (await f.secrets.get(sessionKey, f.clock.value))!, f.clock.value + 999999999)
    f.clock.value += 28800000
    expect(await f.identity.person(request("/planner", login.cookie))).toBeNull()
  })
})

test("tampering, AAD record relocation, wrong keys and changed operator identities fail closed", async () => {
  await fixture(async (f) => {
    const login = await f.enroll()
    for (const changed of [{ ...operator, uid: 502 }, { ...operator, installationId: "1fe3ac10-c944-4eb6-8812-c67f5202a32f" }]) {
      const other = createOperatorIdentity({ ...f.options, operator: changed })
      expect(await other.person(request("/planner", login.cookie))).toBeNull()
      const code = await f.identity.enroll()
      expect((await other.handle(request(`/auth/local?code=${code}`)))?.status).toBe(403)
    }
    expect(await createOperatorIdentity({ ...f.options, key: randomBytes(32) }).person(request("/planner", login.cookie))).toBeNull()
    const key = slot("session", login.handle)
    const bytes = (await f.secrets.get(key, f.clock.value))!
    const alternate = randomBytes(32).toString("hex")
    await f.secrets.put(slot("session", alternate), bytes, f.clock.value + 28800000)
    expect(await f.identity.person(request("/planner", login.cookie.replace(login.handle, alternate)))).toBeNull()
    bytes[bytes.length - 1] ^= 1
    await f.secrets.put(key, bytes, f.clock.value + 28800000)
    expect(await f.identity.person(request("/planner", login.cookie))).toBeNull()
    const code = await f.identity.enroll()
    const enrollKey = slot("enroll", code)
    const credential = (await f.secrets.get(enrollKey, f.clock.value))!
    credential[credential.length - 1] ^= 1
    await f.secrets.put(enrollKey, credential, f.clock.value + 600000)
    expect((await f.identity.handle(request(`/auth/local?code=${code}`)))?.status).toBe(403)
  })
})

test("auth routing has no HTTP enrollment grant and requires the configured origin", async () => {
  await fixture(async (f) => {
    const code = await f.identity.enroll()
    for (const path of ["/auth/local", "/auth/local?code=bad", `/auth/local?code=${"0".repeat(64)}`])
      expect((await f.identity.handle(request(path)))?.status).toBe(403)
    expect((await f.identity.handle(request(`/auth/local?code=${code}`, "", { method: "POST" })))?.status).toBe(405)
    expect((await f.identity.handle(new Request(`http://127.0.0.1:4110${mount}/auth/local?code=${code}`)))?.status).toBe(403)
    const login = await f.identity.handle(request("/auth/login"))
    expect(login?.status).toBe(200)
    expect(await login!.text()).toMatch(/local|operator|operador/i)
    expect(login!.headers.getSetCookie()).toEqual([])
    expect((await f.identity.handle(request("/auth/enroll")))?.status).toBe(404)
    expect((await f.identity.handle(request("/auth/unknown")))?.status).toBe(404)
    expect(await f.identity.handle(request("/planner"))).toBeUndefined()
    expect((await f.identity.handle(request(`/auth/local?code=${code}`)))?.status).toBe(303)
  })
})

test("logout requires exact Origin and POST, persists revocation before removing and rejects replay", async () => {
  await fixture(async (f) => {
    const login = await f.enroll()
    expect((await f.identity.handle(request("/auth/logout", login.cookie)))?.status).toBe(405)
    for (const headers of [new Headers(), new Headers({ origin: "http://attacker.example" }), new Headers({ origin, "sec-fetch-site": "cross-site" })])
      expect((await f.identity.handle(request("/auth/logout", login.cookie, { method: "POST", headers: Object.fromEntries(headers) })))?.status).toBe(403)
    const key = slot("session", login.handle)
    const stale = (await f.secrets.get(key, f.clock.value))!
    const writes: string[] = []
    const identity = createOperatorIdentity({ ...f.options, secrets: {
      ...f.secrets,
      async put(key, value, expires) { writes.push(key); await f.secrets.put(key, value, expires) },
      async remove(key) { expect(writes.length).toBeGreaterThan(0); expect(writes[0]).not.toBe(key); await f.secrets.remove(key) },
    } })
    const response = await identity.handle(request("/auth/logout", login.cookie, { method: "POST", headers: { origin } }))
    expect(response?.status).toBe(204)
    expect(response!.headers.getSetCookie().join(";")).toContain("Max-Age=0")
    expect(await f.identity.person(request("/planner", login.cookie))).toBeNull()
    // A stale reader or future refresh cannot resurrect a durably revoked handle.
    await f.secrets.put(key, stale, f.clock.value + 28800000)
    expect(await f.identity.person(request("/planner", login.cookie))).toBeNull()
  })
})

test("cookie namespace isolates mounts and operators, malformed or duplicate handles fail closed", async () => {
  await fixture(async (f) => {
    const login = await f.enroll()
    for (const cookie of [login.cookie.replace(login.handle, "bad"), `${login.cookie}; ${login.cookie}`])
      expect(await f.identity.person(request("/planner", cookie))).toBeNull()
    for (const options of [{ ...f.options, mount: "/other" }, { ...f.options, operator: { ...operator, uid: 502 } }]) {
      const other = createOperatorIdentity(options)
      const code = await other.enroll()
      const response = await other.handle(new Request(`${origin}${options.mount}/auth/local?code=${code}`))
      expect(response?.status).toBe(303)
      expect(response!.headers.getSetCookie()[0]!.split("=")[0]).not.toBe(login.cookie.split("=")[0])
    }
  })
})

test("configuration rejects non-loopback or noncanonical origins, malformed mounts, keys and OS identities", async () => {
  await fixture(async (f) => {
    for (const origin of ["https://localhost:4110", "http://example.com", "http://localhost:4110/", "http://localhost:4110/path", "http://user@localhost:4110", "http://localhost:4110?x=1"])
      expect(() => createOperatorIdentity({ ...f.options, origin })).toThrow()
    for (const mount of ["/", "/bad/", "/a/../b", "/a b", "relative"])
      expect(() => createOperatorIdentity({ ...f.options, mount })).toThrow()
    for (const key of [randomBytes(31), randomBytes(33)])
      expect(() => createOperatorIdentity({ ...f.options, key })).toThrow()
    for (const changed of [{ ...operator, uid: -1 }, { ...operator, uid: 1.5 }, { ...operator, uid: NaN }, { ...operator, installationId: "invalid" }, { ...operator, name: " " }])
      expect(() => createOperatorIdentity({ ...f.options, operator: changed })).toThrow()
    for (const origin of ["http://127.0.0.1:4110", "http://[::1]:4110"])
      expect(() => createOperatorIdentity({ ...f.options, origin, operator: { ...operator, uid: 0 } })).not.toThrow()
  })
})

test("logout wins when an authentication read was already in flight", async () => {
  await fixture(async (f) => {
    const login = await f.enroll()
    const ready = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const identity = createOperatorIdentity({ ...f.options, secrets: {
      ...f.secrets,
      async get(key, at) {
        const bytes = await f.secrets.get(key, at)
        if (key === slot("session", login.handle)) {
          ready.resolve()
          await release.promise
        }
        return bytes
      },
    } })
    const pending = identity.authenticate(request("/planner", login.cookie), { surface: "planner", roleMap: [] })
    try {
      await ready.promise
      expect((await f.identity.handle(request("/auth/logout", login.cookie, { method: "POST", headers: { origin } })))?.status).toBe(204)
    } finally { release.resolve() }
    expect(await pending).toBeNull()
  })
})

test("empty or unsupported runtime contexts fail closed without consulting group maps", async () => {
  await fixture(async (f) => {
    const login = await f.enroll()
    const authenticated = request("/planner", login.cookie)
    // Exercise untyped adapter input at the runtime boundary without weakening the production contract.
    expect(await f.identity.authenticate(authenticated, {} as Parameters<typeof f.identity.authenticate>[1])).toBeNull()
    expect(await f.identity.authenticate(authenticated, { surface: "other", roleMap: [] } as unknown as Parameters<typeof f.identity.authenticate>[1])).toBeNull()
    expect(await f.identity.authenticate(authenticated, {
      surface: "planner",
      get roleMap(): never { throw new Error("Local operators must not resolve Entra groups") },
    })).toEqual({ id: profile.id, canWrite: true, roles: [{ surface: "planner", role: "admin" }] })
  })
})

test("private file enrollment allows cross-site GET but redirects without credentials and suppresses referrers", async () => {
  await fixture(async (f) => {
    const code = await f.identity.enroll()
    const response = await f.identity.handle(request(`/auth/local?code=${code}`, "", { headers: { origin: "null", "sec-fetch-site": "cross-site" } }))
    expect(response?.status).toBe(303)
    expect(response!.headers.get("location")).toBe(`${mount}/dashboard`)
    const cookie = response!.headers.getSetCookie()[0]!.split(";")[0]!
    const handle = cookie.slice(cookie.indexOf("=") + 1)
    const body = await response!.text()
    for (const secret of [code, handle]) {
      expect(response!.headers.get("location")!).not.toContain(secret)
      expect(body).not.toContain(secret)
    }
    expect(await f.identity.person(request("/dashboard", cookie))).toEqual(profile)
    const responses = [response,
      await f.identity.handle(request("/auth/login")),
      await f.identity.handle(request(`/auth/local?code=${code}`)),
      await f.identity.handle(request("/auth/unknown")),
      await f.identity.handle(request("/auth/local", "", { method: "POST" })),
      await f.identity.handle(new Request(`http://127.0.0.1:4110${mount}/auth/login`)),
      await f.identity.handle(request("/auth/logout", cookie, { method: "POST" })),
      await f.identity.handle(request("/auth/logout", cookie, { method: "POST", headers: { origin } })),
    ]
    for (const response of responses) expect(response?.headers.get("referrer-policy")).toBe("no-referrer")
  })
})

test("valid local cookies cannot authenticate a foreign request URL or inherit corporate roles", async () => {
  await fixture(async (f) => {
    const login = await f.enroll()
    const context = { surface: "planner" as const, roleMap: [
      { surface: "dashboard" as const, role: "admin", entra: "Corporate Administrators", version: 0, by: "corporate" },
      { surface: "planner" as const, role: "finance", entra: "Corporate Finance", version: 0, by: "corporate" },
      { surface: "procurement" as const, role: "approver", entra: "Corporate Approvers", version: 0, by: "corporate" },
    ] }
    expect(await f.identity.authenticate(request("/planner", login.cookie), context)).toEqual({ id: profile.id, canWrite: true, roles: [{ surface: "planner", role: "admin" }] })
    for (const foreign of ["http://attacker.example", "http://127.0.0.1:4110", "http://localhost:4111", "https://localhost:4110"]) {
      const incoming = new Request(`${foreign}${mount}/planner`, { headers: { cookie: login.cookie } })
      expect(await f.identity.person(incoming)).toBeNull()
      expect(await f.identity.authenticate(incoming, context)).toBeNull()
    }
  })
})

test("enrollment and session remain valid until one millisecond before their exact TTL boundary", async () => {
  await fixture(async (f) => {
    const code = await f.identity.enroll()
    const expiringCode = await f.identity.enroll()
    f.clock.value += 600000 - 1
    const response = await f.identity.handle(request(`/auth/local?code=${code}`))
    expect(response?.status).toBe(303)
    const cookie = response!.headers.getSetCookie()[0]!.split(";")[0]!
    const sessionStart = f.clock.value
    expect(await f.identity.person(request("/planner", cookie))).toEqual(profile)
    f.clock.value += 1
    expect((await f.identity.handle(request(`/auth/local?code=${expiringCode}`)))?.status).toBe(403)
    f.clock.value = sessionStart + 28800000 - 1
    expect(await f.identity.person(request("/planner", cookie))).toEqual(profile)
    expect(await f.identity.authenticate(request("/planner", cookie), { surface: "planner", roleMap: [] })).toEqual({ id: profile.id, canWrite: true, roles: [{ surface: "planner", role: "admin" }] })
    f.clock.value += 1
    expect(await f.identity.person(request("/planner", cookie))).toBeNull()
    expect(await f.identity.authenticate(request("/planner", cookie), { surface: "planner", roleMap: [] })).toBeNull()
  })
})


test("explicit local buyer policy grants buyer only on Procurement and never changes the identity", async () => {
  await fixture(async (f) => {
    const login = await f.enroll()
    const identity = createOperatorIdentity({ ...f.options, operator: { ...operator, buyer: true } })
    expect(await identity.authenticate(request("/procurement", login.cookie), { surface: "procurement", roleMap: [] })).toEqual({ id: profile.id, canWrite: true, roles: [{ surface: "procurement", role: "admin" }, { surface: "procurement", role: "buyer" }] })
    expect(await identity.authenticate(request("/planner", login.cookie), { surface: "planner", roleMap: [] })).toEqual({ id: profile.id, canWrite: true, roles: [{ surface: "planner", role: "admin" }] })
    const readonly = createOperatorIdentity({ ...f.options, operator: { ...operator, buyer: false } })
    expect(await readonly.authenticate(request("/procurement", login.cookie), { surface: "procurement", roleMap: [] })).toEqual({ id: profile.id, canWrite: true, roles: [{ surface: "procurement", role: "admin" }] })
  })
})

test("scope is a nonsecret binding to the live session and expires with that session", async () => {
  await fixture(async (f) => {
    const first = await f.enroll()
    const bound = request("/dashboard", first.cookie)
    const scope = await f.identity.scope(bound)
    expect(scope).toMatch(/^[a-f0-9]{64}$/)
    expect(scope).not.toBe(first.handle)
    expect(await f.identity.scope(bound)).toBe(scope)
    expect(await f.identity.scope(request("/dashboard", "theme=dark; " + first.cookie))).toBe(scope)
    expect(await f.identity.scope(request("/dashboard", "  " + first.cookie + "  ; theme=light"))).toBe(scope)
    const second = await f.enroll()
    const rotated = await f.identity.scope(request("/dashboard", second.cookie))
    expect(rotated).toMatch(/^[a-f0-9]{64}$/)
    expect(rotated).not.toBe(scope)
    f.clock.value += 28_800_001
    expect(await f.identity.scope(bound)).toBeUndefined()
    expect(await f.identity.scope(request("/dashboard", second.cookie))).toBeUndefined()
  })
})

test("scope rejects anonymous, duplicate, foreign-origin, and revoked credentials", async () => {
  await fixture(async (f) => {
    const login = await f.enroll()
    expect(await f.identity.scope(request("/dashboard"))).toBeUndefined()
    expect(await f.identity.scope(request("/dashboard", login.cookie.split("=")[0] + "=" + "z".repeat(64)))).toBeUndefined()
    expect(await f.identity.scope(request("/dashboard", login.cookie + "; " + login.cookie))).toBeUndefined()
    expect(await f.identity.scope(new Request("http://127.0.0.1:4110/sucafina/dashboard", { headers: { cookie: login.cookie } }))).toBeUndefined()
    expect((await f.identity.handle(request("/auth/logout", login.cookie, { method: "POST", headers: { origin } })))?.status).toBe(204)
    expect(await f.identity.scope(request("/dashboard", login.cookie))).toBeUndefined()
  })
})
