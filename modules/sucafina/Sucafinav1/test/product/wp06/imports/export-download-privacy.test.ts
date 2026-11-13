import { expect, test } from "bun:test"
import { download } from "../../../../runtime/downloads.ts"
import type { Snapshot } from "../../../../runtime/contract.ts"

test("the real Planner download entrypoint omits salary fields, individual cost and rate cards for a viewer", async () => {
  const snapshot: Snapshot = {
    data: {
      curId: "v1",
      app: { currency: "EUR", entities: [], allocations: [] },
      versions: [{
        id: "v1",
        name: "Privacy proof",
        year: 2026,
        closed: 2,
        created: "2026-01-01",
        lines: [],
        projects: [],
        hc: {
          inc: 10,
          incMonth: 7,
          positions: [{ id: "position", name: "Example person", title: "Analyst", include: true, domain: "Example", location: "Example", type: "Employee", fte: 1, start: 1, end: 12, rateId: "rate", rateOverride: 123456.78 }],
          rates: [{ id: "rate", name: "PRIVATE_RATE_LABEL", locs: "Example", annual: 987654.32, cur: "EUR" }],
          hrAF: {},
        },
        fx: [{ cur: "EUR", rate: 1.2 }],
      }],
    },
    versions: {},
    sequences: {},
    audit: [],
    notices: [],
  }
  const result = await download("xlsx", snapshot, { id: "viewer", roles: ["viewer"], canWrite: false, assigned: [], domains: [] }, { at: "2026-11-13T00:00:00Z", id: () => "id", directory: [] }, new URLSearchParams())

  expect(result.ok).toBe(true)
  if (!result.ok) return
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  await workbook.xlsx.load(new Uint8Array(result.bytes).buffer)
  expect(workbook.getWorksheet("Rate cards")!.rowCount).toBe(1)
  expect(workbook.getWorksheet("Headcount")!.getCell("H2").value).toBeNull()
  expect(workbook.getWorksheet("Headcount")!.getCell("L2").value).toBeNull()
  expect(workbook.getWorksheet("Headcount")!.getCell("M2").value).toBeNull()

  const { default: JSZip } = await import("jszip")
  const archive = await JSZip.loadAsync(result.bytes)
  const xml = (await Promise.all(Object.values(archive.files).filter((file) => !file.dir).map((file) => file.async("string")))).join("\n")
  expect(xml).not.toContain("PRIVATE_RATE_LABEL")
  expect(xml).not.toContain("987654.32")
  expect(xml).not.toContain("123456.78")
  expect(xml).not.toContain("155555.58")
})
