import { expect, test } from "bun:test"
import { randomBytes } from "node:crypto"
import { createApplication } from "../../runtime/application.ts"
import type { Application } from "../../runtime/application.ts"
import type { AssetServices } from "../../runtime/assets.ts"
import { scanLocalFile } from "../../runtime/local-scanner.ts"
import { contributions } from "../../index.ts"
import { ProcurementModule } from "../../runtime/procurement.ts"
import { initialProcurementSettings } from "../../src/initial-settings.ts"
import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import { observeSfAssetHealth } from "../../../../../apps/cli/src/sucafina-product/native-ui/asset-health.ts"
import { financialCompositionFixture } from "../product/wp10/integration/financial-composition-fixture.ts"

const origin = "https://example.test"
const mount = "/sucafina"
type AssetOperationId = Awaited<ReturnType<typeof observeSfAssetHealth>>[number]["operationId"]
const ids: AssetOperationId[] = ["files.asset.link", "files.asset.download", "files.asset.upload"]

async function assetFixture() {
  const schedule: { beforeEnvironment?: () => Promise<void> } = {}
  const f = await financialCompositionFixture({ beforeEnvironment: async () => { await schedule.beforeEnvironment?.() } })
  const scanner = { host: "127.0.0.1" as const, port: 3310 }
  const calls = { scan: 0, dispatch: 0 }
  const services: AssetServices = { signingKey: randomBytes(32), scannerConfiguration: scanner,
    scan: async (bytes) => { calls.scan++; return scanLocalFile(bytes, scanner) } }
  const application: Application = { persistence: f.persistence, authenticate: f.authority.host.authenticate,
    environment: f.authority.host.environment, domains: contributions, assets: { persistence: f.persistence, services },
    maxJsonBytes: 65_536 }
  const owner = { mounted: true, application, handler: createApplication(mount, application) }
  const fetch = (request: Request) => {
    calls.dispatch++
    return owner.mounted ? owner.handler(request) : Promise.resolve(undefined)
  }
  const original = new Request(origin + mount + "/api/ui/context?installationId=installation&projectId=project&hostId=host")
  const uploadCap = await f.persistence.transaction("procurement", async (snapshot) => {
    const principal = await application.authenticate(original, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
    const environment = await application.environment(original)
    if (!principal) throw new Error("Original procurement actor required")
    const actor = { id: principal.id, canWrite: principal.canWrite,
      roles: principal.roles.filter((role) => role.surface === "procurement").map((role) => role.role) }
    const reset = ProcurementModule.domain.execute(snapshot, actor, { page: "Settings", action: "reset", version: 0, values: {} }, environment)
    if (!reset.ok) throw new Error("Original settings reset failed")
    const saved = ProcurementModule.domain.execute(snapshot, actor, { page: "Settings", action: "save",
      version: snapshot.versions.settings!.version, values: {
        levels: initialProcurementSettings().levels.map((level) => ({ ...level, holderId: actor.id })),
        uploadCap: 16 * 1024 * 1024,
      } }, environment)
    if (!saved.ok) throw new Error("Original attachment limit failed")
    return { commit: true, value: object(object(snapshot.data.store).settings).uploadCap }
  })
  if (!f.store.transactionAll || !f.store.readSnapshotRoot) throw new Error("Real SQLite read scope required")
  const inRoot = <T>(work: () => Promise<T>) => f.store.readSnapshotRoot!(work)
  const admission = await inRoot(() => f.authority.readContextAdmission(original))
  if (admission.status !== "ok") throw new Error("Original authority required")
  const input: Parameters<typeof observeSfAssetHealth>[0] = { source: () => owner.mounted
    ? { application: owner.application, producer: owner.handler, authority: f.authority } : undefined }
  return { f, owner, fetch, input, original, admission, calls, services, scanner, schedule, inRoot, uploadCap,
    observe: () => inRoot(() => observeSfAssetHealth(input, original, admission.stamp)),
    readState: () => f.store.transactionAll!(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) })),
    dispose: f.dispose }
}

test("attachment observation uses the mounted original application and real read-only transactions without scanning bytes", async () => {
  const f = await assetFixture()
  try {
    const before = await f.readState()
    const observed = await f.observe()
    expect(observed.map((entry) => entry.operationId)).toEqual(ids)
    expect(f.uploadCap).toBe(16 * 1024 * 1024)
    expect(observed.every((entry) => entry.state === "ready" && entry.operational && entry.reason === null)).toBe(true)
    expect(await f.readState()).toEqual(before)
    expect(f.calls).toEqual({ scan: 0, dispatch: 0 })
    // The advertised mechanism is configured; this test makes no claim that a
    // ClamD service is running or that any file has received a clean verdict.
    expect(f.services.scannerConfiguration).toBe(f.scanner)
  } finally { await f.dispose() }
})

test("a scan callback without its original configuration never publishes upload availability", async () => {
  const f = await assetFixture()
  try {
    const before = await f.readState()
    f.services.scannerConfiguration = undefined
    expect(typeof f.services.scan).toBe("function")
    expect((await f.observe()).map((entry) => entry.operationId)).toEqual(ids.slice(0, 2))
    f.services.scannerConfiguration = { host: "127.0.0.1", port: 0 }
    expect((await f.observe()).map((entry) => entry.operationId)).toEqual(ids.slice(0, 2))
    expect(f.calls).toEqual({ scan: 0, dispatch: 0 })
    expect(await f.readState()).toEqual(before)
  } finally { await f.dispose() }
})

test("absent mount, replaced storage, foreign request and stale authority stay unavailable", async () => {
  const f = await assetFixture()
  try {
    const before = await f.readState()
    f.owner.mounted = false
    expect(await f.fetch(new Request(origin + mount + "/procurement?asset-link=missing"))).toBeUndefined()
    expect(await f.observe()).toEqual([])
    f.owner.mounted = true
    const other = await financialCompositionFixture()
    try {
      f.owner.application = { ...f.owner.application, persistence: other.persistence, assets: { persistence: other.persistence, services: f.services } }
      f.owner.handler = createApplication(mount, f.owner.application)
      expect(await f.observe()).toEqual([])
    } finally { await other.dispose() }
    f.owner.application = { ...f.owner.application, persistence: f.f.persistence, assets: { persistence: f.f.persistence, services: f.services } }
    f.owner.handler = createApplication(mount, f.owner.application)
    expect(await f.inRoot(() => observeSfAssetHealth(f.input, f.original, { ...f.admission.stamp, accessRevision: "stale" }))).toEqual([])
    expect(await f.inRoot(() => observeSfAssetHealth(f.input,
      new Request("https://foreign.example.test/sucafina/api/ui/context"), f.admission.stamp))).toEqual([])
    const abort = new AbortController()
    abort.abort()
    expect(await f.inRoot(() => observeSfAssetHealth(f.input,
      new Request(f.original.url, { signal: abort.signal }), f.admission.stamp))).toEqual([])
    f.f.active.value = false
    expect(await f.observe()).toEqual([])
    expect(await f.readState()).toEqual(before)
    expect(f.calls.scan).toBe(0)
  } finally { await f.dispose() }
})

test("revocation or replacement during a real environment read discards the attachment observation", async () => {
  for (const change of ["revoke", "replace-handler", "change-key", "change-configuration"] as const) {
    const f = await assetFixture()
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    try {
      const before = await f.readState()
      f.schedule.beforeEnvironment = async () => { entered.resolve(); await release.promise }
      const pending = f.observe()
      await entered.promise
      if (change === "revoke") f.f.active.value = false
      if (change === "replace-handler") f.owner.handler = createApplication(mount, f.owner.application)
      if (change === "change-key") f.services.signingKey[0] = f.services.signingKey[0]! ^ 1
      if (change === "change-configuration") f.scanner.port++
      release.resolve()
      expect(await pending).toEqual([])
      expect(f.calls).toEqual({ scan: 0, dispatch: 0 })
      expect(await f.readState()).toEqual(before)
    } finally { release.resolve(); await f.dispose() }
  }
})
