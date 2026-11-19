import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp, SfOperationAvailability } from "@orchestra/schema/sucafina/context"
import { roleMap } from "../../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { dashboardPages, procurementKeys } from "../../../../../modules/sucafina/Sucafinav1/src/nav.ts"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { SfNativeHostDependencies } from "./router.ts"
import { sfHasOperationalResource } from "./live-context.ts"

/** Observe the original mounted Application and private asset services.
 * This does not authorize a selected record or admit any file. Its real upload
 * still authenticates, checks record/CAS and scans the submitted bytes again.
 */
export async function observeSfAssetHealth(
  deps: SfNativeHostDependencies,
  installed: () => object | undefined,
  request: Request,
  stamp: SfContextStamp,
): Promise<readonly SfOperationAvailability[]> {
  const application = deps.application, runtime = deps.runtime(), producer = installed()
  const assets = application.assets
  if (!runtime || !producer || !assets || assets.persistence !== application.persistence ||
    typeof assets.persistence.transaction !== "function" || typeof assets.services.scan !== "function" ||
    !(assets.services.signingKey instanceof Uint8Array) || assets.services.signingKey.byteLength < 32 ||
    request.signal.aborted) return []
  const services = assets.services, signingKey = services.signingKey, scan = services.scan
  const authenticate = application.authenticate, environmentFor = application.environment
  const current = () => deps.application === application && deps.runtime() === runtime &&
    application.assets === assets && application.persistence === assets.persistence &&
    application.authenticate === authenticate && application.environment === environmentFor &&
    assets.services === services && services.signingKey === signingKey && services.scan === scan &&
    installed() === producer && !request.signal.aborted
  const admitted = async () => {
    if (!current()) return false
    const context = await runtime.readContextAdmission(request)
    return context.status === "ok" && digestSfValue(context.stamp) === digestSfValue(stamp) && current()
  }
  if (!await admitted()) return []
  const environment = await environmentFor(request)
  if (!Number.isFinite(Date.parse(environment.at)) || !current()) return []
  const read = async (surface: "dashboard" | "procurement") =>
    assets.persistence.transaction(surface, async (snapshot, blobs) => {
      if (!current() || !blobs || typeof blobs.get !== "function" || typeof blobs.put !== "function" ||
        typeof blobs.remove !== "function" || !snapshot.data || !snapshot.versions || !Array.isArray(snapshot.audit))
        return { commit: false, value: undefined }
      const principal = await authenticate(request, { surface, roleMap: roleMap(snapshot, surface) })
      if (!principal || principal.id !== stamp.principalRef || principal.id.startsWith("local:") || !current())
        return { commit: false, value: undefined }
      const roles = principal.roles.filter((row) => row.surface === surface).map((row) => row.role)
      const access = object(object(snapshot.data.access)[principal.id])
      const actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
        assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [],
        domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      const summaries = Array.isArray(snapshot.data.summaries)
        ? snapshot.data.summaries.filter((value): value is string => typeof value === "string") : []
      const pages = surface === "dashboard" ? dashboardPages(actor, summaries) : procurementKeys(actor)
      const readable = surface === "dashboard" ? pages.includes("Vendor Contracts") : pages.length > 0
      const cap = surface === "dashboard" ? 25 * 1024 * 1024 :
        object(object(snapshot.data.store).settings).uploadCap ?? object(snapshot.data.attachmentCap).value ?? snapshot.data.attachmentCap
      const writable = readable && actor.canWrite && environment.directory.some((person) => person.id === actor.id && person.name.trim()) &&
        typeof cap === "number" && Number.isFinite(cap) && cap > 0
      return { commit: false, value: { readable, writable,
        fence: digestSfValue({ versions: snapshot.versions, assets: snapshot.data.assets ?? [], actor, pages, cap: typeof cap === "number" && Number.isFinite(cap) ? cap : null }) } }
    }, { signal: request.signal })
  const surfaces = await Promise.allSettled((["dashboard", "procurement"] as const).map(async (surface) => {
    const first = await read(surface), second = await read(surface)
    return first && second && first.fence === second.fence && current() ? second : undefined
  }))
  const observed = surfaces.flatMap((entry) => entry.status === "fulfilled" && entry.value ? [entry.value] : [])
  if (!observed.some((entry) => entry.readable) || !await admitted()) return []
  // scanLocalFile accepts the empty INSTREAM health payload only after the exact
  // clean reply. No asset, source reference, blob or acceptance receipt is made.
  const scannerReady = observed.some((entry) => entry.writable)
    ? await services.scan(new Uint8Array(), "application/octet-stream").catch(() => false) : false
  if (!await admitted()) return []
  const candidates = [
    { id: "files.asset.link", method: "GET", responseMode: "json", ready: true },
    { id: "files.asset.download", method: "GET", responseMode: "bytes", ready: true },
    { id: "files.asset.upload", method: "POST", responseMode: "json", ready: scannerReady },
  ] as const
  return candidates.flatMap((candidate) => {
    const metadata = SfOperationRegistry[candidate.id]
    return candidate.ready && sfHasOperationalResource(candidate.id) &&
      metadata.pathTemplate === "{mount}/{surface}" && metadata.method === candidate.method &&
      metadata.responseMode === candidate.responseMode && current()
      ? [{ operationId: candidate.id, state: "ready" as const, reason: null, operational: true as const }] : []
  })
}
