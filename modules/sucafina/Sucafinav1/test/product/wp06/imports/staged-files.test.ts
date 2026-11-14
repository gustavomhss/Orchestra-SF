import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomBytes, randomUUID } from "node:crypto"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../../runtime/operator-identity.ts"
import { roleMap } from "../../../../runtime/admin.ts"
import { createSfSourcePersistence, sfSourceIdentity } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfProductState } from "../../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../../product/integration/ui-authority.ts"
import { createSfStagedImportFiles } from "../../../../product/imports/staged-files.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"

test("private import admission persists SQLite bytes and binds retries to the same target and content", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-import-file-"))
  const driver = await openLocalStore(directory)
  const store = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID })
  const identity = createOperatorIdentity({ origin: "http://localhost:4110", mount: "/sucafina", operator: { installationId: randomUUID(), uid: 1000, name: "Test operator" }, secrets: driver.secrets, key: randomBytes(32) })
  try {
    await store.initializeSources("dashboard")
    await store.transaction("dashboard", async (snapshot) => { snapshot.data.opexOwners = [{ id: "owner-1", budget: 100 }]; return { commit: true, value: undefined } })
    const enrolled = await identity.enroll()
    const session = await identity.handle(new Request(`http://localhost:4110/sucafina/auth/local?code=${enrolled}`))
    const cookie = session!.headers.get("set-cookie")!.split(";")[0]!
    const request = new Request("http://localhost:4110/sucafina/dashboard", { method: "POST", headers: { cookie, origin: "http://localhost:4110" } })
    const principal = await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: await identity.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") }) }))
    if (!principal) throw new Error("missing operator")
    const source = await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "opexOwners", "owner-1") }))
    if (!source) throw new Error("missing source")
    const ui = createSfUiAuthority({ authorize: async (received) => received === request ? { installationId: "installation", projectId: "project", principalRef: principal.id, policyVersion: "policy", accessRevision: "access" } : undefined, createId: randomUUID, now: () => Date.parse("2026-11-13T00:00:00Z"), commandIdentity: async () => "admission-1" })
    const admitted = await ui.admit(request, "sf_import_preview", "a".repeat(64))
    if (admitted.status !== "ok" || !await ui.validate(admitted.value, "sf_import_preview", "a".repeat(64))) throw new Error("missing UI authority")
    const context = admitted.value
    const state = createSfProductState({ persistence: store, createId: randomUUID,
      authorize: async (received, snapshot) => await identity.authenticate(received, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") }) ? { principalRef: principal.id, accessRevision: "access", policyVersion: "policy" } : undefined,
      resolveTarget: async (_, snapshot, __, target) => target === "owner-1" ? sfSourceIdentity(snapshot, "opexOwners", target) : undefined })
    await state.transaction(request, { namespace: "documents", expectedStorageVersion: 0, targetRef: "owner-1", targetIncarnation: source.incarnation, idempotencyKey: "bootstrap", commandDigest: "a".repeat(64) }, async () => ({ commit: true, value: true }))
    const host = { persistence: store, authenticate: identity.authenticate, environment: async () => ({ at: "2026-11-13T00:00:00Z", id: randomUUID, directory: [] }), requestFor: (value: TrustedDomainContext) => value.kind === "ui" ? ui.requestFor(value) : undefined, revalidate: async (value: TrustedDomainContext) => value.kind === "ui" && await ui.revalidate(value) }
    // The test exercises the actual SQLite and identity path; scanner fixture is not scanner qualification.
    const access = { allowed: true, admitted: true }
    const files = createSfStagedImportFiles({ host, assets: store, services: { scan: async () => true, signingKey: randomBytes(32) }, state, operationIdentity: (value) => value.kind === "ui" ? ui.operationIdentity(value) : undefined, authorizeAdmission: async () => access.admitted, authorizeTarget: async (target) => access.allowed && target.selectionRef === "owner-1" && target.incarnation === source.incarnation })
    const target = { surface: "dashboard" as const, selectionRef: "owner-1", incarnation: source.incarnation, version: source.version, options: { newVersion: false, removeMissing: false, preview: {} } }
    const bytes = new TextEncoder().encode('{"members":[]}')
    access.admitted = false
    expect((await files.admit({ target, format: "json", bytes }, context)).status).toBe("denied")
    access.admitted = true
    const first = await files.admit({ target, format: "json", bytes }, context)
    expect(first.status).toBe("ok")
    if (first.status !== "ok") return
    expect(await files.read(first.value.ref, context)).toEqual({ status: "ok", value: { bytes, digest: first.value.digest } })
    expect(await files.admit({ target, format: "json", bytes }, context)).toEqual(first)
    expect((await files.admit({ target, format: "json", bytes: new TextEncoder().encode("{}") }, context)).status).toBe("conflict")
    access.allowed = false
    expect((await files.read(first.value.ref, context)).status).toBe("denied")
    ui.finish(context)
    expect((await files.read(first.value.ref, context)).status).toBe("denied")
  } finally { await driver.dispose(); await rm(directory, { recursive: true, force: true }) }
})
