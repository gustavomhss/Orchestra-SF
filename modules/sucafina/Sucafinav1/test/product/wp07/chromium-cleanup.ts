import { readFile, readdir, stat } from "node:fs/promises"
import type { Browser } from "@playwright/test"

// Adapted from test/fixture/local-browser.ts. That helper also creates a complete installation,
// scanner and listener on port 4110; this test needs only its Chrome ownership/closure protocol.
export async function captureChromiumCleanup(browser: Browser) {
  if (process.platform !== "linux") throw new Error("WP07_CHROME_CLEANUP_REQUIRES_LINUX")
  const cdp = await browser.newBrowserCDPSession()
  const info: unknown = await cdp.send("SystemInfo.getProcessInfo")
  if (!info || typeof info !== "object" || !("processInfo" in info) || !Array.isArray(info.processInfo)) throw new Error("WP07_CHROME_PROCESS_INFO_UNAVAILABLE")
  const leaders = (info.processInfo as unknown[]).filter((entry): entry is { type: string; id: number } =>
    entry !== null && typeof entry === "object" && "type" in entry && entry.type === "browser" &&
    "id" in entry && typeof entry.id === "number" && Number.isSafeInteger(entry.id) && entry.id > 0)
  if (leaders.length !== 1) throw new Error("WP07_CHROME_PROCESS_IDENTITY_UNAVAILABLE")
  const owner = await linuxProcess(leaders[0]!.id)
  if (!owner || owner.pid === process.pid || owner.group !== owner.pid || owner.uid !== process.getuid?.() || ["Z", "X"].includes(owner.state)) throw new Error("WP07_CHROME_GROUP_NOT_ISOLATED")
  const cmdline = await readFile(`/proc/${owner.pid}/cmdline`, "utf8")
  const confirmed = await linuxProcess(owner.pid)
  if (!cmdline || !confirmed || confirmed.start !== owner.start || confirmed.group !== owner.group || confirmed.uid !== owner.uid) throw new Error("WP07_CHROME_OWNERSHIP_CHANGED")
  return async () => {
    const outcomes: { operation: string; settled: boolean; error?: unknown }[] = []
    const bounded = async (operation: string, promise: Promise<unknown>, milliseconds: number) => {
      const outcome = { operation, settled: false, error: undefined as unknown }
      outcomes.push(outcome)
      const deadline = { timer: undefined as ReturnType<typeof setTimeout> | undefined }
      try {
        await Promise.race([
          promise.then(() => { outcome.settled = true }, (error: unknown) => { outcome.settled = true; outcome.error = error }),
          new Promise<void>((resolve) => { deadline.timer = setTimeout(resolve, milliseconds); deadline.timer.unref() }),
        ])
      } finally { if (deadline.timer) clearTimeout(deadline.timer) }
    }
    await Promise.all(browser.contexts().map((context, index) => bounded(`context.close:${index}`, context.close(), 750)))
    await bounded("CDP Browser.close", cdp.send("Browser.close"), 1000)
    await bounded("browser.close", browser.close(), 1500)
    const census = async () => {
      const members = (await Promise.all((await readdir("/proc")).filter((name) => /^\d+$/.test(name))
        .map((name) => linuxProcess(Number(name), owner.group)))).filter((entry): entry is NonNullable<typeof entry> => entry !== undefined)
      if (members.some((entry) => entry.uid !== owner.uid || entry.start < owner.start || (entry.pid === owner.pid && entry.start !== owner.start))) throw new Error("WP07_CHROME_GROUP_HAS_FOREIGN_GENERATION")
      return members.filter((entry) => !["Z", "X"].includes(entry.state))
    }
    const waitForEnd = async (milliseconds: number) => {
      const end = Date.now() + milliseconds
      do {
        if (!(await census()).length && !browser.isConnected()) return true
        // This observes OS shutdown, never waits for a product UI condition or retries a test action.
        await new Promise<void>((resolve) => setTimeout(resolve, 50))
      } while (Date.now() < end)
      return false
    }
    const signal = async (kind: "SIGTERM" | "SIGKILL") => {
      if (!(await census()).length) return
      const leader = await linuxProcess(owner.pid)
      if (!leader || leader.uid !== owner.uid || leader.start !== owner.start || leader.group !== owner.group || await readFile(`/proc/${owner.pid}/cmdline`, "utf8") !== cmdline) throw new Error("WP07_CHROME_LEADER_CHANGED")
      const verified = await linuxProcess(owner.pid)
      if (!verified || verified.uid !== owner.uid || verified.start !== owner.start || verified.group !== owner.group) throw new Error("WP07_CHROME_GENERATION_CHANGED")
      try { process.kill(-owner.group, kind) }
      catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) throw error }
    }
    try {
      if (!await waitForEnd(1000)) {
        await signal("SIGTERM")
        if (!await waitForEnd(2000)) {
          await signal("SIGKILL")
          if (!await waitForEnd(7000)) throw new Error("WP07_CHROME_GROUP_OR_TRANSPORT_REMAINS_LIVE")
        }
      }
      if ((await census()).length || browser.isConnected()) throw new Error("WP07_CHROME_CLOSURE_PROOF_FAILED")
    } catch (error) {
      console.error("WP07 browser: Chrome cleanup failed", {
        pid: owner.pid, group: owner.group, uid: owner.uid, start: owner.start.toString(), connected: browser.isConnected(),
        closeRPCs: outcomes.map((outcome) => ({ operation: outcome.operation, settled: outcome.settled, error: outcome.error instanceof Error ? outcome.error.message : outcome.error === undefined ? undefined : "unknown" })),
      })
      throw error
    }
    for (const outcome of outcomes) if (outcome.error !== undefined && !(outcome.error instanceof Error && /Target.*closed|Session closed|Browser has been closed/i.test(outcome.error.message))) throw outcome.error
    console.info("WP07 browser: Chrome closed; owned group has no live members and transport is disconnected", { pendingCloseRPCs: outcomes.filter((outcome) => !outcome.settled).map((outcome) => outcome.operation) })
  }
}

async function linuxProcess(pid: number, group?: number) {
  try {
    const source = await readFile(`/proc/${pid}/stat`, "utf8")
    const fields = source.slice(source.lastIndexOf(")") + 2).trim().split(/\s+/)
    if (!/^\d+$/.test(fields[2] ?? "") || !/^\d+$/.test(fields[19] ?? "") || !fields[0]) throw new Error("WP07_CHROME_PROCESS_STAT_INVALID")
    if (group !== undefined && Number(fields[2]) !== group) return undefined
    const metadata = await stat(`/proc/${pid}`)
    const confirmation = await readFile(`/proc/${pid}/stat`, "utf8")
    const current = confirmation.slice(confirmation.lastIndexOf(")") + 2).trim().split(/\s+/)
    if (current[19] !== fields[19] || current[2] !== fields[2]) throw new Error("WP07_CHROME_PROCESS_GENERATION_CHANGED")
    return { pid, group: Number(fields[2]), start: BigInt(fields[19]!), state: current[0]!, uid: metadata.uid }
  } catch (error) {
    if (error instanceof Error && "code" in error && ["ENOENT", "ESRCH"].includes(String(error.code))) return undefined
    throw error
  }
}
