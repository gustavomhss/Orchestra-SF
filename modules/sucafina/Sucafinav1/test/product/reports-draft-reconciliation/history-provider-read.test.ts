import { expect, test } from "bun:test"
import { createSfReviewHistory } from "../../../../../../apps/cli/src/sucafina-product/review-history.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SourceRef } from "../../../product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { SfProductStatePort } from "../../../product/contracts/state.ts"
import { createReviewServices } from "../../../product/reviews/services.ts"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { object } from "../../../runtime/contract.ts"
import { createReviewAnswersFixture } from "../wp08/review-answers-fixture.ts"

/** Installed history implementation over the fixture's actual C05/C08 receipt,
 * SQLite, scoped-source provider and authenticated contexts. Actor/ACL grants
 * remain the existing fixture boundary; this is not a native host witness.
 */
async function createHistoryFixture() {
  const fixture = await createReviewAnswersFixture()
  const source = fixture.review.sourceRefs.find((ref) => ref.incarnation === fixture.source.target.incarnation)
  if (!source || fixture.review.sourceRefs.length !== 1) throw new Error("Actual captured source is required")
  const captured = await fixture.state.read(fixture.request("person"), "reviews", (state) => Object.values(state.transactions).filter((entry) => {
    const value = object(entry.value)
    return entry.namespace === "reviews" && entry.principalRef === fixture.author.binding.principalRef && entry.targetRef === fixture.creationTarget.ref && entry.targetIncarnation === fixture.creationTarget.incarnation && value.schema === "sf-review-receipt-v1" && value.reviewRef === fixture.review.id && value.reviewDigest === digestSfValue(fixture.review)
  }))
  if (captured.status !== "ok") throw new Error("Actual durable C05 receipt unavailable")
  expect(captured.value).toHaveLength(1)
  const io = { armed: false, captures: 0 }
  const state: typeof fixture.state = { ...fixture.state, read: async (request, namespace, inspect) => {
    const result = await fixture.state.read(request, namespace, inspect)
    if (io.armed && namespace === "reviews" && ++io.captures === 2) {
      io.armed = false
      return { status: "unavailable", reason: "test-history-c08-read-unavailable" }
    }
    return result
  } }
  const drift: { armed: boolean; nextStatus: string; versions: number[] } = { armed: false, nextStatus: "On Hold", versions: [] }
  const changeStatus = async (status: string) => {
    const before = await fixture.snapshots()
    await fixture.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "save", id: "project", version: before.dashboard.versions["projects:project"]!.version, values: { status } })
  }
  const persistence = { ...fixture.persistence, resolveScopedSource: async (...args: Parameters<typeof fixture.persistence.resolveScopedSource>) => {
    const result = await fixture.persistence.resolveScopedSource(...args)
    if (drift.armed && args[0] === source.surface && args[1] === source.incarnation) {
      if (!result) throw new Error("The authorized scoped read must succeed before injecting content drift")
      drift.versions.push(result.version)
      if (drift.versions.length === 1) await changeStatus(drift.nextStatus)
      if (drift.versions.length === 2) drift.armed = false
    }
    return result
  } }
  const history = createSfReviewHistory({ authority: { host: fixture.host, state, creationTarget: fixture.creationTarget }, persistence, evidence: fixture.evidence })
  const sources = async (context: TrustedDomainContext, refs: readonly SourceRef[]) => {
    if (!await fixture.host.revalidate(context)) return false
    const values = await Promise.all(refs.map((ref) => history.historicalSource(ref, context)))
    return values.every(Boolean) && await fixture.host.revalidate(context)
  }
  const services = createReviewServices({
    state: fixture.state, host: fixture.host, authority: fixture.domainAuthority, evidence: history.evidence,
    creationTarget: fixture.creationTarget, operationIdentity: (context) => context.kind === "ui" ? fixture.ui.operationIdentity(context) : undefined,
    requiredAuthority: [], maxBytes: 5_000_000, now: () => "2026-11-13T00:00:00Z",
    selection: {
      select: async (_selection, ids, context) => {
        if (ids.length !== 1 || ids[0] !== "project" || !fixture.access[context.binding.principalRef]) return { status: "denied", reason: "fixture-review-selection-denied" }
        const projection = await fixture.records.read(fixture.source.refId, context)
        return projection.status === "ok" ? { status: "ok", value: [{ id: "project", title: "Preserved project answer", period: fixture.period, recordCount: 1, projection: projection.value }] } : projection
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
  return { fixture, source, history, services, io, drift, receipt: captured.value, dispose: fixture.dispose }
}

test("installed history C08 capture unavailability remains unknown and the real C05 reader normalizes it", async () => {
  const f = await createHistoryFixture()
  try {
    expect(await f.history.historicalSource(f.source, f.fixture.author)).toBe(true)
    f.io.armed = true
    await expect(f.history.historicalSource(f.source, f.fixture.author)).rejects.toThrow("REVIEW_HISTORY_READ_UNAVAILABLE")
    expect(f.io.captures).toBe(2)
    expect(await f.history.historicalSource(f.source, f.fixture.author)).toBe(true)
    f.io.captures = 0; f.io.armed = true
    const unknown = await f.services.reviews.read(f.fixture.review.id, f.fixture.author)
    expect(unknown).toEqual({ status: "unavailable", reason: "review-read-unavailable" })
    expect(f.io.captures).toBe(2)
    expect(await f.services.reviews.read(f.fixture.review.id, f.fixture.author)).toEqual({ status: "ok", value: f.fixture.review })
  } finally { await f.dispose() }
}, 120000)

test("installed history two authorized scoped reads with legitimate source drift require reconciliation", async () => {
  const f = await createHistoryFixture()
  try {
    expect(await f.history.historicalSource(f.source, f.fixture.author)).toBe(true)
    f.drift.armed = true
    await expect(f.history.historicalSource(f.source, f.fixture.author)).rejects.toThrow("REVIEW_HISTORY_CHANGED")
    expect(f.drift.versions).toHaveLength(2)
    expect(f.drift.versions[1]!).toBeGreaterThan(f.drift.versions[0]!)
    expect(await f.fixture.host.revalidate(f.fixture.author)).toBe(true)
    expect(await f.history.historicalSource(f.source, f.fixture.author)).toBe(true)
    f.drift.versions.length = 0; f.drift.nextStatus = "Completed"; f.drift.armed = true
    const unknown = await f.services.reviews.read(f.fixture.review.id, f.fixture.author)
    expect(unknown).toEqual({ status: "unavailable", reason: "review-read-unavailable" })
    expect(f.drift.versions).toHaveLength(2)
    expect(f.drift.versions[1]!).toBeGreaterThan(f.drift.versions[0]!)
    expect(await f.fixture.host.revalidate(f.fixture.author)).toBe(true)
    expect(await f.services.reviews.read(f.fixture.review.id, f.fixture.author)).toEqual({ status: "ok", value: f.fixture.review })
  } finally { await f.dispose() }
}, 120000)

test("installed history actual actor revocation remains an explicit refusal", async () => {
  const f = await createHistoryFixture()
  try {
    expect(await f.history.historicalSource(f.source, f.fixture.author)).toBe(true)
    f.fixture.actors.person!.enabled = false
    expect(await f.history.historicalSource(f.source, f.fixture.author)).toBe(false)
    const denied = await f.services.reviews.read(f.fixture.review.id, f.fixture.author)
    expect(denied.status).toBe("denied")
    expect(denied).not.toHaveProperty("value")
  } finally { await f.dispose() }
}, 120000)

test("installed history refuses a disappeared C05 target despite the original durable receipt", async () => {
  const f = await createHistoryFixture()
  try {
    expect(await f.history.historicalSource(f.source, f.fixture.author)).toBe(true)
    // Explicit storage lifecycle fault, not an authorized mutation of C05.
    await f.fixture.persistence.transaction("dashboard", async (snapshot) => {
      delete object(object(snapshot.data.__sfProductV1).reviews)[f.fixture.review.id]
      return { commit: true, value: undefined }
    })
    const receipt = await f.fixture.state.read(f.fixture.request("person"), "reviews", (state) => Object.values(state.transactions).filter((entry) => object(entry.value).reviewRef === f.fixture.review.id))
    if (receipt.status !== "ok") throw new Error("Durable original receipt unavailable")
    expect(receipt.value).toEqual(f.receipt)
    expect(await f.fixture.host.revalidate(f.fixture.author)).toBe(true)
    expect(await f.history.historicalSource(f.source, f.fixture.author)).toBe(false)
    expect(await f.services.reviews.read(f.fixture.review.id, f.fixture.author)).toEqual({ status: "denied", reason: "review-target-changed" })
  } finally { await f.dispose() }
}, 120000)
