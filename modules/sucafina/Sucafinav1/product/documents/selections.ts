import { randomUUID } from "node:crypto"
import { roleMap } from "../../runtime/admin.ts"
import { assetLink } from "../../runtime/assets.ts"
import type { AssetPersistence, AssetServices } from "../../runtime/assets.ts"
import { object, rows } from "../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { sfSourceIdentity } from "../integration/source-lifecycle.ts"
import type { SfDocumentAssetCatalogEntry, SfDocumentAssetSelection } from "./byte-port.ts"

type Scope = { installationId: string; projectId: string; principalRef: string; accessRevision: string; policyVersion: string; expires: number }
type SelectedRequest = { recordId: string; incarnation: string; revision: number }
type AuthorizedAsset = SfDocumentAssetSelection & { label: string; request?: SelectedRequest }

/** Tokens bind the observed Request and file revisions without exposing private blob locators. */
export function createSfDocumentSelections(input: {
  host: DomainPortHost
  assets: AssetPersistence
  services: AssetServices
  maxBytes: number
  admit: (selection: SfDocumentAssetSelection, context: TrustedDomainContext) => Promise<PortResult<SfDocumentAssetCatalogEntry>>
}) {
  const files = new Map<string, Scope & { asset: AuthorizedAsset }>()
  const requests = new Map<string, Scope & { request: SelectedRequest }>()
  const scope = (context: TrustedDomainContext, now: number): Scope => ({ installationId: context.binding.installationId, projectId: context.binding.projectId, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, expires: now + 300_000 })
  const current = (value: Scope | undefined, context: TrustedDomainContext, now: number) => !!value && value.expires > now && value.installationId === context.binding.installationId && value.projectId === context.binding.projectId && value.principalRef === context.binding.principalRef && value.accessRevision === context.binding.accessRevision && value.policyVersion === context.binding.policyVersion
  const clock = async (context: TrustedDomainContext) => {
    const request = input.host.requestFor(context)
    if (!request || !Object.is(input.host.persistence, input.assets) || !await input.host.revalidate(context)) return undefined
    const now = Date.parse((await input.host.environment(request)).at)
    if (!Number.isFinite(now)) return undefined
    for (const [key, value] of files) if (value.expires <= now) files.delete(key)
    for (const [key, value] of requests) if (value.expires <= now) requests.delete(key)
    return now
  }
  const visible = async (context: TrustedDomainContext): Promise<PortResult<AuthorizedAsset[]>> => {
    const request = input.host.requestFor(context)
    if (!request || !await input.host.revalidate(context)) return { status: "denied", reason: "document-access-unavailable" }
    const environment = await input.host.environment(request)
    const actorFor = async (snapshot: Snapshot, surface: "dashboard" | "procurement"): Promise<Actor | undefined> => {
      const principal = await input.host.authenticate(request, { surface, roleMap: roleMap(snapshot, surface) })
      if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return undefined
      const access = object(object(snapshot.data.access)[principal.id])
      const roles = principal.roles.filter((row) => row.surface === surface).map((row) => row.role)
      return { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
    }
    const groups = await Promise.all((["dashboard", "procurement"] as const).map((surface) => input.assets.transaction(surface, async (snapshot) => {
      const actor = await actorFor(snapshot, surface)
      if (!actor) return { commit: false, value: [] as AuthorizedAsset[] }
      const found = rows(snapshot.data.assets).flatMap((asset): AuthorizedAsset[] => {
        if (typeof asset.id !== "string" || typeof asset.name !== "string" || !asset.name.trim() || typeof asset.bytes !== "number" || asset.bytes < 1 || asset.bytes > input.maxBytes || !["text/plain", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(String(asset.type)) || !assetLink(snapshot, actor, environment, input.services, asset.id).ok) return []
        const source = sfSourceIdentity(snapshot, "document-asset", asset.id)
        if (!source) return []
        const requestSource = surface === "procurement" && (asset.kind === "quote" || asset.kind === "signed-po") && typeof asset.record === "string" ? sfSourceIdentity(snapshot, "procurement-request", asset.record) : undefined
        const request = requestSource ? { recordId: String(asset.record), incarnation: requestSource.incarnation, revision: requestSource.version } : undefined
        if (surface === "procurement" && (asset.kind === "quote" || asset.kind === "signed-po") && !request) return []
        return [{ surface, assetId: asset.id, label: asset.name, expected: { incarnation: source.incarnation, revision: source.version, ...(request ? { request } : {}) }, ...(request ? { request } : {}) }]
      })
      return { commit: false, value: found }
    }, { signal: request.signal })))
    if (!await input.host.revalidate(context) || request.signal.aborted) return { status: "denied", reason: "document-access-unavailable" }
    const result = groups.flat()
    if (result.length > 100) return { status: "unavailable", reason: "document-limit-exceeded" }
    if (!input.host.persistence.transactionAll) return { status: "unavailable", reason: "document-snapshot-unavailable" }
    // Both discovery reads have completed. Fence every label against one current domain snapshot.
    const valid = await input.host.persistence.transactionAll(async (snapshots) => {
      for (const surface of ["dashboard", "procurement"] as const) {
        const selected = result.filter((asset) => asset.surface === surface)
        if (!selected.length) continue
        const snapshot = snapshots[surface]
        const actor = await actorFor(snapshot, surface)
        if (!actor) return { commit: false, value: false }
        const assets = rows(snapshot.data.assets)
        if (selected.some((entry) => {
          const asset = assets.find((value) => value.id === entry.assetId)
          const source = sfSourceIdentity(snapshot, "document-asset", entry.assetId)
          if (!entry.expected || !source || source.incarnation !== entry.expected.incarnation || source.version !== entry.expected.revision || !asset || asset.name !== entry.label || !assetLink(snapshot, actor, environment, input.services, entry.assetId).ok) return true
          if (!entry.request) return false
          const current = sfSourceIdentity(snapshot, "procurement-request", entry.request.recordId)
          return asset.record !== entry.request.recordId || !current || current.incarnation !== entry.request.incarnation || current.version !== entry.request.revision
        })) return { commit: false, value: false }
      }
      return { commit: false, value: !request.signal.aborted }
    }, { signal: request.signal })
    return valid ? { status: "ok", value: result } : { status: "stale", reason: "document-selection-changed" }
  }
  return {
    discoverRequests: async (context: TrustedDomainContext): Promise<PortResult<readonly { selectionRef: string; label: string }[]>> => {
      const now = await clock(context)
      if (now === undefined) return { status: "denied", reason: "document-access-unavailable" }
      const found = await visible(context)
      if (found.status !== "ok") return found
      const selected = found.value.flatMap((asset) => asset.request ? [asset.request] : []).filter((request, index, all) => all.findIndex((item) => item.recordId === request.recordId) === index)
      if (requests.size + files.size + selected.length > 1000) return { status: "unavailable", reason: "document-selection-limit" }
      return { status: "ok", value: selected.map((request) => {
        const selectionRef = randomUUID()
        requests.set(selectionRef, { ...scope(context, now), request })
        return { selectionRef, label: `Request ${request.recordId}` }
      }) }
    },
    discover: async (context: TrustedDomainContext, requestSelectionRef?: string): Promise<PortResult<readonly { selectionRef: string; label: string; surface: "dashboard" | "procurement" }[]>> => {
      const now = await clock(context)
      if (now === undefined) return { status: "denied", reason: "document-access-unavailable" }
      const selected = requestSelectionRef === undefined ? undefined : requests.get(requestSelectionRef)
      if (requestSelectionRef !== undefined && !current(selected, context, now)) return { status: "denied", reason: "document-access-unavailable" }
      const found = await visible(context)
      if (found.status !== "ok") return found
      const assets = selected ? found.value.filter((asset) => asset.request?.recordId === selected.request.recordId) : found.value
      if (selected && (!assets.length || assets.some((asset) => asset.request?.incarnation !== selected.request.incarnation || asset.request.revision !== selected.request.revision))) return { status: "stale", reason: "document-request-changed" }
      if (requests.size + files.size + assets.length > 1000) return { status: "unavailable", reason: "document-selection-limit" }
      return { status: "ok", value: assets.map((asset) => {
        const selectionRef = randomUUID()
        files.set(selectionRef, { ...scope(context, now), asset })
        return { selectionRef, label: asset.label, surface: asset.surface }
      }) }
    },
    admitSelection: async (selectionRef: string, context: TrustedDomainContext): Promise<PortResult<SfDocumentAssetCatalogEntry>> => {
      const now = await clock(context)
      const selected = files.get(selectionRef)
      if (context.kind !== "ui" || now === undefined || !current(selected, context, now) || !selected) return { status: "denied", reason: "document-access-unavailable" }
      return input.admit(selected.asset, context)
    },
    dispose: () => { files.clear(); requests.clear() },
  }
}
