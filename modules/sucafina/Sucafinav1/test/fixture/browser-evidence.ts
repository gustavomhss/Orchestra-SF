import path from "node:path"
import type { Locator, Page } from "@playwright/test"

export async function withinBrowserDeadline<T>(
  phase: string,
  operation: () => Promise<T>,
  milliseconds = 10_000,
): Promise<T> {
  const expired = new Error(`Browser deadline exceeded: ${phase}`)
  if (milliseconds <= 0) throw expired
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(expired), milliseconds)
    })
    return await Promise.race([Promise.resolve().then(operation), timeout])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

export async function captureBrowserPng(page: Page, artifact: string, options?: { element?: Locator; milliseconds?: number }) {
  const name = path.basename(artifact)
  const deadline = performance.now() + (options?.milliseconds ?? 10_000)
  const phase = <T>(label: string, operation: () => Promise<T>) =>
    withinBrowserDeadline(`${name}: ${label}`, operation, deadline - performance.now())
  console.info("browser evidence: PNG start", name)
  const session = await phase("attach CDP", () => page.context().newCDPSession(page))
  let completed = false
  try {
    // Use compositor capture without Playwright's font/animation preflight or viewport resizing.
    const area = options?.element
      ? await phase("element geometry", () => options.element!.evaluate((node) => {
        const box = node.getBoundingClientRect()
        return { x: box.left + window.scrollX, y: box.top + window.scrollY, width: box.width, height: box.height }
      }))
      : (await phase("full-page geometry", () => session.send("Page.getLayoutMetrics"))).cssContentSize
    if (![area.x, area.y, area.width, area.height].every(Number.isFinite) || area.width <= 0 || area.height <= 0)
      throw new Error(`Invalid screenshot geometry: ${name}`)
    const x = Math.floor(area.x)
    const y = Math.floor(area.y)
    const clip = { x, y, width: Math.ceil(area.x + area.width) - x, height: Math.ceil(area.y + area.height) - y, scale: 1 }
    console.info("browser evidence: PNG layout", name, clip.width, clip.height)
    const frame = await phase("capture compositor PNG", () => session.send("Page.captureScreenshot", {
      format: "png", fromSurface: true, captureBeyondViewport: true, clip,
    }))
    console.info("browser evidence: PNG received", name)
    const bytes = Buffer.from(frame.data, "base64")
    if (bytes.length <= 33 || !bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) ||
        bytes.toString("ascii", 12, 16) !== "IHDR" ||
        bytes.readUInt32BE(16) !== clip.width || bytes.readUInt32BE(20) !== clip.height ||
        !bytes.subarray(-12).equals(Buffer.from("0000000049454e44ae426082", "hex")))
      throw new Error(`Invalid or incomplete screenshot PNG: ${name}`)
    await phase("persist PNG", () => Bun.write(artifact, bytes))
    const persisted = await phase("read persisted PNG", () => Bun.file(artifact).arrayBuffer())
    if (!Buffer.from(persisted).equals(bytes)) throw new Error(`Persisted screenshot bytes differ: ${name}`)
    completed = true
    console.info("browser evidence: PNG verified", name, bytes.length)
  } catch (error) {
    console.error("browser evidence: PNG failure", name, error instanceof Error ? error.message : "unknown error")
    throw error
  } finally {
    await withinBrowserDeadline(`${name}: detach CDP`, () => session.detach(), 2_000)
      .catch((error: unknown) => {
        if (completed) throw error
        console.error("browser evidence: CDP detach failed after screenshot error", name)
      })
  }
}
