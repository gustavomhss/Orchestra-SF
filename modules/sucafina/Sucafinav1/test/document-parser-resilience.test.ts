import { expect, test } from "bun:test"
import { Worker } from "node:worker_threads"
import { createPrivateDocumentParser } from "../product/documents/parser.ts"

test("timed-out parser boots retire within a bound and later work recovers without detaching caller bytes", async () => {
  const hanging = new URL("./fixture/parser-hanging-worker.ts", import.meta.url)
  const probe = new URL("./fixture/parser-probe-worker.ts", import.meta.url)
  let created = 0
  const parser = createPrivateDocumentParser({
    maxBytes: 1024,
    maxTextLength: 1024,
    maxPages: 10,
    maxXmlBytes: 1024,
    maxZipEntries: 10,
    timeoutMs: 500,
  }, {
    createWorker: (kind) => new Worker(created++ < 2 ? hanging : probe, { workerData: { kind } }),
    retirementGraceMs: 25,
    terminationTimeoutMs: 250,
  })
  const bytes = new Uint8Array([1, 2, 3])

  const first = parser.extractDocx(bytes)
  const second = parser.extractDocx(bytes)
  expect(await parser.extractDocx(bytes)).toEqual({ status: "unavailable", reason: "document-parser-busy" })
  expect(await Promise.all([first, second])).toEqual([
    { status: "unavailable", reason: "document-parser-start-timeout" },
    { status: "unavailable", reason: "document-parser-start-timeout" },
  ])

  await Bun.sleep(100)
  expect(await parser.extractDocx(bytes)).toEqual({ status: "ok", value: "docx:3" })
  expect([...bytes]).toEqual([1, 2, 3])
})
