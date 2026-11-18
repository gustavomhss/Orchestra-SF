import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SourceRef } from "../../../product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { createReviewServices } from "../../../product/reviews/services.ts"
import { createReviewCurrentThread } from "../../../product/reviews/current-thread.ts"
import { createReviewHttp } from "../../../product/reviews/http.ts"
import { selectedReviewComments } from "../../../product/reviews/comment-selection.ts"
import { validReviewCommentRefs } from "../../../product/reviews/port.ts"
import { createReviewThreadComments, createExactReviewThreadSourceMapping } from "../../../product/reviews/thread-access.ts"
import { renderPreservedReview } from "../../../product/reviews/render.ts"
import { reviewInclusion } from "../../../product/reviews/inclusion.ts"
import { createThreadActorsFixture } from "../wp08/thread-actors-fixture.ts"
import { available } from "../wp08/relations-fixture.ts"
import { extractReportText } from "./export-fixture.ts"

// Actual SQLite/C08, Dashboard issuers, C06 history, actor admissions, C05,
// current-conversation HTTP and renderers. Recipient and historical
// grants are explicitly configured fixture boundaries, not installed native proof.
test("authorized C06 capture creates immutable section membership and reopens the current conversation without rewriting the review", async () => {
  const f = await createThreadActorsFixture()
  try {
    const port = f.port
    if (!port.recipientActions || !port.threadHistory || !port.authorizeThreadSourceContinuity) throw new Error("Thread continuity producer unavailable")
    const sourceA = await f.issueProject(f.author)
    const sourceB = await f.issueProject(f.recipient)
    expect(sourceA.target.incarnation).not.toBe(sourceB.target.incarnation)
    await f.capture(sourceA, f.author)
    await f.capture(sourceB, f.recipient)
    const version = async () => available(await port.storageVersion("threads", f.author))
    const draft = { kind: "review" as const, sourceRef: sourceA.refId, sourceIncarnation: sourceA.target.incarnation, observedVersion: sourceA.target.version, period: f.period, recipientRef: "reader-b", body: "PRESERVED-A-V1: review the selected project.", evidenceRefs: [sourceA] }
    const mutation = { expectedStorageVersion: await version(), idempotencyKey: "wp07-associated-thread" }
    const thread = available(await port.threads.create(draft, mutation, await f.admit("person", "collaboration.thread.create", { draft, mutation })))
    const body = "PRESERVED-B-V1: the selected source has been reviewed."
    const replyMutation = { expectedStorageVersion: await version(), idempotencyKey: "wp07-associated-reply" }
    available(await port.recipientActions.reply(thread.id, body, replyMutation, await f.admit("reader-b", "collaboration.thread.reply", { id: thread.id, body, mutation: replyMutation })))
    f.historical.allowed = true
    const comments = createReviewThreadComments({ host: f.host, threads: port.threadReads, history: port.threadHistory, maxMessages: 20, authorizeSourceMapping: createExactReviewThreadSourceMapping({ host: f.host, evidence: f.evidence }), authorizeSourceContinuity: port.authorizeThreadSourceContinuity })
    const projection = available(await f.records.read(sourceA.refId, f.author))
    const captured = available(await comments.capture(thread.id, projection.context.sourceRefs, f.author))
    expect(captured.map((comment) => comment.content)).toEqual([draft.body, body])
    expect(captured.map((comment) => comment.sourceRefs[0]!.incarnation)).toEqual([sourceA.target.incarnation, sourceB.target.incarnation])
    const resolveSources = async (context: TrustedDomainContext, refs: readonly SourceRef[]) => {
      if (!await f.host.revalidate(context)) return false
      const resolutions = await Promise.all(refs.map(async (ref) => {
        const original = [sourceA, sourceB].find((value) => value.target.surface === ref.surface && value.target.recordType === ref.type && value.target.recordId === ref.id && value.target.incarnation === ref.incarnation && value.target.version === ref.version && digestSfValue(value.target.fields) === digestSfValue(ref.fields) && digestSfValue(value.target.period) === digestSfValue(ref.period))
        if (!original) return false
        const result = await f.evidence.resolve(original, context)
        return ["fresh", "historical"].includes(result.state) && result.accessRevision === context.binding.accessRevision && digestSfValue(result.ref) === digestSfValue(original)
      }))
      return resolutions.every(Boolean) && await f.host.revalidate(context)
    }
    const services = createReviewServices({ state: f.state, host: f.host, authority: f.domainAuthority, evidence: f.evidence, creationTarget: f.creationTarget, operationIdentity: () => "wp07-historical-export", requiredAuthority: [], maxBytes: 5_000_000, now: () => "2026-11-13T00:00:00Z", selection: {
      select: async () => ({ status: "ok", value: [{ id: "project", title: "Selected project", period: f.period, recordCount: 1, projection, comments: captured }] }),
      authorizeComments: comments.authorizeComments, authorizeSections: async (context, sections) => sections.every((section) => section.id === "project") && await resolveSources(context, sections.flatMap((section) => section.sourceRefs)), revalidate: resolveSources,
      authorizeDecision: async (context, values) => values.length === 0 && await f.host.revalidate(context), authorizeOutcome: async (context, values) => values.length === 0 && await f.host.revalidate(context), authorizeOutcomeComparison: async (context, values) => values.length === 0 && await f.host.revalidate(context), authorizeSensitivity: async (context, values) => values.length === 0 && await f.host.revalidate(context),
    } })
    const before = await f.state.read(f.request("person"), "reviews", () => null)
    if (before.status !== "ok") throw new Error("Review state unavailable")
    const review = available(await services.reviews.preserve({ id: "associated-review", selectionRef: "selected-project", sectionRefs: ["project"], expectedStorageVersion: before.storageVersion, idempotencyKey: "wp07-associated-preserve", targetIncarnation: f.creationTarget.incarnation }, f.author))
    expect(validReviewCommentRefs(review.sections[0]!.content, review.comments)).toBe(true)
    expect(selectedReviewComments(review, ["project"], digestSfValue)).toEqual(captured)
    expect(reviewInclusion(review, ["project"])?.comments).toHaveLength(2)
    const originalDigest = digestSfValue(review)
    const editBody = "CURRENT-A-V2: this is the current conversation only."
    const editMutation = { expectedStorageVersion: await version(), idempotencyKey: "wp07-current-conversation-edit" }
    available(await port.threadHistory.edit(thread.id, thread.messages[0]!.id, 1, editBody, editMutation, await f.admit("person", "collaboration.thread.edit", { id: thread.id, messageId: thread.messages[0]!.id, expectedVersion: 1, body: editBody, mutation: editMutation })))
    const currentThread = createReviewCurrentThread({ reviews: services.reviews, threads: port.threadReads, host: f.host })
    const current = available(await currentThread(review.id, captured[0]!.id, f.author))
    expect(current).toMatchObject({ threadId: thread.id, view: "current", messages: [{ version: 2, body: editBody }, { version: 1, body }] })
    expect(digestSfValue(available(await services.reviews.read(review.id, f.author)))).toBe(originalDigest)
    const http = createReviewHttp({ origin: "https://example.test", ui: f.ui, authority: f.domainAuthority, reviews: services.reviews, descriptors: services.descriptors, currentThread, human: { preserve: async () => ({ status: "denied", reason: "not-selected" }) }, download: async () => new Response(null, { status: 503 }), maxBodyBytes: 4096 })
    const request = () => new Request(`https://example.test/product?sf=review-current-thread&reviewRef=${encodeURIComponent(review.id)}&commentId=${encodeURIComponent(captured[0]!.id)}`, { headers: { actor: "person" } })
    const response = await http(request(), "dashboard")
    expect(response?.status).toBe(200)
    expect(response?.headers.get("cache-control")).toBe("no-store")
    expect(await response!.json()).toMatchObject({ status: "ok", value: current })
    const snapshot = await f.snapshots()
    await f.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "save", id: "project", version: snapshot.dashboard.versions["projects:project"]!.version, values: { status: "On Hold" } })
    const historical = available(await services.reviews.read(review.id, f.author))
    expect(digestSfValue(historical)).toBe(originalDigest)
    for (const format of ["docx", "pptx"] as const) {
      const output = await renderPreservedReview(historical, { title: "Captured comments", format, sectionRefs: ["project"] })
      if (!output.ok) throw new Error("Historical report unavailable")
      const text = (await extractReportText(output.bytes, format)).text.replace(/\s/gu, "")
      expect(text.split("PRESERVED-A-V1:").length - 1).toBe(1)
      expect(text.split("PRESERVED-B-V1:").length - 1).toBe(1)
      expect(text).not.toContain("CURRENT-A-V2:")
    }
    f.historical.allowed = false
    expect((await services.reviews.read(review.id, f.author)).status).toBe("denied")
    expect((await currentThread(review.id, captured[0]!.id, f.author)).status).toBe("denied")
    expect((await http(request(), "dashboard"))?.status).toBe(403)
    f.historical.allowed = true
    f.actors.person!.enabled = false
    const revoked = await currentThread(review.id, captured[0]!.id, f.author)
    expect(revoked.status).toBe("denied")
    expect(JSON.stringify(revoked)).not.toContain("PRESERVED")
  } finally { await f.dispose() }
}, 120000)
