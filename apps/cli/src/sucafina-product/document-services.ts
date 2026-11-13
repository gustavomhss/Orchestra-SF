import { randomUUID } from "node:crypto"
import type { CreateSfHostRuntime } from "../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import type { CapabilityDescriptor, CapabilityResult, TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { sfOperationInputSchemas } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import { sfOperationOutputSchemas } from "../../../../modules/sucafina/Sucafinav1/product/contracts/output-schemas.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { sfDocumentLimits } from "../../../../modules/sucafina/Sucafinav1/product/documents/limits.ts"
import { createSfDocumentHost } from "../../../../modules/sucafina/Sucafinav1/product/documents/host.ts"
import { assetLink } from "../../../../modules/sucafina/Sucafinav1/runtime/assets.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object, rows } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Actor } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { createSfDocumentBytePort } from "../../../../modules/sucafina/Sucafinav1/product/documents/byte-port.ts"
import { createSfDocumentSchemas } from "../../../../modules/sucafina/Sucafinav1/product/documents/schemas.ts"

/** Root composition supplies the real installation assets and its approved schema registry. */
export function createSfDocumentServices(input: { runtime: Parameters<CreateSfHostRuntime>[0]; authority: ReturnType<typeof createSfProductAuthority> }) {
  const assets = input.runtime.assets
  if (!assets || !Object.is(assets.persistence, input.runtime.persistence)) return undefined
  const authority = input.authority
  const bytes = createSfDocumentBytePort({ host: authority.host, assets: assets.persistence, services: assets.services, state: authority.state, maxBytes: sfDocumentLimits.maxBytes })
  const schemas = createSfDocumentSchemas({ state: authority.state, documents: bytes, host: authority.host, creationTarget: authority.creationTarget, operationIdentity: (context) => context.kind === "ui" ? authority.ui.operationIdentity(context) : undefined, confirm: (payload, context) => authority.human.authorize(context, "documents.schema", payload) })
  const documents = createSfDocumentHost({ origin: input.runtime.origin, mount: input.runtime.mount, host: authority.host, assets: assets.persistence, services: assets.services, state: authority.state, limits: sfDocumentLimits, resolveFieldSchema: schemas.resolve, verifyFieldSchema: schemas.verify, operationIdentity: (context, operation) => {
    if (context.kind === "ui") return authority.ui.operationIdentity(context)
    if (!operation) return undefined
    const receipt = authority.authority.receiptFor(context, operation.name, operation.digest)
    return receipt?.kind === "native" ? digestSfValue({ runId: receipt.runId, callId: receipt.callId, operation: operation.name }) : undefined
  }, confirmDocument: (evidence, context) => authority.human.authorize(context, "documents.confirm", evidence), createId: randomUUID, now: () => new Date().toISOString() })
  const selections = new Map<string, { surface: "dashboard" | "procurement"; assetId: string; installationId: string; projectId: string; principalRef: string; accessRevision: string; policyVersion: string; expires: number }>()
  const discover = async (context: TrustedDomainContext) => {
    const request = authority.host.requestFor(context)
    if (!request || !await authority.host.revalidate(context)) return { status: "denied" as const, reason: "document-access-unavailable" }
    const environment = await authority.host.environment(request)
    const now = Date.parse(environment.at)
    if (!Number.isFinite(now)) return { status: "unavailable" as const, reason: "clock-unavailable" }
    const groups = await Promise.all((["dashboard", "procurement"] as const).map((surface) => assets.persistence.transaction(surface, async (snapshot) => {
      const principal = await authority.host.authenticate(request, { surface, roleMap: roleMap(snapshot, surface) })
      if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: [] }
      const access = object(object(snapshot.data.access)[principal.id])
      const roles = principal.roles.filter((row) => row.surface === surface).map((row) => row.role)
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
      const visible = rows(snapshot.data.assets).filter((asset) => typeof asset.id === "string" && typeof asset.name === "string" && !!asset.name.trim() && typeof asset.bytes === "number" && asset.bytes > 0 && asset.bytes <= sfDocumentLimits.maxBytes && ["text/plain", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(String(asset.type)) && assetLink(snapshot, actor, environment, assets.services, asset.id).ok)
      return { commit: false, value: visible.map((asset) => ({ surface, assetId: String(asset.id), label: String(asset.name) })) }
    }, { signal: request.signal })))
    if (!await authority.host.revalidate(context)) return { status: "denied" as const, reason: "document-access-unavailable" }
    const visible = groups.flat()
    if (visible.length > 100) return { status: "unavailable" as const, reason: "document-limit-exceeded" }
    for (const [key, value] of selections) if (value.expires <= now) selections.delete(key)
    if (selections.size + visible.length > 1000) return { status: "unavailable" as const, reason: "document-selection-limit" }
    const result = visible.map((asset) => {
      const selectionRef = randomUUID()
      selections.set(selectionRef, { surface: asset.surface, assetId: asset.assetId, installationId: context.binding.installationId, projectId: context.binding.projectId, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, expires: now + 300_000 })
      return { selectionRef, label: asset.label, surface: asset.surface }
    })
    return { status: "ok" as const, value: result }
  }
  const admitSelection = async (selectionRef: string, context: TrustedDomainContext) => {
    const request = authority.host.requestFor(context)
    if (!request || context.kind !== "ui" || !await authority.host.revalidate(context)) return { status: "denied" as const, reason: "document-access-unavailable" }
    const now = Date.parse((await authority.host.environment(request)).at)
    const selected = selections.get(selectionRef)
    if (!selected || !Number.isFinite(now) || selected.expires <= now || selected.installationId !== context.binding.installationId || selected.projectId !== context.binding.projectId || selected.principalRef !== context.binding.principalRef || selected.accessRevision !== context.binding.accessRevision || selected.policyVersion !== context.binding.policyVersion) return { status: "denied" as const, reason: "document-access-unavailable" }
    return documents.admit({ surface: selected.surface, assetId: selected.assetId }, context)
  }
  const handler = async (operation: "sf_document_extract" | "sf_knowledge_search", value: unknown, context: TrustedDomainContext): Promise<CapabilityResult> => {
    const parsed = decodeSfOperationInput(operation, value)
    if (!parsed.ok) return { status: "needs-input", reason: "invalid-input", receipt: { kind: "unbound", operation, code: "invalid-input", at: new Date().toISOString() } }
    const digest = digestSfValue(parsed.value)
    const admitted = authority.authority.receiptFor(context, operation, digest)
    if (!admitted) return { status: "denied", reason: "invalid-binding", receipt: { kind: "unbound", operation, code: "invalid-binding", at: new Date().toISOString() } }
    const result = operation === "sf_document_extract" ? await documents.extract(parsed.value as Parameters<typeof documents.extract>[0], context) : await documents.search(parsed.value as Parameters<typeof documents.search>[0], context)
    if (result.status !== "ok") return { status: result.status === "conflict" ? "failed" : result.status, reason: result.reason, receipt: admitted }
    const output = decodeSfOperationOutput(operation, result.value)
    if (!output.ok || !await authority.host.revalidate(context)) return { status: "unavailable", reason: "document-result-unavailable", receipt: admitted }
    const receipt = authority.authority.receiptFor(context, operation, digest, digestSfValue(output.value))
    if (!receipt) return { status: "unavailable", reason: "receipt-unavailable", receipt: admitted }
    return { status: "ok", result: output.value, receipt }
  }
  const descriptors: readonly CapabilityDescriptor[] = [
    { id: "sf_document_extract", pack: "documents_reports", mode: "prepare", inputSchema: sfOperationInputSchemas.sf_document_extract, outputSchema: sfOperationOutputSchemas.sf_document_extract, handler: (payload, context) => handler("sf_document_extract", payload, context), handlerExport: "extractDocumentEvidence", producerTask: "WP06.T05", grantProfiles: ["sf_maestro", "sf_procurement"], requiredAuthority: ["documents:read"] },
    { id: "sf_knowledge_search", pack: "knowledge", mode: "read", inputSchema: sfOperationInputSchemas.sf_knowledge_search, outputSchema: sfOperationOutputSchemas.sf_knowledge_search, handler: (payload, context) => handler("sf_knowledge_search", payload, context), handlerExport: "searchDocumentEvidence", producerTask: "WP06.T05", grantProfiles: ["sf_maestro", "sf_finance", "sf_procurement", "sf_portfolio", "sf_reviewer"], requiredAuthority: ["documents:read"] },
  ]
  return { documents, schemas, discover, admitSelection, descriptors, dispose: () => selections.clear() }
}
