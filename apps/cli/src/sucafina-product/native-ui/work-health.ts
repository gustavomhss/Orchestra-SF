import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp, SfOperationAvailability } from "@orchestra/schema/sucafina/context"
import type { SfOperationId } from "@orchestra/schema/sucafina/common"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { sfOperationInputSchemas } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import { sfOperationOutputSchemas } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/output-schemas.ts"
import type { CreateSfHostRuntime, SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import type { CapabilityDescriptor, TrustedUiContext } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { isSfProductStateReader, selectSfNamespaceHealth } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import { sfSourceIdentity } from "../../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { roleMap } from "../../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { ProcurementModule } from "../../../../../modules/sucafina/Sucafinav1/runtime/procurement.ts"
import { procurementKeys } from "../../../../../modules/sucafina/Sucafinav1/src/nav.ts"
import type { createSfDocumentServices } from "../document-services.ts"
import type { SfNativeHostDependencies, SfProjectionHandler } from "./router.ts"
import { sfHasOperationalResource } from "./live-context.ts"

type WorkRuntime = Pick<SfHostServices, "ui" | "state" | "host" | "work" | "workDestinations" | "procurementSelections" | "productHttp">
type WorkSource = Readonly<{
  runtime: WorkRuntime
  application: Pick<SfNativeHostDependencies["application"], "authenticate" | "environment" | "domains" | "product">
  handlers: readonly SfProjectionHandler[]
  /** Exact installed route functions, supplied only by the mounting installation. */
  projectionBinding: object
  productBinding: object
}>
type DocumentServices = NonNullable<ReturnType<typeof createSfDocumentServices>>
type SearchSource = Readonly<{
  producer: object
  handler: object
  service: Pick<DocumentServices, "descriptors"> & { documents: Pick<DocumentServices["documents"], "search"> }
  assets: Readonly<{ persistence: object }>
  catalog: readonly CapabilityDescriptor[]
  dispatch: SfHostServices["dispatch"]
}>

/** Work infrastructure only. No period, selection reference, work item or destination is created/read. */
export async function observeSfWorkHealth(input: {
  source: () => WorkSource | undefined
}, request: Request, stamp: SfContextStamp): Promise<readonly SfOperationAvailability[]> {
  const sourceFor = input.source
  const source = sourceFor()
  if (!source || request.signal.aborted || typeof source.projectionBinding !== "function" ||
    typeof source.productBinding !== "function" || source.application.product !== source.productBinding) return []
  const runtime = source.runtime
  const ui = runtime.ui
  const finish = ui.finish
  const state = runtime.state
  const host = runtime.host
  if (typeof runtime.work?.listPresentation !== "function" || typeof runtime.procurementSelections?.create !== "function" || !isSfProductStateReader(state, host.persistence) || typeof runtime.productHttp !== "function" ||
    host.authenticate !== source.application.authenticate || host.environment !== source.application.environment ||
    source.application.domains.procurement.find((entry) => entry.pages.includes("Requests"))?.domain !== ProcurementModule.domain) return []
  const expected = Object.freeze({ ...stamp })
  const stampDigest = digestSfValue(expected)
  const dependencies = () => [runtime.ui, runtime.state, runtime.host, runtime.work, runtime.procurementSelections,
    runtime.workDestinations, runtime.productHttp, ui.admit, ui.validate, ui.revalidate, ui.requestFor, ui.finish,
    state.read, host.persistence, host.persistence.transaction, host.authenticate, host.environment, host.requestFor, host.revalidate,
    runtime.work?.listPresentation, runtime.procurementSelections?.create, runtime.workDestinations?.read]
  const original = dependencies()
  const handlers = source.handlers.map((entry) => [entry, entry.operationId, entry.handle] as const)
  const current = () => {
    const next = sourceFor()
    return !request.signal.aborted && input.source === sourceFor && isSfProductStateReader(state, host.persistence) && digestSfValue(stamp) === stampDigest &&
      next?.runtime === runtime && next.application === source.application && next.handlers === source.handlers &&
      next.projectionBinding === source.projectionBinding && next.productBinding === source.productBinding &&
      next.application.product === source.productBinding &&
      next.application.authenticate === host.authenticate && next.application.environment === host.environment &&
      next.application.domains.procurement.find((entry) => entry.pages.includes("Requests"))?.domain === ProcurementModule.domain &&
      original.every((entry, index) => entry === dependencies()[index]) &&
      handlers.length === source.handlers.length && handlers.every(([entry, operation, handle], index) =>
        source.handlers[index] === entry && entry.operationId === operation && entry.handle === handle)
  }
  const candidates = [
    { operation: "sf_work_list", ids: ["projection.work-selection", "projection.work"], projections: ["projection.work-selection", "projection.work"], detail: false },
    { operation: "sf-human:collaboration.work.list", ids: ["collaboration.work-list"], projections: ["projection.work"], detail: false },
    { operation: "sf-human:collaboration.work.destination", ids: ["projection.work-item", "collaboration.work-destination"], projections: ["projection.work-item"], detail: true },
  ] as const
  const observed = await Promise.allSettled(candidates.map(async (candidate) => {
    if (!current() || candidate.detail && typeof runtime.workDestinations?.read !== "function" ||
      candidate.ids.some((id) => !workOperation(id)) ||
      candidate.projections.some((id) => source.handlers.filter((entry) => entry.operationId === id && typeof entry.handle === "function").length !== 1)) return []
    const digest = digestSfValue({ purpose: "native-work-source-health", operation: candidate.operation })
    const admitted = await ui.admit(request, candidate.operation, digest)
    if (admitted.status !== "ok") return []
    try {
      if (!matches(admitted.value, expected) || !await ui.validate(admitted.value, candidate.operation, digest) ||
        ui.requestFor(admitted.value) !== request || !current()) return []
      const first = await workSourceHealth(runtime, request, expected)
      if (!first || !current()) return []
      const second = await workSourceHealth(runtime, request, expected)
      if (!second || first !== second || !current() || !await ui.revalidate(admitted.value) ||
        ui.requestFor(admitted.value) !== request || !current()) return []
      return candidate.ids.map((operationId) => ({ operationId, state: "ready" as const, reason: null, operational: true as const }))
    } finally { finish(admitted.value) }
  }))
  return observed.flatMap((entry) => entry.status === "fulfilled" ? entry.value : [])
}

/** The original Documents search descriptor and namespace; never run a synthetic private query. */
export async function observeSfSearchHealth(input: {
  ui: SfHostServices["ui"]
  state: SfHostServices["state"]
  persistence: SfHostServices["host"]["persistence"]
  binding?: Parameters<CreateSfHostRuntime>[0]["nativeReadBinding"]
  source: () => SearchSource | undefined
}, request: Request, stamp: SfContextStamp): Promise<readonly SfOperationAvailability[]> {
  const sourceFor = input.source, bindingFor = input.binding, ui = input.ui, state = input.state
  const source = sourceFor()
  const finish = ui.finish
  const metadata = SfOperationRegistry["projection.search"]
  if (!source || !bindingFor || !isSfProductStateReader(state, input.persistence) || request.signal.aborted || !sfHasOperationalResource("projection.search") ||
    metadata.method !== "POST" || metadata.effect !== "read" || metadata.responseMode !== "json" ||
    metadata.pathTemplate !== "{mount}/api/ui/projections/search" || typeof source.producer !== "function" ||
    typeof source.handler !== "function" || source.assets.persistence !== input.persistence ||
    typeof source.service.documents.search !== "function" || typeof source.dispatch !== "function") return []
  const selected = source.service.descriptors.filter((entry) => entry.id === "sf_knowledge_search")
  const descriptor = selected[0]
  if (selected.length !== 1 || !descriptor || source.catalog.filter((entry) => entry.id === descriptor.id).length !== 1 ||
    !source.catalog.includes(descriptor) || descriptor.pack !== "knowledge" || descriptor.mode !== "read" ||
    descriptor.handlerExport !== "searchDocumentEvidence" || descriptor.producerTask !== "WP06.T05" ||
    descriptor.inputSchema !== sfOperationInputSchemas.sf_knowledge_search ||
    descriptor.outputSchema !== sfOperationOutputSchemas.sf_knowledge_search ||
    typeof descriptor.handler !== "function" ||
    digestSfValue(descriptor.requiredAuthority) !== digestSfValue(["documents:read"])) return []
  const installed = bindingFor("files.document-sources", source.producer)
  if (!installed) return []
  const expected = Object.freeze({ ...stamp })
  const stampDigest = digestSfValue(expected)
  const descriptorDigest = digestSfValue({ id: descriptor.id, pack: descriptor.pack, mode: descriptor.mode,
    handlerExport: descriptor.handlerExport, producerTask: descriptor.producerTask, grantProfiles: descriptor.grantProfiles,
    requiredAuthority: descriptor.requiredAuthority, input: descriptor.inputSchema, output: descriptor.outputSchema })
  const dependencies = [ui.admit, ui.validate, ui.revalidate, ui.requestFor, ui.finish, state.read,
    source.service.documents, source.service.documents.search, source.service.descriptors, descriptor.handler,
    descriptor.inputSchema, descriptor.outputSchema, source.assets.persistence, input.persistence]
  const current = () => {
    const next = sourceFor()
    return !request.signal.aborted && input.source === sourceFor && input.binding === bindingFor &&
      input.ui === ui && input.state === state && isSfProductStateReader(state, input.persistence) && digestSfValue(stamp) === stampDigest &&
      next?.producer === source.producer && next.handler === source.handler && next.service === source.service &&
      next.assets === source.assets && next.dispatch === source.dispatch && next.catalog === source.catalog &&
      next.service.descriptors.filter((entry) => entry.id === "sf_knowledge_search").length === 1 &&
      next.service.descriptors.includes(descriptor) &&
      next.catalog.filter((entry) => entry.id === "sf_knowledge_search").length === 1 && next.catalog.includes(descriptor) &&
      bindingFor("files.document-sources", source.producer) === installed &&
      dependencies.every((entry, index) => entry === [ui.admit, ui.validate, ui.revalidate, ui.requestFor, ui.finish, state.read,
        source.service.documents, source.service.documents.search, source.service.descriptors, descriptor.handler,
        descriptor.inputSchema, descriptor.outputSchema, source.assets.persistence, input.persistence][index]) &&
      descriptorDigest === digestSfValue({ id: descriptor.id, pack: descriptor.pack, mode: descriptor.mode,
        handlerExport: descriptor.handlerExport, producerTask: descriptor.producerTask, grantProfiles: descriptor.grantProfiles,
        requiredAuthority: descriptor.requiredAuthority, input: descriptor.inputSchema, output: descriptor.outputSchema })
  }
  const digest = digestSfValue({ purpose: "native-document-search-source-health" })
  const admitted = await ui.admit(request, "sf_knowledge_search", digest)
  if (admitted.status !== "ok") return []
  try {
    if (!matches(admitted.value, expected) || !await ui.validate(admitted.value, "sf_knowledge_search", digest) ||
      ui.requestFor(admitted.value) !== request || !current()) return []
    const read = () => state.read(request, "documents", selectSfNamespaceHealth("documents", expected))
    const first = await read()
    if (!health(first) || !current()) return []
    const second = await read()
    if (!health(second) || first.storageVersion !== second.storageVersion ||
      first.aggregateRevision !== second.aggregateRevision || first.incarnation !== second.incarnation || !current() ||
      !await ui.revalidate(admitted.value) || ui.requestFor(admitted.value) !== request || !current()) return []
    return [{ operationId: "projection.search", state: "ready", reason: null, operational: true }]
  } catch { return [] }
  finally { finish(admitted.value) }
}

function matches(call: TrustedUiContext, stamp: SfContextStamp) {
  return call.binding.installationId === stamp.installationId && call.binding.projectId === stamp.projectId &&
    call.binding.principalRef === stamp.principalRef && call.binding.policyVersion === stamp.policyVersion &&
    call.binding.accessRevision === stamp.accessRevision
}

type NamespaceHealth = { storageVersion: number; aggregateRevision: number; incarnation: string }
function health(value: Awaited<ReturnType<SfHostServices["state"]["read"]>>): value is {
  status: "ok"; storageVersion: number; aggregateRevision: number; incarnation: string; value: NamespaceHealth
} {
  if (value.status !== "ok" || !value.value || typeof value.value !== "object") return false
  const projected = value.value as Partial<NamespaceHealth>
  return Number.isSafeInteger(value.storageVersion) && value.storageVersion >= 0 &&
    Number.isSafeInteger(value.aggregateRevision) && value.aggregateRevision >= 0 && !!value.incarnation &&
    projected.storageVersion === value.storageVersion && projected.aggregateRevision === value.aggregateRevision &&
    projected.incarnation === value.incarnation
}

async function workSourceHealth(runtime: WorkRuntime, request: Request, stamp: SfContextStamp) {
  const namespaces = await Promise.all((["threads", "relations", "confirmations"] as const).map((namespace) =>
    runtime.state.read(request, namespace, (state, authority) =>
      authority.principalRef === stamp.principalRef && authority.policyVersion === stamp.policyVersion &&
      authority.accessRevision === stamp.accessRevision
        ? { storageVersion: state.versions[namespace], aggregateRevision: state.revision, incarnation: state.incarnation }
        : undefined)))
  if (!namespaces.every(health) || namespaces.some((entry) => entry.aggregateRevision !== namespaces[0]?.aggregateRevision ||
    entry.incarnation !== namespaces[0]?.incarnation)) return undefined
  const environment = await runtime.host.environment(request)
  if (!Number.isFinite(Date.parse(environment.at)) || request.signal.aborted) return undefined
  const collection = await runtime.host.persistence.transaction("procurement", async (snapshot) => {
    const principal = await runtime.host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
    if (!principal?.id || principal.id.startsWith("local:") || principal.id !== stamp.principalRef || request.signal.aborted)
      return { commit: false, value: undefined }
    const roles = principal.roles.filter((entry) => entry.surface === "procurement").map((entry) => entry.role)
    if (!procurementKeys({ roles }).length) return { commit: false, value: undefined }
    const actor = { id: principal.id, roles, canWrite: principal.canWrite, assigned: [], domains: [] }
    const source = sfSourceIdentity(snapshot, "procurement-request-selection", "all")
    if (!source) return { commit: false, value: undefined }
    const currency = object(ProcurementModule.domain.view(snapshot, actor, environment).data.formSettings).currency
    if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) return { commit: false, value: undefined }
    return { commit: false, value: digestSfValue({ source, actor, versions: snapshot.versions, currency }) }
  }, { signal: request.signal })
  return collection ? digestSfValue({ collection, namespaces: namespaces.map((entry) => entry.value) }) : undefined
}

function workOperation(id: SfOperationId) {
  if (!sfHasOperationalResource(id)) return false
  const metadata = SfOperationRegistry[id]
  if (metadata.responseMode !== "json" || metadata.effect !== "read") return false
  if (id === "projection.work" || id === "projection.work-item" || id === "projection.work-selection")
    return metadata.method === "GET" && metadata.pathTemplate === "{mount}/api/ui/projections/" + id.slice("projection.".length)
  return (id === "collaboration.work-list" || id === "collaboration.work-destination") &&
    metadata.method === "POST" && metadata.pathTemplate === "{mount}/dashboard" &&
    "fixedQuery" in metadata && "sf" in metadata.fixedQuery && metadata.fixedQuery.sf === id.replace("collaboration.", "collaboration-")
}
