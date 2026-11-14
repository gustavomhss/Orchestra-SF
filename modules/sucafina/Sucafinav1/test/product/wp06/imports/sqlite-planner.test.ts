import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { Workbook } from "exceljs"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { parseWorkbook } from "../../../../runtime/workbooks.ts"
import { createSfSourcePersistence, sfSourceIdentity } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createPlannerImportMutation, preparePlannerWorkbook } from "../../../../product/imports/planner.ts"

test("SQLite Planner imports workbook bytes and rejects a stale preview without partial writes", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-import-sqlite-"))
  const driver = await openLocalStore(directory)
  const store = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID })
  const actor = { id: "finance", roles: ["finance"], canWrite: true }
  const environment = { at: "2026-11-13T00:00:00Z", id: randomUUID, directory: [] }
  try {
    await store.initializeSources("planner")
    await store.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [{ id: "v1", year: 2027, closed: 0, locked: false, lines: [{ id: "42", sec: "opex", el: "licenses", name: "Licences", cur: "USD", b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(null) }], projects: [], fx: [], hc: { positions: [], rates: [], hrAF: {} }, lists: {} }]
      snapshot.data.officials = {}
      snapshot.data.entities = []
      snapshot.data.allocations = []
      return { commit: true, value: undefined }
    })
    const workbook = new Workbook()
    const sheet = workbook.addWorksheet("OPEX")
    sheet.addRow(["Line ID", "Cost element", "Vendor / item", "Currency", "Measure", "Jan"])
    sheet.addRow(["42", "Licenses", "Licences", "USD", "Forecast", 0])
    const parsed = await parseWorkbook(new Uint8Array(await workbook.xlsx.writeBuffer()))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const source = await store.transaction("planner", async (snapshot) => ({ commit: false, value: { snapshot: structuredClone(snapshot), identity: sfSourceIdentity(snapshot, "planner-version", "v1") } }))
    if (!source.identity) throw new Error("missing Planner source")
    const prepared = preparePlannerWorkbook({ snapshot: source.snapshot, actor, environment, versionId: "v1", sheets: parsed.sheets, newVersion: false, removeMissing: false, operationId: "operation-1", idempotencyKey: "key-1", targetIncarnation: source.identity.incarnation })
    expect(prepared.result.ok).toBe(true)
    const mutation = createPlannerImportMutation({ command: prepared.command, commandDigest: prepared.commandDigest, previewDigest: prepared.previewDigest, actorId: actor.id, operationId: "operation-1", idempotencyKey: "key-1", targetIncarnation: source.identity.incarnation, previewAt: environment.at, verifyTarget: (snapshot, id, incarnation) => sfSourceIdentity(snapshot, "planner-version", id)?.incarnation === incarnation })
    if (!mutation) throw new Error("missing mutation")
    const applied = await store.transaction<ReturnType<typeof mutation.execute>["value"]>("planner", async (snapshot) => mutation.execute(snapshot, actor, environment))
    expect(applied.status).toBe("applied")
    const stored = await store.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const lines = (stored.data.versions as { lines: { f: (number | null)[] }[] }[])[0]!.lines
    expect(lines[0]!.f[0]).toBe(0)
    const stale = await store.transaction<ReturnType<typeof mutation.execute>["value"]>("planner", async (snapshot) => mutation.execute(snapshot, actor, environment))
    expect(stale.status).toBe("conflict")
    expect(await store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(stored)
  } finally {
    await driver.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
