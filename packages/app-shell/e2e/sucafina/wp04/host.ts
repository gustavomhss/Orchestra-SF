import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
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
import { initializeAbsentSfProductState } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"

// Playwright starts this composition in Bun because the production adapter uses bun:sqlite.
// One real embedded host serves the built shell and native producers on the same origin.
// The three isolated local-operator sessions exercise distinct actors, not Entra identities.
const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-wp04-browser-"))
await chmod(directory, 0o700)
// Core and product storage belong to the same disposable Actions installation.
const hostDirectories = ["host-data", "host-config", "host-cache", "host-state", "host-tmp"]
await Promise.all(hostDirectories.map((name) => mkdir(path.join(directory, name), { mode: 0o700 })))
Object.assign(process.env, {
  ORCHESTRA_DB: path.join(directory, "host-data", "orchestra.db"),
  ORCHESTRA_INHERIT_CREDENTIALS: "0",
  ORCHESTRA_CONFIG_DIR: path.join(directory, "host-config"),
  ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(directory, "host-credential.key"),
  TMPDIR: path.join(directory, "host-tmp"),
  XDG_DATA_HOME: path.join(directory, "host-data"),
  XDG_CONFIG_HOME: path.join(directory, "host-config"),
  XDG_CACHE_HOME: path.join(directory, "host-cache"),
  XDG_STATE_HOME: path.join(directory, "host-state"),
})
// These imports capture host configuration, so load them after private setup.
// Global completes asynchronous directory initialization before graph modules
// read Global.node; concurrent roots can otherwise observe its uninitialized export.
await import("@orchestra/core/global")
const { createEmbeddedRoutes } = await import("../../../../server/src/routes.ts")
const { WebUi } = await import("../../../../server/src/web-ui.ts")
const { createOperationsInstallation } = await import("../operations-support/installation.ts")
const { AppNodeBuilder } = await import("@orchestra/core/effect/app-node-builder")
const { LayerNode } = await import("@orchestra/core/effect/layer-node")
const { PermissionSaved } = await import("@orchestra/core/permission/saved")
const { ClaudeCodeAccount } = await import("@orchestra/core/claude-code-account")
const webRoot = await WebUi.resolveRoot([path.resolve(import.meta.dirname, "../../../../../apps/web/dist")])
if (!webRoot) throw new Error("WP04_BUILT_SHELL_REQUIRED")
const at = "2026-11-13T12:00:00Z"
const driver = await openLocalStore(directory)
const store = { ...driver, ...createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at), createId: randomUUID }) }
for (const surface of ["dashboard", "planner", "procurement"] as const) await store.initializeSources(surface)
await initializeAbsentSfProductState(store, randomUUID)
const manifest = path.join(import.meta.dirname, ".host-manifest.json")
const installationId = randomUUID()
const mount = "/sucafina"
const configurations = [
  { key: "first", uid: 1001, name: "First procurement operator" },
  { key: "second", uid: 1002, name: "Second procurement operator" },
  { key: "viewer", uid: 1003, name: "Read-only procurement observer" },
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
const accounts = configurations.map((configuration) => ({
  ...configuration,
  identity: createOperatorIdentity({
    origin, mount,
    operator: { installationId, uid: configuration.uid, name: configuration.name, buyer: configuration.key !== "viewer" },
    secrets: store.secrets,
    key: randomBytes(32),
  }),
}))
async function sessionAccount(request: Request) {
  const authenticated = await Promise.all(accounts.map(async (account) =>
    await account.identity.person(request) ? account : undefined))
  const present = authenticated.filter((account) => account !== undefined)
  // Each browser context owns one real session; ambiguous credentials fail closed.
  return present.length === 1 ? present[0] : undefined
}
const authenticate: Application["authenticate"] = async (request, context) => {
  if (!context) return null
  const account = await sessionAccount(request)
  if (!account) return null
  const authenticated = await account.identity.authenticate(request, context)
  return authenticated && account.key === "viewer"
    ? { ...authenticated, canWrite: false, roles: [{ surface: context.surface, role: "viewer" }] }
    : authenticated
}
const installation = await createOperationsInstallation({
  installationId, directory, origin, mount,
  operators: accounts.map((account) => ({
    principalRef: "macos:" + installationId + ":" + account.uid,
    readOnly: account.key === "viewer",
  })),
  persistence: store, authenticate,
  isAuthenticated: async (request) => Boolean(await sessionAccount(request)),
  environment, signingKey, scanner,
})
const embedded = HttpRouter.toWebHandler(Layer.merge(createEmbeddedRoutes({
  host: installation.host,
  sucafinaInstallations: installation.discovery,
}), WebUi.layer(webRoot)).pipe(
  // Same request services as the canonical sdk-next embedded composition.
  HttpRouter.provideRequest(AppNodeBuilder.build(LayerNode.group([
    PermissionSaved.node, ClaudeCodeAccount.node,
  ]))),
  Layer.provide(HttpServer.layerServices),
), { disableLogger: true })
const health = await embedded.handler(new Request(origin + "/api/health"))
if (health.status !== 200 || !installation.identity()) throw new Error("OPERATIONS_REAL_HOST_NOT_READY")
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
const enrollmentOwners = new Map<string, (typeof accounts)[number]>()
active.handle = async (request) => {
  const url = new URL(request.url)
  if (url.origin !== origin) return new Response("Access denied", { status: 403 })
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return embedded.handler(request)
  if (url.pathname !== mount && !url.pathname.startsWith(mount + "/"))
    return request.method === "GET" ? embedded.handler(request) : new Response("Not found", { status: 404 })
  const enrollment = url.pathname === mount + "/auth/local" && url.searchParams.getAll("code").length === 1
    ? url.searchParams.get("code") : undefined
  const account = enrollment ? enrollmentOwners.get(enrollment) : await sessionAccount(request)
  if (account) {
    await account.identity.prepare(request)
    const authentication = await account.identity.handle(request)
    if (authentication) {
      if (enrollment && authentication.status === 303) enrollmentOwners.delete(enrollment)
      return authentication
    }
  }
  if (request.method === "POST" && (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site"))
    return new Response("Access denied", { status: 403 })
  return await installation.application(request) ?? new Response("Not found", { status: 404 })
}
const enrolled: Record<string, { baseURL: string; principal: string; enrollments: Record<string, string> }> = {}
for (const [index, account] of accounts.entries()) {
  const enrollments: Record<string, string> = {}
  for (const scenario of ["validation", "conflict", "comment", "late-edit", "journey", "comparison", "suppliers", "settings"]) {
    const code = await account.identity.enroll()
    enrollmentOwners.set(code, account)
    enrollments[scenario] = origin + mount + "/auth/local?code=" + code
  }
  enrolled[account.key] = { baseURL: origin + mount, principal: people[index]!.id, enrollments }
}
// Enrollment credentials remain private to this ephemeral test process and are not artifacts.
await writeFile(manifest, JSON.stringify({ origin, directory, accounts: enrolled, records }), { mode: 0o600 })
active.ready = true
const closing = { started: false }
async function close() {
  if (closing.started) return
  closing.started = true
  active.ready = false
  await server.stop(true)
  await embedded.dispose()
  await store.dispose()
  await rm(manifest, { force: true })
  await rm(directory, { recursive: true, force: true })
  process.exit(0)
}
process.once("SIGTERM", () => { void close() })
process.once("SIGINT", () => { void close() })
