import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { Application } from "../../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import { openLocalStore } from "../../../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"
import { createOperatorIdentity } from "../../../../../modules/sucafina/Sucafinav1/runtime/operator-identity.ts"
import { ProcurementModule } from "../../../../../modules/sucafina/Sucafinav1/runtime/procurement.ts"
import { initialProcurementSettings } from "../../../../../modules/sucafina/Sucafinav1/src/initial-settings.ts"
import { object, text } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Command } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { createSfSourcePersistence } from "../../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../../modules/sucafina/Sucafinav1/product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts"
import { createOperationsInstallation } from "../operations-support/installation.ts"

// Playwright starts this composition in Bun because the production adapter uses bun:sqlite.
// The fixture serves the real authenticated application, C02 queue, Planner, import/document services, renderer and shell.
// Synthetic local-operator accounts qualify this browser path, not Entra or native residency.
const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-wp04-browser-"))
await chmod(directory, 0o700)
const at = "2026-11-13T12:00:00Z"
const driver = await openLocalStore(directory)
const store = { ...driver, ...createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at), createId: randomUUID }) }
for (const surface of ["dashboard", "planner", "procurement"] as const) await store.initializeSources(surface)
const manifest = path.join(import.meta.dirname, ".host-manifest.json")
const installationId = randomUUID()
const configurations = [
  { key: "first", mount: "/wp04/first", uid: 1001, name: "First procurement operator" },
  { key: "second", mount: "/wp04/second", uid: 1002, name: "Second procurement operator" },
  { key: "viewer", mount: "/wp04/viewer", uid: 1003, name: "Read-only procurement observer" },
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
const bankKey = randomBytes(32)
const environment = async () => ({ at, id: randomUUID, directory: people, bankKey })
const signingKey = randomBytes(32)
// The runner must provide an already approved real ClamD service. No service is installed here.
const scannerPort = process.env.SF_OPERATIONS_CLAMD_PORT
const scanner = scannerPort === undefined ? null : { host: "127.0.0.1" as const, port: Number(scannerPort) }
const accounts = configurations.map((configuration) => {
  const identity = createOperatorIdentity({
    origin,
    mount: configuration.mount,
    operator: { installationId, uid: configuration.uid, name: configuration.name, buyer: configuration.key !== "viewer" },
    secrets: store.secrets,
    key: randomBytes(32),
  })
  const authenticate: Application["authenticate"] = async (request, context) => {
    if (!context) return null
    const authenticated = await identity.authenticate(request, context)
    // This synthetic test policy only reduces the real local-operator session's grants.
    return authenticated && configuration.key === "viewer"
      ? { ...authenticated, canWrite: false, roles: [{ surface: context.surface, role: "viewer" }] }
      : authenticated
  }
  const installation = createOperationsInstallation({
    installationId, directory, origin, mount: configuration.mount,
    principalRef: "macos:" + installationId + ":" + configuration.uid,
    readOnly: configuration.key === "viewer",
    persistence: store, authenticate, environment, signingKey, scanner,
  })
  return { ...configuration, identity, installation, application: installation.application }
})
const records = await store.transaction("procurement", async (snapshot) => {
  const actor = { id: people[0]!.id, roles: ["admin", "buyer"], canWrite: true }
  const context = await environment()
  const reset = ProcurementModule.domain.execute(snapshot, actor, { page: "Settings", action: "reset", version: 0, values: {} }, context)
  if (!reset.ok) throw new Error("Baseline Procurement settings could not be initialized")
  const holders = ProcurementModule.domain.execute(snapshot, actor, {
    page: "Settings", action: "save", version: snapshot.versions.settings!.version,
    values: {
      levels: initialProcurementSettings().levels.map((level) => ({ ...level, holderId: actor.id })),
      // The real private upload path requires a configured limit in bytes before scanning.
      uploadCap: 16 * 1024 * 1024,
    },
  }, context)
  if (!holders.ok) throw new Error("Synthetic approval holder and attachment limit could not be configured")
  const execute = (command: Command) => {
    const result = ProcurementModule.domain.execute(snapshot, actor, command, context)
    if (!result.ok) throw new Error(`Fixture command ${command.page}/${command.action} was refused (${result.status})`)
    return object(result.value)
  }
  const supplier = execute({ page: "Suppliers", action: "create", version: 0, values: {
    legalName: "Journey registered supplier", country: "France", address: "Synthetic supplier address", taxId: "WP04-FIXTURE-1",
    contactEmail: "supplier@example.invalid", paymentTerms: "Net 45", currency: "EUR", riskRating: "Low", dueDiligence: true,
    sanctionsDate: "2026-11-01", bankName: "Synthetic fixture bank", iban: "TEST-ORIGINAL-IBAN", account: "TEST-ORIGINAL-ACCOUNT",
  } })
  const supplierId = text(supplier.id)
  if (!supplierId) throw new Error("Supplier fixture identity unavailable")
  execute({ page: "Suppliers", action: "activate", id: supplierId, version: snapshot.versions[`suppliers:${supplierId}`]!.version, values: {} })
  const created = execute({ page: "Requests", action: "create", version: 0, values: { pr: {
    title: "Frozen browser sourcing comparison", type: "service", description: "The same A/B/C sourcing facts used by the Procurement comparison producer",
    estAmount: 32400, costCenter: "Synthetic IT", needBy: "2026-12-01", justification: "Review the recorded commercial comparison", expenseType: "OPEX",
  } } })
  const comparison = text(created.number)
  if (!comparison) throw new Error("Comparison fixture identity unavailable")
  const command = (action: string, values: Command["values"] = {}) => execute({ page: "Requests", action, id: comparison, version: snapshot.versions[`requests:${comparison}`]!.version, values })
  command("submit_pr")
  command("approve", { comment: "Synthetic fixture approval through the actual domain" })
  command("save", { sourcing: { evaluator: "Synthetic comparison evaluator", selectionJustification: "Recorded technical preference", quotes: [
    { id: "A", supplier: "Browser quote A", total: 32400, currency: "USD", qty: 1, unitPrice: 32400, techPass: true, scores: [5, 4, 4, 4, 4], cscores: [null, 4, 4] },
    { id: "B", supplier: "Browser quote B", total: 28000, currency: "EUR", qty: 1, unitPrice: 28000, techPass: true, scores: [4, 4, 4, 3, 4], cscores: [null, 5, 4] },
    { id: "C", supplier: "Browser quote C", total: 29000, currency: "USD", qty: 1, unitPrice: 29000, techPass: false, scores: [5, 5, 5, 5, 5], cscores: [null, 5, 5] },
  ] } })
  command("select_quote", { quoteId: "A" })
  command("submit_sourcing")
  return { commit: true, value: { supplier: supplierId, comparison } }
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
  for (const scenario of ["validation", "conflict", "comment", "late-edit", "journey", "comparison", "suppliers", "settings"]) enrollments[scenario] = origin + account.mount + "/auth/local?code=" + await account.identity.enroll()
  enrolled[account.key] = { baseURL: origin + account.mount, principal: people[index]!.id, enrollments }
}
// Enrollment credentials remain private to this ephemeral test process and are not artifacts.
await writeFile(manifest, JSON.stringify({ origin, accounts: enrolled, records }), { mode: 0o600 })
active.ready = true
const closing = { started: false }
async function close() {
  if (closing.started) return
  closing.started = true
  active.ready = false
  await server.stop(true)
  for (const account of accounts) account.installation.dispose()
  await store.dispose()
  await rm(manifest, { force: true })
  await rm(directory, { recursive: true, force: true })
  process.exit(0)
}
process.once("SIGTERM", () => { void close() })
process.once("SIGINT", () => { void close() })
