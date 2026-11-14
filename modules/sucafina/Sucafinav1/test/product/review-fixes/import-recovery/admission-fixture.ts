import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomBytes, randomUUID } from "node:crypto"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../../runtime/operator-identity.ts"
import { object } from "../../../../runtime/contract.ts"
import { roleMap } from "../../../../runtime/admin.ts"
import { createSfSourcePersistence, sfSourceIdentity } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfStagedImportFiles } from "../../../../product/imports/staged-files.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { ImportTarget } from "../../../../product/imports/staged-files.ts"
import type { SfProductStatePort } from "../../../../product/contracts/state.ts"
import type { TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"

type Fault = "before-catalog" | "after-catalog"
type File = Parameters<ReturnType<typeof createSfStagedImportFiles>["admit"]>[0]

/** Real SQLite, operator sessions and product authority; only the crash boundary is injected. */
export async function createAdmissionFixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-import-recovery-admit-"))
  const operator = { installationId: randomUUID(), uid: 1000, name: "Import recovery operator" }
  const key = randomBytes(32)
  const clock = { now: Date.parse("2026-11-13T00:00:00Z") }
  const closes: (() => Promise<void>)[] = []
  const open = async (fault?: Fault) => {
    const driver = await openLocalStore(directory)
    const store = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID })
    const contexts: TrustedUiContext[] = []
    const lifecycle = { closed: false }
    const close = async () => {
      if (lifecycle.closed) return
      lifecycle.closed = true
      contexts.forEach((context) => authority.human.finish(context))
      await driver.dispose()
    }
    closes.push(close)
    await store.initializeSources("dashboard")
    await store.initializeSources("planner")
    await store.initializeSources("procurement")
    await store.transaction("dashboard", async (snapshot) => {
      if (Array.isArray(snapshot.data.opexOwners) && snapshot.data.opexOwners.some((row) => object(row).id === "owner-1")) return { commit: false, value: undefined }
      snapshot.data.opexOwners = [{ id: "owner-1", budget: 100 }, { id: "owner-2", budget: 200 }]
      return { commit: true, value: undefined }
    })
    const identity = createOperatorIdentity({
      origin: "http://localhost:4110", mount: "/sucafina", operator, secrets: driver.secrets, key,
      now: () => new Date(clock.now),
    })
    const login = async () => {
      const code = await identity.enroll()
      const session = await identity.handle(new Request(`http://localhost:4110/sucafina/auth/local?code=${code}`))
      const cookie = session?.headers.get("set-cookie")?.split(";")[0]
      if (session?.status !== 303 || !cookie) throw new Error("operator enrollment failed")
      return new Request("http://localhost:4110/sucafina/dashboard", {
        method: "POST", headers: { cookie, origin: "http://localhost:4110", "x-sf-command": "import-recovery-admission" },
      })
    }
    const request = await login()
    const principal = await store.transaction("dashboard", async (snapshot) => ({
      commit: false, value: await identity.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") }),
    }))
    if (!principal) throw new Error("operator authentication failed")
    const authority = createSfProductAuthority({
      identity: () => ({ installationId: operator.installationId, hostId: "import-recovery-host", projectId: "import-recovery-project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }),
      installationId: operator.installationId, origin: "http://localhost:4110", policyVersion: "import-recovery-policy-v1",
      persistence: store, authenticate: identity.authenticate,
      environment: async () => ({ at: new Date(clock.now).toISOString(), id: randomUUID, directory: [] }),
      grants: [{ principalRef: principal.id, namespaces: ["documents"], operations: [], humanActions: ["imports.admit"] }],
      createId: randomUUID, now: () => clock.now,
      commandIdentity: async (received) => received.headers.get("x-sf-command") ?? undefined,
      inspectSession: async () => undefined, verifySelection: async () => false,
      verifySkillReceipt: async () => false, providerGeneration: async () => undefined,
      authorizeDocument: async (_, snapshot, targetRef) => sfSourceIdentity(snapshot, "opexOwners", targetRef),
    })
    const targetFor = (selectionRef: string) => store.transaction("dashboard", async (snapshot) => {
      const source = sfSourceIdentity(snapshot, "opexOwners", selectionRef)
      if (!source) throw new Error("missing admission target")
      const target: ImportTarget = {
        surface: "dashboard", selectionRef, incarnation: source.incarnation, version: source.version,
        options: { newVersion: false, removeMissing: false, preview: {} },
      }
      return { commit: false, value: target }
    })
    const target = await targetFor("owner-1")
    const otherTarget = await targetFor("owner-2")
    const boundary = { hits: 0, catalogCommitted: false }
    const state: SfProductStatePort = {
      read: (received, namespace, work) => {
        if (fault === "after-catalog" && boundary.catalogCommitted) return Promise.reject(new Error("catalog observation lost"))
        return authority.state.read(received, namespace, work)
      },
      transaction: async (received, command, work) => {
        boundary.hits += 1
        if (fault === "before-catalog") throw new Error("interrupted after blob commit, before catalog commit")
        const result = await authority.state.transaction(received, command, work)
        if (fault === "after-catalog" && result.status === "ok") {
          boundary.catalogCommitted = true
          throw new Error("catalog committed but acknowledgement lost")
        }
        return result
      },
    }
    const files = createSfStagedImportFiles({
      host: authority.host, assets: store, state,
      // Admission recovery does not qualify malware scanning.
      services: { scan: async () => true, signingKey: randomBytes(32) },
      operationIdentity: (context) => context.kind === "ui" ? authority.ui.operationIdentity(context) : undefined,
      authorizeAdmission: (payload, context) => authority.human.authorize(context, "imports.admit", payload),
      authorizeTarget: async (selection, context) => {
        const received = authority.host.requestFor(context)
        if (!received || selection.surface !== "dashboard" || !await authority.host.revalidate(context)) return false
        return store.transaction("dashboard", async (snapshot) => {
          const actor = await identity.authenticate(received, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
          const source = sfSourceIdentity(snapshot, "opexOwners", selection.selectionRef)
          return { commit: false, value: actor?.id === context.binding.principalRef && actor.canWrite &&
            source?.incarnation === selection.incarnation && source.version === selection.version }
        })
      },
    })
    const file: File = { target, format: "json", bytes: new TextEncoder().encode('{"members":[]}') }
    const grant = async (value = file, received = request) => {
      const digest = new Bun.CryptoHasher("sha256").update(value.bytes).digest("hex")
      const result = await authority.human.admit(received, "imports.admit", { target: value.target, format: value.format, digest })
      if (result.status !== "ok") throw new Error(`admission authority unavailable: ${result.reason}`)
      contexts.push(result.value)
      return result.value
    }
    const admit = async (value = file, received = request) => {
      const context = await grant(value, received)
      try { return await files.admit(value, context) } finally { authority.human.finish(context) }
    }
    const ref = digestSfValue({ principalRef: principal.id, operation: "import-recovery-admission" })
    const inspect = () => store.transaction("dashboard", async (snapshot, blobs) => ({
      commit: false, value: {
        snapshot: structuredClone(snapshot),
        catalog: object(object(snapshot.data.__sfProductV1).documents)[`import-file:${ref}`],
        blob: await blobs.get(`sf-import/${ref}`),
        admission: await blobs.get(`sf-import/${ref}/admission`),
      },
    }))
    const logout = (received = request) => identity.handle(new Request("http://localhost:4110/sucafina/auth/logout", {
      method: "POST", headers: { cookie: received.headers.get("cookie")!, origin: "http://localhost:4110" },
    }))
    return { driver, store, identity, authority, request, file, otherTarget, files, ref, boundary, grant, admit, inspect, login, logout, close }
  }
  return { open, clock, dispose: async () => { for (const close of closes) await close(); await rm(directory, { recursive: true, force: true }) } }
}

