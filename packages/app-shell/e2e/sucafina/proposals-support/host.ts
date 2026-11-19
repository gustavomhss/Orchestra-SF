import { randomBytes, randomUUID } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { openLocalStore } from "../../../../../modules/sucafina/Sucafinav1/runtime/local-store"
import { createOperatorIdentity } from "../../../../../modules/sucafina/Sucafinav1/runtime/operator-identity"
import { object, rows } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract"
import { createSfSourcePersistence } from "../../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle"
import { enumerateSfSources } from "../../../../../modules/sucafina/Sucafinav1/product/integration/source-inventory"
import { createSfSourceScopeProjector } from "../../../../../modules/sucafina/Sucafinav1/product/integration/source-projections"
import { initializeAbsentSfProductState } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical"
import { createChoiceSnapshot } from "../../../../../modules/sucafina/Sucafinav1/product/decisions/choice"
import type { DecisionCase, ScenarioResult } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/decisions"
import type { HotTopicDraft } from "../../../../../modules/sucafina/Sucafinav1/product/decisions/hot-topic-draft"
import { initialCaseRef, type ProposalConfiguration, type ProposalReady } from "./protocol"

const filename = process.argv[2]
if (!filename || !path.isAbsolute(filename)) throw new Error("PROPOSAL_PRIVATE_CONFIGURATION_REQUIRED")
const configuration: ProposalConfiguration = JSON.parse(await readFile(filename, "utf8"))
const { directory, origin, installationId } = configuration
if (!path.isAbsolute(directory) || origin !== "http://127.0.0.1:3000" || !/^[a-f0-9]{64}$/.test(configuration.controlKey))
  throw new Error("PROPOSAL_PRIVATE_CONFIGURATION_INVALID")
await Promise.all(["host-data", "host-config", "host-cache", "host-state", "host-tmp"].map((name) =>
  mkdir(path.join(directory, name), { recursive: true, mode: 0o700 })))
Object.assign(process.env, {
  ORCHESTRA_DB: path.join(directory, "host-data", "orchestra.db"),
  ORCHESTRA_INHERIT_CREDENTIALS: "0", ORCHESTRA_DISABLE_PROJECT_CONFIG: "1",
  ORCHESTRA_CONFIG_DIR: path.join(directory, "host-config"),
  ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(directory, "host-credential.key"),
  TMPDIR: path.join(directory, "host-tmp"),
  XDG_DATA_HOME: path.join(directory, "host-data"), XDG_CONFIG_HOME: path.join(directory, "host-config"),
  XDG_CACHE_HOME: path.join(directory, "host-cache"), XDG_STATE_HOME: path.join(directory, "host-state"),
})
await import("@orchestra/core/global")
const { createEmbeddedRoutes } = await import("../../../../server/src/routes")
const { createOperationsInstallation } = await import("../operations-support/installation")
const { AppNodeBuilder } = await import("@orchestra/core/effect/app-node-builder")
const { LayerNode } = await import("@orchestra/core/effect/layer-node")
const { PermissionSaved } = await import("@orchestra/core/permission/saved")
const { ClaudeCodeAccount } = await import("@orchestra/core/claude-code-account")
const mount = "/sucafina", at = "2026-11-13T08:00:00Z"
const actorId = "macos:" + installationId + ":1000"
const driver = await openLocalStore(directory)
const sources = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources,
  projectScope: createSfSourceScopeProjector(() => at), createId: randomUUID })
const store = { ...driver, ...sources }
for (const surface of ["dashboard", "planner", "procurement"] as const) await store.initializeSources(surface)
await initializeAbsentSfProductState(store, randomUUID)
await store.transaction("dashboard", async (snapshot) => {
  snapshot.data.hotTopics = [{ id: "topic", action: "Original action", owner: "Operations", due: "2026-12-01",
    priority: "normal", status: "open", notes: "" }]
  return { commit: true, value: undefined }
})
const identity = createOperatorIdentity({ origin, mount,
  operator: { installationId, uid: 1000, name: "Dashboard reviewer" }, secrets: driver.secrets, key: randomBytes(32) })
// These switches only withdraw the enrolled operator's existing authority.
const policy = { readable: true, writable: true }
const authenticate: typeof identity.authenticate = async (request, context) => {
  const principal = await identity.authenticate(request, context)
  return principal && policy.readable ? { ...principal, canWrite: policy.writable && principal.canWrite } : null
}
const installation = await createOperationsInstallation({
  installationId, directory, origin, mount, operators: [{ principalRef: actorId, readOnly: false }],
  persistence: store, authenticate, isAuthenticated: async (request) => !!await identity.person(request),
  environment: async (request) => ({ at, id: randomUUID, directory: await identity.directory(request) }),
  signingKey: randomBytes(32), scanner: null,
  grants: [{ principalRef: actorId, namespaces: ["cases", "preferences", "reviews", "receipts"],
    operations: ["sf_dashboard_read", "sf_case_read"],
    humanActions: ["reviews.preserve", "decisions.edit", "decisions.choose", "decisions.prepare-changes", "decisions.apply"] }],
})
const embedded = HttpRouter.toWebHandler(createEmbeddedRoutes({
  host: installation.host, sucafinaInstallations: installation.discovery,
}).pipe(HttpRouter.provideRequest(AppNodeBuilder.build(LayerNode.group([
  PermissionSaved.node, ClaudeCodeAccount.node,
]))), Layer.provide(HttpServer.layerServices)), { disableLogger: true })
const health = await embedded.handler(new Request(origin + "/api/health"))
const authority = installation.services?.()
if (health.status !== 200 || !installation.identity() || !authority) throw new Error("PROPOSAL_REAL_HOST_NOT_READY")
const code = await identity.enroll()
const enrollmentRequest = new Request(origin + mount + "/auth/local?code=" + code)
await identity.prepare(enrollmentRequest)
const enrollment = await identity.handle(enrollmentRequest)
if (enrollment?.status !== 303) throw new Error("PROPOSAL_REAL_ENROLLMENT_FAILED")
const cookie = enrollment.headers.get("set-cookie")
if (!cookie) throw new Error("PROPOSAL_REAL_SESSION_MISSING")
const sessionHeader = cookie.split(";")[0]!
const request = () => new Request(origin + mount + "/dashboard?sf=dashboard-workbench", {
  method: "POST", headers: { cookie: sessionHeader, origin, "content-type": "application/json", "idempotency-key": randomUUID() },
  body: JSON.stringify({ page: "Hot Topics & Actions" }),
})
const decision: DecisionCase = { ...initialCaseRef, objective: "Review the action", state: "investigating",
  horizon: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD", participants: [actorId],
  criteria: [{ id: "operational", description: "Operational action", required: true }], sourceRefs: [],
  alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
const seeded = await authority.state.transaction(request(), {
  namespace: "cases", expectedStorageVersion: 0, targetRef: authority.creationTarget.ref,
  targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "initial-cases", commandDigest: digestSfValue(decision),
}, async (state) => {
  state.cases[decision.id] = decision
  state.cases["other-case"] = { ...decision, id: "other-case", incarnation: "other-case-inc",
    objective: "Unrelated confidential case", participants: ["another-principal"] }
  return { commit: true, value: true }
})
if (seeded.status !== "ok") throw new Error("PROPOSAL_REAL_CASE_SEED_FAILED")
const period = { start: "2026-01-01", end: "2026-12-31" }
// The existing WP02 conditioned choice fixture, preserved without inventing a financial result.
async function storeExistingChoice(draft: HotTopicDraft) {
  const result: ScenarioResult = { id: "scenario", version: 1, currency: "USD", horizon: period, components: [], sourceRefs: [draft.targetEvidence],
    unresolvedConditions: ["Financial impact of the Hot Topic change is not assessed."], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: null, total: null,
    costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon: period, issues: [], evaluatedSourceRefs: [draft.targetEvidence],
      coverageState: "pending", entries: [{ status: "pending", categoryId: "other_relevant_costs", reason: "Financial impact is not assessed" }], derivedMissingCategoryIds: ["other_relevant_costs"] } }
  const current = await authority.state.read(request(), "cases", (state) => state.cases[initialCaseRef.id])
  if (current.status !== "ok" || !current.value) throw new Error("Case unavailable")
  const value: DecisionCase = { ...current.value, sourceRefs: [draft.targetEvidence],
    costCoverageBases: [{ id: "basis", version: 1, decisionType: "operational", categoryIds: ["other_relevant_costs"], additionalCategoryIds: [], sourceRefs: [draft.targetEvidence] }],
    alternatives: [{ id: "alternative", version: 1, title: "Update action", scenario: { baseRef: "case-base", operations: [{ kind: "replace", targetRef: draft.targetEvidence.refId, replacementRef: draft.draftRef }], assumptions: [] }, result }] }
  const selected = createChoiceSnapshot({ case: value, alternativeId: "alternative", alternativeVersion: 1, id: "choice", principalRef: actorId, reason: "Proceed with operational action; no financial claim", at: at,
    criteria: ["operational"], values: [], evidenceRefs: [draft.targetEvidence], comparison: { baselineResultRef: "baseline", alternativeResultRef: result.id, costCoverageRefs: ["basis"], criterionResults: [], unresolvedConditions: result.unresolvedConditions, comparisonStatus: "conditioned", knownDifference: null, completeDifference: null } })
  if (selected.status !== "ok") throw new Error(`Choice fixture invalid: ${selected.reason}`)
  const saved = await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: current.storageVersion,
    targetRef: value.id, targetIncarnation: value.incarnation, idempotencyKey: "existing-choice", commandDigest: digestSfValue(selected.choice) }, async (state) => {
      state.cases[value.id] = { ...value, version: 2, state: "chosen", choices: [selected.choice] }; return { commit: true, value: true }
    })
  if (saved.status !== "ok") throw new Error("PROPOSAL_EXISTING_CHOICE_NOT_SAVED")
}
const traffic: { mode: string | null; status: number; result: Record<string, unknown> }[] = []
const observe = async () => ({
  preferences: await authority.state.read(request(), "preferences", (state) => ({
    keys: Object.keys(state.preferences).filter((key) => key.startsWith("sf:proposal-coverage:hot-topic:")),
    drafts: Object.entries(state.preferences).filter(([key]) => key.startsWith("sf:proposal-coverage:hot-topic:active:"))
      .map(([, value]) => value as HotTopicDraft),
  })),
  receipts: await authority.state.read(request(), "receipts", (state) => Object.values(state.receipts)),
  decision: await authority.state.read(request(), "cases", (state) => state.cases[initialCaseRef.id]),
  record: await store.transaction("dashboard", async (snapshot) => ({ commit: false,
    value: structuredClone(rows(snapshot.data.hotTopics)[0]!) })),
  traffic,
})
const server = Bun.serve({ hostname: "localhost", port: 4110, fetch: async (incoming) => {
  const url = new URL(incoming.url)
  if (url.pathname === "/__proposal_control") {
    if (url.origin !== "http://localhost:4110" || incoming.method !== "POST" ||
      incoming.headers.get("x-proposal-control") !== configuration.controlKey || incoming.headers.has("origin"))
      return new Response("Denied", { status: 403 })
    const control = object(await incoming.json())
    if (Object.keys(control).length !== 1 || !["observe", "withdraw-write", "withdraw-read", "seed-choice"].includes(String(control.operation)))
      return new Response("Invalid control", { status: 400 })
    if (control.operation === "seed-choice") {
      const before = await observe()
      if (before.preferences.status !== "ok" || before.preferences.value.drafts.length !== 1)
        throw new Error("PROPOSAL_SINGLE_CURRENT_DRAFT_REQUIRED")
      await storeExistingChoice(before.preferences.value.drafts[0]!)
    }
    if (control.operation === "withdraw-write") policy.writable = false
    if (control.operation === "withdraw-read") policy.readable = false
    return Response.json(await observe(), { headers: { "Cache-Control": "no-store" } })
  }
  if (url.origin !== origin) return new Response("Denied", { status: 403 })
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return embedded.handler(incoming)
  await identity.prepare(incoming)
  const authentication = await identity.handle(incoming)
  if (authentication) return authentication
  const response = await installation.application(incoming) ?? new Response("Not found", { status: 404 })
  const mode = url.searchParams.get("sf")
  if (incoming.method === "POST" && ["dashboard-workbench", "dashboard-draft-read", "dashboard-hot-topic-draft", "dashboard-hot-topic-prepare", "dashboard-hot-topic-review", "dashboard-hot-topic-apply"].includes(mode ?? ""))
    traffic.push({ mode, status: response.status, result: object(await response.clone().json()) })
  return response
} })
const ready: ProposalReady = { actorId, cookie }
await writeFile(path.join(directory, "proposal-ready.json"), JSON.stringify(ready), { mode: 0o600 })
let closing = false
async function close() {
  if (closing) return
  closing = true
  await server.stop(true)
  await embedded.dispose()
  await driver.dispose()
  await rm(path.join(directory, "proposal-ready.json"), { force: true })
  process.exit(0)
}
process.once("SIGTERM", () => { void close() })
process.once("SIGINT", () => { void close() })
