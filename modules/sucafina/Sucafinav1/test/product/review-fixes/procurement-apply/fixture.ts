import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import atlasPackage from "../../../../../../atlas/boundary/package.json" with { type: "json" }
import contractFreeze from "../../../../product/contracts/freeze-v1.json" with { type: "json" }
import { createApplication } from "../../../../runtime/application.ts"
import type { Application } from "../../../../runtime/application.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { object } from "../../../../runtime/contract.ts"
import { domain } from "../../../../runtime/procurement.ts"
import { initialProcurementSettings } from "../../../../src/initial-settings.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createResidentAiBundle } from "../../../../product/ai/resident.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import type { SfProductGrant } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { createProcurementDecisionHttp } from "../../../../product/procurement/decision-http.ts"

export const period = { start: "2026-01-01", end: "2026-12-31" }
export const at = "2026-11-13T00:00:00Z"
export const actor = { id: "alice", canWrite: true, roles: ["requester", "buyer"], assigned: [], domains: [] }

/** The same real composition as WP04 host-integration; only persisted fixture data varies. */
export async function createFixture(stage: "draft" | "pr_rejected" | "po_draft") {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-procurement-apply-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const persistence = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at), createId: randomUUID })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("procurement", async (snapshot) => {
    snapshot.data.store = {
      requests: { "PR-1": { request: {
        number: "PR-1", createdBy: actor.id, status: stage,
        pr: { title: "Requisition fixture", justification: "Recorded need", estAmount: 100 }, history: [], attachments: [],
        ...(stage === "po_draft" ? { buyerId: actor.id, po: { currency: "USD", supplierId: null, supplier: "Supplier fixture", description: "Recorded order", lines: [{ desc: "Coffee", qty: 1, unitPrice: 100 }], billingAddress: "Billing fixture", deliveryAddress: "Delivery fixture" } } : {}),
      }, version: 0, by: actor.id } },
      suppliers: [], settings: initialProcurementSettings(), issued: { pr: ["PR-1"], po: [] },
    }
    snapshot.versions["requests:PR-1"] = { version: 0, by: actor.id }
    // Normalize through the real domain before issuing evidence. In po_draft this
    // is a legitimate PO save by the same buyer, not the ignored PR command.
    const request = object(object(object(snapshot.data.store).requests)["PR-1"])
    const values = stage === "po_draft" ? { po: object(object(request.request).po) } : { pr: { estAmount: 100 } }
    const normalized = domain.execute(snapshot, actor, { page: "Requests", action: "save", id: "PR-1", version: 0, values }, { at, id: randomUUID, directory: [{ id: actor.id, name: "Alice" }] })
    if (!normalized.ok) throw new Error(`canonical fixture save failed: ${normalized.status}`)
    return { commit: true, value: undefined }
  })
  const permitted = new Set(["alice", "bob"])
  const authenticate: Application["authenticate"] = async (request, selection) => {
    const id = request.headers.get("authorization")?.replace(/^Bearer /, "")
    if (!id || !permitted.has(id) || !selection) return null
    const roles = selection.surface === "procurement" ? id === "alice" ? actor.roles : ["buyer"] : selection.surface === "planner" ? ["editor"] : ["viewer"]
    return { id, canWrite: true, roles: roles.map((role) => ({ surface: selection.surface, role })) }
  }
  const environment: Application["environment"] = async () => ({ at, id: randomUUID, directory: [{ id: "alice", name: "Alice" }, { id: "bob", name: "Bob" }] })
  const origin = "https://local.invalid"
  const request = (principal = "alice", mode?: string, payload?: unknown, key: string = randomUUID()) => new Request(`${origin}/sf/procurement${mode ? `?sf=${mode}` : ""}`, {
    method: payload === undefined ? "GET" : "POST",
    headers: { authorization: `Bearer ${principal}`, origin, "content-type": "application/json", "idempotency-key": key },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  })
  const proposalCoverageWrites = new WeakSet<object>()
  const procurementEvidenceWrites = new WeakSet<object>()
  const mounted: { business?: ReturnType<typeof createSfBusinessServices> } = {}
  const authority = createSfProductAuthority({
    identity: () => ({ installationId: "i", hostId: "procurement-apply", projectId: "p", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }),
    installationId: "i", origin, policyVersion: "p1", persistence, authenticate, environment,
    grants: ["alice", "bob"].map((principalRef): SfProductGrant => ({ principalRef, namespaces: ["cases", "preferences", "confirmations", "receipts", "threads", "relations"], operations: ["sf_work_list", "sf_request_read", "sf_case_draft", "sf_case_read", "sf_context_read"], humanActions: ["decisions.prepare-changes", "decisions.portfolio.read", "decisions.apply"] })),
    createId: randomUUID, now: Date.now,
    commandIdentity: async (value, operation, inputDigest) => value.headers.get("idempotency-key") ? digestSfValue({ key: value.headers.get("idempotency-key"), operation, inputDigest }) : undefined,
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined,
    proposalCoverageWrites, procurementEvidenceWrites,
    authorizePreparedTarget: (value, snapshot, targetRef, current) => mounted.business?.procurementDecisions.authorizeReceiptTarget(value, snapshot, targetRef, current) ?? Promise.resolve(undefined),
  })
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites, procurementEvidenceWrites })
  mounted.business = business
  const root = path.resolve(import.meta.dir, "../../../../product/ai")
  const bundle = await createResidentAiBundle({ root, manifestPath: path.join(root, "manifests/resident.json") })
  business.initializeAtlas(undefined, { boundaryVersion: atlasPackage.version, schemaVersion: contractFreeze.canonicalSha256, manifestVersion: bundle.manifestDigest, skillVersion: digestSfValue(bundle.skills.map((skill) => ({ id: skill.id, version: skill.version, sourceDigest: skill.sourceDigest }))) })
  const product = createProcurementDecisionHttp({ origin, mount: "/sf", runtime: () => ({ human: authority.human, decisions: business.procurementDecisions, withCase: business.withCase }) })
  const application = createApplication("/sf", { authenticate, environment, persistence, maxJsonBytes: 131072, domains: { dashboard: [], planner: [], procurement: [] }, product })
  const ui = async (operation: string, payload: unknown, principal = "alice") => {
    const admitted = await authority.ui.admit(request(principal), operation, digestSfValue(payload))
    if (admitted.status !== "ok" || !await authority.ui.validate(admitted.value, operation, digestSfValue(payload))) throw new Error(`UI admission failed: ${operation}/${principal}`)
    return admitted.value
  }
  const selection = await ui("sf_work_list", { purpose: "work-selection", period })
  const selected = await business.procurementSelections.create(selection, period)
  authority.ui.finish(selection)
  if (selected.status !== "ok") throw new Error(`selection failed: ${selected.reason}`)
  const issuer = await ui("sf_request_read", { request: "PR-1" })
  const issued = await business.individual.issue("procurement-request", "PR-1", issuer)
  if (issued.status !== "ok") throw new Error(`source unavailable: ${issued.reason}`)
  const source = await business.individual.resolve(issued.value, issuer)
  authority.ui.finish(issuer)
  if (source.status !== "ok") throw new Error("source evidence unavailable")
  const draft = { objective: "Apply the exact requisition amount", criteria: ["Budget impact"], horizon: period, currency: "USD", sourceRefs: [source.value.evidence] }
  const draftCall = await ui("sf_case_draft", draft)
  const created = await business.cases.draft(draft, draftCall)
  authority.ui.finish(draftCall)
  if (created.status !== "ok") throw new Error(`case draft unavailable: ${created.reason}`)
  return {
    authority, business, persistence, request, ui, evidence: source.value.evidence,
    storedCase: async () => {
      const result = await authority.state.read(request(), "cases", (state) => state.cases[created.value.id])
      if (result.status !== "ok" || !result.value) throw new Error("fixture case unavailable")
      return { storageVersion: result.storageVersion, value: result.value }
    },
    material: () => persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: {
      request: structuredClone(object(object(object(object(snapshot.data.store).requests)["PR-1"]).request)),
      version: structuredClone(snapshot.versions["requests:PR-1"]!), settings: structuredClone(object(snapshot.data.store).settings),
    } })),
    receipts: () => persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(object(object(snapshot.data.__sfProductV1).receipts)) })),
    edit: async (pr: Record<string, unknown>) => {
      const result = await persistence.transaction("procurement", async (snapshot) => {
        const outcome = domain.execute(snapshot, actor, { page: "Requests", action: "save", id: "PR-1", version: snapshot.versions["requests:PR-1"]?.version ?? 0, values: { pr } }, await environment(request()))
        return { commit: outcome.ok, value: outcome }
      })
      if (!result.ok) throw new Error(`domain edit failed: ${result.status}`)
    },
    revoke: () => { permitted.delete("alice") },
    http: async (mode: string, payload: unknown, principal = "alice", key: string = randomUUID()) => {
      const response = await application(request(principal, mode, payload, key))
      if (!response) throw new Error("Procurement HTTP handler absent")
      return { response, body: object(await response.json()) }
    },
    dispose: async () => { business.dispose(); await store.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}

export type Fixture = Awaited<ReturnType<typeof createFixture>>
