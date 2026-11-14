import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SourceRef } from "../../../product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createReviewServices } from "../../../product/reviews/services.ts"
import { createReviewClosurePort } from "../../../product/reviews/closure-action.ts"
import type { ReviewActionHandoff } from "../../../product/reviews/closure-action.ts"
import { createReviewHandoffVerifier } from "../../../product/reviews/handoff-access.ts"
import { createReviewComparisonPort } from "../../../product/reviews/comparison-port.ts"
import { DashboardPeople } from "../../../runtime/dashboard-people.ts"
import { rows } from "../../../runtime/contract.ts"
import { createThreadActorsFixture } from "../wp08/thread-actors-fixture.ts"
import { available } from "../wp08/relations-fixture.ts"

// Actual C05/C06/C08, cases, source issuers, domain HotTopic and canonical work.
// UI/recipient admission is the fixture's explicit actor boundary, not a native
// execution witness. No synthetic Review BusinessEvidenceRef is introduced.
test("review closure and project reopen the same canonical action in one work item with independently authorized review context", async () => {
  let closures: ReturnType<typeof createReviewClosurePort> | undefined
  const access = { review: true, revokeAfterFirstContextRead: false, contextReads: 0 }
  const f = await createThreadActorsFixture({ reviewContexts: async (topicId, context) => {
    const result = closures ? await closures.listByAction(topicId, context) : { status: "ok" as const, value: [] }
    if (access.revokeAfterFirstContextRead && ++access.contextReads === 1) access.review = false
    return result
  } })
  try {
    const port = f.port
    if (!port.caseSelection) throw new Error("Case work producer unavailable")
    const source = available(await f.records.issue({ page: "Portfolio Dashboard", recordType: "projects", recordId: "project", fields: ["name", "budget", "spent", "status"], period: f.period }, f.author))
    const projection = available(await f.records.read(source.refId, f.author))
    expect(projection.values.find((value) => value.id === "projects:project:budget")?.value).toBe(100)
    const draft = { objective: "Close the selected project review", horizon: f.period, currency: "USD", criteria: ["Preserve the captured basis and reuse the same operational action"], sourceRefs: [source] }
    const caseCall = available(await f.ui.admit(f.request("person"), "sf_case_draft", digestSfValue(draft)))
    if (!await f.ui.validate(caseCall, "sf_case_draft", digestSfValue(draft))) throw new Error("Case admission unavailable")
    const decision = available(await f.cases.draft(draft, caseCall))
    const selected = { caseRef: encodeCaseRef(decision), period: f.period, sourceRefs: [source] }
    const selectionMutation = { expectedStorageVersion: available(await port.caseSelection.storageVersion(f.author)), idempotencyKey: "wp07-closure-work-selection" }
    const selection = available(await port.caseSelection.create(selected, selectionMutation, await f.admit("person", "collaboration.selection.create", { draft: selected, mutation: selectionMutation })))
    const workSelection = { selectionRef: selection.selectionRef, period: f.period }
    const sources = async (context: TrustedDomainContext, refs: readonly SourceRef[]) => {
      if (!await f.host.revalidate(context) || refs.some((ref) => !projection.context.sourceRefs.some((captured) => digestSfValue(captured) === digestSfValue(ref)))) return false
      const current = await f.evidence.resolve(source, context)
      return ["fresh", "historical"].includes(current.state) && current.accessRevision === context.binding.accessRevision && digestSfValue(current.ref) === digestSfValue(source) && await f.host.revalidate(context)
    }
    const services = createReviewServices({ state: f.state, host: f.host, authority: f.domainAuthority, evidence: f.evidence, creationTarget: f.creationTarget, operationIdentity: (context) => context.kind === "ui" ? f.ui.operationIdentity(context) : undefined, requiredAuthority: [], maxBytes: 5_000_000, now: () => "2026-11-13T00:00:00Z", selection: {
      select: async () => ({ status: "ok", value: [{ id: "project", title: "Selected project financial basis", period: f.period, recordCount: 1, projection }] }),
      authorizeSections: async (context, sections) => access.review && await sources(context, sections.flatMap((section) => section.sourceRefs)), revalidate: sources,
      authorizeComments: async (context, comments) => comments.length === 0 && await f.host.revalidate(context), authorizeDecision: async (context, values) => values.length === 0 && await f.host.revalidate(context), authorizeOutcome: async (context, values) => values.length === 0 && await f.host.revalidate(context), authorizeOutcomeComparison: async (context, values) => values.length === 0 && await f.host.revalidate(context), authorizeSensitivity: async (context, values) => values.length === 0 && await f.host.revalidate(context),
    } })
    const storage = await f.state.read(f.request("person"), "reviews", () => null)
    if (storage.status !== "ok") throw new Error("Review state unavailable")
    const review = available(await services.reviews.preserve({ id: "review-work-context", selectionRef: "project-selected", sectionRefs: ["project"], expectedStorageVersion: storage.storageVersion, idempotencyKey: "wp07-preserve-work-context", targetIncarnation: f.creationTarget.incarnation }, f.author))
    const before = await f.snapshots()
    const human = createSfHumanAuthority({ origin: "https://example.test", ui: f.ui })
    closures = createReviewClosurePort({ state: f.state, host: f.host, reviews: services.reviews, human, ui: f.ui, creationTarget: f.creationTarget, operationIdentity: (context) => context.kind === "ui" ? f.ui.operationIdentity(context) : undefined,
      handoff: { create: async (request, context) => {
        const result = await port.handoff.create(request, context)
        if (result.status !== "ok") return result
        if (result.value.state !== "created" && result.value.state !== "existing") return { status: "unavailable", reason: "handoff-state-unavailable" }
        return { status: "ok", value: { ...result.value, state: result.value.state } }
      } }, verifyHandoff: createReviewHandoffVerifier({ host: f.host, relations: port.relations, hotTopics: port.hotTopics }), readAction: port.hotTopics.read,
    })
    const handoff: ReviewActionHandoff = { sourceRef: source.refId, recipientRef: "person", relationKey: "wp07-canonical-action-relation", intent: { correlationKey: "wp07-canonical-action", sourceRefs: [source], action: "Follow up the preserved project review", owner: "Author", due: "2026-12-01", priority: "normal", notes: "" } }
    const request = f.request("person")
    const reviewCall = available(await f.ui.admit(request, "sf_review_prepare", digestSfValue({ reviewRef: review.id })))
    if (!await f.ui.validate(reviewCall, "sf_review_prepare", digestSfValue({ reviewRef: review.id }))) throw new Error("Review handoff admission unavailable")
    const actionCall = available(await human.admit(request, "collaboration.handoff.confirm", handoff))
    const closed = available(await closures.confirm(review.id, handoff, reviewCall, actionCall))
    expect(digestSfValue(closed.review)).toBe(digestSfValue(review))
    expect(available(await closures.confirm(review.id, handoff, reviewCall, actionCall))).toEqual(closed)
    const projectReopen = available(await port.handoff.create(handoff, actionCall))
    expect(projectReopen).toMatchObject({ state: "existing", topic: { id: closed.topic.id }, relationId: closed.relationId })
    const after = await f.snapshots()
    expect(after.dashboard.data.projects).toEqual(before.dashboard.data.projects)
    expect(rows(after.dashboard.data.hotTopics)).toHaveLength(rows(before.dashboard.data.hotTopics).length + 1)
    const expectedContext = { closureRef: closed.closureRef, reviewRef: review.id, reviewVersion: review.version, reviewDigest: digestSfValue(review) }
    expect(available(await closures.listByAction(closed.topic.id, f.author))).toEqual([expectedContext])
    const work = available(await port.work.listPresentation(workSelection, f.author))
    expect(work.items).toHaveLength(1)
    expect(work.items[0]).toMatchObject({ kind: "handoff", destination: { kind: "hot-topic", topicId: closed.topic.id }, reviewContexts: [expectedContext] })
    expect(work.items[0]!.sourceRefs.some((ref) => ref.kind === "record" && ref.target.recordType === "projects" && ref.target.recordId === "project")).toBe(true)
    expect(available(await closures.listByAction(closed.topic.id, f.recipient))).toEqual([])
    await f.mutate("dashboard", DashboardPeople.domain, { page: "Hot Topics & Actions", action: "save", id: closed.topic.id, version: closed.topic.version, values: { status: "done" } })
    const reopened = available(await closures.read(closed.closureRef, f.author))
    expect(reopened.currentAction).toMatchObject({ id: closed.topic.id, status: "done" })
    expect(reopened.closure.topic.status).toBe("open")
    expect(digestSfValue(reopened.review)).toBe(digestSfValue(review))
    const comparison = available(await createReviewComparisonPort({ reviews: services.reviews, closures, host: f.host }).read(review.id, f.author))
    expect(comparison.forwardings).toMatchObject([{ relationId: closed.relationId, preservedAction: { id: closed.topic.id, status: "open" }, currentAction: { id: closed.topic.id, status: "done" } }])
    const completed = available(await port.work.listPresentation(workSelection, f.author))
    expect(completed.items).toHaveLength(1)
    expect(completed.items[0]).toMatchObject({ destination: { topicId: closed.topic.id }, state: "done", reviewContexts: [expectedContext] })
    access.revokeAfterFirstContextRead = true
    const changedDuringRead = await port.work.listPresentation(workSelection, f.author)
    expect(changedDuringRead.status).not.toBe("ok")
    expect(JSON.stringify(changedDuringRead)).not.toContain(review.id)
    expect(JSON.stringify(changedDuringRead)).not.toContain(closed.closureRef)
    access.revokeAfterFirstContextRead = false
    access.review = false
    expect(available(await closures.listByAction(closed.topic.id, f.author))).toEqual([])
    const restricted = available(await port.work.listPresentation(workSelection, f.author))
    expect(restricted.items).toHaveLength(1)
    expect(restricted.items[0]?.reviewContexts ?? []).toEqual([])
    expect(JSON.stringify(restricted)).not.toContain(review.id)
    expect(restricted.items[0]?.destination).toEqual({ kind: "hot-topic", topicId: closed.topic.id })
    access.review = true
    f.actors.person!.enabled = false
    const revoked = await port.work.listPresentation(workSelection, f.author)
    expect(revoked.status).not.toBe("ok")
    expect(JSON.stringify(revoked)).not.toContain(handoff.intent.action)
  } finally { await f.dispose() }
}, 120000)
