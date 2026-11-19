import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp } from "@orchestra/schema/sucafina/context"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { CreateSfHostRuntime, SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { selectSfNamespaceHealth } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import { sfHasOperationalResource } from "./live-context.ts"

type Operation = "files.document-requests" | "files.document-sources" | "files.document-admit" |
  "files.document-schemas" | "files.document-schema" | "files.document-extract" |
  "files.document-confirm" | "files.document-candidates" | "files.document-open" | "files.document-search"

/** Infrastructure observation of the original document HTTP/C08 producers.
 * It never selects an asset, parses a document, registers a schema or confirms
 * a field. Those operations keep their original source and human fences.
 */
export async function observeSfDocumentHealth(input: {
  ui: SfHostServices["ui"]
  state: SfHostServices["state"]
  binding?: Parameters<CreateSfHostRuntime>[0]["nativeReadBinding"]
  humanActions: (request: Request) => Promise<readonly string[]>
  source: (id: Operation) => { producer: object; dependencies: readonly object[] } | undefined
}, request: Request, stamp: SfContextStamp) {
  if (!input.binding || request.signal.aborted) return []
  const bindingFor = input.binding, sourceFor = input.source, ui = input.ui, state = input.state
  const candidates = [
    { id: "files.document-requests", method: "GET", admission: "sf_document_extract", write: false, human: null },
    { id: "files.document-sources", method: "GET", admission: "sf_document_extract", write: false, human: null },
    { id: "files.document-admit", method: "POST", admission: "sf_document_extract", write: true, human: null },
    { id: "files.document-schemas", method: "GET", admission: "sf_document_extract", write: false, human: null },
    { id: "files.document-schema", method: "POST", admission: "sf-human:documents.schema", write: true, human: "documents.schema" },
    { id: "files.document-extract", method: "POST", admission: "sf_document_extract", write: true, human: null },
    { id: "files.document-confirm", method: "POST", admission: "sf-human:documents.confirm", write: true, human: "documents.confirm" },
    { id: "files.document-candidates", method: "GET", admission: "sf_document_extract", write: false, human: null },
    { id: "files.document-open", method: "GET", admission: "sf_evidence_get", write: false, human: null },
    { id: "files.document-search", method: "POST", admission: "sf_knowledge_search", write: false, human: null },
  ] as const
  const observed = await Promise.allSettled(candidates.map(async (candidate) => {
    const metadata = SfOperationRegistry[candidate.id]
    if (!sfHasOperationalResource(candidate.id) || metadata.method !== candidate.method ||
      metadata.pathTemplate !== "{mount}/{surface}" || metadata.fixedQuery.sf !== candidate.id.slice("files.".length) ||
      metadata.responseMode !== "json") return []
    const source = sourceFor(candidate.id)
    if (!source || !source.dependencies.length) return []
    const installed = bindingFor(candidate.id, source.producer)
    if (!installed || typeof installed !== "object" && typeof installed !== "function") return []
    const current = () => {
      const next = sourceFor(candidate.id)
      return input.binding === bindingFor && input.source === sourceFor && input.ui === ui && input.state === state &&
        !!next && next.producer === source.producer && next.dependencies.length === source.dependencies.length &&
        next.dependencies.every((dependency, index) => dependency === source.dependencies[index]) &&
        bindingFor(candidate.id, source.producer) === installed && !request.signal.aborted
    }
    const digest = digestSfValue({ purpose: "document-source-health", id: candidate.id })
    const admitted = await ui.admit(request, candidate.admission, digest)
    if (admitted.status !== "ok") return []
    try {
      const actor = admitted.value.binding
      if (actor.installationId !== stamp.installationId || actor.projectId !== stamp.projectId ||
        actor.principalRef !== stamp.principalRef || actor.policyVersion !== stamp.policyVersion ||
        actor.accessRevision !== stamp.accessRevision || !await ui.validate(admitted.value, candidate.admission, digest) ||
        ui.requestFor(admitted.value) !== request || !current() ||
        candidate.human && !(await input.humanActions(request)).includes(candidate.human)) return []
      const read = () => state.read(request, "documents",
        selectSfNamespaceHealth("documents", stamp, candidate.write ? "write" : "read"))
      const first = await read(), second = await read()
      if (first.status !== "ok" || second.status !== "ok" || !first.value || !second.value ||
        first.storageVersion !== first.value.storageVersion || first.aggregateRevision !== first.value.aggregateRevision ||
        first.incarnation !== first.value.incarnation || second.storageVersion !== second.value.storageVersion ||
        second.aggregateRevision !== second.value.aggregateRevision || second.incarnation !== second.value.incarnation ||
        first.storageVersion !== second.storageVersion || first.aggregateRevision !== second.aggregateRevision ||
        first.incarnation !== second.incarnation || !await ui.revalidate(admitted.value) ||
        ui.requestFor(admitted.value) !== request || !current() ||
        candidate.human && !(await input.humanActions(request)).includes(candidate.human)) return []
      return [{ operationId: candidate.id, state: "ready" as const, reason: null, operational: true as const }]
    } finally { ui.finish(admitted.value) }
  }))
  return observed.flatMap((result) => result.status === "fulfilled" ? result.value : [])
}
