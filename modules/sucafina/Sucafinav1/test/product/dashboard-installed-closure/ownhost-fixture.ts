import { expect } from "bun:test"
import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AbsolutePath } from "@orchestra/core/schema"
import { contributions, createModule } from "../../../index.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardRecordEvidenceHost } from "../../../product/dashboard/sources.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createFixtureBusiness } from "../wp02/business-services-fixture.ts"
import { createNativeBrowserAssets } from "../native-ui-browser/browser-assets.ts"
import { createNativeBrowserHost } from "../native-ui-browser/host.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import { observeSfDashboardDraftHealth } from "../../../../../../apps/cli/src/sucafina-product/native-ui/dashboard-draft-health.ts"
import { createSfDashboardHttp } from "../../../../../../apps/cli/src/sucafina-product/dashboard-http.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
export const initialCaseRef = { id: "private-case-identity", incarnation: "case-incarnation", version: 1 }

// Isolated Mission67 setup derived from WP02 host-workbench, with the same real
// SQLite, encrypted operator session, module, C08 and source producers. The policy
// switch can only restrict the authenticated operator; it never grants access.
export async function createConsumerReadFixture() {
  const assets = await createNativeBrowserAssets()
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-dashboard-consumer-read-"))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(directory)
  const routing: { handle?: (request: Request) => Promise<Response | undefined> } = {}
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (request) => await routing.handle?.(request) ?? new Response(null, { status: 404 }) })
  const origin = server.url.origin, installationId = randomUUID(), principalRef = `macos:${installationId}:1000`
  const clock = { at: "2026-11-13T08:00:00Z" }, policy = { readable: true, writable: true }
  const httpTrace: { mode: string; method: string; state: "received" | "returned" | "threw"; status?: number; elapsedMs?: number }[] = []
  const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID, projectScope: createSfSourceScopeProjector(() => clock.at) })
  const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator: { installationId, uid: 1000, name: "Dashboard reviewer" }, secrets: driver.secrets, key: randomBytes(32) })
  const authenticate: typeof identity.authenticate = async (request, context) => {
    const principal = await identity.authenticate(request, context)
    return principal && policy.readable ? { ...principal, canWrite: policy.writable && principal.canWrite } : null
  }
  const environment = async (request: Request) => ({ at: clock.at, id: randomUUID, directory: await identity.directory(request) })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.hotTopics = [{ id: "topic", action: "Original action", owner: "Operations", due: "2026-12-01", priority: "normal", status: "open", notes: "" }]
    return { commit: true, value: undefined }
  })
  const proposalCoverageWrites = new WeakSet<object>(), dashboardHostWrites = new WeakSet<object>()
  const binding = { installationId, hostId: "host", projectId: "project", location: { directory: AbsolutePath.make(directory) } }
  const authority = createSfProductAuthority({ identity: () => binding,
    installationId, origin, policyVersion: "policy", persistence, authenticate, isAuthenticated: async (request) => Boolean(await identity.person(request)), environment, now: Date.now, createId: randomUUID,
    commandIdentity: async (request, operation) => request.method === "GET" || request.method === "HEAD" ? randomUUID() :
      request.headers.get("idempotency-key") ? digestSfValue({ operation, key: request.headers.get("idempotency-key") }) : undefined,
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined,
    authorizeDocument: async () => undefined, proposalCoverageWrites, dashboardHostWrites,
    grants: [{ principalRef, namespaces: ["cases", "preferences", "reviews", "receipts"], operations: ["sf_dashboard_read", "sf_case_read"],
      humanActions: ["reviews.preserve", "decisions.edit", "decisions.choose", "decisions.prepare-changes", "decisions.apply"] }] })
  const records = createDashboardRecordEvidenceHost({ host: authority.host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host: authority.host, scopedSources: persistence }) })
  const business = await createFixtureBusiness({ authority, persistence, proposalCoverageWrites, dashboardHostWrites }).catch(async (error: unknown) => {
    const failures: unknown[] = [error]
    try { await server.stop(true) } catch (failure) { failures.push(failure) }
    try { await driver.dispose() } catch (failure) { failures.push(failure) }
    try { await rm(directory, { recursive: true, force: true }) } catch (failure) { failures.push(failure) }
    throw failures.length === 1 ? error : new AggregateError(failures, "Business fixture setup and cleanup failed")
  })
  const dashboard = business.dashboardServices, decisions = business.dashboardDecisions
  const http = createSfDashboardHttp({ origin, mount: "/sucafina", runtime: () => ({ authority, dashboard, decisions }) })
  const application = { persistence, authenticate, environment, product: http, maxJsonBytes: 100000 }
  const module = createModule("/sucafina", application)
  const services = { ...authority, productHttp: http } as SfHostServices
  const native = createNativeBrowserHost({ origin, mount: "/sucafina", directory, identity: () => binding,
    application: { ...application, domains: contributions }, authority, services: () => services,
    observe: (request, stamp) => observeSfDashboardDraftHealth({
      ui: authority.ui, state: authority.state, humanActions: authority.humanActions,
      binding: (_operationId, producer) => producer === http && application.product === http && services.productHttp === http ? http : undefined,
      source: (id) => {
        if (application.product !== http || services.productHttp !== http) return undefined
        const operation = id === "dashboard.dashboard-workbench" ? dashboard.discover :
          id === "dashboard.dashboard-hot-topic-source" ? dashboard.issue :
          id === "dashboard.dashboard-draft-read" ? decisions.revalidateDraftRead :
          id === "dashboard.dashboard-hot-topic-draft" ? decisions.drafts.register :
          id === "dashboard.dashboard-hot-topic-drafts" ? decisions.drafts.list :
          id === "dashboard.dashboard-capture" ? dashboard.capture : decisions.drafts.lookupFirstSave
        return { producer: http, handler: http, operation,
          dependencies: [authority, authority.ui, authority.state, authority.human, dashboard, decisions,
            records, persistence, persistence.transaction, persistence.transactionAll!] }
      },
    }, request, stamp),
  })
  routing.handle = async (request) => {
    const mode = new URL(request.url).searchParams.get("sf"), started = performance.now()
    const observation: (typeof httpTrace)[number] | undefined = ["dashboard-workbench", "dashboard-hot-topic-draft", "dashboard-draft-read"].includes(mode ?? "") ? { mode: mode!, method: request.method, state: "received" } : undefined
    if (observation) httpTrace.push(observation)
    try {
      const response = await identity.handle(request) ?? assets.handle(request, { directory }) ??
        await native.handle(request) ?? await module(request)
      if (observation) { observation.state = "returned"; observation.status = response?.status ?? 503 }
      return response
    } catch (error) {
      if (observation) observation.state = "threw"
      throw error
    } finally {
      if (observation) observation.elapsedMs = Math.round(performance.now() - started)
    }
  }
  const login = await identity.handle(new Request(`${origin}/sucafina/auth/local?code=${await identity.enroll()}`))
  const cookie = login?.headers.get("set-cookie")?.split(";")[0]
  if (!cookie) throw new Error("Operator enrollment failed")
  const request = () => new Request(`${origin}/sucafina/dashboard?sf=dashboard-workbench`, { method: "POST", headers: { cookie, origin, "content-type": "application/json", "idempotency-key": randomUUID() }, body: JSON.stringify({ page: "Hot Topics & Actions" }) })
  const read = async <T>(work: (context: TrustedDomainContext) => Promise<T>) => {
    const source = request(), digest = digestSfValue({ page: "Hot Topics & Actions" })
    const admitted = await authority.ui.admit(source, "sf_dashboard_read", digest)
    if (admitted.status !== "ok") throw new Error("UI read admission failed")
    try {
      if (!await authority.ui.validate(admitted.value, "sf_dashboard_read", digest)) throw new Error("UI read validation failed")
      return await work(admitted.value)
    } finally { authority.ui.finish(admitted.value) }
  }
  const decision: DecisionCase = { ...initialCaseRef, objective: "Review the action", state: "investigating", horizon: period, currency: "USD", participants: [principalRef],
    criteria: [{ id: "operational", description: "Operational action", required: true }], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const seeded = await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: 0, targetRef: authority.creationTarget.ref,
    targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "initial-cases", commandDigest: digestSfValue(decision) }, async (state) => {
      state.cases[decision.id] = decision
      state.cases["other-case"] = { ...decision, id: "other-case", incarnation: "other-case-inc", objective: "Unrelated confidential case", participants: ["another-principal"] }
      return { commit: true, value: true }
    })
  expect(seeded.status).toBe("ok")
  return { origin, identity, policy, clock, httpTrace, principalRef, persistence, authority, dashboard, decisions, records, request, read,
    close: async () => { business.dispose(); await server.stop(true); await driver.dispose(); await rm(directory, { recursive: true, force: true }) } }
}
