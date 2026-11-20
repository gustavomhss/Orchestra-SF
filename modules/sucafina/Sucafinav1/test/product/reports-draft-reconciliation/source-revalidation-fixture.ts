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
