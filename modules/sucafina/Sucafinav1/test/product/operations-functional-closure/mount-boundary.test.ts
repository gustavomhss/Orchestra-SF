import { afterEach, expect, test } from "bun:test"
import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Schema } from "effect"
import { SfPlanner } from "@orchestra/schema/sucafina/planner"
import { SfFilesImportTargets } from "@orchestra/schema/sucafina/files"
import { microsoftNativeHost } from "../../microsoft-login/native-host.ts"
import { createOperationsInstallation } from "../../../../../../packages/app-shell/e2e/sucafina/operations-support/installation.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import type { Application } from "../../../runtime/application.ts"
import { ProcurementModule } from "../../../runtime/procurement.ts"
import { object, text } from "../../../runtime/contract.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { initializeAbsentSfProductState } from "../../../product/host-binding/state-provider.ts"

// These are real assembly regressions. They do not qualify the five browser journeys.
const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
  const failures: unknown[] = []
  for (const close of cleanups.splice(0).reverse()) {
    try { await close() } catch (error) { failures.push(error) }
  }
  if (failures.length) throw new AggregateError(failures, "Operations mount fixture cleanup failed")
})

async function fixture(readOnly = false) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-operations-mount-"))
  cleanups.push(() => rm(directory, { recursive: true, force: true }))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(directory)
  cleanups.push(() => driver.dispose())
  const at = "2026-11-13T12:00:00Z"
  const persistence = { ...driver, ...createSfSourcePersistence({
    persistence: driver, enumerate: enumerateSfSources,
    projectScope: createSfSourceScopeProjector(() => at), createId: randomUUID,
  }) }
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await initializeAbsentSfProductState(persistence, randomUUID)
  const installationId = randomUUID(), origin = "http://127.0.0.1:4174", mount = "/wp04/boundary"
  const principalRef = "macos:" + installationId + ":1001"
  const identity = createOperatorIdentity({
    origin, mount, operator: { installationId, uid: 1001, name: "Operations boundary operator", buyer: true },
    secrets: persistence.secrets, key: randomBytes(32),
  })
  const authenticate: Application["authenticate"] = async (request, context) => {
    const actor = await identity.authenticate(request, context)
    return actor && context && readOnly
      ? { ...actor, canWrite: false, roles: [{ surface: context.surface, role: "viewer" }] }
      : actor
  }
  const bankKey = randomBytes(32)
  const environment = async () => ({ at, id: randomUUID, directory: [{ id: principalRef, name: "Operations boundary operator" }], bankKey })
  const installation = await createOperationsInstallation({
    installationId, directory, origin, mount, operators: [{ principalRef, readOnly }],
    persistence, authenticate, environment,
    isAuthenticated: async (request) => Boolean(await identity.person(request)),
    signingKey: randomBytes(32), scanner: null,
  })
  const hostEnvironment = {
    ORCHESTRA_DB: path.join(directory, "host-data", "orchestra.db"), ORCHESTRA_INHERIT_CREDENTIALS: "0",
    ORCHESTRA_CONFIG_DIR: path.join(directory, "host-config"), ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(directory, "host-credential.key"),
    TMPDIR: path.join(directory, "host-tmp"), XDG_DATA_HOME: path.join(directory, "host-data"), XDG_CONFIG_HOME: path.join(directory, "host-config"),
    XDG_CACHE_HOME: path.join(directory, "host-cache"), XDG_STATE_HOME: path.join(directory, "host-state"),
  }
  const host = await microsoftNativeHost({ root: directory, directory, environment: hostEnvironment }, {
    mount, handler: installation.application, host: installation.host, discovery: installation.discovery,
    dispose: () => driver.dispose(),
  })
  cleanups.push(() => host.dispose())
  await persistence.transaction("procurement", async (snapshot) => {
    const result = ProcurementModule.domain.execute(snapshot, { id: principalRef, roles: ["admin", "buyer"], canWrite: true },
      { page: "Settings", action: "reset", version: 0, values: {} }, await environment())
    expect(result.ok).toBe(true)
    // Fixture policy is expressed in bytes and applied through the real Settings command.
    // A configured cap lets the no-scanner regression reach the scanner boundary.
    const uploadCap = 16 * 1024 * 1024
    const configured = ProcurementModule.domain.execute(snapshot, { id: principalRef, roles: ["admin", "buyer"], canWrite: true },
      { page: "Settings", action: "save", version: snapshot.versions.settings!.version, values: { uploadCap } }, await environment())
    expect(configured.ok).toBe(true)
    expect(object(object(snapshot.data.store).settings).uploadCap).toBe(uploadCap)
    return { commit: result.ok && configured.ok, value: undefined }
  })
  const admitted = await identity.handle(new Request(origin + mount + "/auth/local?code=" + await identity.enroll()))
  expect(admitted?.status).toBe(303)
  const cookie = admitted!.headers.get("set-cookie")!.split(";")[0]!
  const request = (surface: string, mode?: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    headers.set("Cookie", cookie)
    headers.set("Origin", origin)
    return new Request(origin + mount + "/" + surface + (mode ? "?sf=" + mode : ""), { ...init, headers })
  }
  return { ...installation, persistence, identity, request, origin, mount, cookie, principalRef, environment }
}

test("Operations mount denies unauthenticated workbenches without changing source data", async () => {
  const f = await fixture()
  const before = await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data) }))
  for (const [surface, mode] of [["planner", "imports"], ["procurement", "documents"]]) {
    const response = await f.application(new Request(f.origin + f.mount + "/" + surface + "?sf=" + mode))
    expect(response?.status).toBe(403)
    expect(await response!.json()).toEqual({ status: "denied" })
  }
  const after = await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data) }))
  expect(after).toEqual(before)
})

test("Operations mount serves native Planner and authorized import/document producers", async () => {
  const f = await fixture()
  const planner = await f.application(f.request("api/ui/pages/CAP23"))
  expect(planner?.status).toBe(200)
  const before = Schema.decodeUnknownSync(SfPlanner.operations["domain.page.CAP23"].output)(await planner!.json())
  expect(before.status).toBe("ok")
  if (before.status !== "ok") throw new Error("OPERATIONS_NATIVE_PLANNER_NOT_ADMITTED")
  expect(before.value.data.versions).toEqual([])
  const saved = await f.application(f.request("planner?page=Versions", undefined, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ page: "Versions", action: "save", version: 0, values: {}, confirmed: false }),
  }))
  expect(saved?.status).toBe(200)
  expect(await saved!.json()).toMatchObject({ ok: true })
  const response = await f.application(f.request("api/ui/pages/CAP23"))
  expect(response?.status).toBe(200)
  const current = Schema.decodeUnknownSync(SfPlanner.operations["domain.page.CAP23"].output)(await response!.json())
  expect(current.status).toBe("ok")
  if (current.status !== "ok") throw new Error("OPERATIONS_NATIVE_PLANNER_REREAD_NOT_ADMITTED")
  expect(current.value.data.versions).toHaveLength(1)
  const version = current.value.data.versions[0]!
  expect(version).toMatchObject({ name: "FY2027 — Draft 1", year: 2027, locked: false, official: false })

  const imports = await f.application(f.request("planner", "import-targets&surface=planner"))
  expect(imports?.status).toBe(200)
  const targets = Schema.decodeUnknownSync(SfFilesImportTargets.output)(await imports!.json())
  expect(targets.status).toBe("ok")
  if (targets.status !== "ok") throw new Error("OPERATIONS_IMPORT_TARGETS_NOT_ADMITTED")
  expect(targets.value).toHaveLength(1)
  expect(targets.value[0]).toMatchObject({ label: version.name, surface: "planner", formats: ["xlsx", "xls"] })
  expect(targets.value[0]!.selectionRef.startsWith("planner-version:" + encodeURIComponent(version.id) + ":")).toBe(true)
  const discovered = await f.application(f.request("procurement", "document-sources"))
  expect(discovered?.status).toBe(200)
  expect(await discovered!.json()).toEqual({ status: "ok", value: [] })

  for (const [surface, mode] of [["planner?page=Versions", undefined], ["planner", "imports"], ["procurement", "documents"]] as const) {
    const legacy = await f.application(f.request(surface, mode))
    expect(legacy?.status).toBe(404)
    expect(await legacy!.text()).toBe("legacy console decommissioned — use /")
  }
})

test("Operations viewer has no human import or document mutation authority", async () => {
  const f = await fixture(true)
  for (const [surface, mode, payload] of [
    ["planner", "import-apply", { manifestId: "untrusted-manifest", version: 1 }],
    ["procurement", "document-schema", { documentRef: "untrusted-document", fields: [{ id: "Price", type: "number", unit: "USD" }] }],
  ] as const) {
    const response = await f.application(f.request(surface, mode, {
      method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
      body: JSON.stringify(payload),
    }))
    expect(response?.status).toBe(403)
    expect(await response!.json()).toEqual({ status: "denied" })
  }
})

test("Operations source admission rejects an unissued selector and a revoked credential", async () => {
  const f = await fixture()
  const admission = await f.application(f.request("procurement", "document-admit", {
    method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
    body: JSON.stringify({ selectionRef: randomUUID() }),
  }))
  expect(admission?.status).toBe(403)
  expect(await admission!.json()).toMatchObject({ status: "denied" })
  const logout = await f.identity.handle(new Request(f.origin + f.mount + "/auth/logout", {
    method: "POST", headers: { Cookie: f.cookie, Origin: f.origin },
  }))
  expect(logout?.status).toBe(204)
  const afterLogout = await f.application(f.request("procurement", "document-sources"))
  expect(afterLogout?.status).toBe(403)
  expect(await afterLogout!.json()).toEqual({ status: "denied" })
})

test("Operations private upload fails closed with no scanner and preserves the source", async () => {
  const f = await fixture()
  const supplier = await f.persistence.transaction("procurement", async (snapshot) => {
    const result = ProcurementModule.domain.execute(snapshot, { id: f.principalRef, roles: ["admin", "buyer"], canWrite: true },
      { page: "Suppliers", action: "create", version: 0, values: {
        legalName: "Scanner boundary supplier", country: "France", address: "Isolated fixture", taxId: randomUUID(),
        contactEmail: "scanner@example.invalid", paymentTerms: "Net 45", currency: "USD", riskRating: "Low",
      } }, await f.environment())
    expect(result.ok).toBe(true)
    const id = result.ok ? text(object(result.value).id) : ""
    expect(id).not.toBe("")
    return { commit: result.ok, value: { id, version: snapshot.versions["suppliers:" + id]!.version } }
  })
  const before = await f.persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
  const upload = new URL(f.origin + f.mount + "/procurement")
  upload.search = new URLSearchParams({ page: "Suppliers", upload: "supplier", record: supplier.id,
    recordVersion: String(supplier.version), name: "scanner-boundary.txt" }).toString()
  const response = await f.application(new Request(upload, {
    method: "POST", headers: { Cookie: f.cookie, Origin: f.origin, "Content-Type": "text/plain" },
    body: "Price: 42\n",
  }))
  expect(response?.status).toBe(422)
  expect(await response!.json()).toEqual({ ok: false, errors: ["The scanner did not accept this file."] })
  const after = await f.persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
  expect(after).toEqual(before)
})
