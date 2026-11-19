import { randomBytes, randomUUID } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { Layer, Schema } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { openLocalStore } from "../../../../../modules/sucafina/Sucafinav1/runtime/local-store"
import { createOperatorIdentity } from "../../../../../modules/sucafina/Sucafinav1/runtime/operator-identity"
import { object, rows } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract"
import { initialProcurementSettings } from "../../../../../modules/sucafina/Sucafinav1/src/initial-settings"
import { createSfSourcePersistence } from "../../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle"
import { enumerateSfSources } from "../../../../../modules/sucafina/Sucafinav1/product/integration/source-inventory"
import { createSfSourceScopeProjector } from "../../../../../modules/sucafina/Sucafinav1/product/integration/source-projections"
import { initializeAbsentSfProductState } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider"
import type { DecisionCase } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/decisions"
import { encodeCaseRef } from "../../../../../modules/sucafina/Sucafinav1/product/decisions/case-port"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical"
import { decodeSfOperationOutput } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission"
import { createProcurementSourceResolver } from "../../../../../modules/sucafina/Sucafinav1/product/procurement/sources"
import { prepareC12Change } from "../../../../../modules/sucafina/Sucafinav1/test/product/c12-receipt-recovery/fixture"
import { SfSourceEvidenceInput } from "../../../../schema/src/sucafina/decisions/source-contracts"
import type { C12Configuration, C12Prepared, C12Ready, C12Traffic } from "./c12-protocol"

const filename = process.argv[2]
if (!filename || !path.isAbsolute(filename)) throw new Error("C12_PRIVATE_CONFIGURATION_REQUIRED")
const configuration: C12Configuration = JSON.parse(await readFile(filename, "utf8"))
const { directory, origin, installationId } = configuration
if (!path.isAbsolute(directory) || origin !== "http://127.0.0.1:3000" || !/^[a-f0-9]{64}$/.test(configuration.controlKey))
  throw new Error("C12_PRIVATE_CONFIGURATION_INVALID")
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
const mount = "/sucafina", at = "2026-11-13T00:00:00Z"
const actorId = "macos:" + installationId + ":1001"
const metadataFile = path.join(directory, "c12-state.json")
const retained: { caseId: string; prepared: C12Prepared } | undefined = await readFile(metadataFile, "utf8")
  .then((source) => JSON.parse(source)).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined
    throw error
  })
const driver = await openLocalStore(directory)
const sources = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources,
  projectScope: createSfSourceScopeProjector(() => at), createId: randomUUID })
let afterReceipt: (() => Promise<void>) | undefined
const receiptCommits: { beforeCases: number; afterCases: number }[] = []
// Scheduling only: the real source lifecycle commits the same SQLite transaction
// before the fixture interrupts its return path.
const store: typeof driver & typeof sources = { ...driver, ...sources, transactionAll: async (work, options) => {
  if (!sources.transactionAll) throw new Error("C12_SQLITE_TRANSACTION_ALL_REQUIRED")
  let committed: { beforeCases: number; afterCases: number } | undefined
  const result = await sources.transactionAll(async (snapshots) => {
    const before = object(snapshots.dashboard.data.__sfProductV1)
    const count = Object.keys(object(before.receipts)).length
    const beforeCases = Number(object(before.versions).cases)
    const outcome = await work(snapshots)
    const after = object(snapshots.dashboard.data.__sfProductV1)
    if (outcome.commit && Object.keys(object(after.receipts)).length > count)
      committed = { beforeCases, afterCases: Number(object(after.versions).cases) }
    return outcome
  }, options)
  if (committed) {
    receiptCommits.push(committed)
    const interleave = afterReceipt
    afterReceipt = undefined
    await interleave?.()
  }
  return result
} }
for (const surface of ["dashboard", "planner", "procurement"] as const) await store.initializeSources(surface)
await initializeAbsentSfProductState(store, randomUUID)
if (!retained) await store.transaction("procurement", async (snapshot) => {
  snapshot.data.store = { requests: { "PR-1": { request: { number: "PR-1", createdBy: actorId, status: "draft",
    pr: { title: "Requisition fixture", justification: "Recorded need", estAmount: 100 }, history: [], attachments: [] },
    version: 0, by: actorId } }, suppliers: [], settings: initialProcurementSettings(), issued: { pr: ["PR-1"], po: [] } }
  snapshot.versions["requests:PR-1"] = { version: 0, by: actorId }
  return { commit: true, value: undefined }
})
const identity = createOperatorIdentity({ origin, mount,
  operator: { installationId, uid: 1001, name: "C12 recovery operator", buyer: true }, secrets: store.secrets, key: randomBytes(32) })
const environment = async () => ({ at, id: randomUUID, directory: [{ id: actorId, name: "C12 recovery operator" }] })
const installation = await createOperationsInstallation({
  installationId, directory, origin, mount, operators: [{ principalRef: actorId, readOnly: false }],
  persistence: store, authenticate: identity.authenticate, isAuthenticated: async (request) => !!await identity.person(request),
  environment, signingKey: randomBytes(32), scanner: null,
  grants: [{ principalRef: actorId, namespaces: ["cases", "preferences", "confirmations", "receipts", "threads", "relations"],
    operations: ["sf_work_list", "sf_request_read", "sf_case_draft", "sf_case_read", "sf_context_read", "sf_sourcing_compare"],
    humanActions: ["collaboration.confirmation.confirm", "decisions.prepare-changes", "decisions.portfolio.read", "decisions.apply"] }],
})
const embedded = HttpRouter.toWebHandler(createEmbeddedRoutes({
  host: installation.host, sucafinaInstallations: installation.discovery,
}).pipe(HttpRouter.provideRequest(AppNodeBuilder.build(LayerNode.group([
  PermissionSaved.node, ClaudeCodeAccount.node,
]))), Layer.provide(HttpServer.layerServices)), { disableLogger: true })
const health = await embedded.handler(new Request(origin + "/api/health"))
const authority = installation.services?.()
if (health.status !== 200 || !installation.identity() || !authority) throw new Error("C12_REAL_HOST_NOT_READY")
const code = await identity.enroll()
const enrollmentRequest = new Request(origin + mount + "/auth/local?code=" + code)
await identity.prepare(enrollmentRequest)
const enrollment = await identity.handle(enrollmentRequest)
if (enrollment?.status !== 303) throw new Error("C12_REAL_ENROLLMENT_FAILED")
const cookie = enrollment.headers.get("set-cookie")
if (!cookie) throw new Error("C12_REAL_SESSION_MISSING")
const sessionHeader = cookie.split(";")[0]!
const request = (actor = actorId, mode?: string, payload?: unknown, key: string = randomUUID(), headers: Record<string, string> = {}) => {
  if (actor !== actorId) throw new Error("C12_OTHER_ACTOR_NOT_ENROLLED")
  return new Request(origin + mount + "/procurement" + (mode ? "?sf=" + mode : ""), {
    method: payload === undefined ? "GET" : "POST",
    headers: { cookie: sessionHeader, origin, "content-type": "application/json", "idempotency-key": key, ...headers },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  })
}
// The original C12 fixture retains this authorized period for subsequent case
// evidence reads. C02's request-scoped page period alone cannot admit withCase.
const selectionPayload = { purpose: "work-selection", period: { start: "2026-01-01", end: "2026-12-31" } }
const selectionDigest = digestSfValue(selectionPayload)
const selectionCall = await authority.ui.admit(request(), "sf_work_list", selectionDigest)
if (selectionCall.status !== "ok") throw new Error("C12_ORIGINAL_SELECTION_ADMISSION_FAILED")
let selectionRef = ""
try {
  if (!await authority.ui.validate(selectionCall.value, "sf_work_list", selectionDigest))
    throw new Error("C12_ORIGINAL_SELECTION_AUTHORITY_CHANGED")
  const selection = await authority.procurementSelections?.create(selectionCall.value, selectionPayload.period)
  if (!selection || selection.status !== "ok" || !selection.value.selectionRef ||
      digestSfValue(selection.value.period) !== digestSfValue(selectionPayload.period))
    throw new Error("C12_ORIGINAL_SELECTION_UNAVAILABLE")
  selectionRef = selection.value.selectionRef
} finally {
  authority.ui.finish(selectionCall.value)
}
const http = async (mode: string, payload: unknown, actor = actorId, key: string = randomUUID()) => {
  const response = await installation.application(request(actor, mode, payload, key))
  if (!response) throw new Error("C12_ORIGINAL_HTTP_NOT_MOUNTED")
  return { response, body: object(await response.json()) }
}
const material = () => store.transaction("procurement", async (snapshot) => ({ commit: false, value: {
  request: structuredClone(object(object(object(object(snapshot.data.store).requests)["PR-1"]).request)),
  version: structuredClone(snapshot.versions["requests:PR-1"]),
} }))
let caseId = retained?.caseId
const storedCase = async () => {
  const result = await authority.state.read(request(), "cases", (state) => caseId ? state.cases[caseId] : undefined)
  if (result.status !== "ok" || !result.value) throw new Error("C12_REAL_CASE_UNAVAILABLE")
  return { storageVersion: result.storageVersion, value: result.value }
}
let prepared = retained?.prepared
if (!retained) {
  const queueResponse = await installation.application(new Request(origin + mount + "/procurement?page=Requests&projection=c02", {
    headers: { cookie: sessionHeader, origin },
  }))
  if (queueResponse?.status !== 200) throw new Error("C12_REAL_C02_UNAVAILABLE")
  const queue = object(await queueResponse.json())
  const matches = rows(object(queue.value).rows).filter((row) => row.id === "PR-1")
  if (queue.status !== "ok" || matches.length !== 1) throw new Error("C12_REAL_C02_SOURCE_AMBIGUOUS")
  const rowEvidence = Schema.decodeUnknownSync(Schema.toType(SfSourceEvidenceInput))(matches[0]!.evidence)
  if (rowEvidence.kind !== "record" || rowEvidence.target.surface !== "procurement" ||
      rowEvidence.target.recordType !== "procurement-request" || rowEvidence.target.recordId !== "PR-1")
    throw new Error("C12_RECORD_EVIDENCE_REQUIRED")
  // C02 identifies the row through its collection scope. C12 requires the
  // producer's individual, persisted selector, as the canonical fixture does.
  const workInput = { selectionRef, period: selectionPayload.period }
  const workCall = await authority.ui.admit(request(), "sf_work_list", digestSfValue(workInput))
  if (workCall.status !== "ok") throw new Error("C12_ORIGINAL_WORK_ADMISSION_FAILED")
  const sourceInput = await (async () => {
    try {
      // queue-page.finish releases C02's child selectors. Reopen the retained
      // original work selection instead of reusing a disposed page reference.
      const result = await authority.dispatch("sf_work_list", workInput, workCall.value)
      if (result.status !== "ok") throw new Error("C12_ORIGINAL_WORK_READ_FAILED status=" + result.status + " reason=" + result.reason)
      const listed = decodeSfOperationOutput("sf_work_list", result.result)
      if (!listed.ok) throw new Error("C12_ORIGINAL_WORK_PROJECTION_INVALID")
      const candidates = listed.value.items.flatMap((item) => item.sourceRefs.flatMap((ref) =>
        ref.kind === "record" && ref.target.surface === "procurement" &&
        ref.target.recordType === "procurement-request" && ref.target.recordId === rowEvidence.target.recordId ? [ref] : []))
      const refs = [...new Map(candidates.map((ref) => [ref.refDigest, ref])).values()]
      if (refs.length !== 1 || !await authority.ui.revalidate(workCall.value))
        throw new Error("C12_ORIGINAL_WORK_SOURCE_AMBIGUOUS")
      return { requestRef: refs[0]!.refId }
    } finally {
      authority.ui.finish(workCall.value)
    }
  })()
  const sourceCall = await authority.ui.admit(request(), "sf_request_read", digestSfValue(sourceInput))
  if (sourceCall.status !== "ok") throw new Error("C12_ORIGINAL_SOURCE_ADMISSION_FAILED")
  const evidence = await (async () => {
    try {
      if (!await authority.ui.revalidate(sourceCall.value)) throw new Error("C12_ORIGINAL_SOURCE_AUTHORITY_CHANGED")
      const read = await authority.dispatch("sf_request_read", sourceInput, sourceCall.value)
      if (read.status !== "ok") throw new Error("C12_ORIGINAL_SOURCE_READ_FAILED status=" + read.status + " reason=" + read.reason)
      const projection = decodeSfOperationOutput("sf_request_read", read.result)
      if (!projection.ok) throw new Error("C12_ORIGINAL_SOURCE_PROJECTION_INVALID")
      const individual = createProcurementSourceResolver({
        host: authority.host, scopedSources: store,
        contextFor: async (call) => call === sourceCall.value && await authority.host.revalidate(call)
          ? { status: "ok", value: projection.value.context }
          : { status: "denied", reason: "fixture-source-authority-changed" },
      })
      const issued = await individual.issue("procurement-request", rowEvidence.target.recordId, sourceCall.value)
      if (issued.status !== "ok") throw new Error("C12_ORIGINAL_INDIVIDUAL_SOURCE_FAILED status=" + issued.status)
      const resolved = await individual.resolve(issued.value, sourceCall.value)
      if (resolved.status !== "ok" || resolved.value.evidence.target.recordId !== rowEvidence.target.recordId ||
          digestSfValue(resolved.value.evidence.target.period) !== digestSfValue(selectionPayload.period) ||
          !await authority.ui.revalidate(sourceCall.value))
        throw new Error("C12_ORIGINAL_INDIVIDUAL_SOURCE_CHANGED")
      return resolved.value.evidence
    } finally {
      authority.ui.finish(sourceCall.value)
    }
  })()
  // C12 qualifies Apply/Recover, not authoring. Persist the synthetic case
  // through the same authenticated C08 creation target and SQLite authority.
  const decision: DecisionCase = {
    id: randomUUID(), incarnation: randomUUID(), version: 1, state: "draft",
    objective: "Review a controlled requisition amount",
    horizon: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD",
    participants: [actorId],
    criteria: [{ id: randomUUID(), description: "Budget impact", required: true }],
    sourceRefs: [evidence], alternatives: [], costCoverageBases: [], assumptions: [],
    questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [],
  }
  const existing = await authority.state.read(request(), "cases", (state) => Object.keys(state.cases).length)
  if (existing.status !== "ok" || existing.value !== 0) throw new Error("C12_FRESH_CASE_NAMESPACE_REQUIRED")
  const seeded = await authority.state.transaction(request(actorId, undefined, decision), {
    namespace: "cases", expectedStorageVersion: existing.storageVersion,
    targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation,
    idempotencyKey: randomUUID(), commandDigest: digestSfValue(decision),
  }, async (state) => {
    state.cases[decision.id] = decision
    return { commit: true, value: decision.id }
  })
  if (seeded.status !== "ok" || seeded.value !== decision.id) throw new Error("C12_REAL_CASE_SEED_FAILED")
  caseId = seeded.value
  const persisted = await storedCase()
  if (persisted.value.incarnation !== decision.incarnation || persisted.value.version !== decision.version ||
      persisted.value.objective !== decision.objective) throw new Error("C12_REAL_CASE_SEED_READBACK_FAILED")
  prepared = await prepareC12Change({ authority, evidence, request, http, storedCase, material },
    { principalRef: actorId, participants: [actorId] })
  await writeFile(metadataFile, JSON.stringify({ caseId, prepared }), { mode: 0o600 })
}
if (!caseId || !prepared) throw new Error("C12_PREPARED_CHANGE_MISSING")
const traffic: C12Traffic[] = []
const observe = async () => {
  const receipts = await authority.state.read(request(), "receipts", (state) => Object.values(state.receipts))
  if (receipts.status !== "ok") throw new Error("C12_REAL_RECEIPTS_UNAVAILABLE")
  return { domain: await material(), decision: (await storedCase()).value, receipts: receipts.value }
}
const interrupt = () => {
  afterReceipt = async () => {
    const current = await storedCase()
    const changed = { ...current.value, version: current.value.version + 1, objective: "Concurrent authorized case edit" }
    const saved = await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: current.storageVersion,
      targetRef: changed.id, targetIncarnation: changed.incarnation, idempotencyKey: randomUUID(), commandDigest: digestSfValue(changed) },
    async (state) => { state.cases[changed.id] = changed; return { commit: true, value: true } })
    if (saved.status !== "ok") throw new Error("C12_CONCURRENT_CASE_EDIT_FAILED")
    throw new Error("C12 fixture interrupted the response after the durable domain commit")
  }
}
const server = Bun.serve({ hostname: "localhost", port: 4110, fetch: async (incoming) => {
  const url = new URL(incoming.url)
  if (url.pathname === "/__c12_control") {
    if (url.origin !== "http://localhost:4110" || incoming.method !== "POST" ||
      incoming.headers.get("x-c12-control") !== configuration.controlKey || incoming.headers.has("origin"))
      return new Response("Denied", { status: 403 })
    const control = object(await incoming.json())
    if (Object.keys(control).length !== 1 || !["observe", "interrupt"].includes(String(control.operation)))
      return new Response("Invalid control", { status: 400 })
    if (control.operation === "interrupt") interrupt()
    return Response.json({ observation: await observe(), traffic, receiptCommits }, { headers: { "Cache-Control": "no-store" } })
  }
  if (url.origin !== origin) return new Response("Denied", { status: 403 })
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return embedded.handler(incoming)
  await identity.prepare(incoming)
  const authentication = await identity.handle(incoming)
  if (authentication) return authentication
  const body = incoming.method === "POST" ? await incoming.clone().text() : ""
  const response = await installation.application(incoming) ?? new Response("Not found", { status: 404 })
  if (incoming.method === "POST" && ["decision-review", "decision-apply", "decision-recover"].includes(url.searchParams.get("sf") ?? ""))
    traffic.push({ mode: url.searchParams.get("sf"), body, key: incoming.headers.get("idempotency-key"),
      status: response.status, result: object(await response.clone().json()) })
  return response
} })
const ready: C12Ready = { actorId, caseRef: encodeCaseRef((await storedCase()).value), cookie, prepared }
await writeFile(path.join(directory, "c12-ready.json"), JSON.stringify(ready), { mode: 0o600 })
let closing = false
async function close() {
  if (closing) return
  closing = true
  await server.stop(true)
  await embedded.dispose()
  await driver.dispose()
  await rm(path.join(directory, "c12-ready.json"), { force: true })
  process.exit(0)
}
process.once("SIGTERM", () => { void close() })
process.once("SIGINT", () => { void close() })
