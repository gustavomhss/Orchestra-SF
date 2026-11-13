import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { Actor, Snapshot } from "../../../runtime/contract.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import type { SfSourceScope } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { simulateDashboardCommand, applyDashboardPreview } from "../../../product/dashboard/commands.ts"
import { dashboardMutationImpact, prepareDashboardMutationScope } from "../../../product/dashboard/mutation-scope.ts"
import { createDashboardPreparedMutation } from "../../../product/dashboard/prepared.ts"
import { createSfPreparedApply } from "../../../product/decisions/prepared-apply.ts"
import { proposalReviewDigest, receiptProofTransactionKey, receiptReviewBinding, sameApplyRequest } from "../../../product/decisions/receipt-review-binding.ts"
import type { ReviewDigestFor } from "../../../product/decisions/receipt-review-binding.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DecisionCase, PreparedChange } from "../../../product/contracts/decisions.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

test("human-approved prepared dashboard command and receipt commit together", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-apply-real-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const actor = { id: "admin", roles: ["admin"], canWrite: true, assigned: [], domains: [] }
  const project = (snapshot: Snapshot, _actor: Actor, scope: SfSourceScope) => (snapshot.data[scope.recordType] as { id: string }[] | undefined)?.find((row) => row.id === scope.recordId)
  const persistence = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, createId: randomUUID, projectScope: (_surface, snapshot, scope) => project(snapshot, actor, scope) })
  try {
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.opexOwners = [{ id: "o", name: "Owner", budget: 1200 }]; snapshot.data.opexEntries = []; return { commit: true, value: null } })
    const snapshot = await persistence.transaction("dashboard", async (current) => ({ commit: false, value: structuredClone(current) }))
    const period = { start: "2026-01-01", end: "2026-12-31" }
    const command = { page: "OPEX Detail", action: "annual-entry", id: "o", version: 0, values: { year: 2026, annual: 2400 } }
    const ids = Array.from({ length: 12 }, (_, index) => `month-${index + 1}`)
    const environment = () => { let used = 0; return { at: "2026-11-13T00:00:00Z", id: () => ids[used++] ?? "", directory: [] } }
    const preview = simulateDashboardCommand(snapshot, actor, command, environment())
    if (preview.status !== "preview") throw new Error("preview unavailable")
    const staged = structuredClone(snapshot)
    expect(applyDashboardPreview(staged, actor, command, environment(), preview.baseDigest, preview.commandDigest).ok).toBe(true)
    const impact = dashboardMutationImpact(snapshot, staged, command, period)
    if (!impact) throw new Error("impact unavailable")
    const scope = { principalRef: actor.id, accessRevision: "1", policyVersion: "1", recordType: "opexOwners", recordId: "o", selector: { actor, fields: ["budget"], period } }
    const issued = await persistence.readScopedSource("dashboard", scope, async () => true)
    if (!issued) throw new Error("source unavailable")
    const target = { surface: "dashboard" as const, type: "opexOwners", id: "o", incarnation: issued.incarnation, version: issued.version, fields: ["budget"], period, observedAt: "2026-11-13T00:00:00Z" }
    const proof = prepareDashboardMutationScope({ snapshot, actor, environment: environment(), command, baseDigest: preview.baseDigest, previewDigest: preview.commandDigest, period, targets: [{ source: target, scope }], creates: impact.filter((entry) => entry.operation === "create").map((entry) => ({ type: entry.type, id: entry.id, fields: entry.fields, period: entry.period })), reservedIds: ids })
    if (!proof) throw new Error("scope unavailable")
    const mutation = createDashboardPreparedMutation({ actorId: actor.id, target, command, baseDigest: preview.baseDigest, previewDigest: preview.commandDigest, idempotencyKey: "annual", mutationScope: proof, projectScope: project })
    if (!mutation) throw new Error("mutation unavailable")
    const change = { id: "change", caseId: "case", caseVersion: 1, choiceId: "choice", target, expectedVersion: 0, operation: { id: "command", target, command, idempotencyKey: "annual", commandDigest: mutation.commandDigest, expectedVersion: 0, requiredAuthority: [], preview: {} }, preview: {}, requiredAuthority: [], idempotencyKey: "annual", state: "planned" } as unknown as PreparedChange
    const decision = { id: "case", incarnation: "case-inc", version: 1, state: "chosen", participants: [actor.id], choices: [{ id: "choice" }], preparedChanges: [change] } as unknown as DecisionCase
    const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: actor.id, requestId: "request", policyVersion: "1", accessRevision: "1", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    const state = createSfProductState({ persistence, createId: () => "state", resolveTarget: async (_request, _snapshot, namespace) => ({ incarnation: namespace === "cases" ? "case-inc" : target.incarnation }), authorize: async () => ({ principalRef: actor.id, policyVersion: "1", accessRevision: "1" }) })
    const http = new Request("https://example.test")
    await state.transaction(http, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed", commandDigest: "a".repeat(64), targetRef: "case", targetIncarnation: "case-inc" }, async (value) => { value.cases.case = decision; return { commit: true, value: true } })
    const request = { caseRef: { id: "case", incarnation: "case-inc", version: 1 }, changeId: "change", choiceId: "choice" }
    const display = (value: unknown): string | number | boolean | null => value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : JSON.stringify(value) ?? null
    const approval = { human: false, available: true, fields: preview.changes.map((entry) => ({ field: entry.path, before: entry.before.state === "value" ? display(entry.before.value) : null, after: entry.after.state === "value" ? display(entry.after.value) : null })) }
    const reviewDigestFor: ReviewDigestFor = (binding, incoming, selected) => binding === context && approval.available && sameApplyRequest(incoming, request) && digestSfValue(selected.operation) === digestSfValue(change.operation)
      ? proposalReviewDigest({ caseId: decision.id, caseIncarnation: decision.incarnation, changeCaseVersion: selected.caseVersion, choiceDigest: digestSfValue(decision.choices[0]), change: selected, fields: approval.fields, sourceRefDigest: digestSfValue(target) })
      : undefined
    const reviewDigest = reviewDigestFor(context, request, change)
    if (!reviewDigest || !approval.fields.length) throw new Error("real review material unavailable")
    const apply = createSfPreparedApply({ state, host: { requestFor: () => new Request("https://example.test"), revalidate: async () => true }, authorizeCase: async () => true, authorizeLookup: async () => true, authorizeReceipt: async () => true, confirmHuman: async () => approval.human, reviewDigestFor, resolveActor: () => actor, resolveMutation: () => mutation, verifyGrant: () => true, receiptVersion: () => 1, environment, createId: () => "receipt", now: () => "2026-11-13T00:00:00Z" })
    approval.available = false
    expect(await apply.executePrepared(request, context)).toMatchObject({ status: "needs-input", reason: "review-proof-required" })
    expect(await persistence.transaction("dashboard", async (value) => ({ commit: false, value: value.data.opexEntries }))).toEqual([])
    approval.available = true
    expect((await apply.executePrepared(request, context)).status).toBe("denied")
    approval.human = true
    const applied = await apply.executePrepared(request, context)
    expect(applied.status).toBe("ok")
    if (applied.status !== "ok") throw new Error("prepared dashboard command was not applied")
    const recorded = await state.read(http, "receipts", (value) => value.transactions[receiptProofTransactionKey(actor.id, target.id, change.idempotencyKey)])
    expect(recorded).toMatchObject({ status: "ok", value: { commandDigest: receiptReviewBinding(change, reviewDigest), value: applied.value } })
    const entries = await persistence.transaction("dashboard", async (value) => ({ commit: false, value: value.data.opexEntries }))
    expect(entries).toHaveLength(12)
    const lookup = await apply.readReceipt({ surface: "dashboard", targetRef: "o", targetIncarnation: target.incarnation, idempotencyKey: "annual", commandDigest: mutation.commandDigest }, context)
    expect(lookup).toMatchObject({ status: "ok", value: { state: "found", receipt: { id: "receipt" } } })
    expect((await apply.readReceipt({ surface: "dashboard", targetRef: "o", targetIncarnation: target.incarnation, idempotencyKey: "annual", commandDigest: "f".repeat(64) }, context)).status).toBe("conflict")
    approval.human = false
    expect(await apply.executePrepared(request, context)).toEqual(applied)
    const beforeRejected = await persistence.transaction("dashboard", async (value) => ({ commit: false, value: structuredClone(value) }))
    const fieldIndex = approval.fields.findIndex((entry) => digestSfValue(entry.before) !== digestSfValue(entry.after))
    const displayed = approval.fields[fieldIndex]
    if (!displayed) throw new Error("changed review field unavailable")
    approval.fields = approval.fields.map((entry, index) => index === fieldIndex ? { ...displayed, after: displayed.before } : entry)
    expect(reviewDigestFor(context, request, change)).not.toBe(reviewDigest)
    expect(await apply.executePrepared(request, context)).toMatchObject({ status: "conflict", reason: "idempotency-content-changed" })
    expect(await persistence.transaction("dashboard", async (value) => ({ commit: false, value: value }))).toEqual(beforeRejected)
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
