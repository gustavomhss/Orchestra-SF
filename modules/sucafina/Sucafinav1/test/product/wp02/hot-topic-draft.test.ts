import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { hotTopicReceiptVersion, previewHotTopicDraft, resolveHotTopicDraftOperation } from "../../../product/dashboard/hot-topic-draft.ts"
import { createSfSourcePersistence, sfSourceIdentity } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardRecordEvidenceHost } from "../../../product/dashboard/sources.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { ChoiceRecord } from "../../../product/contracts/decisions.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { HotTopicDraft } from "../../../product/dashboard/hot-topic-draft.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { Snapshot } from "../../../runtime/contract.ts"

const at = "2026-11-13T00:00:00Z"
const period = { start: "2026-11-13", end: "2026-11-13" }
const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "admin", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
const actor = { id: "admin", roles: ["admin"], canWrite: true, assigned: [], domains: [] }

test("receipt version comes from one actor-visible canonical topic and domain version", () => {
  const snapshot: Snapshot = { data: { summaries: ["Hot Topics & Actions"], hotTopics: [{ id: "topic", action: "Review" }] }, versions: { "hotTopics:topic": { version: 4, by: "admin" } }, sequences: {}, audit: [], notices: [] }
  expect(hotTopicReceiptVersion(snapshot, actor, { surface: "dashboard", type: "hotTopics", id: "topic" })).toBe(4)
  expect(hotTopicReceiptVersion(snapshot, actor, { surface: "dashboard", type: "hotTopics", id: "missing" })).toBeUndefined()
  expect(hotTopicReceiptVersion({ ...snapshot, data: { ...snapshot.data, summaries: [] } }, { ...actor, roles: ["viewer"] }, { surface: "dashboard", type: "hotTopics", id: "topic" })).toBeUndefined()
  expect(hotTopicReceiptVersion({ ...snapshot, data: { ...snapshot.data, hotTopics: [{ id: "topic" }, { id: "topic" }] } }, actor, { surface: "dashboard", type: "hotTopics", id: "topic" })).toBeUndefined()
  expect(hotTopicReceiptVersion(snapshot, actor, { surface: "planner", type: "hotTopics", id: "topic" })).toBeUndefined()
  expect(hotTopicReceiptVersion({ ...snapshot, versions: {} }, actor, { surface: "dashboard", type: "hotTopics", id: "topic" })).toBeUndefined()
})

 test("draft preview uses reissued scoped identity and rejects stale or revoked authority", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-hot-topic-draft-"))
  const store = await openLocalStore(directory)
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]; snapshot.data.hotTopics = [{ id: "topic", action: "Old", owner: "owner", due: "2026-12-01", status: "open", priority: "normal", notes: "" }]; return { commit: true, value: undefined } })
    const current = { request: new Request("https://example.test", { headers: { authorization: "admin" } }) }
    const host: DomainPortHost = { persistence, authenticate: async (request, context) => request.headers.get("authorization") === "admin" ? resolve("admin", [...context!.roleMap], (group) => group === "admins") : null, environment: async () => ({ at, id: randomUUID, directory: [] }), requestFor: () => current.request, revalidate: async () => persistence.transaction("dashboard", async () => ({ commit: false, value: true })) }
    const evidenceHost = createDashboardRecordEvidenceHost({ host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: persistence }) })
    const selection = { page: "Hot Topics & Actions", recordType: "hotTopics", recordId: "topic", fields: ["action", "owner", "due", "priority", "notes"], period }
    const issued = await evidenceHost.issue(selection, binding)
    expect(issued.status).toBe("ok")
    if (issued.status !== "ok") return
    const snapshot = await persistence.transaction("dashboard", async (state) => ({ commit: false, value: structuredClone(state) })) as Snapshot
    const physical = sfSourceIdentity(snapshot, "hotTopics", "topic")
    expect(issued.value.target.incarnation).not.toBe(physical?.incarnation)
    const source = { surface: "dashboard" as const, type: "hotTopics", id: "topic", incarnation: issued.value.target.incarnation, version: issued.value.target.version, fields: selection.fields, period, observedAt: at }
    const draftBase = { schema: "sf-hot-topic-draft-v1" as const, id: "draft", incarnation: "draft-inc", version: 1, draftRef: "draft-ref", caseRef: { id: "case", incarnation: "case-inc", version: 3 }, caseScopeDigest: "scope", target: source, targetEvidence: issued.value, fields: { action: "New", owner: "owner", due: "2026-12-20", priority: "high" as const, notes: "Explicit human draft" }, sourceRefs: [issued.value], principalRef: "admin", accessRevision: "1", policyVersion: "1", createdAt: at }
    const draft: HotTopicDraft = { ...draftBase, recordDigest: digestSfValue(draftBase) }
    const operation = { kind: "replace" as const, targetRef: issued.value.refId, replacementRef: draft.draftRef }
    const choice = { id: "choice", evidenceRefs: [issued.value], scenario: { operations: [operation] } } as unknown as ChoiceRecord
    const makeInput = (value: HotTopicDraft, state = snapshot) => ({ snapshot: state, actor, environment: { at, id: randomUUID, directory: [] }, draft: value, choice, operation, caseRef: draft.caseRef, expectedAccessRevision: "1", expectedPolicyVersion: "1", context: binding, issueCurrentTarget: (target: { recordType: string; recordId: string; fields: readonly string[]; period: { start: string; end: string } }, context: TrustedDomainContext) => evidenceHost.issue({ ...target, page: "Hot Topics & Actions" }, context) })
    const preview = await previewHotTopicDraft(makeInput(draft))
    expect(preview.status).toBe("preview")
    expect(snapshot.data.hotTopics).toMatchObject([{ action: "Old" }])
    const resolved = await resolveHotTopicDraftOperation({ caseRef: draft.caseRef, draftRef: draft.draftRef, operation, actor, context: binding, expectedAccessRevision: "1", expectedPolicyVersion: "1", readCurrent: async () => ({ status: "ok", value: draft }), issueCurrentTarget: makeInput(draft).issueCurrentTarget })
    expect(resolved).toMatchObject({ status: "ok", value: { operationDigest: digestSfValue(operation), kind: "external", sourceRefs: [issued.value], condition: "Financial impact of the Hot Topic change is not assessed." } })
    expect(await resolveHotTopicDraftOperation({ caseRef: draft.caseRef, draftRef: draft.draftRef, operation: { ...operation, replacementRef: "other" }, actor, context: binding, expectedAccessRevision: "1", expectedPolicyVersion: "1", readCurrent: async () => ({ status: "ok", value: draft }), issueCurrentTarget: makeInput(draft).issueCurrentTarget })).toMatchObject({ status: "conflict", reason: "hot-topic-choice-binding-mismatch" })
    await persistence.transaction("dashboard", async (state) => { (state.data.hotTopics as { action: string }[])[0]!.action = "Changed"; return { commit: true, value: undefined } })
    const changedSnapshot = await persistence.transaction("dashboard", async (state) => ({ commit: false, value: structuredClone(state) })) as Snapshot
    expect(await previewHotTopicDraft(makeInput(draft, changedSnapshot))).toMatchObject({ status: "stale" })
    current.request = new Request("https://example.test", { headers: { authorization: "other" } })
    expect(await previewHotTopicDraft(makeInput(draft))).toMatchObject({ status: "denied", reason: "hot-topic-target-access-revoked" })
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
