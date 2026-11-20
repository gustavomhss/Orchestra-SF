import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp } from "@orchestra/schema/sucafina/context"
import type { Application } from "../../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import type { createSfProductAuthority } from "../../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { canChangeAssetKind } from "../../../../../modules/sucafina/Sucafinav1/runtime/assets.ts"
import { roleMap } from "../../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { dashboardPages, procurementKeys } from "../../../../../modules/sucafina/Sucafinav1/src/nav.ts"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { sfHasOperationalResource } from "./live-context.ts"

type Source = {
  application: Application
  producer: object
  authority: Pick<ReturnType<typeof createSfProductAuthority>, "host" | "readContextAdmission">
}

/** Configured original attachment mechanism only. This neither probes ClamD nor
 * accepts bytes, authorizes a record, signs a link or substitutes for upload CAS. */
export async function observeSfAssetHealth(input: { source: () => Source | undefined },
  request: Request, stamp: SfContextStamp) {
  const expectedStamp = { ...stamp }
  const sourceFor = input.source
  const source = sourceFor()
  if (!source || request.signal.aborted || typeof source.producer !== "function") return []
  const application = source.application
  const authority = source.authority
  const producer = source.producer
  const assets = application.assets
  if (!assets || assets.persistence !== application.persistence ||
    authority.host.persistence !== application.persistence || authority.host.authenticate !== application.authenticate ||
    authority.host.environment !== application.environment) return []
  const configuration = assets.services.scannerConfiguration
  const scanner = configuration ? { host: configuration.host, port: configuration.port } : undefined
  const key = assets.services.signingKey
  if (!(key instanceof Uint8Array) || key.byteLength < 32) return []
  const keyDigest = digestSfValue([...key])
  const product = application.product
  const productView = application.productView
  const domains = digestSfValue([application.domains.dashboard.map((entry) => entry.pages), application.domains.procurement.map((entry) => entry.pages)])
  const dependencies = [application.persistence, application.persistence.transaction, application.authenticate,
    application.environment, application.domains, application.domains.dashboard, application.domains.procurement,
    assets, assets.persistence, assets.services, assets.services.scan, authority, authority.host,
    authority.host.authenticate, authority.host.environment, authority.readContextAdmission,
    ...application.domains.dashboard.flatMap((entry) => [entry, entry.domain, entry.domain.execute]),
    ...application.domains.procurement.flatMap((entry) => [entry, entry.domain, entry.domain.execute])]
  if (dependencies.some((dependency) => !dependency)) return []
  const current = () => {
    const next = sourceFor()
    const live = next?.application.assets
    const nextDependencies = next && live ? [next.application.persistence, next.application.persistence.transaction,
      next.application.authenticate, next.application.environment, next.application.domains,
      next.application.domains.dashboard, next.application.domains.procurement, live, live.persistence, live.services,
      live.services.scan, next.authority, next.authority.host, next.authority.host.authenticate,
      next.authority.host.environment, next.authority.readContextAdmission,
      ...next.application.domains.dashboard.flatMap((entry) => [entry, entry.domain, entry.domain.execute]),
      ...next.application.domains.procurement.flatMap((entry) => [entry, entry.domain, entry.domain.execute])] : []
    return !request.signal.aborted && digestSfValue(stamp) === digestSfValue(expectedStamp) && input.source === sourceFor && !!next && next.application === application &&
      next.producer === producer && next.authority === authority && live === assets &&
      next.application.product === product && next.application.productView === productView &&
      digestSfValue([next.application.domains.dashboard.map((entry) => entry.pages), next.application.domains.procurement.map((entry) => entry.pages)]) === domains &&
      live.services.signingKey === key && digestSfValue([...key]) === keyDigest &&
      live.services.scannerConfiguration === configuration &&
      configuration?.host === scanner?.host && configuration?.port === scanner?.port &&
      dependencies.length === nextDependencies.length && dependencies.every((dependency, index) => dependency === nextDependencies[index])
  }
  const admitted = async () => {
    const result = await authority.readContextAdmission(request)
    return result.status === "ok" && digestSfValue(result.stamp) === digestSfValue(expectedStamp) && current()
  }
  if (!current() || !await admitted()) return []
  const read = async (surface: "dashboard" | "procurement") => assets.persistence.transaction(surface, async (snapshot, blobs) => {
    const principal = await application.authenticate(request, { surface, roleMap: roleMap(snapshot, surface) })
    const environment = await application.environment(request)
    if (!current() || !principal?.id || principal.id.startsWith("local:") || principal.id !== expectedStamp.principalRef ||
      !snapshot.data || !snapshot.versions || !Array.isArray(snapshot.audit) ||
      !blobs || typeof blobs.get !== "function" || typeof blobs.put !== "function" || typeof blobs.remove !== "function" ||
      !Number.isFinite(new Date(environment.at).getTime())) return { commit: false, value: undefined }
    const roles = principal.roles.filter((role) => role.surface === surface).map((role) => role.role)
    const access = object(object(snapshot.data.access)[principal.id])
    const actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
      assigned: Array.isArray(access.assigned) ? access.assigned.filter((item): item is string => typeof item === "string") : [],
      domains: Array.isArray(access.domains) ? access.domains.filter((item): item is string => typeof item === "string") : [] }
    const summaries = Array.isArray(snapshot.data.summaries) ? snapshot.data.summaries.filter((item): item is string => typeof item === "string") : []
    const readAllowed = surface === "dashboard" ? dashboardPages(actor, summaries).includes("Vendor Contracts") : procurementKeys(actor).length > 0
    const pages = surface === "dashboard" ? ["Vendor Contracts"] : ["Suppliers", "Requests"]
    const domain = application.domains[surface].some((entry) => entry.pages.some((page) => pages.includes(page)))
    const limit = surface === "dashboard" ? 25 * 1024 * 1024 :
      object(object(snapshot.data.store).settings).uploadCap ?? object(snapshot.data.attachmentCap).value ?? snapshot.data.attachmentCap
    const named = environment.directory.some((person) => person.id === actor.id && person.name.trim())
    const uploadAllowed = named && (surface === "dashboard" ? canChangeAssetKind(actor, "contract") :
      canChangeAssetKind(actor, "supplier") || canChangeAssetKind(actor, "quote"))
    return { commit: false, value: { read: domain && readAllowed, upload: domain && uploadAllowed &&
      typeof limit === "number" && Number.isFinite(limit) && limit > 0,
      fence: digestSfValue({ actor, versions: snapshot.versions, limit: typeof limit === "number" && Number.isFinite(limit) ? limit : null, named, domain }) } }
  }, { signal: request.signal })
  const observations = await Promise.allSettled((["dashboard", "procurement"] as const).map(async (surface) => {
    const first = await read(surface)
    if (!first || !current()) return undefined
    const second = await read(surface)
    return second && first.fence === second.fence && first.read === second.read && first.upload === second.upload && current() ? second : undefined
  }))
  if (!await admitted() || !current()) return []
  const observed = observations.flatMap((entry) => entry.status === "fulfilled" && entry.value ? [entry.value] : [])
  const configured = scanner?.host === "127.0.0.1" && Number.isSafeInteger(scanner.port) && scanner.port > 0 && scanner.port <= 65535
  const candidates = [
    { id: "files.asset.link", method: "GET", effect: "read", responseMode: "json", ready: observed.some((entry) => entry.read) },
    { id: "files.asset.download", method: "GET", effect: "read", responseMode: "bytes", ready: observed.some((entry) => entry.read) },
    { id: "files.asset.upload", method: "POST", effect: "mutation", responseMode: "json",
      ready: configured && typeof assets.services.scan === "function" && observed.some((entry) => entry.upload) },
  ] as const
  return candidates.flatMap((candidate) => {
    const metadata = SfOperationRegistry[candidate.id]
    return candidate.ready && sfHasOperationalResource(candidate.id) && metadata.method === candidate.method &&
      metadata.effect === candidate.effect && metadata.responseMode === candidate.responseMode && metadata.pathTemplate === "{mount}/{surface}"
      ? [{ operationId: candidate.id, state: "ready" as const, reason: null, operational: true as const }] : []
  })
}
