import { expect, test } from "bun:test"
import JSZip from "jszip"
import { SaxesParser } from "saxes"
import { render } from "../runtime/dashboard-operations.ts"
import { createReport } from "../runtime/reports.ts"
import { empty } from "./fixture/persistence.ts"

const actor = { id: "security-admin", canWrite: true, roles: ["admin"] }
const at = "2026-11-13T12:00:00Z"
const environment = { at, id: () => "unused", directory: [] }

function securityPage(secKpi: Record<string, unknown>[], month: number) {
  return render(
    "IT Security KPIs",
    { secKpi },
    { actor, year: 2026, month, at, versions: {} },
  )!
}

function metricTile(html: string, key: string) {
  const tile = [...html.matchAll(/<div class="metric-tile">([\s\S]*?)<\/div>/g)]
    .map((match) => match[1] ?? "")
    .find((markup) => markup.includes(`<span>${key}</span>`))
  expect(tile, `missing KPI metric tile ${key}`).toBeDefined()
  return {
    value: tile?.match(/<strong>([\s\S]*?)<\/strong>/)?.[1],
    status: tile?.match(/<p>([\s\S]*?)<\/p>/)?.[1],
  }
}

test("security KPI tiles carry each field independently through the selected month, including zero", () => {
  const html = securityPage([
    { year: 2026, month: 1, training: 0, patch: "91", patchEndpoint: "80", patchServer: "70", scan: "" },
    { year: 2026, month: 2, training: "", patch: "", patchEndpoint: "94", patchServer: "", scan: "96" },
    { year: 2026, month: 3, training: "Infinity", patch: "94", patchEndpoint: "bad", patchServer: "93", scan: "abc" },
    { year: 2026, month: 4, training: 99, patch: 99, patchEndpoint: 99, patchServer: 99, scan: 99 },
    { year: 2025, month: 3, training: 77, patch: 77, scan: 77 },
  ], 3)

  expect(metricTile(html, "training")).toEqual({ value: "0", status: "High risk" })
  expect(metricTile(html, "patch")).toEqual({ value: "94", status: "Moderate" })
  expect(metricTile(html, "patchEndpoint")).toEqual({ value: "94", status: "Moderate" })
  expect(metricTile(html, "patchServer")).toEqual({ value: "93", status: "Moderate" })
  expect(metricTile(html, "scan")).toEqual({ value: "96", status: "Good" })
})

test("period matching rejects invalid month/year variants without hiding an earlier valid value", () => {
  const html = securityPage([
    { year: 2026, month: 2, training: 81 },
    { year: 2025, month: 12, training: 95 },
    { year: "2026", month: 3, training: 97 },
    { year: 2026, month: null, training: 98 },
    { year: 2026, month: 3.5, training: 99 },
    { year: 2026, month: "3", training: 100 },
    { year: 2026, month: "bad", training: 100 },
    { year: 2026, month: 0, training: 100 },
    { year: 2026, month: 13, training: 100 },
    { year: 2026, month: 5, training: 100 },
    { year: 2026, month: 3, training: " " },
  ], 3)

  expect(metricTile(html, "training")).toEqual({ value: "81", status: "Moderate" })
})

test("assessment and SOC Pending carry independently past later blanks and invalid values", () => {
  const html = securityPage(
    [
      { year: 2026, month: 1, assessment: "72", socPending: "4" },
      { year: 2026, month: 2, training: "95", assessment: "", socPending: "5" },
      { year: 2026, month: 3, assessment: "not numeric", scan: "84", socPending: null },
    ],
    3,
  )

  expect(metricTile(html, "training")).toEqual({ value: "95", status: "Good" })
  expect(metricTile(html, "assessment")).toEqual({ value: "72", status: "Moderate" })
  expect(metricTile(html, "scan")).toEqual({ value: "84", status: "High risk" })
  expect(metricTile(html, "socPending")).toEqual({ value: "5", status: "Moderate" })
  expect(metricTile(securityPage([{ year: 2026, month: 3, socPending: 0 }], 3), "socPending"))
    .toEqual({ value: "0", status: "Good" })
})

test("SOC Closure prefers the existing severity derivation and uses manual value only when total severity is zero", () => {
  const html = securityPage(
    [
      { year: 2026, month: 1, socCritical: 4, socHigh: 6, socPending: 2, socClosure: 99 },
      { year: 2026, month: 2, socCritical: 0, socHigh: 0, socMedium: 0, socLow: 0, socClosure: 97 },
    ],
    2,
  )
  const derived = securityPage(
    [{ year: 2026, month: 1, socCritical: 1, socHigh: 2, socPending: 1, socClosure: 99 }],
    1,
  )
  const carried = securityPage(
    [
      { year: 2026, month: 1, socCritical: 1, socHigh: 2, socPending: 1, socClosure: 99 },
      { year: 2026, month: 2, socClosure: "not numeric" },
    ],
    2,
  )

  expect(metricTile(derived, "socClosure")).toEqual({ value: "66.7", status: "High risk" })
  expect(metricTile(carried, "socClosure")).toEqual({ value: "66.7", status: "High risk" })
  expect(metricTile(html, "socClosure")).toEqual({ value: "97", status: "Moderate" })
  expect(metricTile(securityPage([{ year: 2026, month: 1, socClosure: "" }], 1), "socClosure"))
    .toEqual({ value: "No data", status: "No data" })
})

test("selected-month KPI editor and raw monthly table do not inherit carried tile values", () => {
  const html = securityPage(
    [
      { year: 2026, month: 2, training: 88, patch: 96 },
      { year: 2026, month: 3, training: "", patch: 0 },
    ],
    3,
  )

  expect(metricTile(html, "training")).toEqual({ value: "88", status: "Moderate" })
  expect(metricTile(html, "patch")).toEqual({ value: "0", status: "High risk" })
  expect(html).toContain('name="training" type="number" value=""')
  expect(html).toContain("<tr><td>3</td><td>No data</td><td>0</td>")
})

test("blank, whitespace, nonnumeric, nonfinite, and absent KPI values never become carried values", () => {
  const html = securityPage(
    [
      { year: 2026, month: 1, training: " " },
      { year: 2026, month: 2, training: "not numeric" },
      { year: 2026, month: 3, training: Number.POSITIVE_INFINITY },
      { year: 2026, month: 4, training: null },
      { year: 2026, month: 5 },
    ],
    5,
  )

  expect(metricTile(html, "training")).toEqual({ value: "No data", status: "No data" })
})

test("whitespace-only manual SOC Closure is unavailable and falls back to earlier real closure", () => {
  const html = securityPage(
    [
      { year: 2026, month: 1, socClosure: 73 },
      { year: 2026, month: 2, socClosure: " " },
    ],
    3,
  )

  expect(metricTile(html, "socClosure")).toEqual({ value: "73", status: "High risk" })
})

test("manual SOC Closure zero supersedes an earlier nonzero closure", () => {
  const html = securityPage(
    [
      { year: 2026, month: 1, socClosure: 97 },
      { year: 2026, month: 2, socCritical: 0, socHigh: 0, socMedium: 0, socLow: 0, socClosure: 0 },
    ],
    2,
  )

  expect(metricTile(html, "socClosure")).toEqual({ value: "0", status: "High risk" })
})

test("invalid stored month 13 is excluded even when render context month is 15", () => {
  const html = securityPage(
    [
      { year: 2026, month: 12, training: 84 },
      { year: 2026, month: 13, training: 99 },
    ],
    15,
  )

  expect(metricTile(html, "training")).toEqual({ value: "84", status: "Moderate" })
})

test("IT Security report retains raw last-stored-month values instead of KPI tile carry-forward", async () => {
  const snapshot = empty()
  snapshot.data.secKpi = [
    { year: 2026, month: 2, training: 96, patch: 92, scan: 91, assessment: 85 },
    { year: 2026, month: 11, training: null, patch: 88, scan: "", assessment: 72 },
    { year: 2027, month: 12, training: 99, patch: 99, scan: 99, assessment: 99 },
  ]
  const result = await createReport(snapshot, actor, environment, {
    format: "docx",
    year: 2026,
    topics: ["IT Security KPIs"],
  })
  if (!result.ok) throw new Error("IT Security report refused")

  const archive = await JSZip.loadAsync(result.bytes)
  const document = await archive.file("word/document.xml")!.async("string")
  const parser = new SaxesParser({ xmlns: false })
  const parts: string[] = []
  parser.on("text", (part) => parts.push(part))
  parser.write(document).close()
  const reportText = parts.join(" ")

  expect(reportText).toContain("November")
  expect(reportText).toContain("Awareness Training: —")
  expect(reportText).toContain("Patch Compliance: 88%")
  expect(reportText).toContain("Scan Coverage: —")
  expect(reportText).not.toContain("96%")
  expect(reportText).not.toContain("92%")
})
