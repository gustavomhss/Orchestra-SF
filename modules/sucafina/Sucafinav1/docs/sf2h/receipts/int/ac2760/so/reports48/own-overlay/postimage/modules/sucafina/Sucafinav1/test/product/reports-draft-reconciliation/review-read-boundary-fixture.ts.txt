import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SourceRef } from "../../../product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import { createReviewServices } from "../../../product/reviews/services.ts"
import { createReviewHttp } from "../../../product/reviews/http.ts"
import { createReviewHumanPort } from "../../../product/reviews/human.ts"
import { createReviewClosurePort } from "../../../product/reviews/closure-action.ts"
import type { ReviewActionHandoff } from "../../../product/reviews/closure-action.ts"
import { createReviewHandoffVerifier } from "../../../product/reviews/handoff-access.ts"
import { createReviewDownloadHandler } from "../../../product/reports/download.ts"
import { object } from "../../../runtime/contract.ts"
import { createReviewAnswersFixture } from "../wp08/review-answers-fixture.ts"
import { available } from "../wp08/relations-fixture.ts"

/** Reopen an actually preserved C05 with a second production consumer. The
 * existing fixture owns actor/ACL/history grants. Only this consumer's evidence
 * I/O is faulted; its source selection still uses the original real resolver.
 */
export async function createReviewReadBoundaryFixture() {
  const fixture = await createReviewAnswersFixture()
  const projection = available(await fixture.records.read(fixture.source.refId, fixture.author))
  const evidence: { fault: "" | "throw" | "unavailable" | "stale" | "revoked"; calls: number } = { fault: "", calls: 0 }
  const sources = async (context: TrustedDomainContext, refs: readonly SourceRef[]) => {
    if (!await fixture.host.revalidate(context) || refs.some((ref) => !projection.context.sourceRefs.some((source) => digestSfValue(source) === digestSfValue(ref)))) return false
    const resolution = await fixture.evidence.resolve(fixture.source, context)
    return ["fresh", "historical"].includes(resolution.state) && resolution.accessRevision === context.binding.accessRevision && digestSfValue(resolution.ref) === digestSfValue(fixture.source) && await fixture.host.revalidate(context)
  }
  const services = createReviewServices({
    state: fixture.state, host: fixture.host, authority: fixture.domainAuthority,
    evidence: { resolve: async (ref, context) => {
      const result = await fixture.evidence.resolve(ref, context)
      if (!evidence.fault) return result
      evidence.calls += 1
      if (evidence.fault === "throw") throw new Error("Injected C05 evidence transport failure after the real resolution")
      return { ...result, state: evidence.fault }
    } },
    creationTarget: fixture.creationTarget,
    operationIdentity: (context) => context.kind === "ui" ? fixture.ui.operationIdentity(context) : undefined,
    requiredAuthority: [], maxBytes: 5_000_000, now: () => "2026-11-13T00:00:00Z",
    selection: {
      select: async (_selection, ids, context) => {
        if (ids.length !== 1 || ids[0] !== "project" || !fixture.access[context.binding.principalRef]) return { status: "denied", reason: "fixture-review-selection-denied" }
        const current = await fixture.records.read(fixture.source.refId, context)
        return current.status === "ok" ? { status: "ok", value: [{ id: "project", title: "Preserved project answer", period: fixture.period, recordCount: 1, projection: current.value }] } : current
      },
      authorizeSections: async (context, sections) => fixture.access[context.binding.principalRef] === true && sections.every((section) => section.id === "project") && await sources(context, sections.flatMap((section) => section.sourceRefs)),
      revalidate: sources,
      authorizeComments: async (context, values) => values.length === 0 && await fixture.host.revalidate(context),
      authorizeDecision: async (context, values) => values.length === 0 && await fixture.host.revalidate(context),
      authorizeOutcome: async (context, values) => values.length === 0 && await fixture.host.revalidate(context),
      authorizeOutcomeComparison: async (context, values) => values.length === 0 && await fixture.host.revalidate(context),
      authorizeSensitivity: async (context, values) => values.length === 0 && await fixture.host.revalidate(context),
    },
  })
  const humanAuthority = createSfHumanAuthority({ origin: "https://example.test", ui: fixture.ui })
  const closure = createReviewClosurePort({
    state: fixture.state, host: fixture.host, reviews: services.reviews, human: humanAuthority, ui: fixture.ui,
    creationTarget: fixture.creationTarget, operationIdentity: (context) => context.kind === "ui" ? fixture.ui.operationIdentity(context) : undefined,
    handoff: { create: async (intent, context) => {
      const result = await fixture.port.handoff.create(intent, context)
      if (result.status !== "ok") return result
      if (result.value.state !== "created" && result.value.state !== "existing") return { status: "unavailable", reason: "handoff-state-unavailable" }
      return { status: "ok", value: { ...result.value, state: result.value.state } }
    } },
    verifyHandoff: createReviewHandoffVerifier({ host: fixture.host, relations: fixture.port.relations, hotTopics: fixture.port.hotTopics }),
    readAction: fixture.port.hotTopics.read,
  })
  const admission: { fault: "" | "unavailable" | "throw"; calls: number } = { fault: "", calls: 0 }
  const ui = { ...fixture.ui, admit: async (...args: Parameters<typeof fixture.ui.admit>) => {
    const result = await fixture.ui.admit(...args)
    if (result.status !== "ok" || !admission.fault) return result
    fixture.ui.finish(result.value)
    admission.calls += 1
    if (admission.fault === "throw") throw new Error("Injected admission response loss after real admission was closed")
    return { status: "unavailable" as const, reason: "test-review-admission-unavailable" }
  } }
  const http = createReviewHttp({
    origin: "https://example.test", ui, authority: fixture.domainAuthority, reviews: services.reviews,
    threadContext: services.threadContext, closure, humanAuthority, descriptors: services.descriptors,
    human: createReviewHumanPort({ state: fixture.state, reviews: services.reviews, human: humanAuthority, ui: fixture.ui, creationTarget: fixture.creationTarget }),
    download: createReviewDownloadHandler({ authority: fixture.ui, storage: services.artifacts }), maxBodyBytes: 8192,
  })
  const basis = { sourceRef: fixture.basis.sourceRef, sourceIncarnation: fixture.basis.sourceIncarnation, observedVersion: fixture.basis.observedVersion, period: fixture.basis.period, evidenceRefs: fixture.basis.evidenceRefs }
  const pin = fixture.basis.reviewContext!
  const send = async (mode: "review-read" | "review-thread-context" | "review-closure", closureRef?: string) => {
    const url = new URL("https://example.test/product")
    url.searchParams.set("sf", mode)
    if (mode === "review-read") url.searchParams.set("reviewRef", fixture.review.id)
    if (mode === "review-closure") url.searchParams.set("closureRef", closureRef ?? "")
    const request = new Request(url, { method: mode === "review-thread-context" ? "POST" : "GET", headers: { actor: "person", origin: "https://example.test", "content-type": "application/json" }, ...(mode === "review-thread-context" ? { body: JSON.stringify({ reviewRef: fixture.review.id, sectionId: "project", basis }) } : {}) })
    const response = await http(request, "dashboard")
    if (!response) throw new Error("Actual review route was not mounted")
    return { status: response.status, body: await response.json() as Record<string, unknown> }
  }
  return { fixture, services, evidence, admission, basis, pin, send,
    close: async () => {
      const handoff: ReviewActionHandoff = { sourceRef: fixture.source.refId, recipientRef: "person", relationKey: "reports48-review-admission-action", intent: { correlationKey: "reports48-review-admission-action", sourceRefs: [fixture.source], action: "Follow up the preserved review", owner: "Author", due: "2026-12-01", priority: "normal", notes: "" } }
      const request = fixture.request("person")
      const digest = digestSfValue({ reviewRef: fixture.review.id })
      const read = available(await fixture.ui.admit(request, "sf_review_prepare", digest))
      if (!await fixture.ui.validate(read, "sf_review_prepare", digest)) throw new Error("Actual review admission unavailable")
      const action = available(await humanAuthority.admit(request, "collaboration.handoff.confirm", handoff))
      try { return available(await closure.confirm(fixture.review.id, handoff, read, action)).closureRef }
      finally { fixture.ui.finish(read); humanAuthority.finish(action) }
    },
    alterTarget: async (kind: "missing" | "identity") => {
      // Explicit hostile storage lifecycle boundary. No grant is invented and
      // this is not claimed as an authorized operation on immutable C05.
      await fixture.persistence.transaction("dashboard", async (snapshot) => {
        const reviews = object(object(snapshot.data.__sfProductV1).reviews)
        const stored = object(reviews[fixture.review.id])
        if (stored.id !== fixture.review.id) throw new Error("Actual preserved review target unavailable")
        if (kind === "missing") delete reviews[fixture.review.id]
        else reviews[fixture.review.id] = { ...stored, id: `${fixture.review.id}-replacement` }
        return { commit: true, value: undefined }
      })
    },
    dispose: fixture.dispose,
  }
}
