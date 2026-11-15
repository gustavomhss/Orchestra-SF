import { randomUUID, createHash } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import JSZip from "jszip"
import { SaxesParser } from "saxes"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfReviewAgendaHttp, createSfReviewAgendaServices } from "../../../../../../apps/cli/src/sucafina-product/review-agenda-services.ts"
import { createSfReviewHistory } from "../../../../../../apps/cli/src/sucafina-product/review-history.ts"
import { protectSfReviewReads } from "../../../../../../apps/cli/src/sucafina-product/review-read-integrity.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { PreservedReview, SourceRef } from "../../../product/contracts/context.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createDashboardAgendaSelector } from "../../../product/dashboard/agenda.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createReviewApplication } from "../../../product/reviews/application.ts"
import type { ReviewAgendaCatalog } from "../../../product/reviews/agenda-picker.ts"
import type { ReviewAgendaPreview } from "../../../product/reviews/selection.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { DashboardPeople } from "../../../runtime/dashboard-people.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"

export function available<T>(result: PortResult<T>): T {
  if (result.status !== "ok") throw new Error(`${result.status}: ${result.reason}`)
  return result.value
}

/** Synthetic identities and source corpus; actual SQLite/C08, source producers,
 * product authority, UI leases, human admission, review services and HTTP handlers.
 * No native provider, cast authority or preconstructed review supplies this proof. */
export async function createExportArtifactFixture(options: { maxBytes?: number } = {}) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-export-artifact-66-"))
  await chmod(directory, 0o700)
  const resources = { store: await openLocalStore(directory) }
  if (!resources.store.transactionAll) throw new Error("Export proof requires real SQLite transactionAll")
  const clock = { at: "2026-11-13T04:01:10Z" }
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const origin = "https://export-artifact.example.test"
  const maxBytes = options.maxBytes ?? 1024 * 1024
  const owner = "synthetic-export-owner"
  const sessions: Record<string, { principal: string; memberships: string[]; active: boolean; expiresAt: number }> = {
    owner: { principal: owner, memberships: ["admins"], active: true, expiresAt: Infinity },
    foreign: { principal: "synthetic-export-foreign", memberships: ["admins"], active: true, expiresAt: Infinity },
    viewer: { principal: "synthetic-export-viewer", memberships: ["viewers"], active: true, expiresAt: Infinity },
    ungranted: { principal: "synthetic-export-ungranted", memberships: ["admins"], active: true, expiresAt: Infinity },
  }
  const persistence = createSfSourcePersistence({ persistence: {
    transaction: (surface, work, options) => resources.store.transaction(surface, work, options),
    transactionAll: (work, options) => resources.store.transactionAll!(work, options),
    currentSnapshots: () => resources.store.currentSnapshots?.(),
  }, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => clock.at) })
  for (const surface of ["dashboard", "planner", "procurement"] as const) {
    await persistence.initializeSources(surface)
    await persistence.transaction(surface, async (snapshot) => {
      snapshot.data.roleMap = [
        { surface, role: "admin", entra: "admins", version: 1, by: owner },
        { surface, role: "viewer", entra: "viewers", version: 1, by: owner },
      ]
      snapshot.data.access = Object.fromEntries(Object.values(sessions).map((session) => [session.principal, { assigned: [], domains: [] }]))
      if (surface === "dashboard") snapshot.data.summaries = ["All Projects", "Portfolio Dashboard"]
      return { commit: true, value: undefined }
    })
  }
  const note = "Café, ação e e\u0301; literal <scope> & evidence. " + "Complete source note. ".repeat(12) + "END-EXPORT-66-NOTE"
  const actor = { id: owner, roles: ["admin"], canWrite: true }
  const environment = (id = randomUUID()) => ({ at: clock.at, id: () => id, directory: [{ id: owner, name: "Synthetic export owner" }] })
  await persistence.transaction("dashboard", async (snapshot) => {
    const project = DashboardPortfolio.domain.execute(snapshot, actor, { page: "All Projects", action: "save", version: 0,
      values: { name: "Export66 source project", budget: 1250, spent: 320, status: "In Progress", risk: "Low", notes: note } }, environment("export66-project"))
    const privateRow = DashboardPeople.domain.execute(snapshot, actor, { page: "Talent Review", action: "save", version: 0,
      values: { name: "SYNTHETIC_UNSELECTED_PRIVATE_66", title: "Private fixture", status: "Active", cls: "Talent", outlook: "Promote", notes: "SYNTHETIC_UNSELECTED_PRIVATE_66_NOTE" } }, environment("export66-private"))
    if (!project.ok || !privateRow.ok) throw new Error("Canonical export source seed rejected")
    return { commit: true, value: undefined }
  })
  // Canonical Planner input data, never a fabricated projection or preserved review.
  await persistence.transaction("planner", async (snapshot) => {
    snapshot.data.versions = [100, 110].map((amount, index) => ({ id: `export66-v${index}`, name: index ? "Export66 candidate" : "Export66 baseline", year: 2026, closed: 0,
      lines: [{ id: "license", name: "Export66 license", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(amount) }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
    return { commit: true, value: undefined }
  })
  const authority = createSfProductAuthority({
    identity: () => ({ installationId: "export66-installation", projectId: "export66-project", hostId: "export66-isolated-host", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }),
    installationId: "export66-installation", origin, policyVersion: "export66-fixture-policy-v1", persistence,
    authenticate: async (request, options) => {
      const session = sessions[request.headers.get("x-export-fixture-session") ?? ""]
      if (!session?.active || !options || Date.parse(clock.at) >= session.expiresAt || request.signal.aborted) return null
      return resolve(session.principal, [...options.roleMap], (group) => session.memberships.includes(group))
    },
    environment: async () => environment(),
    grants: ["owner", "foreign", "viewer"].map((key) => ({ principalRef: sessions[key]!.principal,
      namespaces: ["reviews", "documents"] as const, operations: ["sf_review_prepare", "sf_report_prepare", "sf_artifact_get"], humanActions: ["reviews.preserve"] as const })),
    createId: randomUUID, now: () => Date.parse(clock.at),
    commandIdentity: async (request, operation) => request.method === "GET" ? randomUUID()
      : request.headers.has("idempotency-key") ? digestSfValue({ operation, key: request.headers.get("idempotency-key") }) : undefined,
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
    providerGeneration: async () => undefined, authorizeDocument: async () => undefined,
  })
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: new WeakSet<object>() })
  business.initializeAtlas(undefined, { boundaryVersion: "export66-fixture-boundary", schemaVersion: "export66-fixture-schema",
    manifestVersion: "export66-fixture-manifest", skillVersion: "export66-fixture-skill" })
  const discovery = createSfReviewAgendaServices({ authority, business, persistence })
  const historical = createSfReviewHistory({ authority, persistence, authorizeCase: business.authorizeCase,
    evidence: { ...business.context, resolve: async (ref, call) => await discovery.resolveEvidence(ref, call) ?? business.context.resolve(ref, call) } })
  const sources = async (call: TrustedDomainContext, refs: readonly SourceRef[]) => {
    if (!await authority.host.revalidate(call)) return false
    const checked = await Promise.all([...new Map(refs.map((ref) => [digestSfValue(ref), ref])).values()]
      .map(async (ref) => await historical.currentSource(ref, call) || await historical.historicalSource(ref, call)))
    return checked.every(Boolean) && await authority.host.revalidate(call)
  }
  const unavailable = async () => ({ status: "unavailable", reason: "not-selected-in-export66-proof" } as const)
  const app = createReviewApplication({
    state: authority.state, host: authority.host, authority: authority.authority, ui: authority.ui, humanAuthority: authority.human,
    origin, maxBodyBytes: 256 * 1024, creationTarget: authority.creationTarget, operationIdentity: business.operationIdentity,
    requiredAuthority: ["reviews:read"], maxBytes, now: () => clock.at, evidence: historical.evidence,
    ports: { planner: business.plannerProduct.planner, procurement: discovery.procurement,
      selectDashboardAgenda: createDashboardAgendaSelector({ host: authority.host, dashboard: business.dashboard, sources: business.dashboardSources, recordEvidence: business.dashboardRecords }) },
    access: { revalidate: sources, authorizeSections: (call, sections) => sources(call, sections.flatMap((section) => section.sourceRefs)),
      authorizeOutcomeComparison: async (_call, values) => values.length === 0, authorizeOutcome: async (_call, values) => values.length === 0,
      authorizeDecision: async (_call, values) => values.length === 0, authorizeSensitivity: async (_call, values) => values.length === 0 },
    collaboration: { threads: { read: unavailable }, history: { readVersion: unavailable }, authorizeSourceMapping: async () => false, maxMessages: 100 },
  })
  const readScope = protectSfReviewReads({ authority, reviews: app.reviews, localSnapshotReaders: true })
  const discoveryHttp = createSfReviewAgendaHttp({ authority, agenda: discovery, origin })
  const handle = async (request: Request) => await discoveryHttp(request, "dashboard")
    ?? await readScope.run(request, () => app.http(request, "dashboard")) ?? new Response(null, { status: 404 })
  const incoming = (mode: string, options: { payload?: unknown; query?: Record<string, string>; session?: string; key?: string; method?: string; signal?: AbortSignal } = {}) => new Request(
    `${origin}/product?${new URLSearchParams({ sf: mode, ...options.query })}`,
    { method: options.method ?? (options.payload === undefined ? "GET" : "POST"),
      headers: { origin, "x-export-fixture-session": options.session ?? "owner", ...(options.payload === undefined ? {} : { "content-type": "application/json", "idempotency-key": options.key ?? randomUUID() }) },
      ...(options.payload === undefined ? {} : { body: JSON.stringify(options.payload) }), ...(options.signal ? { signal: options.signal } : {}) })
  const request = (mode: string, options: Parameters<typeof incoming>[1] = {}) => handle(incoming(mode, options))
  const withCall = async <T>(operation: string, payload: unknown, work: (call: TrustedDomainContext) => Promise<T>, options: { key?: string; session?: string } = {}) => {
    const req = incoming("review-report", { payload, ...options })
    const digest = digestSfValue(payload)
    const admitted = available(await authority.ui.admit(req, operation, digest))
    try {
      if (!await authority.ui.validate(admitted, operation, digest)) throw new Error("Export proof UI lease did not validate")
      return await readScope.run(req, () => work(admitted))
    } finally { authority.ui.finish(admitted) }
  }
  const preserve = async () => {
    const dashboard = available(await (await request("review-agenda", { query: { start: period.start, end: period.end, domain: "dashboard" } })).json() as PortResult<ReviewAgendaCatalog>)
    const planner = available(await (await request("review-agenda", { query: { start: period.start, end: period.end, domain: "planner" } })).json() as PortResult<ReviewAgendaCatalog>)
    const project = dashboard.options.find((option) => option.item.kind === "dashboard" && option.item.topic === "all-projects")
    const forecast = planner.options.find((option) => option.label === "Forecast · Export66 candidate")
    if (!project || !forecast) throw new Error("Real export agenda sources unavailable")
    const preview = available(await (await request("review-agenda", { payload: { items: [project.item, forecast.item] } })).json() as PortResult<ReviewAgendaPreview>)
    return available(await (await request("review-preserve", { payload: { selectionRef: preview.selectionRef, sectionRefs: preview.sectionRefs }, key: "export66-preserve" })).json() as PortResult<PreservedReview>)
  }
  return { origin, directory, clock, period, note, owner, sessions, maxBytes, persistence, authority, business, app, incoming, request, handle, withCall, preserve,
    durable: () => resources.store.transactionAll!(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) })),
    productState: () => persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(object(snapshot.data.__sfProductV1)) })),
    document: (ref: string) => persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(object(object(object(snapshot.data.__sfProductV1).documents)[ref])) })),
    corrupt: (ref: string, replacement: Record<string, unknown> | null) => persistence.transaction("dashboard", async (snapshot) => {
      const documents = object(object(snapshot.data.__sfProductV1).documents)
      if (replacement === null) delete documents[ref]
      else documents[ref] = structuredClone(replacement)
      return { commit: true, value: undefined }
    }),
    changeCandidate: (amount: number) => persistence.transaction("planner", async (snapshot) => {
      const candidate = rows(snapshot.data.versions).find((entry) => entry.id === "export66-v1")
      const line = rows(candidate?.lines).find((entry) => entry.id === "license")
      if (!line) throw new Error("Canonical Planner source missing")
      line.f = Array(12).fill(amount)
      return { commit: true, value: undefined }
    }),
    reopen: async () => { await resources.store.dispose(); resources.store = await openLocalStore(directory) },
    dispose: async () => { business.dispose(); await resources.store.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}

/** Reopens the generated Office containers and parses their XML, never a renderer-side manifest. */
export async function inspectOfficeBytes(bytes: Uint8Array, format: "docx" | "pptx") {
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true })
  const paths = Object.keys(zip.files).filter((path) => format === "docx" ? path === "word/document.xml" : /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
  if (!paths.length) throw new Error("Generated Office main XML unavailable")
  const parts: { path: string; xml: string; text: string[] }[] = []
  for (const path of paths) {
    const xml = await zip.file(path)!.async("string")
    const text: string[] = []
    const parser = new SaxesParser({ xmlns: false })
    parser.on("text", (value) => text.push(value))
    parser.write(xml).close()
    parts.push({ path, xml, text })
  }
  const contentTypes = await zip.file("[Content_Types].xml")!.async("string")
  new SaxesParser({ xmlns: false }).write(contentTypes).close()
  const styles = format === "docx" ? await zip.file("word/styles.xml")!.async("string")
    : (await Promise.all(Object.keys(zip.files).filter((path) => /^ppt\/theme\/theme\d+\.xml$/.test(path)).map((path) => zip.file(path)!.async("string")))).join("\n")
  const text = parts.flatMap((part) => part.text).join("\n")
  return { sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, paths, parts, contentTypes, styles, text,
    compact: text.replace(/\s+/g, ""), zipEntries: Object.keys(zip.files).length }
}

