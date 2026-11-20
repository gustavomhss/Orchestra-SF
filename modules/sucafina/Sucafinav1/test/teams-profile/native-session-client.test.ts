import { expect, test } from "bun:test"
import { Schema } from "effect"
import { SfTeamContextResult } from "@orchestra/schema/sucafina/context"
import { Session } from "@orchestra/schema/session"
import { SessionMessage } from "@orchestra/schema/session-message"
import { createSfTeamSessions } from "@orchestra/client/sucafina/sessions"
import { nativeTeamWebFixture } from "./native-web-fixture.ts"
import { profileA } from "./installation-fixture.ts"

test("official Teams Client consumes the installed HTTP namespace and durable prompt contract", async () => {
  const started = Date.now(), phases: { name: string; elapsedMs: number }[] = []
  const phase = (name: string) => phases.push({ name, elapsedMs: Date.now() - started })
  const diagnostic = setTimeout(() => console.error("SF_NATIVE_CLIENT_DEADLINE", JSON.stringify({ phases })), 9000)
  phase("fixture-start")
  try {
  await using f = await nativeTeamWebFixture({ enabled: [profileA], direct: [profileA],
    sessionActions: ["read", "create", "prompt", "run", "control"] })
  phase("fixture-ready")
  const contextResponse = await f.handle(f.contextRequest("team", profileA))
  expect(contextResponse.status).toBe(200)
  const context = Schema.decodeUnknownSync(Schema.toCodecJson(SfTeamContextResult))(await contextResponse.json())
  if (context.status !== "ok" || !context.value.stamp.team) throw new Error("Admitted corporate context required")
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: f.binding.origin } } })
  const abort = new AbortController(), invalidated: string[] = []
  const calls: { method: string; path: string; status: number; cache: string | null; keys?: string[]; cursorHasNull?: boolean }[] = []
  const client = createSfTeamSessions({
    binding: f.descriptor, owner: context.value.stamp.team.owner, signal: abort.signal,
    current: () => !abort.signal.aborted, invalidated: (reason) => invalidated.push(reason),
    fetch: async (address, init) => {
      const headers = new Headers(init?.headers)
      headers.set("cookie", f.cookie)
      if (init?.method === "POST") headers.set("origin", f.binding.origin)
      const request = new Request(address, { ...init, headers })
      phase("dispatch " + request.method + " " + new URL(request.url).pathname)
      const response = await f.handle(request)
      phase("response " + request.method + " " + new URL(request.url).pathname)
      const json: unknown = response.headers.get("content-type")?.includes("application/json") ? await response.clone().json() : undefined
      calls.push({ method: request.method, path: new URL(request.url).pathname, status: response.status,
        cache: response.headers.get("cache-control"), keys: json && typeof json === "object" ? Object.keys(json) : undefined,
        cursorHasNull: !!json && typeof json === "object" && "cursor" in json && !!json.cursor && typeof json.cursor === "object" && Object.values(json.cursor).includes(null) })
      expect(response.headers.get("cache-control")).toBe("no-store")
      return response
    },
  })
  try {
    expect((await client.list()).data).toEqual([])
    const namespace = client.namespace()
    expect(namespace).toBeDefined()
    if (!namespace) throw new Error("Actual HTTP namespace required before create")
    expect(namespace.owner).toEqual(context.value.stamp.team.owner)
    const sessionID = Schema.decodeUnknownSync(Session.ID)("ses_native_official_client")
    const created = await client.create({ id: sessionID })
    expect(created.id).toBe(sessionID)
    expect((await client.get({ sessionID })).namespace).toEqual(namespace)
    const messageID = Schema.decodeUnknownSync(SessionMessage.ID)("msg_native_official_client")
    const receipt = await client.prompt({ sessionID, id: messageID, text: "Recorded admission through the official Client." })
    expect(receipt.id).toBe(messageID)
    expect(f.sessionCalls.wakes).toBe(1)
    expect(f.sessionCalls.resumes).toBe(0)
    expect((await client.list()).data.map((item) => item.id)).toEqual([sessionID])
    expect(invalidated).toEqual([])
    expect(calls.every((call) => call.path.startsWith(f.binding.mount + "/api/session"))).toBe(true)
  } catch (error) {
    console.error("SF_NATIVE_CLIENT_CONTRACT_FAILURE", JSON.stringify({ invalidated, calls, phases }))
    throw error
  } finally {
    abort.abort(); client.dispose()
    if (previous) Object.defineProperty(globalThis, "window", previous)
    else Reflect.deleteProperty(globalThis, "window")
    phase("close-start")
    await f.close()
    phase("closed")
    expect(f.runtimeState.closed).toBe(true)
    console.log("SF_NATIVE_CLIENT_PHASES", JSON.stringify({ phases }))
  }
  } finally { clearTimeout(diagnostic) }
}, 10000)
