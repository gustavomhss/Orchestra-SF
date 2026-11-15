import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AbsolutePath } from "@orchestra/core/schema"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { object } from "../../../runtime/contract.ts"
import type { Application } from "../../../runtime/application.ts"
import type { DecisionCasePort } from "../../../product/contracts/ports.ts"
import type { SfStateNamespace } from "../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import type { SfProductGrant } from "../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createSfBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfDashboardHttp } from "../../../../../../apps/cli/src/sucafina-product/dashboard-http.ts"

export const firstSavePeriod = { start: "2026-01-01", end: "2026-12-31" }
const at = "2026-11-14T00:00:00Z"
// Hot Topic record evidence is an as-of-day scope, separate from the case horizon.
export const firstSaveRecordPeriod = { start: at.slice(0, 10), end: at.slice(0, 10) }
const origin = "https://c12-first-save.example.test"
type Retained = { directory: string; installationId: string }
type CaseDraft = Parameters<DecisionCasePort["draft"]>[0]

/** Only the initial business record and authenticated actors are fixture inputs.
 * Cases and draft outcomes are created by their production producers. The fault
 * drops an acknowledgement after the real C08 transaction has returned: it never
 * supplies a successful result, alters a callback, or writes an outcome itself. */
export async function openFirstSaveFixture(retained?: Retained) {
  const directory = retained?.directory ?? await mkdtemp(join(await realpath(tmpdir()), "sf-c12-first-save-"))
  if (!retained) await chmod(directory, 0o700)
  const installationId = retained?.installationId ?? randomUUID()
  const database = await openLocalStore(directory)
  const persistence = createSfSourcePersistence({ persistence: database, enumerate: enumerateSfSources,
    createId: randomUUID, projectScope: createSfSourceScopeProjector(() => at) })
  if (!retained) {
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.hotTopics = [{ id: "topic", action: "Original action", owner: "Operations", due: "2026-12-01", priority: "normal", status: "open", notes: "" }]
      return { commit: true, value: undefined }
    })
  }
  const permitted = new Set(["alice", "bob"])
  const authenticate: Application["authenticate"] = async (request, selected) => {
    const id = request.headers.get("authorization")?.replace(/^Bearer /, "")
    if (!id || !permitted.has(id) || !selected) return null
    return { id, canWrite: true, roles: [{ surface: selected.surface,
      role: selected.surface === "dashboard" ? "admin" : selected.surface === "planner" ? "finance" : "buyer" }] }
  }
  const environment: Application["environment"] = async () => ({ at, id: randomUUID,
    directory: [{ id: "alice", name: "Alice" }, { id: "bob", name: "Bob" }] })
  const proposalCoverageWrites = new WeakSet<object>(), dashboardHostWrites = new WeakSet<object>()
  const authority = createSfProductAuthority({
    identity: () => ({ installationId, hostId: "c12-first-save", projectId: "project", location: { directory: AbsolutePath.make(directory) } }),
    installationId, origin, policyVersion: "policy", persistence, authenticate, environment, createId: randomUUID, now: Date.now,
    grants: ["alice", "bob"].map((principalRef): SfProductGrant => ({ principalRef, namespaces: ["cases", "preferences", "receipts"],
      operations: ["sf_case_draft", "sf_case_read", "sf_dashboard_read"], humanActions: ["decisions.edit"] })),
    commandIdentity: async (request, operation) => {
      const key = request.headers.get("idempotency-key")
      return key && /^[A-Za-z0-9._:-]{8,128}$/.test(key) ? digestSfValue({ operation, key }) : undefined
    },
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
    providerGeneration: async () => undefined, authorizeDocument: async () => undefined, proposalCoverageWrites, dashboardHostWrites,
  })
  const acknowledgements: { namespace: SfStateNamespace; key: string; value: unknown; storageVersion: number }[] = []
  let fault: { namespace: SfStateNamespace; key: string } | undefined
  const transaction = authority.state.transaction
  authority.state.transaction = async (request, command, work) => {
    const result = await transaction(request, command, work)
    if (fault && command.namespace === fault.namespace && request.headers.get("idempotency-key") === fault.key && result.status === "ok") {
      acknowledgements.push({ namespace: command.namespace, key: fault.key, value: structuredClone(result.value), storageVersion: result.storageVersion })
      fault = undefined
      throw new Error("C12_TEST_ACKNOWLEDGEMENT_LOST_AFTER_REAL_COMMIT")
    }
    return result
  }
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites, dashboardHostWrites })
  const http = createSfDashboardHttp({ origin, mount: "/sf", runtime: () => ({ authority,
    dashboard: business.dashboardServices, decisions: business.dashboardDecisions }) })
  const request = (mode: string, payload: unknown, key: string = randomUUID(), actor = "alice") => new Request(`${origin}/sf/dashboard?sf=${mode}`, {
    method: "POST", headers: { authorization: `Bearer ${actor}`, origin, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(payload),
  })
  const draftCase = async (payload: CaseDraft, key: string, actor = "alice") => {
    const source = request("workbench-command", { operation: "sf_case_draft", input: payload }, key, actor)
    const digest = digestSfValue(payload)
    const admitted = await authority.ui.admit(source, "sf_case_draft", digest)
    if (admitted.status !== "ok") return admitted
    try {
      if (!await authority.ui.validate(admitted.value, "sf_case_draft", digest)) throw new Error("Real case admission was not consumed")
      return await business.cases.draft(payload, admitted.value)
    } finally { authority.ui.finish(admitted.value) }
  }
  const read = async <T>(work: (context: TrustedDomainContext) => Promise<T>) => {
    const payload = { page: "Hot Topics & Actions" }
    const admitted = await authority.ui.admit(request("dashboard-workbench", payload), "sf_dashboard_read", digestSfValue(payload))
    if (admitted.status !== "ok") throw new Error(`Real Dashboard read admission failed: ${admitted.reason}`)
    try {
      if (!await authority.ui.validate(admitted.value, "sf_dashboard_read", digestSfValue(payload))) throw new Error("Real Dashboard read admission was not consumed")
      return await work(admitted.value)
    } finally { authority.ui.finish(admitted.value) }
  }
  let closed = false
  return {
    retained: { directory, installationId }, authority, business, persistence, request, draftCase, read, acknowledgements,
    loseNextCommitAcknowledgement: (namespace: SfStateNamespace, key: string) => { fault = { namespace, key } },
    revoke: (principal: string) => { permitted.delete(principal) }, restore: (principal: string) => { permitted.add(principal) },
    http: async (mode: string, payload: unknown, key: string = randomUUID(), actor = "alice") => {
      const response = await http(request(mode, payload, key, actor), "dashboard")
      if (!response) throw new Error(`Dashboard production route unavailable: ${mode}`)
      return { status: response.status, body: object(await response.json()) }
    },
    state: async () => {
      const current = await authority.state.read(request("state-observation", {}), "cases", (state) => structuredClone(state))
      if (current.status !== "ok") throw new Error(`Canonical C08 state unavailable: ${current.status}`)
      return current.value
    },
    durable: async () => {
      if (!persistence.transactionAll) throw new Error("Real SQLite transactionAll is required")
      return persistence.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
    },
    close: async (remove = true) => {
      if (!closed) { closed = true; business.dispose(); await database.dispose() }
      if (remove) await rm(directory, { recursive: true, force: true })
    },
  }
}
