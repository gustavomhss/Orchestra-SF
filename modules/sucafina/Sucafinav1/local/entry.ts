import path from "node:path"
import { userInfo } from "node:os"
import { randomUUID } from "node:crypto"
import { createModule } from "../index.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import { createEntraClient } from "../runtime/entra-client.ts"
import { createOperatorIdentity } from "../runtime/operator-identity.ts"
import { documentHtml, esc, pageMain } from "../src/screen-shell.ts"
import { htmlPolicy } from "../runtime/application.ts"
import { fields, form, table } from "../runtime/ui.ts"
import { object } from "../runtime/contract.ts"
import { createLocalBackups } from "../runtime/local-backups.ts"
import { loadRecoveryConfiguration, withRecoveryPoint } from "../runtime/local-recovery.ts"
import { createLocalJobs } from "../runtime/local-jobs.ts"
import { restoreBackup } from "../runtime/operations.ts"
import type { RestoreTransport } from "../runtime/operations.ts"
import type { Surface } from "../src/identity.ts"
import { createLocalIdentity } from "../runtime/local-identity.ts"
import { bootstrapLocalSurface } from "../runtime/local-bootstrap.ts"
import { loadLocalConfiguration, requireLocalIsolation } from "../runtime/local-configuration.ts"
import { scanLocalFile } from "../runtime/local-scanner.ts"
import { createSfSourcePersistence } from "../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../product/integration/source-projections.ts"
import { createSfBiHttp } from "../product/integration/bi-http.ts"
import { digestSfValue } from "../product/contracts/canonical.ts"
import freeze from "../product/contracts/freeze-v1.json"
import biBrowser from "../product/integration/generated/bi-entry.txt" with { type: "text" }
import type { CreateSfHostRuntime } from "../product/contracts/host-context.ts"

/** Explicit factory loaded by Orchestra serve --installation. No listener, global config or host credentials. */
export default async function installation(context: { origin: string; createHostRuntime?: CreateSfHostRuntime }) {
  return createLocalInstallation(context, process.env.SUCAFINA_LOCAL_CONFIG)
}

export async function createLocalInstallation(context: { origin: string; createHostRuntime?: CreateSfHostRuntime }, file: string | undefined, environment: Readonly<Record<string, string | undefined>> = process.env) {
  if (!file) throw new Error("Explicit private installation configuration required")
  const loaded = await loadLocalConfiguration(file)
  if (context.origin !== loaded.config.origin) throw new Error("Installation origin mismatch")
  await requireLocalIsolation(loaded.directory, environment)
  const config = loaded.config
  const operator = config.authentication === "local-operator" && config.localOperator ? { ...config.localOperator, name: userInfo().username } : undefined
  const client = !operator && config.tenantId && config.clientId ? createEntraClient({ tenantId: config.tenantId, clientId: config.clientId }) : undefined
  const now = () => new Date().toISOString()
  const projectScope = createSfSourceScopeProjector(now)
  const driver = await openLocalStore(path.join(loaded.directory, operator ? "business-local" : "business"))
  const store = { ...driver, ...createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, projectScope, createId: randomUUID }) }
  const restoration = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, projectScope, createId: randomUUID, purpose: "business-restore" })
  const services = { jobs: undefined as Awaited<ReturnType<typeof createLocalJobs>> | undefined }
  const status = (request: Request) => {
    const url = new URL(request.url)
    if (url.origin !== config.origin || url.pathname !== `${config.mount}/status`) return undefined
    if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } })
    return new Response(request.method === "HEAD" ? null : JSON.stringify({
      login: operator ? "local-operator" : config.tenantId && config.clientId ? "configured-unverified" : "not-configured",
      uploads: config.scanner ? "scanner-configured-unverified" : "unavailable-scanner-not-configured",
      notifications: operator ? "in-app" : "queued-transport-not-configured",
      ...(operator && services.jobs ? { maintenance: services.jobs.status().error ? "degraded" : services.jobs.status().lastSuccess ? "active" : "starting" } : {}),
    }), { headers: { "Cache-Control": "no-store", "Content-Type": "application/json" } })
  }
  if (!client && !operator) return {
    mount: config.mount,
    handler: async (request: Request) => status(request) ?? new Response("Microsoft 365 application is not configured. Set tenantId and clientId in the private installation configuration, then start this isolated instance again.", { status: 503, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" } }),
    dispose: () => store.dispose(),
  }
  for (const surface of ["dashboard", "planner", "procurement"] as const) await store.initializeSources(surface)
  const identity = operator
    ? createOperatorIdentity({ origin: config.origin, mount: config.mount, operator, secrets: store.secrets, key: loaded.keys.session })
    : createLocalIdentity({ origin: config.origin, mount: config.mount, client: client!, secrets: store.secrets, key: loaded.keys.session })
  const backupDirectory = path.join(loaded.directory, operator ? "backups-local" : "backups-microsoft")
  const backups = await createLocalBackups(backupDirectory)
  const recovery = operator ? await loadRecoveryConfiguration(loaded.directory) : undefined
  const recoveryDrill = recovery ? async (at: string) => {
    const started = performance.now()
    await withRecoveryPoint(recovery, undefined, async (point) => {
      for (const surface of ["dashboard", "planner", "procurement"] as const) {
        const captured = await backups.capture(point, surface, at)
        await backups.verify(surface, captured.id, at)
      }
    })
    return { at, durationMs: Math.ceil(performance.now() - started) }
  } : undefined
  const jobs = await createLocalJobs({ store, backupDirectory, mount: config.mount, ...(recoveryDrill ? { recoveryDrill } : {}), ...(operator ? { operator: { id: `macos:${operator.installationId}:${operator.uid}`, name: operator.name } } : {}), schedule: !!operator })
  services.jobs = jobs
  const requestEnvironment = async (request: Request) => ({ at: now(), id: randomUUID, directory: await identity.directory(request), bankKey: loaded.keys.bank })
  const installationId = operator?.installationId ?? digestSfValue({ origin: config.origin, mount: config.mount, directory: loaded.directory })
  const runtime = await context.createHostRuntime?.({ installationId, directory: loaded.directory, sourceRoot: path.resolve(import.meta.dir, "../product/ai"), origin: config.origin,
    mount: config.mount, persistence: store, authenticate: identity.authenticate, environment: requestEnvironment,
    grants: operator ? [{ principalRef: `macos:${operator.installationId}:${operator.uid}`,
      namespaces: ["preferences", "reviews", "relations", "threads", "confirmations", "cases", "contributions", "documents", "receipts", "atlas", "outbox"],
      operations: freeze.operations.map((operation) => operation.operation) }] : [] })
  const product = createSfBiHttp({ installationId, projectId: installationId, policyVersion: "sf-product-v1", origin: config.origin, mount: config.mount,
    persistence: store, authenticate: identity.authenticate, environment: requestEnvironment, browserScript: async () => biBrowser, ...(runtime ? { identity: runtime.identity } : {}) })
  const business = createModule(config.mount, {
    persistence: store,
    authenticate: identity.authenticate,
    environment: requestEnvironment,
    product,
    maxJsonBytes: 2 * 1024 * 1024,
    assets: { persistence: store, services: { signingKey: loaded.keys.assets, scan: (bytes) => scanLocalFile(bytes, config.scanner) } },
  })
  return {
    mount: config.mount,
    ...(runtime ? { host: runtime.contributions } : {}),
    async handler(request: Request) {
      const url = new URL(request.url)
      if (url.origin !== config.origin) return new Response("Access denied", { status: 403 })
      if (operator && request.method === "POST" && (request.headers.get("origin") !== config.origin || request.headers.get("sec-fetch-site") === "cross-site")) return new Response("Access denied", { status: 403 })
      const readiness = status(request)
      if (readiness) return readiness
      const auth = await identity.handle(request)
      if (auth) {
        if (operator && url.pathname === `${config.mount}/auth/login` && auth.status === 200) return utilityHtml("Signed out", '<p class="utility-empty">Your local session has ended. To sign in again, open the Abrir Sucafina shortcut on this Mac.</p>', true)
        return auth
      }
      await identity.prepare(request)
      if (operator && (url.pathname === `${config.mount}/notifications` || url.pathname === `${config.mount}/backups`)) {
        if (!["GET", "HEAD", "POST"].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: "GET, HEAD, POST" } })
        const person = await identity.person(request)
        if (!person) return request.method === "POST" ? utilityJson({ ok: false }, 403) : new Response(null, { status: 303, headers: { location: `${config.mount}/auth/login`, "Cache-Control": "no-store" } })
        if (person.id !== `macos:${operator.installationId}:${operator.uid}`) return utilityJson({ ok: false }, 403)
        if (url.pathname.endsWith("/notifications")) {
          if (request.method !== "POST") return utilityJson({ items: await jobs.inbox(person.id) }, 200, request.method === "HEAD")
          const command = await utilityCommand(request)
          if (command instanceof Response) return command
          if (!Array.isArray(command.ids) || command.ids.some((id) => typeof id !== "string")) return utilityJson({ ok: false, errors: ["Notification identifiers required."] }, 422)
          const ids = command.ids.filter((id): id is string => typeof id === "string")
          if (ids.length > 100 || ids.some((id) => !/^(dashboard|planner|procurement):[a-f0-9]{64}$/.test(id))) return utilityJson({ ok: false, errors: ["Invalid notification identifiers."] }, 422)
          return utilityJson({ ok: true, read: await jobs.markRead(person.id, ids) })
        }
        if (request.method === "POST") {
          const command = await utilityCommand(request)
          if (command instanceof Response) return command
          if (command.action === "run-maintenance") {
            const current = await jobs.runOnce()
            return utilityJson(current.error ? { ok: false, errors: [current.error] } : { ok: true }, current.error ? 503 : 200)
          }
          const values = object(command.values)
          const surface = utilitySurface(values.surface)
          if (!surface) return utilityJson({ ok: false, errors: ["Application required."] }, 422)
          if (command.action === "backup-now") {
            await backups.capture(store, surface, new Date().toISOString())
            return utilityJson({ ok: true })
          }
          if (command.action === "restore-point") {
            if (!recovery || command.confirmed !== true || typeof values.at !== "string" || !Number.isSafeInteger(command.version) || Number(command.version) < 0) return utilityJson({ ok: false, errors: ["Configured recovery, confirmed UTC time and current revision required."] }, 422)
            const recovered = await withRecoveryPoint(recovery, values.at, (point) => backups.capture(point, surface, new Date().toISOString())).catch(() => undefined)
            if (!recovered) return utilityJson({ ok: false, errors: ["That recovery point is unavailable or could not be verified. Live data was not changed."] }, 422)
            await backups.capture(store, surface, new Date().toISOString())
            const result = await restoreBackup(restoration, backups.source, surface, recovered.id, { id: person.id, canWrite: true, roles: ["admin"] }, true, Number(command.version), new Date().toISOString())
            return utilityJson(result, result.ok ? 200 : result.status)
          }
          if (command.action !== "restore-backup" || command.confirmed !== true || typeof values.id !== "string" || !/^backup-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(values.id) || !Number.isSafeInteger(command.version) || Number(command.version) < 0) return utilityJson({ ok: false, errors: ["Confirmed restoration and current revision required."] }, 422)
          // Pin verified selected bytes before capture can apply retention to older archives.
          const pinned = await pinRestoration(backups.source, surface, values.id).catch(() => null)
          if (pinned === null) return utilityJson({ ok: false, errors: ["Backup could not be verified."] }, 422)
          if (!pinned) return utilityJson({ ok: false, errors: ["Backup is no longer available."] }, 404)
          // Keep a verified copy of the current state before replacing business data.
          await backups.capture(store, surface, new Date().toISOString())
          const restored = await restoreBackup(restoration, pinned, surface, values.id, { id: person.id, canWrite: true, roles: ["admin"] }, true, Number(command.version), new Date().toISOString())
          return utilityJson(restored, restored.ok ? 200 : restored.status)
        }
        const surfaces = ["dashboard", "planner", "procurement"] as const
        const archiveRows = await Promise.all(surfaces.map(async (surface) => {
          const version = await store.transaction(surface, async (snapshot) => ({ commit: false, value: snapshot.versions.dataset?.version ?? 0 }))
          return (await backups.list(surface)).map((archive) => [surface, esc(archive.at), archive.tier, String(archive.assets), String(archive.bytes), form("Backups", "restore-backup", "", version, `<input type="hidden" name="surface" value="${surface}"><input type="hidden" name="id" value="${esc(archive.id)}">`, "Restore backup")])
        }))
        const recoveryForms = recovery ? (await Promise.all(surfaces.map(async (surface) => {
          const version = await store.transaction(surface, async (snapshot) => ({ commit: false, value: snapshot.versions.dataset?.version ?? 0 }))
          return form("Backups", "restore-point", "", version, `<input type="hidden" name="surface" value="${surface}">` + fields([{ name: "at", label: `${surface}: recovery time (UTC, ISO 8601)`, value: "", required: true }]), `Restore ${surface} to time`)
        }))).join("") : ""
        const health = jobs.status()
        const html = await utilityHtml("Backups", `<p>Verified backups are stored privately on this Mac. Restoring a backup replaces the selected application's business data. Monthly archives are retained for seven years; hourly snapshots for 35 days (Planner: 14 days).</p>${recovery ? `<p>Continuous recovery is configured for 35 days. A selected UTC time restores the last retained commit strictly before that time. This copy is on the same Mac; protection against loss of this Mac requires an external destination.</p>${health.recoveryDrill ? `<p>Last continuous recovery drill: ${esc(health.recoveryDrill.at)} · ${health.recoveryDrill.durationMs} ms.</p>` : '<p>Continuous recovery drill has not yet succeeded.</p>'}${recoveryForms}` : '<p>Continuous recovery is not configured.</p>'}${health.error ? `<p class="notice" role="status">${esc(health.error)}</p>` : ""}${form("Backups", "run-maintenance", "", 0, "", "Run maintenance now")}${form("Backups", "backup-now", "", 0, fields([{ name: "surface", label: "Application", type: "select", options: [...surfaces], value: "dashboard" }]), "Create backup")}${table(["Application", "Created", "Retention", "Attachments", "Bytes", "Actions"], archiveRows.flat())}`)
        return request.method === "HEAD" ? new Response(null, { status: html.status, headers: html.headers }) : html
      }
      const surface = url.pathname.slice(config.mount.length + 1)
      if (surface === "dashboard" || surface === "planner" || surface === "procurement") {
        const person = await identity.person(request)
        if (!person && request.method === "GET") return new Response(null, { status: 303, headers: { location: `${config.mount}/auth/login?returnTo=${encodeURIComponent(url.pathname + url.search)}`, "Cache-Control": "no-store" } })
        if (person && !operator) await bootstrapLocalSurface({ request, surface, groups: config.groups[surface], identity, store })
      }
      const response = await business(request)
      if (request.method === "POST" && response?.ok) void jobs.runOnce().catch(() => undefined)
      if (!operator || !response || !response.headers.get("content-type")?.includes("text/html") || url.searchParams.has("download") || request.method === "HEAD") return response
      return localChrome(response)

    },
    async dispose() { await jobs.dispose(); await store.dispose() },
  }

  function localChrome(response: Response) {
    return response.text().then((body) => {
      const html = body.replace('<div id="content" class="content">', '<div id="content" class="content"><p role="status" class="environment-banner">Homologação local · ' + esc(operator!.name) + ' · Microsoft 365 desativado neste perfil</p>')
        .replace('<!--local-tools-->', `<a href="${config.mount}/backups">Backups</a><details data-notifications="${config.mount}/notifications"><summary>Notifications <span class="notification-count" data-notification-count></span></summary><div class="notification-popover" data-notification-items><p>Loading notifications…</p></div></details>`)
      const headers = new Headers(response.headers)
      headers.delete("content-length")
      return new Response(html, { status: response.status, headers })
    })
  }
  async function utilityHtml(title: string, body: string, signedOut = false) {
    const html = documentHtml("Sucafina", signedOut ? "signed-out" : "maintenance", "", pageMain({ drawn: true, key: title, index: 0 }, body), "")
    const response = new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": htmlPolicy(html) } })
    return signedOut ? response : localChrome(response)
  }
}

function utilitySurface(value: unknown): Surface | undefined {
  return value === "dashboard" || value === "planner" || value === "procurement" ? value : undefined
}
function utilityJson(value: unknown, status = 200, head = false) {
  return new Response(head ? null : JSON.stringify(value), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } })
}
async function utilityCommand(request: Request): Promise<Record<string, unknown> | Response> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return utilityJson({ ok: false }, 415)
  const reader = request.body?.getReader()
  if (!reader) return utilityJson({ ok: false }, 400)
  const chunks: Uint8Array[] = []
  const length = { value: 0 }
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      length.value += next.value.byteLength
      if (length.value > 8192) { await reader.cancel(); return utilityJson({ ok: false }, 413) }
      chunks.push(next.value)
    }
    const bytes = new Uint8Array(length.value)
    const cursor = { value: 0 }
    for (const chunk of chunks) { bytes.set(chunk, cursor.value); cursor.value += chunk.length }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : utilityJson({ ok: false }, 400)
  } catch { return utilityJson({ ok: false }, 400) }
  finally { reader.releaseLock() }
}

async function pinRestoration(source: RestoreTransport, surface: Surface, id: string): Promise<RestoreTransport | undefined> {
  const archive = await source.load(surface, id)
  if (!archive) return undefined
  const blobs = new Map<string, Uint8Array>()
  for (const blob of archive.manifest.blobs) {
    const bytes = await source.readBlob(surface, id, blob.key)
    if (!bytes) throw new Error("Missing retained backup bytes")
    blobs.set(blob.key, bytes)
  }
  return {
    load: async (requested, key) => requested === surface && key === id ? archive : undefined,
    readBlob: async (requested, key, blob) => requested === surface && key === id ? blobs.get(blob) : undefined,
  }
}
