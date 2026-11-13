import { roleMap } from "../../runtime/admin.ts"
import { assetLink, downloadAsset } from "../../runtime/assets.ts"
import type { AssetPersistence, AssetServices } from "../../runtime/assets.ts"
import { object, rows } from "../../runtime/contract.ts"
import type { Actor } from "../../runtime/contract.ts"
import { sfSourceIdentity } from "../integration/source-lifecycle.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainPortHost, PortResult, SfDocumentReadPort } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"

export type SfDocumentAssetCatalogEntry = { schema: "sf-asset-v1"; documentId: string; surface: "dashboard" | "procurement"; assetId: string; incarnation: string; revision: number; blobDigest: string }

export function createSfDocumentBytePort(input: { host: DomainPortHost; assets: AssetPersistence; services: AssetServices; state: SfProductStatePort; maxBytes: number }): SfDocumentReadPort {
  async function read(documentRef: string, context: TrustedDomainContext): ReturnType<SfDocumentReadPort["read"]> {
    const request = input.host.requestFor(context)
    if (!request || !documentRef || !Number.isSafeInteger(input.maxBytes) || input.maxBytes < 1 || !Object.is(input.host.persistence, input.assets) || !(await input.host.revalidate(context))) return { status: "denied", reason: "document-access-unavailable" }
    const catalog = await input.state.read(request, "documents", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.documents[`asset:${documentRef}`] : undefined)
    if (catalog.status !== "ok" || !catalog.value || typeof catalog.value !== "object") return { status: "unavailable", reason: "document-unavailable" }
    const entry = catalog.value as SfDocumentAssetCatalogEntry
    if (entry.schema !== "sf-asset-v1" || entry.documentId !== documentRef || !entry.assetId || !entry.incarnation || !Number.isSafeInteger(entry.revision) || entry.revision < 1 || !/^[a-f0-9]{64}$/.test(entry.blobDigest) || (entry.surface !== "dashboard" && entry.surface !== "procurement")) return { status: "unavailable", reason: "document-unavailable" }
    const environment = await input.host.environment(request)
    const fetched = await input.assets.transaction<PortResult<{ documentId: string; incarnation: string; revision: number; fileName: string; mediaType: "text/plain" | "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; blobDigest: { algorithm: "sha256"; value: string }; bytes: Uint8Array }>>(entry.surface, async (snapshot, blobs) => {
      const principal = await input.host.authenticate(request, { surface: entry.surface, roleMap: roleMap(snapshot, entry.surface) })
      if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: { status: "denied", reason: "document-access-unavailable" } }
      const access = object(object(snapshot.data.access)[principal.id])
      const roles = principal.roles.filter((row) => row.surface === entry.surface).map((row) => row.role)
      const actor: Actor = { id: principal.id, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), roles, assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      const source = sfSourceIdentity(snapshot, "document-asset", entry.assetId)
      if (!source || source.incarnation !== entry.incarnation || source.version !== entry.revision) return { commit: false, value: { status: "unavailable", reason: "document-changed" } }
      const asset = rows(snapshot.data.assets).find((row) => row.id === entry.assetId)
      if (!asset || typeof asset.name !== "string" || typeof asset.bytes !== "number" || asset.bytes < 1 || asset.bytes > input.maxBytes || (asset.type !== "text/plain" && asset.type !== "application/pdf" && asset.type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document")) return { commit: false, value: { status: "unavailable", reason: "document-unavailable" } }
      const link = assetLink(snapshot, actor, environment, input.services, entry.assetId)
      if (!link.ok || !("query" in link)) return { commit: false, value: { status: "denied", reason: "document-access-unavailable" } }
      const response = await downloadAsset(snapshot, blobs, actor, environment, input.services, new URLSearchParams(link.query))
      if (!response.ok) return { commit: false, value: { status: "unavailable", reason: "document-unavailable" } }
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.byteLength !== asset.bytes || new Bun.CryptoHasher("sha256").update(bytes).digest("hex") !== entry.blobDigest) return { commit: false, value: { status: "unavailable", reason: "document-unavailable" } }
      return { commit: false, value: { status: "ok", value: { documentId: entry.documentId, incarnation: entry.incarnation, revision: entry.revision, fileName: asset.name, mediaType: asset.type, blobDigest: { algorithm: "sha256", value: entry.blobDigest }, bytes } } }
    }, { signal: request.signal })
    if (fetched.status !== "ok") return fetched
    const current = await input.state.read(request, "documents", (state) => state.documents[`asset:${documentRef}`])
    if (current.status !== "ok" || digestSfValue(current.value) !== digestSfValue(entry) || !(await input.host.revalidate(context)) || request.signal.aborted) return { status: "unavailable", reason: "document-changed" }
    return fetched
  }
  return {
    read,
    revalidate: async (documentRef, identity, context) => {
      const current = await read(documentRef, context)
      return current.status === "ok" && current.value.incarnation === identity.incarnation && current.value.revision === identity.revision && current.value.blobDigest.value === identity.blobDigest
    },
  }
}

/** Registers an existing authorized asset. The catalog is metadata; it never grants source access. */
export async function admitSfDocumentAsset(selection: { surface: "dashboard" | "procurement"; assetId: string }, context: TrustedDomainContext, input: { host: DomainPortHost; assets: AssetPersistence; services: AssetServices; state: SfProductStatePort; maxBytes: number; operationIdentity: (context: TrustedDomainContext) => string | undefined }): Promise<PortResult<SfDocumentAssetCatalogEntry>> {
  const request = input.host.requestFor(context)
  const operationId = input.operationIdentity(context)
  if (!request || !operationId || !selection.assetId || !Object.is(input.host.persistence, input.assets) || !Number.isSafeInteger(input.maxBytes) || input.maxBytes < 1 || !(await input.host.revalidate(context))) return { status: "denied", reason: "document-access-unavailable" }
  const environment = await input.host.environment(request)
  const candidate = await input.assets.transaction<PortResult<SfDocumentAssetCatalogEntry>>(selection.surface, async (snapshot, blobs) => {
    const principal = await input.host.authenticate(request, { surface: selection.surface, roleMap: roleMap(snapshot, selection.surface) })
    if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: { status: "denied", reason: "document-access-unavailable" } }
    const access = object(object(snapshot.data.access)[principal.id])
    const roles = principal.roles.filter((row) => row.surface === selection.surface).map((row) => row.role)
    const actor: Actor = { id: principal.id, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), roles, assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
    const source = sfSourceIdentity(snapshot, "document-asset", selection.assetId)
    const asset = rows(snapshot.data.assets).find((row) => row.id === selection.assetId)
    if (!source || !asset || typeof asset.bytes !== "number" || asset.bytes < 1 || asset.bytes > input.maxBytes || (asset.type !== "text/plain" && asset.type !== "application/pdf" && asset.type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document")) return { commit: false, value: { status: "unavailable", reason: "document-unavailable" } }
    const link = assetLink(snapshot, actor, environment, input.services, selection.assetId)
    if (!link.ok || !("query" in link)) return { commit: false, value: { status: "denied", reason: "document-access-unavailable" } }
    const response = await downloadAsset(snapshot, blobs, actor, environment, input.services, new URLSearchParams(link.query))
    if (!response.ok) return { commit: false, value: { status: "unavailable", reason: "document-unavailable" } }
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength !== asset.bytes) return { commit: false, value: { status: "unavailable", reason: "document-unavailable" } }
    return { commit: false, value: { status: "ok", value: { schema: "sf-asset-v1", documentId: selection.assetId, surface: selection.surface, assetId: selection.assetId, incarnation: source.incarnation, revision: source.version, blobDigest: new Bun.CryptoHasher("sha256").update(bytes).digest("hex") } } }
  }, { signal: request.signal })
  if (candidate.status !== "ok") return candidate
  const prior = await input.state.read(request, "documents", (state) => state.documents[`asset:${candidate.value.documentId}`])
  if ((prior.status !== "ok" && !(prior.status === "unavailable" && prior.reason === "product-state-uninitialized")) || !(await input.host.revalidate(context))) return { status: "unavailable", reason: "document-state-unavailable" }
  const saved = await input.state.transaction(request, { namespace: "documents", expectedStorageVersion: prior.status === "ok" ? prior.storageVersion : 0, domainSurface: candidate.value.surface, idempotencyKey: operationId, commandDigest: digestSfValue({ action: "admit-document", entry: candidate.value }), targetRef: candidate.value.documentId, targetIncarnation: candidate.value.incarnation }, async (state, authority, snapshot) => {
    const source = sfSourceIdentity(snapshot, "document-asset", candidate.value.assetId)
    if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || !source || source.incarnation !== candidate.value.incarnation || source.version !== candidate.value.revision) return { commit: false, value: null as SfDocumentAssetCatalogEntry | null }
    // Nested reads use the same SQLite transaction and cannot acquire a separate write lock.
    const current = await input.assets.transaction(candidate.value.surface, async (locked, blobs) => {
      const principal = await input.host.authenticate(request, { surface: candidate.value.surface, roleMap: roleMap(locked, candidate.value.surface) })
      if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: false }
      const access = object(object(locked.data.access)[principal.id])
      const roles = principal.roles.filter((row) => row.surface === candidate.value.surface).map((row) => row.role)
      const actor: Actor = { id: principal.id, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), roles, assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      const link = assetLink(locked, actor, environment, input.services, candidate.value.assetId)
      if (!link.ok || !("query" in link)) return { commit: false, value: false }
      const response = await downloadAsset(locked, blobs, actor, environment, input.services, new URLSearchParams(link.query))
      if (!response.ok) return { commit: false, value: false }
      const bytes = new Uint8Array(await response.arrayBuffer())
      return { commit: false, value: bytes.byteLength <= input.maxBytes && new Bun.CryptoHasher("sha256").update(bytes).digest("hex") === candidate.value.blobDigest }
    }, { signal: request.signal })
    if (!current) return { commit: false, value: null as SfDocumentAssetCatalogEntry | null }
    const existing = state.documents[`asset:${candidate.value.documentId}`]
    if (existing && typeof existing === "object" && (existing as SfDocumentAssetCatalogEntry).surface !== candidate.value.surface) return { commit: false, value: null as SfDocumentAssetCatalogEntry | null }
    state.documents[`asset:${candidate.value.documentId}`] = candidate.value
    return { commit: true, value: candidate.value as SfDocumentAssetCatalogEntry | null }
  })
  if (saved.status !== "ok" || !saved.value) return { status: "unavailable", reason: "document-state-unavailable" }
  const port = createSfDocumentBytePort(input)
  const verified = await port.read(saved.value.documentId, context)
  if (verified.status !== "ok" || verified.value.incarnation !== saved.value.incarnation || verified.value.revision !== saved.value.revision || verified.value.blobDigest.value !== saved.value.blobDigest) return { status: "stale", reason: "document-changed" }
  return { status: "ok", value: saved.value }
}
