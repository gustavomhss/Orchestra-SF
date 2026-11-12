import path from "node:path"

export function servicePlan(input: {
  directory: string
  moduleDirectory: string
  orchestraCheckout: string
  uid: number
  installationId: string
  bunPath: string
}): { label: string; file: string; xml: string; kind: "scanner" | "updater" | "server" }[] {
  for (const file of [input.directory, input.moduleDirectory, input.orchestraCheckout, input.bunPath]) requireAbsolute(file)
  if (!Number.isSafeInteger(input.uid) || input.uid < 0) throw new Error("Nonnegative integer owner UID required")
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(input.installationId)) throw new Error("Canonical installation UUID required")
  return (["scanner", "updater", "server"] as const).map((kind) => {
    const label = `local.sucafina.${input.installationId}.${kind}`
    const args = kind === "scanner"
      ? [`${input.directory}/tools/clamav/sbin/clamd`, "--foreground=yes", `--config-file=${input.directory}/clamd.conf`]
      : kind === "updater"
        ? [`${input.directory}/tools/clamav/bin/freshclam`, "--daemon", "--foreground=yes", `--config-file=${input.directory}/freshclam.conf`]
        : [`${input.moduleDirectory}/local/start.command`, input.orchestraCheckout, input.directory]
    return {
      label, kind, file: `${input.directory}/launch-agents/${label}.plist`,
      xml: `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>
<key>Label</key><string>${escapeXml(label)}</string>
<key>ProgramArguments</key><array>${args.map((arg) => `<string>${escapeXml(arg)}</string>`).join("")}</array>
<key>WorkingDirectory</key><string>${escapeXml(input.directory)}</string>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>${escapeXml(`${input.directory}/service-logs/${kind}.out.log`)}</string>
<key>StandardErrorPath</key><string>${escapeXml(`${input.directory}/service-logs/${kind}.err.log`)}</string>
<key>EnvironmentVariables</key><dict>
<key>PATH</key><string>${escapeXml(`${path.dirname(input.bunPath)}:/usr/bin:/bin:/usr/sbin:/sbin`)}</string>
<key>ORCHESTRA_INHERIT_CREDENTIALS</key><string>0</string>
</dict></dict></plist>\n`,
    }
  })
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;")
}
function requireAbsolute(file: string) {
  if (!path.isAbsolute(file) || path.normalize(file) !== file || /[\x00-\x1f\x7f]/.test(file)) throw new Error("Canonical absolute path without control characters required")
}

// CLI is deliberately outside the pure generator. Imports never read installation state.
async function command() {
  const { lstat, realpath, mkdir, open } = await import("node:fs/promises")
  const { constants } = await import("node:fs")
  const { userInfo } = await import("node:os")
  const { connect } = await import("node:net")
  const owner = userInfo()
  const args = process.argv.slice(2)
  const mode = args[0]
  if (!["--prepare", "--activate", "--ensure"].includes(mode ?? "") || args.length !== (mode === "--ensure" ? 2 : 3)) throw new Error("Usage: --prepare|--activate /absolute/product-checkout /absolute/private-directory; --ensure /absolute/private/installation.json")
  const directory = mode === "--ensure" ? path.dirname(args[1]) : args[2]
  requireAbsolute(directory)
  if (mode === "--ensure" && args[1] !== path.join(directory, "installation.json")) throw new Error("Explicit installation.json required")
  const moduleDirectory = path.dirname(import.meta.dir)
  const metadataFile = path.join(directory, "service-installation.json")

  async function checked(file: string, kind: "directory" | "file", privatePath = false) {
    requireAbsolute(file)
    const stat = await lstat(file)
    if (stat.isSymbolicLink() || await realpath(file) !== file || (kind === "directory" ? !stat.isDirectory() : !stat.isFile())) throw new Error(`No symlinks; canonical ${kind} required: ${file}`)
    if (privatePath && (stat.uid !== owner.uid || (stat.mode & 0o777) !== (kind === "directory" ? 0o700 : 0o600) || stat.nlink !== (kind === "file" ? 1 : stat.nlink))) throw new Error(`Owner ${owner.uid} and private permissions required: ${file}`)
    return stat
  }
  async function privateDirectory(file: string) {
    await mkdir(file, { mode: 0o700 }).catch((error: unknown) => { if (!isExists(error)) throw error })
    await checked(file, "directory", true)
  }
  async function writeExclusive(file: string, content: string) {
    const handle = await open(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600).catch(async (error: unknown) => {
      if (!isExists(error)) throw error
      await checked(file, "file", true)
      if (await Bun.file(file).text() !== content) throw new Error(`Refusing replacement of existing file: ${file}`)
      return undefined
    })
    if (handle) await handle.writeFile(content).finally(() => handle.close())
    await checked(file, "file", true)
  }
  async function listen(host: "127.0.0.1" | "::1", port: number) {
    return new Promise<boolean>((resolve) => {
      const socket = connect({ host, port })
      socket.setTimeout(750)
      socket.once("connect", () => { socket.destroy(); resolve(true) })
      socket.once("error", () => { socket.destroy(); resolve(false) })
      socket.once("timeout", () => { socket.destroy(); resolve(false) })
    })
  }
  const cleanEnvironment = { PATH: "/usr/bin:/bin:/usr/sbin:/sbin", HOME: owner.homedir }
  function launchctl(...arguments_: string[]) {
    return Bun.spawnSync(["/bin/launchctl", ...arguments_], { env: cleanEnvironment, timeout: 5000 })
  }
  await checked(directory, "directory", true)
  await checked(path.join(directory, "installation.json"), "file", true)
  const config = await Bun.file(path.join(directory, "installation.json")).json() as {
    authentication?: string; localOperator?: { uid: number; installationId: string }
    scanner?: { host: string; port: number }; origin?: string; mount?: string
  }
  if (config.localOperator?.uid !== owner.uid || config.authentication !== "local-operator") throw new Error("Actual-owner local-operator installation required")
  if (config.scanner?.port === 4110) throw new Error("Scanner port 4110 conflicts with the server HTTP listener; choose a distinct scanner port before preparation or activation")
  const orchestraCheckout = mode === "--ensure" ? undefined : args[1]
  if (orchestraCheckout) await checked(orchestraCheckout, "directory")
  const previous = await lstat(metadataFile).catch((error: unknown) => { if (!isMissing(error)) throw error; return undefined })
  if (previous) await checked(metadataFile, "file", true)
  const metadata = previous ? await Bun.file(metadataFile).json() as {
    orchestraCheckout?: string; bunPath?: string
  } : undefined
  if (mode !== "--prepare" && !metadata) throw new Error("No reviewed service metadata; run install-startup.command --prepare first")
  const input = {
    directory, moduleDirectory, orchestraCheckout: orchestraCheckout ?? metadata?.orchestraCheckout ?? "",
    uid: owner.uid, installationId: config.localOperator.installationId,
    bunPath: metadata?.bunPath ?? await realpath(process.execPath),
  }
  const plans = servicePlan(input)
  const launchDirectory = path.join(owner.homedir, "Library", "LaunchAgents")
  const record = {
    version: 1, ...input,
    services: plans.map((plan) => ({ label: plan.label, kind: plan.kind, file: plan.file, target: path.join(launchDirectory, `${plan.label}.plist`) })),
  }
  const serialized = `${JSON.stringify(record, null, 2)}\n`
  if (metadata && await Bun.file(metadataFile).text() !== serialized) throw new Error("Service metadata does not match exact installation, owner, checkout or plan; refusing takeover")
  await checked(input.orchestraCheckout, "directory")
  await checked(moduleDirectory, "directory")
  await checked(input.bunPath, "file")
  await checked(path.join(moduleDirectory, "local/start.command"), "file")
  if (mode === "--prepare") {
    await privateDirectory(path.join(directory, "launch-agents"))
    await privateDirectory(path.join(directory, "service-logs"))
    for (const plan of plans) {
      for (const suffix of ["out", "err"]) {
        const log = path.join(directory, "service-logs", `${plan.kind}.${suffix}.log`)
        if (await Bun.file(log).exists()) await checked(log, "file", true)
        else await writeExclusive(log, "")
      }
      await writeExclusive(plan.file, plan.xml)
    }
    await writeExclusive(metadataFile, serialized)
    console.log(`Prepared three private plists and ${metadataFile}. No services changed. Review before --activate; lead must adopt existing foreground services first.`)
    return
  }
  if (process.platform !== "darwin") throw new Error("Service activation/ensure requires macOS; preparation is portable")
  // Validate launch inputs before any login-directory write or service action.
  for (const configName of ["clamd.conf", "freshclam.conf"]) await checked(path.join(directory, configName), "file", true)
  for (const binary of ["tools/clamav/sbin/clamd", "tools/clamav/bin/freshclam"]) {
    const stat = await checked(path.join(directory, binary), "file")
    if (stat.uid !== owner.uid || (stat.mode & 0o022) !== 0 || (stat.mode & 0o100) === 0) throw new Error(`Owned executable without foreign write access required: ${binary}`)
  }
  await checked(path.join(directory, "launch-agents"), "directory", true)
  await checked(path.join(directory, "service-logs"), "directory", true)
  for (const plan of plans) {
    await checked(plan.file, "file", true)
    if (await Bun.file(plan.file).text() !== plan.xml) throw new Error(`Reviewed plist changed: ${plan.file}`)
    for (const suffix of ["out", "err"]) await checked(path.join(directory, "service-logs", `${plan.kind}.${suffix}.log`), "file", true)
  }
  await checked(owner.homedir, "directory")
  const library = path.join(owner.homedir, "Library")
  if ((await checked(library, "directory")).uid !== owner.uid) throw new Error("Foreign owner Library")
  if (mode === "--activate") await mkdir(launchDirectory, { mode: 0o700 }).catch((error: unknown) => { if (!isExists(error)) throw error })
  const targetStat = await checked(launchDirectory, "directory")
  if (targetStat.uid !== owner.uid || (targetStat.mode & 0o022) !== 0) throw new Error("Owner-controlled LaunchAgents directory required")
  // Check every target before writing any. Existing foreign or altered content is never replaced.
  for (const service of record.services) {
    const existing = await lstat(service.target).catch((error: unknown) => { if (!isMissing(error)) throw error; return undefined })
    if (existing) {
      await checked(service.target, "file", true)
      if (await Bun.file(service.target).text() !== plans.find((plan) => plan.label === service.label)!.xml) throw new Error(`Foreign or altered LaunchAgent: ${service.target}`)
    } else if (mode === "--ensure") throw new Error(`Not installed: ${service.label}; lead must activate the reviewed plan`)
  }
  if (!config.scanner || config.scanner.host !== "127.0.0.1" || !Number.isInteger(config.scanner.port) || config.scanner.port < 1 || config.scanner.port > 65535) throw new Error("Configured loopback scanner required")
  if (config.origin !== "http://localhost:4110" || !/^\/[A-Za-z0-9_-]+$/.test(config.mount ?? "")) throw new Error("Fixed local origin and safe mount required")
  const states = plans.map((plan) => ({ plan, result: launchctl("print", `gui/${owner.uid}/${plan.label}`) }))
  for (const state of states) {
    if (state.result.exitCode !== 0) continue
    const loadedPath = state.result.stdout.toString().match(/^\s*path = (.+)$/m)?.[1]?.trim()
    if (loadedPath !== path.join(launchDirectory, `${state.plan.label}.plist`)) throw new Error(`Loaded label has an unrecognized source: ${state.plan.label}; lead must verify adoption`)
  }
  for (const state of states) {
    if (state.result.exitCode === 0 && /\bpid = \d+/.test(state.result.stdout.toString())) continue
    const port = state.plan.kind === "server" ? 4110 : state.plan.kind === "scanner" ? config.scanner.port : undefined
    // A localhost HTTP listener may bind either address family. Check both before
    // bootstrap/kickstart; scanner health and occupancy remain IPv4-only.
    const occupied = port === undefined ? false : (await Promise.all(
      (state.plan.kind === "server" ? ["127.0.0.1", "::1"] as const : ["127.0.0.1"] as const)
        .map((host) => listen(host, port)),
    )).some(Boolean)
    if (occupied) throw new Error(`Port ${port} already has a listener outside the running own service; lead must verify/adopt it. No process was killed.`)
    if (mode === "--ensure" && state.result.exitCode !== 0) throw new Error(`Own label not loaded: ${state.plan.label}; lead must activate it`)
  }
  if (mode === "--activate") {
    // Updater has no listening port: require lead to confirm foreground adoption before activation.
    if (process.env.SUCAFINA_LEAD_ADOPTION_VERIFIED !== input.installationId) throw new Error("Lead must verify no foreground updater/scanner/server remains, then set SUCAFINA_LEAD_ADOPTION_VERIFIED to this installation UUID")
    for (const plan of plans) await writeExclusive(path.join(launchDirectory, `${plan.label}.plist`), plan.xml)
  }
  for (const state of states) {
    if (state.result.exitCode === 0 && /\bpid = \d+/.test(state.result.stdout.toString())) continue
    const result = state.result.exitCode !== 0
      ? launchctl("bootstrap", `gui/${owner.uid}`, path.join(launchDirectory, `${state.plan.label}.plist`))
      : launchctl("kickstart", `gui/${owner.uid}/${state.plan.label}`)
    if (result.exitCode !== 0) throw new Error(`Failed starting ${state.plan.label}: ${result.stderr.toString().trim()}. Inspect private service-logs; no other service was stopped.`)
  }
  async function scannerReady() {
    return new Promise<boolean>((resolve) => {
      const socket = connect({ host: "127.0.0.1", port: config.scanner!.port })
      const chunks: Buffer[] = []
      const finish = (ready: boolean) => { socket.destroy(); resolve(ready) }
      socket.setTimeout(750)
      socket.once("connect", () => socket.write("zPING\0"))
      socket.on("data", (chunk) => {
        chunks.push(chunk)
        const data = Buffer.concat(chunks).toString()
        if (data.includes("\0") || data.length > 32) finish(data === "PONG\0")
      })
      socket.once("error", () => finish(false))
      socket.once("timeout", () => finish(false))
      socket.once("end", () => finish(false))
    })
  }
  // Cold signature loading can take roughly 30 seconds on this Mac.
  const readyDeadline = performance.now() + 60000
  while (performance.now() < readyDeadline) {
    const response = await fetch(`${config.origin}${config.mount}/status`, { signal: AbortSignal.timeout(1000), redirect: "error" }).catch(() => undefined)
    const status: unknown = response?.ok ? await response.json().catch(() => undefined) : undefined
    if (status && typeof status === "object" && "login" in status && status.login === "local-operator" && await scannerReady()) {
      console.log("Own services loaded; server HTTP and scanner PING ready")
      return
    }
    await Bun.sleep(500)
  }
  throw new Error(`Own services did not become ready within bounded checks. Inspect ${directory}/service-logs and launchctl print gui/${owner.uid}/<exact-own-label>; do not start another listener.`)
}
function isExists(error: unknown) { return error instanceof Error && "code" in error && error.code === "EEXIST" }
function isMissing(error: unknown) { return error instanceof Error && "code" in error && error.code === "ENOENT" }

if (import.meta.main) await command().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Local service operation failed")
  process.exitCode = 1
})
