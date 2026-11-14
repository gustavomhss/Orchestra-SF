import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { createSfSourcePersistence, sfScopedSourceIdentity } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createCollaborationSourceFence } from "../../../product/collaboration/source-fence.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

test("C06 source fence is read-only inside SQLite C08 and detects material change and revocation", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-confirmation-fence-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const at = "2026-11-13T00:00:00Z"
  const context = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "admin", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
  const current = { request: new Request("https://example.test", { headers: { authorization: "admin" } }) }
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]
      snapshot.data.hotTopics = [{ id: "topic-1", status: "open", action: "initial" }]
      return { commit: true, value: undefined }
    })
    const authenticate: DomainPortHost["authenticate"] = async (request, options) => request.headers.get("authorization") === "admin" && options ? resolve("admin", [...options.roleMap], (group) => group === "admins") : null
    const host: DomainPortHost = { persistence, authenticate, environment: async () => ({ at, id: randomUUID, directory: [{ id: "admin", name: "Admin" }] }), requestFor: () => current.request, revalidate: async () => current.request.headers.get("authorization") === "admin" }
    const issuer = createDashboardRecordSourceIssuer({ host, scopedSources: persistence })
    const issued = await issuer({ page: "Hot Topics & Actions", recordType: "hotTopics", recordId: "topic-1", fields: ["status"], period: { start: "2026-11-13", end: "2026-11-13" } }, context)
    if (!issued) throw new Error("source issue failed")
    const before = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: sfScopedSourceIdentity(snapshot, issued.scope) }))
    if (!before) throw new Error("source identity missing")
    const proof = { surface: "dashboard" as const, scope: issued.scope, expected: { incarnation: before.incarnation, version: before.version, inputDigest: before.inputDigest } }
    const fence = createCollaborationSourceFence({ host, scopedSources: persistence })
    expect(await fence(proof, context)).toEqual({ status: "ok", value: true })
    const state = createSfProductState({ persistence, createId: randomUUID, authorize: async (request) => request.headers.get("authorization") === "admin" ? { principalRef: "admin", accessRevision: "1", policyVersion: "1" } : undefined, resolveTarget: async () => ({ incarnation: "workspace-inc" }) })
    const saved = await state.transaction(current.request, { namespace: "relations", expectedStorageVersion: 0, targetRef: "workspace", targetIncarnation: "workspace-inc", idempotencyKey: "fence", commandDigest: "a".repeat(64) }, async (staged) => {
      const checked = await fence(proof, context)
      if (checked.status !== "ok") return { commit: false, value: false }
      staged.relations.example = { checked: true }
      return { commit: true, value: true }
    })
    expect(saved).toMatchObject({ status: "ok", value: true })
    expect(await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: sfScopedSourceIdentity(snapshot, issued.scope) }))).toEqual(before)
    await persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.hotTopics as { action: string }[])[0]!.action = "irrelevant"; return { commit: true, value: undefined } })
    expect(await fence(proof, context)).toEqual({ status: "ok", value: true })
    await persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.hotTopics as { status: string }[])[0]!.status = "done"; return { commit: true, value: undefined } })
    expect((await fence(proof, context)).status).toBe("stale")
    current.request = new Request("https://example.test", { headers: { authorization: "other" } })
    expect((await fence(proof, context)).status).not.toBe("ok")
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
