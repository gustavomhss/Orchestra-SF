import { expect, test } from "bun:test"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContextDependencies, SfOwnerIdentity } from "../../src/orchestra/chapters/sucafina/context/contracts"
import { createSfOwnerDrafts } from "../../src/orchestra/chapters/sucafina/context/drafts"
import { createSfDraft } from "../../src/orchestra/chapters/sucafina/shared/draft"
import { beginReportRecovery, clearReportMarker, readReportMarker, readReportRecovery,
  runReportRecovery, writeReportMarker } from "../../src/orchestra/chapters/sucafina/reviews/reports/recovery"
import type { SfOwnerKey } from "@orchestra/schema/sucafina/context"

// Component fixtures are not installed producer or Office-file proof.
const key = "123e4567-e89b-42d3-a456-426614174000"
const payload = { reviewRef: "review-1", sectionRefs: ["section-2", "section-1"], format: "docx" as const }
function owner() {
  const identity: SfOwnerIdentity = { serverKey: "server", transportIdentity: "transport", publicOrigin: "https://example.test",
    installationId: "installation", projectId: "project", principalRef: "person", authEpoch: 1 }
  return createSfOwnerDrafts({ createDraft: createSfDraft } as SfContextDependencies,
    { key: "owner" as SfOwnerKey, identity })
}
const options = (drafts: ReturnType<typeof owner>["registry"], transport: SfTransport, current = () => true) => ({
  drafts, transport, signal: new AbortController().signal, current, principalRef: "person", accessRevision: "revision",
  onDownloaded: () => true,
})

test("owner marker refuses replacement or removal with another correlation", () => {
  const data = new Map<string, string>()
  const storage = { get length() { return data.size }, key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (name: string) => data.get(name) ?? null,
    setItem: (name: string, value: string) => { data.set(name, value) },
    removeItem: (name: string) => { data.delete(name) } }
  expect(readReportMarker(storage, "owner-scope")).toBeNull()
  expect(writeReportMarker(storage, "owner-scope", key)).toBe(true)
  expect(writeReportMarker(storage, "owner-scope", "223e4567-e89b-42d3-a456-426614174000")).toBe(false)
  expect(clearReportMarker(storage, "owner-scope", "223e4567-e89b-42d3-a456-426614174000")).toBe(false)
  expect(readReportMarker(storage, "owner-scope")).toBe(key)
  expect(clearReportMarker(storage, "owner-scope", key)).toBe(true)
  storage.setItem("owner-scope", "invalid")
  expect(readReportMarker(storage, "owner-scope")).toBeUndefined()
  expect(writeReportMarker(storage, "owner-scope", key)).toBe(false)
  storage.removeItem("owner-scope")
  storage.setItem("sf:ui50:report:v1:old-host", key)
  expect(readReportMarker(storage, "new-owner-scope")).not.toBeNull()
  expect(writeReportMarker(storage, "new-owner-scope", key)).toBe(false)
})

test("a transport contract mismatch cannot clear a possibly submitted intent", async () => {
  const scope = owner()
  const transport = { execute: async () => ({ kind: "transport-error", reason: "contract-mismatch" }) } as unknown as SfTransport
  beginReportRecovery(scope.registry, { ownerScope: "owner-scope", idempotencyKey: key, payload })
  await runReportRecovery(options(scope.registry, transport))
  expect(readReportRecovery(scope.registry)).toMatchObject({ idempotencyKey: key, payload, reason: "contract-mismatch" })
  expect(scope.discardAll()).toBe(false)
})

test("uncertain prepare survives a view reload and retries only the original payload and key", async () => {
  const scope = owner(), sent: unknown[] = []
  const transport = { execute: async (operation: { operationId: string }, value: unknown, call: { idempotencyKey?: string }) => {
    sent.push({ operation: operation.operationId, value: structuredClone(value), key: call.idempotencyKey })
    return { kind: "transport-error", reason: "outcome-unknown" }
  } } as unknown as SfTransport
  const selection = { ...payload, sectionRefs: [...payload.sectionRefs] }
  beginReportRecovery(scope.registry, { ownerScope: "owner-scope", idempotencyKey: key, payload: selection })
  selection.sectionRefs.reverse()
  await runReportRecovery(options(scope.registry, transport))
  expect(scope.discardAll()).toBe(false)
  expect(readReportRecovery(scope.registry)?.payload).toEqual(payload)
  expect(beginReportRecovery(scope.registry, { ownerScope: "owner-scope", idempotencyKey: "another-key", payload })).toBeUndefined()
  // A new view obtains the same owner registry, rather than reconstructing a command.
  await runReportRecovery(options(scope.registry, transport))
  expect(sent).toEqual([1, 2].map(() => ({ operation: "reviews.report.prepare", value: payload, key })))
})

test("a prepared artifact is retained after a download error and retry never prepares again", async () => {
  const scope = owner(), sent: string[] = []
  const artifactRef = "report:" + "a".repeat(64)
  const transport = { execute: async (operation: { operationId: string }) => {
    sent.push(operation.operationId)
    if (operation.operationId === "files.export.review") return { kind: "transport-error", reason: "network" }
    return { kind: "response", status: 200, headers: {}, body: { status: "ok", outputRef: artifactRef,
      result: { reviewSelectionRef: payload.reviewRef, orderedResultRefs: [artifactRef],
        coverage: payload.sectionRefs.map((sectionRef) => ({ sectionRef, includedCount: 1, totalCount: 1 })), gaps: [] },
      receipt: { operation: "sf_report_prepare", principalRef: "person", accessRevision: "revision" } } }
  } } as unknown as SfTransport
  beginReportRecovery(scope.registry, { ownerScope: "owner-scope", idempotencyKey: key, payload })
  await runReportRecovery(options(scope.registry, transport))
  expect(readReportRecovery(scope.registry)?.artifactRef).toBe(artifactRef)
  await runReportRecovery(options(scope.registry, transport))
  expect(sent).toEqual(["reviews.report.prepare", "files.export.review", "files.export.review"])
  expect(scope.discardAll()).toBe(false)
})

test("late results cannot enter a changed owner's recovery", async () => {
  const scope = owner(), foreign = owner()
  let release!: (value: unknown) => void
  let current = true
  const transport = { execute: () => new Promise((resolve) => { release = resolve }) } as unknown as SfTransport
  beginReportRecovery(scope.registry, { ownerScope: "owner-scope", idempotencyKey: key, payload })
  const running = runReportRecovery(options(scope.registry, transport, () => current))
  current = false
  scope.revoke("owner-changed")
  release({ kind: "response", status: 200, body: { status: "ok", outputRef: "report:" + "a".repeat(64) } })
  await running
  expect(readReportRecovery(scope.registry)).toBeUndefined()
  expect(readReportRecovery(foreign.registry)).toBeUndefined()
})
