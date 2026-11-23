import { expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { Schema } from "effect"
import { SfContextResult, type SfContextStamp } from "@orchestra/schema/sucafina/context"
import type { Account } from "./runtime"
import { forwardOnce } from "./runtime"

type FileOperation = "files.document-candidates" | "files.document-scenario-targets" | "files.document-scenario-preview"
type Observed = Awaited<ReturnType<typeof forwardOnce>>

/**
 * Observe the original Files response and its original outgoing F01 fence.
 * The transport revalidates authority before releasing JSON to the consumer.
 * Neither observer emits, retries or changes a request or response.
 */
export async function observeRecordFileOperation(page: Page, account: Account, expected: SfContextStamp,
  operation: FileOperation, endpoint: Parameters<typeof forwardOnce>[1], method: "GET" | "POST") {
  let egress: Observed | undefined
  const contextPath = new URL(account.baseURL).pathname + "/api/ui/context"
  const original = await forwardOnce(page, endpoint, method, async (response) => {
    if (response.status() !== 200) return
    // Armed before the producer response reaches the UI, so the next matching
    // context request is the transport's existing post-response authority read.
    egress = await forwardOnce(page, (url) =>
      url.origin === account.origin && url.pathname === contextPath &&
      url.searchParams.get("installationId") === expected.installationId &&
      url.searchParams.get("projectId") === expected.projectId &&
      url.searchParams.get("hostId") === expected.hostId, "GET")
  })
  return {
    completed: original.completed,
    async finish() {
      const captured = await original.completed
      expect(captured.response.status()).toBe(200)
      if (!egress) throw new Error("The original Files response did not register its authority fence")
      const fence = await egress.completed
      expect(fence.request.method()).toBe("GET")
      expect(fence.response.status()).toBe(200)
      const context = Schema.decodeUnknownSync(SfContextResult, { onExcessProperty: "error" })(await fence.response.json())
      if (context.status !== "ok") throw new Error("The original Files authority fence is unavailable")
      expect(context.value.stamp).toEqual(expected)
      const resources = operation === "files.document-candidates" ? ["documents", "evidence"] : ["document-scenario"]
      for (const resource of resources) {
        const matches = context.value.availability.filter((entry) => entry.family === "files" && entry.resource === resource)
        expect(matches).toHaveLength(1)
        const operations = matches[0].operations.filter((entry) => entry.operationId === operation)
        expect(operations).toHaveLength(1)
        expect(operations[0]).toMatchObject({ state: "ready", operational: true })
      }
      return captured
    },
    async close() {
      try { await original.close() }
      finally { await egress?.close() }
    },
  }
}
