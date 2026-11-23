import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import { SfFileRoutes } from "@orchestra/schema/sucafina/files/routes"
import type { SfContextStamp, SfOperationAvailability } from "@orchestra/schema/sucafina/context"
import type { SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { publicSfData } from "../../../../../modules/sucafina/Sucafinav1/product/integration/public-state.ts"
import { roleMap } from "../../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object, rows, text } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { dashboardPages, plannerKeys, procurementKeys } from "../../../../../modules/sucafina/Sucafinav1/src/nav.ts"
import { readSfFilesApplicationSource } from "../../../../../modules/sucafina/Sucafinav1/runtime/native-files/routing.ts"
import { sfHasOperationalResource } from "./live-context.ts"

type Source = {
  routes: object
  authority: Pick<SfHostServices, "host" | "readContextAdmission" | "productHttp">
}
type ExportId = "files.export.xlsx" | "files.export.json" | "files.export.register" | "files.export.suppliers"

/** Observe the actual mounted download reader, original role policy and source
 * twice. Discovery never generates a workbook, decrypts supplier bank details or
 * records a private download. Each download retains its original read/egress fences.
 */
export async function observeSfExportHealth(input: { source: () => Source | undefined },
  request: Request, stamp: SfContextStamp): Promise<readonly SfOperationAvailability[]> {
  const sourceFor = input.source, source = sourceFor()
  const mounted = source && readSfFilesApplicationSource(source.routes)
  if (!source || !mounted || request.signal.aborted) return []
  const expectedStamp = digestSfValue(stamp), routes = source.routes, authority = source.authority
  const application = mounted.application, producer = mounted.producer
  const origin = mounted.origin, mount = mounted.mount, url = new URL(request.url)
  if (url.origin !== origin || !url.pathname.startsWith(mount + "/") ||
    authority.host.persistence !== application.persistence || authority.host.authenticate !== application.authenticate ||
    authority.host.environment !== application.environment) return []
  const dependencies = () => [
    application.persistence, application.persistence.transaction, application.authenticate, application.environment,
    application.rolePolicy, application.product, application.productView, authority.host, authority.host.persistence,
    authority.host.persistence.transaction, authority.host.authenticate, authority.host.environment,
    authority.readContextAdmission, authority.productHttp,
  ]
  const pinned = dependencies()
  const current = () => {
    const next = sourceFor(), bound = next && readSfFilesApplicationSource(next.routes), live = dependencies()
    return !request.signal.aborted && digestSfValue(stamp) === expectedStamp && input.source === sourceFor &&
      next?.routes === routes && next.authority === authority && bound?.application === application &&
      bound.producer === producer && bound.origin === origin && bound.mount === mount &&
      live.length === pinned.length && live.every((value, index) => value === pinned[index])
  }
  const admitted = async () => {
    const result = await authority.readContextAdmission(request)
    return result.status === "ok" && digestSfValue(result.stamp) === expectedStamp && current()
  }
  const read = (surface: "dashboard" | "planner" | "procurement") => application.persistence.transaction(surface, async (snapshot) => {
    const policy = application.rolePolicy?.(surface) ?? roleMap(snapshot, surface)
    const principal = await application.authenticate(request, { surface, roleMap: policy })
    if (!current() || !principal?.id || principal.id.startsWith("local:") || principal.id !== stamp.principalRef)
      return { commit: false, value: undefined }
    const environment = await application.environment(request)
    if (!current() || !Number.isFinite(new Date(environment.at).getTime()) ||
      !snapshot.data || !snapshot.versions || !Array.isArray(snapshot.audit)) return { commit: false, value: undefined }
    const roles = principal.roles.filter((row) => row.surface === surface).map((row) => row.role)
    const actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer") }
    const summaries = Array.isArray(snapshot.data.summaries)
      ? snapshot.data.summaries.filter((entry): entry is string => typeof entry === "string") : []
    const pages = surface === "dashboard" ? dashboardPages(actor, summaries)
      : surface === "planner" ? plannerKeys(actor) : procurementKeys(actor)
    if (!pages.length) return { commit: false, value: undefined }
    const operations: ExportId[] = []
    if (surface === "dashboard" && roles.includes("admin")) operations.push("files.export.json")
    if (surface === "procurement") {
      operations.push("files.export.register")
      if ((!roles.includes("admin") && !roles.includes("supplier admin")) || environment.bankKey)
        operations.push("files.export.suppliers")
    }
    if (surface === "planner" && roles.some((role) => ["admin", "hr", "finance", "budget owner", "viewer"].includes(role))) {
      const versions = Array.isArray(snapshot.data.versions) ? rows(snapshot.data.versions)
        : Object.entries(object(snapshot.data.versions)).map(([id, value]) => ({ ...object(value), id: object(value).id ?? id }))
      const selected = text(snapshot.data.curId) || text(object(snapshot.data.app).officialId)
      if (selected ? versions.some((version) => String(version.id) === selected) : versions.length > 0)
        operations.push("files.export.xlsx")
    }
    return { commit: false, value: { operations, fence: digestSfValue({
      actor, policy, pages, data: publicSfData(snapshot.data), versions: snapshot.versions,
      directory: environment.directory, bankKey: environment.bankKey,
    }) } }
  }, { signal: request.signal })
  if (!current() || !await admitted()) return []
  const observed = await Promise.allSettled((["dashboard", "planner", "procurement"] as const).map(async (surface) => {
    const first = await read(surface)
    if (!first || !current()) return []
    if (first.operations.includes("files.export.xlsx")) {
      const available = await Promise.all([
        import("../../../../../modules/sucafina/Sucafinav1/runtime/workbooks.ts"), import("exceljs"),
      ]).catch(() => undefined)
      if (!available || typeof available[0].exportPlanner !== "function" || typeof available[1].Workbook !== "function")
        return []
    }
    const second = await read(surface)
    if (!second || first.fence !== second.fence || digestSfValue(first.operations) !== digestSfValue(second.operations) || !current()) return []
    return second.operations.filter((id) => {
      const metadata = SfOperationRegistry[id], route = SfFileRoutes[id]
      return sfHasOperationalResource(id) && metadata.method === "GET" && metadata.effect === "read" &&
        metadata.responseMode === "bytes" && metadata.pathTemplate === "{mount}/{surface}" &&
        route.fixedQuery.download === id.slice("files.export.".length)
    }).map((operationId) => ({ operationId, state: "ready" as const, reason: null, operational: true as const }))
  }))
  if (!current() || !await admitted()) return []
  return observed.flatMap((entry): readonly SfOperationAvailability[] => entry.status === "fulfilled" ? entry.value : [])
}
