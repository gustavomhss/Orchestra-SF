import path from "node:path"
import { createHash } from "node:crypto"
import type { Application } from "../../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import { createApplication } from "../../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import type { LocalStore } from "../../../../../modules/sucafina/Sucafinav1/runtime/local-contract.ts"
import { contributions } from "../../../../../modules/sucafina/Sucafinav1/index.ts"
import { scanLocalFile } from "../../../../../modules/sucafina/Sucafinav1/runtime/local-scanner.ts"
import type { SfScopedSourcePort } from "../../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import type { CreateSfHostRuntime } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { createSfHostRuntime } from "../../../../../apps/cli/src/sucafina-product/host-context.ts"
import { createSfContextHandler } from "../../../../../apps/cli/src/sucafina-product/native-ui/context.ts"
import { mountSfNativeProjections, type SfNativeHostDependencies } from "../../../../../apps/cli/src/sucafina-product/native-ui/router.ts"
import { createSfDomainProjectionHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/domain.ts"
import { observeSfDashboardPages } from "../../../../../apps/cli/src/sucafina-product/native-ui/dashboard-operational.ts"
import { observeSfDomainHealth } from "../../../../../apps/cli/src/sucafina-product/native-ui/domain-health.ts"
import { observeSfAssetHealth } from "../../../../../apps/cli/src/sucafina-product/native-ui/asset-health.ts"
import { createSfActionSource } from "../../../../../apps/cli/src/sucafina-product/native-ui/action-source.ts"
import { createSfPeopleProjectionHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/people.ts"
import { createSfOperationsProjectionHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/operations.ts"
import { createSfWorkProjectionHandlers, observeSfHome } from "../../../../../apps/cli/src/sucafina-product/native-ui/work.ts"
import { createSfPlannerProjectionHandlers, observeSfPlannerPages } from "../../../../../apps/cli/src/sucafina-product/native-ui/planner.ts"
import { createSfProcurementProjectionHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/procurement.ts"
import { createSfDecisionsProjectionHandlers, observeSfCases } from "../../../../../apps/cli/src/sucafina-product/native-ui/decisions.ts"
import { createSfRoutinesHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/routines.ts"
import type { SfTrustedInstallationSource } from "../../../../server/src/sucafina-installations.ts"

/** The existing Actions host composes the production host graph and native
 * projections with its real SQLite store, operator sessions and ClamD.
 * Identity and discovery become available only after that graph initializes.
 */
export async function createOperationsInstallation(input: {
  installationId: string
  directory: string
  origin: string
  mount: string
  operators: readonly { principalRef: string; readOnly: boolean }[]
  grants?: Parameters<CreateSfHostRuntime>[0]["grants"]
  persistence: LocalStore & SfScopedSourcePort
  authenticate: Application["authenticate"]
  isAuthenticated: (request: Request) => Promise<boolean>
  environment: Application["environment"]
  signingKey: Uint8Array
  scanner: { host: "127.0.0.1"; port: number } | null
}) {
  if (input.scanner && (input.scanner.host !== "127.0.0.1" ||
    !Number.isInteger(input.scanner.port) || input.scanner.port < 1 || input.scanner.port > 65535))
    throw new Error("OPERATIONS_SCANNER_LOOPBACK_ENDPOINT_REQUIRED")
  // Record the original scanner result at the installed boundary. The private
  // controls observe digests and verdicts; uploaded bytes never leave this call.
  const scans: Readonly<{ digest: string; size: number; accepted: boolean }>[] = []
  const assets = { persistence: input.persistence, services: {
    signingKey: input.signingKey,
    scannerConfiguration: input.scanner,
    scan: async (bytes: Uint8Array) => {
      const digest = createHash("sha256").update(bytes).digest("hex")
      const size = bytes.byteLength
      const accepted = await scanLocalFile(bytes, input.scanner)
      scans.push(Object.freeze({ digest, size, accepted }))
      return accepted
    },
  } }
  let nativeOperational: Parameters<CreateSfHostRuntime>[0]["operational"]
  let nativeActions: Parameters<CreateSfHostRuntime>[0]["nativeActions"]
  let nativeReadBinding: Parameters<CreateSfHostRuntime>[0]["nativeReadBinding"]
  const runtime = await createSfHostRuntime({
    installationId: input.installationId,
    directory: input.directory,
    sourceRoot: path.resolve(import.meta.dirname, "../../../../../modules/sucafina/Sucafinav1/product/ai"),
    origin: input.origin,
    mount: input.mount,
    authMode: "local-operator",
    isAuthenticated: input.isAuthenticated,
    persistence: input.persistence,
    authenticate: input.authenticate,
    environment: input.environment,
    assets,
    operational: (request, stamp) => nativeOperational?.(request, stamp) ?? Promise.resolve([]),
    nativeReadBinding: (operationId, producer) => nativeReadBinding?.(operationId, producer),
    nativeActions: (request, stamp, pages) => nativeActions
      ? nativeActions(request, stamp, pages) : Promise.reject(new Error("SF_ACTION_SOURCE_UNAVAILABLE")),
    // Preserve the installation policy from the original Operations fixture.
    // Domain roles still come exclusively from the authenticated operator session.
    grants: input.grants ?? input.operators.map((operator): NonNullable<Parameters<CreateSfHostRuntime>[0]["grants"]>[number] => ({
      principalRef: operator.principalRef,
      namespaces: ["documents", "receipts"],
      operations: ["sf_request_read", "sf_import_preview", "sf_document_extract", "sf_knowledge_search", "sf_evidence_get"],
      humanActions: operator.readOnly ? [] : ["imports.admit", "imports.apply", "documents.schema", "documents.confirm"],
    })),
  })
  const application: Application = {
    persistence: input.persistence,
    authenticate: input.authenticate,
    environment: input.environment,
    assets,
    product: async (request, surface) => runtime.services?.()?.productHttp?.(request, surface),
    productView: async (request, surface, page) => runtime.services?.()?.productView?.(request, surface, page),
    domains: contributions,
    maxJsonBytes: 100_000,
  }
  const dependenciesBase = {
    origin: input.origin,
    mount: input.mount,
    application,
    runtime: () => runtime.services?.(),
  }
  const context = createSfContextHandler(dependenciesBase)
  const dependencies: SfNativeHostDependencies = { ...dependenciesBase, readContext: context.readContext }
  const reviewHandler = Object.freeze({
    operationId: "projection.review" as const,
    handle: async (request: Request) => {
      const producer = runtime.services?.()?.nativeReviewProjection
      return producer ? producer.handle(request) : Response.json(
        { status: "unavailable", reason: "review-producer-unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
      )
    },
  })
  const handlers = [
    ...createSfDomainProjectionHandlers(dependencies),
    ...createSfPeopleProjectionHandlers(dependencies),
    ...createSfOperationsProjectionHandlers(dependencies),
    ...createSfWorkProjectionHandlers(dependencies),
    ...createSfPlannerProjectionHandlers(dependencies),
    ...createSfProcurementProjectionHandlers(dependencies),
    ...createSfDecisionsProjectionHandlers(dependencies),
    ...createSfRoutinesHandlers(dependencies),
    reviewHandler,
  ]
  const native = mountSfNativeProjections({ mount: input.mount, context, handlers })
  const productBinding = application.product
  nativeReadBinding = (operationId, producer) => {
    const current = runtime.services?.()
    if (!current) return undefined
    if (operationId === "projection.review")
      return current.nativeReviewProjection === producer && handlers.includes(reviewHandler) ? reviewHandler : undefined
    return current.productHttp === producer && application.product === productBinding ? productBinding : undefined
  }
  const actions = createSfActionSource(dependencies, handlers)
  nativeActions = actions.actions
  nativeOperational = async (request, stamp) => {
    const observed = await Promise.allSettled([
      observeSfPlannerPages(application, request, stamp),
      observeSfDashboardPages(application, request, stamp),
      observeSfDomainHealth(dependencies, handlers, request, stamp),
      observeSfAssetHealth({ source: () => {
        const authority = runtime.services?.()
        return authority && runtime.identity() ? { application, producer: business, authority } : undefined
      } }, request, stamp),
      observeSfHome(runtime.services?.(), request, stamp),
      observeSfCases(dependencies, handlers, request, stamp),
      actions.operational(request, stamp),
    ])
    return observed.flatMap((item) => item.status === "fulfilled" ? item.value : [])
  }
  const business = createApplication(input.mount, application)
  const discovery: SfTrustedInstallationSource = {
    current: async (signal) => signal.aborted ? undefined : {
      publicOrigin: input.origin, mount: input.mount, authMode: "local-operator", identity: runtime.identity,
    },
    forAdmittedLocation: async (location, signal) => {
      const identity = runtime.identity()
      if (signal.aborted || !identity || location.workspace || location.directory !== identity.location.directory) return []
      return [{ publicOrigin: input.origin, mount: input.mount, authMode: "local-operator", identity: runtime.identity }]
    },
  }
  return {
    scannerObservations: () => [...scans],
    host: runtime.contributions,
    discovery,
    identity: runtime.identity,
    services: runtime.services,
    application: async (request: Request) => await native(request) ?? await business(request),
  }
}
