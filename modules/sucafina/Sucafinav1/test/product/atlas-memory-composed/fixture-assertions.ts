import { expect } from "bun:test"
import { withDocumentReplayFixture } from "../memory-original-reauthorization/document-fixture.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { object } from "../../../runtime/contract.ts"
import type { BusinessMemoryEnvelope, SfAtlasProjection } from "../../../product/contracts/business-context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

export type DocumentFixture = Parameters<Parameters<typeof withDocumentReplayFixture>[0]>[0]

export function requireOriginalRecord(fixture: DocumentFixture, records: readonly { envelope: BusinessMemoryEnvelope; entry: SfAtlasProjection["entry"]; recordDigest?: string }[]) {
  expect(records).toHaveLength(1)
  const record = records[0]
  if (!record) throw new Error("Real Atlas recall did not retain its committed record")
  const publishedDigest = fixture.receipt.recordDigest
  const publishedEventId = fixture.receipt.eventId
  if (typeof publishedDigest !== "string" || typeof publishedEventId !== "string") throw new Error("Committed Atlas receipt omitted its digest or event identity")
  expect(digestSfValue({ kind: record.envelope.kind, owner: record.envelope.owner, entry: record.entry })).toBe(publishedDigest)
  if ("recordDigest" in record) expect(record.recordDigest).toBe(publishedDigest)
  expect(record.envelope.eventId).toBe(publishedEventId)
  expect(record.envelope.sourceEventId).toBe(fixture.eventRef.target.eventId)
  expect(record.envelope.scannerReceipt.digest).toBe(publishedDigest)
  expect(record.envelope.dependencies).toEqual(fixture.sources.map((source) => source.ref))
}

export async function readOriginalRaw(fixture: DocumentFixture, call: TrustedDomainContext) {
  const read = await fixture.memory.recall(fixture.caseRef, call)
  expect(read.status).toBe("ok")
  if (read.status !== "ok") throw new Error("Intact raw recall unavailable")
  requireOriginalRecord(fixture, read.records)
  if (typeof fixture.receipt.recordDigest !== "string") throw new Error("Committed Atlas receipt omitted its record digest")
  expect(read.records[0]?.recordDigest).toBe(fixture.receipt.recordDigest)
  return read.records
}

export function requireOnlyCaptureFault(fixture: DocumentFixture, before: Awaited<ReturnType<DocumentFixture["audit"]>>, after: Awaited<ReturnType<DocumentFixture["audit"]>>, intact: Record<string, unknown>) {
  const source = fixture.sources[0]!
  const normalized = structuredClone(after)
  const partition = Object.values(object(normalized.atlas)).map(object).find((item) => object(item.originals)[source.ref.refDigest])
  if (!partition) throw new Error("Real captured document missing from fault snapshot")
  const capture = object(object(partition.originals)[source.ref.refDigest])
  expect(capture).toEqual({ ...intact, projection: { ...object(intact.projection), value: 999 } })
  object(partition.originals)[source.ref.refDigest] = intact
  expect(normalized).toEqual(before)
  expect(after.counts).toEqual(before.counts)
}

export function settleRecall<T>(promise: Promise<T>) {
  return promise.then((value) => ({ kind: "returned" as const, value }), (error: unknown) => ({ kind: "rejected" as const, error }))
}

export function requireRecallDenied(result: { kind: "returned"; value: unknown } | { kind: "rejected"; error: unknown }, message = "SF_MEMORY_READ_UNAVAILABLE") {
  expect(result.kind).toBe("rejected")
  if (result.kind !== "rejected") throw new Error("Private recall records crossed the denied boundary")
  expect(result.error).toBeInstanceOf(Error)
  if (!(result.error instanceof Error)) throw new Error("Recall rejected without a domain error")
  expect(result.error.message).toBe(message)
}

export function requireNestedWriteFence(error: unknown) {
  expect(error).toBeInstanceOf(Error)
  if (!(error instanceof Error)) throw new Error("Capture fault failed without the C08 nested-write guard")
  expect(error.message).toBe("Nested local writes are forbidden")
}
