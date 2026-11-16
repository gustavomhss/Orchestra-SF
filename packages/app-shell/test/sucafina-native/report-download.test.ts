import { expect, test } from "bun:test"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { downloadReviewReport } from "../../src/orchestra/chapters/sucafina/reviews/reports/download"

// Component rejection tests, not evidence of an installed Office download.
test("review download refuses HTML and never opens the platform", async () => {
  let opened = false
  const transport = { execute: async () => ({ kind: "response", status: 200, body: new Uint8Array([1]),
    headers: { "content-type": "text/html" } }) } as unknown as SfTransport
  await expect(downloadReviewReport({ transport, artifactRef: "report:" + "a".repeat(64), format: "docx",
    signal: new AbortController().signal, current: () => true, downloadResponse: async () => { opened = true } }))
    .rejects.toThrow("SF_REVIEW_REPORT_DOWNLOAD_INVALID")
  expect(opened).toBe(false)
})

test("review download does not expose bytes after owner revocation", async () => {
  let current = true
  let opened = false
  const transport = { execute: async () => {
    current = false
    return { kind: "response", status: 200, body: new Uint8Array([1]), headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } }
  } } as unknown as SfTransport
  await downloadReviewReport({ transport, artifactRef: "report:" + "a".repeat(64), format: "docx",
    signal: new AbortController().signal, current: () => current, downloadResponse: async () => { opened = true } })
  expect(opened).toBe(false)
})
