import { randomUUID } from "node:crypto"
import { realpath } from "node:fs/promises"
import { tmpdir } from "node:os"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfReviewAgendaHttp, createSfReviewAgendaServices } from "../../../../../../apps/cli/src/sucafina-product/review-agenda-services.ts"
import { createSfReviewHistory } from "../../../../../../apps/cli/src/sucafina-product/review-history.ts"
import { protectSfReviewReads } from "../../../../../../apps/cli/src/sucafina-product/review-read-integrity.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SourceRef } from "../../../product/contracts/context.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createDashboardAgendaSelector } from "../../../product/dashboard/agenda.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createReviewApplication } from "../../../product/reviews/application.ts"
import type { ReviewAgendaDiscoveryQuery } from "../../../product/reviews/agenda-picker.ts"
import { DashboardBudget } from "../../../runtime/dashboard-budget.ts"
import { DashboardPeople } from "../../../runtime/dashboard-people.ts"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { resolve } from "../../../src/identity.ts"
import { available, createRelationsFixture } from "../wp08/relations-fixture.ts"

/** Isolated module proof: real SQLite, C17 producers, authority and C05 storage.
 * Authentication and source corpus are explicit fixtures; this is not installed Reports E2E. */
export async function createFirstAgendaFixture() {
  const f = await createRelationsFixture()
  const control = { memberships: ["admins", "buyers"] }
  for (const surface of ["dashboard", "planner", "procurement"] as const) {
    await f.persistence.transaction(surface, async (snapshot) => {
      snapshot.data.roleMap = [...rows(snapshot.data.roleMap), { surface, role: "viewer", entra: "viewers", version: 1, by: f.person.id }]
      if (surface === "dashboard") {
        snapshot.data.opsTickets = []
        snapshot.data.summaries = ["All Projects", "Portfolio Dashboard", "Hot Topics & Actions", "Executive Dashboard"]
      }
      return { commit: true, value: undefined }
    })
  }
  await f.mutate("dashboard", DashboardBudget.domain, { page: "OPEX Detail", action: "save", version: 0, values: { name: "Agenda budget owner", budget: 1200 } }, "budget-owner")
  await f.mutate("dashboard", DashboardBudget.domain, { page: "OPEX Detail", action: "save-entry", version: 0, values: { ownerId: "budget-owner", year: 2026, month: 1, budget: 100, actual: 80, forecast: 90 } }, "opex-january")
  await f.mutate("dashboard", DashboardBudget.domain, { page: "CAPEX Projects", action: "save-entry", version: 0, values: { projId: "capex", year: 2026, month: 1, budget: 20, actual: 10, forecast: 15 } }, "capex-january")
  await f.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "save", version: 0, values: { name: "Second agenda project", budget: 330, spent: 30, status: "In Progress", risk: "Low", notes: "Exact second record" } }, "project-second")
  await f.mutate("dashboard", DashboardPeople.domain, { page: "Team Structure", action: "saveLeader", version: 0, values: { name: "Selected leader", title: "Lead", domain: "IT" } }, "selected-leader")
  await f.mutate("dashboard", DashboardPeople.domain, { page: "Talent Review", action: "save", version: 0, values: { name: "PRIVATE_AGENDA_TALENT_NAME", title: "PRIVATE_AGENDA_TALENT_TITLE", status: "Active", cls: "Talent", outlook: "Promote", notes: "PRIVATE_AGENDA_TALENT_NOTE" } }, "private-member")
  // Canonical WP07 Planner source corpus. No selection, review or capture is seeded.
  await f.persistence.transaction("planner", async (snapshot) => {
    snapshot.data.versions = [100, 110].map((amount, index) => ({ id: `agenda-v${index}`, name: index ? "Agenda candidate" : "Agenda baseline", year: 2026, closed: 0,
      lines: [{ id: "license", name: "Agenda license", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(amount) }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
    return { commit: true, value: undefined }
  })
  const origin = "https://example.test"
  const location = await realpath(tmpdir())
  const authority = createSfProductAuthority({
    identity: () => ({ installationId: "first-agenda", projectId: "agenda-project", hostId: "isolated-first-agenda", location: Location.Ref.make({ directory: AbsolutePath.make(location) }) }),
    installationId: "first-agenda", origin, policyVersion: "agenda-test-policy", persistence: f.persistence,
    authenticate: async (request, options) => f.gate.active && request.headers.get("actor") === f.person.id && options && f.gate[options.surface]
      ? resolve(f.person.id, [...options.roleMap], (group) => control.memberships.includes(group)) : null,
    environment: f.host.environment,
    grants: [{ principalRef: f.person.id, namespaces: ["reviews"], operations: ["sf_review_prepare", "sf_report_prepare", "sf_artifact_get"], humanActions: ["reviews.preserve"] }],
    createId: randomUUID, now: Date.now,
    commandIdentity: async (request, operation) => request.method === "GET" ? randomUUID()
      : request.headers.has("idempotency-key") ? digestSfValue({ operation, key: request.headers.get("idempotency-key") }) : undefined,
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
    providerGeneration: async () => undefined, authorizeDocument: async () => undefined,
  })
  const business = createSfBusinessServices({ authority, persistence: f.persistence, proposalCoverageWrites: new WeakSet<object>() })
  const discovery = createSfReviewAgendaServices({ authority, business, persistence: f.persistence })
  const historical = createSfReviewHistory({ authority, persistence: f.persistence, authorizeCase: business.authorizeCase,
    evidence: { ...business.context, resolve: async (ref, call) => await discovery.resolveEvidence(ref, call) ?? business.context.resolve(ref, call) } })
  const sources = async (call: TrustedDomainContext, refs: readonly SourceRef[]) => await authority.host.revalidate(call) &&
    (await Promise.all([...new Map(refs.map((ref) => [digestSfValue(ref), ref])).values()].map(async (ref) => await historical.currentSource(ref, call) || await historical.historicalSource(ref, call)))).every(Boolean) &&
    await authority.host.revalidate(call)
  const unavailable = async () => ({ status: "unavailable", reason: "not-selected-in-first-agenda-proof" } as const)
  const app = createReviewApplication({
    state: authority.state, host: authority.host, authority: authority.authority, ui: authority.ui, humanAuthority: authority.human,
    origin, maxBodyBytes: 256 * 1024, creationTarget: authority.creationTarget, operationIdentity: business.operationIdentity,
    requiredAuthority: ["reviews:read"], maxBytes: 8 * 1024 * 1024, now: () => f.clock.at, evidence: historical.evidence,
    ports: { planner: business.plannerProduct.planner, procurement: discovery.procurement,
      selectDashboardAgenda: createDashboardAgendaSelector({ host: authority.host, dashboard: business.dashboard, sources: business.dashboardSources, recordEvidence: business.dashboardRecords }) },
    access: { revalidate: sources, authorizeSections: (call, sections) => sources(call, sections.flatMap((section) => section.sourceRefs)),
      authorizeOutcomeComparison: async (_call, values) => values.length === 0, authorizeOutcome: async (_call, values) => values.length === 0,
      authorizeDecision: async (_call, values) => values.length === 0, authorizeSensitivity: async (_call, values) => values.length === 0 },
    collaboration: { threads: { read: unavailable }, history: { readVersion: unavailable }, authorizeSourceMapping: async () => false, maxMessages: 100 },
  })
  const readScope = protectSfReviewReads({ authority, reviews: app.reviews, localSnapshotReaders: true })
  const discoveryHttp = createSfReviewAgendaHttp({ authority, agenda: discovery, origin })
  const handle = async (incoming: Request) => {
    const headers = new Headers(incoming.headers)
    headers.set("actor", f.person.id)
    const request = new Request(incoming, { headers })
    return await discoveryHttp(request, "dashboard") ?? await readScope.run(request, () => app.http(request, "dashboard")) ?? new Response(null, { status: 404 })
  }
  const request = (mode: string, payload?: unknown, query: Record<string, string> = {}) => handle(new Request(`${origin}/product?${new URLSearchParams({ sf: mode, ...query })}`, payload === undefined
    ? { headers: { origin } }
    : { method: "POST", headers: { origin, "content-type": "application/json", "idempotency-key": randomUUID() }, body: JSON.stringify(payload) }))
  const readCall = async <T>(work: (call: TrustedDomainContext) => Promise<T>) => {
    const request = new Request(`${origin}/product`, { headers: { actor: f.person.id } })
    const digest = digestSfValue({ firstAgenda: true })
    const call = available(await authority.ui.admit(request, "sf_review_prepare", digest))
    try {
      if (!await authority.ui.validate(call, "sf_review_prepare", digest)) throw new Error("First agenda admission did not validate")
      return await work(call)
    } finally { authority.ui.finish(call) }
  }
  const discover = (query: ReviewAgendaDiscoveryQuery) => readCall((call) => discovery.discover(query, call))
  const changeCandidate = (amount = 120) => f.persistence.transaction("planner", async (snapshot) => {
    const candidate = rows(snapshot.data.versions).find((row) => row.id === "agenda-v1")
    if (!candidate) throw new Error("Agenda candidate source missing")
    const license = rows(candidate.lines).find((row) => row.id === "license")
    if (!license) throw new Error("Agenda candidate line missing")
    license.f = Array(12).fill(amount)
    return { commit: true, value: undefined }
  })
  const storedReviews = () => f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: Object.keys(object(object(snapshot.data.__sfProductV1).reviews)) }))
  return { ...f, control, authority, business, discovery, app, handle, request, readCall, discover, changeCandidate, storedReviews,
    dispose: async () => { business.dispose(); await f.dispose() } }
}

export async function responseValue<T>(response: Response): Promise<T> {
  return available(await response.json() as PortResult<T>)
}
