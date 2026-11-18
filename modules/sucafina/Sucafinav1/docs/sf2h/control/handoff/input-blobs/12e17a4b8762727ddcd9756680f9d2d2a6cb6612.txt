import { roleMap } from "../../runtime/admin.ts"
import { assetLink } from "../../runtime/assets.ts"
import type { AssetPersistence, AssetServices } from "../../runtime/assets.ts"
import { object, rows } from "../../runtime/contract.ts"
import type { Actor } from "../../runtime/contract.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainPortHost, PortResult, SfDocumentReadPort } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import { sfSourceIdentity } from "../integration/source-lifecycle.ts"
import type { SfDocumentAssetCatalogEntry } from "./byte-port.ts"
import { resolveSfDocumentEvidence } from "./evidence-resolver.ts"
import type { SfDocumentReader } from "./evidence-resolver.ts"

/** Resolve display metadata only through the current authorized asset and evidence. */
export function createSfDocumentPresentation(input: { host: DomainPortHost; assets: AssetPersistence; services: AssetServices; state: SfProductStatePort; documents: SfDocumentReadPort; reader: SfDocumentReader; origin: string; mount: string }) {
  return async (ref: BusinessEvidenceRef, context: TrustedDomainContext): Promise<PortResult<{ title: string; href?: string }>> => {
    const request = input.host.requestFor(context)
    if (ref.kind !== "document" || !request || !URL.canParse(input.origin) || new URL(input.origin).origin !== input.origin || new URL(request.url).origin !== input.origin || !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(input.mount) || !Object.is(input.host.persistence, input.assets) || !await input.host.revalidate(context)) return { status: "denied", reason: "document-access-unavailable" }
    if ((await resolveSfDocumentEvidence(ref, context, input.reader)).state !== "fresh") return { status: "stale", reason: "document-evidence-unavailable" }
    const document = await input.documents.read(ref.target.documentId, context)
    if (document.status !== "ok") return document
    if (document.value.incarnation !== ref.target.incarnation || document.value.revision !== ref.target.revision || document.value.blobDigest.value !== ref.target.blobDigest.value || !document.value.fileName.trim()) return { status: "stale", reason: "document-changed" }
    const catalog = await input.state.read(request, "documents", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.documents[`asset:${ref.target.documentId}`] : undefined)
    if (catalog.status !== "ok" || !catalog.value || typeof catalog.value !== "object") return { status: "unavailable", reason: "document-unavailable" }
    const entry = catalog.value as SfDocumentAssetCatalogEntry
    if (entry.schema !== "sf-asset-v1" || entry.documentId !== ref.target.documentId || entry.incarnation !== document.value.incarnation || entry.revision !== document.value.revision || entry.blobDigest !== document.value.blobDigest.value || (entry.surface !== "dashboard" && entry.surface !== "procurement") || !entry.assetId) return { status: "stale", reason: "document-changed" }
    const environment = await input.host.environment(request)
    const linked = await input.assets.transaction(entry.surface, async (snapshot) => {
      const principal = await input.host.authenticate(request, { surface: entry.surface, roleMap: roleMap(snapshot, entry.surface) })
      if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: undefined }
      const access = object(object(snapshot.data.access)[principal.id])
      const roles = principal.roles.filter((row) => row.surface === entry.surface).map((row) => row.role)
      const actor: Actor = { id: principal.id, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), roles, assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      const source = sfSourceIdentity(snapshot, "document-asset", entry.assetId)
      const asset = rows(snapshot.data.assets).find((row) => row.id === entry.assetId)
      if (!source || source.incarnation !== entry.incarnation || source.version !== entry.revision || asset?.name !== document.value.fileName) return { commit: false, value: undefined }
      const link = assetLink(snapshot, actor, environment, input.services, entry.assetId)
      return { commit: false, value: link.ok && "query" in link ? link : undefined }
    }, { signal: request.signal })
    if (!linked) return { status: "denied", reason: "document-access-unavailable" }
    const current = await input.state.read(request, "documents", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.documents[`asset:${ref.target.documentId}`] : undefined)
    if (current.status !== "ok" || digestSfValue(current.value) !== digestSfValue(entry) || !await input.documents.revalidate(ref.target.documentId, { incarnation: entry.incarnation, revision: entry.revision, blobDigest: entry.blobDigest }, context) || !await input.host.revalidate(context) || request.signal.aborted) return { status: "stale", reason: "document-changed" }
    const now = await input.host.environment(request)
    if (!Number.isFinite(Date.parse(now.at)) || Date.parse(linked.expires) <= Date.parse(now.at) || !await input.host.revalidate(context)) return { status: "stale", reason: "document-link-expired" }
    const url = new URL(`${input.mount}/${entry.surface}?${linked.query}`, input.origin)
    if (url.origin !== input.origin || url.pathname !== `${input.mount}/${entry.surface}`) return { status: "unavailable", reason: "document-link-unavailable" }
    return { status: "ok", value: { title: document.value.fileName, href: `${url.pathname}${url.search}` } }
  }
}
