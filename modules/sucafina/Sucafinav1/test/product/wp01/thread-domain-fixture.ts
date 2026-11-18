import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AbsolutePath } from "@orchestra/core/schema"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { object } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { AuthorizedCaseProjection } from "../../../product/contracts/business-context.ts"
import type { ConfirmationScope } from "../../../product/contracts/context.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardRecordEvidenceHost } from "../../../product/dashboard/sources.ts"
import { createDashboardConfirmationObserver } from "../../../product/dashboard/confirmation.ts"
import type { DashboardConfirmationObservation } from "../../../product/dashboard/confirmation.ts"
import { createSfBusinessContext } from "../../../product/host-binding/business-context.ts"
import { createSfDashboardRecordSourceAccess } from "../../../product/decision-memory/source-access.ts"
import { createCollaborationAuthority } from "../../../product/collaboration/authority.ts"
import { createCollaborationMutationFence } from "../../../product/collaboration/mutation-fence.ts"
import { createThreadPort, isThread } from "../../../product/collaboration/threads.ts"
import { createThreadAnswerEvidence } from "../../../product/collaboration/evidence.ts"
import { createAnswerReusePort } from "../../../product/collaboration/answer-reuse.ts"
import { caseQuestionScript, caseQuestionThreads } from "../../../product/ui/work-collaboration.ts"

/** A component composition, not WP10's application host. Thin HTTP envelopes
 * follow collaboration ea5a6f9 http-routes.ts. The threads, answer issuer,
 * published answer-reuse port, C06 observer, C08 and encrypted login are real.
 * This fixture does not mount decision attachment, native execution or Atlas. */
export async function createThreadDomainFixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-thread-consumer-"))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(directory)
  const routing: { handle?: (request: Request) => Promise<Response> } = {}
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, idleTimeout: 30, fetch: (request) => routing.handle?.(request) ?? new Response(null, { status: 503 }) })
  const origin = server.url.origin, installationId = randomUUID(), principalRef = `macos:${installationId}:1000`
  const at = "2026-11-14T08:00:00Z", period = { start: "2026-01-01", end: "2026-12-31" }
  const policy = { readable: true }
  const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID, projectScope: createSfSourceScopeProjector(() => at) })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.access = { [principalRef]: { assigned: ["projects"], domains: ["IT"] } }
    snapshot.data.projects = [{ id: "project", name: "Operational project", domain: "IT", status: "Planning", pm: "Owner", risk: "Low" }]
    return { commit: true, value: undefined }
  })
  const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator: { installationId, uid: 1000, name: "Conversation operator" }, secrets: driver.secrets, key: randomBytes(32) })
  const authenticate: typeof identity.authenticate = async (request, context) => policy.readable ? identity.authenticate(request, context) : null
  const authority = createSfProductAuthority({ identity: () => ({ installationId, hostId: "host", projectId: "project", location: { directory: AbsolutePath.make(directory) } }),
    installationId, origin, policyVersion: "policy", persistence, authenticate,
    environment: async (request) => ({ at, id: randomUUID, directory: await identity.directory(request) }), now: Date.now, createId: randomUUID,
    commandIdentity: async (request, operation) => request.method === "GET" ? randomUUID() : request.headers.get("idempotency-key") ? digestSfValue({ operation, key: request.headers.get("idempotency-key") }) : undefined,
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined,
    grants: [{ principalRef, namespaces: ["threads"], operations: ["sf_dashboard_read"], humanActions: ["collaboration.thread.create", "collaboration.thread.reply", "collaboration.thread.read", "collaboration.storage.version", "collaboration.answer.prepare", "collaboration.answer.confirm", "collaboration.answer.read"] }] })
  const records = createDashboardRecordEvidenceHost({ host: authority.host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host: authority.host, scopedSources: persistence }) })
  const evidence = createSfBusinessContext({ revalidate: authority.host.revalidate, resolveSource: createSfDashboardRecordSourceAccess({ host: authority.host, records }),
    proveContinuity: async () => false,
    recall: async () => { throw new Error("This C03 record consumer does not request memory recall") },
    emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "", scanner: { name: "", version: "", status: "unavailable" }, reason: "thread-component-only" }) })
  const sourceAuthority = createCollaborationAuthority({ host: authority.host, evidence })
  const threads = createThreadPort({ state: authority.state, host: authority.host, creationTarget: authority.creationTarget, human: authority.human,
    mutationFence: createCollaborationMutationFence(authority.host), authorize: sourceAuthority.authorizeThread, createId: randomUUID, now: () => at })
  const answerEvidence = createThreadAnswerEvidence(threads)
  const observer = createDashboardConfirmationObserver({ host: authority.host, scopedSources: persistence, readProjection: (selection, context) => records.read(selection.reference, context) })
  // The fixture composes the current-source subset of the published host's
  // answer callbacks. Membership is proved by issuing the selected message again
  // in the requested thread; no selector or successful authority is fabricated.
  const belongsToQuestion = async (questionId: string, answerRef: string, context: TrustedDomainContext) => {
    const selected = await answerEvidence.resolve(answerRef, context)
    if (selected.status !== "ok") return false
    const issued = await answerEvidence.issue(questionId, selected.value.target.recordId, context)
    return issued.status === "ok" && digestSfValue(issued.value) === digestSfValue(selected.value) && await authority.host.revalidate(context)
  }
  const answers = createAnswerReusePort<Extract<DashboardConfirmationObservation, { state: "available" }>>({ host: authority.host, state: authority.state, target: authority.creationTarget,
    answer: async (questionId, context) => {
      const source = authority.host.requestFor(context)
      if (!source || !await authority.host.revalidate(context)) return { status: "denied", reason: "answer-unavailable" }
      const visible = await threads.read(questionId, context)
      if (visible.status !== "ok") return visible
      const message = visible.value.messages.findLast((item, index) => index > 0 && item.authorRef === visible.value.recipientRef)
      if (!message || visible.value.kind === "comment") return { status: "unavailable", reason: "answer-unavailable" }
      const issued = await answerEvidence.issue(questionId, message.id, context)
      if (issued.status !== "ok") return issued
      const raw = await authority.state.read(source, "threads", (state, current) => current.principalRef === context.binding.principalRef && current.accessRevision === context.binding.accessRevision && current.policyVersion === context.binding.policyVersion ? state.threads[questionId] : undefined)
      if (raw.status !== "ok" || !isThread(raw.value) || raw.value.id !== questionId || digestSfValue(raw.value.messages) !== digestSfValue(visible.value.messages) || !await authority.host.revalidate(context)) return { status: "unavailable", reason: "answer-unavailable" }
      return { status: "ok", value: { id: message.id, ref: issued.value.refId, authorRef: message.authorRef, questionId, body: message.body, digest: digestSfValue({ questionId, ...message }), threadDigest: digestSfValue(raw.value) } }
    }, belongsToQuestion,
    scopeForAnswer: async (questionId, answerRef, context) => {
      if (!await belongsToQuestion(questionId, answerRef, context)) return { status: "unavailable", reason: "answer-scope-unavailable" }
      const thread = await threads.read(questionId, context), answer = await answerEvidence.resolve(answerRef, context)
      if (thread.status !== "ok" || answer.status !== "ok") return { status: "unavailable", reason: "answer-scope-unavailable" }
      const message = thread.value.messages.find((item) => item.id === answer.value.target.recordId && item.incarnation === answer.value.target.incarnation && item.version === answer.value.target.version && item.authorRef === thread.value.recipientRef)
      const source = thread.value.evidenceRefs[0]
      if (!message || thread.value.evidenceRefs.length !== 1 || source?.kind !== "record" || source.target.surface !== "dashboard" || source.refId !== thread.value.sourceRef || !source.target.period || digestSfValue(source.target.period) !== digestSfValue(thread.value.period)) return { status: "unavailable", reason: "answer-scope-unavailable" }
      const scope: ConfirmationScope = { sourceRef: { surface: source.target.surface, type: source.target.recordType, id: source.target.recordId, incarnation: source.target.incarnation }, fields: source.target.fields, period: source.target.period, materialDependencies: [], scopeDefinitionVersion: "dashboard-c06-v1" }
      return await observer.verifyManifest(scope, context) ? { status: "ok", value: { scope } } : { status: "unavailable", reason: "answer-scope-unavailable" }
    }, observe: observer.observe,
    fence: async (scope, observation, context) => await observer.fenceManifest(scope, context) && await observer.fence(scope, observation, context),
    authorizeConfirmation: (context, questionId, answerRef, mutation) => authority.human.authorize(context, "collaboration.answer.confirm", { questionId, answerRef, mutation }),
  })
  const login = await identity.handle(new Request(`${origin}/sucafina/auth/local?code=${await identity.enroll()}`))
  const cookie = login?.headers.get("set-cookie")?.split(";")[0]
  if (!cookie) throw new Error("Conversation operator enrollment failed")
  const request = (payload: unknown = {}, key = randomUUID()) => new Request(`${origin}/sucafina/conversation`, { method: "POST", headers: { cookie, origin, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(payload) })
  const read = async <T>(source: Request, operation: string, payload: unknown, work: (context: TrustedDomainContext) => Promise<PortResult<T>>): Promise<PortResult<T>> => {
    const action = operation === "sf_dashboard_read" ? operation : `sf-human:${operation}`
    const digest = digestSfValue(payload), admitted = await authority.ui.admit(source, action, digest)
    if (admitted.status !== "ok") return admitted
    try {
      if (!await authority.ui.validate(admitted.value, action, digest)) return { status: "denied", reason: "read-admission-unavailable" }
      return await work(admitted.value)
    }
    finally { authority.ui.finish(admitted.value) }
  }
  const selected = { page: "Portfolio Dashboard", recordType: "projects", recordId: "project", fields: ["name"], period }
  const issued = await read(request(selected), "sf_dashboard_read", selected, (context) => records.issue(selected, context))
  if (issued.status !== "ok") throw new Error("Real thread source unavailable")
  const draft = { kind: "clarification" as const, sourceRef: issued.value.refId, sourceIncarnation: issued.value.target.incarnation, observedVersion: issued.value.target.version,
    period, recipientRef: principalRef, evidenceRefs: [issued.value], body: "Review this operational source" }
  const mutation = { expectedStorageVersion: 0, idempotencyKey: randomUUID() }
  const created = await authority.human.admit(request({ draft, mutation }, mutation.idempotencyKey), "collaboration.thread.create", { draft, mutation })
  if (created.status !== "ok") throw new Error("Real thread creation admission unavailable")
  const initial = await threads.create(draft, mutation, created.value).finally(() => authority.human.finish(created.value))
  if (initial.status !== "ok") throw new Error("Real thread creation unavailable: " + initial.reason)
  const projection: AuthorizedCaseProjection = {
    context: { kind: "ui", installationId, projectId: "project", principalRef, policyVersion: "policy", accessRevision: "fixture-render-only" },
    case: { id: "presentation-case", incarnation: "presentation-incarnation", version: 1, state: "investigating", objective: "Conversation component", horizon: period, currency: "USD", criteria: [], participants: [principalRef], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [],
      questions: [{ id: initial.value.id, text: initial.value.messages[0]!.body, state: "open" }], choices: [], preparedChanges: [], receipts: [], ledger: [] },
    events: [], evidenceRefs: [], checkedAt: at,
  }
  const attempts: { body: string; key: string | null; status: number; value: unknown }[] = []
  const answerAttempts: { route: string; body: string; key: string | null; status: number; value: unknown }[] = []
  const suspended: { nextReply: boolean; malformedNextReply: boolean; nextConfirmation: boolean; beforeNextReply?: () => Promise<void>; finish?: () => void } = { nextReply: false, malformedNextReply: false, nextConfirmation: false }
  const concurrentReply = async (body: string) => {
    const version = await authority.state.read(request(), "threads", () => true)
    if (version.status !== "ok") throw new Error("Concurrent C08 version unavailable")
    const mutation = { expectedStorageVersion: version.storageVersion, idempotencyKey: randomUUID() }
    const payload = { id: initial.value.id, body, mutation }
    const admitted = await authority.human.admit(request(payload, mutation.idempotencyKey), "collaboration.thread.reply", payload)
    if (admitted.status !== "ok") throw new Error("Concurrent C03 admission unavailable")
    const saved = await threads.reply(payload.id, body, mutation, admitted.value).finally(() => authority.human.finish(admitted.value))
    if (saved.status !== "ok") throw new Error("Concurrent C03 reply unavailable: " + saved.reason)
    return saved.value
  }
  const reply = (result: PortResult<unknown>) => Response.json(result, { status: result.status === "ok" ? 200 : result.status === "denied" ? 403 : result.status === "needs-input" ? 400 : result.status === "stale" || result.status === "conflict" ? 409 : 503 })
  routing.handle = async (incoming) => {
    const auth = await identity.handle(incoming)
    if (auth) return auth
    const url = new URL(incoming.url)
    // The real enrollment producer redirects to this fixed mount destination.
    // Continue to the component's authorized GET instead of returning a blank 404.
    if (incoming.method === "GET" && url.pathname === "/sucafina/dashboard") return Response.redirect(`${origin}/sucafina/conversation`, 303)
    if (url.pathname !== "/sucafina/conversation") return new Response(null, { status: 404 })
    if (incoming.method === "GET") {
      const visible = await read(incoming, "collaboration.thread.read", { id: initial.value.id }, (context) => threads.read(initial.value.id, context))
      if (visible.status !== "ok") return new Response(null, { status: 403 })
      return new Response(`<!doctype html><html><head><meta charset="utf-8"></head><body>${caseQuestionThreads(projection)}<script>${caseQuestionScript}</script></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } })
    }
    if (incoming.method !== "POST" || incoming.headers.get("origin") !== origin || incoming.headers.get("sec-fetch-site") === "cross-site" || !incoming.headers.get("content-type")?.startsWith("application/json")) return reply({ status: "denied", reason: "component-http-origin-denied" })
    const raw = await incoming.text(), payload = object(JSON.parse(raw)), action = url.searchParams.get("sf")
    if (action === "collaboration-thread-read" && Object.keys(payload).join(",") === "id" && typeof payload.id === "string") {
      const id = payload.id
      return reply(await read(incoming, "collaboration.thread.read", payload, (context) => threads.read(id, context)))
    }
    if (action === "collaboration-storage-version" && Object.keys(payload).join(",") === "namespace" && payload.namespace === "threads") return reply(await read(incoming, "collaboration.storage.version", payload, async (context) => {
      const version = await authority.state.read(incoming, "threads", (_state, current) => current.principalRef === context.binding.principalRef && current.accessRevision === context.binding.accessRevision && current.policyVersion === context.binding.policyVersion)
      return version.status === "ok" && version.value && await authority.host.revalidate(context) ? { status: "ok", value: version.storageVersion } : { status: "denied", reason: "thread-version-unavailable" }
    }))
    if (action === "collaboration-answer-prepare-message") {
      if (Object.keys(payload).sort().join(",") !== "incarnation,messageId,questionId,version" || typeof payload.questionId !== "string" || !payload.questionId.trim() || typeof payload.messageId !== "string" || !payload.messageId.trim() || typeof payload.incarnation !== "string" || !payload.incarnation.trim() || !Number.isSafeInteger(payload.version) || Number(payload.version) < 1) return reply({ status: "needs-input", reason: "invalid-collaboration-payload" })
      const questionId = payload.questionId, messageId = payload.messageId
      const result = await read(incoming, "collaboration.answer.prepare", payload, async (context): Promise<PortResult<unknown>> => {
        const issued = await answerEvidence.issue(questionId, messageId, context)
        if (issued.status !== "ok") return issued
        if (issued.value.target.recordId !== messageId || issued.value.target.incarnation !== payload.incarnation || issued.value.target.version !== payload.version) return { status: "stale", reason: "answer-selection-changed" }
        const prepared = await answers.prepare(questionId, issued.value.refId, context)
        if (prepared.status !== "ok") return prepared
        const { observation, ...display } = prepared.value
        return { status: "ok", value: { ...display, evidence: observation.evidence, projection: observation.projection } }
      })
      const response = reply(result)
      answerAttempts.push({ route: action, body: raw, key: incoming.headers.get("idempotency-key"), status: response.status, value: result })
      return response
    }
    if (action === "collaboration-answer-confirm") {
      if (Object.keys(payload).sort().join(",") !== "answerRef,mutation,questionId" || typeof payload.questionId !== "string" || typeof payload.answerRef !== "string") return reply({ status: "needs-input", reason: "invalid-collaboration-payload" })
      const mutation = object(payload.mutation)
      if (Object.keys(mutation).sort().join(",") !== "expectedScopeFingerprint,expectedStorageVersion,idempotencyKey,observationRef,observedSourceVersion" || typeof mutation.expectedStorageVersion !== "number" || typeof mutation.idempotencyKey !== "string" || typeof mutation.observationRef !== "string" || typeof mutation.observedSourceVersion !== "number" || typeof mutation.expectedScopeFingerprint !== "string") return reply({ status: "needs-input", reason: "invalid-answer-confirmation" })
      const admitted = await authority.human.admit(incoming, "collaboration.answer.confirm", payload)
      const result = admitted.status !== "ok" ? admitted : await answers.confirm(payload.questionId, payload.answerRef, { expectedStorageVersion: mutation.expectedStorageVersion, idempotencyKey: mutation.idempotencyKey, observationRef: mutation.observationRef, observedSourceVersion: mutation.observedSourceVersion, expectedScopeFingerprint: mutation.expectedScopeFingerprint }, admitted.value).finally(() => authority.human.finish(admitted.value))
      const response = reply(result)
      answerAttempts.push({ route: action, body: raw, key: incoming.headers.get("idempotency-key"), status: response.status, value: result })
      if (suspended.nextConfirmation && result.status === "ok") { suspended.nextConfirmation = false; return new Response("Confirmation delivery interrupted after the real C06/C08 commit.") }
      return response
    }
    if (action === "collaboration-answer-read" && Object.keys(payload).join(",") === "questionId" && typeof payload.questionId === "string") {
      const questionId = payload.questionId
      const result = await read(incoming, "collaboration.answer.read", payload, (context) => answers.read(questionId, context))
      const response = reply(result)
      answerAttempts.push({ route: action, body: raw, key: incoming.headers.get("idempotency-key"), status: response.status, value: result })
      return response
    }
    if (action === "decision-answer-question") {
      const result: PortResult<never> = { status: "unavailable", reason: "decision-attachment-not-mounted-in-c03-component" }
      const response = reply(result)
      answerAttempts.push({ route: action, body: raw, key: incoming.headers.get("idempotency-key"), status: response.status, value: result })
      return response
    }
    if (action !== "collaboration-thread-reply" || Object.keys(payload).sort().join(",") !== "body,id,mutation" || typeof payload.id !== "string" || typeof payload.body !== "string") return reply({ status: "needs-input", reason: "unsupported-component-route" })
    const change = object(payload.mutation)
    if (Object.keys(change).sort().join(",") !== "expectedStorageVersion,idempotencyKey" || typeof change.expectedStorageVersion !== "number" || !Number.isSafeInteger(change.expectedStorageVersion) || typeof change.idempotencyKey !== "string") return reply({ status: "needs-input", reason: "invalid-component-mutation" })
    if (suspended.beforeNextReply) { const concurrent = suspended.beforeNextReply; suspended.beforeNextReply = undefined; await concurrent() }
    const admitted = await authority.human.admit(incoming, "collaboration.thread.reply", payload)
    const result = admitted.status !== "ok" ? admitted : await threads.reply(payload.id, payload.body, { expectedStorageVersion: change.expectedStorageVersion, idempotencyKey: change.idempotencyKey }, admitted.value).finally(() => authority.human.finish(admitted.value))
    const response = reply(result)
    attempts.push({ body: raw, key: incoming.headers.get("idempotency-key"), status: response.status, value: result.status === "ok" ? result.value : result })
    // Corrupt delivery only after the real producer has returned its durable result.
    if (suspended.malformedNextReply && result.status === "ok") { suspended.malformedNextReply = false; return Response.json({ status: "ok", value: {} }) }
    if (!suspended.nextReply || result.status !== "ok") return response
    suspended.nextReply = false
    const body = await response.text()
    return new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body.slice(0, 20)))
        suspended.finish = () => { suspended.finish = undefined; try { controller.enqueue(new TextEncoder().encode(body.slice(20))); controller.close() } catch { /* Delivery was cancelled after the real commit. */ } }
      }, cancel() { suspended.finish = undefined },
    }), { status: response.status, headers: { "Content-Type": "application/json", "X-Thread-Real-Commit": "body-pending" } })
  }
  return { origin, identity, policy, initial: initial.value, attempts, answerAttempts, suspended, concurrentReply,
    readAnswer: () => read(request(), "collaboration.answer.read", { questionId: initial.value.id }, (context) => answers.read(initial.value.id, context)),
    inspect: () => authority.state.read(request(), "threads", (state) => { const value = state.threads[initial.value.id]; return isThread(value) ? value : undefined }),
    close: async () => { suspended.finish?.(); await server.stop(true); await driver.dispose(); await rm(directory, { recursive: true, force: true }) } }
}
