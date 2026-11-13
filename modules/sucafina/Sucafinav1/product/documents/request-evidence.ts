import { roleMap } from "../../runtime/admin.ts"
import { assetLink } from "../../runtime/assets.ts"
import type { AssetServices } from "../../runtime/assets.ts"
import { object, rows } from "../../runtime/contract.ts"
import type { Actor } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DocumentEvidence } from "../contracts/decisions.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { sfSourceIdentity } from "../integration/source-lifecycle.ts"
import type { SfDocumentAssetCatalogEntry } from "./byte-port.ts"

type DocumentRef = Extract<BusinessEvidenceRef, { kind: "document" }>
type RequestRef = Extract<BusinessEvidenceRef, { kind: "record" }>

/** WP09's selectedDocuments port. The Request producer authorizes the selector; WP06 owns extraction and confirmation. */
export function createSfRequestDocumentEvidence(input: {
  host: DomainPortHost
  state: SfProductStatePort
  services: AssetServices
  resolveRequest: (requestRef: string, context: TrustedDomainContext) => Promise<PortResult<{ evidence: RequestRef }>>
  list: (documentRef: string, context: TrustedDomainContext) => Promise<PortResult<readonly DocumentEvidence[]>>
}) {
  return async (requestRef: string, context: TrustedDomainContext): Promise<PortResult<readonly DocumentRef[]>> => {
    const request = input.host.requestFor(context)
    if (!request || !await input.host.revalidate(context)) return { status: "denied", reason: "document-access-unavailable" }
    const selected = await input.resolveRequest(requestRef, context)
    if (selected.status !== "ok") return selected
    const ref = selected.value.evidence
    if (ref.kind !== "record" || ref.target.surface !== "procurement" || ref.target.recordType !== "procurement-request" || ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId) return { status: "denied", reason: "document-request-unavailable" }
    const loaded = await input.state.read(request, "documents", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? Object.values(state.documents).filter((value): value is SfDocumentAssetCatalogEntry => !!value && typeof value === "object" && (value as SfDocumentAssetCatalogEntry).schema === "sf-asset-v1" && (value as SfDocumentAssetCatalogEntry).surface === "procurement") : [])
    if (loaded.status !== "ok") return { status: "unavailable", reason: "document-state-unavailable" }
    const environment = await input.host.environment(request)
    const linked = await input.host.persistence.transaction("procurement", async (snapshot) => {
      const principal = await input.host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
      if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: undefined }
      const access = object(object(snapshot.data.access)[principal.id])
      const roles = principal.roles.filter((row) => row.surface === "procurement").map((row) => row.role)
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      const assets = rows(snapshot.data.assets)
      return { commit: false, value: loaded.value.filter((entry) => {
        const asset = assets.find((item) => item.id === entry.assetId)
        const source = sfSourceIdentity(snapshot, "document-asset", entry.assetId)
        return asset?.record === ref.target.recordId && (asset.kind === "quote" || asset.kind === "signed-po") && source?.incarnation === entry.incarnation && source.version === entry.revision && assetLink(snapshot, actor, environment, input.services, entry.assetId).ok
      }) }
    }, { signal: request.signal })
    if (!linked) return { status: "denied", reason: "document-access-unavailable" }
    if (linked.length > 100) return { status: "unavailable", reason: "document-limit-exceeded" }
    const evidence = await Promise.all(linked.map((entry) => input.list(entry.documentId, context)))
    if (evidence.some((value) => value.status !== "ok")) return { status: "stale", reason: "document-changed" }
    const current = await input.resolveRequest(requestRef, context)
    if (current.status !== "ok" || digestSfValue(current.value.evidence) !== digestSfValue(ref) || request.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "document-request-changed" }
    return { status: "ok", value: evidence.flatMap((value) => value.status === "ok" ? value.value.map((candidate) => candidate.ref) : []) }
  }
}
