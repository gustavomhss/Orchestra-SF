import { randomUUID } from "node:crypto"
import path from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createApplication } from "../../../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import type { Application } from "../../../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import type { LocalStore } from "../../../../../../modules/sucafina/Sucafinav1/runtime/local-contract.ts"
import { PlannerModule } from "../../../../../../modules/sucafina/Sucafinav1/runtime/planner.ts"
import { ProcurementModule } from "../../../../../../modules/sucafina/Sucafinav1/runtime/procurement.ts"
import { scanLocalFile } from "../../../../../../modules/sucafina/Sucafinav1/runtime/local-scanner.ts"
import type { SfScopedSourcePort } from "../../../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { digestSfValue } from "../../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { createSfProductAuthority } from "../../../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { createSfImportHttp } from "../../../../../../modules/sucafina/Sucafinav1/product/interface/import-http.ts"
import { createSfDocumentHttp } from "../../../../../../modules/sucafina/Sucafinav1/product/interface/document-http.ts"
import { createSfBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfImportServices } from "../../../../../../apps/cli/src/sucafina-product/import-services.ts"
import { createSfDocumentServices } from "../../../../../../apps/cli/src/sucafina-product/document-services.ts"
import { createSfDocumentTargetAuthority } from "../../../../../../apps/cli/src/sucafina-product/document-authority.ts"

/** Original private-admission Actions composition, retained for the physical scanner controls.
 * Extracted unchanged from the pre-native browser factory; it owns no listener or renderer.
 * All operations use the committed production factories, one SQLite store, real
 * operator authentication and ClamD. Missing scanner configuration fails closed.
 * This browser composition provides no native Session/provider authority.
 */
export function createPrivateAdmissionInstallation(input: {
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
    sourceRoot: path.resolve(import.meta.dirname, "../../../../../../modules/sucafina/Sucafinav1/product/ai"),
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
  // Test-fixture diagnostics stay private to Actions and preserve each original
  // call, Request, authority result and public response. Only the first failed
  // gate of import-admit is recorded; names, selectors, bytes and credentials
  // never enter these bounded records.
  type AdmissionDiagnostic = { stage: "ui-admit" | "ui-validate" | "target" | "human-admit" | "file-admit"; status: string; reason?: string }
  const admissionDiagnostics: AdmissionDiagnostic[] = []
  const contextRequests = new WeakMap<object, Request>()
  const failedRequests = new WeakSet<Request>()
  const diagnosticReasons = new Set([
    "invalid-ui-operation", "ui-authority-unavailable", "ui-identity-unavailable", "ui-authority-changed",
    "authority-unavailable", "human-command-unavailable", "source-authority-unavailable", "source-access-unavailable",
    "source-unavailable", "source-changed", "source-or-authority-changed", "target-access-unavailable",
    "human-authority-required", "file-not-accepted", "file-admission-unavailable", "file-catalog-unavailable",
    "file-admission-conflict", "file-access-unavailable", "invalid-file-admission",
  ])
  const observeAdmission = (request: Request | undefined, stage: AdmissionDiagnostic["stage"], result: { status: string; reason?: string }) => {
    if (!request || new URL(request.url).searchParams.get("sf") !== "import-admit" ||
      failedRequests.has(request) || admissionDiagnostics.length >= 32) return
    if (result.status !== "ok") failedRequests.add(request)
    const status = ["ok", "denied", "unavailable", "stale", "conflict", "needs-input"].includes(result.status) ? result.status : "unavailable"
    const entry = { stage, status, ...(result.reason ? { reason: diagnosticReasons.has(result.reason) ? result.reason : "withheld" } : {}) }
    admissionDiagnostics.push(entry)
    // Playwright's webServer suppresses routine stdout. Keep successful probes
    // as informational, but surface a bounded, allowlisted failed gate on
    // stderr so an HTTP 403 can be attributed to its original producer.
    if (status === "ok") console.info("OPERATIONS75_IMPORT_GATE " + JSON.stringify(entry))
    else console.error("OPERATIONS75_IMPORT_GATE " + JSON.stringify(entry))
  }
  const ui: typeof authority.ui = {
    ...authority.ui,
    admit: async (request, operation, digest) => {
      const result = await authority.ui.admit(request, operation, digest)
      if (result.status === "ok") contextRequests.set(result.value, request)
      observeAdmission(request, "ui-admit", result)
      return result
    },
    validate: async (context, operation, digest) => {
      const result = await authority.ui.validate(context, operation, digest)
      observeAdmission(contextRequests.get(context), "ui-validate", { status: result ? "ok" : "denied", ...(result ? {} : { reason: "authority-unavailable" }) })
      return result
    },
    finish: (context) => { contextRequests.delete(context); authority.ui.finish(context) },
  }
  const human: typeof authority.human = {
    ...authority.human,
    admit: async (request, action, payload) => {
      const result = await authority.human.admit(request, action, payload)
      if (result.status === "ok") contextRequests.set(result.value, request)
      observeAdmission(request, "human-admit", result)
      return result
    },
    finish: (context) => { contextRequests.delete(context); authority.human.finish(context) },
  }
  const importService: typeof imports = {
    ...imports,
    prepareTarget: async (selection, context) => {
      const result = await imports.prepareTarget(selection, context)
      observeAdmission(contextRequests.get(context), "target", result)
      return result
    },
    imports: {
      ...imports.imports,
      admit: async (file, context) => {
        const result = await imports.imports.admit(file, context)
        observeAdmission(contextRequests.get(context), "file-admit", result)
        return result
      },
    },
  }
  const importHttp = createSfImportHttp({
    origin: input.origin, mount: input.mount,
    runtime: () => ({ ui, human, service: importService }),
  })
  const documentHttp = createSfDocumentHttp({
    origin: input.origin, mount: input.mount,
    runtime: () => ({ ui: authority.ui, human: authority.human, ...documents }),
  })
  return {
    admissionDiagnostics: () => structuredClone(admissionDiagnostics),
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
