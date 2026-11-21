import type { SfContextStamp, SfOperationAvailability } from "@orchestra/schema/sucafina/context"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { CreateSfHostRuntime } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { createSfProductAuthority } from "../../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { selectSfNamespaceHealth } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import type { createSfDocumentServices } from "../document-services.ts"
import { sfHasOperationalResource } from "./live-context.ts"

type Source = Readonly<{
  producer: object
  handler: object
  service: NonNullable<ReturnType<typeof createSfDocumentServices>>
  assets: NonNullable<Parameters<CreateSfHostRuntime>[0]["assets"]>
}>

/** Observe the mounted C06 producer and namespace under the original F01 request. */
export async function observeSfDocumentHealth(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  binding?: Parameters<CreateSfHostRuntime>[0]["nativeReadBinding"]
  source: () => Source | undefined
}, request: Request, stamp: SfContextStamp): Promise<readonly SfOperationAvailability[]> {
  const source = input.source()
  const binding = input.binding
  const authority = input.authority
  if (!source || !binding || request.signal.aborted || typeof source.producer !== "function" ||
      typeof source.handler !== "function" || source.assets.persistence !== authority.host.persistence) return []
  const installed = binding("files.document-sources", source.producer)
  if (!installed) return []
  const expectedStamp = { ...stamp }
  const current = () => {
    const next = input.source()
    return !request.signal.aborted && next?.producer === source.producer && next.handler === source.handler &&
      next.service === source.service && next.assets === source.assets &&
      binding("files.document-sources", source.producer) === installed &&
      digestSfValue(stamp) === digestSfValue(expectedStamp)
  }
  const observed = async (operation: "sf_document_extract" | "sf_evidence_get" | "sf_knowledge_search") => {
    const digest = digestSfValue({ purpose: "document-source-health", operation })
    const result = await authority.ui.admit(request, operation, digest)
    if (result.status !== "ok") return false
    try {
      const context = result.value
      const proof = context.binding
      return current() && proof.installationId === expectedStamp.installationId &&
        proof.projectId === expectedStamp.projectId && proof.principalRef === expectedStamp.principalRef &&
        proof.policyVersion === expectedStamp.policyVersion && proof.accessRevision === expectedStamp.accessRevision &&
        authority.ui.requestFor(context) === request && await authority.ui.validate(context, operation, digest) &&
        await authority.ui.revalidate(context) && current()
    } finally {
      authority.ui.finish(result.value)
    }
  }
  if (!await observed("sf_document_extract")) return []
  const read = await authority.state.read(request, "documents", selectSfNamespaceHealth("documents", expectedStamp))
  if (read.status !== "ok" || !read.value) return []
  const write = await authority.state.read(request, "documents", selectSfNamespaceHealth("documents", expectedStamp, "write"))
  const canWrite = write.status === "ok" && !!write.value && write.incarnation === read.incarnation &&
    write.aggregateRevision === read.aggregateRevision
  const actions = canWrite ? await authority.humanActions(request) : []
  const open = await observed("sf_evidence_get")
  const search = await observed("sf_knowledge_search")
  const final = await authority.readContextAdmission(request)
  if (!current() || final.status !== "ok" || digestSfValue(final.stamp) !== digestSfValue(expectedStamp)) return []

  const service = source.service
  const candidates = [
    ["files.document-requests", "GET", "read", service.discoverRequests, true],
    ["files.document-sources", "GET", "read", service.discover, true],
    ["files.document-admit", "POST", "mutation", service.admitSelection, canWrite],
    ["files.document-candidates", "GET", "read", service.documents.list, true],
    ["files.document-schemas", "GET", "read", service.schemas.list, true],
    ["files.document-schema", "POST", "mutation", service.schemas.register, actions.includes("documents.schema")],
    ["files.document-extract", "POST", "mutation", service.documents.extract, canWrite],
    ["files.document-confirm", "POST", "mutation", service.documents.confirm, actions.includes("documents.confirm")],
    ["files.document-open", "GET", "read", service.documents.resolvePresentation, open],
    ["files.document-search", "POST", "read", service.documents.search, search],
  ] as const
  return candidates.flatMap(([id, method, effect, producer, allowed]) => {
    const metadata = SfOperationRegistry[id]
    return allowed && typeof producer === "function" && sfHasOperationalResource(id) &&
      metadata.method === method && metadata.effect === effect && metadata.pathTemplate === "{mount}/{surface}" &&
      metadata.responseMode === "json" && metadata.fixedQuery.sf === id.slice("files.".length)
      ? [{ operationId: id, state: "ready" as const, reason: null, operational: true as const }] : []
  })
}
