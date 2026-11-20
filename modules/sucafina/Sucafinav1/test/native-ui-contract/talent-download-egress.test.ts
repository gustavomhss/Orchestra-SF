import { expect, test } from "bun:test"
import { Schema } from "effect"
import type { SfTransport } from "../../../../../packages/client/src/sucafina/transport.ts"
import { downloadTalentMembers } from "../../../../../packages/app-shell/src/orchestra/chapters/sucafina/people/talent/download.ts"
import { createApplication } from "../../runtime/application.ts"
import { parseWorkbook } from "../../runtime/workbooks.ts"
import { testPersistence } from "../fixture/persistence.ts"

// Real original workbook producer + consumer egress boundary, in process.
// Browser/platform installation is qualified by io-browser, not by this adapter.
function fixture() {
  const storage = testPersistence()
  storage.state.dashboard.data.members = [{ id: "member-1", name: "Exported fixture member", status: "Active" }]
  const authority = { current: true, revokeAfterProducer: false }
  const observed: { sourceReads: number; downloaded: Uint8Array[] } = { sourceReads: 0, downloaded: [] }
  const handler = createApplication("/sucafina", {
    authenticate: async () => ({ id: "actor", canWrite: true, roles: [{ surface: "dashboard", role: "admin" }] }),
    persistence: storage.persistence,
    environment: async () => ({ at: "2026-11-20T12:00:00Z", id: () => "id", directory: [] }),
    domains: { dashboard: [], planner: [], procurement: [] },
    maxJsonBytes: 100000,
  })
  const transport: SfTransport = {
    async execute(operation, input, options) {
      expect(operation.operationId).toBe("files.export.members")
      const observedInput: unknown = Schema.decodeUnknownSync(Schema.toType(operation.input))(input)
      expect(observedInput).toEqual({ surface: "dashboard" })
      observed.sourceReads++
      const response = await handler(new Request("https://sf.example/sucafina/dashboard?download=members", { signal: options.signal }))
      if (!response) throw new Error("Original Members producer unavailable")
      expect(response.status).toBe(200)
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (authority.revokeAfterProducer) authority.current = false
      return { kind: "response", status: response.status,
        headers: Object.fromEntries(response.headers), body: Schema.decodeUnknownSync(Schema.toType(operation.output))(bytes) }
    },
  }
  return { storage, authority, observed, transport }
}

test("native Members download withholds original workbook bytes when the owner changes before egress", async () => {
  const f = fixture()
  const controller = new AbortController()
  const downloadResponse = async (response: Response, filename: string) => {
    expect(filename).toMatch(/\.xlsx$/)
    f.observed.downloaded.push(new Uint8Array(await response.arrayBuffer()))
  }
  await downloadTalentMembers({ transport: f.transport, signal: controller.signal,
    current: () => f.authority.current, downloadResponse })
  expect(f.observed.sourceReads).toBe(1)
  expect(f.observed.downloaded).toHaveLength(1)
  const original = await parseWorkbook(f.observed.downloaded[0]!)
  expect(original.ok).toBe(true)
  if (!original.ok) throw new Error("Original workbook could not be parsed")
  expect(Object.keys(original.sheets)).toEqual(["All Members", "Summary by Leader"])
  expect(original.sheets["All Members"]).toHaveLength(1)
  expect(original.sheets["All Members"]![0]).toMatchObject({ Name: "Exported fixture member", Status: "Active" })
  const persisted = structuredClone(f.storage.state.dashboard)
  // The original export audits each authorized member read before producing
  // bytes. Egress revocation must preserve that real audit, not suppress it.
  const memberRead = {
    who: "actor", name: undefined, at: "2026-11-20T12:00:00Z",
    record: "members:member-1", was: null, became: { read: true, member: "member-1" },
  }
  expect(persisted.audit).toEqual([memberRead])
  f.authority.revokeAfterProducer = true
  await downloadTalentMembers({ transport: f.transport, signal: controller.signal,
    current: () => f.authority.current, downloadResponse })
  expect(f.observed.sourceReads).toBe(2)
  expect(f.observed.downloaded).toHaveLength(1)
  expect(f.storage.state.dashboard).toEqual({
    ...persisted, audit: [...persisted.audit, memberRead],
  })
})

test("native Members download terminates an unfinished platform stream after owner revocation", async () => {
  const f = fixture()
  let chunks = 0
  const transfer = downloadTalentMembers({
    transport: f.transport, signal: new AbortController().signal, current: () => f.authority.current,
    downloadResponse: async (response) => {
      const reader = response.body!.getReader()
      const first = await reader.read()
      expect(first.done).toBe(false)
      expect(first.value!.byteLength).toBeGreaterThan(0)
      chunks++
      f.authority.current = false
      await reader.read()
      throw new Error("Revoked export stream was incorrectly completed")
    },
  })
  await expect(transfer).rejects.toThrow("Talent export owner changed")
  expect(chunks).toBe(1)
  expect(f.observed.sourceReads).toBe(1)
  expect(f.observed.downloaded).toEqual([])
})
