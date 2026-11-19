import { expect, test } from "bun:test"
import { Schema } from "effect"
import { SfPlanner } from "@orchestra/schema/sucafina/planner"
import { DASHBOARD_PAGES, PLANNER_TABS, PROCUREMENT_NAV } from "../src/nav.ts"
import { localNative } from "./fixture/local-native.ts"

// The original HTML editor producer is retired. Its metric/sidebar/details
// geometry is not a native chapter contract; see HANDOFF-finish-layout-20261119.
test("retired editor URLs stay unavailable while the authenticated native Planner preserves its real record", async () => {
  const native = await localNative()
  try {
    for (const [surface, pages, count] of [
      ["dashboard", DASHBOARD_PAGES, 16],
      ["planner", PLANNER_TABS, 7],
      ["procurement", PROCUREMENT_NAV, 5],
    ] as const) {
      expect(pages).toHaveLength(count)
      expect(new Set(pages).size).toBe(count)
      const paths = [`/sucafina/${surface}`, ...pages.map((page) => `/sucafina/${surface}?page=${encodeURIComponent(page)}`)]
      expect(new Set(paths).size).toBe(count + 1)
      for (const pathname of paths) {
        const response = await native.read(pathname)
        expect(response?.status, pathname).toBe(404)
        expect(response?.headers.get("content-type")).toBe("text/plain; charset=utf-8")
        expect(await response!.text()).toBe("legacy console decommissioned — use /")
      }
    }

    const initial = await native.read("/sucafina/api/ui/pages/CAP23")
    expect(initial?.status).toBe(200)
    expect(initial?.headers.get("content-type")).toContain("application/json")
    const before = Schema.decodeUnknownSync(Schema.toType(SfPlanner.operations["domain.page.CAP23"].output))(await initial!.json())
    if (before.status !== "ok") throw new Error("The original Planner collection is unavailable")
    expect(before.value.data.versions).toEqual([])
    const version = before.value.versions["versions:first"]?.version ?? 0
    expect(Number.isSafeInteger(version) && version >= 0).toBe(true)

    const saved = await native.post("/sucafina/planner?page=Versions", {
      page: "Versions", action: "save", version, values: {}, confirmed: true,
    })
    expect(saved?.status).toBe(200)
    expect(await saved!.json()).toMatchObject({ ok: true })
    const current = await native.read("/sucafina/api/ui/pages/CAP23")
    expect(current?.status).toBe(200)
    const after = Schema.decodeUnknownSync(Schema.toType(SfPlanner.operations["domain.page.CAP23"].output))(await current!.json())
    if (after.status !== "ok") throw new Error("The committed Planner record is unavailable")
    expect(after.value.data.versions).toHaveLength(1)
    const record = after.value.data.versions[0]!
    expect(record.id).toMatch(/\S+/)
    expect(record.name).toMatch(/\S+/)
    expect(Number.isInteger(record.year) && record.year > 2000 && record.year < 2100).toBe(true)

    const reopened = await native.read("/sucafina/api/ui/pages/CAP23")
    expect(reopened?.status).toBe(200)
    const reread = Schema.decodeUnknownSync(Schema.toType(SfPlanner.operations["domain.page.CAP23"].output))(await reopened!.json())
    if (reread.status !== "ok") throw new Error("The original Planner reread is unavailable")
    expect(reread.value.data.versions).toEqual([record])
  } finally {
    await native.dispose()
  }
}, 60000)
