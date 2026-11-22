import { expect, test } from "bun:test"
import { createHash, randomUUID } from "node:crypto"
import { readFile, realpath, writeFile } from "node:fs/promises"
import { createConnection } from "node:net"
import { join, sep } from "node:path"
import { Workbook } from "exceljs"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { object, rows, text } from "../../../runtime/contract.ts"
import { decodeSnapshot } from "../../../runtime/local-store.ts"
import { scanLocalFile } from "../../../runtime/local-scanner.ts"
import { microsoftHttpFixture } from "../../fixture/microsoft-http.ts"

type MicrosoftFixture = Awaited<ReturnType<typeof microsoftHttpFixture>>
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
const principalId = "33333333-3333-4333-8333-333333333333"

test("Microsoft Team private import admits clean bytes and rejects real EICAR with isolated staging", async () => {
  await control("private-admission", "main", async (f) => {
    const intakeLimit = await concurrentIntakes(f)
    const observations = []
    for (const team of [f.http.teamA, f.http.teamB]) {
      const before = await acceptedImport(f, team, await workbook())
      const refused = await deniedImport(f, team, eicar())
      const after = await acceptedImport(f, team, await workbook())
      observations.push({ teamObjectId: team, before, refused, after })
    }
    return { observations, intakeLimit, mainCleanAfter: await healthyMain() }
  })
}, 120_000)

test("Microsoft Team original import preview rejects benign malformed bytes after real clean staging", async () => {
  await control("malformed-file", "main", async (f) => {
    const valid = await workbook()
    expect(valid.byteLength).toBeGreaterThan(22)
    const observations = []
    for (const input of [
      { kind: "format-mismatch", bytes: new TextEncoder().encode("Benign plain text presented as an XLSX workbook.\n") },
      { kind: "truncated-xlsx", bytes: valid.subarray(0, valid.byteLength - 22) },
    ]) {
      const before = f.http.durable()
      const response = await importFile(f, f.http.teamA, input.bytes)
      if (input.kind === "format-mismatch") expect(response.status).toBe(200)
      if (response.status === 403 && input.kind === "truncated-xlsx") {
        expect(await response.json()).toEqual({ status: "denied" })
        observations.push({ kind: input.kind, digest: digest(input.bytes), bytes: input.bytes.byteLength,
          scannerAccepted: false, staged: false, rejectedAt: "admission", httpStatus: 403,
          durable: unchanged(f.http, before) })
        continue
      }
      const admitted = await acceptedImport(f, f.http.teamA, input.bytes, response, before)
      const previewBefore = f.http.durable()
      const preview = await previewFile(f, f.http.teamA, admitted.ref)
      expect(preview.status).toBe(400)
      expect(await preview.json()).toEqual({ status: "needs-input" })
      observations.push({ kind: input.kind, digest: digest(input.bytes), bytes: input.bytes.byteLength,
        scannerAccepted: true, staged: true, rejectedAt: "preview", httpStatus: preview.status,
        admission: admitted, durable: unchanged(f.http, previewBefore) })
    }
    return { observations, truncatedSourceDigest: digest(valid), truncatedSourceBytes: valid.byteLength,
      truncatedRemovedBytes: 22, mainCleanAfter: await healthyMain() }
  })
}, 120_000)

test("Microsoft Team private import rejects foreign ownership missing grants and revoked membership", async () => {
  await control("denied-owner", "main", async (f) => {
    const admitted = await acceptedImport(f, f.http.teamA, await workbook())
    const attempts = []
    const target = f.http.profile(f.http.teamA)
    for (const [kind, owner] of [
      ["wrong-installation", { ...target, installationId: "foreign-installation" }],
      ["wrong-tenant", { ...target, tenantId: f.http.clientId }],
      ["selector-route-mismatch", { ...target, teamObjectId: f.http.teamB }],
    ] as const) {
      const before = f.http.durable()
      const response = await importFile(f, f.http.teamA, new TextEncoder().encode("Refused owner\n"), owner)
      expect(response.status).toBe(403)
      await response.body?.cancel()
      attempts.push({ kind, httpStatus: response.status, durable: unchanged(f.http, before) })
    }
    const crossBefore = f.http.durable()
    const cross = await previewFile(f, f.http.teamB, admitted.ref)
    expect(cross.status).toBe(503)
    expect(await cross.json()).toEqual({ status: "unavailable" })
    const foreignReference = { httpStatus: cross.status, durable: unchanged(f.http, crossBefore) }
    const revokedBefore = f.http.durable()
    f.http.state.teams = [f.http.teamB, f.http.disabledTeam]
    const revoked = await importFile(f, f.http.teamA, new TextEncoder().encode("Refused revoked Team\n"))
    expect(revoked.status).toBe(403)
    await revoked.body?.cancel()
    attempts.push({ kind: "revoked-membership", httpStatus: revoked.status, durable: unchanged(f.http, revokedBefore) })
    f.http.state.teams = [f.http.teamA, f.http.teamB, f.http.disabledTeam]
    const noGrant = await fixture(f.scanner, false)
    const missingGrant = await (async () => {
      try {
        const before = noGrant.http.durable()
        const response = await call(noGrant, noGrant.http.teamA, { sf: "import-targets", surface: "planner" })
        expect(response.status).toBe(403)
        expect(await response.json()).toEqual({ status: "denied" })
        return { httpStatus: response.status, binding: noGrant.http.installationId, explicitGrants: 0,
          durable: unchanged(noGrant.http, before) }
      } finally { await noGrant.http.close() }
    })()
    expect(noGrant.http.state.cleanupComplete).toBe(true)
    const configurationRevocation = await configurationRevocations(f)
    return { attempts, foreignReference, missingGrant: { ...missingGrant, cleanupComplete: true }, configurationRevocation,
      mainCleanAfter: await healthyMain() }
  })
}, 120_000)

test("Microsoft Team private import fails closed against the stopped owned real ClamD", async () => {
  await control("scanner-outage", "error", async (f) => {
    await refused(f.scanner)
    const attempts = []
    for (const team of [f.http.teamA, f.http.teamB])
      attempts.push({ teamObjectId: team, ...await deniedImport(f, team, new TextEncoder().encode("Clean bytes during owned outage\n")) })
    return { connectionRefused: true, attempts, mainCleanAfter: await healthyMain() }
  })
}, 120_000)


/** Mutate the actual private descriptor, including after the original HTTP body
 * has been consumed. Only provider observation is controlled; storage and the
 * scanner remain real, and the same Request crosses every authority fence. */
async function configurationRevocations(f: Fixture) {
  const file = join(f.http.directory, "installation.json")
  const original = await readFile(file, "utf8")
  const changed = (kind: "grants" | "roles") => {
    const config = object(JSON.parse(original))
    if (kind === "grants") config.grants = []
    else {
      const groups = object(config.groups)
      config.groups = { ...groups, planner: {} }
    }
    return JSON.stringify(config)
  }
  const observations = []
  const restored = async () => {
    await writeFile(file, original, { mode: 0o600 })
    const response = await call(f, f.http.teamA, { sf: "import-targets", surface: "planner" })
    expect(response.status).toBe(200)
    expect(object(await response.json()).status).toBe("ok")
    return response.status
  }
  try {
    for (const kind of ["grants", "roles"] as const) {
      const before = f.http.durable()
      await writeFile(file, changed(kind), { mode: 0o600 })
      const response = await call(f, f.http.teamA, { sf: "import-targets", surface: "planner" })
      expect(response.status).toBe(403)
      await response.body?.cancel()
      const durable = unchanged(f.http, before)
      observations.push({ kind, boundary: "before-request", httpStatus: response.status,
        originalBodyObserved: false, durable, restoredReadStatus: await restored() })
    }
    for (const kind of ["grants", "roles"] as const) {
      const before = f.http.durable()
      let originalRequest: Request | undefined
      let revoked = false
      f.http.state.observeRequest = (request) => {
        if (new URL(request.url).searchParams.get("sf") === "import-admit") originalRequest = request
      }
      f.http.state.beforeGraphRequest = async () => {
        if (revoked || !originalRequest?.bodyUsed) return
        await writeFile(file, changed(kind), { mode: 0o600 })
        revoked = true
      }
      try {
        const response = await importFile(f, f.http.teamA, await workbook())
        expect(revoked).toBe(true)
        expect(originalRequest?.bodyUsed).toBe(true)
        expect(response.status).toBe(403)
        await response.body?.cancel()
        const durable = unchanged(f.http, before)
        delete f.http.state.observeRequest
        delete f.http.state.beforeGraphRequest
        observations.push({ kind, boundary: "after-request-body", httpStatus: response.status,
          originalBodyObserved: true, durable, restoredReadStatus: await restored() })
      } finally {
        delete f.http.state.observeRequest
        delete f.http.state.beforeGraphRequest
        await writeFile(file, original, { mode: 0o600 })
      }
    }
    const before = f.http.durable()
    await writeFile(file, "{", { mode: 0o600 })
    const invalid = await call(f, f.http.teamA, { sf: "import-targets", surface: "planner" })
    expect(invalid.status).toBe(503)
    await invalid.body?.cancel()
    const durable = unchanged(f.http, before)
    observations.push({ kind: "unavailable", boundary: "before-request", httpStatus: invalid.status,
      originalBodyObserved: false, durable, restoredReadStatus: await restored() })
    const cleanAfterRestore = await acceptedImport(f, f.http.teamA, await workbook())
    return { source: "private-installation-file", observations, cleanAfterRestore }
  } finally {
    delete f.http.state.observeRequest
    delete f.http.state.beforeGraphRequest
    await writeFile(file, original, { mode: 0o600 })
  }
}

async function ownedScanner(kind: "main" | "error") {
  const evidence = process.env.SF_OPERATIONS_SCANNER_EVIDENCE, temporary = process.env.RUNNER_TEMP
  if (!evidence || !temporary) throw new Error("G06_TEAM_IMPORT_REQUIRES_REAL_CLAMD")
  const receipt = object(JSON.parse(await readFile(join(evidence, "service.json"), "utf8")))
  expect(receipt.github_sha).toBe(process.env.GITHUB_SHA)
  expect(receipt.run_id).toBe(process.env.GITHUB_RUN_ID)
  expect(receipt.run_attempt).toBe(process.env.GITHUB_RUN_ATTEMPT)
  const directory = await realpath(text(receipt.work_directory))
  expect(directory.startsWith(await realpath(temporary) + sep)).toBe(true)
  expect(await realpath(evidence)).toBe(join(directory, "evidence"))
  const daemon = object(receipt[kind])
  const port = Number(process.env[kind === "main" ? "SF_OPERATIONS_CLAMD_PORT" : "SF_OPERATIONS_CLAMD_ERROR_PORT"])
  expect(Number.isInteger(port) && port > 0 && port < 65536).toBe(true)
  expect(daemon.host).toBe("127.0.0.1")
  expect(daemon.port).toBe(port)
  expect(typeof daemon.pid === "number" && Number.isInteger(daemon.pid) && daemon.pid > 1).toBe(true)
  expect(object(receipt.main).pid).not.toBe(object(receipt.error).pid)
  expect(object(receipt.main).port).not.toBe(object(receipt.error).port)
  return { host: "127.0.0.1" as const, port, pid: Number(daemon.pid) }
}

async function healthyMain() {
  expect(await scanLocalFile(new TextEncoder().encode("Clean after Microsoft private imports\n"), await ownedScanner("main"))).toBe(true)
  return true
}

function eicar() {
  const bytes = Buffer.from("WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=", "base64")
  expect(bytes.length).toBe(68)
  expect(createHash("md5").update(bytes).digest("hex")).toBe("44d88612fea8a8f36de82e1278abb02f")
  return bytes
}

async function workbook() {
  const book = new Workbook()
  book.addWorksheet("OPEX").addRows([
    ["Line ID", "Cost element", "Vendor / item", "Currency", "Measure", "Jan"],
    [randomUUID(), "Licenses", "Microsoft Team clean scanner control", "USD", "Forecast", 84000],
  ])
  return new Uint8Array(await book.xlsx.writeBuffer())
}

async function fixture(scanner: Awaited<ReturnType<typeof ownedScanner>>, granted = true): Promise<Fixture> {
  const http = await microsoftHttpFixture({
    label: "g06", scanner: { host: scanner.host, port: scanner.port }, plannerAdministrator: true,
    grants: granted ? [{ principalRef: principalId, namespaces: ["documents"],
      operations: ["sf_import_preview"], humanActions: ["imports.admit", "imports.apply"] }] : [],
  })
  try {
    expect(http.principalId).toBe(principalId)
    const f = { http, scanner, cookie: await http.login(), targets: {} as Record<string, string> }
    for (const team of [http.teamA, http.teamB]) {
      const created = await call(f, team, {}, { method: "POST", body: JSON.stringify({
        page: "Versions", action: "save", version: 0, values: {},
      }) }, { "content-type": "application/json" })
      expect(created.status).toBe(200)
      expect(await created.json()).toMatchObject({ ok: true })
      if (!granted) continue
      const discovered = await call(f, team, { sf: "import-targets", surface: "planner" })
      expect(discovered.status).toBe(200)
      const body = object(await discovered.json())
      expect(body.status).toBe("ok")
      const targets = rows(body.value)
      expect(targets).toHaveLength(1)
      expect(targets[0]).toMatchObject({ surface: "planner", formats: expect.arrayContaining(["xlsx"]) })
      f.targets[team] = text(targets[0]!.selectionRef)
      expect(f.targets[team]).not.toBe("")
    }
    return f
  } catch (error) {
    await http.close()
    throw error
  }
}
type Fixture = {
  http: MicrosoftFixture
  scanner: Awaited<ReturnType<typeof ownedScanner>>
  cookie: string
  targets: Record<string, string>
}

function call(f: Fixture, team: string, query: Record<string, string>,
  init: Pick<RequestInit, "method" | "body"> = {}, headers: Record<string, string> = {},
  owner = f.http.profile(team)) {
  return f.http.request("/teams/" + team + "/planner" + (Object.keys(query).length ? "?" + new URLSearchParams(query) : ""),
    { cookie: f.cookie, origin: f.http.origin, "x-sf-team-profile": f.http.selector(owner), ...headers }, init)
}

function importFile(f: Fixture, team: string, bytes: Uint8Array, owner = f.http.profile(team)) {
  const form = new FormData()
  form.set("file", new File([new Uint8Array(bytes)], "team-private-control.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
  form.set("surface", "planner")
  form.set("selectionRef", f.targets[team]!)
  form.set("options", JSON.stringify({ newVersion: false, removeMissing: false, preview: {} }))
  return call(f, team, { sf: "import-admit" }, { method: "POST", body: form }, { "idempotency-key": randomUUID() }, owner)
}

function previewFile(f: Fixture, team: string, ref: string) {
  return call(f, team, { sf: "import-preview" }, {
    method: "POST", body: JSON.stringify({ admittedFileRef: ref, format: "xlsx", options: {} }),
  }, { "content-type": "application/json", "idempotency-key": randomUUID() })
}

function unchanged(http: MicrosoftFixture, before: ReturnType<MicrosoftFixture["durable"]>) {
  const after = http.durable()
  expect(after).toEqual(before)
  return before.map((value, index) => ({ teamObjectId: value.teamObjectId,
    before: digestSfValue(value), after: digestSfValue(after[index]) }))
}

async function acceptedImport(f: Fixture, team: string, bytes: Uint8Array, observed?: Response,
  before = f.http.durable()) {
  const response = observed ?? await importFile(f, team, bytes)
  expect(response.status).toBe(200)
  const body = object(await response.json())
  expect(body.status).toBe("ok")
  const value = object(body.value), ref = text(value.ref)
  expect(ref).not.toBe("")
  expect(value.digest).toBe(digest(bytes))
  const after = f.http.durable()
  const stored = after.find((entry) => entry.teamObjectId === team)!
  const row = stored.snapshots.find((entry) => entry.surface === "dashboard")
  if (!row) throw new Error("G06_TEAM_IMPORT_DASHBOARD_MISSING")
  const snapshot = decodeSnapshot(row.payload)
  const entry = object(object(object(snapshot.data.__sfProductV1).documents)["import-file:" + ref])
  expect(entry).toMatchObject({ schema: "sf-import-file-v1", principalRef: principalId,
    digest: digest(bytes), size: bytes.byteLength, key: "sf-import/" + ref })
  expect(object(entry.target).selectionRef).toBe(f.targets[team])
  const blob = stored.blobs.find((item) => item.surface === "dashboard" && item.key === "sf-import/" + ref)
  const proof = stored.blobs.find((item) => item.surface === "dashboard" && item.key === "sf-import/" + ref + "/admission")
  if (!blob || !proof) throw new Error("G06_TEAM_IMPORT_PRIVATE_BLOB_PAIR_MISSING")
  expect(Buffer.from(blob.payload, "hex")).toEqual(Buffer.from(bytes))
  expect(object(JSON.parse(Buffer.from(proof.payload, "hex").toString("utf8")))).toEqual({
    schema: "sf-import-admission-v1", entryDigest: digestSfValue(entry), expiresAt: value.expiresAt,
  })
  const other = team === f.http.teamA ? f.http.teamB : f.http.teamA
  const otherBefore = before.find((item) => item.teamObjectId === other)!
  const otherAfter = after.find((item) => item.teamObjectId === other)!
  expect(otherAfter).toEqual(otherBefore)
  return { httpStatus: response.status, ref, bytes: bytes.byteLength, digest: digest(bytes),
    storedDigest: digest(Buffer.from(blob.payload, "hex")), proofDigest: digest(Buffer.from(proof.payload, "hex")),
    catalogDigest: digestSfValue(entry), otherTeam: { teamObjectId: other,
      before: digestSfValue(otherBefore), after: digestSfValue(otherAfter) } }
}

async function concurrentIntakes(f: Fixture) {
  const before = f.http.durable()
  const releases: (() => void)[] = []
  const pending = [0, 1].map(() => {
    const boundary = "sf-g06-" + randomUUID()
    const body = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new TextEncoder().encode("--" + boundary +
        "\r\nContent-Disposition: form-data; name=\"surface\"\r\n\r\nplanner\r\n"))
      releases.push(() => {
        controller.enqueue(new TextEncoder().encode("--" + boundary + "--\r\n"))
        controller.close()
      })
    } })
    return call(f, f.http.teamA, { sf: "import-admit" }, { method: "POST", body },
      { "content-type": "multipart/form-data; boundary=" + boundary, "idempotency-key": randomUUID() })
  })
  const completed = Promise.allSettled(pending)
  let released: Response[] = []
  let busy: { httpStatus: number; retryAfter: string | null } | undefined
  try {
    const deadline = Date.now() + 10_000
    while (!busy && Date.now() < deadline) {
      // A completed form without a file cannot stage data. It is used only to
      // observe the original transport's shared intake counter over real TCP.
      const form = new FormData()
      form.set("surface", "planner")
      const response = await call(f, f.http.teamA, { sf: "import-admit" }, { method: "POST", body: form },
        { "idempotency-key": randomUUID() })
      const value = await response.json()
      if (response.status === 503) {
        expect(value).toEqual({ status: "unavailable", reason: "import-intake-busy" })
        expect(response.headers.get("retry-after")).toBe("1")
        busy = { httpStatus: response.status, retryAfter: response.headers.get("retry-after") }
      } else {
        expect(response.status).toBe(400)
        expect(value).toEqual({ status: "invalid" })
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
    }
    expect(busy).toBeDefined()
  } finally {
    const failures: unknown[] = []
    for (const release of releases) { try { release() } catch (error) { failures.push(error) } }
    const results = await completed
    for (const result of results) {
      if (result.status === "fulfilled") released.push(result.value)
      else failures.push(result.reason)
    }
    if (failures.length) throw new AggregateError(failures, "G06_TEAM_IMPORT_INTAKE_RELEASE_FAILED")
    for (const response of released) {
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ status: "invalid" })
    }
  }
  return { pending: 2, busy, released: released.map((response) => response.status),
    durable: unchanged(f.http, before) }
}

async function deniedImport(f: Fixture, team: string, bytes: Uint8Array) {
  const before = f.http.durable()
  const response = await importFile(f, team, bytes)
  expect(response.status).toBe(403)
  expect(await response.json()).toEqual({ status: "denied" })
  return { httpStatus: response.status, bytes: bytes.byteLength, digest: digest(bytes),
    durable: unchanged(f.http, before) }
}

async function control(id: "private-admission" | "malformed-file" | "denied-owner" | "scanner-outage",
  kind: "main" | "error", work: (f: Fixture) => Promise<unknown>) {
  const scanner = await ownedScanner(kind)
  const f = await fixture(scanner)
  const result = await (async () => {
    try { return await work(f) }
    finally { await f.http.close() }
  })()
  expect(f.http.state.cleanupComplete).toBe(true)
  expect(f.http.state.graphCalls).toContain("/v1.0/me/joinedTeams")
  expect(f.http.state.requests).toBeGreaterThan(0)
  expect(f.http.state.loopbackPeers).toBe(f.http.state.requests)
  expect(f.http.state.ingressRequests).toBe(f.http.state.requests)
  console.info("G06_MICROSOFT_IMPORT_" + id.toUpperCase().replaceAll("-", "_") + " " + JSON.stringify({
    schema: "orchestra.g06.microsoft-team-import-control/2", control: id, status: "PASS",
    sourceSha: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    proofClass: "COMPONENT_REAL_CLAMD", composition: "MICROSOFT_TEAM_NATIVE_IMPORT",
    identityProvider: "CONTROLLED_ENTRA_GRAPH", runtimeFactory: "createMicrosoftInstallation",
    installedTeamsProof: false, finalCandidate: false, scanner,
    binding: { installationId: f.http.installationId, tenantId: f.http.tenantId,
      principalObjectId: f.http.principalId, teamObjectIds: [f.http.teamA, f.http.teamB] },
    transport: f.http.transport(), graphRequests: [...new Set(f.http.state.graphCalls)],
    cleanup: { completed: true, directoryRemoved: true }, result,
  }))
}

async function refused(endpoint: { host: "127.0.0.1"; port: number }) {
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection(endpoint)
    const deadline = setTimeout(() => { socket.destroy(); reject(new Error("G06_TEAM_IMPORT_OUTAGE_DEADLINE")) }, 5000)
    socket.once("connect", () => { clearTimeout(deadline); socket.destroy(); reject(new Error("G06_TEAM_IMPORT_OWNED_DAEMON_RUNNING")) })
    socket.once("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(deadline)
      socket.destroy()
      if (error.code === "ECONNREFUSED") resolve()
      else reject(error)
    })
  })
}
