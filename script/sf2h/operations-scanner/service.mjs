import { createHash } from "node:crypto"
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs"
import { createConnection } from "node:net"
import { userInfo } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { readTeamsScannerAdmission } from "../../sf-ci/team-profile-scanner.mjs"

const [action, directory, detail] = process.argv.slice(2)
const root = realpathSync(directory)
const temporary = realpathSync(process.env.RUNNER_TEMP)
const teams = process.env.GITHUB_REF_NAME?.startsWith("tp-scan-") ? readTeamsScannerAdmission() : undefined
const rootPattern = teams ? new RegExp("^sf-teams-profile-scan-" + process.env.GITHUB_RUN_ID + "-" + process.env.GITHUB_RUN_ATTEMPT + "\\.[A-Za-z0-9]+$")
  : /^sf-operations(?:63|75)-\d+-\d+\.[A-Za-z0-9]+$/
if (path.dirname(root) !== temporary || !rootPattern.test(path.basename(root)))
  throw new Error("OPERATIONS_SCANNER_STATE_OUTSIDE_JOB")
const lock = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "tools.lock.json"), "utf8"))
const evidence = path.join(root, "evidence")
const save = (name, value) => writeFileSync(path.join(evidence, name), JSON.stringify(value, null, 2) + "\n")
const read = (name) => JSON.parse(readFileSync(path.join(evidence, name), "utf8"))
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const executable = path.join(root, "root/usr/local/sbin/clamd")
const configuration = (kind) => path.join(root, `clamd-${kind}.conf`)

async function hash(filename) {
  const digest = createHash("sha256")
  for await (const chunk of createReadStream(filename)) digest.update(chunk)
  return digest.digest("hex")
}

function observation(pid) {
  try {
    const status = readFileSync(`/proc/${pid}/stat`, "utf8")
    if (status.slice(status.lastIndexOf(")") + 2).startsWith("Z ")) return undefined
    return {
      pid,
      executable: readlinkSync(`/proc/${pid}/exe`),
      startTime: status.slice(status.lastIndexOf(")") + 2).split(" ")[19],
      arguments: readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").filter(Boolean),
    }
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ESRCH") return undefined
    throw error
  }
}

function ownedPort(kind, current) {
  const address = `0100007F:${lock.services[kind].port.toString(16).toUpperCase().padStart(4, "0")}`
  const listener = readFileSync("/proc/net/tcp", "utf8").trim().split("\n").slice(1)
    .map((line) => line.trim().split(/\s+/)).find((fields) => fields[1] === address && fields[3] === "0A")
  if (!listener) return undefined
  const inode = listener[9]
  const descriptors = readdirSync(`/proc/${current.pid}/fd`)
  for (const descriptor of descriptors) {
    try {
      if (readlinkSync(`/proc/${current.pid}/fd/${descriptor}`) === `socket:[${inode}]`) return inode
    } catch (error) {
      if (error.code !== "ENOENT") throw error
    }
  }
  throw new Error(`OPERATIONS_SCANNER_PORT_NOT_OWNED:${kind}`)
}

function ownedProcess(kind) {
  const pidFile = path.join(root, "pids", `${kind}.pid`)
  if (!existsSync(pidFile)) return undefined
  const pid = Number(readFileSync(pidFile, "utf8").trim())
  if (!Number.isSafeInteger(pid) || pid < 2) throw new Error("OPERATIONS_SCANNER_PID_INVALID")
  const current = observation(pid)
  if (!current) return undefined
  const receiptFile = path.join(evidence, `process-${kind}.json`)
  const receipt = existsSync(receiptFile) ? JSON.parse(readFileSync(receiptFile, "utf8")) : undefined
  if (current.executable !== executable || !current.arguments.includes(`--config-file=${configuration(kind)}`) ||
      (receipt && receipt.startTime !== current.startTime))
    throw new Error(`OPERATIONS_SCANNER_PROCESS_OWNERSHIP_MISMATCH:${kind}`)
  return current
}

async function exchange(port, command, bytes, declaredLength) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port })
    const chunks = []
    const state = { done: false }
    const finish = (error, value) => {
      if (state.done) return
      state.done = true
      clearTimeout(timer)
      socket.destroy()
      if (error) reject(error)
      else resolve(value)
    }
    const timer = setTimeout(() => finish(new Error("CLAMD_CONTROL_TIMEOUT")), 5000)
    socket.on("error", (error) => finish(error))
    socket.on("close", () => finish(new Error("CLAMD_CONTROL_CLOSED_WITHOUT_COMPLETE_FRAME")))
    socket.on("data", (chunk) => {
      chunks.push(chunk)
      const response = Buffer.concat(chunks)
      if (response.length > 4096) return finish(new Error("CLAMD_CONTROL_RESPONSE_TOO_LARGE"))
    })
    // One command outside IDSESSION has one complete record followed by EOF.
    // Do not accept an early clean prefix if the daemon later reports another record or closes abnormally.
    socket.on("end", () => {
      const response = Buffer.concat(chunks)
      const end = response.indexOf(0)
      if (end < 0 || end !== response.length - 1) return finish(new Error("CLAMD_CONTROL_INVALID_RECORD"))
      finish(undefined, response.subarray(0, end).toString("utf8"))
    })
    socket.on("connect", () => {
      socket.write(Buffer.from(`z${command}\0`))
      if (bytes === undefined && declaredLength === undefined) return
      const header = Buffer.alloc(4)
      header.writeUInt32BE(declaredLength ?? bytes.length)
      socket.write(header)
      // ClamD rejects an oversized length before reading its body. Do not leave
      // unread data behind on this diagnostic socket and turn its error frame into a TCP reset.
      if (bytes === undefined) return
      socket.write(bytes)
      socket.write(Buffer.alloc(4))
    })
  })
}

if (action === "initialize") {
  mkdirSync(evidence, { recursive: true })
  save("tools.lock.json", lock)
  save("setup.json", {
    schema: teams ? "teams-profile-scanner-setup-v1" : "sf2h.operations63.scanner-setup.v1", status: "STARTING", root,
    ...(teams ? { teamsProfile: teams.envelope } : {}),
    productSnapshot: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT, branch: process.env.GITHUB_REF_NAME,
    startedAt: new Date().toISOString(), syntheticDatabase: false, productQualification: "NOT_RUN",
  })
} else if (action === "package") {
  const filename = path.join(root, "clamav.deb")
  const actual = { bytes: statSync(filename).size, sha256: await hash(filename) }
  save("package.json", { source: lock.asset.url, expected: lock.asset, actual })
  if (actual.bytes !== lock.asset.size || actual.sha256 !== lock.asset.sha256)
    throw new Error("OPERATIONS_SCANNER_PACKAGE_IDENTITY_MISMATCH")
} else if (action === "configuration") {
  for (const tool of ["clamd", "freshclam"]) {
    const version = readFileSync(path.join(evidence, `${tool}-version.txt`), "utf8").trim()
    if (!version.startsWith(`ClamAV ${lock.version}/`) && version !== `ClamAV ${lock.version}`)
      throw new Error(`OPERATIONS_SCANNER_VERSION_MISMATCH:${tool}`)
  }
  const certs = path.join(root, "root/usr/local/etc/certs")
  const account = userInfo().username
  if (!/^[A-Za-z0-9_-]+$/.test(account)) throw new Error("OPERATIONS_SCANNER_ACCOUNT_INVALID")
  writeFileSync(path.join(root, "freshclam.conf"), [
    `DatabaseDirectory ${root}/database`, `CVDCertsDirectory ${certs}`,
    `DatabaseOwner ${account}`, "DatabaseMirror database.clamav.net",
    "DNSDatabaseInfo current.cvd.clamav.net", "MaxAttempts 1", "ConnectTimeout 20",
    "ReceiveTimeout 60", "TestDatabases yes", "LogTime yes",
    `UpdateLogFile ${evidence}/freshclam.log`, "Foreground yes", "",
  ].join("\n"))
  for (const kind of ["main", "error"]) {
    writeFileSync(configuration(kind), [
      `DatabaseDirectory ${root}/database`, `CVDCertsDirectory ${certs}`,
      "OfficialDatabaseOnly yes", "TCPAddr 127.0.0.1", `TCPSocket ${lock.services[kind].port}`,
      `StreamMaxLength ${lock.services[kind].stream_max_length}`, "MaxScanSize 33554432",
      "MaxFileSize 16777216", "AlertExceedsMax yes", "MaxThreads 2", "MaxQueue 4",
      "ReadTimeout 30", "CommandReadTimeout 10", "SelfCheck 0", "ConcurrentDatabaseReload no",
      "ExitOnOOM yes", "Foreground yes", `PidFile ${root}/pids/${kind}-daemon.pid`,
      `TemporaryDirectory ${root}/tmp`, `LogFile ${evidence}/clamd-${kind}.log`,
      "LogFileMaxSize 2M", "LogTime yes", "LogClean yes", "",
    ].join("\n"))
    writeFileSync(path.join(evidence, `clamd-${kind}.conf.txt`), readFileSync(configuration(kind)))
  }
  writeFileSync(path.join(evidence, "freshclam.conf.txt"), readFileSync(path.join(root, "freshclam.conf")))
  save("configuration.json", {
    services: lock.services,
    files: await Promise.all(["freshclam.conf", "clamd-main.conf", "clamd-error.conf"].map(async (name) => ({
      path: name, sha256: await hash(path.join(root, name)),
    }))),
    processScopedLibraryPath: ["root/usr/local/lib", "root/usr/local/lib64"],
    credentialsUsed: false, globalInstallation: false,
  })
} else if (action === "databases") {
  const database = path.join(root, "database")
  const files = readdirSync(database).filter((name) => /^(main|daily|bytecode)\.(cvd|cld)$/.test(name))
  for (const name of lock.database.required) {
    if (files.filter((file) => file.startsWith(name + ".")).length !== 1)
      throw new Error(`OPERATIONS_SCANNER_OFFICIAL_DATABASE_MISSING:${name}`)
  }
  save("databases.json", {
    origin: lock.database.mirror, freshclamCompleted: true, testDatabasesEnabled: true,
    officialDatabaseOnly: true, syntheticDatabase: false,
    files: await Promise.all(files.map(async (name) => ({ name, bytes: statSync(path.join(database, name)).size,
      sha256: await hash(path.join(database, name)) }))),
  })
} else if (action === "process") {
  if (!["main", "error"].includes(detail)) throw new Error("OPERATIONS_SCANNER_KIND_INVALID")
  // An exec can still be settling immediately after the shell records $!.
  await pause(100)
  const current = ownedProcess(detail)
  if (!current) throw new Error(`OPERATIONS_SCANNER_PROCESS_EXITED:${detail}`)
  save(`process-${detail}.json`, current)
} else if (action === "ready") {
  const deadline = Date.now() + lock.bounds_seconds.readiness * 1000
  const ready = new Map()
  while (Date.now() < deadline && ready.size < 2) {
    for (const kind of ["main", "error"]) {
      const current = ownedProcess(kind)
      if (!current) throw new Error(`OPERATIONS_SCANNER_PROCESS_EXITED:${kind}`)
      if (ready.has(kind)) continue
      const inode = ownedPort(kind, current)
      if (!inode) continue
      const port = lock.services[kind].port
      const result = await exchange(port, "PING").catch(() => undefined)
      if (result !== "PONG") continue
      const version = await exchange(port, "VERSION")
      if (!version.startsWith(`ClamAV ${lock.version}/`)) throw new Error(`OPERATIONS_SCANNER_WIRE_VERSION_MISMATCH:${kind}`)
      ready.set(kind, { port, ping: result, version, listen_inode: inode })
    }
    if (ready.size < 2) await pause(1000)
  }
  if (ready.size !== 2) throw new Error("OPERATIONS_SCANNER_READINESS_EXPIRED")
  const clean = Buffer.from("Operations63 real daemon control\n")
  const eicar = Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*")
  const controls = []
  for (const kind of ["main", "error"]) {
    const port = lock.services[kind].port
    const accepted = await exchange(port, "INSTREAM", clean)
    const rejected = await exchange(port, "INSTREAM", eicar)
    const after = await exchange(port, "INSTREAM", clean)
    controls.push({ kind, clean: accepted, eicar: rejected, cleanAfter: after })
    save("daemon-controls.json", { scope: "Direct ClamD provisioning controls, not the product adapter or browser journeys", controls })
    if (accepted !== "stream: OK" || !/EICAR.*FOUND$/i.test(rejected) || after !== "stream: OK")
      throw new Error(`OPERATIONS_SCANNER_DISCRIMINATING_CONTROL_FAILED:${kind}`)
  }
  const sizeError = await exchange(lock.services.error.port, "INSTREAM", undefined, 2048)
  if (!/INSTREAM size limit exceeded.*ERROR/i.test(sizeError)) throw new Error("OPERATIONS_SCANNER_SIZE_ERROR_NOT_OBSERVED")
  save("daemon-controls.json", { scope: "Direct ClamD provisioning controls, not the product adapter or browser journeys", controls, sizeError })
  save("service.json", {
    run_id: process.env.GITHUB_RUN_ID, run_attempt: process.env.GITHUB_RUN_ATTEMPT,
    github_sha: process.env.GITHUB_SHA, work_directory: root,
    ...Object.fromEntries(["main", "error"].map((kind) => {
      const current = ownedProcess(kind)
      if (!current) throw new Error(`OPERATIONS_SCANNER_PROCESS_EXITED:${kind}`)
      return [kind, { pid: current.pid, port: lock.services[kind].port, host: "127.0.0.1",
        executable: current.executable, config: configuration(kind), start_time: current.startTime,
        listen_inode: ownedPort(kind, current) }]
    })),
  })
  save("setup.json", { ...read("setup.json"), status: "READY", completedAt: new Date().toISOString(),
    services: Object.fromEntries(ready), controls: "PASS_DAEMON_ONLY", productQualification: "NOT_RUN" })
} else if (action === "fail") {
  save("setup.json", { ...read("setup.json"), status: "FAILED", exitCode: Number(detail), failedAt: new Date().toISOString(),
    productQualification: "BLOCKED_SETUP" })
} else if (action === "cleanup") {
  const results = []
  for (const kind of ["main", "error"]) {
    const current = ownedProcess(kind)
    if (!current) { results.push({ kind, status: "ABSENT" }); continue }
    process.kill(current.pid, "SIGTERM")
    const deadline = Date.now() + lock.bounds_seconds.cleanup * 1000
    while (Date.now() < deadline && ownedProcess(kind)) await pause(100)
    if (ownedProcess(kind)) {
      process.kill(current.pid, "SIGKILL")
      await pause(100)
    }
    if (ownedProcess(kind)) throw new Error(`OPERATIONS_SCANNER_CLEANUP_FAILED:${kind}`)
    results.push({ kind, pid: current.pid, startTime: current.startTime, status: "STOPPED" })
  }
  save("cleanup.json", { at: new Date().toISOString(), results, state: "STOPPED", evidencePreserved: true })
  for (const name of ["root", "database", "tmp", "clamav.deb"]) rmSync(path.join(root, name), { recursive: true, force: true })
} else {
  throw new Error("OPERATIONS_SCANNER_ACTION_INVALID")
}
