import { expect, test } from "bun:test"
import JSZip from "jszip"
import { SaxesParser } from "saxes"
import { createReport } from "../runtime/reports.ts"
import { empty } from "./fixture/persistence.ts"

const actor = { id: "admin", canWrite: true, roles: ["admin"] }
const environment = { at: "2026-11-12T12:00:00Z", id: () => "unused", directory: [] }

test("IT Operations reports preserve authorized monthly measurements and never manufacture YTD totals", async () => {
  const snapshot = empty()
  snapshot.data.opsCats = ["IT Security", "Infrastructure", "Application"]
  snapshot.data.opsTickets = [
    {
      year: 2026,
      month: 12,
      "IT Security|Incidents|Open": 5,
      "IT Security|Incidents|Closed": 4,
      "IT Security|Service Requests|Open": 2,
      "IT Security|Service Requests|Closed": 1,
      "Infrastructure|Incidents|Open": 3,
      "Infrastructure|Incidents|Closed": 0,
      "Application|Service Requests|Open": 0,
      "Application|Service Requests|Closed": 2,
      "Not Configured|Incidents|Open": 900,
    },
    {
      year: 2026,
      month: 1,
      "IT Security|Incidents|Open": 0,
      "IT Security|Incidents|Closed": 0,
      "Infrastructure|Service Requests|Open": 0,
      "Infrastructure|Service Requests|Closed": 0,
    },
    { year: 2025, month: 12, "IT Security|Incidents|Open": 800, "IT Security|Incidents|Closed": 700 },
  ]

  for (const format of ["pptx", "docx"] as const) {
    const result = await createReport(snapshot, actor, environment, {
      format,
      year: 2026,
      topics: ["IT Operations"],
    })
    if (!result.ok) throw new Error(`${format} report refused`)
    const text = await reportXmlText(result.bytes, format)
    expect(text).toContain("YTD totals are unavailable")
    expect(text).toContain("Opened: 5")
    expect(text).toContain("Closed: 4")
    expect(text).toContain("Opened: 2")
    expect(text).toContain("Closed: 1")
    expect(text).toContain("Opened: 3")
    expect(text).toContain("Initial balance: unavailable")
    expect(text).toContain("Months w/ Data")
    expect(text).toContain("2")
    expect(text).toContain("2026-01")
    expect(text).toContain("2026-12")
    expect(text).not.toContain("Tickets Opened YTD")
    expect(text).not.toContain("Tickets Closed YTD")
    expect(text).not.toContain("900")
    expect(text).not.toContain("800")
    if (format === "pptx") {
      const zip = await JSZip.loadAsync(result.bytes)
      const slide = await zip.file("ppt/slides/slide1.xml")!.async("string")
      expect(slide).not.toContain("<a:tbl>")
    }
    if (format === "docx") expect(text).toContain("Presenter script")
  }
})

test("IT Security report uses the latest month in the selected year and preserves source and derived KPI values", async () => {
  const snapshot = empty()
  snapshot.data.secKpi = [
    { year: 2026, month: 2, training: 81, patch: 82, scan: 83, assessment: 84, socClosure: 85 },
    {
      year: 2026,
      month: 11,
      training: 0,
      patch: 88,
      scan: null,
      assessment: 72,
      socCritical: 2,
      socHigh: 3,
      socMedium: 5,
      socLow: 0,
      socPending: 1,
      socClosure: 99,
    },
    { year: 2027, month: 12, training: 99, patch: 98, scan: 97, assessment: 96, socClosure: 95 },
  ]

  for (const format of ["pptx", "docx"] as const) {
    const result = await createReport(snapshot, actor, environment, {
      format,
      year: 2026,
      topics: ["IT Security KPIs"],
    })
    if (!result.ok) throw new Error(`${format} report refused`)
    const text = await reportXmlText(result.bytes, format)
    expect(text).toContain("Awareness Training")
    expect(text).toContain("0%")
    expect(text).toContain("Patch Compliance")
    expect(text).toContain("88%")
    expect(text).toContain("SOC Closure")
    expect(text).toContain("90%")
    expect(text).toContain("Scan Coverage")
    expect(text).toContain(format === "pptx" ? "Scan Coverage —" : "Scan Coverage: —")
    expect(text).toContain("Awareness Assessment")
    expect(text).toContain("72%")
    expect(text).toContain("November")
    expect(text).toContain("2026")
    expect(text).not.toContain("85%")
    expect(text).not.toContain("95%")
  }
})

test("report data distinguishes real zero metrics from absent year data", async () => {
  const withZeros = empty()
  withZeros.data.opsCats = ["Infrastructure"]
  withZeros.data.opsTickets = [
    {
      year: 2026,
      month: 3,
      "Infrastructure|Incidents|Open": 0,
      "Infrastructure|Incidents|Closed": 0,
      "Infrastructure|Service Requests|Open": 0,
      "Infrastructure|Service Requests|Closed": 0,
    },
  ]
  withZeros.data.secKpi = [
    {
      year: 2026,
      month: 3,
      training: 0,
      patch: 0,
      scan: 0,
      assessment: 0,
      socCritical: 0,
      socPending: 0,
      socClosure: 0,
    },
  ]
  const zeroReport = await createReport(withZeros, actor, environment, {
    format: "docx",
    year: 2026,
    topics: ["IT Operations", "IT Security KPIs"],
  })
  if (!zeroReport.ok) throw new Error("Zero report refused")
  const zeroText = await reportXmlText(zeroReport.bytes, "docx")
  expect(zeroText).toContain("Opened: 0")
  expect(zeroText).toContain("Closed: 0")
  expect(zeroText).toContain("Initial balance: unavailable")
  expect(zeroText).toContain("Months w/ Data: 1")
  expect(zeroText).toContain("Awareness Training: 0%")
  expect(zeroText).toContain("Patch Compliance: 0%")
  expect(zeroText).toContain("SOC Closure: 0%")
  expect(zeroText).toContain("Scan Coverage: 0%")
  expect(zeroText).toContain("Awareness Assessment: 0%")
  expect(zeroText).not.toContain("No IT Operations ticket data")
  expect(zeroText).not.toContain("No IT Security KPI data")

  const emptyReport = await createReport(empty(), actor, environment, {
    format: "docx",
    year: 2026,
    topics: ["IT Operations", "IT Security KPIs"],
  })
  if (!emptyReport.ok) throw new Error("Empty report refused")
  const emptyText = await reportXmlText(emptyReport.bytes, "docx")
  expect(emptyText).toContain("No IT Operations ticket data has been entered yet for 2026.")
  expect(emptyText).toContain("No IT Security KPI data has been entered yet for 2026.")
})

async function reportXmlText(bytes: Uint8Array, format: "pptx" | "docx") {
  const zip = await JSZip.loadAsync(bytes)
  const paths =
    format === "docx"
      ? ["word/document.xml"]
      : Object.keys(zip.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
  const text: string[] = []
  for (const path of paths) {
    const xml = await zip.file(path)!.async("string")
    const parser = new SaxesParser({ xmlns: false })
    const parts: string[] = []
    parser.on("text", (part) => parts.push(part))
    parser.write(xml).close()
    text.push(parts.join(" "))
  }
  return text.join(" ")
}
