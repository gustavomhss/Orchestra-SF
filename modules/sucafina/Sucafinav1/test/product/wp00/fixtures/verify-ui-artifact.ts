import JSZip from "jszip"
import { parseWorkbook } from "../../../../runtime/workbooks.ts"

/** Inspect bytes produced by real report/download endpoints; this helper renders nothing. */
export async function inspectUiReport(bytes: Uint8Array, format: "docx" | "pptx") {
  const zip = await JSZip.loadAsync(bytes)
  const entries = Object.keys(zip.files).filter((name) => format === "docx" ? name === "word/document.xml" : /^ppt\/slides\/slide\d+\.xml$/.test(name))
  if (!entries.length) throw new Error("The downloaded report contains no Office document content")
  return { entries, xml: (await Promise.all(entries.map((name) => zip.file(name)!.async("string")))).join("\n") }
}

export async function inspectUiWorkbook(bytes: Uint8Array) {
  const result = await parseWorkbook(bytes)
  if (!result.ok) throw new Error("The real workbook parser rejected the downloaded workbook: " + result.errors.join("; "))
  return {
    ...result.sheets,
    // The export timestamp is explicitly volatile; no business cell or identity is discarded.
    Info: result.sheets.Info?.filter((row) => row.Field !== "Exported"),
  }
}
