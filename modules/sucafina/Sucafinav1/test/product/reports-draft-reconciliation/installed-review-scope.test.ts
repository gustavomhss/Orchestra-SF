import { expect, test } from "bun:test"
import { canonicalSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainProjection, PreservedReview } from "../../../product/contracts/context.ts"
import type { ThreadSourceContext } from "../../../product/collaboration/thread-context.ts"
import type { ReviewAgendaCatalog } from "../../../product/reviews/agenda-picker.ts"
import type { ReviewAgendaPreview } from "../../../product/reviews/selection.ts"
import { reviewProjectionEvidence } from "../../../product/reviews/port.ts"
import { object } from "../../../runtime/contract.ts"
import { createSfExtendedBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/extended-business-services.ts"
import { createSfReviewCollaboration, localRecordReview } from "../../../../../../apps/cli/src/sucafina-product/review-collaboration.ts"
import { snapshotBoundReview } from "../../../../../../apps/cli/src/sucafina-product/review-read-integrity.ts"
import { reportsCorpus } from "../../../../../../packages/app-shell/e2e/sucafina/reports-support/corpus.ts"
import { createSfResidentReviewReaders, sfResidentReviewSnapshotReaders } from "../../../../../../apps/cli/src/sucafina-product/review-resident-readers.ts"
import { createSfMemoryServices } from "../../../../../../apps/cli/src/sucafina-product/memory-services.ts"
import { createSfReviewServices } from "../../../../../../apps/cli/src/sucafina-product/review-services.ts"
import type { SfReviewReaders } from "../../../../../../apps/cli/src/sucafina-product/review-services.ts"
import { financialCompositionFixture } from "../wp10/integration/financial-composition-fixture.ts"

function structure(value: unknown) {
  let nodes = 0, depth = 0
  const records: Record<string, unknown>[] = []
  const visit = (value: unknown, level = 0) => {
    nodes += 1
    depth = Math.max(depth, level)
    if (!value || typeof value !== "object") return
    const item = object(value)
    if (item.schema === "sf-evidence-v1" && item.kind === "record") records.push(item)
    Object.values(value).forEach((child) => visit(child, level + 1))
  }
  visit(value)
  return { nodes, depth, records }
}

function expectScope(review: PreservedReview, allowed: boolean) {
  expect(localRecordReview(review)).toBe(allowed)
  expect(snapshotBoundReview(review)).toBe(allowed)
}

/** The full corpus is produced through the real product composition's
 * agenda/C05/C08. Its fixture owns authentication and grants; no grant is added.
 * The packaged/native installation is witnessed by the Reports browser gate.
 * Malformed copies below exercise structural classification only, never a
 * successful source reader or an authorization result supplied by the test.
 */
for (const withResident of [false, true]) test(`Reports composition resident=${withResident} handles repeated evidence and keeps authority fences`, async () => {
  const hooks: { environment?: () => void } = {}
  const fixture = await financialCompositionFixture({ beforeEnvironment: async () => { hooks.environment?.() } })
  const counted = { reviews: 0 }
  const readState = fixture.authority.state.read
  fixture.authority.state.read = async (request, namespace, inspect) => {
    if (namespace === "reviews") counted.reviews += 1
    return readState(request, namespace, inspect)
  }
  const resident = withResident ? createSfResidentReviewReaders({ authority: fixture.authority, business: fixture.business }) : undefined
  const extended = createSfExtendedBusinessServices({ authority: fixture.authority, business: fixture.business,
    persistence: fixture.persistence, ...fixture.guards, origin: "https://example.test",
    ...(resident ? { reviewReaders: resident.readers } : {}) })
  const memory = resident ? createSfMemoryServices({ authority: fixture.authority,
    business: { ...fixture.business, planner: extended.portfolioServices.planner }, signalRegistryWrites: new WeakSet<object>() }) : undefined
  if (resident && memory) resident.bindOutcome(memory.reviewOutcome)
  try {
    const corpus = reportsCorpus(fixture.at.slice(0, 10))
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      Object.assign(snapshot.data, corpus.data)
      return { commit: true, value: undefined }
    })
    const result = async (response: Response | undefined) => {
      if (!response) throw new Error("Actual Reports route unavailable")
      expect(response.status).toBe(200)
      const body = object(await response.json())
      expect(body.status).toBe("ok")
      return body.value
    }
    const post = (mode: string, payload: unknown) => extended.productHttp(new Request("https://example.test/dashboard?sf=" + mode, {
      method: "POST", headers: { origin: "https://example.test", "content-type": "application/json" }, body: JSON.stringify(payload),
    }), "dashboard")
    const query = new URLSearchParams({ sf: "review-agenda", domain: "dashboard", start: corpus.annual.start,
      end: corpus.annual.end, dashboardTopics: JSON.stringify(["budget", "projects", "hot-topics"]) })
    const catalog = await result(await extended.productHttp(new Request("https://example.test/dashboard?" + query), "dashboard")) as ReviewAgendaCatalog
    expect(catalog.options).toHaveLength(3)
    const preview = await result(await post("review-agenda", { items: catalog.options.map((option) => option.item) })) as ReviewAgendaPreview
    expect(preview.sections.find((section) => section.title === "Projects")?.recordCount).toBe(25)
    const saved = await result(await post("review-preserve", { selectionRef: preview.selectionRef, sectionRefs: preview.sectionRefs })) as PreservedReview
    const readQuery = new URLSearchParams({ sf: "review-read", reviewRef: saved.id })
    expect(await result(await extended.productHttp(new Request("https://example.test/dashboard?" + readQuery), "dashboard"))).toEqual(saved)
    const observed = structure(saved)
    expect(observed.nodes).toBeGreaterThan(20_000)
    expect(observed.depth).toBeLessThan(24)
    expect(observed.records.length).toBeGreaterThan(900)
    expectScope(saved, true)

    const original = observed.records[0]!
    const repeated = (review: PreservedReview) => {
      const records = structure(review).records
      const canonical = canonicalSfValue(records[0])
      const duplicate = records.slice(1).find((ref) => canonicalSfValue(ref) === canonical)
      if (!duplicate) throw new Error("The real Reports graph must contain duplicate exact evidence")
      return duplicate
    }
    for (const unsupported of [
      { reviewOutcome: {} }, { reviewOutcomeComparison: {} }, { reviewCommentRefs: [{}] },
      { decision: { kind: "scenario" } }, { reviewChart: { sensitivity: {} } },
      { schema: "sf-evidence-v1", kind: "document", target: {} },
    ]) {
      const altered = structuredClone(saved)
      const duplicate = repeated(altered)
      expect(duplicate.refId).toBe(original.refId)
      expect(duplicate.refDigest).toBe(original.refDigest)
      // Same claimed identity, different complete body. A prior valid copy
      // must not hide a nested dependency requiring another producer's lease.
      object(duplicate.target).unrecognized = unsupported
      expectScope(altered, false)
    }

    const deeper = structuredClone(saved)
    let nested: unknown = structuredClone(original)
    for (let level = 1; level < 22; level++) nested = { next: nested }
    object(deeper).lateEvidence = nested
    // The evidence itself is at depth 22; its target fields cross 24. A hit
    // from its earlier shallower placement may not bypass the subtree limit.
    expect(structure(deeper).depth).toBeGreaterThan(24)
    expectScope(deeper, false)

    const excessive = structuredClone(saved)
    object(excessive).lateEvidence = Array(20_001).fill(original)
    expectScope(excessive, false) // Identical occurrences still spend budget.

    const later = structuredClone(saved)
    expectScope(later, true)
    object(repeated(later).target).unrecognized = { reviewOutcome: {} }
    expectScope(later, false) // A previous invocation supplies no structural grant.
    expectScope(saved, true)

    const application = extended.reviews
    if (!application?.readScope) throw new Error("Actual installed review scope unavailable")
    const collaboration = createSfReviewCollaboration({ authority: fixture.authority,
      application, evidence: fixture.business.context,
      readerCurrent: sfResidentReviewSnapshotReaders(resident?.readers, fixture.authority.host) })
    const call = await fixture.read()
    try {
      const request = fixture.authority.host.requestFor(call)
      if (!request) throw new Error("Actual authenticated C05 Request unavailable")
      const section = saved.sections.find((section) => section.title === "Budget")
      if (!section) throw new Error("Actual preserved budget section unavailable")
      const source = reviewProjectionEvidence(section.content as DomainProjection).find((ref) => ref.kind === "record" &&
        ref.target.period && ref.target.period.start <= section.period.start && ref.target.period.end >= section.period.end)
      if (!source || source.kind !== "record") throw new Error("Actual annual C17 review basis unavailable")
      const basis: ThreadSourceContext = { sourceRef: source.refId, sourceIncarnation: source.target.incarnation,
        observedVersion: source.target.version, period: section.period, evidenceRefs: [source] }
      await application.readScope.run(request, async () => {
        const prepared = await application.threadContext.prepare({ reviewRef: saved.id, sectionId: section.id }, basis, call)
        expect(prepared.status).toBe("ok")
        if (prepared.status !== "ok") throw new Error(prepared.reason)
        expect(await collaboration.authorizeReviewThreadContext(prepared.value, basis, call)).toBe(true)
        const atCommit = await fixture.persistence.transactionAll!(async () => ({ commit: false,
          value: await collaboration.authorizeReviewThreadContext(prepared.value, basis, call) }))
        expect(atCommit).toBe(true)
        if (resident && memory) {
          const recognition = sfResidentReviewSnapshotReaders(resident.readers, fixture.authority.host)
          expect(recognition?.()).toBe(true)
          const reopened = async () => {
            counted.reviews = 0
            expect(await application.reviews.read(saved.id, call)).toEqual({ status: "ok", value: saved })
            return counted.reviews
          }
          await reopened()
          expect(await reopened()).toBe(1) // One fresh C08 proof; no second producer materialization.

          const outcome = resident.readers.outcome!
          const alternatives: SfReviewReaders[] = [
            { ...resident.readers },
            { ...resident.readers, outcome: { read: outcome.read,
              authorize: (...args) => outcome.authorize(...args) } },
          ]
          for (const readers of alternatives) {
            expect(sfResidentReviewSnapshotReaders(readers, fixture.authority.host)).toBeUndefined()
            const other = createSfReviewServices({ authority: fixture.authority, business: fixture.business,
              portfolio: extended.portfolioServices, bi: extended.bi, persistence: fixture.persistence,
              origin: "https://example.test", readers }).application
            if (!other?.readScope) throw new Error("Actual custom-reader composition unavailable")
            counted.reviews = 0
            expect(await other.readScope.run(request, () => other.reviews.read(saved.id, call)))
              .toEqual({ status: "ok", value: saved })
            expect(counted.reviews).toBeGreaterThan(1)
          }

          const ownerInput: Parameters<typeof createSfReviewServices>[0] = { authority: fixture.authority,
            business: fixture.business, portfolio: extended.portfolioServices, bi: extended.bi,
            persistence: fixture.persistence, origin: "https://example.test", readers: resident.readers }
          const ownerServices = createSfReviewServices(ownerInput), ownerApplication = ownerServices.application
          if (!ownerApplication?.readScope) throw new Error("Actual reader-owner composition unavailable")
          await ownerApplication.readScope.run(request, async () => {
            expect(await ownerApplication.reviews.read(saved.id, call)).toEqual({ status: "ok", value: saved })
            counted.reviews = 0
            expect(await ownerApplication.reviews.read(saved.id, call)).toEqual({ status: "ok", value: saved })
            expect(counted.reviews).toBe(1)
            ownerInput.readers = { ...resident.readers, historicalSource: async () => false }
            expect(ownerServices.residentSnapshotReaders?.()).toBe(false)
            counted.reviews = 0
            expect(await ownerApplication.reviews.read(saved.id, call)).toEqual({ status: "ok", value: saved })
            expect(counted.reviews).toBeGreaterThan(1)
          })

          // New fields and wrapped methods invalidate factory recognition even
          // when the wrapper delegates to the unchanged real producer.
          resident.readers.historicalSource = async () => false
          try {
            expect(recognition?.()).toBe(false)
            expect(await reopened()).toBeGreaterThan(1)
          } finally { delete resident.readers.historicalSource }
          const readOutcome = memory.reviewOutcome.read
          memory.reviewOutcome.read = (...args) => readOutcome(...args)
          try {
            expect(recognition?.()).toBe(false)
            expect(await reopened()).toBeGreaterThan(1)
          } finally { memory.reviewOutcome.read = readOutcome }
          const readDescriptor = Object.getOwnPropertyDescriptor(memory.reviewOutcome, "read")!
          let reads = 0
          Object.defineProperty(memory.reviewOutcome, "read", { configurable: true, enumerable: true,
            get: () => { reads++; return readOutcome } })
          try {
            expect(recognition?.()).toBe(false)
            expect(reads).toBe(0)
          } finally { Object.defineProperty(memory.reviewOutcome, "read", readDescriptor) }

          const refused: number[] = []
          resident.bindOutcome({ read: readOutcome, authorize: async (_context, observations) => {
            refused.push(observations.length)
            return false
          } })
          try {
            expect(recognition?.()).toBe(false)
            const denied = await application.reviews.read(saved.id, call)
            expect(denied.status).toBe("denied")
            expect(denied).not.toHaveProperty("value")
            expect(refused).toContain(0) // Preserve a custom provider's empty-list refusal.
          } finally { resident.bindOutcome(memory.reviewOutcome) }

          await reopened()
          const authorizeOutcome = memory.reviewOutcome.authorize
          hooks.environment = () => {
            hooks.environment = undefined
            memory.reviewOutcome.authorize = async () => false
          }
          try {
            const interrupted = await application.reviews.read(saved.id, call)
            expect(interrupted.status).toBe("denied")
            expect(interrupted).not.toHaveProperty("value")
            expect(recognition?.()).toBe(false)
            const changedLease = await fixture.persistence.transactionAll!(async () => ({ commit: false,
              value: await collaboration.authorizeReviewThreadContext(prepared.value, basis, call) }))
            expect(changedLease).toBe(false)
          } finally {
            hooks.environment = undefined
            memory.reviewOutcome.authorize = authorizeOutcome
          }
          expect(recognition?.()).toBe(true)
          expect(await application.reviews.read(saved.id, call)).toEqual({ status: "ok", value: saved })
        }
        fixture.active.value = false
        expect(await collaboration.authorizeReviewThreadContext(prepared.value, basis, call)).toBe(false)
      })
    } finally { fixture.authority.ui.finish(call) }
  } finally { extended.dispose(); await fixture.dispose() }
}, 120_000)
