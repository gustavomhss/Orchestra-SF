import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { Workbook } from "exceljs"
import { roleMap } from "../../../../runtime/admin.ts"
import { object, rows } from "../../../../runtime/contract.ts"
import { exportPlanner } from "../../../../runtime/workbooks.ts"
import { projectPlannerSource } from "../../../../product/planner/port.ts"
import { createImportHttpFixture } from "./http-fixture.ts"

test("rich Planner XLSX export survives real HTTP preview, Apply and retry with stable financial identities", async () => {
  const app = await createImportHttpFixture("planner")
  try {
    const nullable = () => [0, ...Array(11).fill(null)]
    await app.store.transaction("planner", async (snapshot) => {
      const line = (id: string, sec: string, el: string, cur: string, amount: number) => ({
        id, sec, el, name: id, desc: "", cur, proj: sec === "capex" ? "project" : "", owner: "", entity: "", alloc: "",
        annual: amount * 12, b: Array(12).fill(amount), bm: Array(12).fill(false), a: nullable(), f: nullable(),
      })
      snapshot.data.versions = [{ id: "v1", name: "Rich FY27", year: 2027, closed: 0, locked: false,
        lines: [line("opex", "opex", "licenses", "EUR", 100), { ...line("capex", "capex", "services", "USD", 50), cls: "capex" }],
        projects: [{ id: "project", name: "Existing project", code: "CPX-2027-0001", owner: "" }],
        fx: [{ id: "EUR", cur: "EUR", rate: 1.1 }],
        hc: { positions: [{ id: "position", name: "Synthetic person", title: "Analyst", include: true, domain: "Team", location: "Geneva", type: "Employee", fte: 1, start: 1, end: 12, rateId: "rate", rateOverride: null, src: "manual", domainManual: true }],
          rates: [{ id: "rate", name: "Employee", locs: "Geneva", annual: 120000, cur: "EUR" }],
          hrAF: { Team: { a: nullable(), f: nullable(), owner: "", entity: "", alloc: "" } }, inc: 0, incMonth: 1 }, lists: {} }]
      snapshot.data.officials = {}; snapshot.data.entities = []; snapshot.data.allocations = []; snapshot.data.roster = []
      snapshot.sequences.cpx = 1
      return { commit: true, value: undefined }
    })
    const read = () => app.store.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const before = await read()
    const principal = await app.runtime.authenticate(app.request("planner"), { surface: "planner", roleMap: roleMap(before, "planner") })
    if (!principal) throw new Error("Signed Planner principal missing")
    const actor = { id: principal.id, roles: principal.roles.filter((role) => role.surface === "planner").map((role) => role.role), canWrite: principal.canWrite, assigned: [], domains: [] }
    const financeBefore = projectPlannerSource(before, actor, "v1")
    if (!financeBefore) throw new Error("Planner projection missing")
    const file = await exportPlanner(before, actor, await app.runtime.environment(), "v1")
    if (!file.ok) throw new Error("Planner export rejected")
    const workbook = new Workbook()
    await workbook.xlsx.load(new Uint8Array(file.bytes).buffer)
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Info", "OPEX", "CAPEX", "Headcount", "Rate cards", "FX rates"])
    expect(workbook.getWorksheet("Info")!.getCell("B3").value).toBe("v1")
    expect(workbook.getWorksheet("CAPEX")!.getCell("A2").value).toBe("capex")
    expect(workbook.getWorksheet("Headcount")!.getCell("A2").value).toBe("position")
    expect(workbook.getWorksheet("Rate cards")!.getCell("A2").value).toBe("rate")
    expect(workbook.getWorksheet("FX rates")!.getCell("A2").value).toBe("EUR")
    const target = (await app.discover()).find((choice) => choice.label === "Rich FY27")
    if (!target) throw new Error("Export destination missing")
    const selection = await app.admit(target, file.bytes, { newVersion: false, removeMissing: false, preview: {} })
    // Discovery registers the scoped source identity. Preview/Apply are compared
    // against the admitted state, while financial parity uses the original export.
    const admitted = await read()
    const preview = await app.preview(selection)
    const detail = await app.detail(preview)
    expect(detail.receipt).toBeUndefined()
    expect(await read()).toEqual(admitted)
    const impact = preview.commands[0]!.preview
    expect(impact.values.find((value) => value.id === "after:opex:1:forecast")).toMatchObject({ value: 0, currency: "EUR" })
    expect(impact.values.find((value) => value.id === "after:opex:2:forecast")).toMatchObject({ value: null, evidenceState: "absent" })
    expect(impact.values.find((value) => value.id === "after:fx:EUR")).toMatchObject({ value: 1.1, unit: "USD/EUR" })
    const fte = impact.values.filter((value) => value.unit === "fte")
    expect(fte).toHaveLength(24)
    expect(fte.every((value) => value.value === 1)).toBe(true)
    const key = randomUUID()
    const applied = await app.apply(preview, key)
    expect(applied).toMatchObject({ state: "applied", domainApplied: true })
    const after = await read()
    const version = rows(after.data.versions)[0]!
    expect(rows(version.lines).map((line) => line.id)).toEqual(["opex", "capex"])
    expect(rows(version.projects).map((project) => project.id)).toEqual(["project"])
    expect(rows(object(version.hc).positions).map((position) => position.id)).toEqual(["position"])
    expect(rows(object(version.hc).rates).map((rate) => rate.id)).toEqual(["rate"])
    expect(projectPlannerSource(after, actor, "v1")).toEqual(financeBefore)
    expect(after).toEqual(admitted)
    const receipt = (await app.detail(preview)).receipt
    expect(receipt).toMatchObject({ outcome: "unchanged", changedFields: 0, manifestId: preview.id })
    expect(await app.apply(preview, key)).toEqual(applied)
    expect((await app.detail(preview)).receipt).toEqual(receipt)
    expect(await read()).toEqual(after)
  } finally { await app.dispose() }
}, 90_000)
