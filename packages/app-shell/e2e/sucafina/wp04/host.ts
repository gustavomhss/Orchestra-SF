import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createApplication } from "../../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import { openLocalStore } from "../../../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"
import { createOperatorIdentity } from "../../../../../modules/sucafina/Sucafinav1/runtime/operator-identity.ts"
import { ProcurementModule } from "../../../../../modules/sucafina/Sucafinav1/runtime/procurement.ts"
import { initialProcurementSettings } from "../../../../../modules/sucafina/Sucafinav1/src/initial-settings.ts"

// Playwright starts this composition in Bun because the production adapter uses bun:sqlite.
// The fixture serves only the real authenticated application, domain, renderer and shell.
// Synthetic local-operator accounts qualify this browser path, not Entra or native residency.
const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-wp04-browser-"))
await chmod(directory, 0o700)
const store = await openLocalStore(directory)
const manifest = path.join(import.meta.dirname, ".host-manifest.json")
const installationId = randomUUID()
const configurations = [
  { key: "first", mount: "/wp04/first", uid: 1001, name: "First procurement operator" },
  { key: "second", mount: "/wp04/second", uid: 1002, name: "Second procurement operator" },
] as const
const people = configurations.map((entry) => ({ id: "macos:" + installationId + ":" + entry.uid, name: entry.name }))
const active: { ready: boolean; handle?: (request: Request) => Promise<Response> } = { ready: false }
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 4174,
  fetch: async (request) => {
    if (new URL(request.url).pathname === "/__wp04_ready")
      return new Response(active.ready ? "ready" : "starting", { status: active.ready ? 200 : 503 })
    return await active.handle?.(request) ?? new Response("Starting", { status: 503 })
  },
})
const origin = server.url.origin
const at = "2026-11-13T12:00:00Z"
const bankKey = randomBytes(32)
const environment = async () => ({ at, id: randomUUID, directory: people, bankKey })
const accounts = configurations.map((configuration) => {
  const identity = createOperatorIdentity({
    origin,
    mount: configuration.mount,
    operator: { installationId, uid: configuration.uid, name: configuration.name, buyer: true },
    secrets: store.secrets,
    key: randomBytes(32),
  })
  return {
    ...configuration,
    identity,
    application: createApplication(configuration.mount, {
      persistence: store,
      authenticate: identity.authenticate,
      environment,
      domains: { procurement: [ProcurementModule], dashboard: [], planner: [] },
      maxJsonBytes: 100_000,
    }),
  }
})
await store.transaction("procurement", async (snapshot) => {
  const actor = { id: people[0]!.id, roles: ["admin", "buyer"], canWrite: true }
  const context = await environment()
  const reset = ProcurementModule.domain.execute(snapshot, actor, { page: "Settings", action: "reset", version: 0, values: {} }, context)
  if (!reset.ok) throw new Error("Baseline Procurement settings could not be initialized")
  const holders = ProcurementModule.domain.execute(snapshot, actor, {
    page: "Settings", action: "save", version: snapshot.versions.settings!.version,
    values: { levels: initialProcurementSettings().levels.map((level) => ({ ...level, holderId: actor.id })) },
  }, context)
  if (!holders.ok) throw new Error("Synthetic approval holder could not be configured")
  return { commit: true, value: undefined }
})
active.handle = async (request) => {
  const pathname = new URL(request.url).pathname
  const account = accounts.find((item) => pathname === item.mount || pathname.startsWith(item.mount + "/"))
  if (!account) return new Response("Not found", { status: 404 })
  await account.identity.prepare(request)
  return await account.identity.handle(request) ?? await account.application(request) ?? new Response("Not found", { status: 404 })
}
const enrolled: Record<string, { baseURL: string; principal: string; enrollments: Record<string, string> }> = {}
for (const [index, account] of accounts.entries()) {
  const enrollments: Record<string, string> = {}
  for (const scenario of ["validation", "conflict", "comment", "late-edit"]) enrollments[scenario] = origin + account.mount + "/auth/local?code=" + await account.identity.enroll()
  enrolled[account.key] = { baseURL: origin + account.mount, principal: people[index]!.id, enrollments }
}
// Enrollment credentials remain private to this ephemeral test process and are not artifacts.
await writeFile(manifest, JSON.stringify({ origin, accounts: enrolled }), { mode: 0o600 })
active.ready = true
const closing = { started: false }
async function close() {
  if (closing.started) return
  closing.started = true
  active.ready = false
  await server.stop(true)
  await store.dispose()
  await rm(manifest, { force: true })
  await rm(directory, { recursive: true, force: true })
  process.exit(0)
}
process.once("SIGTERM", () => { void close() })
process.once("SIGINT", () => { void close() })
