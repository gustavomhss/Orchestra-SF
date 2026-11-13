import { memoryStore, openRevision, parseSource, withStore } from "@orchestra/rag-studio"
import { digestSfValue } from "../contracts/canonical.ts"
import type { PortResult, SfDocumentReadPort } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import { extractAuthorizedDocument } from "./extract.ts"
import type { PrivateDocumentParser } from "./extract.ts"
import type { SfDocumentSnapshot } from "./rag-adapter.ts"
import { documentAsset, documentSourceCurrent } from "./source-fence.ts"

export type StoredDocumentIndex = { schema: "sf-document-index-v1"; installationId: string; projectId: string; snapshot: SfDocumentSnapshot }

/** Index only admitted current bytes; extraction creates searchable evidence, never confirmed facts. */
export async function indexSfDocument(documentRef: string, context: TrustedDomainContext, input: { state: SfProductStatePort; documents: SfDocumentReadPort; parser: PrivateDocumentParser; requestFor: (context: TrustedDomainContext) => Request | undefined; revalidate: (context: TrustedDomainContext) => Promise<boolean>; operationIdentity: (context: TrustedDomainContext) => string | undefined }): Promise<PortResult<true>> {
  const request = input.requestFor(context)
  const operation = input.operationIdentity(context)
  if (!request || !operation || !await input.revalidate(context)) return { status: "denied", reason: "document-access-unavailable" }
  const parsed = await extractAuthorizedDocument(documentRef, context, input.documents, input.parser, request.signal)
  if (parsed.status !== "ok") return parsed
  const identity = { incarnation: parsed.value.incarnation, revision: parsed.value.revision, blobDigest: parsed.value.blobDigest.value }
  const key = `document-index:${digestSfValue([context.binding.installationId, context.binding.projectId, documentRef])}`
  const loaded = await input.state.read(request, "documents", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? { previous: state.documents[key], asset: documentAsset(state, documentRef) } : undefined)
  if (loaded.status !== "ok" || !loaded.value?.asset) return { status: "unavailable", reason: "document-index-unavailable" }
  const prior = loaded.value.previous as StoredDocumentIndex | undefined
  const asset = loaded.value.asset
  if (prior?.schema === "sf-document-index-v1" && prior.snapshot.incarnation === identity.incarnation && prior.snapshot.revision === identity.revision && prior.snapshot.blobDigest === identity.blobDigest && prior.snapshot.accessRevision === context.binding.accessRevision && await input.documents.revalidate(documentRef, identity, context) && await input.revalidate(context)) return { status: "ok", value: true }
  const sourceId = `src_${digestSfValue([context.binding.installationId, context.binding.projectId, parsed.value.documentId, identity.incarnation, identity.revision, parsed.value.blobDigest]).slice(0, 32)}`
  const locationId = `sf_${digestSfValue([context.binding.installationId, context.binding.projectId]).slice(0, 32)}`
  const store = memoryStore({ projectRoot: "/sf-project" })
  const file = "/sf-authorized/document.txt"
  store.writeFile(file, parsed.value.text)
  store.putSource({ id: sourceId, locationId, path: file, contentHash: "", status: "not_yet_read", text: "" })
  const revision = await withStore(store, async () => { await parseSource(sourceId); return openRevision(locationId) })
  const index: StoredDocumentIndex = { schema: "sf-document-index-v1", installationId: context.binding.installationId, projectId: context.binding.projectId, snapshot: { documentRef, accessRevision: context.binding.accessRevision, locationId, incarnation: identity.incarnation, revision: identity.revision, blobDigest: identity.blobDigest, source: store.sources()[0]!, chunks: store.chunks(), ragRevision: revision } }
  if (!await input.documents.revalidate(documentRef, identity, context) || !await input.revalidate(context)) return { status: "stale", reason: "document-changed" }
  const result = await input.state.transaction(request, { namespace: "documents", domainSurface: asset.surface, expectedStorageVersion: loaded.storageVersion, idempotencyKey: digestSfValue({ operation, action: "index-document", documentRef }), commandDigest: digestSfValue(index), targetRef: parsed.value.documentId, targetIncarnation: identity.incarnation }, async (state, authority, snapshot) => {
    if (!documentSourceCurrent(state, snapshot, documentRef, identity, asset.surface) || !await input.documents.revalidate(documentRef, identity, context) || authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || digestSfValue(state.documents[key]) !== digestSfValue(loaded.value!.previous)) return { commit: false, value: false }
    state.documents[key] = index
    return { commit: true, value: true }
  })
  if (result.status !== "ok" || !result.value) return { status: "unavailable", reason: "document-index-unavailable" }
  if (!await input.documents.revalidate(documentRef, identity, context) || !await input.revalidate(context)) return { status: "stale", reason: "document-changed" }
  return { status: "ok", value: true }
}
