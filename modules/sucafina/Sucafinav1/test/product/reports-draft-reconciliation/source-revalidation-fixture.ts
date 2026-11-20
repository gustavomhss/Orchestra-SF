import { expect } from "bun:test"
import type { DomainProjection, PreservedReview } from "../../../product/contracts/context.ts"
import type { ThreadSourceContext } from "../../../product/collaboration/thread-context.ts"
import type { ReviewAgendaCatalog } from "../../../product/reviews/agenda-picker.ts"
import type { ReviewAgendaPreview } from "../../../product/reviews/selection.ts"
import { reviewProjectionEvidence } from "../../../product/reviews/port.ts"
import { createSfExtendedBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/extended-business-services.ts"
import { createSfMemoryServices } from "../../../../../../apps/cli/src/sucafina-product/memory-services.ts"
import { createSfReviewCollaboration } from "../../../../../../apps/cli/src/sucafina-product/review-collaboration.ts"
import { createSfResidentReviewReaders, sfResidentReviewSnapshotReaders } from "../../../../../../apps/cli/src/sucafina-product/review-resident-readers.ts"
import { object } from "../../../runtime/contract.ts"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AbsolutePath } from "@orchestra/core/schema"
import { Location } from "@orchestra/core/location"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import type { SfHumanAction } from "../../../product/integration/human-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfPortfolioServices } from "../../../../../../apps/cli/src/sucafina-product/portfolio-services.ts"

// Dedicated variant of wp10/integration/financial-composition-fixture.ts.
// Authentication, grants, source initialization, real SQLite/C08/Atlas producers
// and cleanup are retained. Only a test-owned source factory input and awaited
// hook can vary; no review, receipt, grant or successful authorization is seeded.
export async function sourceRevalidationFixture(options: { deferAtlasInitialization?: boolean; sources?: (input: Parameters<typeof createSfSourcePersistence>[0]) => Parameters<typeof createSfSourcePersistence>[0]; beforeAuthenticate?: () => Promise<void>; clock?: { at: string }; signal?: AbortSignal; beforeEnvironment?: () => Promise<void>; humanActions?: readonly SfHumanAction[]; atlas?: boolean; commandIdentity?: Parameters<typeof createSfProductAuthority>[0]["commandIdentity"] } = {}) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-financial-composition-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(join(directory, "store"))
  const active = { value: true }
  const clock = options.clock ?? { at: "2026-11-14T00:00:00Z" }
  const at = clock.at
  const originalSources = { persistence: store, enumerate: enumerateSfSources, createId: randomUUID,
    projectScope: createSfSourceScopeProjector(() => clock.at) }
  const sourceInput = options.sources?.(originalSources) ?? originalSources
  const persistence = createSfSourcePersistence(sourceInput)
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "person" }]
    snapshot.data.opexOwners = [{ id: "owner", name: "Operations", budget: 1200 }]
    snapshot.data.opexEntries = []
    snapshot.data.capexProjects = []
    snapshot.data.capexEntries = []
    return { commit: true, value: undefined }
  })
  const guards = { proposalCoverageWrites: new WeakSet<object>(), dashboardHostWrites: new WeakSet<object>(), procurementEvidenceWrites: new WeakSet<object>(),
    caseSelectionWrites: new WeakSet<object>(), threadHistoryWrites: new WeakSet<object>(), analysisSelectionWrites: new WeakSet<object>() }
  const authority = createSfProductAuthority({ installationId: "installation", origin: "https://example.test", policyVersion: "policy", ...guards,
    identity: () => ({ installationId: "installation", hostId: "host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }),
    persistence, grants: [{ principalRef: "person", namespaces: ["cases", "preferences", "bi-artifacts", "reviews", "documents", "threads", "relations", "confirmations", "receipts", "outbox", ...(options.atlas ? ["atlas" as const] : [])],
      operations: ["sf_dashboard_read", "sf_bi_view", "sf_work_list", "sf_review_prepare", "sf_report_prepare", "sf_artifact_get", "sf_portfolio_evaluate", "sf_sensitivity_evaluate", "sf_case_read", "sf_forecast_compare", "sf_scenario_simulate", "sf_scenario_compare"],
      humanActions: ["decisions.prepare-portfolio", "decisions.promote-portfolio", "decisions.prepare-changes", "decisions.choose", "decisions.answer-question", "reviews.preserve", "decisions.coverage", "decisions.criteria", "decisions.promote-alternative", "decisions.select-portfolio", ...options.humanActions ?? []] }],
    createId: randomUUID, now: Date.now, commandIdentity: options.commandIdentity ?? (async (request) => request.headers.get("x-operation") ?? randomUUID()),
    authenticate: async (_request, context) => {
      await options.beforeAuthenticate?.()
      return active.value && context ? { id: "person", canWrite: true, roles: [{ surface: context.surface, role: "admin" }] } : null
    },
    environment: async () => {
      await options.beforeEnvironment?.()
      return { at: clock.at, id: randomUUID, directory: [{ id: "person", name: "Person" }] }
    }, inspectSession: async () => undefined,
    verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: async () => undefined })
  const business = createSfBusinessServices({ authority, persistence, ...guards })
  // Compose the real BCS readers just as the host does. A fixture that omits
  // this stage correctly gets unavailable evidence from every domain reader.
  const initializeAtlas = () => business.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "fixture", manifestVersion: "fixture", skillVersion: "fixture" })
  if (!options.deferAtlasInitialization) initializeAtlas()
  const portfolio = createSfPortfolioServices({ authority, business, ...guards })
  const request = (operation: string = randomUUID()) => new Request("https://example.test/dashboard", { method: "POST", signal: options.signal, headers: { origin: "https://example.test", "x-operation": operation } })
  const read = async () => {
    const source = request()
    const digest = digestSfValue({ selectionRef: "fixture", period: { start: "2026-01-01", end: "2026-12-31" }, sectionRefs: ["budget"] })
    const admitted = await authority.ui.admit(source, "sf_review_prepare", digest)
    if (admitted.status !== "ok" || !await authority.ui.validate(admitted.value, "sf_review_prepare", digest)) throw new Error("Authenticated review context unavailable")
    return admitted.value
  }
  return { directory, store, persistence, sourceInput, active, guards, authority, business, portfolio, request, read, at, clock, initializeAtlas,
    dispose: async () => { portfolio.dispose(); business.dispose(); await store.dispose(); await rm(directory, { recursive: true, force: true }) } }
}

type Fixture = Awaited<ReturnType<typeof sourceRevalidationFixture>>
type Options = Parameters<typeof sourceRevalidationFixture>[0]
type Prepared = Awaited<ReturnType<typeof prepare>>
const period = { start: "2026-01-01", end: "2026-12-31" }

export async function prepare(fixture: Fixture, afterCompose?: () => void) {
  const resident = createSfResidentReviewReaders({ authority: fixture.authority, business: fixture.business })
  const extended = createSfExtendedBusinessServices({ authority: fixture.authority, business: fixture.business,
    persistence: fixture.persistence, ...fixture.guards, origin: "https://example.test", reviewReaders: resident.readers })
  const memory = createSfMemoryServices({ authority: fixture.authority,
    business: { ...fixture.business, planner: extended.portfolioServices.planner }, signalRegistryWrites: new WeakSet<object>() })
  resident.bindOutcome(memory.reviewOutcome)
  try {
    afterCompose?.()
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
    const query = new URLSearchParams({ sf: "review-agenda", domain: "dashboard", start: period.start,
      end: period.end, dashboardTopics: JSON.stringify(["budget"]) })
    const catalog = await result(await extended.productHttp(new Request("https://example.test/dashboard?" + query), "dashboard")) as ReviewAgendaCatalog
    expect(catalog.options).toHaveLength(1)
    const preview = await result(await post("review-agenda", { items: catalog.options.map((option) => option.item) })) as ReviewAgendaPreview
    const saved = await result(await post("review-preserve", { selectionRef: preview.selectionRef, sectionRefs: preview.sectionRefs })) as PreservedReview
    const application = extended.reviews
    if (!application?.readScope) throw new Error("Actual Review scope unavailable")
    const scope = application.readScope
    const call = await fixture.read()
    const request = fixture.authority.host.requestFor(call)
    if (!request) throw new Error("Actual authenticated Request unavailable")
    const section = saved.sections[0]
    if (!section) throw new Error("Actual preserved Budget section unavailable")
    const source = reviewProjectionEvidence(section.content as DomainProjection).find((ref) => ref.kind === "record" &&
      ref.target.period && ref.target.period.start <= section.period.start && ref.target.period.end >= section.period.end)
    if (!source || source.kind !== "record") throw new Error("Actual preserved C17 basis unavailable")
    const basis: ThreadSourceContext = { sourceRef: source.refId, sourceIncarnation: source.target.incarnation,
      observedVersion: source.target.version, period: section.period, evidenceRefs: [source] }
    const collaboration = createSfReviewCollaboration({ authority: fixture.authority, application, evidence: fixture.business.context,
      readerCurrent: sfResidentReviewSnapshotReaders(resident.readers, fixture.authority.host) })
    const snapshots = () => fixture.persistence.transactionAll!(async (current) => ({ commit: false, value: digestSfValue(current) }))
    return { fixture, application, scope, call, request, saved, basis, section, collaboration, resident, extended, snapshots,
      dispose: () => { fixture.authority.ui.finish(call); extended.dispose() } }
  } catch (error) { extended.dispose(); throw error }
}

export async function withReview(options: Options, before: ((fixture: Fixture) => void) | undefined, work: (prepared: Prepared) => Promise<void>) {
  const fixture = await sourceRevalidationFixture(options)
  try {
    before?.(fixture)
    const prepared = await prepare(fixture)
    try { await work(prepared) } finally { prepared.dispose() }
  } finally { await fixture.dispose() }
}

export async function prepareLease(value: Prepared) {
  const pin = await value.application.threadContext.prepare({ reviewRef: value.saved.id, sectionId: value.section.id }, value.basis, value.call)
  expect(pin.status).toBe("ok")
  if (pin.status !== "ok") throw new Error(pin.reason)
  expect(await value.collaboration.authorizeReviewThreadContext(pin.value, value.basis, value.call)).toBe(true)
  const checked = await value.fixture.persistence.transactionAll!(async () => ({ commit: false,
    value: await value.collaboration.authorizeReviewThreadContext(pin.value, value.basis, value.call) }))
  expect(checked).toBe(true)
  return pin.value
}

