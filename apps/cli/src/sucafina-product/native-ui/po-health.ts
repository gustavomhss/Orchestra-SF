import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp } from "@orchestra/schema/sucafina/context"
import type { SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { publicSfData } from "../../../../../modules/sucafina/Sucafinav1/product/integration/public-state.ts"
import { roleMap } from "../../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { procurementKeys } from "../../../../../modules/sucafina/Sucafinav1/src/nav.ts"
import { readSfFilesApplicationSource } from "../../../../../modules/sucafina/Sucafinav1/runtime/native-files/routing.ts"
import { sfHasOperationalResource } from "./live-context.ts"

type Source = {
  routes: object
  authority: Pick<SfHostServices, "host" | "readContextAdmission" | "productHttp">
}

/** Original PO export infrastructure, not authorization of any selected order.
 * No renderer, private download, asset signer or scanner is invoked by discovery. */
export async function observeSfPoHealth(input: { source: () => Source | undefined },
  request: Request, stamp: SfContextStamp) {
  const sourceFor = input.source
  const source = sourceFor()
  const mounted = source && readSfFilesApplicationSource(source.routes)
  if (!source || !mounted || request.signal.aborted) return []
  const expectedStamp = digestSfValue(stamp)
  const routes = source.routes
  const authority = source.authority
  const application = mounted.application
  const producer = mounted.producer
  const origin = mounted.origin
  const mount = mounted.mount
  const url = new URL(request.url)
  if (url.origin !== origin || !url.pathname.startsWith(mount + "/") ||
    authority.host.persistence !== application.persistence ||
    authority.host.authenticate !== application.authenticate ||
    authority.host.environment !== application.environment ||
    application.assets && application.assets.persistence !== application.persistence) return []
  const dependencies = () => [
    application.persistence, application.persistence.transaction, application.authenticate,
    application.environment, application.rolePolicy, application.product, application.productView,
    application.assets, application.assets?.persistence, application.assets?.persistence.transaction,
    authority.host, authority.host.persistence, authority.host.persistence.transaction,
    authority.host.authenticate, authority.host.environment, authority.readContextAdmission, authority.productHttp,
  ]
  const pinned = dependencies()
  const current = () => {
    const next = sourceFor()
    const bound = next && readSfFilesApplicationSource(next.routes)
    const live = dependencies()
    return !request.signal.aborted && digestSfValue(stamp) === expectedStamp && input.source === sourceFor &&
      next?.routes === routes && next.authority === authority && bound?.application === application &&
      bound.producer === producer && bound.origin === origin && bound.mount === mount &&
      live.length === pinned.length && live.every((value, index) => value === pinned[index])
  }
  const admitted = async () => {
    const result = await authority.readContextAdmission(request)
    return result.status === "ok" && digestSfValue(result.stamp) === expectedStamp && current()
  }
  const read = () => application.persistence.transaction("procurement", async (snapshot) => {
    const policy = application.rolePolicy?.("procurement") ?? roleMap(snapshot, "procurement")
    const principal = await application.authenticate(request, { surface: "procurement", roleMap: policy })
    if (!current() || !principal?.id || principal.id.startsWith("local:") || principal.id !== stamp.principalRef)
      return { commit: false, value: undefined }
    const environment = await application.environment(request)
    if (!current() || !Number.isFinite(new Date(environment.at).getTime()) ||
      !snapshot.data || !snapshot.versions || !Array.isArray(snapshot.audit)) return { commit: false, value: undefined }
    const roles = principal.roles.filter((row) => row.surface === "procurement").map((row) => row.role)
    const actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer") }
    if (!procurementKeys(actor).length) return { commit: false, value: undefined }
    return { commit: false, value: digestSfValue({
      actor, policy, data: publicSfData(snapshot.data), versions: snapshot.versions, directory: environment.directory,
    }) }
  }, { signal: request.signal })
  if (!current() || !await admitted()) return []
  const first = await read()
  if (!first || !current() || !await admitted()) return []
  const second = await read()
  if (!second || first !== second || !current()) return []
  const metadata = SfOperationRegistry["files.export.po"]
  return sfHasOperationalResource("files.export.po") && metadata.method === "GET" &&
    metadata.effect === "read" && metadata.responseMode === "bytes" && metadata.pathTemplate === "{mount}/{surface}"
    ? [{ operationId: "files.export.po" as const, state: "ready" as const, reason: null, operational: true as const }]
    : []
}
