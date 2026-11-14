import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfWorkspaceServices } from "../../../../../../../apps/cli/src/sucafina-product/workspace-services.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"

const origin = "https://example.test"
const mount = "/sucafina"

function request(route: string, payload: unknown) {
  return new Request(`${origin}${mount}/dashboard?sf=collaboration-${route}`, {
    method: "POST", headers: { origin, "content-type": "application/json", "sec-fetch-site": "same-origin" },
    body: JSON.stringify(payload),
  })
}

async function fixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-workspace-composition-"))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(path.join(directory, "store"))
  const persistence = { ...driver, ...createSfSourcePersistence({ persistence: driver, createId: randomUUID,
    enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => "2026-11-14T00:00:00Z") }) }
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  const actor = { active: true, write: true, role: "admin" }
  const identity = { installationId: "installation", hostId: "host", projectId: "project",
    location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const caseSelectionWrites = new WeakSet<object>()
  const threadHistoryWrites = new WeakSet<object>()
  const proposalCoverageWrites = new WeakSet<object>()
  const dashboardHostWrites = new WeakSet<object>()
  const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId, origin,
    policyVersion: "policy", persistence, caseSelectionWrites, threadHistoryWrites, proposalCoverageWrites, dashboardHostWrites,
    grants: [{ principalRef: "person", namespaces: ["preferences", "threads", "relations", "confirmations"],
      operations: ["sf_work_list", "sf_answer_read"], humanActions: ["collaboration.thread.reply"] }],
    now: Date.now, createId: randomUUID,
    authenticate: async (_request, scope) => actor.active && scope
      ? { id: "person", canWrite: actor.write, roles: [{ surface: scope.surface, role: actor.role }] } : null,
    environment: async () => ({ at: "2026-11-14T00:00:00Z", id: randomUUID, directory: [] }),
    commandIdentity: async (_request, operation, inputDigest) => digestSfValue({ operation, inputDigest }),
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
    providerGeneration: async () => undefined, authorizeDocument: async () => undefined })
  // Initialize C08 through its real transactional authority, without inventing a thread, source or native run.
  const initialized = await authority.state.transaction(request("storage-version", { namespace: "threads" }), {
    namespace: "preferences", expectedStorageVersion: 0, targetRef: authority.creationTarget.ref,
    targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "initialize-workspace-fixture",
    commandDigest: digestSfValue({ marker: "workspace-composition-fixture" }),
  }, async (state) => {
    state.preferences["workspace-composition-fixture"] = { marker: "initialized" }
    return { commit: true, value: true }
  })
  if (initialized.status !== "ok") throw new Error("Workspace fixture could not initialize real C08 storage")
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites, dashboardHostWrites, caseSelectionWrites, threadHistoryWrites })
  const workspace = createSfWorkspaceServices({ authority, business, persistence, origin, mount, caseSelectionWrites, threadHistoryWrites })
  business.descriptors.push(...workspace.descriptors)
  actor.write = false
  actor.role = "viewer"
  return { authority, business, workspace, actor,
    close: async () => { business.dispose(); await driver.dispose(); await rm(directory, { recursive: true, force: true }) } }
}

test("real workspace descriptors survive Atlas initialization and a second initialization does not duplicate operations", async () => {
  const state = await fixture()
  try {
    const expected = ["sf_review_prepare", "sf_report_prepare", "sf_artifact_get", "sf_bi_view"]
    expect(state.workspace.collaboration).toBe(state.business.collaboration)
    expect(state.business.collaboration.capabilities.map((descriptor) => descriptor.id).toSorted()).toEqual([
      "sf_work_list", "sf_question_prepare", "sf_answer_read", "sf_relation_read", "sf_handoff_prepare"].toSorted())
    expect(state.workspace.descriptors.map((descriptor) => descriptor.id).toSorted()).toEqual(expected.toSorted())
    const mounted = [...state.business.descriptors]
    for (const descriptor of state.workspace.descriptors) expect(mounted.find((entry) => entry.id === descriptor.id)).toBe(descriptor)
    const atlas = ["sf_context_get", "sf_source_get", "sf_evidence_get", "sf_decision_recall", "sf_freshness_check"]
    const versions = { boundaryVersion: "workspace-test-v1", schemaVersion: "a".repeat(64), manifestVersion: "b".repeat(64), skillVersion: "c".repeat(64) }
    // An absent scanner still composes fail-closed descriptors; this asserts no scanner availability or native execution.
    state.business.initializeAtlas(undefined, versions)
    const first = state.business.descriptors.map((descriptor) => descriptor.id).toSorted()
    expect(first).toEqual([...mounted.map((descriptor) => descriptor.id), ...atlas].toSorted())
    for (const descriptor of mounted) expect(state.business.descriptors.find((entry) => entry.id === descriptor.id)).toBe(descriptor)
    state.business.initializeAtlas(undefined, versions)
    expect(state.business.descriptors.map((descriptor) => descriptor.id).toSorted()).toEqual(first)
    expect(new Set(state.business.descriptors.map((descriptor) => descriptor.id)).size).toBe(state.business.descriptors.length)
    for (const descriptor of mounted) expect(state.business.descriptors.find((entry) => entry.id === descriptor.id)).toBe(descriptor)
  } finally { await state.close() }
})

test("workspace HTTP permits an explicitly granted viewer read but cannot turn that lease or a human action grant into a write", async () => {
  const state = await fixture()
  try {
    const payload = { namespace: "threads" }
    const before = await state.authority.state.read(request("storage-version", payload), "threads", (stored) => stored.threads)
    expect(before.status).toBe("ok")
    if (before.status !== "ok") throw new Error("The fixture must expose a real initialized C08 read")
    const response = await state.workspace.http(request("storage-version", payload), "dashboard")
    expect(response?.status).toBe(200)
    expect(response?.headers.get("cache-control")).toBe("no-store")
    expect(await response?.json()).toEqual({ status: "ok", value: before.storageVersion })

    const operation = "sf-read:collaboration.storage.version"
    const admitted = await state.authority.ui.admit(request("storage-version", payload), operation, digestSfValue(payload))
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") throw new Error("Viewer read lease was not admitted")
    try {
      expect(await state.authority.ui.validate(admitted.value, operation, digestSfValue(payload))).toBe(true)
      expect(await state.authority.human.authorize(admitted.value, "collaboration.thread.reply", payload)).toBe(false)
      const write = { id: "uncreated-thread", body: "Viewer must not write",
        mutation: { expectedStorageVersion: before.storageVersion, idempotencyKey: "viewer-write-attempt" } }
      expect((await state.authority.human.admit(request("thread-reply", write), "collaboration.thread.reply", write)).status).toBe("denied")
      const denied = await state.workspace.http(request("thread-reply", write), "dashboard")
      expect(denied?.status).toBe(403)
      expect(await denied?.json()).toMatchObject({ status: "denied" })
      const after = await state.authority.state.read(request("storage-version", payload), "threads", (stored) => stored.threads)
      expect(after.status).toBe("ok")
      if (after.status !== "ok") throw new Error("Denied viewer write must leave the readable C08 state intact")
      expect(after.storageVersion).toBe(before.storageVersion)
      expect(after.aggregateRevision).toBe(before.aggregateRevision)
      expect(after.value).toEqual(before.value)
    } finally { state.authority.ui.finish(admitted.value) }
  } finally { await state.close() }
})

test("the real collaboration read rejects a revoked live lease and the HTTP route rejects a new admission", async () => {
  const state = await fixture()
  try {
    const payload = { namespace: "threads" }
    const operation = "sf-read:collaboration.storage.version"
    const admitted = await state.authority.ui.admit(request("storage-version", payload), operation, digestSfValue(payload))
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") throw new Error("Viewer read lease was not admitted")
    try {
      expect(await state.authority.ui.validate(admitted.value, operation, digestSfValue(payload))).toBe(true)
      expect(await state.workspace.collaboration.storageVersion("threads", admitted.value)).toEqual({ status: "ok", value: 0 })
      state.actor.active = false
      expect(await state.authority.ui.revalidate(admitted.value)).toBe(false)
      expect((await state.workspace.collaboration.storageVersion("threads", admitted.value)).status).toBe("denied")
      const denied = await state.workspace.http(request("storage-version", payload), "dashboard")
      expect(denied?.status).toBe(403)
      expect(await denied?.json()).toMatchObject({ status: "denied" })
    } finally { state.authority.ui.finish(admitted.value) }
  } finally { await state.close() }
})
