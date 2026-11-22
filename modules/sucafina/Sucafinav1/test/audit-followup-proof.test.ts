import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { roleMap } from "../runtime/admin.ts"
import { object } from "../runtime/contract.ts"
import type { Command, Snapshot } from "../runtime/contract.ts"
import { DashboardPortfolio } from "../runtime/dashboard-portfolio.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import { resolve } from "../src/identity.ts"
import { digestSfValue } from "../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../product/contracts/business-context.ts"
import type { DomainPortHost, PortResult } from "../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../product/contracts/sf-execution.ts"
import { createCollaborationHost } from "../product/collaboration/host.ts"
import { collaborationHumanActions, createCollaborationHumanAuthority } from "../product/collaboration/human.ts"
import type { CollaborationHumanAction } from "../product/collaboration/human.ts"
import { createDashboardConfirmationObserver } from "../product/dashboard/confirmation.ts"
import { createDashboardRecordEvidenceHost } from "../product/dashboard/sources.ts"
import { createSfDashboardRecordSourceAccess } from "../product/decision-memory/source-access.ts"
import { createSfBusinessContext } from "../product/host-binding/business-context.ts"
import { createSfExecutionBindingRegistry } from "../product/host-binding/execution-context.ts"
import { createSfProductState } from "../product/host-binding/state-provider.ts"
import { createDashboardRecordSourceIssuer } from "../product/integration/dashboard-sources.ts"
import { enumerateSfSources } from "../product/integration/source-inventory.ts"
import { createSfSourcePersistence } from "../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../product/integration/source-projections.ts"
import { createSfDomainAuthority, createSfUiAuthority } from "../product/integration/ui-authority.ts"

const at = "2026-11-22T08:00:00.000Z"
const period = { start: "2026-01-01", end: "2026-12-31" }
const original = { name: "Selected project", budget: 100, spent: 20, status: "In Progress", risk: "Low", notes: "Private unselected material" }
const answer = "The recipient checked the selected project."
const people = [{ id: "questioner", name: "Questioner" }, { id: "recipient", name: "Recipient" }]

function ok<T>(result: PortResult<T>): T {
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  return result.value
}

/** Diagnostic only. SQLite, source projection, C08 host, UI/human admission and
 * sf_answer_read are real. Authentication and the two administrator directory
 * grants are explicit fixture boundaries, not an installed Entra/Teams claim.
 */
async function fixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-followup-proof-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
  const request = (actor: string) => new Request("https://example.test/product", { method: "POST", headers: { origin: "https://example.test", actor } })
  const identityFor = (id: string | null, snapshot: Snapshot) => {
    if (!people.some((person) => person.id === id)) return undefined
    const roles = roleMap(snapshot, "dashboard")
    const principal = resolve(id!, roles, (group) => group === "admins:" + id)
    if (!principal.roles.some((role) => role.surface === "dashboard" && role.role === "admin") || !Object.hasOwn(object(snapshot.data.access), id!)) return undefined
    return { installationId: "installation", projectId: "project", principalRef: id!, accessRevision: digestSfValue({ roles, access: snapshot.data.access }), policyVersion: "policy" }
  }
  const identity = (candidate: Request, snapshot: Snapshot) => identityFor(candidate.headers.get("actor"), snapshot)
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.roleMap = people.map((person) => ({ surface: "dashboard", role: "admin", entra: "admins:" + person.id, version: 1, by: "questioner" }))
    snapshot.data.access = Object.fromEntries(people.map((person) => [person.id, { assigned: [], domains: [] }]))
    return { commit: true, value: undefined }
  })
  const mutate = (command: Command) => persistence.transaction("dashboard", async (snapshot) => {
    const result = DashboardPortfolio.domain.execute(snapshot, { id: "questioner", roles: ["admin"], canWrite: true }, command, { at, id: () => "project", directory: people })
    if (!result.ok) throw new Error("Canonical project mutation failed: " + JSON.stringify(result))
    return { commit: true, value: result }
  })
  await mutate({ page: "All Projects", action: "save", version: 0, values: original })
  const ui = createSfUiAuthority({
    authorize: async (candidate) => persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: identity(candidate, snapshot) })),
    commandIdentity: async () => randomUUID(), createId: randomUUID, now: () => Date.parse(at),
    privateCommands: collaborationHumanActions.map((action) => "sf-human:" + action),
  })
  const human = createCollaborationHumanAuthority({ origin: "https://example.test", ui })
  const host: DomainPortHost = {
    persistence,
    authenticate: async (candidate, options) => {
      const id = candidate.headers.get("actor")
      return people.some((person) => person.id === id) && options ? resolve(id!, [...options.roleMap], (group) => group === "admins:" + id) : null
    },
    environment: async () => ({ at, id: randomUUID, directory: people }),
    requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined,
    revalidate: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false),
  }
  const records = createDashboardRecordEvidenceHost({ host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: persistence }) })
  const availability = { sources: true }
  const resolveSource = createSfDashboardRecordSourceAccess({ host, records })
  const evidence = createSfBusinessContext({
    revalidate: host.revalidate,
    resolveSource: (ref, context) => availability.sources ? resolveSource(ref, context) : Promise.resolve({ state: "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: at }),
    proveContinuity: async () => false,
    recall: async () => { throw new Error("Recall is outside this proof") },
    emitFromLedger: async () => { throw new Error("Emission is outside this proof") },
  })
  const source = createDashboardConfirmationObserver({ host, scopedSources: persistence, readProjection: (selection, context) => records.read(selection.reference, context) })
  const issueForActor: NonNullable<Parameters<typeof createCollaborationHost>[0]["issueForActor"]> = async (target, context) => {
    if (target.surface !== "dashboard" || !target.period) return { status: "unavailable", reason: "unselected-source" }
    const page = await persistence.transaction("dashboard", async (snapshot) => {
      const entries = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.incarnation === target.incarnation && entry.scope.recordType === target.recordType && entry.scope.recordId === target.recordId)
      return { commit: false, value: entries.length === 1 ? object(entries[0]!.scope.selector).page : undefined }
    })
    if (typeof page !== "string") return { status: "unavailable", reason: "source-selector-unavailable" }
    return records.issue({ page, recordType: target.recordType, recordId: target.recordId, fields: target.fields, period: target.period }, context)
  }
  const creationTarget = { ref: "workspace", incarnation: "workspace-original" }
  const state = createSfProductState({ persistence, createId: randomUUID,
    authorize: async (candidate, snapshot) => identity(candidate, snapshot),
    resolveTarget: async (candidate, snapshot, namespace, ref) => namespace === "threads" && ref === creationTarget.ref && identity(candidate, snapshot) ? { incarnation: creationTarget.incarnation } : undefined,
  })
  // This fixture grants both selected people administrator access only. The
  // synchronous commit check reads the protected ACL, not a directory ID alone.
  const grant = (snapshot: Snapshot, recipient: string, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => {
    const caller = host.requestFor(context)
    if (!caller || recipient !== "recipient" || !refs.length || refs.some((ref) => ref.kind !== "record" || ref.target.surface !== "dashboard")) return false
    const from = identity(caller, snapshot), to = identityFor(recipient, snapshot)
    return !!from && !!to && from.principalRef === context.binding.principalRef && from.accessRevision === context.binding.accessRevision
  }
  const recipientAuthority = {
    authorize: (recipient: string, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: grant(snapshot, recipient, refs, context) })),
    checkAtCommit: (recipient: string, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => {
      const snapshot = persistence.currentSnapshots?.()?.dashboard
      return !!snapshot && grant(snapshot, recipient, refs, context)
    },
  }
  const authority = createSfDomainAuthority({ ui, native: createSfExecutionBindingRegistry({ authenticateAndResolve: async () => undefined, revalidateAdmission: async () => false }) })
  const collaboration = createCollaborationHost({ host, state, creationTarget, scopedSources: persistence, evidence, human, authority, recipientAuthority,
    procurement: { list: async () => ({ status: "unavailable", reason: "unselected-procurement" }) },
    collections: { resolveRequestCollection: async () => ({ status: "unavailable", reason: "unselected-collection" }) },
    cases: { read: async () => ({ status: "unavailable", reason: "unselected-case" }) },
    issueForActor, prepareReissueScope: source.prepareReissueScope, confirmationSource: source,
    requiredAuthority: { sf_work_list: [], sf_question_prepare: [], sf_answer_read: [], sf_relation_read: [], sf_handoff_prepare: [] }, createId: randomUUID, now: () => at,
  })
  const read = async (actor: string, operation = "sf_relation_read", payload: unknown = { recordRefs: [] }) => {
    const digest = digestSfValue(payload)
    const context = ok(await ui.admit(request(actor), operation, digest))
    if (!await ui.validate(context, operation, digest)) throw new Error("Read admission unavailable")
    return context
  }
  const withHuman = async <T>(actor: string, action: CollaborationHumanAction, payload: unknown, work: (context: TrustedUiContext) => Promise<PortResult<T>>) => {
    const context = ok(await human.admit(request(actor), action, payload))
    try { return ok(await work(context)) } finally { human.finish(context) }
  }
  const create = async () => {
    const context = await read("questioner")
    const reference = ok(await records.issue({ page: "All Projects", recordType: "projects", recordId: "project", fields: ["name", "status"], period }, context))
    const draft = { kind: "question" as const, sourceRef: reference.refId, sourceIncarnation: reference.target.incarnation, observedVersion: reference.target.version, period, recipientRef: "recipient", body: "Please check the selected project.", evidenceRefs: [reference] }
    const mutation = { expectedStorageVersion: 0, idempotencyKey: "create-question" }
    const thread = await withHuman("questioner", "collaboration.thread.create", { draft, mutation }, (call) => collaboration.threads.create(draft, mutation, call))
    const version = ok(await collaboration.storageVersion("threads", await read("recipient")))
    const replyMutation = { expectedStorageVersion: version, idempotencyKey: "recipient-reply" }
    const replied = await withHuman("recipient", "collaboration.thread.reply", { id: thread.id, body: answer, mutation: replyMutation }, (call) => collaboration.recipientActions!.reply(thread.id, answer, replyMutation, call))
    return { thread, reference, replied }
  }
  const answerRead = async (id: string, actor = "recipient") => {
    const payload = { questionRef: id }
    const context = await read(actor, "sf_answer_read", payload)
    const capability = collaboration.capabilities.find((entry) => entry.id === "sf_answer_read")
    if (!capability) throw new Error("Real sf_answer_read capability missing")
    return { context, result: await capability.handler(payload, context) }
  }
  return { store, persistence, records, state, collaboration, read, create, answerRead, availability, mutate,
    revoke: () => persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = roleMap(snapshot, "dashboard").filter((entry) => entry.entra !== "admins:recipient")
      return { commit: true, value: undefined }
    }),
    dispose: async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}

test("diagnostic 9: non-C05 question and recipient reply reach the real sf_answer_read capability", async () => {
  const f = await fixture()
  try {
    const selected = await f.create()
    expect(selected.thread.messages[0]?.sourceContext?.reviewContext).toBeUndefined()
    expect(selected.replied.messages.at(-1)?.authorRef).toBe("recipient")
    expect(selected.replied.messages.at(-1)?.body).toBe(answer)
    const read = await f.answerRead(selected.thread.id)
    expect(read.result.status).toBe("ok")
    if (read.result.status !== "ok") throw new Error(JSON.stringify(read.result))
    expect(read.result.result).toMatchObject({ questionRef: selected.thread.id, answer, state: "unconfirmed" })
    expect(JSON.stringify(read.result)).not.toContain(original.notes)
    const current = ok(await f.collaboration.threadReads.read(selected.thread.id, read.context))
    expect(current.evidenceRefs).toHaveLength(1)
    expect(current.evidenceRefs[0]?.refDigest).not.toBe(selected.reference.refDigest)
  } finally { await f.dispose() }
}, 120_000)

test("diagnostic 9: an actual source resolver outage remains unavailable without answer text", async () => {
  const f = await fixture()
  try {
    const selected = await f.create()
    expect((await f.answerRead(selected.thread.id)).result.status).toBe("ok")
    f.availability.sources = false
    const read = await f.answerRead(selected.thread.id)
    expect(read.result.status).toBe("unavailable")
    expect(JSON.stringify(read.result)).not.toContain(answer)
  } finally { await f.dispose() }
}, 120_000)

test("diagnostic 9: persisted recipient-role revocation invalidates an admitted answer read", async () => {
  const f = await fixture()
  try {
    const selected = await f.create()
    const context = await f.read("recipient", "sf_answer_read", { questionRef: selected.thread.id })
    await f.revoke()
    const capability = f.collaboration.capabilities.find((entry) => entry.id === "sf_answer_read")!
    const result = await capability.handler({ questionRef: selected.thread.id }, context)
    expect(result.status).toBe("denied")
    expect(JSON.stringify(result)).not.toContain(answer)
  } finally { await f.dispose() }
}, 120_000)
