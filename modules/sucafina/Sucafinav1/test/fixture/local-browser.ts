import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { BrowserContext, CDPSession } from "@playwright/test"
import { prepareLocalConfiguration } from "../../runtime/local-configuration.ts"
import { prepareOperatorAccess } from "../../local/enroll.ts"
import { createLocalInstallation } from "../../local/entry.ts"

/** Throwaway browser installation. The protocol scanner is a test fixture, never antivirus qualification. */
export async function localBrowser() {
  console.info("browser fixture: prepare")
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "sucafina-business-browser-"))
  const cleanup: (() => Promise<unknown> | void)[] = [() => rm(root, { recursive: true, force: true })]
  const closed = { value: false }
  const dispose = async () => {
    if (closed.value) return
    closed.value = true
    const failures: unknown[] = []
    for (const [index, close] of cleanup.reverse().entries()) {
      const deadline = { timer: undefined as ReturnType<typeof setTimeout> | undefined }
      console.info("browser fixture: cleanup", index)
      await Promise.race([
        Promise.resolve().then(close),
        new Promise((_, reject) => { deadline.timer = setTimeout(() => reject(new Error("Browser fixture cleanup exceeded 20s")), 20000) }),
      ]).catch((error) => { failures.push(error); console.error("browser fixture: cleanup error", index, error instanceof Error ? error.message : "unknown") })
      if (deadline.timer) clearTimeout(deadline.timer)
    }
    if (failures.length) throw new AggregateError(failures, "Browser fixture cleanup failed")
  }
  try {
    const scans = new WeakMap<object, Buffer>()
    const scanner = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: {
      data(socket, bytes) {
        const wire = Buffer.concat([scans.get(socket) ?? Buffer.alloc(0), Buffer.from(bytes)])
        if (wire.length > 16 * 1024 * 1024) { socket.end("stream: ERROR\0"); return }
        scans.set(socket, wire)
        if (wire.subarray(0, 6).toString() === "zPING\0") { socket.end("PONG\0"); return }
        if (wire.length < 10 || wire.subarray(0, 10).toString() !== "zINSTREAM\0") return
        const progress = { offset: 10 }
        while (progress.offset + 4 <= wire.length) {
          const size = wire.readUInt32BE(progress.offset)
          if (!size) { socket.end(wire.includes(Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")) ? "stream: Eicar-Signature FOUND\0" : "stream: OK\0"); return }
          if (progress.offset + 4 + size > wire.length) return
          progress.offset += 4 + size
        }
      },
      close(socket) { scans.delete(socket) },
    } })
    cleanup.push(() => scanner.stop(true))
    const configFile = await prepareLocalConfiguration(root)
    const access = await prepareOperatorAccess(configFile, true)
    const config = await Bun.file(configFile).json()
    config.localOperator.buyer = true
    config.scanner = { host: "127.0.0.1", port: scanner.port }
    await Bun.write(configFile, JSON.stringify(config))
    const environment = {
      ORCHESTRA_DB: path.join(root, "host-data", "orchestra.db"), ORCHESTRA_INHERIT_CREDENTIALS: "0",
      ORCHESTRA_CONFIG_DIR: path.join(root, "host-config"), ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(root, "host-credential.key"),
      TMPDIR: path.join(root, "host-tmp"), XDG_DATA_HOME: path.join(root, "host-data"), XDG_CONFIG_HOME: path.join(root, "host-config"),
      XDG_CACHE_HOME: path.join(root, "host-cache"), XDG_STATE_HOME: path.join(root, "host-state"),
    }
    console.info("browser fixture: installation")
    const installation = await createLocalInstallation({ origin: "http://localhost:4110" }, configFile, environment)
    cleanup.push(() => installation.dispose())
    const server = Bun.serve({ hostname: "localhost", port: 4110, fetch: async (request) => await installation.handler(request) ?? new Response(null, { status: 404 }) })
    const stopServer = () => server.stop(true)
    cleanup.push(stopServer)
    const { chromium } = await import("@playwright/test")
    console.info("browser fixture: direct pipe Chrome launch")
    const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] })
    const connection: { context?: BrowserContext; cdp?: CDPSession; owner?: NonNullable<Awaited<ReturnType<typeof linuxProcess>>> & { cmdline: string } } = {}
    cleanup.push(async () => {
      const outcomes: { operation: string; settled: boolean; error?: unknown }[] = []
      const bounded = async (operation: string, promise: Promise<unknown>, milliseconds: number) => {
        const outcome = { operation, settled: false, error: undefined as unknown }
        outcomes.push(outcome)
        const deadline = { timer: undefined as ReturnType<typeof setTimeout> | undefined }
        try {
          await Promise.race([
            promise.then(() => { outcome.settled = true }, (error: unknown) => { outcome.settled = true; outcome.error = error }),
            new Promise<void>((resolve) => {
              deadline.timer = setTimeout(resolve, milliseconds)
              deadline.timer.unref()
            }),
          ])
        } finally {
          if (deadline.timer) clearTimeout(deadline.timer)
        }
      }
      // Include extra contexts created by a business test, before closing the browser pipe.
      await Promise.all(browser.contexts().map((context, index) => bounded(`context.close:${index}`, context.close(), 750)))
      if (connection.cdp) await bounded("CDP Browser.close", connection.cdp.send("Browser.close"), 1000)
      await bounded("browser.close", browser.close(), 1500)
      const owner = connection.owner
      if (!owner) throw new Error("No authoritative Linux Chrome ownership capture; cleanup cannot be certified")
      const census = async () => {
        const members = (await Promise.all((await readdir("/proc")).filter((name) => /^\d+$/.test(name))
          .map((name) => linuxProcess(Number(name), owner.group)))).filter((entry): entry is NonNullable<typeof entry> => entry !== undefined)
        if (members.some((entry) => entry.uid !== owner.uid || entry.start < owner.start ||
          (entry.pid === owner.pid && entry.start !== owner.start)))
          throw new Error("Chrome group contains a foreign UID or generation")
        return members.filter((entry) => !["Z", "X"].includes(entry.state))
      }
      const waitForEnd = async (milliseconds: number) => {
        const end = Date.now() + milliseconds
        do {
          if (!(await census()).length && !browser.isConnected()) return true
          await new Promise<void>((resolve) => setTimeout(resolve, 50))
        } while (Date.now() < end)
        return false
      }
      const signal = async (kind: "SIGTERM" | "SIGKILL") => {
        const members = await census()
        if (!members.length) return
        const leader = await linuxProcess(owner.pid)
        if (!leader || leader.uid !== owner.uid || leader.start !== owner.start || leader.group !== owner.group ||
          await readFile(`/proc/${owner.pid}/cmdline`, "utf8") !== owner.cmdline)
          throw new Error("Chrome leader identity changed; refusing group signal")
        const verified = await linuxProcess(owner.pid)
        if (!verified || verified.uid !== owner.uid || verified.start !== owner.start || verified.group !== owner.group)
          throw new Error("Chrome leader generation changed before group signal")
        // Only the isolated group captured through this launch's public CDP session.
        try { process.kill(-owner.group, kind) }
        catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) throw error
        }
      }
      try {
        if (!await waitForEnd(1000)) {
          await signal("SIGTERM")
          if (!await waitForEnd(2000)) {
            await signal("SIGKILL")
            if (!await waitForEnd(7000)) throw new Error("Owned Chrome group remains live or transport remains connected")
          }
        }
        // Pending close promises are accepted only after both independent end-state proofs.
        if ((await census()).length || browser.isConnected()) throw new Error("Chrome OS/transport closure proof failed")
      } catch (error) {
        console.error("browser fixture: Chrome cleanup proof failed", {
          pid: owner.pid, pgid: owner.group, uid: owner.uid, starttime: owner.start.toString(),
          liveMembers: await census().then((members) => members.map((member) => ({ ...member, start: member.start.toString() })),
            (failure: unknown) => failure instanceof Error ? failure.message : "census failed"),
          connected: browser.isConnected(),
          closeRPCs: outcomes.map((outcome) => ({ operation: outcome.operation, settled: outcome.settled,
            error: outcome.error instanceof Error ? outcome.error.message : outcome.error === undefined ? undefined : "unknown error" })),
        })
        throw error
      }
      for (const outcome of outcomes) {
        if (outcome.error !== undefined && !(outcome.error instanceof Error && /Target.*closed|Session closed|Browser has been closed/i.test(outcome.error.message)))
          throw outcome.error
      }
      console.info("browser fixture: OS proof: isolated owned group has no live members; transport disconnected", {
        pid: owner.pid, pgid: owner.group, uid: owner.uid, starttime: owner.start.toString(),
        pendingCloseRPCs: outcomes.filter((outcome) => !outcome.settled).map((outcome) => outcome.operation),
      })
    })
    // Stop the application listener before browser cleanup, including capture failures.
    cleanup.splice(cleanup.indexOf(stopServer), 1)
    cleanup.push(stopServer)
    if (process.platform !== "linux") throw new Error("Authoritative Chrome process-group cleanup requires Linux /proc")
    const cdp = await browser.newBrowserCDPSession()
    connection.cdp = cdp
    const info: unknown = await cdp.send("SystemInfo.getProcessInfo")
    if (!info || typeof info !== "object" || !("processInfo" in info) || !Array.isArray(info.processInfo))
      throw new Error("Public CDP process information unavailable")
    const leaders = (info.processInfo as unknown[]).filter((entry): entry is { type: string; id: number } =>
      entry !== null && typeof entry === "object" && "type" in entry && entry.type === "browser" &&
      "id" in entry && typeof entry.id === "number" && Number.isSafeInteger(entry.id) && entry.id > 0)
    if (leaders.length !== 1) throw new Error("Public CDP did not identify exactly one Chrome browser process")
    const owner = await linuxProcess(leaders[0]!.id)
    if (!owner || owner.pid === process.pid || owner.group !== owner.pid || owner.uid !== process.getuid?.() || ["Z", "X"].includes(owner.state))
      throw new Error("Chrome process does not own a fresh isolated group with the current UID")
    const cmdline = await readFile(`/proc/${owner.pid}/cmdline`, "utf8")
    const confirmed = await linuxProcess(owner.pid)
    if (!cmdline || !confirmed || confirmed.start !== owner.start || confirmed.group !== owner.group || confirmed.uid !== owner.uid)
      throw new Error("Chrome ownership changed during capture")
    connection.owner = { ...owner, cmdline }
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
    connection.context = context
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    page.setDefaultNavigationTimeout(10000)
    const errors: string[] = []
    page.on("pageerror", (error) => { errors.push(error.message) })
    // Business tests navigate their own throwaway browser to the real enrollment endpoint.
    // operator-browser.test.ts separately covers the file-to-browser handoff.
    const handoff = (await Bun.file(access.artifact).text()).match(/location\.replace\(("[^"\r\n]*")\)/)?.[1]
    if (!handoff) throw new Error("Private test enrollment handoff is malformed")
    const destination = new URL(JSON.parse(handoff))
    if (destination.origin !== "http://localhost:4110" || destination.pathname !== "/sucafina/auth/local") throw new Error("Unexpected test enrollment destination")
    console.info("browser fixture: private enrollment navigation")
    const [enrollment] = await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).pathname === "/sucafina/auth/local", { timeout: 10000 }),
      page.goto(destination.href, { waitUntil: "domcontentloaded", timeout: 10000 }),
    ]).catch(() => { throw new Error("Private test browser enrollment failed") })
    if (enrollment.status() !== 303) throw new Error(`Test enrollment failed with status ${enrollment.status()}`)
    await page.waitForURL("http://localhost:4110/sucafina/dashboard", { timeout: 10000 })
    console.info("browser fixture: authenticated")
    await mkdir(path.join(import.meta.dir, "../artifacts"), { recursive: true })
    return { page, browser, root, configFile, actorId: `macos:${config.localOperator.installationId}:${config.localOperator.uid}`, installation, errors, stopServer, dispose }
  } catch (error) {
    await dispose()
    throw error
  }
}

// Linux stat fields after the final ')' start with state (field 3).
async function linuxProcess(pid: number, group?: number) {
  try {
    const source = await readFile(`/proc/${pid}/stat`, "utf8")
    const fields = source.slice(source.lastIndexOf(")") + 2).trim().split(/\s+/)
    if (!/^\d+$/.test(fields[2] ?? "") || !/^\d+$/.test(fields[19] ?? "") || !fields[0])
      throw new Error("Malformed Linux process identity")
    if (group !== undefined && Number(fields[2]) !== group) return undefined
    const metadata = await stat(`/proc/${pid}`)
    const confirmation = await readFile(`/proc/${pid}/stat`, "utf8")
    const current = confirmation.slice(confirmation.lastIndexOf(")") + 2).trim().split(/\s+/)
    if (current[19] !== fields[19] || current[2] !== fields[2]) throw new Error("Process generation changed during inspection")
    return { pid, group: Number(fields[2]), start: BigInt(fields[19]!), state: current[0]!, uid: metadata.uid }
  } catch (error) {
    if (error instanceof Error && "code" in error && ["ENOENT", "ESRCH"].includes(String(error.code))) return undefined
    throw error
  }
}
