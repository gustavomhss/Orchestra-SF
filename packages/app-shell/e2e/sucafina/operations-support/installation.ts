import { randomUUID } from "node:crypto"
import path from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createApplication } from "../../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import type { Application } from "../../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import type { LocalStore } from "../../../../../modules/sucafina/Sucafinav1/runtime/local-contract.ts"
import { PlannerModule } from "../../../../../modules/sucafina/Sucafinav1/runtime/planner.ts"
import { ProcurementModule } from "../../../../../modules/sucafina/Sucafinav1/runtime/procurement.ts"
import { scanLocalFile } from "../../../../../modules/sucafina/Sucafinav1/runtime/local-scanner.ts"
import type { SfScopedSourcePort } from "../../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { createSfProductAuthority } from "../../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { createSfImportHttp } from "../../../../../modules/sucafina/Sucafinav1/product/interface/import-http.ts"
import { createSfDocumentHttp } from "../../../../../modules/sucafina/Sucafinav1/product/interface/document-http.ts"
import { createSfBusinessServices } from "../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfImportServices } from "../../../../../apps/cli/src/sucafina-product/import-services.ts"
import { createSfDocumentServices } from "../../../../../apps/cli/src/sucafina-product/document-services.ts"
import { createSfDocumentTargetAuthority } from "../../../../../apps/cli/src/sucafina-product/document-authority.ts"

/** Assembly for the existing Actions host. It owns no listener or alternative renderer.
 * All operations use the committed production factories, one SQLite store, real
 * operator authentication and ClamD. Missing scanner configuration fails closed.
 * This browser composition provides no native Session/provider authority.
 */
export function createOperationsInstallation(input: {
  installationId: string
  directory: string
  origin: string
  mount: string
  principalRef: string
  readOnly: boolean
  persistence: LocalStore & SfScopedSourcePort
  authenticate: Application["authenticate"]
  environment: Application["environment"]
  signingKey: Uint8Array
  scanner: { host: "127.0.0.1"; port: number } | null
}) {
  if (input.scanner && (input.scanner.host !== "127.0.0.1" ||
    !Number.isInteger(input.scanner.port) || input.scanner.port < 1 || input.scanner.port > 65535))
    throw new Error("OPERATIONS_SCANNER_LOOPBACK_ENDPOINT_REQUIRED")
  const assets = { persistence: input.persistence, services: {
    signingKey: input.signingKey,
    scan: (bytes: Uint8Array) => scanLocalFile(bytes, input.scanner),
  } }
  const runtime = {
    installationId: input.installationId,
    directory: input.directory,
    sourceRoot: path.resolve(import.meta.dirname, "../../../../../modules/sucafina/Sucafinav1/product/ai"),
    origin: input.origin,
    mount: input.mount,
    persistence: input.persistence,
    authenticate: input.authenticate,
    environment: input.environment,
    assets,
  }
  const proposalCoverageWrites = new WeakSet<object>()
  const procurementEvidenceWrites = new WeakSet<object>()
  const authority = createSfProductAuthority({
    ...runtime,
    identity: () => ({
      installationId: input.installationId,
      hostId: "wp04-browser",
      projectId: input.installationId,
      location: Location.Ref.make({ directory: AbsolutePath.make(input.directory) }),
    }),
    policyVersion: "operations-browser24",
    grants: [{
      principalRef: input.principalRef,
      namespaces: ["documents", "receipts"],
      operations: ["sf_request_read", "sf_import_preview", "sf_document_extract", "sf_knowledge_search", "sf_evidence_get"],
      humanActions: input.readOnly ? [] : ["imports.admit", "imports.apply", "documents.schema", "documents.confirm"],
    }],
    createId: randomUUID,
    now: Date.now,
    commandIdentity: async (request, operation) => {
      if (request.method === "GET" || request.method === "HEAD") return randomUUID()
      const key = request.headers.get("Idempotency-Key")
      return key && /^[A-Za-z0-9._:-]{8,128}$/.test(key) ? digestSfValue({ operation, key }) : undefined
    },
    inspectSession: async () => undefined,
    verifySelection: async () => false,
    verifySkillReceipt: async () => false,
    providerGeneration: async () => undefined,
    authorizeDocument: createSfDocumentTargetAuthority(runtime),
    proposalCoverageWrites,
    procurementEvidenceWrites,
  })
  const imports = createSfImportServices({ runtime, authority })
  const documents = createSfDocumentServices({ runtime, authority })
  if (!imports || !documents) throw new Error("OPERATIONS_REQUIRES_SHARED_ASSET_PERSISTENCE")
  const business = createSfBusinessServices({
    authority,
    persistence: input.persistence,
    proposalCoverageWrites,
    procurementEvidenceWrites,
    documentRead: documents.documents.reader,
    documentEvidenceList: documents.documents.list,
    extraDescriptors: [...imports.descriptors, ...documents.descriptors],
  })
  const importHttp = createSfImportHttp({
    origin: input.origin, mount: input.mount,
    runtime: () => ({ ui: authority.ui, human: authority.human, service: imports }),
  })
  const documentHttp = createSfDocumentHttp({
    origin: input.origin, mount: input.mount,
    runtime: () => ({ ui: authority.ui, human: authority.human, ...documents }),
  })
  return {
    application: createApplication(input.mount, {
      persistence: input.persistence,
      authenticate: input.authenticate,
      environment: input.environment,
      assets,
      product: async (request, surface) => await documentHttp(request, surface) ?? await importHttp(request, surface),
      productView: business.procurementQueueView,
      domains: { procurement: [ProcurementModule], dashboard: [], planner: [PlannerModule] },
      maxJsonBytes: 100_000,
    }),
    dispose: () => {
      // Source39 owns an in-memory selection cache; the composed service does not.
      // Keep lifecycle cleanup compatible with both committed factory contracts.
      try {
        if ("dispose" in documents && typeof documents.dispose === "function") documents.dispose()
      } finally { business.dispose() }
    },
  }
}
