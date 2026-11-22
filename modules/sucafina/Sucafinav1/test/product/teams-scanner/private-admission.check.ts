import { expect, test } from "bun:test"
import { createHash, randomUUID } from "node:crypto"
import { readFile, realpath } from "node:fs/promises"
import { createConnection } from "node:net"
import { join, sep } from "node:path"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { object, rows, text } from "../../../runtime/contract.ts"
import { decodeSnapshot } from "../../../runtime/local-store.ts"
import { scanLocalFile } from "../../../runtime/local-scanner.ts"
import { microsoftHttpFixture } from "../../fixture/microsoft-http.ts"

// Additional Microsoft/Team composition controls. The original eight Operations
// obligations remain untouched. Native private import-admit/import-preview are
// not mounted by runTeamBusiness; this supplier-upload proof cannot close that gap.
type MicrosoftFixture = Awaited<ReturnType<typeof microsoftHttpFixture>>
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")

test("Microsoft Team private upload persists clean bytes and rejects real EICAR with isolated storage", async () => {
  await control("private-upload", "main", async (f) => {
    const observations = []
    for (const team of [f.http.teamA, f.http.teamB]) {
      const before = await acceptedUpload(f, team, "clean-before.txt", new TextEncoder().encode("G06 clean before: " + team + "\n"))
      const rejected = await deniedUpload(f, team, eicar())
      const after = await acceptedUpload(f, team, "clean-after.txt", new TextEncoder().encode("G06 clean after: " + team + "\n"))
      observations.push({ teamObjectId: team, before, rejected, after })
    }
    return { observations, mainCleanAfter: await healthyMain() }
  })
}, 120_000)

test("Microsoft Team private upload rejects wrong owners and revoked membership without durable effects", async () => {
  await control("denied-owner", "main", async (f) => {
    for (const team of [f.http.teamA, f.http.teamB])
      await acceptedUpload(f, team, "admitted-baseline.txt", new TextEncoder().encode("G06 admitted baseline: " + team + "\n"))
    const attempts = []
    const target = f.http.profile(f.http.teamA)
    for (const [kind, owner] of [
      ["wrong-installation", { ...target, installationId: "foreign-installation" }],
      ["wrong-tenant", { ...target, tenantId: f.http.clientId }],
      ["selector-route-mismatch", { ...target, teamObjectId: f.http.teamB }],
    ] as const) {
      const before = f.http.durable()
      const response = await upload(f, f.http.teamA, "denied-owner.txt", new TextEncoder().encode("G06 owner refusal\n"), owner)
      expect(response.status).toBe(403)
      await response.body?.cancel()
      attempts.push({ kind, httpStatus: response.status, durable: unchanged(f.http, before) })
    }
    const disabledBefore = f.http.durable()
    const disabled = await f.http.request("/teams/" + f.http.disabledTeam + "/procurement?" + new URLSearchParams({
      upload: "supplier", page: "Suppliers", record: f.suppliers[f.http.teamA]!, recordVersion: "1", name: "disabled.txt",
    }), { cookie: f.cookie, origin: f.http.origin, "content-type": "text/plain",
      "x-sf-team-profile": f.http.selector(f.http.profile(f.http.disabledTeam)) },
    { method: "POST", body: new TextEncoder().encode("G06 disabled Team\n") })
    expect(disabled.status).toBe(403)
    await disabled.body?.cancel()
    attempts.push({ kind: "disabled-team", httpStatus: disabled.status, durable: unchanged(f.http, disabledBefore) })
    const revokedBefore = f.http.durable()
    f.http.state.teams = [f.http.teamB, f.http.disabledTeam]
    const revoked = await upload(f, f.http.teamA, "revoked.txt", new TextEncoder().encode("G06 revoked Team\n"))
    expect(revoked.status).toBe(403)
    await revoked.body?.cancel()
    attempts.push({ kind: "revoked-membership", httpStatus: revoked.status, durable: unchanged(f.http, revokedBefore) })
    f.http.state.teams = [f.http.teamA, f.http.teamB, f.http.disabledTeam]
    return { attempts, mainCleanAfter: await healthyMain() }
  })
}, 120_000)

test("Microsoft Team private upload fails closed against the stopped owned real ClamD", async () => {
  await control("scanner-outage", "error", async (f) => {
    // The original real-clamd case verified and stopped this exact owned daemon.
    // This test never kills a process or substitutes an arbitrary unused port.
    await refused(f.scanner)
    const attempts = []
    for (const team of [f.http.teamA, f.http.teamB])
      attempts.push({ teamObjectId: team, ...await deniedUpload(f, team, new TextEncoder().encode("G06 clean refused during outage\n")) })
    return { connectionRefused: true, attempts, mainCleanAfter: await healthyMain() }
  })
}, 120_000)

async function ownedScanner(kind: "main" | "error") {
  const evidence = process.env.SF_OPERATIONS_SCANNER_EVIDENCE
  const temporary = process.env.RUNNER_TEMP
  if (!evidence || !temporary) throw new Error("G06_TEAMS_REQUIRES_OWNED_REAL_CLAMD")
  const receipt = object(JSON.parse(await readFile(join(evidence, "service.json"), "utf8")))
  expect(receipt.github_sha).toBe(process.env.GITHUB_SHA)
  expect(receipt.run_id).toBe(process.env.GITHUB_RUN_ID)
  expect(receipt.run_attempt).toBe(process.env.GITHUB_RUN_ATTEMPT)
  const directory = await realpath(text(receipt.work_directory))
  expect(directory.startsWith(await realpath(temporary) + sep)).toBe(true)
  expect(await realpath(evidence)).toBe(join(directory, "evidence"))
  const value = object(receipt[kind])
  const configured = process.env[kind === "main" ? "SF_OPERATIONS_CLAMD_PORT" : "SF_OPERATIONS_CLAMD_ERROR_PORT"]
  if (!configured || !/^\d+$/.test(configured)) throw new Error("G06_TEAMS_SCANNER_PORT_MISSING")
  const port = Number(configured)
  expect(Number.isInteger(port) && port > 0 && port < 65536).toBe(true)
  expect(value.host).toBe("127.0.0.1")
  expect(value.port).toBe(port)
  expect(typeof value.pid === "number" && Number.isInteger(value.pid) && value.pid > 1).toBe(true)
  expect(object(receipt.main).pid).not.toBe(object(receipt.error).pid)
  expect(object(receipt.main).port).not.toBe(object(receipt.error).port)
  return { host: "127.0.0.1" as const, port, pid: Number(value.pid) }
}

async function healthyMain() {
  expect(await scanLocalFile(new TextEncoder().encode("G06 main daemon remains clean\n"), await ownedScanner("main"))).toBe(true)
  return true
}

function eicar() {
  const bytes = Buffer.from("WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=", "base64")
  expect(bytes.length).toBe(68)
  expect(createHash("md5").update(bytes).digest("hex")).toBe("44d88612fea8a8f36de82e1278abb02f")
  return bytes
}

async function fixture(scanner: Awaited<ReturnType<typeof ownedScanner>>) {
  const http = await microsoftHttpFixture({ label: "g06", scanner: { host: scanner.host, port: scanner.port } })
  try {
    const cookie = await http.login()
    const suppliers: Record<string, string> = {}
    const command = async (team: string, value: unknown) => {
      const response = await http.request("/teams/" + team + "/procurement", {
        cookie, origin: http.origin, "content-type": "application/json", "x-sf-team-profile": http.selector(http.profile(team)),
      }, { method: "POST", body: JSON.stringify(value) })
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ ok: true })
    }
    for (const team of [http.teamA, http.teamB]) {
      await command(team, { page: "Settings", action: "reset", version: 0, values: {} })
      await command(team, { page: "Settings", action: "save", version: snapshot(http, team).versions.settings!.version,
        values: { uploadCap: 16 * 1024 * 1024 } })
      await command(team, { page: "Suppliers", action: "create", version: 0, values: {
        legalName: "G06 Microsoft Team " + team, country: "France", address: "Isolated component",
        taxId: randomUUID(), contactEmail: "scanner@example.invalid", paymentTerms: "Net 45", currency: "USD", riskRating: "Low",
      } })
      const created = rows(object(snapshot(http, team).data.store).suppliers)
      expect(created).toHaveLength(1)
      suppliers[team] = text(created[0]!.id)
      expect(suppliers[team]).not.toBe("")
    }
    return { http, cookie, suppliers, scanner }
  } catch (error) {
    await http.close()
    throw error
  }
}
type Fixture = Awaited<ReturnType<typeof fixture>>

function snapshot(http: MicrosoftFixture, team: string) {
  const row = http.durable([team])[0]?.snapshots.find((entry) => entry.surface === "procurement")
  if (!row) throw new Error("G06_TEAMS_PROCUREMENT_SNAPSHOT_MISSING")
  return decodeSnapshot(row.payload)
}

function version(f: Fixture, team: string) {
  const value = snapshot(f.http, team).versions["suppliers:" + f.suppliers[team]]?.version
  if (!Number.isSafeInteger(value) || value === undefined || value < 0) throw new Error("G06_TEAMS_SUPPLIER_VERSION_MISSING")
  return value
}

async function upload(f: Fixture, team: string, name: string, bytes: Uint8Array,
  owner = f.http.profile(team)) {
  return f.http.request("/teams/" + team + "/procurement?" + new URLSearchParams({
    page: "Suppliers", upload: "supplier", record: f.suppliers[team]!,
    recordVersion: String(version(f, team)), name,
  }), { cookie: f.cookie, origin: f.http.origin, "content-type": "text/plain",
    "x-sf-team-profile": f.http.selector(owner) }, { method: "POST", body: new Uint8Array(bytes) })
}

function unchanged(http: MicrosoftFixture, before: ReturnType<MicrosoftFixture["durable"]>) {
  const after = http.durable()
  expect(after).toEqual(before)
  return before.map((value, index) => ({
    teamObjectId: value.teamObjectId, before: digestSfValue(value), after: digestSfValue(after[index]),
  }))
}

async function acceptedUpload(f: Fixture, team: string, name: string, bytes: Uint8Array) {
  const other = team === f.http.teamA ? f.http.teamB : f.http.teamA
  const otherBefore = f.http.durable([other])
  const previousVersion = version(f, team)
  const response = await upload(f, team, name, bytes)
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ ok: true })
  expect(version(f, team)).toBe(previousVersion + 1)
  const assets = rows(snapshot(f.http, team).data.assets).filter((entry) => entry.name === name)
  expect(assets).toHaveLength(1)
  const asset = assets[0]!
  expect(asset).toMatchObject({ record: f.suppliers[team], kind: "supplier", bytes: bytes.byteLength })
  const stored = f.http.durable([team])[0]?.blobs.find((entry) => entry.surface === "procurement" && entry.key === text(asset.key))
  expect(stored).toBeDefined()
  if (!stored) throw new Error("G06_TEAMS_PRIVATE_BLOB_MISSING")
  expect(Buffer.from(stored.payload, "hex")).toEqual(Buffer.from(bytes))
  const link = await f.http.request("/teams/" + team + "/procurement?" + new URLSearchParams({ "asset-link": text(asset.id) }), { cookie: f.cookie })
  expect(link.status).toBe(200)
  const signed = object(await link.json())
  expect(signed.ok).toBe(true)
  expect(text(signed.query)).not.toBe("")
  const downloaded = await f.http.request("/teams/" + team + "/procurement?" + text(signed.query), { cookie: f.cookie })
  expect(downloaded.status).toBe(200)
  expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(Buffer.from(bytes))
  const foreign = await f.http.request("/teams/" + other + "/procurement?" + text(signed.query), { cookie: f.cookie })
  expect(foreign.status).toBe(403)
  await foreign.body?.cancel()
  const otherAfter = f.http.durable([other])
  expect(otherAfter).toEqual(otherBefore)
  return { httpStatus: response.status, bytes: bytes.byteLength, digest: digest(bytes),
    storedDigest: digest(Buffer.from(stored.payload, "hex")), versionBefore: previousVersion, versionAfter: version(f, team),
    downloadStatus: downloaded.status, foreignDownloadStatus: foreign.status,
    otherTeam: { teamObjectId: other, before: digestSfValue(otherBefore[0]), after: digestSfValue(otherAfter[0]) } }
}

async function deniedUpload(f: Fixture, team: string, bytes: Uint8Array) {
  const before = f.http.durable()
  const response = await upload(f, team, "scanner-refused.txt", bytes)
  expect(response.status).toBe(422)
  expect(await response.json()).toEqual({ ok: false, errors: ["The scanner did not accept this file."] })
  return { httpStatus: response.status, bytes: bytes.byteLength, digest: digest(bytes), durable: unchanged(f.http, before) }
}

async function control(id: "private-upload" | "denied-owner" | "scanner-outage", kind: "main" | "error",
  work: (f: Fixture) => Promise<unknown>) {
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
  console.info("G06_MICROSOFT_TEAM_" + id.toUpperCase().replaceAll("-", "_") + " " + JSON.stringify({
    schema: "orchestra.g06.microsoft-team-control/1", control: id, status: "PASS",
    sourceSha: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    proofClass: "COMPONENT_REAL_CLAMD", composition: "MICROSOFT_TEAM_FACTORY",
    identityProvider: "CONTROLLED_ENTRA_GRAPH", runtimeFactory: "createMicrosoftInstallation",
    installedTeamsProof: false, finalCandidate: false, scanner,
    binding: { installationId: f.http.installationId, tenantId: f.http.tenantId,
      principalObjectId: f.http.principalId, teamObjectIds: [f.http.teamA, f.http.teamB] },
    transport: f.http.transport(), graphRequests: f.http.state.graphCalls,
    cleanup: { completed: true, directoryRemoved: true }, result,
  }))
}

async function refused(endpoint: { host: "127.0.0.1"; port: number }) {
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection(endpoint)
    const deadline = setTimeout(() => { socket.destroy(); reject(new Error("G06_TEAMS_OUTAGE_DEADLINE")) }, 5000)
    socket.once("connect", () => { clearTimeout(deadline); socket.destroy(); reject(new Error("G06_TEAMS_OWNED_DAEMON_STILL_RUNNING")) })
    socket.once("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(deadline)
      socket.destroy()
      if (error.code === "ECONNREFUSED") resolve()
      else reject(error)
    })
  })
}
