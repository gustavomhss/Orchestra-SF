import { describe, expect, test } from "bun:test"
import { SfFiles } from "@orchestra/schema/sucafina/files"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { createSfFilesClient, readSfFilesSignedAssetQuery } from "@orchestra/client/sucafina/files"
import { createSfFilesHostBindings } from "../../../../../apps/cli/src/sucafina-product/native-ui/files"

const uuid = "123e4567-e89b-42d3-a456-426614174000"
function fixture() {
  const operations: string[] = []
  const transport: SfTransport = {
    async execute(operation) {
      operations.push(operation.operationId)
      return { kind: "transport-error", reason: "contract-unavailable" }
    },
  }
  return { operations, client: createSfFilesClient(transport) }
}
const options = () => ({ signal: new AbortController().signal, idempotencyKey: uuid })

describe("A06 source-bound files contracts (component-only; NOT installed E2E)", () => {
  test("each of 25 catalogued operation names is literal and unique", () => {
    const ids = Object.keys(SfFiles.operations)
    expect(ids).toHaveLength(25)
    expect(new Set(ids).size).toBe(25)
    expect(ids.every((id) => id.startsWith("files."))).toBe(true)
    for (const id of ids) {
      expect(SfFiles.operations[id as keyof typeof SfFiles.operations].operationId).toBe(id)
    }
  })

  test("import upload is staged only via existing producer, and scanner failure is never inferred clean", async () => {
    const { client, operations } = fixture()
    const result = await client["files.import-admit"]({
      surface: "planner", selectionRef: "selection-1",
      options: { newVersion: false, removeMissing: false, preview: {} },
      fileName: "budget.xlsx", mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      bytes: new Uint8Array([1, 2, 3]),
    }, options())
    expect(result).toEqual({ kind: "transport-error", reason: "contract-unavailable" })
    expect(operations).toEqual(["files.import-admit"])
  })

  test("invalid binary, extension, options and missing idempotency do not reach transport", async () => {
    const { client, operations } = fixture()
    const base = {
      surface: "planner" as const, selectionRef: "selection-1",
      options: { newVersion: false, removeMissing: false, preview: {} },
      fileName: "budget.xlsx", mediaType: "application/octet-stream",
      bytes: new Uint8Array([1]),
    }
    const invalid = [
      { ...base, bytes: new Uint8Array() },
      { ...base, fileName: "budget.exe" },
      { ...base, options: { ...base.options, ownerOverride: true } },
      { ...base, bytes: new Uint8Array(16 * 1024 * 1024 + 1) },
    ]
    for (const input of invalid) {
      const result = await client["files.import-admit"](input as never, options())
      expect(result).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    }
    expect(await client["files.import-admit"](base, {
      signal: new AbortController().signal,
    })).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    expect(operations).toEqual([])
  })

  test("preview/apply are distinct, and prepare does not invent an apply receipt", async () => {
    const { client, operations } = fixture()
    await client["files.import-preview"]({
      surface: "planner", admittedFileRef: "staged-ref", format: "xlsx", options: {},
    }, options())
    await client["files.import-apply"]({
      surface: "planner", manifestId: "manifest-1", version: 1,
    }, options())
    expect(operations).toEqual(["files.import-preview", "files.import-apply"])
  })

  test("an incomplete or inverted period is not dispatched", async () => {
    const { client, operations } = fixture()
    const signals = options()
    expect(await client["files.import-targets"]({
      surface: "planner", start: "2026-11-01",
    }, signals)).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    expect(await client["files.import-targets"]({
      surface: "planner", start: "2026-12-01", end: "2026-11-01",
    }, signals)).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    expect(operations).toEqual([])
  })

  test("document extraction cannot be confirmed with a pending/partial response", async () => {
    const { client, operations } = fixture()
    const fake = { id: "candidate-1", status: "stale" }
    const result = await client["files.document-confirm"]({
      surface: "dashboard", evidence: fake as never,
    }, options())
    expect(result).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    expect(operations).toEqual([])
  })

  test("document schema validation preserves version CAS and disallows duplicate field IDs", async () => {
    const { client, operations } = fixture()
    const input = {
      surface: "dashboard" as const, documentRef: "doc-1",
      fields: [{ id: "amount", type: "number" as const }, { id: "amount", type: "number" as const }],
    }
    expect(await client["files.document-schema"](input, options())).toEqual({
      kind: "transport-error", reason: "contract-mismatch",
    })
    expect(operations).toEqual([])
  })

  test("assets carry raw bytes to original server, never a local scanner flag or path", async () => {
    const { client, operations } = fixture()
    const mismatched = {
      surface: "dashboard" as const, upload: "supplier" as const,
      record: "supplier-1", recordVersion: 0,
      name: "supplier.pdf", page: "Vendor Contracts",
      mediaType: "application/pdf", bytes: new Uint8Array([10]),
    }
    expect(await client["files.asset.upload"](mismatched, options())).toEqual({
      kind: "transport-error", reason: "contract-mismatch",
    })
    expect(operations).toEqual([])
  })

  test("signed asset query parsing accepts only exactly one of each server field", () => {
    const signature = "a".repeat(64)
    const good = "asset=record42&expires=1797000000000&signature=" + signature
    expect(readSfFilesSignedAssetQuery(good)).toEqual({
      assetId: "record42", expires: 1797000000000, signature,
    })
    expect(readSfFilesSignedAssetQuery(good + "&asset=attacker")).toBeUndefined()
    expect(readSfFilesSignedAssetQuery(good + "&url=https://evil.invalid")).toBeUndefined()
    expect(readSfFilesSignedAssetQuery("?" + good)).toBeUndefined()
    expect(readSfFilesSignedAssetQuery("asset=r&expires=0&signature=" + signature)).toBeUndefined()
  })

  test("server-only delegates preserve original Response including streamed bytes and refusal", async () => {
    const denial = Response.json({ status: "denied" }, { status: 403 })
    const bytes = new Response(new Uint8Array([12, 13]), {
      status: 200, headers: { "Content-Type": "application/octet-stream" },
    })
    const bindings = createSfFilesHostBindings({
      documents: async () => denial,
      application: async () => bytes,
    })
    const req = new Request("https://installation.invalid/sf/dashboard?sf=document-open")
    const denied = await bindings["files.document-open"](req, "dashboard")
    expect(denied).toBe(denial)
    expect(denied.status).toBe(403)
    const downloaded = await bindings["files.asset.download"](req, "dashboard")
    expect(downloaded).toBe(bytes)
    expect(downloaded.headers.get("content-type")).toBe("application/octet-stream")
    expect(await bindings["files.import-admit"](req, "planner")).toHaveProperty("status", 503)
  })
})
