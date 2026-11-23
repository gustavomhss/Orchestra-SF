import type { Page, Route } from "@playwright/test"
import { Schema } from "effect"
import { SfIntelligenceMemorySimilarCases } from "@orchestra/schema/sucafina/memory"
import type { DesignInstallation } from "./installation"

const originalReadDeadline = 40_000
type OriginalRecall = Readonly<{ status: number; url: string; body: unknown; result: unknown }>

function boundedOriginalRead<T>(value: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Original similar-case response exceeded the original 40s read deadline")), originalReadDeadline)
    value.then((result) => { clearTimeout(timer); resolve(result) },
      (error: unknown) => { clearTimeout(timer); reject(error) })
  })
}

/** Observe the single original POST outside Chromium's transient response cache.
 * Preserve the request and the APIResponse, without replay, retries or redirects.
 * This observer is never used by native consultation-cancellation tests. */
export async function observeFinalMemoryRecall(page: Page, installation: Pick<DesignInstallation, "origin" | "mount">) {
  let resolve!: (value: OriginalRecall | PromiseLike<OriginalRecall>) => void
  let reject!: (error: unknown) => void
  const response = new Promise<OriginalRecall>((accept, refuse) => { resolve = accept; reject = refuse })
  void response.catch(() => undefined)
  let claimed = false
  let consumed = false
  let closed = false
  const match = (url: URL) => url.origin === installation.origin &&
    url.pathname === installation.mount + "/dashboard" && url.searchParams.get("sf") === "memory-similar-cases"
  const capture = async (route: Route) => {
    const request = route.request()
    if (closed || claimed || request.method() !== "POST") {
      await route.fallback()
      return
    }
    claimed = true
    const read = boundedOriginalRead((async () => {
      const original = await route.fetch({ maxRedirects: 0, maxRetries: 0, timeout: originalReadDeadline })
      try {
        const raw: unknown = await original.json()
        const source = raw && typeof raw === "object" ? raw : undefined
        const status = source && "status" in source && typeof source.status === "string" ? source.status : null
        const reason = source && "reason" in source && typeof source.reason === "string" ? source.reason : null
        console.info("SF_FINAL_MEMORY_RECALL_RESPONSE " + JSON.stringify({
          httpStatus: original.status(), status: status?.slice(0, 200) ?? null,
          statusTruncated: status !== null && status.length > 200,
          reason: reason?.slice(0, 200) ?? null, reasonTruncated: reason !== null && reason.length > 200,
        }))
        const result: unknown = Schema.decodeUnknownSync(Schema.toType(SfIntelligenceMemorySimilarCases.output), {
          onExcessProperty: "error",
        })(raw)
        return { status: original.status(), url: original.url(), body: request.postDataJSON() as unknown, result }
      } finally {
        // The browser receives the unchanged original response even if decoding fails.
        await route.fulfill({ response: original })
      }
    })())
    resolve(read)
    await read.catch(async (error: unknown) => {
      reject(error)
      // Cleanup after a failed observation; the source request is never resent.
      await route.abort("failed").catch(() => undefined)
    })
  }
  await page.route(match, capture)
  return {
    next(): Promise<OriginalRecall> {
      if (closed) return Promise.reject(new Error("The original recall observer is closed"))
      if (consumed) return Promise.reject(new Error("Only one original recall request is observed"))
      consumed = true
      return boundedOriginalRead(response)
    },
    async close() {
      if (closed) return
      closed = true
      reject(new Error("The original recall observation ended"))
      if (page.isClosed()) return
      await page.unroute(match, capture).catch((error: unknown) => {
        if (!page.isClosed()) throw error
      })
    },
  }
}
