import { randomUUID } from "node:crypto"
import type { CreateSfHostRuntime } from "../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import type { CapabilityDescriptor, CapabilityResult, TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { sfOperationInputSchemas } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import { sfOperationOutputSchemas } from "../../../../modules/sucafina/Sucafinav1/product/contracts/output-schemas.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import { dispatchSfCapability } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/capability-dispatch.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { sfDocumentLimits } from "../../../../modules/sucafina/Sucafinav1/product/documents/limits.ts"
import { createSfDocumentHost } from "../../../../modules/sucafina/Sucafinav1/product/documents/host.ts"
import { createSfDocumentBytePort } from "../../../../modules/sucafina/Sucafinav1/product/documents/byte-port.ts"
import { createSfDocumentSelections } from "../../../../modules/sucafina/Sucafinav1/product/documents/selections.ts"
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
  const selections = createSfDocumentSelections({ host: authority.host, assets: assets.persistence, services: assets.services, maxBytes: sfDocumentLimits.maxBytes, admit: documents.admit })
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
  const dispatch = (operation: "sf_document_extract" | "sf_knowledge_search", payload: unknown, context: TrustedDomainContext) => dispatchSfCapability({
    operation, payload, context, descriptors, authority: authority.authority,
    validateInput: (descriptor, value) => decodeSfOperationInput(descriptor.id, value).ok,
    validateOutput: (descriptor, value) => value.status !== "ok" || decodeSfOperationOutput(descriptor.id, value.result).ok,
  })
  return { documents, schemas, ...selections, descriptors, dispatch }
}
