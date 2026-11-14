import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomBytes, randomUUID } from "node:crypto"
import { Workbook } from "exceljs"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../../runtime/operator-identity.ts"
import { configure, roleMap } from "../../../../runtime/admin.ts"
import { emptyMap, resolve } from "../../../../src/identity.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createSfImportHttp } from "../../../../product/interface/import-http.ts"
import type { ImportManifest } from "../../../../product/contracts/context.ts"
import type { ImportPreviewRequest } from "../../../../product/contracts/operations.ts"
import { createSfDocumentTargetAuthority } from "../../../../../../../apps/cli/src/sucafina-product/document-authority.ts"
import { createSfImportServices } from "../../../../../../../apps/cli/src/sucafina-product/import-services.ts"

export async function importResponse<T>(response: Response): Promise<T> {
  const result = await response.json() as { status: string; value: T }
  if (!response.ok || result.status !== "ok") throw new Error(`Import response ${response.status}: ${result.status}`)
  return result.value
}

/** Restart only this isolated SQLite composition. Native execution and scanner qualification are outside this proof. */
export async function createApplyRecoveryFixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-import-recovery-"))
  const origin = "http://localhost:4110"
  const key = randomBytes(32), signingKey = randomBytes(32)
  const operator = { installationId: randomUUID(), uid: 1000, name: "Import recovery operator" }
  const principalRef = `macos:${operator.installationId}:${operator.uid}`
  const membership = "synthetic-import-recovery-members"
  const clock = { now: Date.parse("2026-11-14T18:00:00Z") }
  const compositions = new Set<() => Promise<void>>()
  const open = async () => {
    const driver = await openLocalStore(directory)
    const at = () => new Date(clock.now).toISOString()
    const store = { ...driver, ...createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID, projectScope: createSfSourceScopeProjector(at) }) }
    const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator, secrets: driver.secrets, key })
    // Synthetic group membership is fixture input; signatures and persisted role resolution use real code.
    const authenticate: typeof identity.authenticate = async (request, context) => {
      const principal = await identity.authenticate(request, context)
      return principal && context ? resolve(principal.id, [...context.roleMap], (group) => group === membership) : null
    }
    const environment = async () => ({ at: at(), id: randomUUID, directory: [] })
    const assets = { persistence: store, services: { signingKey, scan: async () => true } }
    for (const surface of ["dashboard", "planner", "procurement"] as const) await store.initializeSources(surface)
    const installation = { installationId: operator.installationId, hostId: randomUUID(), projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
    const authority = createSfProductAuthority({ identity: () => installation, installationId: operator.installationId, origin, policyVersion: "policy", persistence: store, authenticate, environment,
      grants: [{ principalRef, namespaces: ["documents", "receipts"], operations: ["sf_import_preview"], humanActions: ["imports.admit", "imports.apply"] }],
      createId: randomUUID, now: () => clock.now, commandIdentity: async (request, operation) => {
        if (request.method === "GET" || request.method === "HEAD") return randomUUID()
        const intent = request.headers.get("Idempotency-Key")
        return intent && /^[A-Za-z0-9._:-]{8,128}$/.test(intent) ? digestSfValue({ operation, key: intent }) : undefined
      },
      inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => 1,
      authorizeDocument: createSfDocumentTargetAuthority({ persistence: store, authenticate, environment, assets }) })
    const runtime = { installationId: operator.installationId, directory, sourceRoot: directory, origin, mount: "/sucafina", persistence: store, authenticate, environment, assets }
    const service = createSfImportServices({ runtime, authority })
    if (!service) throw new Error("Real import services unavailable")
    const lifecycle = { closed: false }
    const http = createSfImportHttp({ origin, mount: "/sucafina", runtime: () => lifecycle.closed ? undefined : { ui: authority.ui, human: authority.human, service } })
    const close = async () => {
      if (lifecycle.closed) return
      lifecycle.closed = true
      await driver.dispose()
      compositions.delete(close)
    }
    compositions.add(close)
    const login = async () => {
      const response = await identity.handle(new Request(`${origin}/sucafina/auth/local?code=${await identity.enroll()}`))
      const cookie = response?.headers.get("set-cookie")?.split(";")[0]
      if (response?.status !== 303 || !cookie) throw new Error("Fresh local authentication failed")
      return cookie
    }
    const call = async (cookie: string, mode: string, payload?: unknown, query: Record<string, string> = {}, intent: string = randomUUID()) => {
      const url = new URL(`${origin}/sucafina/planner`)
      url.searchParams.set("sf", mode)
      Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, value))
      const response = await http(new Request(url, payload === undefined ? { headers: { cookie } } : {
        method: "POST", headers: { cookie, origin, "Idempotency-Key": intent, ...(payload instanceof FormData ? {} : { "Content-Type": "application/json" }) },
        body: payload instanceof FormData ? payload : JSON.stringify(payload),
      }), "planner")
      if (!response) throw new Error("Real import HTTP route missing")
      return response
    }
    const snapshots = () => store.transactionAll!(async (current) => ({ commit: false, value: structuredClone(current) }))
    const prepare = async (cookie: string, newVersion: boolean) => {
      const choices = await importResponse<{ label: string; selectionRef: string }[]>(await call(cookie, "import-targets", undefined, { surface: "planner" }))
      const target = choices.find((choice) => choice.label === "FY27 recovery")
      if (!target) throw new Error("Real Planner selection unavailable")
      const workbook = new Workbook(), sheet = workbook.addWorksheet("OPEX")
      sheet.addRow(["Line ID", "Cost element", "Vendor / item", "Currency", "Measure", "Jan"])
      sheet.addRow(["renewal", "Licenses", "renewal", "USD", "Forecast", 84000])
      const form = new FormData()
      form.set("file", new File([new Uint8Array(await workbook.xlsx.writeBuffer())], "recovery.xlsx"))
      form.set("surface", "planner"); form.set("selectionRef", target.selectionRef)
      form.set("options", JSON.stringify({ newVersion, removeMissing: false, preview: {} }))
      const admitted = await importResponse<{ ref: string }>(await call(cookie, "import-admit", form))
      const selection: ImportPreviewRequest = { admittedFileRef: admitted.ref, format: "xlsx", options: {} }
      return importResponse<ImportManifest>(await call(cookie, "import-preview", selection))
    }
    const revokePlanner = async (cookie: string) => store.transaction("planner", async (snapshot) => {
      const request = new Request(`${origin}/sucafina/planner`, { method: "POST", headers: { cookie, origin } })
      const map = roleMap(snapshot, "planner")
      const principal = await authenticate(request, { surface: "planner", roleMap: map })
      if (!principal) throw new Error("Revocation requires an authenticated administrator")
      const actor = { id: principal.id, canWrite: principal.canWrite, roles: principal.roles.filter((entry) => entry.surface === "planner").map((entry) => entry.role) }
      const result = configure(snapshot, "planner", actor, { page: "Access", action: "configure-group", id: "admin", version: map.find((row) => row.role === "admin")!.version, values: { role: "admin", entra: "" } }, await environment())
      return { commit: result.ok, value: result }
    })
    return { driver, store, identity, authority, service, call, login, close, snapshots, prepare, installation, revokePlanner }
  }
  const seed = async (app: Awaited<ReturnType<typeof open>>) => app.store.transactionAll!(async (snapshots) => {
    for (const surface of ["dashboard", "planner", "procurement"] as const) snapshots[surface].data.roleMap = emptyMap().filter((row) => row.surface === surface).map((row) => row.role === "admin" ? { ...row, entra: membership } : row)
    const snapshot = snapshots.planner
    const line = (id: string, value: number) => ({ id, sec: "opex", el: "licenses", name: id, cur: "USD", b: Array(12).fill(0), a: Array(12).fill(null), f: [value, ...Array(11).fill(null)] })
    snapshot.data.versions = [{ id: "v1", name: "FY27 recovery", year: 2027, closed: 0, locked: false, lines: [line("fixed", 518000), line("renewal", 72000)], projects: [], fx: [], hc: { positions: [], rates: [], hrAF: {} }, lists: {} }]
    snapshot.data.roster = []; snapshot.data.officials = {}; snapshot.data.entities = []; snapshot.data.allocations = []
    return { commit: true, value: undefined }
  })
  return { open, seed, origin, principalRef, advance: () => { clock.now += 60_000 },
    dispose: async () => { await Promise.all([...compositions].map((close) => close())); await rm(directory, { recursive: true, force: true }) } }
}
