import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createDashboardConfirmationIssuer } from "../../../product/dashboard/confirmation-issuer.ts"
import { createDashboardPreparedReview } from "../../../product/dashboard/prepared-review.ts"
import { hotTopicReceiptVersion, prepareHotTopicDraft } from "../../../product/dashboard/hot-topic-draft.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { HotTopicDraft } from "../../../product/dashboard/hot-topic-draft.ts"
import type { ChoiceRecord } from "../../../product/contracts/decisions.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

async function fixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-dashboard-prepared-review-"))
  const store = await openLocalStore(directory)
  const clock = { at: "2026-11-13T00:00:00Z", principal: "author", allowed: true }
  const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => clock.at) })
  await persistence.initializeSources("dashboard")
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]
    snapshot.data.hotTopics = [{ id: "topic", action: "Old action", owner: "owner", due: "2026-12-01", status: "done", priority: "normal", notes: "Old notes" }]
    snapshot.versions["hotTopics:topic"] = { version: 3, by: "author" }
    return { commit: true, value: undefined }
  })
  const context = (principal: string) => ({ kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: principal, requestId: randomUUID(), policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} }) as unknown as TrustedDomainContext
  const actor = (principal: string) => ({ id: principal, roles: ["admin"], canWrite: true, assigned: [], domains: [] })
  const host: DomainPortHost = { persistence, authenticate: async (_request, current) => clock.allowed ? resolve(clock.principal, [...current!.roleMap], (group) => group === "admins") : null, environment: async () => ({ at: clock.at, id: randomUUID, directory: [] }), requestFor: () => new Request("https://example.test"), revalidate: async (binding) => clock.allowed && binding.binding.principalRef === clock.principal }
  const issue = createDashboardConfirmationIssuer({ host, scopedSources: persistence })
  const period = { start: "2026-11-13", end: "2026-11-13" }
  const fields = ["action", "due", "notes", "owner", "priority"]
  const evidence = await issue({ recordType: "hotTopics", recordId: "topic", fields, period }, context("author"))
  if (evidence.status !== "ok") throw new Error("Fixture evidence unavailable")
  const target = { surface: "dashboard" as const, type: "hotTopics", id: "topic", incarnation: evidence.value.target.incarnation, version: evidence.value.target.version, fields, period, observedAt: clock.at }
  const base = { schema: "sf-hot-topic-draft-v1" as const, id: "draft", incarnation: "draft-inc", version: 1, draftRef: "draft-ref", caseRef: { id: "case", incarnation: "case-inc", version: 3 }, caseScopeDigest: "case-scope", target, targetEvidence: evidence.value, fields: { action: "Revised action", owner: "owner", due: "2026-12-20", priority: "high" as const, notes: "Review with evidence" }, sourceRefs: [evidence.value], principalRef: "author", accessRevision: "1", policyVersion: "1", createdAt: clock.at }
  const draft: HotTopicDraft = { ...base, recordDigest: digestSfValue(base) }
  const operation = { kind: "replace" as const, targetRef: evidence.value.refId, replacementRef: draft.draftRef }
  const choice = { id: "choice", scenario: { operations: [operation] } } as unknown as ChoiceRecord
  // The host owns this private binding; this fixture exercises the domain adapter, not a native case grant.
  const bindingDigest = digestSfValue({ draft, choice, operation })
  await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.__sfProductV1 = { preferences: { "test:choice-binding": bindingDigest } }; return { commit: true, value: undefined } })
  const snapshot = () => persistence.transaction("dashboard", async (value) => ({ commit: false, value: structuredClone(value) }))
  const prepare = async () => {
    const result = await prepareHotTopicDraft({ snapshot: await snapshot(), actor: actor("author"), environment: await host.environment(new Request("https://example.test")), draft, choice, operation, caseRef: draft.caseRef,
      context: context("author"), expectedAccessRevision: "1", expectedPolicyVersion: "1", issueCurrentTarget: issue,
      operationId: "operation", idempotencyKey: "apply-choice", verifyDraftBinding: (value) => {
        const state = value.data.__sfProductV1 as { preferences?: Record<string, unknown> } | undefined
        return state?.preferences?.["test:choice-binding"] === bindingDigest
      } })
    if (result.status === "ok") await persistence.transaction("dashboard", async (snapshot) => {
      (snapshot.data.__sfProductV1 as { preferences: Record<string, unknown> }).preferences["test:prepared-binding"] = digestSfValue(result.value.command)
      return { commit: true, value: undefined }
    })
    return result
  }
  const review = createDashboardPreparedReview({ host, issueSource: issue, verifyPreparedBinding: async (snapshot, command) => {
    const state = snapshot.data.__sfProductV1 as { preferences?: Record<string, unknown> } | undefined
    return !!persistence.currentSnapshots?.()?.planner && state?.preferences?.["test:prepared-binding"] === digestSfValue(command)
  } })
  return { store, directory, persistence, host, issue, clock, context, actor, draft, prepare, snapshot, review, dispose: async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) } }
}

test("C12 dashboard producer prepares, independently reviews and applies the canonical Hot Topic without reopening it", async () => {
  const run = await fixture()
  try {
    const prepared = await run.prepare()
    expect(prepared.status).toBe("ok")
    if (prepared.status !== "ok") return
    expect(prepared.value.command.expectedVersion).toBe(3)
    expect(prepared.value.command.command.confirmed).not.toBe(true)
    expect((await run.snapshot()).data.hotTopics).toMatchObject([{ action: "Old action", status: "done" }])
    run.clock.principal = "reviewer"
    const review = await run.review(prepared.value.command, run.context("reviewer"))
    expect(review.status).toBe("ok")
    if (review.status !== "ok") return
    expect(review.value.fields).toContainEqual({ field: "action", before: "Old action", after: "Revised action" })
    expect(review.value.source.target.incarnation).not.toBe(run.draft.target.incarnation)
    expect(review.value.originalTargetDigest).toBe(digestSfValue(run.draft.target))
    expect(JSON.stringify(review.value)).not.toContain('"command"')
    run.clock.principal = "author"
    const outcome = await run.persistence.transaction("dashboard", async (snapshot) => prepared.value.mutation.execute(snapshot, run.actor("author"), await run.host.environment(new Request("https://example.test"))))
    expect(outcome).toEqual({ status: "applied" })
    const applied = await run.snapshot()
    expect(applied.data.hotTopics).toMatchObject([{ id: "topic", action: "Revised action", due: "2026-12-20", notes: "Review with evidence", status: "done" }])
    expect(hotTopicReceiptVersion(applied, run.actor("author"), { surface: "dashboard", type: "hotTopics", id: "topic" })).toBe(4)
    expect((await run.review(prepared.value.command, run.context("author"))).status).not.toBe("ok")
  } finally { await run.dispose() }
})

test("C12 review rejects a forged preview, changed source, revocation and changed private choice binding", async () => {
  const run = await fixture()
  try {
    const prepared = await run.prepare()
    expect(prepared.status).toBe("ok")
    if (prepared.status !== "ok") return
    const forged = structuredClone(prepared.value.command)
    forged.preview = { ...forged.preview, values: forged.preview.values.map((value) => value.id.endsWith(":action") ? { ...value, value: "Unreviewed replacement" } : value) }
    expect((await run.review(forged, run.context("author"))).status).not.toBe("ok")
    forged.command.values.action = "Unreviewed replacement"
    expect(forged.commandDigest).toBe(prepared.value.command.commandDigest)
    expect((await run.review(forged, run.context("author"))).status).not.toBe("ok")
    const unbound = createDashboardPreparedReview({ host: run.host, issueSource: run.issue } as Parameters<typeof createDashboardPreparedReview>[0])
    expect((await unbound(prepared.value.command, run.context("author"))).status).toBe("denied")
    run.clock.allowed = false
    expect(await run.review(prepared.value.command, run.context("author"))).toMatchObject({ status: "denied" })
    run.clock.allowed = true
    const changed = await run.snapshot()
    ;(changed.data.__sfProductV1 as { preferences: Record<string, unknown> }).preferences["test:choice-binding"] = "different"
    const before = structuredClone(changed)
    expect(prepared.value.mutation.execute(changed, run.actor("author"), { at: run.clock.at, id: randomUUID, directory: [] })).toEqual({ commit: false, value: { status: "conflict", reason: "hot-topic-choice-binding-changed" } })
    expect(changed).toEqual(before)
    await run.persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.hotTopics as { action: string }[])[0]!.action = "Concurrent edit"; return { commit: true, value: undefined } })
    expect((await run.review(prepared.value.command, run.context("author"))).status).not.toBe("ok")
  } finally { await run.dispose() }
})
