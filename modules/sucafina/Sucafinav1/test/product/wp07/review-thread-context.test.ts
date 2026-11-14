import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SourceRef } from "../../../product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createReviewServices } from "../../../product/reviews/services.ts"
import { createReviewThreadContext, isReviewThreadContext } from "../../../product/reviews/thread-context.ts"
import { createReviewHttp } from "../../../product/reviews/http.ts"
import { threadMessageContext } from "../../../product/collaboration/thread-context.ts"
import type { ThreadSourceContext } from "../../../product/collaboration/thread-context.ts"
import { isThread } from "../../../product/collaboration/threads.ts"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { createThreadActorsFixture } from "../wp08/thread-actors-fixture.ts"
import { available } from "../wp08/relations-fixture.ts"

// Actual C05, C06, C08, Dashboard source issuers and SQLite. Authentication,
// recipient leases and the C17 historical archive are the fixture's declared
// boundaries; this does not demonstrate an installed/native host execution.
test("a question on C05 keeps its original review and source basis through current data changes and denies revoked review access", async () => {
  let reviewContext: ReturnType<typeof createReviewThreadContext> | undefined
  const access = { review: true, revokeAfterFirstRead: false, reads: 0 }
  const f = await createThreadActorsFixture({ authorizeReviewThreadContext: async (pin, basis, context) => {
    const allowed = !!reviewContext && await reviewContext.authorize(pin, basis, context)
    if (access.revokeAfterFirstRead && ++access.reads === 1) access.review = false
    return allowed
  } })
  try {
    const port = f.port
    if (!port.recipientActions || !port.threadHistory || !port.answerReuse) throw new Error("Review thread consumers unavailable")
    const source = await f.issueProject(f.author)
    await f.capture(source, f.author)
    const projection = available(await f.records.read(source.refId, f.author))
    const sources = async (context: TrustedDomainContext, refs: readonly SourceRef[]) => {
      if (!await f.host.revalidate(context)) return false
      const resolved = await Promise.all(refs.map(async (ref) => {
        if (source.target.surface !== ref.surface || source.target.recordType !== ref.type || source.target.recordId !== ref.id || source.target.incarnation !== ref.incarnation || source.target.version !== ref.version || digestSfValue(source.target.fields) !== digestSfValue(ref.fields) || digestSfValue(source.target.period) !== digestSfValue(ref.period)) return false
        const resolution = await f.evidence.resolve(source, context)
        return ["fresh", "historical"].includes(resolution.state) && resolution.accessRevision === context.binding.accessRevision && digestSfValue(resolution.ref) === digestSfValue(source)
      }))
      return resolved.every(Boolean) && await f.host.revalidate(context)
    }
    const services = createReviewServices({ state: f.state, host: f.host, authority: f.domainAuthority, evidence: f.evidence, creationTarget: f.creationTarget, operationIdentity: () => "wp07-review-thread", requiredAuthority: [], maxBytes: 5_000_000, now: () => "2026-11-13T00:00:00Z", selection: {
      select: async () => ({ status: "ok", value: [{ id: "project", title: "Original project review", period: f.period, recordCount: 1, projection }] }),
      authorizeSections: async (context, sections) => access.review && sections.every((section) => section.id === "project") && await sources(context, sections.flatMap((section) => section.sourceRefs)), revalidate: sources,
      authorizeComments: async (context, comments) => comments.length === 0 && await f.host.revalidate(context), authorizeDecision: async (context, values) => values.length === 0 && await f.host.revalidate(context), authorizeOutcome: async (context, values) => values.length === 0 && await f.host.revalidate(context), authorizeOutcomeComparison: async (context, values) => values.length === 0 && await f.host.revalidate(context), authorizeSensitivity: async (context, values) => values.length === 0 && await f.host.revalidate(context),
    } })
    reviewContext = services.threadContext
    const stored = await f.state.read(f.request("person"), "reviews", () => null)
    expect(stored).toEqual({ status: "unavailable", reason: "product-state-uninitialized" })
    // C08 initializes its protected state only on the first committed mutation.
    // The source/history capture above does not fabricate a product-state write.
    const review = available(await services.reviews.preserve({ id: "question-original-review", selectionRef: "original-project-selection", sectionRefs: ["project"], expectedStorageVersion: 0, idempotencyKey: "wp07-preserve-for-question", targetIncarnation: f.creationTarget.incarnation }, f.author))
    const originalDigest = digestSfValue(review)
    const basis: ThreadSourceContext = { sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version, period: f.period, evidenceRefs: [source] }
    const pin = available(await services.threadContext.prepare({ reviewRef: review.id, sectionId: "project" }, basis, f.author))
    expect(pin).toEqual({ reviewRef: review.id, reviewVersion: review.version, reviewDigest: originalDigest, sectionId: "project" })
    expect(Object.keys(pin).sort()).toEqual(["reviewDigest", "reviewRef", "reviewVersion", "sectionId"])
    expect(await services.threadContext.authorize(pin, basis, f.author)).toBe(true)
    const http = createReviewHttp({ origin: "https://example.test", ui: f.ui, authority: f.domainAuthority, reviews: services.reviews, threadContext: services.threadContext, descriptors: services.descriptors, human: { preserve: async () => ({ status: "denied", reason: "not-selected" }) }, download: async () => new Response(null, { status: 503 }), maxBodyBytes: 8192 })
    const prepareRequest = (payload: unknown, origin = "https://example.test") => new Request("https://example.test/product?sf=review-thread-context", { method: "POST", headers: { actor: "person", origin, "content-type": "application/json" }, body: JSON.stringify(payload) })
    const payload = { reviewRef: review.id, sectionId: "project", basis }
    const response = await http(prepareRequest(payload), "dashboard")
    expect(response?.status).toBe(200)
    expect(response?.headers.get("cache-control")).toBe("no-store")
    expect(await response!.json()).toEqual({ status: "ok", value: pin })
    expect((await http(prepareRequest({ ...payload, privateDiagnostic: "not-a-grant" }), "dashboard"))?.status).toBe(400)
    expect((await http(prepareRequest(payload, "https://other.test"), "dashboard"))?.status).toBe(403)
    expect(await services.threadContext.authorize({ ...pin, reviewVersion: pin.reviewVersion + 1 }, basis, f.author)).toBe(false)
    expect(await services.threadContext.authorize({ ...pin, reviewDigest: "a".repeat(64) }, basis, f.author)).toBe(false)
    expect(await services.threadContext.authorize({ ...pin, sectionId: "another-section" }, basis, f.author)).toBe(false)
    expect(await services.threadContext.authorize(pin, { ...basis, period: { start: "2027-01-01", end: "2027-12-31" } }, f.author)).toBe(false)
    const privatePin = { ...pin, privateDiagnostic: "must-not-enter-thread" }
    expect(isReviewThreadContext(privatePin)).toBe(false)
    expect(await services.threadContext.authorize(privatePin, basis, f.author)).toBe(false)
    const outside = available(await f.records.issue({ page: "CAPEX Projects", recordType: "capexProjects", recordId: "capex", fields: ["name", "budget"], period: f.period }, f.author))
    expect(await services.threadContext.authorize(pin, { sourceRef: outside.refId, sourceIncarnation: outside.target.incarnation, observedVersion: outside.target.version, period: f.period, evidenceRefs: [outside] }, f.author)).toBe(false)
    const version = async () => available(await port.storageVersion("threads", f.author))
    const draft = { kind: "clarification" as const, ...basis, recipientRef: "person", reviewContext: pin, body: "C05-QUESTION: why was the project still In Progress in this preserved review?" }
    const mutation = { expectedStorageVersion: await version(), idempotencyKey: "wp07-c05-question" }
    const thread = available(await port.threads.create(draft, mutation, await f.admit("person", "collaboration.thread.create", { draft, mutation })))
    expect(thread.messages[0]!.sourceContext?.reviewContext).toEqual(pin)
    expect(threadMessageContext(thread, thread.messages[0]!)).toEqual({ ...basis, reviewContext: pin })
    for (const field of ["reviewDigest", "sectionId"] as const) {
      const tampered = await f.state.transaction(f.request("person"), { namespace: "threads", expectedStorageVersion: await version(), idempotencyKey: `wp07-change-c05-${field}`, commandDigest: digestSfValue({ id: thread.id, field }), targetRef: f.creationTarget.ref, targetIncarnation: f.creationTarget.incarnation }, async (state) => {
        const storedThread = state.threads[thread.id]
        if (!isThread(storedThread)) throw new Error("Stored thread missing")
        state.threads[thread.id] = { ...storedThread, messages: storedThread.messages.map((message, index) => index ? message : { ...message, sourceContext: { ...basis, reviewContext: { ...pin, [field]: field === "reviewDigest" ? "b".repeat(64) : "another-section" } } }) }
        return { commit: true, value: true }
      })
      expect(tampered).toMatchObject({ status: "denied", reason: "thread-history-write-outside-authority" })
      expect(available(await port.threadReads.read(thread.id, f.author)).messages[0]!.sourceContext?.reviewContext).toEqual(pin)
    }
    const deniedDraft = { ...draft, recipientRef: "reader-b" }
    const deniedMutation = { expectedStorageVersion: await version(), idempotencyKey: "wp07-c05-no-recipient-lease" }
    const denied = await port.threads.create(deniedDraft, deniedMutation, await f.admit("person", "collaboration.thread.create", { draft: deniedDraft, mutation: deniedMutation }))
    expect(denied.status).not.toBe("ok")
    expect(JSON.stringify(denied)).not.toContain("C05-QUESTION")
    const transaction = f.state.transaction
    const race = { entered: false }
    const creationVersion = await version()
    const beforeRace = await f.state.read(f.request("person"), "threads", (state) => state.threads)
    if (beforeRace.status !== "ok") throw new Error("Thread storage unavailable")
    const raceDraft = { ...draft, body: "C05-CREATE-RACE: must not be stored after revocation." }
    const raceMutation = { expectedStorageVersion: creationVersion, idempotencyKey: "wp07-c05-revoked-create" }
    f.state.transaction = (request, command, work) => transaction(request, command, async (state, authority, snapshot) => {
      if (command.idempotencyKey === raceMutation.idempotencyKey) { race.entered = true; access.review = false }
      return work(state, authority, snapshot)
    })
    try {
      const rejected = await port.threads.create(raceDraft, raceMutation, await f.admit("person", "collaboration.thread.create", { draft: raceDraft, mutation: raceMutation }))
      expect(race.entered).toBe(true)
      expect(rejected.status).not.toBe("ok")
      expect(JSON.stringify(rejected)).not.toContain("C05-CREATE-RACE")
    } finally { f.state.transaction = transaction; access.review = true }
    expect(await version()).toBe(creationVersion)
    const afterRace = await f.state.read(f.request("person"), "threads", (state) => state.threads)
    if (afterRace.status !== "ok") throw new Error("Thread storage unavailable")
    expect(afterRace.value).toEqual(beforeRace.value)
    const before = await f.snapshots()
    await f.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "save", id: "project", version: before.dashboard.versions["projects:project"]!.version, values: { status: "On Hold" } })
    f.historical.allowed = true
    const afterDomain = await f.snapshots()
    const reopened = available(await port.threadReads.read(thread.id, f.author))
    expect(threadMessageContext(reopened, reopened.messages[0]!)).toEqual({ ...basis, reviewContext: pin })
    const body = "C05-ANSWER: this explains the original review, not the later On Hold status."
    const replyMutation = { expectedStorageVersion: await version(), idempotencyKey: "wp07-c05-answer" }
    const reply = available(await port.recipientActions.reply(thread.id, body, replyMutation, await f.admit("person", "collaboration.thread.reply", { id: thread.id, body, mutation: replyMutation })))
    expect(reply.messages).toHaveLength(2)
    const canonicalReply = available(await port.threadReads.read(thread.id, f.author))
    expect(canonicalReply.messages.map((message) => threadMessageContext(canonicalReply, message))).toEqual([{ ...basis, reviewContext: pin }, { ...basis, reviewContext: pin }])
    expect(digestSfValue(available(await services.reviews.read(review.id, f.author)))).toBe(originalDigest)
    const afterReply = await f.snapshots()
    expect(afterReply.dashboard.data.projects).toEqual(afterDomain.dashboard.data.projects)
    expect(afterReply.dashboard.data.hotTopics).toEqual(afterDomain.dashboard.data.hotTopics)
    const answer = canonicalReply.messages[1]!
    const history = available(await port.threadHistory.readVersion(thread.id, answer.id, answer.incarnation, answer.version, f.author))
    expect(history).toEqual({ message: answer, ...basis, reviewContext: pin })
    const answerRef = available(await port.answerEvidence.issue(thread.id, answer.id, f.author)).refId
    expect(await port.answerReuse.prepare(thread.id, answerRef, f.author)).toMatchObject({ status: "unavailable", reason: "review-answer-confirmation-scope-unavailable" })
    const workSelection = await f.select("person", f.author)
    const work = available(await port.work.listPresentation(workSelection, f.author))
    expect(work.items).toHaveLength(1)
    expect(work.items[0]).toMatchObject({ actionRef: thread.id, ownerRef: "person", state: "clarification-open", reviewContext: pin, destination: { kind: "thread", threadId: thread.id } })
    const historicalResponse = await http(prepareRequest(payload), "dashboard")
    expect(historicalResponse?.status).toBe(200)
    expect(await historicalResponse!.json()).toEqual({ status: "ok", value: pin })
    const replyVersion = await version()
    const replyRace = { entered: false }
    const raceBody = "C05-REPLY-RACE: must not be stored after revocation."
    const racedMutation = { expectedStorageVersion: replyVersion, idempotencyKey: "wp07-c05-revoked-reply" }
    f.state.transaction = (request, command, work) => transaction(request, command, async (state, authority, snapshot) => {
      if (command.idempotencyKey === racedMutation.idempotencyKey) { replyRace.entered = true; access.review = false }
      return work(state, authority, snapshot)
    })
    try {
      const rejected = await port.recipientActions.reply(thread.id, raceBody, racedMutation, await f.admit("person", "collaboration.thread.reply", { id: thread.id, body: raceBody, mutation: racedMutation }))
      expect(replyRace.entered).toBe(true)
      expect(rejected.status).not.toBe("ok")
      expect(JSON.stringify(rejected)).not.toContain("C05-REPLY-RACE")
    } finally { f.state.transaction = transaction; access.review = true }
    expect(await version()).toBe(replyVersion)
    expect(available(await port.threadReads.read(thread.id, f.author)).messages).toEqual(canonicalReply.messages)
    const readPort = { read: services.reviews.read }
    const guarded = createReviewThreadContext({ reviews: readPort, host: f.host })
    readPort.read = async (id, context) => {
      const result = await services.reviews.read(id, context)
      readPort.read = (reference, call) => services.reviews.read(reference, call)
      return result
    }
    expect(await guarded.authorize(pin, basis, f.author)).toBe(false)
    access.revokeAfterFirstRead = true
    access.reads = 0
    const raced = await port.threadReads.read(thread.id, f.author)
    expect(raced.status).not.toBe("ok")
    expect(JSON.stringify(raced)).not.toContain("C05-QUESTION")
    expect(JSON.stringify(raced)).not.toContain("C05-ANSWER")
    expect(await services.threadContext.authorize(pin, basis, f.author)).toBe(false)
    const revoked = await port.threadReads.read(thread.id, f.author)
    expect(revoked.status).not.toBe("ok")
    expect(JSON.stringify(revoked)).not.toContain(review.id)
    expect(JSON.stringify(revoked)).not.toContain("C05-QUESTION")
    const revokedHistory = await port.threadHistory.readVersion(thread.id, answer.id, answer.incarnation, answer.version, f.author)
    expect(revokedHistory.status).not.toBe("ok")
    expect(JSON.stringify(revokedHistory)).not.toContain("C05-ANSWER")
    const revokedWork = await port.work.listPresentation(workSelection, f.author)
    expect(revokedWork.status).not.toBe("ok")
    expect(JSON.stringify(revokedWork)).not.toContain("C05-QUESTION")
    const forbiddenResponse = await http(prepareRequest(payload), "dashboard")
    expect(forbiddenResponse?.status).toBe(403)
    expect(JSON.stringify(await forbiddenResponse!.json())).not.toContain(review.id)
  } finally { await f.dispose() }
}, 120000)

