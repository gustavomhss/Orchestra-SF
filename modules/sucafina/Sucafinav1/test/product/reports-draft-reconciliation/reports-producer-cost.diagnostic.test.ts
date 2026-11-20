import { expect, test } from "bun:test"
import { canonicalSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainProjection, PreservedReview } from "../../../product/contracts/context.ts"
import type { ThreadSourceContext } from "../../../product/collaboration/thread-context.ts"
import type { ReviewAgendaCatalog } from "../../../product/reviews/agenda-picker.ts"
import type { ReviewAgendaPreview } from "../../../product/reviews/selection.ts"
import { reviewProjectionEvidence } from "../../../product/reviews/port.ts"
import { sfSourceLifecycleCostDiagnostic } from "../../../product/integration/source-lifecycle.ts"
import { sfLocalStoreCostDiagnostic } from "../../../runtime/local-store.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { createSfExtendedBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/extended-business-services.ts"
import { createSfMemoryServices } from "../../../../../../apps/cli/src/sucafina-product/memory-services.ts"
import { createSfReviewCollaboration, localRecordReview } from "../../../../../../apps/cli/src/sucafina-product/review-collaboration.ts"
import { sfReviewReadCostDiagnostic, snapshotBoundReview } from "../../../../../../apps/cli/src/sucafina-product/review-read-integrity.ts"
import { createSfResidentReviewReaders, sfResidentReviewSnapshotReaders } from "../../../../../../apps/cli/src/sucafina-product/review-resident-readers.ts"
import { reportsCorpus } from "../../../../../../packages/app-shell/e2e/sucafina/reports-support/corpus.ts"
import { financialCompositionFixture } from "../wp10/integration/financial-composition-fixture.ts"

// CI-only observers and experiments. No body/provider is replaced, no grant is
// added, and none of these blobs belongs in an integration tree.
const productSha = "fe2dfe77fe0817b0ae388d74f96d82657ea8af44"

async function measure<Value>(scenario: string, phase: string, work: () => Promise<Value>) {
  sfReviewReadCostDiagnostic.begin()
  sfSourceLifecycleCostDiagnostic.begin()
  sfLocalStoreCostDiagnostic.begin()
  const started = performance.now()
  let completed = false
  try {
    const result = await work()
    completed = true
    return result
  } finally {
    const elapsedMilliseconds = performance.now() - started
    const review = sfReviewReadCostDiagnostic.finish()
    const source = sfSourceLifecycleCostDiagnostic.finish()
    const storage = sfLocalStoreCostDiagnostic.finish()
    // Inclusive spans overlap their child spans. Metrics are counts, times and
    // maximum string units only; no body, entity identifier or authentication data.
    console.info("REPORTS_PRODUCER_COST_DIAGNOSTIC " + JSON.stringify({
      productSha, snapshot: process.env.GITHUB_SHA, scenario, phase, completed, elapsedMilliseconds, review, source, storage,
    }))
  }
}

async function composition() {
  const fixture = await financialCompositionFixture()
  const resident = createSfResidentReviewReaders({ authority: fixture.authority, business: fixture.business })
  const extended = createSfExtendedBusinessServices({ authority: fixture.authority, business: fixture.business,
    persistence: fixture.persistence, ...fixture.guards, origin: "https://example.test", reviewReaders: resident.readers })
  const memory = createSfMemoryServices({ authority: fixture.authority,
    business: { ...fixture.business, planner: extended.portfolioServices.planner }, signalRegistryWrites: new WeakSet<object>() })
  resident.bindOutcome(memory.reviewOutcome)
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
  const preview = async (records?: readonly string[]) => {
    const catalog = await result(await extended.productHttp(new Request("https://example.test/dashboard?" + query), "dashboard")) as ReviewAgendaCatalog
    expect(catalog.options).toHaveLength(3)
    const items = catalog.options.map((option) => records && option.item.kind === "dashboard" && option.item.topic === "projects"
      ? { ...option.item, recordRefs: records } : option.item)
    const prepared = await result(await post("review-agenda", { items })) as ReviewAgendaPreview
    expect(prepared.sections.find((section) => section.title === "Projects")?.recordCount).toBe(records?.length ?? 25)
    return prepared
  }
  const preserve = async (prepared: ReviewAgendaPreview, previousReviewRef?: string) => {
    const saved = await result(await post("review-preserve", { selectionRef: prepared.selectionRef, sectionRefs: prepared.sectionRefs,
      ...(previousReviewRef ? { previousReviewRef } : {}) })) as PreservedReview
    expect(Buffer.byteLength(canonicalSfValue(saved))).toBeGreaterThan(600_000)
    expect(localRecordReview(saved)).toBe(true)
    expect(snapshotBoundReview(saved)).toBe(true)
    expect(sfResidentReviewSnapshotReaders(resident.readers, fixture.authority.host)?.()).toBe(true)
    return saved
  }
  const read = async (saved: PreservedReview) => {
    const query = new URLSearchParams({ sf: "review-read", reviewRef: saved.id })
    const current = await result(await extended.productHttp(new Request("https://example.test/dashboard?" + query), "dashboard"))
    expect(canonicalSfValue(current) === canonicalSfValue(saved)).toBe(true)
  }
  const c05 = async (saved: PreservedReview) => {
    const application = extended.reviews
    if (!application?.readScope) throw new Error("Actual review scope unavailable")
    const collaboration = createSfReviewCollaboration({ authority: fixture.authority, application, evidence: fixture.business.context,
      readerCurrent: sfResidentReviewSnapshotReaders(resident.readers, fixture.authority.host) })
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
      })
    } finally { fixture.authority.ui.finish(call) }
  }
  return { fixture, corpus, preview, preserve, read, c05,
    dispose: async () => { extended.dispose(); await fixture.dispose() } }
}

test("diagnostic separates source and decoder costs with inert snapshot volume", async () => {
  const app = await composition()
  try {
    const saved = await app.preserve(await app.preview())
    await measure("inert-volume", "baseline-read", () => app.read(saved))
    await app.fixture.persistence.transaction("dashboard", async (snapshot) => {
      expect(Object.hasOwn(snapshot.data, "__reportsReadCostDiagnosticVolume")).toBe(false)
      // Synthetic size control only. Never a StoredReport, receipt or grant.
      snapshot.data.__reportsReadCostDiagnosticVolume = "x".repeat(5_700_000)
      return { commit: true, value: undefined }
    })
    await measure("inert-volume", "synthetic-5700000-byte-read", () => app.read(saved))
  } finally { await app.dispose() }
}, 120_000)

test("diagnostic observes real second preservation and C05 without a rendered artifact", async () => {
  const app = await composition()
  try {
    const all = await app.preview()
    const projects = all.sections.find((section) => section.title === "Projects")
    const issuedRecords = all.sectionRecordRefs.find((section) => section.sectionRef === projects?.id)?.recordRefs
    expect(issuedRecords?.length).toBe(25)
    if (!issuedRecords) throw new Error("Actual authorized project records unavailable")
    const retained = issuedRecords.slice(1)
    const first = await app.preserve(await app.preview(retained))
    const forecast = (review: PreservedReview) => review.sections.flatMap((section) => (section.content as DomainProjection).values)
      .find((value) => value.id === app.corpus.forecastField)?.value
    expect(forecast(first)).toBe(app.corpus.before)
    await measure("real-revision", "first-review-read", () => app.read(first))
    await measure("real-revision", "first-review-c05-and-c08-fence", () => app.c05(first))
    // Edit only source fixture data through the canonical guarded persistence.
    // Both C05 bodies/receipts below are produced by real agenda/preserve routes.
    // This diagnoses composition cost; it is not the installed browser witness.
    await app.fixture.persistence.transaction("dashboard", async (snapshot) => {
      const entry = rows(snapshot.data.opexEntries).find((value) => value.id === app.corpus.data.opexEntries[0]!.id)
      if (!entry || typeof entry.forecast !== "number") throw new Error("Actual forecast source record unavailable")
      entry.forecast += app.corpus.after - app.corpus.before
      return { commit: true, value: undefined }
    })
    const nextPreview = await measure("real-revision", "second-agenda-preview", () => app.preview(retained))
    const second = await measure("real-revision", "second-preservation", () => app.preserve(nextPreview, first.id))
    expect(second.id !== first.id).toBe(true)
    expect(second.previousReviewRef === first.id).toBe(true)
    expect(second.sections.find((section) => section.title === "Projects")?.count).toBe(24)
    expect(forecast(second)).toBe(app.corpus.after)
    expect(forecast(first)).toBe(app.corpus.before)
    await measure("real-revision", "prior-review-read-after-second-preservation", () => app.read(first))
    await measure("real-revision", "prior-review-c05-and-c08-fence-after-second-preservation", () => app.c05(first))
  } finally { await app.dispose() }
}, 120_000)
