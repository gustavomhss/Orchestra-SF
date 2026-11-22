import type { SfOperationAvailability } from "@orchestra/schema/sucafina/context"
import { SfReviewRoutes } from "@orchestra/schema/sucafina/reviews/routes"
import path from "node:path"
import { userInfo } from "node:os"
import { randomUUID } from "node:crypto"
import { createModule, contributions, type ModuleServices } from "../index.ts"
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
import { prepareSfLocalWorkspace } from "./workspace.ts"
import { scanLocalFile } from "../runtime/local-scanner.ts"
import { mountSfFilesOriginalRoutes } from "../runtime/native-files/routing.ts"
import { createSfContextHandler } from "../../../../apps/cli/src/sucafina-product/native-ui/context.ts"
import { mountSfNativeProjections, type SfNativeHostDependencies, type SfProjectionHandler } from "../../../../apps/cli/src/sucafina-product/native-ui/router.ts"
import { createSfDomainProjectionHandlers } from "../../../../apps/cli/src/sucafina-product/native-ui/domain.ts"
import { observeSfDashboardPages } from "../../../../apps/cli/src/sucafina-product/native-ui/dashboard-operational.ts"
import { observeSfDomainHealth } from "../../../../apps/cli/src/sucafina-product/native-ui/domain-health.ts"
import { observeSfAssetHealth } from "../../../../apps/cli/src/sucafina-product/native-ui/asset-health.ts"
import { observeSfPoHealth } from "../../../../apps/cli/src/sucafina-product/native-ui/po-health.ts"
import { createSfActionSource } from "../../../../apps/cli/src/sucafina-product/native-ui/action-source.ts"
import { createSfPeopleProjectionHandlers } from "../../../../apps/cli/src/sucafina-product/native-ui/people.ts"
import { createSfOperationsProjectionHandlers } from "../../../../apps/cli/src/sucafina-product/native-ui/operations.ts"
import { createSfWorkProjectionHandlers, observeSfHome } from "../../../../apps/cli/src/sucafina-product/native-ui/work.ts"
import { observeSfWorkHealth } from "../../../../apps/cli/src/sucafina-product/native-ui/work-health.ts"
import { createSfPlannerProjectionHandlers, observeSfPlannerPages } from "../../../../apps/cli/src/sucafina-product/native-ui/planner.ts"
import { createSfProcurementProjectionHandlers } from "../../../../apps/cli/src/sucafina-product/native-ui/procurement.ts"
import { createSfDecisionsProjectionHandlers, observeSfCases } from "../../../../apps/cli/src/sucafina-product/native-ui/decisions.ts"
import { createSfRoutinesHandlers } from "../../../../apps/cli/src/sucafina-product/native-ui/routines.ts"
import { mountSfReviewProjection } from "../../../../apps/cli/src/sucafina-product/native-ui/review-routing"
import type { CreateSfHostRuntime, SfHostRuntime } from "../product/contracts/host-context.ts"
import { createCurrentChoiceFence, currentChoiceOwnsSnapshotTransactions } from "../product/decisions/current-choice-preview.ts"
import { createSfSourceScopeProjector } from "../product/integration/source-projections.ts"
import { createSfSourcePersistence } from "../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../product/integration/source-inventory.ts"
import { initializeAbsentSfProductState } from "../product/host-binding/state-provider.ts"
import { createSfWorkbenchHttp } from "../product/interface/http.ts"
import { sfHumanActions } from "../product/integration/human-authority.ts"
import freeze from "../product/contracts/freeze-v1.json" with { type: "json" }

export const nativeSfLocalInstallation = true

type SfLocalContext = {
  origin: string
  createHostRuntime?: CreateSfHostRuntime
  createCurrentChoiceFence?: typeof createCurrentChoiceFence
  currentChoiceOwnsSnapshotTransactions?: typeof currentChoiceOwnsSnapshotTransactions
  createSfSourcePersistence?: typeof createSfSourcePersistence
  sourceRoot?: string
}

/** Explicit factory loaded by Orchestra serve --installation. No listener, global config or host credentials. */
export default async function installation(context: SfLocalContext) {
  return createLocalInstallation(context, process.env.SUCAFINA_LOCAL_CONFIG)
}

export async function createLocalInstallation(context: SfLocalContext, file: string | undefined, environment: Readonly<Record<string, string | undefined>> = process.env) {
  if (!file) throw new Error("Explicit private installation configuration required")
  const loaded = await loadLocalConfiguration(file)
  if (context.origin !== loaded.config.origin) throw new Error("Installation origin mismatch")
  await requireLocalIsolation(loaded.directory, environment)
  const config = loaded.config
  const operator = config.authentication === "local-operator" && config.localOperator
    ? { ...config.localOperator, name: config.localOperator.name ?? userInfo().username }
    : undefined
  const directory = operator && context.createHostRuntime ? await prepareSfLocalWorkspace(loaded.directory) : loaded.directory
  const client = !operator && config.tenantId && config.clientId ? createEntraClient({ tenantId: config.tenantId, clientId: config.clientId }) : undefined
  const driver = await openLocalStore(path.join(loaded.directory, operator ? "business-local" : "business"))
  const services = { jobs: undefined as Awaited<ReturnType<typeof createLocalJobs>> | undefined }
  try {
    let runtime: SfHostRuntime | undefined
    const currentChoiceFence = operator && context.createHostRuntime ? (context.createCurrentChoiceFence ?? createCurrentChoiceFence)({
      persistence: driver,
      host: () => {
        const host = runtime?.services?.()?.host
        if (!host) throw new Error("SF_CURRENT_CHOICE_HOST_UNAVAILABLE")
        return host
      },
      identity: () => runtime?.identity(),
      operationIdentity: (call) => call.kind === "ui" ? runtime?.services?.()?.ui.operationIdentity(call) : undefined,
    }) : undefined
    const sourceOptions = {
      enumerate: enumerateSfSources,
      projectScope: createSfSourceScopeProjector(() => new Date().toISOString()),
      createId: randomUUID,
    }
    const verifyTransactions = context.createCurrentChoiceFence ? context.currentChoiceOwnsSnapshotTransactions : currentChoiceOwnsSnapshotTransactions
    const ownsTransactions = currentChoiceFence && verifyTransactions?.(currentChoiceFence, driver) === true
    const sourcePersistence = currentChoiceFence && (context.createSfSourcePersistence ?? createSfSourcePersistence)({
      ...sourceOptions, persistence: currentChoiceFence.persistence,
      ...(ownsTransactions ? { observeAuthority: driver.observeAuthority, holdTargetPreimage: driver.holdTargetPreimage,
        hasSnapshotRoot: driver.hasSnapshotRoot, installedDashboardProjector: sourceOptions.projectScope } : {}),
    })
    const runtimeStore = sourcePersistence && currentChoiceFence
      ? { ...driver, ...currentChoiceFence.persistence, ...sourcePersistence,
        ...(ownsTransactions && sourcePersistence.transactionAll && driver.holdTargetPreimage ? { dashboardSourceFence: Object.freeze({
          transaction: sourcePersistence.transaction, transactionAll: sourcePersistence.transactionAll,
          currentSnapshots: sourcePersistence.currentSnapshots, currentSnapshot: sourcePersistence.currentSnapshot,
          observeAuthority: sourcePersistence.observeAuthority, readSealed: sourcePersistence.readSealed,
          hasSnapshotRoot: sourcePersistence.hasSnapshotRoot, readDashboardAuthority: sourcePersistence.readDashboardAuthority,
          holdTargetPreimage: driver.holdTargetPreimage,
          current: () => verifyTransactions?.(currentChoiceFence, driver) === true,
        }) } : {}),
      }
      : undefined
    const store = runtimeStore ?? driver
    const restoration = sourcePersistence
      ? createSfSourcePersistence({ ...sourceOptions, persistence: driver, purpose: "business-restore" })
      : store
    if (sourcePersistence) {
      for (const surface of ["dashboard", "planner", "procurement"] as const) await sourcePersistence.initializeSources(surface)
      await initializeAbsentSfProductState(store, randomUUID)
    }
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
    const environmentFor = async (request: Request) => ({
      at: new Date().toISOString(), id: randomUUID, directory: await identity.directory(request), bankKey: loaded.keys.bank,
    })
    const assets = { persistence: store, services: {
      signingKey: loaded.keys.assets, scannerConfiguration: config.scanner,
      scan: (bytes: Uint8Array) => scanLocalFile(bytes, config.scanner),
    } }
    let nativeOperational: NonNullable<Parameters<CreateSfHostRuntime>[0]["operational"]> | undefined
    let nativeActions: NonNullable<Parameters<CreateSfHostRuntime>[0]["nativeActions"]> | undefined
    let nativeReadBinding: NonNullable<Parameters<CreateSfHostRuntime>[0]["nativeReadBinding"]> | undefined
    if (operator && runtimeStore && currentChoiceFence && context.createHostRuntime) {
      runtime = await context.createHostRuntime({
        installationId: operator.installationId, directory, origin: config.origin,
        sourceRoot: context.sourceRoot ?? path.resolve(import.meta.dir, "../product/ai"),
        mount: config.mount, authMode: "local-operator",
        operational: (request, stamp) => nativeOperational?.(request, stamp) ?? Promise.resolve([]),
        nativeReadBinding: (operationId, producer) => nativeReadBinding?.(operationId, producer),
        nativeActions: (request, stamp, pages) => nativeActions
          ? nativeActions(request, stamp, pages)
          : Promise.reject(new Error("SF_ACTION_SOURCE_UNAVAILABLE")),
        isAuthenticated: async (request) => Boolean(await identity.person(request)),
        persistence: runtimeStore, currentChoiceFence,
        authenticate: identity.authenticate, environment: environmentFor, assets,
        grants: [{
          principalRef: `macos:${operator.installationId}:${operator.uid}`,
          namespaces: ["preferences", "reviews", "relations", "threads", "confirmations", "cases", "contributions", "documents", "receipts", "atlas", "outbox", "bi-artifacts"],
          operations: freeze.operations.map((operation) => operation.operation),
          humanActions: sfHumanActions,
        }],
      })
    }
    const report = SfReviewRoutes["reviews.report.prepare"]
    const workbench = createSfWorkbenchHttp({
      origin: config.origin,
      mount: config.mount,
      runtime: () => runtime?.services?.(),
    })
    const product = async (request: Request, surface: Surface) => {
      const response = await runtime?.services?.()?.productHttp?.(request, surface) ?? await workbench(request, surface)
      if (response) return response
      const query = new URL(request.url).searchParams
      if (surface === "dashboard" && request.method === report.method &&
        query.size === 1 && query.get("sf") === report.fixedQuery.sf) {
        return Response.json({ status: "unavailable", reason: "review-producer-unavailable" }, {
          status: 503, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
        })
      }
    }
    const applicationServices: ModuleServices = {
      persistence: store,
      authenticate: identity.authenticate,
      environment: environmentFor,
      ...(runtime ? { product,
        productView: async (request: Request, surface: Surface, page: string | undefined) =>
          runtime?.services?.()?.productView?.(request, surface, page),
      } : {}),
      maxJsonBytes: 2 * 1024 * 1024,
      assets,
    }
    const business = createModule(config.mount, applicationServices)
    const files = operator ? mountSfFilesOriginalRoutes({
      origin: config.origin, mount: config.mount,
      sources: {
        application: business,
        ...(runtime ? { imports: product, documents: product, documentScenarios: product, reviews: product } : {}),
      },
    }) : undefined
    const projection = runtime ? mountSfReviewProjection({
      origin: config.origin,
      mount: config.mount,
      readProjection: () => runtime?.services?.()?.nativeReviewProjection,
    }) : undefined
    let nativeProjections: ReturnType<typeof mountSfNativeProjections> | undefined
    if (runtime) {
      // Original authorized application, original Request and same runtime/identity.
      // This registers only the F02 closed native paths; legacy domain dispatch is
      // untouched. A missing producer context reader remains 503, never a fake grant.
      const nativeApplication = { ...applicationServices, domains: contributions }
      const nativeDependenciesBase = {
        origin: config.origin,
        mount: config.mount,
        application: nativeApplication,
        runtime: () => runtime?.services?.(),
      }
      const nativeContext = createSfContextHandler(nativeDependenciesBase)
      const nativeDependencies: SfNativeHostDependencies = {
        ...nativeDependenciesBase,
        readContext: nativeContext.readContext,
      }
      // Resolve the real host producer per Request; it may not yet be live at route registration.
      const nativeReviewHandler: SfProjectionHandler = {
        operationId: "projection.review",
        handle: async (request) => (await projection?.(request)) ?? new Response(null, { status: 503 }),
      }
      const nativeHandlers = [
          ...createSfDomainProjectionHandlers(nativeDependencies),
          ...createSfPeopleProjectionHandlers(nativeDependencies),
          ...createSfOperationsProjectionHandlers(nativeDependencies),
          ...createSfWorkProjectionHandlers(nativeDependencies),
          ...createSfPlannerProjectionHandlers(nativeDependencies),
          ...createSfProcurementProjectionHandlers(nativeDependencies),
          ...createSfDecisionsProjectionHandlers(nativeDependencies),
          ...createSfRoutinesHandlers(nativeDependencies),
          nativeReviewHandler,
        ]
      nativeProjections = mountSfNativeProjections({
        mount: config.mount,
        context: nativeContext,
        handlers: nativeHandlers.filter((handler) => handler !== nativeReviewHandler),
      })
      const productBinding = applicationServices.product
      nativeReadBinding = (operationId, producer) => {
        const current = runtime?.services?.()
        if (!current) return undefined
        if (operationId === "views.list" || operationId === "views.open" || operationId === "views.save" || operationId === "views.remove")
          return current.personalViews === producer && applicationServices.product === productBinding ? workbench : undefined
        if (operationId === "projection.review")
          return current.nativeReviewProjection === producer && projection ? nativeReviewHandler : undefined
        return current.productHttp === producer && applicationServices.product === productBinding ? productBinding : undefined
      }
      const actions = createSfActionSource(nativeDependencies, nativeHandlers)
      nativeActions = actions.actions
      // Router construction above proves these exact handlers were installed.
      nativeOperational = async (request, stamp) => {
        const observed = await Promise.allSettled([
          observeSfPlannerPages(nativeApplication, request, stamp),
          observeSfDashboardPages(nativeApplication, request, stamp),
          observeSfDomainHealth(nativeDependencies, nativeHandlers, request, stamp),
          observeSfAssetHealth({ source: () => {
            const authority = runtime?.services?.()
            return authority && nativeReadBinding && runtime?.identity() ? { application: nativeApplication, producer: business, authority } : undefined
          } }, request, stamp),
          observeSfPoHealth({ source: () => {
            const authority = runtime?.services?.()
            return authority && runtime?.identity() ? { routes: files, authority } : undefined
          } }, request, stamp),
          observeSfHome(runtime?.services?.(), request, stamp),
          observeSfWorkHealth({ source: () => {
            const current = runtime?.services?.()
            return current && nativeProjections && productBinding && runtime?.identity()
              ? { runtime: current, application: nativeApplication, handlers: nativeHandlers,
                projectionBinding: nativeProjections, productBinding } : undefined
          } }, request, stamp),
          observeSfCases(nativeDependencies, nativeHandlers, request, stamp),
          actions.operational(request, stamp),
        ])
        return observed.flatMap((item): readonly SfOperationAvailability[] => item.status === "fulfilled" ? item.value : [])
      }
    }
    const jobs = await createLocalJobs({ store, backupDirectory, mount: config.mount, ...(recoveryDrill ? { recoveryDrill } : {}), ...(operator ? { operator: { id: `macos:${operator.installationId}:${operator.uid}`, name: operator.name } } : {}), schedule: !!operator })
    services.jobs = jobs
    const discovered = runtime ? {
      publicOrigin: config.origin,
      mount: config.mount,
      authMode: "local-operator" as const,
      identity: () => runtime?.identity(),
    } : undefined
    return {
      mount: config.mount,
      ...(runtime ? { host: runtime.contributions } : {}),
      ...(discovered ? { discovery: {
        current: async (signal: AbortSignal) => signal.aborted ? undefined : discovered,
        forAdmittedLocation: async (location: Readonly<{ directory: string; workspace?: string }>, signal: AbortSignal) => {
          const installed = discovered.identity()
          if (signal.aborted || !installed || location.workspace || location.directory !== installed.location.directory) return []
          return [discovered]
        },
      } } : {}),
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
              const result = await restoreBackup(restoration, backups.source, surface, recovered.id, { id: person.id, canWrite: true, roles: ["admin"] }, true, Number(command.version), new Date().toISOString(), undefined, { retainCurrentProduct: !!sourcePersistence })
              return utilityJson(result, result.ok ? 200 : result.status)
            }
            if (command.action !== "restore-backup" || command.confirmed !== true || typeof values.id !== "string" || !/^backup-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(values.id) || !Number.isSafeInteger(command.version) || Number(command.version) < 0) return utilityJson({ ok: false, errors: ["Confirmed restoration and current revision required."] }, 422)
            // Pin verified selected bytes before capture can apply retention to older archives.
            const pinned = await pinRestoration(backups.source, surface, values.id).catch(() => null)
            if (pinned === null) return utilityJson({ ok: false, errors: ["Backup could not be verified."] }, 422)
            if (!pinned) return utilityJson({ ok: false, errors: ["Backup is no longer available."] }, 404)
            // Keep a verified copy of the current state before replacing business data.
            await backups.capture(store, surface, new Date().toISOString())
            const restored = await restoreBackup(restoration, pinned, surface, values.id, { id: person.id, canWrite: true, roles: ["admin"] }, true, Number(command.version), new Date().toISOString(), undefined, { retainCurrentProduct: !!sourcePersistence })
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
        const response = await projection?.(request) ?? await nativeProjections?.(request) ?? await files?.(request) ?? await business(request)
        if (request.method === "POST" && response?.ok) void jobs.runOnce().catch(() => undefined)
        if (!operator || !response || !response.headers.get("content-type")?.includes("text/html") || url.searchParams.has("download") || request.method === "HEAD") return response
        return localChrome(response)

      },
      async dispose() { nativeReadBinding = undefined; await jobs.dispose(); await store.dispose() },
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
  } catch (error) {
    await services.jobs?.dispose().catch(() => undefined)
    await driver.dispose().catch(() => undefined)
    throw error
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
