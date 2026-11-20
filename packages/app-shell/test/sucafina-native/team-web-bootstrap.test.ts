import { expect, test } from "bun:test"
import { Schema } from "effect"
import { SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { readCurrentTeamInstallation, teamWebLoginUrl } from "../../src/context/team-profile-web"

// Wire-validation fixtures only. They do not replace the signed-session browser proof.
const binding = Schema.decodeUnknownSync(SfTeamInstallationDescriptor)({
  installationId: "installation-one", tenantId: "11111111-2222-4333-8444-555555555555",
  projectId: "technical-project", hostId: "host-one", publicOrigin: "https://sf.example.test",
  mount: "/sucafina", contractRevision: "sf-team-profile/1", authMode: "microsoft",
})
const reply = (value: unknown, headers?: HeadersInit) => new Response(JSON.stringify(value), {
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...Object.fromEntries(new Headers(headers)) },
})
test("Web bootstrap asks only for the exact current installed host metadata", async () => {
  const calls: { url: string; init?: RequestInit }[] = []
  const result = await readCurrentTeamInstallation({
    origin: binding.publicOrigin, browserOrigin: binding.publicOrigin, signal: new AbortController().signal,
    fetch: async (url, init) => { calls.push({ url, init }); return reply({ installations: [binding] }) },
  })
  expect(result).toEqual(binding)
  expect(calls).toHaveLength(1)
  const call = calls[0]!, url = new URL(call.url)
  expect(url.pathname).toBe("/api/sucafina/installations")
  expect([...url.searchParams]).toEqual([["select", "current"], ["contractRevision", "sf-team-profile/1"]])
  expect(call.init).toMatchObject({ credentials: "same-origin", cache: "no-store", redirect: "error" })
  expect([...new Headers(call.init?.headers)]).toEqual([["accept", "application/json"]])
})
test("Web bootstrap rejects foreign origins before fetch, without a local operator fallback", async () => {
  for (const origin of ["http://sf.example.test", "https://foreign.test", binding.publicOrigin + "/path"]) {
    let calls = 0
    expect(await readCurrentTeamInstallation({ origin, browserOrigin: binding.publicOrigin,
      signal: new AbortController().signal, fetch: async () => { calls++; return reply({ installations: [binding] }) } })).toBeUndefined()
    expect(calls).toBe(0)
  }
})
test("Web bootstrap rejects partial, duplicate-runtime and foreign metadata rather than picking a first row", async () => {
  for (const value of [
    { installations: [] }, { installations: [binding, binding] },
    { installations: [{ ...binding, publicOrigin: "https://foreign.test" }] },
    { installations: [{ ...binding, tenantId: undefined }] }, { installations: [binding], authority: "caller" },
  ]) expect(await readCurrentTeamInstallation({
    origin: binding.publicOrigin, browserOrigin: binding.publicOrigin, signal: new AbortController().signal,
    fetch: async () => reply(value),
  })).toBeUndefined()
})
test("Web bootstrap requires no-store JSON and exact streamed size", async () => {
  for (const headers of [
    new Headers({ "Cache-Control": "public" }), new Headers({ "Content-Type": "text/html" }),
    new Headers({ "Content-Length": "1" }), new Headers({ "Content-Length": "16385" }),
  ]) expect(await readCurrentTeamInstallation({
    origin: binding.publicOrigin, browserOrigin: binding.publicOrigin, signal: new AbortController().signal,
    fetch: async () => reply({ installations: [binding] }, headers),
  })).toBeUndefined()
})
test("abort bounds a metadata stream even when cancellation does not settle", async () => {
  const abort = new AbortController()
  let cancelled = false
  const entered = Promise.withResolvers<void>()
  const pending = readCurrentTeamInstallation({
    origin: binding.publicOrigin, browserOrigin: binding.publicOrigin, signal: abort.signal,
    fetch: async () => new Response(new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode('{"installations":[')) },
      pull() { entered.resolve() },
      cancel() { cancelled = true; return new Promise<void>(() => undefined) },
    }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }),
  })
  await entered.promise
  abort.abort()
  expect(await pending).toBeUndefined()
  expect(abort.signal.aborted).toBe(true)
  expect(cancelled).toBe(true)
})
test("native login returns only to root through the validated installed mount", () => {
  const url = new URL(teamWebLoginUrl(binding, binding.publicOrigin)!)
  expect(url.origin).toBe(binding.publicOrigin)
  expect(url.pathname).toBe("/sucafina/auth/login")
  expect([...url.searchParams]).toEqual([["returnTo", "/"]])
  expect(teamWebLoginUrl(binding, "https://other.test")).toBeUndefined()
  for (const mount of ["//foreign.test", "/../foreign", "/sucafina?x=1", "/sucafina/"])
    expect(teamWebLoginUrl({ ...binding, mount }, binding.publicOrigin)).toBeUndefined()
})
