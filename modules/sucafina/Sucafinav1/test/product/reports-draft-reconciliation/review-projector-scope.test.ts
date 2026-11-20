import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { PreservedReview } from "../../../product/contracts/context.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import type { ReviewAgendaCatalog } from "../../../product/reviews/agenda-picker.ts"
import type { ReviewAgendaPreview } from "../../../product/reviews/selection.ts"
import { object } from "../../../runtime/contract.ts"
import { createSfExtendedBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/extended-business-services.ts"
import { createSfMemoryServices } from "../../../../../../apps/cli/src/sucafina-product/memory-services.ts"
import { localRecordReview } from "../../../../../../apps/cli/src/sucafina-product/review-collaboration.ts"
import { snapshotBoundReview } from "../../../../../../apps/cli/src/sucafina-product/review-read-integrity.ts"
import { createSfResidentReviewReaders, sfResidentReviewSnapshotReaders } from "../../../../../../apps/cli/src/sucafina-product/review-resident-readers.ts"
import { financialCompositionFixture } from "../wp10/integration/financial-composition-fixture.ts"

// This is a negative composition regression, not an installed/browser witness.
// The existing fixture owns the SQLite store, sources, receipt and grants.
// Only the availability of the real projector changes; its function and every
// persistence method retain their identity. No successful domain result is supplied.
test("review scope must not reuse a body after its unchanged source projector becomes unavailable", async () => {
  const fixture = await financialCompositionFixture()
  const projection = { available: true, calls: 0, refused: 0 }
  const realProjector = createSfSourceScopeProjector(() => fixture.clock.at)
  const projectScope: typeof realProjector = (surface, snapshot, scope) => {
    projection.calls += 1
    if (!projection.available) { projection.refused += 1; return undefined }
    return realProjector(surface, snapshot, scope)
  }
  // A real source port over the same store is a supported independent input of
  // the Review composition. The host/business retain their original real port.
  const persistence = createSfSourcePersistence({ persistence: fixture.store, enumerate: enumerateSfSources,
    createId: randomUUID, projectScope })
  const methods = { resolveScopedSource: persistence.resolveScopedSource, readScopedSource: persistence.readScopedSource,
    checkScopedSource: persistence.checkScopedSource }
  const resident = createSfResidentReviewReaders({ authority: fixture.authority, business: fixture.business })
  const extended = createSfExtendedBusinessServices({ authority: fixture.authority, business: fixture.business,
    persistence, ...fixture.guards, origin: "https://example.test", reviewReaders: resident.readers })
  const memory = createSfMemoryServices({ authority: fixture.authority,
    business: { ...fixture.business, planner: extended.portfolioServices.planner }, signalRegistryWrites: new WeakSet<object>() })
  resident.bindOutcome(memory.reviewOutcome)
  try {
    const result = async (response: Response | undefined) => {
      if (!response) throw new Error("Actual Review route unavailable")
      expect(response.status).toBe(200)
      const body = object(await response.json())
      expect(body.status).toBe("ok")
      return body.value
    }
    const post = (mode: string, payload: unknown) => extended.productHttp(new Request("https://example.test/dashboard?sf=" + mode, {
      method: "POST", headers: { origin: "https://example.test", "content-type": "application/json" }, body: JSON.stringify(payload),
    }), "dashboard")
    const query = new URLSearchParams({ sf: "review-agenda", domain: "dashboard", start: "2026-01-01",
      end: "2026-12-31", dashboardTopics: JSON.stringify(["budget"]) })
    const catalog = await result(await extended.productHttp(new Request("https://example.test/dashboard?" + query), "dashboard")) as ReviewAgendaCatalog
    expect(catalog.options).toHaveLength(1)
    const preview = await result(await post("review-agenda", { items: catalog.options.map((option) => option.item) })) as ReviewAgendaPreview
    const saved = await result(await post("review-preserve", { selectionRef: preview.selectionRef, sectionRefs: preview.sectionRefs })) as PreservedReview
    expect(saved.sourceRefs.length).toBeGreaterThan(0)
    expect(localRecordReview(saved)).toBe(true)
    expect(snapshotBoundReview(saved)).toBe(true)
    const application = extended.reviews
    if (!application?.readScope) throw new Error("Actual Review read scope unavailable")
    const readScope = application.readScope
    const sameReaders = sfResidentReviewSnapshotReaders(resident.readers, fixture.authority.host)
    expect(sameReaders?.()).toBe(true)
    const snapshotDigest = () => fixture.persistence.transactionAll!(async (snapshots) => ({ commit: false, value: digestSfValue(snapshots) }))
    const call = await fixture.read()
    const request = fixture.authority.host.requestFor(call)
    if (!request) throw new Error("Original admitted Request unavailable")
    try {
      const observed = await readScope.run(request, async () => {
        const first = await application.reviews.read(saved.id, call)
        expect(first.status).toBe("ok")
        if (first.status !== "ok") throw new Error("Initial actual Review read unavailable")
        expect(digestSfValue(first.value)).toBe(digestSfValue(saved))
        expect(projection.calls).toBeGreaterThan(0)
        const before = await snapshotDigest()
        const previousCalls = projection.calls
        projection.available = false
        expect(sameReaders?.()).toBe(true)
        expect(persistence.resolveScopedSource).toBe(methods.resolveScopedSource)
        expect(persistence.readScopedSource).toBe(methods.readScopedSource)
        expect(persistence.checkScopedSource).toBe(methods.checkScopedSource)
        const repeated = await application.reviews.read(saved.id, call)
        const after = await snapshotDigest()
        expect(after).toBe(before)
        return { status: repeated.status, before, repeatedCalls: projection.calls - previousCalls }
      })
      // Keep even the Request and admitted call identical. Only the closed
      // read scope is replaced, so this control cannot borrow the first proof.
      const previousCalls = projection.calls
      const control = await readScope.run(request, () => application.reviews.read(saved.id, call))
      expect(control.status).toBe("denied")
      expect(projection.calls).toBeGreaterThan(previousCalls)
      expect(projection.refused).toBeGreaterThan(0)
      expect(await snapshotDigest()).toBe(observed.before)
      expect(fixture.authority.host.requestFor(call)).toBe(request)
      expect(sameReaders?.()).toBe(true)
      expect(persistence.resolveScopedSource).toBe(methods.resolveScopedSource)
      expect(persistence.readScopedSource).toBe(methods.readScopedSource)
      expect(persistence.checkScopedSource).toBe(methods.checkScopedSource)
      console.info("REPORTS_PROJECTOR_SCOPE " + JSON.stringify({ firstStatus: "ok", repeatedStatus: observed.status,
        controlStatus: control.status, repeatedProjectorCalls: observed.repeatedCalls, controlProjectorCalls: projection.calls - previousCalls,
        snapshotsUnchanged: true, methodsUnchanged: true, residentGuardCurrent: sameReaders?.() === true }))
      // This negative assertion must fail if the old snapshot-only proof lends
      // its successful body after the actual source producer is unavailable.
      expect(observed.status).toBe("denied")
    } finally { fixture.authority.ui.finish(call) }
  } finally { extended.dispose(); await fixture.dispose() }
}, 120_000)
