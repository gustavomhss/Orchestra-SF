import { Effect, Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { SessionOwner } from "@orchestra/core/session/owner"
import { ownerA } from "../../../../packages/core/test/fixture/session-owner"
import { createSfTeamSessionHttp } from "../../src/sucafina-product/team-session-http"

const directory = process.argv[2]
const workspaceDirectory = process.argv[3]
if (!directory || !workspaceDirectory) throw new Error("Private fixture paths required")
const origin = "https://session-factory.example.test"
const mount = "/installed-component"
const observed: Request[] = []
const admission: SessionOwner.Admission = {
  binding: { owner: ownerA, revisions: { configRevision: "factory:1", accessRevision: "controlled-factory-component" } },
  verifyCurrent: () => Effect.succeed(true),
  authorize: (action) => Effect.succeed(action === "read"),
  excludedSessions: () => Effect.succeed([]),
  configuration: () => Effect.succeed({
    origin: "installation-team-store", profile: ownerA.profile, configRevision: "factory:1",
    document: { version: 1, settings: {} },
  }),
}
// Only the private producer is controlled. The factory imports and builds its actual complete service graph.
const options = { directory, workspaceDirectory, origin, mount,
  readAdmission: async (request: Request) => { observed.push(request); return admission } }
const request = (pathname: string) => new Request(origin + mount + pathname)
const runtime = await createSfTeamSessionHttp(options)
try {
  const original = request("/api/session")
  const response = await runtime.handler(original)
  if (response.status !== 200 || observed[0] !== original) throw new Error("Real Session graph or original Request was not retained")
  const collection = Schema.decodeUnknownSync(Schema.Struct({
    data: Schema.Array(Schema.Unknown), namespace: TeamProfile.SessionNamespace,
  }))(await response.json())
  if (collection.data.length || collection.namespace.authorityGeneration !== 1 ||
      JSON.stringify(collection.namespace.owner) !== JSON.stringify(ownerA)) throw new Error("Owned namespace missing")

  const active = await runtime.handler(request("/api/session/active"))
  if (active.status !== 200) throw new Error("Real coordinator was not composed")
  await active.arrayBuffer()
  const events = await runtime.handler(request("/api/event"))
  if (events.status !== 200 || !events.body) throw new Error("Real SSE was not started")
  const reader = events.body.getReader()
  try {
    const decoder = new TextDecoder()
    let text = ""
    while (!text.includes("\n\n")) {
      const chunk = await deadline(reader.read())
      if (chunk.done) throw new Error("SSE ended before readiness")
      text += decoder.decode(chunk.value, { stream: true })
    }
    if (!text.includes("server.connected") || !text.includes('"namespace"')) throw new Error("Corporate SSE frame missing")
    const ended = (async () => {
      while (true) {
        if ((await reader.read()).done) return
      }
    })()
    await deadline(Promise.all([ended, Promise.resolve().then(() => runtime.dispose())]))
  } finally { await reader.cancel().catch(() => undefined) }
  await runtime.dispose()
  const closed = await runtime.handler(request("/api/session"))
  if (closed.status !== 503 || closed.headers.get("cache-control") !== "no-store") throw new Error("Disposed factory accepted a request")
} finally { await runtime.dispose() }
const reopened = await createSfTeamSessionHttp(options)
try {
  const response = await reopened.handler(request("/api/session"))
  if (response.status !== 200) throw new Error("Private storage did not reopen after disposal")
  await response.arrayBuffer()
} finally { await deadline(reopened.dispose()) }
console.log("TEAM_SESSION_FACTORY_SMOKE_OK")

async function deadline<A>(promise: Promise<A>): Promise<A> {
  const timer: { value?: ReturnType<typeof setTimeout> } = {}
  try {
    return await Promise.race([promise, new Promise<never>((_resolve, reject) => {
      timer.value = setTimeout(() => reject(new Error("Team Session factory lifecycle timed out")), 5_000)
    })])
  } finally { clearTimeout(timer.value) }
}
