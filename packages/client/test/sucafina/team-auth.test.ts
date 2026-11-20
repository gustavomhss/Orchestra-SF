import { expect, test } from "bun:test"
import { Schema } from "effect"
import { SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { createSfTeamAuthActions, type SfTransportFetch } from "../../src/sucafina/transport"

const binding = Schema.decodeUnknownSync(SfTeamInstallationDescriptor)({
  installationId: "installation-one", tenantId: "11111111-2222-4333-8444-555555555555",
  projectId: "technical-project", hostId: "host-one", publicOrigin: "https://sf.example.test",
  mount: "/sucafina", contractRevision: "sf-team-profile/1", authMode: "microsoft",
})
// This tiny host-location stand-in tests URL/wire policy, never corporate admission.
async function inBrowser(action: () => void | Promise<void>, origin = binding.publicOrigin) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin } } })
  try { await action() }
  finally {
    if (previous) Object.defineProperty(globalThis, "window", previous)
    else Reflect.deleteProperty(globalThis, "window")
  }
}
test("Microsoft login is independent of a business Team and returns to native root", async () => {
  await inBrowser(async () => {
    const navigated: string[] = []
    const actions = createSfTeamAuthActions({ binding, fetch: async () => { throw new Error("login must navigate") },
      navigate: (url) => navigated.push(url) })
    actions.login()
    expect(navigated).toEqual([binding.publicOrigin + "/sucafina/auth/login?returnTo=%2F"])
  })
})
test("Microsoft logout sends one fixed same-origin POST with cookies and no business authority", async () => {
  await inBrowser(async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const fetch: SfTransportFetch = async (url, init) => { calls.push({ url, init }); return new Response(null, { status: 204 }) }
    await createSfTeamAuthActions({ binding, fetch, navigate: () => undefined }).logout()
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe(binding.publicOrigin + "/sucafina/auth/logout")
    expect(calls[0]!.init).toMatchObject({ method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error" })
    const headers = new Headers(calls[0]!.init?.headers)
    expect([...headers.keys()]).toEqual(["idempotency-key"])
    expect(headers.get("idempotency-key")).toMatch(/^[0-9a-f-]{36}$/)
    expect(calls[0]!.init?.body).toBeUndefined()
    expect(calls[0]!.init?.signal?.aborted).toBe(true)
  })
})
test("unconfirmed Microsoft logout is reported without retry", async () => {
  await inBrowser(async () => {
    for (const status of [200, 401, 403, 503]) {
      let calls = 0
      const actions = createSfTeamAuthActions({ binding, navigate: () => undefined,
        fetch: async () => { calls++; return new Response(null, { status }) } })
      await expect(actions.logout()).rejects.toThrow("SF_NATIVE_REMOTE_LOGOUT_UNCONFIRMED")
      expect(calls).toBe(1)
    }
  })
})
test("auth actions reject foreign windows and invalid mounts before fetch or navigation", async () => {
  for (const invalid of [{ ...binding, mount: "//other.test" }, { ...binding, mount: "/sucafina?next=x" }, binding]) {
    await inBrowser(async () => {
      let calls = 0
      const actions = createSfTeamAuthActions({ binding: invalid,
        fetch: async () => { calls++; return new Response(null, { status: 204 }) }, navigate: () => { calls++ } })
      expect(() => actions.login()).toThrow("SF_NATIVE_AUTH_CONTEXT_MISMATCH")
      await expect(actions.logout()).rejects.toThrow("SF_NATIVE_AUTH_CONTEXT_MISMATCH")
      expect(calls).toBe(0)
    }, invalid === binding ? "https://other.test" : binding.publicOrigin)
  }
})
