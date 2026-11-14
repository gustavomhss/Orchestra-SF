import type { Browser, BrowserContext } from "@playwright/test"
import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AbsolutePath } from "@orchestra/core/schema"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { AuthorizedCaseProjection } from "../../../product/contracts/business-context.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { sfHumanReadActions } from "../../../product/integration/human-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardRecordEvidenceHost } from "../../../product/dashboard/sources.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createCollaborationHost } from "../../../product/collaboration/host.ts"
import { createCollaborationHttp } from "../../../product/collaboration/http.ts"
import { createCollaborationHumanAuthority } from "../../../product/collaboration/human.ts"
import { createFixtureBusiness } from "../wp02/business-services-fixture.ts"

/** Published collaboration HTTP/service over real BCS cases/evidence, C08 and
 * encrypted operator sessions. The component renderer receives the actual
 * authorized case projection. No directory, authority or mutation is simulated.
 * This mounts current-source selection only, not historical reissue, native
 * execution, question attachment or the complete application host. */
export async function createWorkSelectionDomainFixture(browser: Browser, render: (projection: AuthorizedCaseProjection) => { html: string; script: string }) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-work-selection-consumer-"))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(directory)
  const routing: { handle?: (request: Request) => Promise<Response> } = {}
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, idleTimeout: 30, fetch: (request) => routing.handle?.(request) ?? new Response(null, { status: 503 }) })
  const origin = server.url.origin, mount = "/sucafina/dashboard", installationId = randomUUID(), principalRef = `macos:${installationId}:1000`
  const at = "2026-11-14T08:00:00Z", period = { start: "2026-01-01", end: "2026-12-31" }
  const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID, projectScope: createSfSourceScopeProjector(() => at) })
  const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator: { installationId, uid: 1000, name: "Authorized work reviewer" }, secrets: driver.secrets, key: randomBytes(32) })
  const proposalCoverageWrites = new WeakSet<object>(), dashboardHostWrites = new WeakSet<object>()
  const caseSelectionWrites = new WeakSet<object>(), threadHistoryWrites = new WeakSet<object>()
  const authority = createSfProductAuthority({ identity: () => ({ installationId, hostId: "host", projectId: "project", location: { directory: AbsolutePath.make(directory) } }),
    installationId, origin, policyVersion: "policy", persistence, authenticate: identity.authenticate,
    environment: async (request) => ({ at, id: randomUUID, directory: await identity.directory(request) }), now: Date.now, createId: randomUUID,
    commandIdentity: async (request, operation) => request.method === "GET" ? randomUUID() : request.headers.get("idempotency-key") ? digestSfValue({ operation, key: request.headers.get("idempotency-key") }) : undefined,
    proposalCoverageWrites, dashboardHostWrites, caseSelectionWrites, threadHistoryWrites,
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined,
    grants: [{ principalRef, namespaces: ["cases", "preferences", "threads", "relations", "confirmations"], operations: ["sf_dashboard_read", "sf_case_read", "sf_work_list"],
      humanActions: ["collaboration.recipients", "collaboration.storage.version", "collaboration.thread.create", "collaboration.thread.read", "collaboration.selection.create", "collaboration.selection.list", "collaboration.selection.version", "collaboration.cycle.read", "collaboration.work.list"] }] })
  let business: Awaited<ReturnType<typeof createFixtureBusiness>> | undefined
  let context: BrowserContext | undefined
  const close = async () => {
    const errors: unknown[] = []
    try { await server.stop(true) } catch (error) { errors.push(error) }
    try { business?.dispose() } catch (error) { errors.push(error) }
    try { await context?.close() } catch (error) { errors.push(error) }
    try { await driver.dispose() } catch (error) { errors.push(error) }
    try { await rm(directory, { recursive: true, force: true }) } catch (error) { errors.push(error) }
    if (errors.length) throw new AggregateError(errors, "Work selection fixture did not close")
  }
  try {
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.access = { [principalRef]: { assigned: ["projects"], domains: ["IT"] } }
      snapshot.data.projects = [{ id: "project", name: "Authorized operational project", domain: "IT", status: "Planning", pm: "Owner", risk: "Low" }]
      return { commit: true, value: undefined }
    })
    const services = business = await createFixtureBusiness({ authority, persistence, proposalCoverageWrites, dashboardHostWrites })
    // The retained BCS does not export its private record issuer. Compose the
    // same real producer over the same authority and durable source scopes.
    const records = createDashboardRecordEvidenceHost({ host: authority.host, scopedSources: persistence,
      issueRecord: createDashboardRecordSourceIssuer({ host: authority.host, scopedSources: persistence }) })
    const collaboration = createCollaborationHost({ host: authority.host, state: authority.state, creationTarget: authority.creationTarget, scopedSources: persistence,
      evidence: services.context, procurement: services.procurement, collections: services.registry, cases: services.cases, authority: authority.authority, human: authority.human,
      caseSelectionWrites, threadHistoryWrites,
      requiredAuthority: { sf_work_list: ["threads:read", "relations:read", "confirmations:read"], sf_question_prepare: ["threads:read", "cases:read"],
        sf_answer_read: ["threads:read"], sf_relation_read: ["relations:read"], sf_handoff_prepare: ["threads:read", "relations:read"] }, createId: randomUUID, now: () => at })
    const admitRead = async (request: Request, operation: string, payload: unknown): Promise<PortResult<TrustedUiContext>> => {
      if (!sfHumanReadActions.some((action) => action === operation)) return { status: "denied", reason: "read-action-unavailable" }
      const intent = `sf-human:${operation}`, digest = digestSfValue(payload)
      const admitted = await authority.ui.admit(request, intent, digest)
      if (admitted.status !== "ok") return admitted
      if (!await authority.ui.validate(admitted.value, intent, digest)) { authority.ui.finish(admitted.value); return { status: "denied", reason: "read-admission-unavailable" } }
      return admitted
    }
    const http = createCollaborationHttp({ origin, mount, host: collaboration, human: createCollaborationHumanAuthority({ origin, ui: authority.ui }), admitRead, finishRead: authority.ui.finish })
    const login = await identity.handle(new Request(`${origin}/sucafina/auth/local?code=${await identity.enroll()}`))
    const cookie = login?.headers.get("set-cookie")?.split(";")[0]
    if (!cookie) throw new Error("Real work reviewer enrollment failed")
    const request = (payload: unknown = {}, key = randomUUID()) => new Request(`${origin}${mount}`, { method: "POST", headers: { cookie, origin, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(payload) })
    const read = async <T>(operation: string, payload: unknown, work: (call: TrustedUiContext) => Promise<PortResult<T>>) => {
      const digest = digestSfValue(payload), admitted = await authority.ui.admit(request(payload), operation, digest)
      if (admitted.status !== "ok") return admitted
      try {
        if (!await authority.ui.validate(admitted.value, operation, digest)) return { status: "denied" as const, reason: "read-admission-unavailable" }
        return await work(admitted.value)
      } finally { authority.ui.finish(admitted.value) }
    }
    const selection = { page: "Portfolio Dashboard", recordType: "projects", recordId: "project", fields: ["name"], period }
    const issued = await read("sf_dashboard_read", selection, (call) => records.issue(selection, call))
    if (issued.status !== "ok") throw new Error(`Real selection source unavailable: ${issued.reason}`)
    const decision: DecisionCase = { id: "work-decision", incarnation: "work-decision-incarnation", version: 1, state: "investigating", objective: "Review operational work",
      horizon: period, currency: "USD", criteria: [{ id: "cost", description: "Review cost", required: true }], participants: [principalRef], sourceRefs: [issued.value], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seeded = await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: 0, targetRef: authority.creationTarget.ref,
      targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "fixture-case", commandDigest: digestSfValue(decision) }, async (state) => { state.cases[decision.id] = decision; return { commit: true, value: true } })
    if (seeded.status !== "ok") throw new Error("Real case seeding unavailable")
    const caseRef = encodeCaseRef(decision)
    const attempts: { route: string | null; body: string; key: string | null; status: number }[] = []
    routing.handle = async (incoming) => {
      const auth = await identity.handle(incoming)
      if (auth) return auth
      const url = new URL(incoming.url)
      if (url.pathname !== mount) return new Response(null, { status: 404 })
      if (incoming.method === "GET") {
        const payload = { caseRef }, digest = digestSfValue(payload), admitted = await authority.ui.admit(incoming, "sf_case_read", digest)
        if (admitted.status !== "ok") return new Response(null, { status: 403 })
        try {
          if (!await authority.ui.validate(admitted.value, "sf_case_read", digest)) return new Response(null, { status: 403 })
          const current = await services.cases.read(payload, admitted.value)
          if (current.status !== "ok" || !await authority.ui.revalidate(admitted.value)) return new Response(null, { status: current.status === "denied" ? 403 : 503 })
          const component = render(current.value)
          return new Response(`<!doctype html><html><head><meta charset="utf-8"></head><body>${component.html}<script>${component.script}</script></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
        } finally { authority.ui.finish(admitted.value) }
      }
      const body = await incoming.clone().text()
      const result = await http(incoming) ?? new Response(null, { status: 404 })
      attempts.push({ route: url.searchParams.get("sf"), body, key: incoming.headers.get("idempotency-key"), status: result.status })
      return result
    }
    context = await browser.newContext()
    const separator = cookie.indexOf("=")
    await context.addCookies([{ name: cookie.slice(0, separator), value: cookie.slice(separator + 1), domain: new URL(origin).hostname, path: "/sucafina", httpOnly: true, sameSite: "Lax" }])
    const page = await context.newPage(), errors: string[] = []
    page.setDefaultTimeout(10_000)
    page.on("pageerror", (error) => errors.push(error.message))
    const post = (mode: string, payload: unknown = {}, key = randomUUID()) => fetch(`${origin}${mount}?sf=${encodeURIComponent(mode)}`, { method: "POST", headers: { cookie, origin, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(payload) })
    return { origin, mount, identity, principalRef, period, caseRef, source: issued.value, page, context, errors, attempts, post, request, authority, persistence, collaboration,
      readCase: () => read("sf_case_read", { caseRef }, (call) => services.cases.read({ caseRef }, call)), close }
  } catch (error) {
    try { await close() } catch (cleanup) { throw new AggregateError([error, cleanup], "Work selection fixture setup and cleanup failed") }
    throw error
  }
}
