import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import { createReviewPort } from "../../../product/reviews/port.ts"
import { createReviewClosurePort } from "../../../product/reviews/closure-action.ts"
import { testPersistence } from "./persistence.ts"

test("closure binds an authorized handoff to the immutable review and rereads its action", async () => {
  const persistence = testPersistence()
  const state = createSfProductState({ persistence: persistence.persistence, createId: () => "state", resolveTarget: async () => ({ incarnation: "install" }), authorize: async () => ({ principalRef: "principal", accessRevision: "access", policyVersion: "policy" }) })
  const ui = createSfUiAuthority({ privateCommands: ["sf-human:collaboration.handoff.confirm"], createId: () => "request", now: () => 0, commandIdentity: async () => "handoff", authorize: async () => ({ principalRef: "principal", installationId: "install", projectId: "project", accessRevision: "access", policyVersion: "policy" }) })
  const human = createSfHumanAuthority({ origin: "https://example.test", ui })
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const source = { surface: "dashboard", type: "forecast", id: "one", incarnation: "inc", version: 1, fields: ["value"], period, observedAt: "2026-11-13T00:00:00Z" } as const
  const evidence = { schema: "sf-evidence-v1", refId: "evidence", installationId: "install", projectId: "project", refDigest: "digest", evidenceLevel: "observed", kind: "record", target: { surface: "dashboard", recordType: "forecast", recordId: "one", incarnation: "inc", version: 1, fields: ["value"], projectionDigest: "digest" } } as const
  const review = { id: "review", version: 1, createdAt: "2026-11-13T00:00:00Z", sourceRefs: [source], comments: [], sections: [{ id: "section", title: "Forecast", period, count: 1, sourceRefs: [source], content: { version: 1, engineVersion: "v1", context: { principalRef: "principal", installationId: "install", projectId: "project", accessRevision: "access", policyVersion: "policy", surface: "dashboard", period, currency: "USD", sourceRefs: [source], capabilities: [] }, values: [{ id: "value", value: 100, period, granularity: "year", sourceRefs: [evidence], drilldown: evidence, evidenceState: "confirmed" }], components: [], missing: [] } }] }
  const request = new Request("https://example.test/dashboard?sf=review-close", { method: "POST", headers: { origin: "https://example.test" } })
  await state.transaction(request, { namespace: "reviews", expectedStorageVersion: 0, targetRef: "workspace", targetIncarnation: "install", idempotencyKey: "seed", commandDigest: "a".repeat(64) }, async (draft) => { draft.reviews.review = review; return { commit: true, value: true } })
  const reviews = createReviewPort({ state, creationTarget: { ref: "workspace", incarnation: "install" }, now: () => "2026-11-13T00:00:00Z", requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined, authorizeOutcomeComparison: async () => true, authorizeOutcome: async () => true, authorizeDecision: async () => true, authorizeSections: async () => true, authorizeComments: async () => true, authorizeSensitivity: async () => true, revalidate: async () => true, revalidateEvidence: async () => true, select: async () => ({ status: "unavailable", reason: "unused" }) })
  const handoff = { sourceRef: "evidence", relationKey: "relation", intent: { correlationKey: "correlation", sourceRefs: [evidence], action: "Follow up", owner: "Owner", due: "2026-12-31", priority: "normal", notes: "" } } as const
  const digest = digestSfValue({ reviewRef: "review" })
  const reviewContext = await ui.admit(request, "sf_review_prepare", digest)
  if (reviewContext.status !== "ok" || !await ui.validate(reviewContext.value, "sf_review_prepare", digest)) throw new Error("review admission failed")
  const actionContext = await human.admit(request, "collaboration.handoff.confirm", handoff)
  if (actionContext.status !== "ok") throw new Error("handoff admission failed")
  const access = { allowed: true, handoffs: 0, current: { id: "topic", version: 1, action: "Follow up", owner: "Owner", due: "2026-12-31", status: "open", priority: "normal", notes: "" } }
  const closures = createReviewClosurePort({ state, host: { requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false) }, reviews, human, ui, creationTarget: { ref: "workspace", incarnation: "install" }, operationIdentity: (context) => context.kind === "ui" ? ui.operationIdentity(context) : undefined, handoff: { create: async () => { access.handoffs++; return { status: "ok", value: { topic: structuredClone(access.current), state: "created", relationId: "relation-id" } } } }, verifyHandoff: async () => access.allowed, readAction: async () => ({ status: "ok", value: structuredClone(access.current) }) })
  const closed = await closures.confirm("review", handoff, reviewContext.value, actionContext.value)
  if (closed.status !== "ok") throw new Error(closed.reason)
  access.current = { ...access.current, status: "done", version: 2 }
  const reopened = await closures.read(closed.value.closureRef, reviewContext.value)
  expect(reopened).toMatchObject({ status: "ok", value: { review: { id: "review" }, closure: { topic: { status: "open" } }, currentAction: { status: "done" } } })
  expect(await closures.confirm("review", handoff, reviewContext.value, actionContext.value)).toEqual(closed)
  expect(access.handoffs).toBe(1)
  const listed = await closures.listByReview("review", reviewContext.value)
  expect(listed).toMatchObject({ status: "ok", value: { coverage: "complete", entries: [{ closure: { id: closed.value.closureRef, topic: { status: "open" } }, currentAction: { id: "topic", status: "done", version: 2 } }] } })
  if (listed.status !== "ok") throw new Error("closure list unavailable")
  expect(listed.value.entries[0]?.review).toEqual(review)
  access.allowed = false
  expect((await closures.read(closed.value.closureRef, reviewContext.value)).status).toBe("denied")
  const restricted = await closures.listByReview("review", reviewContext.value)
  expect(restricted).toMatchObject({ status: "ok", value: { coverage: "partial", entries: [] } })
  expect(JSON.stringify(restricted)).not.toContain("Follow up")
  expect((await closures.confirm("review", handoff, reviewContext.value, actionContext.value)).status).toBe("denied")
  expect(access.handoffs).toBe(1)
})
