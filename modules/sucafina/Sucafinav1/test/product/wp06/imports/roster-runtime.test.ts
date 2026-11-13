import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { Workbook } from "exceljs"
import { createWp06Runtime } from "../runtime-fixture.ts"
import { createSfImportServices } from "../../../../../../../apps/cli/src/sucafina-product/import-services.ts"
import { createSfImportHttp } from "../../../../product/interface/import-http.ts"

/** Uses the CLI default roster composition, persisted credentials and real HTTP/SQLite ports. */
test("default CLI roster composition preserves ignored sheets, rejects an ABA roster and applies a fresh preview to a locked version", async () => {
  const app = await createWp06Runtime()
  try {
    await app.store.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [{ id: "v1", name: "FY27", year: 2027, closed: 0, locked: false,
        lines: [], projects: [], fx: [], hc: { positions: [], rates: [], hrAF: {} }, lists: {} }]
      snapshot.data.officials = {}; snapshot.data.entities = []; snapshot.data.allocations = []; snapshot.data.roster = []
      return { commit: true, value: undefined }
    })
    const service = createSfImportServices({ runtime: app.runtime, authority: app.authority })
    if (!service) throw new Error("Import service not composed")
    const http = createSfImportHttp({ origin: app.origin, mount: "/sucafina", runtime: () => ({ ui: app.authority.ui, human: app.authority.human, service }) })
    const call = async (mode: string, payload?: unknown, query: Record<string, string> = {}) => {
      const url = new URL(`${app.origin}/sucafina/planner`)
      url.searchParams.set("sf", mode)
      Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value))
      const response = await http(new Request(url, payload === undefined ? { headers: { cookie: app.cookie } } : {
        method: "POST", headers: { cookie: app.cookie, origin: app.origin, "Idempotency-Key": randomUUID(), ...(payload instanceof FormData ? {} : { "Content-Type": "application/json" }) },
        body: payload instanceof FormData ? payload : JSON.stringify(payload),
      }), "planner")
      if (!response) throw new Error("Import route missing")
      return response
    }
    const workbook = new Workbook(); const members = workbook.addWorksheet("All Members")
    members.addRow(["Name", "Title", "Type", "Leader", "Location", "Start Date", "End Date", "Status", "Classification", "Outlook", "Notes"])
    members.addRow(["Roster person", "Analyst", "Employee", "Lead", "Geneva", "2027-01-01", "", "Active", "ignore", "ignore", "ignore"])
    const summary = workbook.addWorksheet("Summary by Leader")
    summary.addRow(["Leader", "Count"]); summary.addRow(["Lead", 1])
    const prepare = async () => {
      const choices = await call("import-targets", undefined, { surface: "planner" }).then((response) => response.json())
      const target = choices.value.find((entry: { label: string }) => entry.label === "FY27")
      expect(target).toBeDefined()
      const form = new FormData()
      form.set("file", new File([new Uint8Array(await workbook.xlsx.writeBuffer())], "members.xlsx"))
      form.set("surface", "planner"); form.set("selectionRef", target.selectionRef)
      form.set("options", JSON.stringify({ newVersion: false, removeMissing: false, preview: {} }))
      const admitted = await call("import-admit", form).then((response) => response.json())
      expect(admitted.status).toBe("ok")
      const preview = await call("import-preview", { admittedFileRef: admitted.value.ref, format: "xlsx", options: {} }).then((response) => response.json())
      expect(preview.status).toBe("ok")
      expect(preview.value.baseIdentity.map((source: { type: string }) => source.type)).toEqual(["planner-version", "planner-roster"])
      return preview.value as { id: string; version: number }
    }
    const preview = await prepare()
    const detail = await call("import-detail", undefined, { manifestId: preview.id, version: String(preview.version) }).then((response) => response.json())
    const ignored = detail.value.detail.changes.filter((entry: { kind: string }) => entry.kind === "ignored") as { source: { sheet?: string; field?: string } }[]
    expect(ignored.some((entry) => entry.source.sheet === "All Members" && entry.source.field === "Classification")).toBe(true)
    expect(ignored.some((entry) => entry.source.sheet === "Summary by Leader")).toBe(true)
    await app.store.transaction("planner", async (snapshot) => { snapshot.data.roster = [{ name: "Concurrent" }]; return { commit: true, value: undefined } })
    await app.store.transaction("planner", async (snapshot) => { snapshot.data.roster = []; return { commit: true, value: undefined } })
    expect((await call("import-apply", { manifestId: preview.id, version: preview.version })).status).not.toBe(200)
    expect(await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot.data.roster }))).toEqual([])
    const fresh = await prepare()
    expect((await call("import-apply", { manifestId: fresh.id, version: fresh.version })).status).toBe(200)
    expect(await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot.data.roster }))).toEqual([
      { name: "Roster person", title: "Analyst", type: "Employee", leader: "Lead", location: "Geneva", start: "2027-01-01", end: "", status: "Active" },
    ])
    const positions = await app.store.transaction("planner", async (snapshot) => {
      const version = (snapshot.data.versions as { locked: boolean; hc: { positions: unknown[] } }[])[0]!
      version.locked = true
      return { commit: true, value: structuredClone(version.hc.positions) }
    })
    members.getCell("A2").value = "Updated person"
    const locked = await prepare()
    expect((await call("import-apply", { manifestId: locked.id, version: locked.version })).status).toBe(200)
    const after = await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: {
      roster: snapshot.data.roster, positions: (snapshot.data.versions as { hc: { positions: unknown[] } }[])[0]!.hc.positions,
    } }))
    expect(after.roster).toMatchObject([{ name: "Updated person" }])
    expect(after.positions).toEqual(positions)
  } finally { await app.dispose() }
}, 30_000)
