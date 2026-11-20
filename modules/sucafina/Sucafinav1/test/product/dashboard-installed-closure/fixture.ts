import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AbsolutePath } from "@orchestra/core/schema"
import { createModule } from "../../../index.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import type { LocalStore } from "../../../runtime/local-contract.ts"
import type { Command } from "../../../runtime/contract.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardRecordEvidenceHost, createDashboardSourceHost } from "../../../product/dashboard/sources.ts"
import { createDashboardConfirmationObserver } from "../../../product/dashboard/confirmation.ts"
import { createDashboardConfirmationProjectionReader } from "../../../product/dashboard/confirmation-issuer.ts"
import { createDashboardPort } from "../../../product/dashboard/port.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

type Person = "owner" | "other"

// Two encrypted local sessions, real request admission/C08 and the production SQLite/source driver.
// Only initial business records and explicit permission changes are fixture inputs.
export async function createDashboardProofFixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-dashboard-installed67-"))
  await chmod(directory, 0o700)
  const routing: { handle?: (request: Request) => Promise<Response | undefined> } = {}
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (request) => await routing.handle?.(request) ?? new Response(null, { status: 503 }) })
  const origin = server.url.origin, installationId = randomUUID()
  const clock = { at: "2026-11-13T08:00:00Z" }
  const policies = { owner: { readable: true, writable: true }, other: { readable: true, writable: true } }
  const people = [
    { name: "owner" as const, uid: 1000, label: "Dashboard owner", key: randomBytes(32) },
    { name: "other" as const, uid: 1001, label: "Other dashboard reader", key: randomBytes(32) },
  ]
  const build = async (driver: LocalStore) => {
    const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID, projectScope: createSfSourceScopeProjector(() => clock.at) })
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    const identities = people.map((person) => ({ name: person.name, identity: createOperatorIdentity({ origin, mount: "/sucafina", operator: { installationId, uid: person.uid, name: person.label }, secrets: driver.secrets, key: person.key }) }))
    const authenticate: Parameters<typeof createModule>[1]["authenticate"] = async (request, context) => {
      const values = await Promise.all(identities.map(async (entry) => {
        const principal = await entry.identity.authenticate(request, context)
        const policy = policies[entry.name]
        return principal && policy.readable ? { ...principal, canWrite: policy.writable && principal.canWrite } : null
      }))
      const current = values.filter((value) => value !== null)
      return current.length === 1 ? current[0]! : null
    }
    const environment = async (request: Request) => ({ at: clock.at, id: randomUUID, directory: (await Promise.all(identities.map((entry) => entry.identity.directory(request)))).flat() })
    const authority = createSfProductAuthority({ identity: () => ({ installationId, hostId: "dashboard67", projectId: "dashboard67-project", location: { directory: AbsolutePath.make(directory) } }),
      installationId, origin, policyVersion: "dashboard67-policy", persistence, authenticate, environment, now: Date.now, createId: randomUUID,
      commandIdentity: async (request, operation) => request.method === "GET" || request.method === "HEAD" ? randomUUID() :
        request.headers.get("idempotency-key") ? digestSfValue({ operation, key: request.headers.get("idempotency-key") }) : undefined,
      inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined,
      authorizeDocument: async () => undefined,
      grants: people.map((person) => ({ principalRef: `macos:${installationId}:${person.uid}`, namespaces: ["cases", "reviews", "preferences", "receipts"] as const, operations: ["sf_dashboard_read", "sf_case_read"], humanActions: ["reviews.preserve", "decisions.edit"] as const })) })
    const records = createDashboardRecordEvidenceHost({ host: authority.host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host: authority.host, scopedSources: persistence }) })
    const dashboard = createDashboardPort({ host: authority.host, sources: createDashboardSourceHost({ host: authority.host, scopedSources: persistence }), recordEvidence: records })
    const observer = createDashboardConfirmationObserver({ host: authority.host, scopedSources: persistence, readProjection: createDashboardConfirmationProjectionReader({ dashboard, records }) })
    const module = createModule("/sucafina", { persistence, authenticate, environment, maxJsonBytes: 100000 })
    return { driver, persistence, identities, authenticate, environment, authority, records, dashboard, observer, module }
  }
  let current = await build(await openLocalStore(directory))
  routing.handle = (request) => current.module(request)
  await current.persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.hotTopics = [
      { id: "topic", action: "Original action", owner: "Operations", due: "2026-12-01", status: "open", priority: "normal", notes: "Private operator context" },
      { id: "unrelated", action: "Unrelated action", owner: "Infrastructure", due: "2027-01-01", status: "open", priority: "normal", notes: "Unrelated retained context" },
    ]
    return { commit: true, value: undefined }
  })
  const cookies = new Map<Person, string>()
  for (const entry of current.identities) {
    const response = await entry.identity.handle(new Request(`${origin}/sucafina/auth/local?code=${await entry.identity.enroll()}`))
    const cookie = response?.headers.get("set-cookie")?.split(";")[0]
    if (!cookie || response?.status !== 303) throw new Error("Dashboard proof operator enrollment failed")
    cookies.set(entry.name, cookie)
  }
  const request = (person: Person = "owner", signal?: AbortSignal) => new Request(`${origin}/sucafina/dashboard?sf=dashboard-workbench`, {
    method: "POST", signal, headers: { cookie: cookies.get(person)!, origin, "content-type": "application/json", "idempotency-key": randomUUID() }, body: JSON.stringify({ page: "Hot Topics & Actions" }),
  })
  const read = async <T>(work: (context: TrustedDomainContext) => Promise<T>, person: Person = "owner", signal?: AbortSignal) => {
    const authority = current.authority
    const digest = digestSfValue({ page: "Hot Topics & Actions" })
    const admitted = await authority.ui.admit(request(person, signal), "sf_dashboard_read", digest)
    if (admitted.status !== "ok") throw new Error("Dashboard proof read admission failed")
    try {
      if (!await authority.ui.validate(admitted.value, "sf_dashboard_read", digest)) throw new Error("Dashboard proof read validation failed")
      return await work(admitted.value)
    } finally { authority.ui.finish(admitted.value) }
  }
  return {
    directory, origin, installationId, clock, policies, request, read,
    principal: (person: Person = "owner") => `macos:${installationId}:${people.find((entry) => entry.name === person)!.uid}`,
    get persistence() { return current.persistence }, get authority() { return current.authority }, get records() { return current.records },
    get observer() { return current.observer }, get dashboard() { return current.dashboard },
    get environment() { return current.environment }, get authenticate() { return current.authenticate },
    page: (page: string, person: Person = "owner") => fetch(`${origin}/sucafina/dashboard?page=${encodeURIComponent(page)}&asset=page`, { headers: { cookie: cookies.get(person)! } }),
    command: (command: Command, person: Person = "owner") => fetch(`${origin}/sucafina/dashboard`, { method: "POST", headers: { cookie: cookies.get(person)!, origin, "content-type": "application/json" }, body: JSON.stringify(command) }),
    logout: async (person: Person = "owner") => current.identities.find((entry) => entry.name === person)!.identity.handle(new Request(`${origin}/sucafina/auth/logout`, { method: "POST", headers: { origin, cookie: cookies.get(person)! } })),
    disconnect: () => current.driver.dispose(),
    reopen: async () => { await current.driver.dispose(); current = await build(await openLocalStore(directory)) },
    close: async () => { await server.stop(true); await current.driver.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}
