import { expect } from "bun:test"
import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AbsolutePath } from "@orchestra/core/schema"
import { createModule } from "../../../index.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createChoiceSnapshot } from "../../../product/decisions/choice.ts"
import { decorateSfProductHtml } from "../../../product/interface/html.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DecisionCase, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { HotTopicDraft } from "../../../product/decisions/hot-topic-draft.ts"
import atlasPackage from "../../../../../atlas/boundary/package.json" with { type: "json" }
import contractFreeze from "../../../product/contracts/freeze-v1.json" with { type: "json" }
import { createResidentAiBundle } from "../../../product/ai/resident.ts"
import { createSfBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfDashboardHttp } from "../../../../../../apps/cli/src/sucafina-product/dashboard-http.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
export const initialCaseRef = { id: "private-case-identity", incarnation: "case-incarnation", version: 1 }

// The browser composes the production BusinessContext, Dashboard, case and C12 services.
// Business records and the chosen scenario are fixture inputs; recovery faults affect delivery.
// Unsupported historical/receipt sources remain unavailable through the actual evidence router.
// No scanner is installed here; this consumer makes no native memory or publication claim.
export async function createRecoveryFixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-dashboard-recovery-"))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(directory)
  const routing: { handle?: (request: Request) => Promise<Response | undefined> } = {}
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (request) => await routing.handle?.(request) ?? new Response(null, { status: 503 }) })
  const origin = server.url.origin, installationId = randomUUID(), principalRef = `macos:${installationId}:1000`
  const clock = { at: "2026-11-13T08:00:00Z" }, policy = { writable: true, readable: true }
  const delayed: { next: boolean; release?: () => void; started?: () => void; calls: number } = { next: false, calls: 0 }
  const httpTrace: { mode: string; method: string; state: "received" | "returned" | "threw"; status?: number; elapsedMs?: number }[] = []
  const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID, projectScope: createSfSourceScopeProjector(() => clock.at) })
  const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator: { installationId, uid: 1000, name: "Dashboard reviewer" }, secrets: driver.secrets, key: randomBytes(32) })
  const authenticate: typeof identity.authenticate = async (request, context) => {
    const principal = await identity.authenticate(request, context)
    return principal && policy.readable ? { ...principal, canWrite: policy.writable && principal.canWrite } : null
  }
  const environment = async (request: Request) => ({ at: clock.at, id: randomUUID, directory: await identity.directory(request) })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.hotTopics = [{ id: "topic", action: "Original action", owner: "Operations", due: "2026-12-01", priority: "normal", status: "open", notes: "" }]
    return { commit: true, value: undefined }
  })
  const proposalCoverageWrites = new WeakSet<object>(), dashboardHostWrites = new WeakSet<object>()
  const authority = createSfProductAuthority({ identity: () => ({ installationId, hostId: "host", projectId: "project", location: { directory: AbsolutePath.make(directory) } }),
    installationId, origin, policyVersion: "policy", persistence, authenticate, environment, now: Date.now, createId: randomUUID,
    commandIdentity: async (request, operation) => request.method === "GET" || request.method === "HEAD" ? randomUUID() :
      request.headers.get("idempotency-key") ? digestSfValue({ operation, key: request.headers.get("idempotency-key") }) : undefined,
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined,
    authorizeDocument: async () => undefined, proposalCoverageWrites, dashboardHostWrites,
    grants: [{ principalRef, namespaces: ["cases", "preferences", "reviews", "receipts"], operations: ["sf_dashboard_read", "sf_case_read"],
      humanActions: ["reviews.preserve", "decisions.edit", "decisions.choose", "decisions.prepare-changes", "decisions.apply"] }] })
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites, dashboardHostWrites })
  const bundleRoot = path.resolve(import.meta.dir, "../../../product/ai")
  const bundle = await createResidentAiBundle({ root: bundleRoot, manifestPath: path.join(bundleRoot, "manifests/resident.json") })
  business.initializeAtlas(undefined, { boundaryVersion: atlasPackage.version, schemaVersion: contractFreeze.canonicalSha256,
    manifestVersion: bundle.manifestDigest, skillVersion: digestSfValue(bundle.skills.map((skill) => ({ id: skill.id, version: skill.version, sourceDigest: skill.sourceDigest }))) })
  const dashboard = business.dashboardServices, decisions = business.dashboardDecisions
  const http = createSfDashboardHttp({ origin, mount: "/sucafina", runtime: () => ({ authority, dashboard, decisions }) })
  const module = createModule("/sucafina", { persistence, authenticate, environment, product: http, productHtml: decorateSfProductHtml, maxJsonBytes: 100000 })
  routing.handle = async (request) => {
    const mode = new URL(request.url).searchParams.get("sf"), started = performance.now()
    const observation: (typeof httpTrace)[number] | undefined = mode === "dashboard-workbench" || mode === "dashboard-hot-topic-draft" ? { mode, method: request.method, state: "received" } : undefined
    if (observation) httpTrace.push(observation)
    try {
      const response = await identity.handle(request) ?? await module(request)
      if (mode === "dashboard-hot-topic-apply") {
        delayed.calls++
        if (delayed.next) { delayed.next = false; await new Promise<void>((resolve) => { delayed.release = resolve; delayed.started?.() }) }
      }
      if (observation) { observation.state = "returned"; observation.status = response?.status ?? 503 }
      return response
    } catch (error) {
      if (observation) observation.state = "threw"
      throw error
    } finally {
      if (observation) observation.elapsedMs = Math.round(performance.now() - started)
    }
  }
  const login = await identity.handle(new Request(`${origin}/sucafina/auth/local?code=${await identity.enroll()}`))
  const cookie = login?.headers.get("set-cookie")?.split(";")[0]
  if (!cookie) throw new Error("Operator enrollment failed")
  const request = () => new Request(`${origin}/sucafina/dashboard?sf=dashboard-workbench`, { method: "POST", headers: { cookie, origin, "content-type": "application/json", "idempotency-key": randomUUID() }, body: JSON.stringify({ page: "Hot Topics & Actions" }) })
  const read = async <T>(work: (context: TrustedDomainContext) => Promise<T>) => {
    const source = request(), digest = digestSfValue({ page: "Hot Topics & Actions" })
    const admitted = await authority.ui.admit(source, "sf_dashboard_read", digest)
    if (admitted.status !== "ok") throw new Error("UI read admission failed")
    try {
      if (!await authority.ui.validate(admitted.value, "sf_dashboard_read", digest)) throw new Error("UI read validation failed")
      return await work(admitted.value)
    } finally { authority.ui.finish(admitted.value) }
  }
  const decision: DecisionCase = { ...initialCaseRef, objective: "Review the action", state: "investigating", horizon: period, currency: "USD", participants: [principalRef],
    criteria: [{ id: "operational", description: "Operational action", required: true }], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const seeded = await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: 0, targetRef: authority.creationTarget.ref,
    targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "initial-cases", commandDigest: digestSfValue(decision) }, async (state) => {
      state.cases[decision.id] = decision
      state.cases["other-case"] = { ...decision, id: "other-case", incarnation: "other-case-inc", objective: "Unrelated confidential case", participants: ["another-principal"] }
      return { commit: true, value: true }
    })
  expect(seeded.status).toBe("ok")
  return { origin, identity, policy, clock, delayed, httpTrace, principalRef, persistence, authority, business, dashboard, decisions, request, read,
    close: async () => { delayed.release?.(); business.dispose(); await server.stop(true); await driver.dispose(); await rm(directory, { recursive: true, force: true }) } }
}

export async function storeExistingChoice(f: Awaited<ReturnType<typeof createRecoveryFixture>>, draft: HotTopicDraft) {
  const result: ScenarioResult = { id: "scenario", version: 1, currency: "USD", horizon: period, components: [], sourceRefs: [draft.targetEvidence],
    unresolvedConditions: ["Financial impact of the Hot Topic change is not assessed."], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: null, total: null,
    costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon: period, issues: [], evaluatedSourceRefs: [draft.targetEvidence],
      coverageState: "pending", entries: [{ status: "pending", categoryId: "other_relevant_costs", reason: "Financial impact is not assessed" }], derivedMissingCategoryIds: ["other_relevant_costs"] } }
  const current = await f.authority.state.read(f.request(), "cases", (state) => state.cases[initialCaseRef.id])
  if (current.status !== "ok" || !current.value) throw new Error("Case unavailable")
  const value: DecisionCase = { ...current.value, sourceRefs: [draft.targetEvidence],
    costCoverageBases: [{ id: "basis", version: 1, decisionType: "operational", categoryIds: ["other_relevant_costs"], additionalCategoryIds: [], sourceRefs: [draft.targetEvidence] }],
    alternatives: [{ id: "alternative", version: 1, title: "Update action", scenario: { baseRef: "case-base", operations: [{ kind: "replace", targetRef: draft.targetEvidence.refId, replacementRef: draft.draftRef }], assumptions: [] }, result }] }
  const selected = createChoiceSnapshot({ case: value, alternativeId: "alternative", alternativeVersion: 1, id: "choice", principalRef: f.principalRef, reason: "Proceed with operational action; no financial claim", at: f.clock.at,
    criteria: ["operational"], values: [], evidenceRefs: [draft.targetEvidence], comparison: { baselineResultRef: "baseline", alternativeResultRef: result.id, costCoverageRefs: ["basis"], criterionResults: [], unresolvedConditions: result.unresolvedConditions, comparisonStatus: "conditioned", knownDifference: null, completeDifference: null } })
  if (selected.status !== "ok") throw new Error(`Choice fixture invalid: ${selected.reason}`)
  const saved = await f.authority.state.transaction(f.request(), { namespace: "cases", expectedStorageVersion: current.storageVersion,
    targetRef: value.id, targetIncarnation: value.incarnation, idempotencyKey: "existing-choice", commandDigest: digestSfValue(selected.choice) }, async (state) => {
      state.cases[value.id] = { ...value, version: 2, state: "chosen", choices: [selected.choice] }; return { commit: true, value: true }
    })
  expect(saved.status).toBe("ok")
}
