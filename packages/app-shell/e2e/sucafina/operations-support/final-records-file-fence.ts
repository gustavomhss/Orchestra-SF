import { expect } from "@playwright/test"
import type { APIResponse, Page } from "@playwright/test"
import { Schema } from "effect"
import { SfContextResult, type SfContextStamp } from "@orchestra/schema/sucafina/context"
import type { Account } from "./runtime"
import { forwardOnce } from "./runtime"
import { observeFinalGet } from "../design-support/final-navigation"

export type RecordFileOperation =
  | "files.import-targets" | "files.import-admit" | "files.import-preview"
  | "files.import-reference" | "files.import-detail"
  | "files.document-sources" | "files.document-admit" | "files.document-schema"
  | "files.document-extract" | "files.document-candidates" | "files.document-open"
  | "files.document-confirm" | "files.document-scenario-targets" | "files.document-scenario-preview"
export type RecordContextStamp = SfContextStamp | Promise<SfContextStamp>

/** Observe the original provider/route reads, or one explicitly triggered Files
 * preflight. No context request is emitted by this helper. */
export async function observeRecordContext(page: Page, account: Account, count: 1 | 2 = 2,
  principal = account.principal) {
  const reads = await observeFinalGet(page, account.origin,
    new URL(account.baseURL).pathname + "/api/ui/context", count, (url) =>
      url.searchParams.get("installationId") === account.installationId &&
      url.searchParams.get("projectId") === account.projectId)
  const completed = (async () => {
    let stamp: SfContextStamp | undefined
    let first: Awaited<ReturnType<typeof reads.next>> | undefined
    for (let index = 0; index < count; index += 1) {
      const original = await reads.next()
      first ??= original
      expect(original.status).toBe(200)
      const query = new URL(original.request.url()).searchParams
      expect([...query.keys()].sort()).toEqual(["hostId", "installationId", "projectId"])
      expect(query.getAll("installationId")).toEqual([account.installationId])
      expect(query.getAll("projectId")).toEqual([account.projectId])
      const context = Schema.decodeUnknownSync(SfContextResult, { onExcessProperty: "error" })(original.body)
      if (context.status !== "ok") throw new Error("The original record context is unavailable")
      expect(context.value.stamp).toMatchObject({
        installationId: account.installationId, projectId: account.projectId, principalRef: principal,
      })
      expect(query.getAll("hostId")).toEqual([context.value.stamp.hostId])
      if (stamp) expect(context.value.stamp).toEqual(stamp)
      stamp = context.value.stamp
    }
    if (!stamp || !first) throw new Error("The original record context supplied no stamp")
    return { stamp, first }
  })()
  const stamp = completed.then((result) => result.stamp)
  void completed.catch(() => undefined)
  void stamp.catch(() => undefined)
  return { completed, stamp, close: () => reads.close() }
}

/** A full native navigation has provider and route admission. Preserve the
 * caller's original navigation response and its existing HTTP/DOM assertions. */
export async function withRecordNavigation<T>(page: Page, account: Account, action: () => Promise<T>,
  principal = account.principal) {
  const observed = await observeRecordContext(page, account, 2, principal)
  let failed = false
  try {
    const result = await action()
    await observed.completed
    return result
  } catch (error) { failed = true; throw error }
  finally { await closeRecordObservers([observed.close], failed) }
}

function resourcesFor(operation: RecordFileOperation) {
  if (operation.startsWith("files.import-")) return ["import-admit", "import-preview", "import-apply"]
  if (operation === "files.document-scenario-targets" || operation === "files.document-scenario-preview")
    return ["document-scenario"]
  return ["documents", "evidence"]
}

/** Arm before delivering a selected original Files JSON response. The serial
 * consumer next performs its outgoing F01 check before releasing the payload.
 * This is also used at CDP response-stage for the untouched multipart upload. */
export async function observeRecordFileExit(page: Page, account: Account, expected: RecordContextStamp,
  operation: RecordFileOperation) {
  const stamp = await expected
  const contextPath = new URL(account.baseURL).pathname + "/api/ui/context"
  const observed = await forwardOnce(page, (url) =>
    url.origin === account.origin && url.pathname === contextPath &&
    url.searchParams.get("installationId") === stamp.installationId &&
    url.searchParams.get("projectId") === stamp.projectId &&
    url.searchParams.get("hostId") === stamp.hostId, "GET")
  return {
    async finish() {
      const fence = await observed.completed
      expect(fence.request.method()).toBe("GET")
      expect(fence.response.status()).toBe(200)
      const query = new URL(fence.request.url()).searchParams
      expect([...query.keys()].sort()).toEqual(["hostId", "installationId", "projectId"])
      for (const key of ["hostId", "installationId", "projectId"] as const)
        expect(query.getAll(key)).toEqual([stamp[key]])
      const context = Schema.decodeUnknownSync(SfContextResult, { onExcessProperty: "error" })(await fence.response.json())
      if (context.status !== "ok") throw new Error("The original Files authority fence is unavailable")
      expect(context.value.stamp).toEqual(stamp)
      for (const resource of resourcesFor(operation)) {
        const matches = context.value.availability.filter((entry) => entry.family === "files" && entry.resource === resource)
        expect(matches).toHaveLength(1)
        const operations = matches[0].operations.filter((entry) => entry.operationId === operation)
        expect(operations).toHaveLength(1)
        expect(operations[0]).toMatchObject({ state: "ready", operational: true })
      }
      console.info("SF_FINAL_RECORDS_FILE_FENCE " + JSON.stringify({ operation, status: fence.response.status() }))
    },
    close: () => observed.close(),
  }
}

/** Forward the selected request once and deliver its original response. No
 * additional request, retry, replacement response or grant is introduced.
 * Denied, byte and deliberately aborted requests use their original observers. */
export async function observeRecordFileOperation(page: Page, account: Account, expected: RecordContextStamp,
  operation: RecordFileOperation, endpoint: Parameters<typeof forwardOnce>[1], method: "GET" | "POST",
  options: { expectedStatus?: 200 | 503; beforeDelivery?: (response: APIResponse) => Promise<void> } = {}) {
  const expectedStatus = options.expectedStatus ?? 200
  if (expectedStatus === 503 && operation !== "files.document-candidates")
    throw new Error("Only the original revoked candidate read expects a typed 503 here")
  let egress: Awaited<ReturnType<typeof observeRecordFileExit>> | undefined
  const original = await forwardOnce(page, endpoint, method, async (response) => {
    if (response.status() === expectedStatus)
      egress = await observeRecordFileExit(page, account, expected, operation)
    await options.beforeDelivery?.(response)
  })
  return {
    completed: original.completed,
    async finish() {
      const captured = await original.completed
      expect(captured.response.status()).toBe(expectedStatus)
      if (!egress) throw new Error("The original Files response did not register its authority fence")
      await egress.finish()
      return captured
    },
    async close() {
      try { await original.close() }
      finally { await egress?.close() }
    },
  }
}

/** Close every registration, preserving the first action/assertion failure. */
export async function closeRecordObservers(releases: readonly (() => Promise<void>)[], failed = false) {
  let cleanup: unknown
  for (const release of [...releases].reverse()) {
    try { await release() }
    catch (error) { cleanup ??= error }
  }
  if (!failed && cleanup !== undefined) throw cleanup
}
