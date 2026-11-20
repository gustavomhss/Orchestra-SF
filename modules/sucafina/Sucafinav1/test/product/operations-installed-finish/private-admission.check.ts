import { afterEach, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { createHash, randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdtemp, readFile, realpath, rm } from "node:fs/promises"
import { createConnection } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"
import { Workbook } from "exceljs"
import { createOperationsInstallation } from "../../../../../../packages/app-shell/e2e/sucafina/operations-support/installation.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { scanLocalFile } from "../../../runtime/local-scanner.ts"
import { object, rows, text } from "../../../runtime/contract.ts"
import type { Command } from "../../../runtime/contract.ts"
import type { Surface } from "../../../src/identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"

// Mandatory Actions controls of the production HTTP/factory/store composition.
// These supplement, and do not replace or qualify, the five browser journeys.
const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
  const failures: unknown[] = []
  for (const close of cleanups.splice(0).reverse()) {
    try { await close() } catch (error) { failures.push(error) }
  }
  if (failures.length) throw new AggregateError(failures, "Operations private admission cleanup failed")
})

function endpoint(name: string) {
  const value = process.env[name]
  if (!value || !/^\d+$/.test(value)) throw new Error("OPERATIONS75_REAL_CLAMD_NOT_PROVISIONED:" + name)
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("OPERATIONS75_INVALID_CLAMD_PORT:" + name)
  expect(process.env.GITHUB_RUN_ID).toMatch(/^\d+$/)
  return { host: "127.0.0.1" as const, port }
}

function eicar() {
  const bytes = Buffer.from("WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=", "base64")
  expect(bytes.length).toBe(68)
  expect(createHash("md5").update(bytes).digest("hex")).toBe("44d88612fea8a8f36de82e1278abb02f")
  return bytes
}

async function fixture(scanner: ReturnType<typeof endpoint>) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-operations-private-"))
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
  const installationId = randomUUID(), origin = "http://127.0.0.1:4174", mount = "/wp04/private-admission"
  const principalRef = "macos:" + installationId + ":1001"
  const identity = createOperatorIdentity({
    origin, mount, operator: { installationId, uid: 1001, name: "Private admission operator", buyer: true },
    secrets: persistence.secrets, key: randomBytes(32),
  })
  const bankKey = randomBytes(32)
  const installation = createOperationsInstallation({
    installationId, directory, origin, mount, principalRef, readOnly: false, persistence,
    authenticate: identity.authenticate,
    environment: async () => ({ at, id: randomUUID, directory: [{ id: principalRef, name: "Private admission operator" }], bankKey }),
    signingKey: randomBytes(32), scanner,
  })
  cleanups.push(async () => { installation.dispose() })
  const admitted = await identity.handle(new Request(origin + mount + "/auth/local?code=" + await identity.enroll()))
  expect(admitted?.status).toBe(303)
  const cookie = admitted!.headers.get("set-cookie")!.split(";")[0]!
  const call = async (surface: Surface, query: Record<string, string> = {}, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    headers.set("Cookie", cookie)
    headers.set("Origin", origin)
    const response = await installation.application(new Request(origin + mount + "/" + surface + "?" + new URLSearchParams(query), { ...init, headers }))
    if (!response) throw new Error("OPERATIONS75_EXPECTED_INSTALLED_RESPONSE")
    return response
  }
  const command = async (surface: Surface, value: Command) => {
    const response = await call(surface, {}, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true })
  }
  await command("procurement", { page: "Settings", action: "reset", version: 0, values: {} })
  const settingsVersion = await persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: snapshot.versions.settings!.version }))
  await command("procurement", { page: "Settings", action: "save", version: settingsVersion, values: { uploadCap: 16 * 1024 * 1024 } })
  await command("procurement", { page: "Suppliers", action: "create", version: 0, values: {
    legalName: "Private admission supplier", country: "France", address: "Isolated fixture", taxId: randomUUID(),
    contactEmail: "scanner@example.invalid", paymentTerms: "Net 45", currency: "USD", riskRating: "Low",
  } })
  const supplier = await persistence.transaction("procurement", async (snapshot) => {
    const suppliers = rows(object(snapshot.data.store).suppliers)
    expect(suppliers).toHaveLength(1)
    const id = text(suppliers[0]!.id)
    expect(id).not.toBe("")
    return { commit: false, value: id }
  })
  await command("planner", { page: "Versions", action: "save", version: 0, values: {} })
  const discovered = await call("planner", { sf: "import-targets", surface: "planner" })
  expect(discovered.status).toBe(200)
  const discoveredBody = object(await discovered.json())
  expect(discoveredBody.status).toBe("ok")
  const targets = rows(discoveredBody.value)
  expect(targets).toHaveLength(1)
  expect(targets[0]).toMatchObject({ surface: "planner", formats: expect.arrayContaining(["xlsx"]) })
  const selectionRef = text(targets[0]!.selectionRef)
  expect(selectionRef).not.toBe("")
  return { ...installation, directory, persistence, call, supplier, selectionRef, principalRef }
}

type Fixture = Awaited<ReturnType<typeof fixture>>

// Independent read-only observation includes all business snapshots AND private
// blobs, so denial cannot hide an orphaned staging object. Never read credentials.
function durable(f: Fixture) {
  const db = new Database(path.join(f.directory, "installation.sqlite"), { readonly: true, strict: true })
  try {
    const snapshots = db.query<{ surface: string; payload: string }, []>("SELECT surface, payload FROM snapshots ORDER BY surface").all()
    const blobs = db.query<{ surface: string; key: string; type: string; payload: Uint8Array }, []>("SELECT surface, key, type, payload FROM blobs ORDER BY surface, key").all()
    return {
      snapshots: snapshots.map((row) => ({ surface: row.surface, digest: createHash("sha256").update(row.payload).digest("hex") })),
      blobs: blobs.map((row) => ({ surface: row.surface, key: row.key, type: row.type, size: row.payload.byteLength, digest: createHash("sha256").update(row.payload).digest("hex") })),
    }
  } finally { db.close() }
}

async function workbook() {
  const book = new Workbook()
  book.addWorksheet("OPEX").addRows([
    ["Line ID", "Cost element", "Vendor / item", "Currency", "Measure", "Jan"],
    [randomUUID(), "Licenses", "Scanner clean control", "USD", "Forecast", 84000],
  ])
  return new Uint8Array(await book.xlsx.writeBuffer())
}

async function importFile(f: Fixture, bytes: Uint8Array) {
  const form = new FormData()
  form.set("file", new File([new Uint8Array(bytes)], "private-control.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
  form.set("surface", "planner")
  form.set("selectionRef", f.selectionRef)
  form.set("options", JSON.stringify({ newVersion: false, removeMissing: false, preview: {} }))
  return f.call("planner", { sf: "import-admit" }, { method: "POST", headers: { "Idempotency-Key": randomUUID() }, body: form })
}

async function acceptedImport(f: Fixture, bytes: Uint8Array) {
  const response = await importFile(f, bytes)
  expect(response.status).toBe(200)
  const body = object(await response.json())
  expect(body.status).toBe("ok")
  const value = object(body.value)
  const ref = text(value.ref), digest = createHash("sha256").update(bytes).digest("hex")
  expect(ref).not.toBe("")
  expect(value.digest).toBe(digest)
  await f.persistence.transaction("dashboard", async (snapshot, blobs) => {
    const entry = object(object(object(snapshot.data.__sfProductV1).documents)["import-file:" + ref])
    expect(entry).toMatchObject({ schema: "sf-import-file-v1", principalRef: f.principalRef, digest, size: bytes.byteLength })
    expect(object(entry.target).selectionRef).toBe(f.selectionRef)
    expect(await blobs.get(text(entry.key))).toEqual(bytes)
    expect(await blobs.get(text(entry.key) + "/admission")).toBeInstanceOf(Uint8Array)
    return { commit: false, value: undefined }
  })
  return ref
}

async function deniedImport(f: Fixture, bytes: Uint8Array) {
  const before = durable(f)
  const response = await importFile(f, bytes)
  expect(response.status).toBe(403)
  expect(await response.json()).toEqual({ status: "denied" })
  expect(f.admissionDiagnostics().at(-1)).toEqual({ stage: "file-admit", status: "denied", reason: "file-not-accepted" })
  expect(durable(f)).toEqual(before)
}

async function supplierVersion(f: Fixture) {
  return f.persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: snapshot.versions["suppliers:" + f.supplier]!.version }))
}

async function upload(f: Fixture, name: string, bytes: Uint8Array) {
  return f.call("procurement", {
    page: "Suppliers", upload: "supplier", record: f.supplier,
    recordVersion: String(await supplierVersion(f)), name,
  }, { method: "POST", headers: { "Content-Type": "text/plain" }, body: new Uint8Array(bytes) })
}

async function acceptedUpload(f: Fixture, name: string, bytes: Uint8Array) {
  const version = await supplierVersion(f)
  const response = await upload(f, name, bytes)
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ ok: true })
  expect(await supplierVersion(f)).toBe(version + 1)
  await f.persistence.transaction("procurement", async (snapshot, blobs) => {
    const assets = rows(snapshot.data.assets).filter((asset) => asset.name === name)
    expect(assets).toHaveLength(1)
    expect(assets[0]).toMatchObject({ record: f.supplier, kind: "supplier", bytes: bytes.byteLength })
    expect(await blobs.get(text(assets[0]!.key))).toEqual(bytes)
    return { commit: false, value: undefined }
  })
}

async function deniedUpload(f: Fixture, bytes: Uint8Array) {
  const before = durable(f)
  const response = await upload(f, "rejected-control.txt", bytes)
  expect(response.status).toBe(422)
  expect(await response.json()).toEqual({ ok: false, errors: ["The scanner did not accept this file."] })
  expect(durable(f)).toEqual(before)
}

test("real private import admission persists clean bytes and rejects EICAR without durable effects", async () => {
  const f = await fixture(endpoint("SF_OPERATIONS_CLAMD_PORT"))
  const bytes = await workbook()
  const first = await acceptedImport(f, bytes)
  // Deliberately mislabel raw EICAR as XLSX: admission must scan it before a parser.
  // This is not presented as a syntactically valid infected workbook.
  await deniedImport(f, eicar())
  expect(await acceptedImport(f, bytes)).not.toBe(first)
  console.info("OPERATIONS75_PRIVATE_IMPORT " + JSON.stringify({ clean: true, eicar: false, clean_after: true, denied_durable_effects: 0 }))
})

test("real private supplier upload commits clean bytes and rejects EICAR before mutation", async () => {
  const f = await fixture(endpoint("SF_OPERATIONS_CLAMD_PORT"))
  const bytes = new TextEncoder().encode("Price: 42\nCurrency: USD\n")
  await acceptedUpload(f, "clean-before.txt", bytes)
  await deniedUpload(f, eicar())
  await acceptedUpload(f, "clean-after.txt", bytes)
  console.info("OPERATIONS75_PRIVATE_UPLOAD " + JSON.stringify({ clean: true, eicar: false, clean_after: true, denied_durable_effects: 0 }))
})

test("private import and supplier upload fail closed against the stopped owned real daemon", async () => {
  const limited = endpoint("SF_OPERATIONS_CLAMD_ERROR_PORT"), main = endpoint("SF_OPERATIONS_CLAMD_PORT")
  expect(limited.port).not.toBe(main.port)
  const evidence = process.env.SF_OPERATIONS_SCANNER_EVIDENCE, temporary = process.env.RUNNER_TEMP
  if (!evidence || !temporary) throw new Error("OPERATIONS75_REQUIRES_JOB_LOCAL_SERVICE_RECEIPT")
  const receipt = object(JSON.parse(await readFile(path.join(evidence, "service.json"), "utf8")))
  expect(receipt.run_id).toBe(process.env.GITHUB_RUN_ID)
  expect(receipt.run_attempt).toBe(process.env.GITHUB_RUN_ATTEMPT)
  expect(receipt.github_sha).toBe(process.env.GITHUB_SHA)
  const directory = await realpath(text(receipt.work_directory))
  expect(directory.startsWith(await realpath(temporary) + path.sep)).toBe(true)
  expect(await realpath(evidence)).toBe(path.join(directory, "evidence"))
  expect(object(receipt.error).port).toBe(limited.port)
  expect(object(receipt.main).port).toBe(main.port)
  // The preceding real-clamd.check selection verified and stopped only this job's
  // second daemon. This check neither kills a process nor invents a dead endpoint.
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection(limited)
    const deadline = setTimeout(() => { socket.destroy(); reject(new Error("OPERATIONS75_OUTAGE_CONTROL_DEADLINE")) }, 5000)
    socket.once("connect", () => { clearTimeout(deadline); socket.destroy(); reject(new Error("OPERATIONS75_REAL_ERROR_DAEMON_STILL_RUNNING")) })
    socket.once("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(deadline)
      socket.destroy()
      if (error.code === "ECONNREFUSED") resolve()
      else reject(error)
    })
  })
  const f = await fixture(limited)
  await deniedImport(f, await workbook())
  await deniedUpload(f, new TextEncoder().encode("Price: 42\n"))
  expect(await scanLocalFile(new TextEncoder().encode("Main daemon remains available\n"), main)).toBe(true)
  console.info("OPERATIONS75_PRIVATE_DOWN " + JSON.stringify({ connection_refused: true, import_admitted: false, upload_admitted: false, denied_durable_effects: 0, main_clean: true }))
})
