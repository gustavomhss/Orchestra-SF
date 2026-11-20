import { expect, test } from "bun:test"
import { randomBytes, randomUUID } from "node:crypto"
import path from "node:path"
import { createSfImportServices } from "../../../../../apps/cli/src/sucafina-product/import-services.ts"
import { observeSfImportHealth } from "../../../../../apps/cli/src/sucafina-product/native-ui/import-health.ts"
import { createSfImportHttp } from "../../product/interface/import-http.ts"
import { createSfProductAuthority } from "../../product/integration/product-authority.ts"
import { digestSfValue } from "../../product/contracts/canonical.ts"
import { createModule } from "../../index.ts"
import { scanLocalFile } from "../../runtime/local-scanner.ts"
import type { AssetServices } from "../../runtime/assets.ts"
import type { CreateSfHostRuntime } from "../../product/contracts/host-context.ts"
import { financialCompositionFixture } from "../product/wp10/integration/financial-composition-fixture.ts"

const origin = "https://example.test"
const mount = "/sucafina"
const readIds = ["files.import-targets", "files.import-reference", "files.import-detail"]
const allIds = [...readIds, "files.import-admit", "files.import-preview", "files.import-apply"]

async function importFixture(policy: { preview?: boolean; documents?: boolean; receipts?: boolean; human?: boolean; scanner?: boolean } = {}) {
  const f = await financialCompositionFixture()
  const schedule: { beforeCommand?: () => Promise<void> } = {}
  const authority = createSfProductAuthority({ installationId: "installation", origin, policyVersion: "import-health-policy",
    identity: () => f.identity, persistence: f.persistence, ...f.guards,
    authenticate: f.authority.host.authenticate, environment: f.authority.host.environment,
    grants: [{ principalRef: "person", namespaces: ["preferences", ...(policy.documents === false ? [] : ["documents" as const]),
      ...(policy.receipts === false ? [] : ["receipts" as const])],
      operations: policy.preview === false ? [] : ["sf_import_preview"],
      humanActions: policy.human === false ? [] : ["imports.admit", "imports.apply"] }],
    createId: randomUUID, now: Date.now,
    commandIdentity: async () => { await schedule.beforeCommand?.(); return randomUUID() },
    inspectSession: async () => undefined, verifySelection: async () => false,
    verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: async () => undefined })
  const scanner = { host: "127.0.0.1" as const, port: 3310 }
  const calls = { scan: 0, dispatch: 0 }
  const services: AssetServices = { signingKey: randomBytes(32), scannerConfiguration: policy.scanner === false ? undefined : scanner,
    scan: async (bytes) => { calls.scan++; return scanLocalFile(bytes, scanner) } }
  const runtime: Parameters<CreateSfHostRuntime>[0] = { installationId: "installation", directory: f.directory,
    sourceRoot: path.resolve(import.meta.dirname, "../../product/ai"), origin, mount, persistence: f.persistence,
    authenticate: authority.host.authenticate, environment: authority.host.environment,
    assets: { persistence: f.persistence, services } }
  const service = createSfImportServices({ runtime, authority })
  if (!service || !runtime.assets) throw new Error("Original import source required")
  const owner = { mounted: true, service, handler: createSfImportHttp({ origin, mount, runtime: () => ({ ui: authority.ui, human: authority.human, service }) }) }
  const createHandler = () => createSfImportHttp({ origin, mount, runtime: () => owner.mounted
    ? { ui: authority.ui, human: authority.human, service: owner.service } : undefined })
  owner.handler = createHandler()
  const productHttp = (request: Request, surface: string) => { calls.dispatch++; return owner.handler(request, surface) }
  const application = createModule(mount, { persistence: f.persistence, authenticate: authority.host.authenticate,
    environment: authority.host.environment, assets: runtime.assets, product: productHttp, maxJsonBytes: 65_536 })
  const fetch = (request: Request) => owner.mounted ? application(request) : Promise.resolve(undefined)
  const original = new Request(origin + mount + "/api/ui/context?installationId=installation&projectId=project&hostId=host")
  const initialized = await authority.state.transaction(original, { namespace: "preferences", expectedStorageVersion: 0,
    targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation,
    idempotencyKey: "import-health-fixture", commandDigest: digestSfValue({ fixture: "import-health" }) },
    async (state) => { state.preferences["import-health-fixture"] = true; return { commit: true, value: true } })
  if (initialized.status !== "ok" || !f.store.transactionAll || !f.store.readSnapshotRoot) throw new Error("Original C08 fixture required")
  const assets = runtime.assets
  const input: Parameters<typeof observeSfImportHealth>[0] = { authority,
    binding: (id, producer) => owner.mounted && id === "dashboard.dashboard-review" && producer === productHttp ? productHttp : undefined,
    source: () => owner.mounted ? { producer: productHttp, handler: owner.handler, service: owner.service,
      persistence: f.persistence, assets, dependencies: [authority, authority.host, authority.host.authenticate,
        authority.host.environment, authority.host.revalidate, authority.host.requestFor, authority.ui.operationIdentity,
        f.persistence.readScopedSource, f.persistence.resolveScopedSource, owner.service.descriptors] } : undefined }
  const inRoot = <T>(work: () => Promise<T>) => f.store.readSnapshotRoot!(work)
  const admission = await inRoot(() => authority.readContextAdmission(original))
  if (admission.status !== "ok") throw new Error("Original import authority unavailable")
  return { f, input, original, admission, owner, calls, services, schedule, runtime, authority, createHandler, fetch, inRoot,
    observe: () => inRoot(() => observeSfImportHealth(input, original, admission.stamp)),
    readState: () => f.store.transactionAll!(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) })),
    dispose: f.dispose }
}

test("UI55 health uses the actual Import producer, policy and C08 without acquiring a source or preparing a file", async () => {
  const f = await importFixture()
  try {
    const before = await f.readState()
    const observed = await f.observe()
    expect(observed.map((entry) => entry.operationId)).toEqual(allIds)
    expect(observed.every((entry) => entry.state === "ready" && entry.operational && entry.reason === null)).toBe(true)
    expect(await f.readState()).toEqual(before)
    expect(f.calls).toEqual({ scan: 0, dispatch: 0 })
    // Configured scan admission is not a claim that ClamD was contacted or clean.
  } finally { await f.dispose() }
})

test("actual restricted policy and absent scanner configuration cannot borrow another operation's grant", async () => {
  const cases = [
    { policy: { preview: false }, ids: [] },
    { policy: { documents: false }, ids: [] },
    { policy: { receipts: false }, ids: allIds.filter((id) => id !== "files.import-apply") },
    { policy: { human: false }, ids: [...readIds, "files.import-preview"] },
    { policy: { scanner: false }, ids: allIds.filter((id) => id !== "files.import-admit") },
  ]
  for (const entry of cases) {
    const f = await importFixture(entry.policy)
    try {
      const before = await f.readState()
      expect((await f.observe()).map((operation) => operation.operationId)).toEqual(entry.ids)
      expect(await f.readState()).toEqual(before)
      expect(f.calls).toEqual({ scan: 0, dispatch: 0 })
    } finally { await f.dispose() }
  }
})

test("missing mount, stale stamp, foreign origin and cancelled request never enable Import", async () => {
  const f = await importFixture()
  try {
    const before = await f.readState()
    f.owner.mounted = false
    expect(await f.fetch(new Request(origin + mount + "/planner?sf=import-targets&surface=planner"))).toBeUndefined()
    expect(await f.observe()).toEqual([])
    f.owner.mounted = true
    expect(await f.inRoot(() => observeSfImportHealth({ ...f.input, binding: undefined }, f.original, f.admission.stamp))).toEqual([])
    expect(await f.inRoot(() => observeSfImportHealth(f.input, f.original, { ...f.admission.stamp, accessRevision: "stale" }))).toEqual([])
    expect(await f.inRoot(() => observeSfImportHealth(f.input, new Request("https://foreign.example.test/sucafina/api/ui/context"),
      f.admission.stamp))).toEqual([])
    const abort = new AbortController()
    abort.abort()
    expect(await f.inRoot(() => observeSfImportHealth(f.input, new Request(f.original.url, { signal: abort.signal }),
      f.admission.stamp))).toEqual([])
    expect(f.calls).toEqual({ scan: 0, dispatch: 0 })
    expect(await f.readState()).toEqual(before)
  } finally { await f.dispose() }
})

test("revocation and replacement during original admission discard all prior Import evidence", async () => {
  for (const change of ["revoke", "replace-handler", "replace-discover", "replace-descriptor"] as const) {
    const f = await importFixture()
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    try {
      const before = await f.readState()
      f.schedule.beforeCommand = async () => { entered.resolve(); await release.promise }
      const pending = f.observe()
      await entered.promise
      if (change === "revoke") f.f.active.value = false
      if (change === "replace-handler") f.owner.handler = f.createHandler()
      if (change === "replace-discover" || change === "replace-descriptor") {
        const other = createSfImportServices({ runtime: f.runtime, authority: f.authority })
        if (!other) throw new Error("Original replacement source required")
        if (change === "replace-discover") f.owner.service.discover = other.discover
        if (change === "replace-descriptor") {
          const descriptor = f.owner.service.descriptors[0]
          const replacement = other.descriptors[0]
          if (!descriptor || !replacement) throw new Error("Original descriptor required")
          descriptor.handler = replacement.handler
        }
      }
      release.resolve()
      expect(await pending).toEqual([])
      expect(f.calls).toEqual({ scan: 0, dispatch: 0 })
      expect(await f.readState()).toEqual(before)
    } finally { release.resolve(); await f.dispose() }
  }
})
