import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { Workbook } from "exceljs"
import { rows } from "../../../../runtime/contract.ts"
import { publicSfData } from "../../../../product/integration/public-state.ts"
import { createImportHttpFixture } from "./http-fixture.ts"

const month = { start: "2026-11-01", end: "2026-11-30" }
const metric = "Support|Incidents|Open"

// Real default CLI service, local credentials, workbook bytes, scoped sources and SQLite/C08.
// The common fixture's scanner is synthetic and is not qualified by this test.
for (const label of ["Members", "Projects", "Operations"] as const) {
  test(`Dashboard ${label}: real HTTP workbook preview, stale refusal, explicit Apply and faithful retry`, async () => {
    const app = await createImportHttpFixture("dashboard")
    try {
      await app.store.transaction("dashboard", async (snapshot) => {
        Object.assign(snapshot.data, {
          leaders: [],
          members: [{ id: "m1", name: "Ana", title: "Old", type: "Employee", status: "Active", cls: "", outlook: "" }],
          projects: [{ id: "p1", name: "ERP", status: "Planning", risk: "Low", budget: 10, milestones: [], preserved: true }],
          opsCats: ["Support"], opsHmItems: [],
          opsTickets: [{ id: "2026-11", year: 2026, month: 11, [metric]: 9 }, { id: "2026-12", year: 2026, month: 12, keep: 3 }],
          opsSLA: [{ id: "2026-11", year: 2026, month: 11, avail: 98 }],
          opsHeatmap: [{ id: "heatmap", year: 2026, month: 11, item: "Existing", p1: 2 }],
          risks: [{ id: "risk-1", name: "Unrelated" }],
        })
        snapshot.versions["members:m1"] = { version: 0, by: app.principal.id }
        snapshot.versions["projects:p1"] = { version: 0, by: app.principal.id }
        snapshot.versions["ops:2026-11"] = { version: 0, by: app.principal.id }
        return { commit: true, value: undefined }
      })
      const page = await app.call("imports")
      expect(page.status).toBe(200)
      const html = await page.text()
      expect(html).toContain("Replace existing members or projects")
      expect(html).not.toContain("Create a new Planner version")
      const workbook = new Workbook()
      const sheet = label === "Members" ? "All Members" : label === "Projects" ? "Projects Import" : "Ticket Register"
      const table = workbook.addWorksheet(sheet)
      if (label === "Members") {
        table.addRow(["Name", "Title", "Type", "Status"])
        table.addRow(["Ana", "New", "Employee", "Active"])
      } else if (label === "Projects") {
        table.addRow(["Name", "Budget (USD)", "Status"])
        table.addRow(["ERP", 15, "Planning"])
      } else {
        table.addRow(["Year", 2026])
        table.addRow(["Category", "Metric", "Jun", "", "Jul", "", "Aug", "", "Sep", "", "Oct", "", "Nov", ""])
        table.addRow(["Support", "Open", 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 0, 7])
      }
      const bytes = new Uint8Array(await workbook.xlsx.writeBuffer())
      const prepare = async () => {
        const choice = (await app.discover(month)).find((entry) => entry.label === label)
        expect(choice).toBeDefined()
        if (!choice) throw new Error(`${label} destination missing`)
        expect(choice.sheet).toBe(sheet)
        if (label === "Operations") expect(choice.period).toEqual(month)
        return app.admit(choice, bytes, { newVersion: false, removeMissing: false, preview: { sheet, ...(label === "Members" ? { replace: true } : label === "Projects" ? { replace: false } : {}) } })
      }
      const selection = await prepare()
      const before = await app.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: { ...structuredClone(snapshot), data: publicSfData(snapshot.data) } }))
      const preview = await app.preview(selection)
      expect(preview).toMatchObject({ state: "preview", domainApplied: false, receipts: [] })
      expect(await app.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: { ...snapshot, data: publicSfData(snapshot.data) } }))).toEqual(before)
      const detail = await app.detail(preview)
      expect(detail.receipt).toBeUndefined()
      expect(detail.detail.changes.some((entry) => entry.kind === "changed" || entry.kind === "added")).toBe(true)
      expect(detail.detail.changes.some((entry) => entry.source.kind === "file" && entry.source.sheet === sheet)).toBe(true)
      await app.store.transaction("dashboard", async (snapshot) => {
        if (label === "Members") rows(snapshot.data.members)[0]!.title = "Concurrent title"
        else if (label === "Projects") rows(snapshot.data.projects)[0]!.budget = 11
        else rows(snapshot.data.opsTickets)[0]![metric] = 8
        return { commit: true, value: undefined }
      })
      const concurrent = await app.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
      expect((await app.call("import-apply", { manifestId: preview.id, version: preview.version })).status).not.toBe(200)
      expect(await app.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(concurrent)
      const fresh = await app.preview(await prepare())
      const applyKey = randomUUID()
      const applied = await app.apply(fresh, applyKey)
      expect(applied).toMatchObject({ state: "applied", domainApplied: true })
      const after = await app.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
      if (label === "Members") {
        expect(rows(after.data.members)).toHaveLength(1)
        expect(rows(after.data.members)[0]).toMatchObject({ name: "Ana", title: "New", status: "Active" })
        expect(after.data.projects).toEqual(concurrent.data.projects)
        const approved = (await app.detail(fresh)).detail.changes.find((entry) => entry.kind === "added" && entry.path.endsWith("/name"))
        expect(approved?.path).toContain(`@id=${String(rows(after.data.members)[0]!.id)}`)
      } else if (label === "Projects") {
        expect(rows(after.data.projects)).toHaveLength(1)
        expect(rows(after.data.projects)[0]).toMatchObject({ id: "p1", name: "ERP", budget: 15, preserved: true, milestones: [] })
        expect(after.data.members).toEqual(concurrent.data.members)
      } else {
        expect(rows(after.data.opsTickets).find((entry) => entry.id === "2026-11")).toMatchObject({ year: 2026, month: 11, [metric]: 0, "Support|Service Requests|Open": 7 })
        expect(rows(after.data.opsTickets).find((entry) => entry.id === "2026-12")).toEqual({ id: "2026-12", year: 2026, month: 12, keep: 3 })
        expect(after.data.opsSLA).toEqual(concurrent.data.opsSLA)
        expect(after.data.opsHeatmap).toEqual(concurrent.data.opsHeatmap)
        expect(after.data.opsCats).toEqual(["Support"])
      }
      expect(after.data.risks).toEqual(concurrent.data.risks)
      const receipt = await app.detail(fresh)
      expect(receipt.receipt).toMatchObject({ outcome: "applied", manifestId: fresh.id })
      expect(receipt.receipt!.changedFields).toBeGreaterThan(0)
      expect(await app.apply(fresh, applyKey)).toEqual(applied)
      expect((await app.detail(fresh)).receipt).toEqual(receipt.receipt)
      expect(await app.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(after)
    } finally { await app.dispose() }
  }, 90_000)
}
