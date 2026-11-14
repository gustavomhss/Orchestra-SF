import { expect, test } from "bun:test"
import { createSfBiServices } from "../../../../../../../apps/cli/src/sucafina-product/bi-services.ts"
import { sfPlannerBiSelection } from "../../../../../../../apps/cli/src/sucafina-product/bi-selections.ts"
import { createSfExtendedHttp } from "../../../../../../../apps/cli/src/sucafina-product/extended-http.ts"
import { createSfExtendedAssets } from "../../../../../../../apps/cli/src/sucafina-product/extended-assets.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

test("BI HTTP opens each explicitly chosen real Planner origin and rejects absent or outside-row choices", async () => {
  const deadline = compositionTestDeadline("bi-source-choice")
  try {
    const fixture = await financialCompositionFixture({ signal: deadline.signal, beforeEnvironment: async () => deadline.check() })
    deadline.own(() => fixture.dispose())
    const { authority, business, portfolio, persistence } = fixture
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [100, 80, 140].map((amount, index) => ({ id: `origin-${index}`, name: `Real origin ${index}`, year: 2026, closed: 0,
        lines: [{ id: "line", name: "Licensed service", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(amount), a: Array(12).fill(0), f: Array(12).fill(amount) }],
        fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
      return { commit: true, value: undefined }
    })
    await persistence.initializeSources("planner")
    const call = await fixture.read()
    deadline.own(() => authority.ui.finish(call))
    const issued = [await business.plannerProduct.issueSource("origin-0", call),
      await business.plannerProduct.issueSource("origin-1", call), await business.plannerProduct.issueSource("origin-2", call)]
    const sources = issued.map((result) => {
      if (result.status !== "ok") throw new Error(`Real Planner source unavailable: ${result.reason}`)
      return result.value.evidence
    })
    const period = { start: "2026-01-01", end: "2026-01-31" }
    const selectionRef = sfPlannerBiSelection({ baseRef: sources[0]!.refId, candidateRef: sources[1]!.refId, period, currency: "USD" })
    const bi = createSfBiServices({ authority, business, portfolio })
    const projection = await deadline.phase("real.planner-difference", () => bi.source.read({ viewId: "BI02", selectionRef, period }, call))
    if (projection.status !== "ok") throw new Error(`Real BI projection unavailable: ${projection.reason}`)
    const row = projection.value.values.find((value) => !value.drilldown && sources.slice(0, 2).every((ref) => value.sourceRefs.some((source) => source.refDigest === ref.refDigest)))
    if (!row) throw new Error("Actual Planner difference has no row with both original sources")
    expect(new Set(row.sourceRefs.map((ref) => ref.refDigest)).size).toBe(2)
    expect(row.sourceRefs.some((ref) => ref.refDigest === sources[2]!.refDigest)).toBe(false)
    const assets = createSfExtendedAssets()
    deadline.own(() => assets.dispose())
    const http = createSfExtendedHttp({ authority, business, bi, reviews: undefined, persistence, origin: "https://example.test", assets })
    const invoke = (referenceDigest?: string) => {
      const url = new URL("https://example.test/dashboard")
      url.search = new URLSearchParams({ sf: "bi-source", viewId: "BI02", selectionRef, valueId: row.id, start: period.start, end: period.end }).toString()
      if (referenceDigest !== undefined) url.searchParams.set("referenceDigest", referenceDigest)
      return deadline.phase("http.source-choice", () => http(new Request(url, { signal: deadline.signal }), "dashboard"))
    }
    for (const source of sources.slice(0, 2)) {
      const response = await invoke(source.refDigest)
      expect(response?.status).toBe(200)
      const body = await response!.json() as { links: { label: string; url: string }[] }
      expect(body.links).toHaveLength(1)
      expect(new URL(body.links[0]!.url, "https://example.test").searchParams.get("version")).toBe(source.target.recordId)
      expect(body.links[0]!.label).toContain(source.target.recordId)
    }
    const absent = await invoke()
    expect(absent?.status).toBe(409)
    expect(await absent!.json()).toEqual({ status: "needs-input", reason: "bi-source-choice-required" })
    // This source is really readable, but it is not an origin of the selected row.
    expect((await business.context.resolve(sources[2]!, call)).state).toBe("fresh")
    const outside = await invoke(sources[2]!.refDigest)
    expect(outside?.status).toBe(403)
    expect(await outside!.json()).toEqual({ status: "denied", reason: "bi-source-outside-selected-value" })
    const invalid = await invoke("not-a-canonical-digest")
    expect(invalid?.status).toBe(400)
    expect(await invalid!.json()).toEqual({ status: "needs-input", reason: "invalid-source-choice" })
    await persistence.transaction("planner", async (snapshot) => {
      const versions = snapshot.data.versions as { id: string; lines: { b: number[]; f: number[] }[] }[]
      const line = versions.find((version) => version.id === "origin-0")!.lines[0]!
      line.b[0] = 110
      line.f[0] = 110
      return { commit: true, value: undefined }
    })
    const stale = await invoke(sources[0]!.refDigest)
    expect(stale?.status).not.toBe(200)
    expect(await stale!.json()).not.toHaveProperty("links")
  } finally { await deadline.close() }
}, 120_000)
