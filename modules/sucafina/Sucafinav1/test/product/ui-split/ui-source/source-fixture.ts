import { expect } from "bun:test"
import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AbsolutePath } from "@orchestra/core/schema"
import { createModule } from "../../../../index.ts"
import { createOperatorIdentity } from "../../../../runtime/operator-identity.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { object, rows } from "../../../../runtime/contract.ts"
import { resolve } from "../../../../src/identity.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import type { SfHumanAction } from "../../../../product/integration/human-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { createDashboardRecordSourceIssuer } from "../../../../product/integration/dashboard-sources.ts"
import { createDashboardRecordEvidenceHost } from "../../../../product/dashboard/sources.ts"
import { createSfBusinessContext } from "../../../../product/host-binding/business-context.ts"
import { createSfDashboardRecordSourceAccess } from "../../../../product/decision-memory/source-access.ts"
import { createCollaborationMutationFence } from "../../../../product/collaboration/mutation-fence.ts"
import { createCollaborationHotTopicHost } from "../../../../product/collaboration/hot-topic-host.ts"
import { createHotTopicPort } from "../../../../product/dashboard/hot-topics.ts"

type Update = Parameters<ReturnType<typeof createHotTopicPort>["update"]>[0]
type Role = "admin" | "domain leader" | "contributor" | "viewer"
const at = "2026-11-13T08:00:00.000Z"
const sensitive = "Restricted development assessment: promotion discussion"

/** Real encrypted login, current role resolution, C08 and scoped evidence over SQLite. */
export async function sourceFixture(options: { role?: Role; handoffGrant?: boolean } = {}) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "ui-source-identity-"))
  await chmod(directory, 0o700)
  const origin = "http://127.0.0.1:43127", installationId = randomUUID(), group = "fixture-operator-group"
  const principalRef = `macos:${installationId}:1000`, key = randomBytes(32), session: { cookie?: string } = {}
  const roleRows = (role: Role) => [{ surface: "dashboard", role, entra: group, version: 0, by: principalRef }]
  const open = async (seed: boolean) => {
    const driver = await openLocalStore(directory)
    const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID, projectScope: createSfSourceScopeProjector(() => at) })
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    if (seed) await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = roleRows(options.role ?? "domain leader")
      snapshot.data.access = { [principalRef]: { assigned: ["projects"], domains: ["IT"] } }
      snapshot.data.projects = [{ id: "project-1", name: "Infrastructure review", domain: "IT", status: "Planning", pm: "Project owner", risk: "High" }]
      snapshot.data.members = [{ id: "member-1", name: "Team member", type: "Employee", status: "Active", leaderId: "", cls: "Talent", outlook: "Promote", notes: sensitive }]
      snapshot.data.hotTopics = []
      snapshot.data.opexOwners = [{ id: "untouched-budget", name: "Operations", budget: 1300 }]
      return { commit: true, value: undefined }
    })
    const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator: { installationId, uid: 1000, name: "Authenticated operator" }, secrets: driver.secrets, key })
    // The login proves identity; the production role resolver consumes the current persisted map.
    const authenticate: typeof identity.authenticate = async (request, context) => {
      const person = await identity.person(request)
      return person && context ? resolve(person.id, [...context.roleMap], (name) => name === group) : null
    }
    const environment = async (request: Request) => ({ at, id: randomUUID, directory: await identity.directory(request) })
    if (!session.cookie) {
      const login = await identity.handle(new Request(`${origin}/sucafina/auth/local?code=${await identity.enroll()}`))
      session.cookie = login?.headers.get("set-cookie")?.split(";")[0]
      if (!session.cookie) throw new Error("Encrypted operator enrollment failed")
    }
    const request = (payload: unknown = {}, idempotencyKey: string = randomUUID()) => new Request(`${origin}/sucafina/dashboard`, {
      method: "POST", headers: { cookie: session.cookie!, origin, "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(payload),
    })
    expect((await identity.person(request()))?.id).toBe(principalRef)
    const authority = createSfProductAuthority({ installationId, origin, policyVersion: "wp02-collaboration-policy", persistence, authenticate, environment,
      identity: () => ({ installationId, hostId: "collaboration-host", projectId: "project", location: { directory: AbsolutePath.make(directory) } }),
      createId: randomUUID, now: Date.now, commandIdentity: async (source, operation) => source.headers.get("idempotency-key") ? digestSfValue({ operation, key: source.headers.get("idempotency-key") }) : undefined,
      inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined,
      grants: [{ principalRef, namespaces: ["relations"], operations: ["sf_dashboard_read"], humanActions: options.handoffGrant === false ? ["decisions.edit"] : ["collaboration.handoff.confirm", "decisions.edit"] }] })
    const records = createDashboardRecordEvidenceHost({ host: authority.host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host: authority.host, scopedSources: persistence }) })
    const evidence = createSfBusinessContext({ revalidate: authority.host.revalidate, resolveSource: createSfDashboardRecordSourceAccess({ host: authority.host, records }),
      proveContinuity: async () => false,
      recall: async () => { throw new Error("This record-only consumer does not request Atlas recall") },
      emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "", scanner: { name: "", version: "", status: "unavailable" }, reason: "record-only-consumer" }) })
    const mutationFence = createCollaborationMutationFence(authority.host)
    const admitted = new WeakMap<TrustedDomainContext, { action: SfHumanAction; payload: unknown }>()
    const topics = createHotTopicPort(createCollaborationHotTopicHost({ host: authority.host, state: authority.state, evidence, creationTarget: authority.creationTarget, mutationFence,
      authorizeMutation: async (context) => { const active = admitted.get(context); return !!active && authority.human.authorize(context, active.action, active.payload) } }))
    const read = async <T>(payload: unknown, work: (context: TrustedDomainContext) => Promise<T>) => {
      const digest = digestSfValue(payload), access = await authority.ui.admit(request(payload), "sf_dashboard_read", digest)
      if (access.status !== "ok") throw new Error(`Read admission failed: ${access.status}`)
      try { if (!await authority.ui.validate(access.value, "sf_dashboard_read", digest)) throw new Error("Read lease not consumed"); return await work(access.value) }
      finally { authority.ui.finish(access.value) }
    }
    const human = async <T>(action: SfHumanAction, payload: unknown, idempotencyKey: string, work: (context: TrustedDomainContext) => Promise<PortResult<T>>): Promise<PortResult<T>> => {
      const access = await authority.human.admit(request(payload, idempotencyKey), action, payload)
      if (access.status !== "ok") return access
      try { return await work(access.value) } finally { authority.human.finish(access.value) }
    }
    const module = createModule("/sucafina", { persistence, authenticate, environment, maxJsonBytes: 100000 })
    return { driver, persistence, authority, evidence, topics, records, read, request,
      create: (payload: Parameters<typeof topics.create>[0]) => human("collaboration.handoff.confirm", payload, payload.correlationKey, async (context) => {
        admitted.set(context, { action: "collaboration.handoff.confirm", payload })
        try { return await topics.create(payload, context) } finally { admitted.delete(context) }
      }),
      issue: (selection: Parameters<typeof records.issue>[0]) => read(selection, (context) => records.issue(selection, context)),
      update: (payload: Update) => human("decisions.edit", payload, payload.idempotencyKey, async (context) => {
        admitted.set(context, { action: "decisions.edit", payload })
        try { return await topics.update(payload, context) } finally { admitted.delete(context) }
      }),
      setRole: (role: Role) => persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = roleRows(role); return { commit: true, value: undefined } }),
      command: (payload: unknown) => module(request(payload)),
      page: () => module(new Request(`${origin}/sucafina/dashboard?page=Hot+Topics+%26+Actions`, { headers: { cookie: session.cookie! } })),
      inspect: () => persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: {
        topics: structuredClone(rows(snapshot.data.hotTopics)), relations: structuredClone(object(object(snapshot.data.__sfProductV1).relations)),
        budget: structuredClone(snapshot.data.opexOwners), versions: structuredClone(snapshot.versions),
        audit: structuredClone(snapshot.audit), product: structuredClone(snapshot.data.__sfProductV1), identities: structuredClone(snapshot.sfSources),
      } })),
      otherSurfaces: () => persistence.transactionAll!(async (snapshots) => ({ commit: false, value: digestSfValue({ planner: snapshots.planner.data, procurement: snapshots.procurement.data }) })),
    }
  }
  const current = { runtime: await open(true) }
  return { principalRef, installationId, get runtime() { return current.runtime },
    reopen: async () => { await current.runtime.driver.dispose(); current.runtime = await open(false) },
    close: async () => { await current.runtime.driver.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}
