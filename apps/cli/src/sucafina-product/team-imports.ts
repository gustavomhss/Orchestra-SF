import { randomUUID } from "node:crypto"
import { AsyncLocalStorage } from "node:async_hooks"
import { AbsolutePath } from "@orchestra/schema/schema"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import { dispatchSfCapability } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/capability-dispatch.ts"
import type { CreateSfHostRuntime } from "../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { createCurrentChoiceFence } from "../../../../modules/sucafina/Sucafinav1/product/decisions/current-choice-preview.ts"
import { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts"
import { createSfImportHttp } from "../../../../modules/sucafina/Sucafinav1/product/interface/import-http.ts"
import type { Application } from "../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import type { AssetServices } from "../../../../modules/sucafina/Sucafinav1/runtime/assets.ts"
import type { LocalStore } from "../../../../modules/sucafina/Sucafinav1/runtime/local-contract.ts"
import type { MicrosoftConfiguration } from "../../../../modules/sucafina/Sucafinav1/runtime/microsoft-configuration.ts"
import type { Surface } from "../../../../modules/sucafina/Sucafinav1/src/identity.ts"
import { sfUiCommandIdentity } from "./command-identity.ts"
import { createSfDocumentTargetAuthority } from "./document-authority.ts"
import { createSfImportServices } from "./import-services.ts"

type ImportRuntime = NonNullable<ReturnType<Parameters<typeof createSfImportHttp>[0]["runtime"]>>
const requestRuntime = new AsyncLocalStorage<ImportRuntime>()
const transports = new Map<string, { http: ReturnType<typeof createSfImportHttp>; activeRequests: number }>()

const modes = new Set(["imports", "import-targets", "import-admit", "import-preview", "import-reference", "import-detail", "import-apply"])

/** Compose the original private importer beneath the admitted Microsoft Team.
 * Placement and grants come only from the installation; no caller label grants authority. */
export async function runSfTeamImports(input: {
  request: Request
  origin: string
  mount: string
  surface: Surface
  partition: string
  directory: string
  principalId: string
  grants: MicrosoftConfiguration["grants"]
  persistence: LocalStore
  authenticate: Application["authenticate"]
  environment: Application["environment"]
  assets: AssetServices
  current: () => Promise<boolean>
  now: () => Date
}) {
  const { request, origin, mount, partition, directory, principalId } = input
  if (!modes.has(new URL(request.url).searchParams.get("sf") ?? "")) return undefined
  const denied = () => Response.json({ status: "denied" }, { status: 403, headers: { "Cache-Control": "no-store" } })
  const matching = input.grants.filter((grant) => grant.principalRef === principalId)
  const grant = matching[0]
  if (matching.length !== 1 || !grant || !Array.isArray(grant.namespaces) || !grant.namespaces.includes("documents") ||
      !Array.isArray(grant.operations) || !grant.operations.includes("sf_import_preview") || !await input.current()) return denied()
  const allowed = {
    principalRef: principalId,
    namespaces: ["documents"] as const,
    operations: ["sf_import_preview"],
    humanActions: (["imports.admit", "imports.apply"] as const).filter((action) =>
      Array.isArray(grant.humanActions) && grant.humanActions.includes(action)),
  }
  const identity = Object.freeze({
    installationId: partition, projectId: partition,
    hostId: digestSfValue({ partition, capability: "imports" }),
    location: Object.freeze({ directory: AbsolutePath.make(directory) }),
  })
  let authority: ReturnType<typeof createSfProductAuthority>
  // The original fence runs after the callback and before SQLite publishes the
  // blob/proof pair, catalog, source bootstrap, preview or domain transaction.
  const fence = createCurrentChoiceFence({
    persistence: input.persistence, identity: () => identity,
    host: () => authority.host,
    operationIdentity: (context) => context.kind === "ui" ? authority.ui.operationIdentity(context) : undefined,
    authorizeCommit: input.current,
  })
  const sources = createSfSourcePersistence({
    persistence: fence.persistence, enumerate: enumerateSfSources,
    projectScope: createSfSourceScopeProjector(() => input.now().toISOString()),
    createId: randomUUID, bootstrapOnWrite: true,
  })
  // Preserve the real driver's lexical snapshots. No claimed fast-read seal or
  // replacement authority is introduced for the wrapped transaction path.
  const persistence = { ...fence.persistence, ...sources }
  const authenticate: Application["authenticate"] = async (original, context) => {
    if (original !== request || !context || !await input.current()) return null
    const actor = await input.authenticate(original, context)
    return actor?.id === principalId && await input.current() ? actor : null
  }
  const environment: Application["environment"] = async (original) => {
    if (original !== request || !await input.current()) throw new Error("SF_TEAM_IMPORT_AUTHORITY_CHANGED")
    const value = await input.environment(original)
    if (!await input.current()) throw new Error("SF_TEAM_IMPORT_AUTHORITY_CHANGED")
    return value
  }
  const runtime: Parameters<CreateSfHostRuntime>[0] = {
    installationId: partition, directory, sourceRoot: directory, origin, mount,
    authMode: "microsoft", persistence, authenticate, environment, grants: [allowed],
    assets: { persistence, services: input.assets },
  }
  authority = createSfProductAuthority({
    ...runtime, identity: () => identity, policyVersion: "sf-product-v1", grants: [allowed],
    createId: randomUUID, now: () => input.now().getTime(),
    commandIdentity: async (original, operation) => original === request
      ? sfUiCommandIdentity(original, operation, { origin, mount, readOperations: new Map(), createId: randomUUID })
      : undefined,
    inspectSession: async () => undefined, verifySelection: async () => false,
    verifySkillReceipt: async () => false, providerGeneration: async () => undefined,
    authorizeDocument: createSfDocumentTargetAuthority(runtime),
  })
  const service = createSfImportServices({ runtime, authority })
  if (!service) throw new Error("SF_TEAM_IMPORT_COMPOSITION_UNAVAILABLE")
  // Dispatch consumes the UI lease before entering its handler. The original
  // descriptor must run under the fence after that consumption, never before it.
  const descriptors = service.descriptors.map((descriptor) => ({
    ...descriptor, handler: (value: unknown, context: Parameters<typeof descriptor.handler>[1]) =>
      fence.run(context, () => descriptor.handler(value, context)),
  }))
  const transportRuntime: ImportRuntime = { ui: authority.ui, human: authority.human, service: {
      ...service,
      imports: {
        ...service.imports,
        admit: (value, context) => fence.run(context, () => service.imports.admit(value, context)),
        readPreviewReference: (value, context) => fence.run(context, () => service.imports.readPreviewReference(value, context)),
        detail: (value, context) => fence.run(context, () => service.imports.detail(value, context)),
        apply: (value, context) => fence.run(context, () => service.imports.apply(value, context)),
      },
      prepareTarget: (value, context) => fence.run(context, () => service.prepareTarget(value, context)),
      dispatch: (payload, context) => dispatchSfCapability({
        operation: "sf_import_preview", payload, context, descriptors, authority: authority.authority,
        validateInput: (descriptor, value) => descriptor.id === "sf_import_preview" && decodeSfOperationInput("sf_import_preview", value).ok,
        validateOutput: (descriptor, value) => descriptor.id === "sf_import_preview" &&
          (value.status !== "ok" || decodeSfOperationOutput("sf_import_preview", value.result).ok),
      }),
      discover: (surface, context, period) => fence.run(context, async () => {
        // Only a valid original discovery request and current private writer
        // may enroll source metadata for an older Team. Refused intake never
        // bootstraps storage. This creates no user, role, grant or business row.
        const actor = await authenticate(request, { surface, roleMap: [] })
        if (actor?.canWrite && allowed.humanActions.includes("imports.admit") && await authority.host.revalidate(context)) {
          for (const target of ["dashboard", "planner", "procurement"] as const) await sources.initializeSources(target)
        }
        return service.discover(surface, context, period)
      }),
    } }
  // The original transport owns the intake count across concurrent requests.
  // Only its lifetime is shared; authority and services remain request-local.
  const transportKey = JSON.stringify([origin, mount, partition])
  let transport = transports.get(transportKey)
  if (!transport) {
    transport = { http: createSfImportHttp({ origin, mount, runtime: () => requestRuntime.getStore() }), activeRequests: 0 }
    transports.set(transportKey, transport)
  }
  transport.activeRequests += 1
  const http = transport.http
  try {
    const response = await requestRuntime.run(transportRuntime, () => http(request, input.surface))
    return response && !await input.current() ? denied() : response
  } catch (error) {
    if (error instanceof Error && error.message === "SF_CURRENT_CHOICE_FENCE_CHANGED") return denied()
    if (!await input.current().catch(() => false)) return denied()
    throw error
  } finally {
    transport.activeRequests -= 1
    if (transport.activeRequests === 0) transports.delete(transportKey)
  }
}
