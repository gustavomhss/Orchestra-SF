import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp } from "@orchestra/schema/sucafina/context"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { CreateSfHostRuntime, SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { selectSfNamespaceHealth } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import type { createSfImportServices } from "../import-services.ts"
import { sfHasOperationalResource } from "./live-context.ts"

type ImportSource = Readonly<{
  producer: object
  service: NonNullable<ReturnType<typeof createSfImportServices>>
  scan: NonNullable<Parameters<CreateSfHostRuntime>[0]["assets"]>["services"]["scan"]
  dependencies: readonly object[]
}>

/** Observe the mounted import producer and current C08 authority, without admitting bytes or applying a manifest. */
export async function observeSfImportHealth(input: {
  ui: SfHostServices["ui"]
  state: SfHostServices["state"]
  binding?: Parameters<CreateSfHostRuntime>[0]["nativeReadBinding"]
  humanActions: (request: Request) => Promise<readonly string[]>
  source: () => ImportSource | undefined
}, request: Request, stamp: SfContextStamp) {
  if (!input.binding || request.signal.aborted) return []
  const bindingFor = input.binding, sourceFor = input.source, ui = input.ui, state = input.state
  const candidates = [
    { id: "files.import-targets", method: "GET", query: "import-targets", write: false, human: "" },
    { id: "files.import-admit", method: "POST", query: "import-admit", write: true, human: "imports.admit" },
    { id: "files.import-preview", method: "POST", query: "import-preview", write: true, human: "" },
    { id: "files.import-reference", method: "GET", query: "import-reference", write: false, human: "" },
    { id: "files.import-detail", method: "GET", query: "import-detail", write: false, human: "" },
    { id: "files.import-apply", method: "POST", query: "import-apply", write: true, human: "imports.apply" },
  ] as const
  const results = await Promise.allSettled(candidates.map(async (candidate) => {
    const metadata = SfOperationRegistry[candidate.id]
    if (!sfHasOperationalResource(candidate.id) || metadata.method !== candidate.method ||
      metadata.pathTemplate !== "{mount}/{surface}" || metadata.fixedQuery.sf !== candidate.query ||
      metadata.responseMode !== "json") return []
    const source = sourceFor()
    if (!source || !source.dependencies.length) return []
    const service = source.service
    const descriptors = service.descriptors.filter((item) => item.id === "sf_import_preview")
    if (descriptors.length !== 1 || descriptors[0]?.handlerExport !== "previewImport" ||
      [service.discover, service.prepareTarget, service.dispatch, service.imports.admit,
        service.imports.preview, service.imports.readPreviewReference, service.imports.detail,
        service.imports.apply].some((method) => typeof method !== "function")) return []
    const installed = bindingFor(candidate.id, source.producer)
    if (!installed || typeof installed !== "object" && typeof installed !== "function") return []
    const current = () => {
      const next = sourceFor()
      return input.binding === bindingFor && input.source === sourceFor && input.ui === ui && input.state === state &&
        !!next && next.producer === source.producer && next.service === service && next.scan === source.scan &&
        next.dependencies.length === source.dependencies.length &&
        next.dependencies.every((dependency, index) => dependency === source.dependencies[index]) &&
        bindingFor(candidate.id, source.producer) === installed && !request.signal.aborted
    }
    const digest = digestSfValue({ purpose: "import-source-health", operation: "sf_import_preview", id: candidate.id })
    const admitted = await ui.admit(request, "sf_import_preview", digest)
    if (admitted.status !== "ok") return []
    try {
      const actor = admitted.value.binding
      if (actor.installationId !== stamp.installationId || actor.projectId !== stamp.projectId ||
        actor.principalRef !== stamp.principalRef || actor.policyVersion !== stamp.policyVersion ||
        actor.accessRevision !== stamp.accessRevision || !await ui.validate(admitted.value, "sf_import_preview", digest) ||
        ui.requestFor(admitted.value) !== request || !current()) return []
      if (candidate.human && !(await input.humanActions(request)).includes(candidate.human)) return []
      // The configured scanner handles an empty health stream; this creates no
      // admitted file and never substitutes for scanning the real upload bytes.
      if (candidate.id === "files.import-admit" && !await source.scan(new Uint8Array(0), "application/octet-stream")) return []
      const namespaces = candidate.id === "files.import-apply" ? ["documents", "receipts"] as const : ["documents"] as const
      let aggregate: { revision: number; incarnation: string } | undefined
      for (const namespace of namespaces) {
        const read = () => state.read(request, namespace, selectSfNamespaceHealth(namespace, stamp, candidate.write ? "write" : "read"))
        const first = await read(), second = await read()
        if (first.status !== "ok" || second.status !== "ok" || !first.value || !second.value ||
          first.storageVersion !== first.value.storageVersion || first.aggregateRevision !== first.value.aggregateRevision ||
          first.incarnation !== first.value.incarnation || second.storageVersion !== second.value.storageVersion ||
          second.aggregateRevision !== second.value.aggregateRevision || second.incarnation !== second.value.incarnation ||
          first.storageVersion !== second.storageVersion || first.aggregateRevision !== second.aggregateRevision ||
          first.incarnation !== second.incarnation) return []
        if (aggregate && (aggregate.revision !== second.aggregateRevision || aggregate.incarnation !== second.incarnation)) return []
        aggregate = { revision: second.aggregateRevision, incarnation: second.incarnation }
      }
      if (!await ui.revalidate(admitted.value) || ui.requestFor(admitted.value) !== request || !current()) return []
      if (candidate.human && !(await input.humanActions(request)).includes(candidate.human)) return []
      if (!await ui.revalidate(admitted.value) || !current()) return []
      return [{ operationId: candidate.id, state: "ready" as const, reason: null, operational: true as const }]
    } finally { ui.finish(admitted.value) }
  }))
  return results.flatMap((result) => result.status === "fulfilled" ? result.value : [])
}
