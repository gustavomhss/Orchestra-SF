import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp } from "@orchestra/schema/sucafina/context"
import type { CreateSfHostRuntime } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import type { createSfProductAuthority } from "../../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfImportServices } from "../import-services.ts"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { selectSfNamespaceHealth } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import { sfHasOperationalResource } from "./live-context.ts"

type Source = {
  producer: object
  handler: object
  service: NonNullable<ReturnType<typeof createSfImportServices>>
  persistence: Parameters<CreateSfHostRuntime>[0]["persistence"]
  assets: NonNullable<Parameters<CreateSfHostRuntime>[0]["assets"]>
  dependencies: readonly object[]
}

/** Original Import infrastructure and policy only: no discovery, source lease,
 * scan, preview, receipt or apply. Scanner configuration is not a ClamD verdict. */
export async function observeSfImportHealth(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  binding?: Parameters<CreateSfHostRuntime>[0]["nativeReadBinding"]
  source: () => Source | undefined
}, request: Request, stamp: SfContextStamp) {
  const bindingFor = input.binding
  const sourceFor = input.source
  const authority = input.authority
  const source = sourceFor()
  if (!bindingFor || !source || request.signal.aborted || typeof source.producer !== "function" ||
    typeof source.handler !== "function" || source.assets.persistence !== source.persistence ||
    source.persistence !== authority.host.persistence) return []
  const producer = source.producer
  const handler = source.handler
  const service = source.service
  const assets = source.assets
  const descriptors = service.descriptors.filter((entry) => entry.id === "sf_import_preview")
  if (descriptors.length !== 1 || descriptors[0]?.handlerExport !== "previewImport" ||
    descriptors[0].mode !== "simulate" || !descriptors[0].requiredAuthority.includes("documents:read")) return []
  const descriptor = descriptors[0]
  const descriptorFacts = digestSfValue({ id: descriptor.id, mode: descriptor.mode, handlerExport: descriptor.handlerExport,
    requiredAuthority: [...descriptor.requiredAuthority] })
  // This proves the same installed shared router, never a grant for Import.
  const binding = bindingFor("dashboard.dashboard-review", producer)
  if (!binding) return []
  const configuration = assets.services.scannerConfiguration
  const scanner = configuration ? { host: configuration.host, port: configuration.port } : undefined
  const expectedStamp = { ...stamp }
  const methods = (value: Source) => [value.handler, value.service, value.service.imports,
    value.service.discover, value.service.prepareTarget, value.service.dispatch, value.service.imports.admit,
    value.service.imports.preview, value.service.imports.detail, value.service.imports.readPreviewReference,
    value.service.imports.apply, value.service.descriptors, value.service.descriptors.find((entry) => entry.id === "sf_import_preview"),
    value.service.descriptors.find((entry) => entry.id === "sf_import_preview")?.handler,
    value.service.descriptors.find((entry) => entry.id === "sf_import_preview")?.inputSchema,
    value.service.descriptors.find((entry) => entry.id === "sf_import_preview")?.outputSchema,
    value.persistence, value.persistence.transaction, value.persistence.transactionAll,
    value.persistence.readScopedSource, value.persistence.resolveScopedSource,
    value.assets, value.assets.persistence, value.assets.services, value.assets.services.scan,
    ...value.dependencies]
  const dependencies = [...methods(source)]
  const authorityMethods = [authority.ui, authority.ui.admit, authority.ui.validate, authority.ui.requestFor,
    authority.ui.revalidate, authority.ui.finish, authority.state, authority.state.read, authority.state.transaction,
    authority.human, authority.human.admit, authority.human.authorize, authority.humanActions, authority.readContextAdmission]
  if (!source.dependencies.length || dependencies.some((dependency) => !dependency)) return []
  const current = () => {
    const next = sourceFor()
    const nextMethods = next ? methods(next) : []
    return !request.signal.aborted && input.authority === authority && input.binding === bindingFor && input.source === sourceFor &&
      !!next && next.producer === producer && next.handler === handler && next.service === service &&
      next.assets === assets && next.persistence === source.persistence &&
      bindingFor("dashboard.dashboard-review", producer) === binding &&
      next.assets.services.scannerConfiguration === configuration &&
      configuration?.host === scanner?.host && configuration?.port === scanner?.port &&
      digestSfValue(stamp) === digestSfValue(expectedStamp) &&
      dependencies.length === nextMethods.length && dependencies.every((dependency, index) => dependency === nextMethods[index]) &&
      authorityMethods.every((method, index) => method === [authority.ui, authority.ui.admit, authority.ui.validate,
        authority.ui.requestFor, authority.ui.revalidate, authority.ui.finish, authority.state, authority.state.read,
        authority.state.transaction, authority.human, authority.human.admit, authority.human.authorize,
        authority.humanActions, authority.readContextAdmission][index]) &&
      service.descriptors.filter((entry) => entry.id === "sf_import_preview").length === 1 &&
      service.descriptors.find((entry) => entry.id === "sf_import_preview") === descriptor &&
      digestSfValue({ id: descriptor.id, mode: descriptor.mode, handlerExport: descriptor.handlerExport,
        requiredAuthority: [...descriptor.requiredAuthority] }) === descriptorFacts
  }
  const digest = digestSfValue({ purpose: "import-source-health", operation: "sf_import_preview" })
  const admitted = await authority.ui.admit(request, "sf_import_preview", digest)
  if (admitted.status !== "ok") return []
  try {
    const context = admitted.value
    const proof = context.binding
    if (!current() || proof.installationId !== stamp.installationId || proof.projectId !== stamp.projectId ||
      proof.principalRef !== stamp.principalRef || proof.policyVersion !== stamp.policyVersion || proof.accessRevision !== stamp.accessRevision ||
      authority.ui.requestFor(context) !== request || !await authority.ui.validate(context, "sf_import_preview", digest)) return []
    const actions = await authority.humanActions(request)
    const health = async (namespace: "documents" | "receipts", mode: "read" | "write") => {
      const read = () => authority.state.read(request, namespace, selectSfNamespaceHealth(namespace, expectedStamp, mode))
      const first = await read()
      if (first.status !== "ok" || !first.value || first.storageVersion !== first.value.storageVersion ||
        first.aggregateRevision !== first.value.aggregateRevision || first.incarnation !== first.value.incarnation || !current()) return undefined
      const second = await read()
      return second.status === "ok" && !!second.value && second.storageVersion === second.value.storageVersion &&
        second.aggregateRevision === second.value.aggregateRevision && second.incarnation === second.value.incarnation &&
        second.storageVersion === first.storageVersion && second.aggregateRevision === first.aggregateRevision &&
        second.incarnation === first.incarnation && current() ? second.value : undefined
    }
    const documents = await health("documents", "read")
    if (!documents) return []
    const documentsWrite = await health("documents", "write")
    const receiptsWrite = await health("receipts", "write")
    const coherent = (value: typeof documentsWrite) => !!value &&
      value.aggregateRevision === documents.aggregateRevision && value.incarnation === documents.incarnation
    const write = coherent(documentsWrite)
    const receipt = coherent(receiptsWrite)
    const storage = await Promise.all((["dashboard", "planner"] as const).map(async (surface) => {
      const read = () => assets.persistence.transaction(surface, async (snapshot, blobs) => ({
        commit: false, value: current() && !!blobs && typeof blobs.get === "function" &&
          typeof blobs.put === "function" && typeof blobs.remove === "function" ? digestSfValue(snapshot.versions) : undefined,
      }), { signal: request.signal })
      const first = await read()
      const second = await read()
      return !!first && first === second && current()
    }))
    const afterActions = await authority.humanActions(request)
    const final = await authority.readContextAdmission(request)
    if (!storage.every(Boolean) || !current() || digestSfValue(actions.toSorted()) !== digestSfValue(afterActions.toSorted()) ||
      final.status !== "ok" || digestSfValue(final.stamp) !== digestSfValue(expectedStamp) ||
      authority.ui.requestFor(context) !== request || !await authority.ui.revalidate(context) || !current()) return []
    const configured = scanner?.host === "127.0.0.1" && Number.isSafeInteger(scanner.port) && scanner.port > 0 && scanner.port <= 65535
    const candidates = [
      { id: "files.import-targets", mode: "import-targets", method: "GET", effect: "read", ready: true },
      { id: "files.import-reference", mode: "import-reference", method: "GET", effect: "read", ready: true },
      { id: "files.import-detail", mode: "import-detail", method: "GET", effect: "read", ready: true },
      { id: "files.import-admit", mode: "import-admit", method: "POST", effect: "mutation", ready: write && configured && actions.includes("imports.admit") },
      { id: "files.import-preview", mode: "import-preview", method: "POST", effect: "prepare", ready: write },
      { id: "files.import-apply", mode: "import-apply", method: "POST", effect: "mutation", ready: write && receipt && actions.includes("imports.apply") },
    ] as const
    return candidates.flatMap((candidate) => {
      const metadata = SfOperationRegistry[candidate.id]
      return candidate.ready && sfHasOperationalResource(candidate.id) && metadata.method === candidate.method &&
        metadata.effect === candidate.effect && metadata.pathTemplate === "{mount}/{surface}" &&
        metadata.responseMode === "json" && metadata.fixedQuery.sf === candidate.mode
        ? [{ operationId: candidate.id, state: "ready" as const, reason: null, operational: true as const }] : []
    })
  } finally { authority.ui.finish(admitted.value) }
}
