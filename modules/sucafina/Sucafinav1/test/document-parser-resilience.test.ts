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

test("transferred document bytes remain globally reserved until the worker actually stops", async () => {
  const readyHanging = new URL("./fixture/parser-ready-hanging-worker.ts", import.meta.url)
  const probe = new URL("./fixture/parser-probe-worker.ts", import.meta.url)
  const received = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT))
  let created = 0
  const parser = createPrivateDocumentParser({
    maxBytes: 16 * 1024 * 1024,
    maxTextLength: 1024,
    maxPages: 10,
    maxXmlBytes: 1024,
    maxZipEntries: 10,
    timeoutMs: 2_000,
  }, {
    createWorker: (kind) => new Worker(created++ === 0 ? readyHanging : probe, {
      workerData: created === 1 ? { kind, received: received.buffer } : { kind },
    }),
    retirementGraceMs: 25,
    terminationTimeoutMs: 500,
    maxConcurrentBytes: 16 * 1024 * 1024,
  })
  const firstBytes = new Uint8Array(12 * 1024 * 1024)
  const secondBytes = new Uint8Array(8 * 1024 * 1024)
  const abort = new AbortController()

  const held = parser.extractDocx(firstBytes, abort.signal)
  const deadline = performance.now() + 1_000
  while (Atomics.load(received, 0) !== 1 && performance.now() < deadline) await Bun.sleep(5)
  expect(Atomics.load(received, 0)).toBe(1)
  expect(await parser.extractDocx(secondBytes)).toEqual({ status: "unavailable", reason: "document-parser-busy" })
  expect(created).toBe(1)

  abort.abort()
  expect(await held).toEqual({ status: "unavailable", reason: "cancelled" })
  expect(await parser.extractDocx(new Uint8Array([1, 2, 3]))).toEqual({ status: "ok", value: "docx:3" })
  expect(created).toBe(2)
  expect([...firstBytes.subarray(0, 3)]).toEqual([0, 0, 0])
})
