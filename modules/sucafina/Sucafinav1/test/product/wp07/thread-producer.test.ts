import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { roleMap } from "../../../runtime/admin.ts"
import type { Command, Snapshot } from "../../../runtime/contract.ts"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainPortHost, PortResult } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { createCollaborationAuthority } from "../../../product/collaboration/authority.ts"
import { createCollaborationMutationFence } from "../../../product/collaboration/mutation-fence.ts"
import { createRecipientAwareThreadReads } from "../../../product/collaboration/thread-reads.ts"
import { createThreadPort } from "../../../product/collaboration/threads.ts"
import { createDashboardRecordEvidenceHost } from "../../../product/dashboard/sources.ts"
import { createSfDashboardRecordSourceAccess } from "../../../product/decision-memory/source-access.ts"
import { createSfBusinessContext } from "../../../product/host-binding/business-context.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import type { SfHumanAction } from "../../../product/integration/human-authority.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourcePersistence, sfSourceIdentity } from "../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createExactReviewThreadSourceMapping, createReviewThreadComments } from "../../../product/reviews/thread-access.ts"

const at = "2026-11-13T00:00:00.000Z"
const period = { start: "2026-01-01", end: "2026-12-31" }
const project = { name: "Canonical project", budget: 100, spent: 20, status: "In Progress", risk: "Low", notes: "Unselected private notes" }

function available<T>(result: PortResult<T>): T {
  if (result.status !== "ok") throw new Error(`${result.status}: ${result.reason}`)
  return result.value
}

/** Fixture authentication, placement, clock and business inputs; real C08, C17, C06 and WP07 readers. */
async function fixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-wp07-thread-producer-"))
  await chmod(directory, 0o700)
  const resources = { store: await openLocalStore(directory) }
  const compose = () => {
    const persistence = createSfSourcePersistence({ persistence: resources.store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    const request = () => new Request("https://example.test/product", { method: "POST", headers: { origin: "https://example.test", actor: "person" } })
    const identity = (candidate: Request, snapshot: Snapshot) => {
      if (candidate.headers.get("actor") !== "person") return undefined
      const roles = roleMap(snapshot, "dashboard")
      const principal = resolve("person", roles, (group) => group === "admins")
      return principal.roles.some((role) => role.surface === "dashboard" && role.role === "admin")
        ? { installationId: "installation", projectId: "project", principalRef: principal.id, accessRevision: digestSfValue(roles), policyVersion: "policy" }
        : undefined
    }
    const ui = createSfUiAuthority({ authorize: async (candidate) => persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: identity(candidate, snapshot) })),
      commandIdentity: async () => randomUUID(), createId: randomUUID, now: () => Date.parse(at),
      privateCommands: ["sf-human:collaboration.thread.create", "sf-human:collaboration.thread.reply", "sf-human:collaboration.thread.resolve"],
    })
    const human = createSfHumanAuthority({ origin: "https://example.test", ui })
    const host: DomainPortHost = {
      persistence, authenticate: async (candidate, options) => candidate.headers.get("actor") === "person" && options ? resolve("person", [...options.roleMap], (group) => group === "admins") : null,
      environment: async () => ({ at, id: randomUUID, directory: [{ id: "person", name: "Person" }] }),
      requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined,
      revalidate: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false),
    }
    const records = createDashboardRecordEvidenceHost({ host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: persistence }) })
    const evidence = createSfBusinessContext({ revalidate: host.revalidate, resolveSource: createSfDashboardRecordSourceAccess({ host, records }),
      proveContinuity: async () => false, recall: async () => { throw new Error("Memory is outside this consumer fixture") },
      emitFromLedger: async () => { throw new Error("Memory is outside this consumer fixture") },
    })
    const creationTarget = { ref: "workspace", incarnation: "workspace-original" }
    const state = createSfProductState({ persistence, createId: randomUUID, authorize: async (candidate, snapshot) => identity(candidate, snapshot),
      resolveTarget: async (candidate, snapshot, namespace, ref) => namespace === "threads" && ref === creationTarget.ref && identity(candidate, snapshot) ? { incarnation: creationTarget.incarnation } : undefined,
    })
    const authority = createCollaborationAuthority({ host, evidence })
    const threads = createThreadPort({ state, host, human, creationTarget, mutationFence: createCollaborationMutationFence(host), authorize: authority.authorizeThread, createId: randomUUID, now: () => at })
    const reads = createRecipientAwareThreadReads(threads)
    const comments = createReviewThreadComments({ host, threads: reads, authorizeSourceMapping: createExactReviewThreadSourceMapping({ host, evidence }), maxMessages: 10 })
    const read = async () => {
      const digest = digestSfValue({ recordRefs: [] })
      const context = available(await ui.admit(request(), "sf_relation_read", digest))
      if (!await ui.validate(context, "sf_relation_read", digest)) throw new Error("Read admission unavailable")
      return context
    }
    const withHuman = async <T>(action: SfHumanAction, payload: unknown, work: (context: TrustedUiContext) => Promise<PortResult<T>>) => {
      const context = available(await human.admit(request(), action, payload))
      try { return available(await work(context)) } finally { human.finish(context) }
    }
    const mutate = async (command: Command) => persistence.transaction("dashboard", async (snapshot) => {
      const result = DashboardPortfolio.domain.execute(snapshot, { id: "person", roles: ["admin"], canWrite: true }, command, { at, id: () => "project", directory: [] })
      if (!result.ok) throw new Error(`Project fixture rejected: ${result.status}`)
      return { commit: true, value: result }
    })
    return { persistence, request, state, ui, records, threads, reads, comments, read, withHuman, mutate }
  }
  const current = compose()
  for (const surface of ["dashboard", "planner", "procurement"] as const) await current.persistence.initializeSources(surface)
  await current.persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "person" }]
    return { commit: true, value: undefined }
  })
  await current.mutate({ page: "All Projects", action: "save", version: 0, values: project })
  const create = async () => {
    const context = await current.read()
    const ref = available(await current.records.issue({ page: "All Projects", recordType: "projects", recordId: "project", fields: ["name", "status"], period }, context))
    const projection = available(await current.records.read(ref.refId, context))
    const draft = { kind: "comment" as const, sourceRef: ref.refId, sourceIncarnation: ref.target.incarnation, observedVersion: ref.target.version, period, body: "Canonical C06 message", evidenceRefs: [ref] }
    const mutation = { expectedStorageVersion: 0, idempotencyKey: "create-thread" }
    const thread = await current.withHuman("collaboration.thread.create", { draft, mutation }, (call) => current.threads.create(draft, mutation, call))
    const captured = available(await current.comments.capture(thread.id, projection.context.sourceRefs, context))
    return { context, ref, projection, thread, captured }
  }
  return { ...current, create,
    reload: async () => { await resources.store.dispose(); resources.store = await openLocalStore(directory); return compose() },
    dispose: async () => { await resources.store.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}

test("WP07 captures a canonical C06 message and reopens its exact C17 association after replies and SQLite reload", async () => {
  const f = await fixture()
  try {
    const selected = await f.create()
    expect(selected.captured).toHaveLength(1)
    expect(selected.captured[0]).toMatchObject({ content: "Canonical C06 message", authorRef: "person", version: 1, sourceRefs: selected.projection.context.sourceRefs })
    expect(selected.captured[0]!.id).toContain(`:${selected.thread.messages[0]!.incarnation}:`)
    expect(JSON.stringify(selected.projection)).not.toContain("Unselected private notes")
    const before = await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: { ...snapshot, data: Object.fromEntries(Object.entries(snapshot.data).filter(([key]) => key !== "__sfProductV1")) } }))
    const reply = { expectedStorageVersion: 1, idempotencyKey: "reply-thread" }
    await f.withHuman("collaboration.thread.reply", { id: selected.thread.id, body: "Later canonical reply", mutation: reply }, (context) => f.threads.reply(selected.thread.id, "Later canonical reply", reply, context))
    const resolution = { expectedStorageVersion: 2, idempotencyKey: "resolve-thread" }
    await f.withHuman("collaboration.thread.resolve", { id: selected.thread.id, mutation: resolution }, (context) => f.threads.resolve(selected.thread.id, resolution, context))
    expect(await f.comments.authorizeComments(selected.context, selected.captured)).toBe(true)
    expect(await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: { ...snapshot, data: Object.fromEntries(Object.entries(snapshot.data).filter(([key]) => key !== "__sfProductV1")) } }))).toEqual(before)
    const reopened = await f.reload()
    const context = await reopened.read()
    expect(await reopened.records.resolve(selected.ref.refId, context)).toEqual({ status: "ok", value: selected.ref })
    expect(await reopened.threads.read(selected.thread.id, context)).toMatchObject({ status: "ok", value: { state: "resolved", messages: [{ body: "Canonical C06 message" }, { body: "Later canonical reply" }] } })
    expect(await reopened.comments.authorizeComments(context, selected.captured)).toBe(true)
    expect(selected.captured).toHaveLength(1)
    expect(available(await reopened.comments.capture(selected.thread.id, selected.projection.context.sourceRefs, context))).toHaveLength(2)
    expect(await reopened.comments.authorizeComments(context, selected.captured.map((comment) => ({ ...comment, content: "Forged replacement" })))).toBe(false)
  } finally { await f.dispose() }
}, 30_000)

test("WP07 refuses preserved canonical comments after the persisted Dashboard role is revoked", async () => {
  const f = await fixture()
  try {
    const selected = await f.create()
    await f.persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = []; return { commit: true, value: undefined } })
    expect((await f.records.resolve(selected.ref.refId, selected.context)).status).not.toBe("ok")
    expect((await f.reads.read(selected.thread.id, selected.context)).status).not.toBe("ok")
    expect(await f.comments.authorizeComments(selected.context, selected.captured)).toBe(false)
    const denied = await f.comments.capture(selected.thread.id, selected.projection.context.sourceRefs, selected.context)
    expect(denied.status).not.toBe("ok")
    expect(JSON.stringify(denied)).not.toContain("Canonical C06 message")
    const stored = await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.__sfProductV1 }))
    expect(stored).toMatchObject({ threads: { [selected.thread.id]: { messages: [{ body: "Canonical C06 message" }] } } })
  } finally { await f.dispose() }
}, 30_000)

test("WP07 rejects a deleted source and a same-ID recreation without rebinding its preserved C06 message", async () => {
  const f = await fixture()
  try {
    const selected = await f.create()
    const before = await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: { version: snapshot.versions["projects:project"]!.version, physical: sfSourceIdentity(snapshot, "projects", "project") } }))
    await f.mutate({ page: "All Projects", action: "delete", id: "project", version: before.version, values: {} })
    expect(await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "projects", "project") }))).toBeUndefined()
    expect((await f.reads.read(selected.thread.id, selected.context)).status).not.toBe("ok")
    expect(await f.comments.authorizeComments(selected.context, selected.captured)).toBe(false)
    // The canonical editor refuses reuse of a deleted ID. Seed an adversarial
    // same-ID business record; the real C17 lifecycle must allocate a new identity.
    await f.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.projects = [{ id: "project", ...project }]
      return { commit: true, value: undefined }
    })
    const physical = await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "projects", "project") }))
    expect(physical?.incarnation).toBeTruthy()
    expect(physical!.incarnation).not.toBe(before.physical?.incarnation)
    const replacement = available(await f.records.issue({ page: "All Projects", recordType: "projects", recordId: "project", fields: ["name", "status"], period }, selected.context))
    expect(replacement.target.incarnation).not.toBe(selected.ref.target.incarnation)
    expect((await f.records.resolve(selected.ref.refId, selected.context)).status).not.toBe("ok")
    expect(await f.comments.authorizeComments(selected.context, selected.captured)).toBe(false)
    const projection = available(await f.records.read(replacement.refId, selected.context))
    const denied = await f.comments.capture(selected.thread.id, projection.context.sourceRefs, selected.context)
    expect(denied.status).not.toBe("ok")
    expect(JSON.stringify(denied)).not.toContain("Canonical C06 message")
    expect(await f.state.read(f.request(), "threads", (state) => state.threads[selected.thread.id])).toMatchObject({ status: "ok", value: { sourceRef: selected.ref.refId, sourceIncarnation: selected.ref.target.incarnation, messages: [{ body: "Canonical C06 message" }] } })
  } finally { await f.dispose() }
}, 30_000)
