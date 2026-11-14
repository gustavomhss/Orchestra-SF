import { expect, test } from "bun:test"
import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdir, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AbsolutePath } from "@orchestra/core/schema"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { createModule } from "../../../index.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { resolve } from "../../../src/identity.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createSfAtlasScanner } from "../../../product/host-binding/atlas-scanner.ts"
import { createSfImportHttp } from "../../../product/interface/import-http.ts"
import { decorateSfProductHtml } from "../../../product/interface/html.ts"
import { createSfDocumentTargetAuthority } from "../../../../../../apps/cli/src/sucafina-product/document-authority.ts"
import { createSfImportServices } from "../../../../../../apps/cli/src/sucafina-product/import-services.ts"
import { prepareAtlasScanner } from "./atlas-consumer-fixture.ts"

/** Actual application HTTP, encrypted login, C08, import producers and DOCX export.
 * The scanner policy is real Gitleaks for this JSON secrets corpus only; it neither
 * qualifies ClamD/antimalware nor activates or changes an installation's scanner. */
test("Dashboard app delegates reviewed JSON import and authorized report download to the real producers", async () => {
  expectSpawn(import.meta.path)
  const directory = await mkdtemp(join(await realpath(tmpdir()), "wp02-import-report-"))
  await chmod(directory, 0o700)
  const stateDirectory = join(directory, "state"), scannerDirectory = join(directory, "scanner")
  await mkdir(stateDirectory, { mode: 0o700 })
  await mkdir(scannerDirectory, { mode: 0o700 })
  const driver = await openLocalStore(stateDirectory)
  try {
    const pinned = await prepareAtlasScanner(scannerDirectory)
    const scanner = createSfAtlasScanner({ scanners: [pinned.spec], timeoutMs: 20000 })
    expect(scanner.name).toBe("gitleaks")
    expect(pinned.version).toBe("8.30.1")
    const scans: { digest: string; hit: boolean }[] = []
    const at = "2026-11-14T08:00:00.000Z", origin = "http://127.0.0.1:43128", mount = "/sucafina"
    const installationId = randomUUID(), group = "import-report-operators", principalRef = `macos:${installationId}:1000`
    const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID, projectScope: createSfSourceScopeProjector(() => at) })
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    const roleMap = [{ surface: "dashboard", role: "admin", entra: group, version: 1, by: principalRef }]
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = roleMap
      snapshot.data.risks = [{ id: "risk-1", name: "Before reviewed import", status: "Open" }]
      snapshot.data.budgetLineIds = { protected: "current-budget-identity" }
      return { commit: true, value: undefined }
    })
    const identity = createOperatorIdentity({ origin, mount, operator: { installationId, uid: 1000, name: "Import review operator" }, secrets: driver.secrets, key: randomBytes(32) })
    const authenticate: typeof identity.authenticate = async (request, context) => {
      const person = await identity.person(request)
      return person && context ? resolve(person.id, [...context.roleMap], (name) => name === group) : null
    }
    const environment = async (request: Request) => ({ at, id: randomUUID, directory: await identity.directory(request) })
    const login = await identity.handle(new Request(`${origin}${mount}/auth/local?code=${await identity.enroll()}`))
    const cookie = login?.headers.get("set-cookie")?.split(";")[0]
    if (!cookie) throw new Error("Encrypted operator enrollment failed")
    const assets = { persistence, services: { signingKey: randomBytes(32), scan: async (bytes: Uint8Array, mediaType: string) => {
      if (mediaType !== "application/json") return false
      // The exact uploaded JSON text enters the real scanner's task-text contract.
      // This record is scanner input only: it is never emitted to Atlas or persisted.
      const hit = scanner.scan({ owner: "wp02-json-scanner-control", kind: "task", entry: { taskId: "json-admission", attempted: [], failedWith: [], stoppedAt: "review", lesson: new TextDecoder("utf-8", { fatal: true }).decode(bytes) } })
      scans.push({ digest: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"), hit })
      return !hit
    } } }
    const runtime = { installationId, directory: stateDirectory, sourceRoot: stateDirectory, origin, mount, persistence, authenticate, environment, assets }
    const authority = createSfProductAuthority({ installationId, origin, policyVersion: "wp02-import-report-policy", persistence, authenticate, environment,
      identity: () => ({ installationId, hostId: "import-report-host", projectId: "project", location: { directory: AbsolutePath.make(stateDirectory) } }),
      createId: randomUUID, now: Date.now, commandIdentity: async (request, operation) => {
        if (request.method === "GET" || request.method === "HEAD") return randomUUID()
        const key = request.headers.get("idempotency-key")
        return key && /^[A-Za-z0-9_-]{8,128}$/.test(key) ? digestSfValue({ operation, key }) : undefined
      },
      inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined,
      authorizeDocument: createSfDocumentTargetAuthority(runtime),
      grants: [{ principalRef, namespaces: ["documents", "receipts"], operations: ["sf_import_preview"], humanActions: ["imports.admit", "imports.apply"] }] })
    const service = createSfImportServices({ runtime, authority })
    if (!service) throw new Error("The real import composition is unavailable")
    const product = createSfImportHttp({ origin, mount, runtime: () => ({ ui: authority.ui, human: authority.human, service }) })
    const module = createModule(mount, { persistence, authenticate, environment, assets, maxJsonBytes: 100000, product, productHtml: decorateSfProductHtml })
    const send = async (query: string | URLSearchParams, init: RequestInit = {}, authenticated = true) => {
      const headers = new Headers(init.headers)
      if (authenticated) headers.set("cookie", cookie)
      if (init.method === "POST") headers.set("origin", origin)
      const response = await module(new Request(`${origin}${mount}/dashboard?${query}`, { ...init, headers }))
      if (!response) throw new Error("The application did not handle its Dashboard route")
      return response
    }
    const post = (mode: string, payload: unknown, key: string = randomUUID(), authenticated = true) => send(`sf=${mode}`, {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(payload),
    }, authenticated)
    const inspect = () => persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: {
      dataDigest: digestSfValue(snapshot.data), risks: structuredClone(snapshot.data.risks), roleMap: structuredClone(snapshot.data.roleMap),
      budgetLineIds: structuredClone(snapshot.data.budgetLineIds), auditLength: snapshot.audit.length,
    } }))
    const page = await send("page=IT+Risks")
    expect(page.status).toBe(200)
    const html = await page.text()
    expect(html).toContain("Import with preview")
    expect(html).toContain("Apply reviewed import")
    expect(html).toContain("Reports and backup")
    const form = /<form method="get" class="report-form">([\s\S]*?)<\/form>/.exec(html)?.[1]
    expect(form).toContain('name="download"')
    expect(form).toContain('<option value="docx">Word</option>')
    expect(form).toContain('name="topic" value="IT Risks"')
    const target = rows(await ok(await send("sf=import-targets&surface=dashboard"))).find((entry) => entry.label === "Entire Dashboard backup (administrator)")
    if (typeof target?.selectionRef !== "string") throw new Error("The real discovery did not authorize a Dashboard backup destination")
    expect(target.formats).toEqual(["json"])
    const selectionRef = target.selectionRef
    const upload = (data: unknown, key: string) => {
      const form = new FormData()
      form.set("file", new File([JSON.stringify(data)], "dashboard.json", { type: "application/json" }))
      form.set("surface", "dashboard")
      form.set("selectionRef", selectionRef)
      form.set("options", JSON.stringify({ newVersion: false, removeMissing: false, preview: {} }))
      return send("sf=import-admit", { method: "POST", headers: { "idempotency-key": key }, body: form })
    }
    const beforeScan = await inspect()
    // Synthetic token-shaped text, never a real credential; the pinned scanner must refuse it.
    const blocked = await upload({ risks: [{ id: "risk-1", name: "ghp_" + "0123456789abcdefghijklmnopqrstuvwxyz" }] }, "scanner-negative")
    expect(blocked.status).toBe(403)
    expect(object(await blocked.json()).status).toBe("denied")
    expect(scans.map((scan) => scan.hit)).toEqual([true])
    expect(await inspect()).toEqual(beforeScan)

    const importedName = "Reviewed risk imported from JSON"
    const admitted = object(await ok(await upload({ risks: [{ id: "risk-1", name: importedName, status: "Open" }], roleMap: [{ protected: "forged" }], budgetLineIds: { protected: "forged" } }, "admit-reviewed-json")))
    if (typeof admitted.ref !== "string") throw new Error("The admitted file has no host reference")
    expect(scans.map((scan) => scan.hit)).toEqual([true, false])
    const preview = object(await ok(await post("import-preview", { admittedFileRef: admitted.ref, format: "json", options: {} }, "preview-reviewed-json")))
    if (typeof preview.id !== "string" || typeof preview.version !== "number") throw new Error("The preview has no versioned manifest")
    expect(preview.state).toBe("preview")
    expect(preview.domainApplied).toBe(false)
    expect(object(preview.context).currency).toBe("unspecified")
    expect(rows(preview.commands)).toHaveLength(1)
    expect(rows(preview.commands).every((command) => object(object(command.preview).context).currency === "unspecified")).toBe(true)
    expect((await inspect()).risks).toEqual(beforeScan.risks)
    const detail = object(await ok(await send(new URLSearchParams({ sf: "import-detail", manifestId: preview.id, version: String(preview.version) }))))
    expect(JSON.stringify(detail.detail)).toContain(importedName)
    expect(JSON.stringify(detail.detail)).toContain("Before reviewed import")
    const apply = { manifestId: preview.id, version: preview.version }
    const beforeRefusal = await inspect()
    expect((await post("import-apply", apply, "apply-without-identity", false)).status).toBe(403)
    expect(await inspect()).toEqual(beforeRefusal)
    const applied = await ok(await post("import-apply", apply, "apply-reviewed-json"))
    const after = await inspect()
    expect(after.risks).toEqual([{ id: "risk-1", name: importedName, status: "Open" }])
    expect(after.roleMap).toEqual(roleMap)
    expect(after.budgetLineIds).toEqual({ protected: "current-budget-identity" })
    expect(after.auditLength).toBeGreaterThan(beforeRefusal.auditLength)
    expect(await ok(await post("import-apply", apply, "apply-reviewed-json"))).toEqual(applied)
    expect(await inspect()).toEqual(after)
    const reloaded = await send("page=IT+Risks")
    expect(reloaded.status).toBe(200)
    expect(await reloaded.text()).toContain(importedName)

    // Submit the real footer form's public fields, then inspect the generated artifact.
    const reportQuery = new URLSearchParams({ page: "IT Risks", download: "docx", year: "2026", title: "Reviewed Dashboard import", topic: "IT Risks" })
    expect((await send(reportQuery, {}, false)).status).toBe(401)
    const report = await send(reportQuery)
    expect(report.status).toBe(200)
    expect(report.headers.get("content-type")).toContain("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    expect(report.headers.get("content-disposition")).toContain(".docx")
    expect(report.headers.get("cache-control")).toContain("no-store")
    const bytes = new Uint8Array(await report.arrayBuffer())
    expect([...bytes.slice(0, 4)]).toEqual([80, 75, 3, 4])
    const { default: JSZip } = await import("jszip")
    const zip = await JSZip.loadAsync(bytes)
    const document = zip.file("word/document.xml")
    if (!document) throw new Error("The real export did not produce a Word document")
    const xml = await document.async("string")
    expect(xml).toContain("Reviewed Dashboard import")
    expect(xml).toContain(importedName)
    expect(xml).not.toContain("Before reviewed import")
    expect(xml).not.toContain("__sfProductV1")
    console.info("SF_DASHBOARD_IMPORT_REPORT", JSON.stringify({ scope: "Authenticated application HTTP and real JSON import / DOCX producers; no browser-click or ClamD qualification assertion",
      scanner: { name: scanner.name, version: pinned.version, scans }, manifestId: preview.id, version: preview.version,
      artifact: { format: "docx", bytes: bytes.byteLength, sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex") } }))
  } finally { await driver.dispose(); await rm(directory, { recursive: true, force: true }) }
}, 120000)

async function ok(response: Response) {
  expect(response.status).toBe(200)
  const body = object(await response.json())
  expect(body.status).toBe("ok")
  return body.value
}
