import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { inflateRawSync } from "node:zlib"
import { expect } from "@playwright/test"
import type { TestInfo } from "@playwright/test"
import type { PreservedReview } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { ReportsCorpus } from "./corpus.ts"
import { projection } from "./model.ts"

/** Reads the downloaded OOXML package, not the app's renderer or its input fixture. */
export async function inspectReport(file: string, format: "docx" | "pptx", saved: PreservedReview, corpus: ReportsCorpus, info: Pick<TestInfo, "attach">) {
  const bytes = await readFile(file)
  expect(bytes.length).toBeGreaterThan(100)
  const entries = xmlEntries(bytes, format)
  if (format === "docx") expect(entries.map((entry) => entry.name)).toEqual(["word/document.xml"])
  if (format === "pptx") expect(entries.length, "More than one slide must carry the complete selected corpus").toBeGreaterThan(1)
  const physicalRows = entries.flatMap((entry) => xmlTableRows(entry.xml, format, entry.name))
  const expectedRows = saved.sections.flatMap((section) => projection(section.content).values.map((value, index) => ({
    sectionRef: section.id,
    ordinal: index + 1,
    valueId: value.id,
    cells: [
      `${value.id}: ${value.value === null ? "unavailable" : String(value.value)}${value.unit ? ` ${value.unit}` : ""}${value.currency ? ` ${value.currency}` : ""}`,
      `${value.period.start} – ${value.period.end}`,
      value.sourceRefs.map((source) => source.refId).join(", ") || "unavailable",
    ].map(displayText) as Cells,
  })))
  const captured = reassembleValueRows(physicalRows, expectedRows, format)
  const paragraphs = entries.flatMap((entry) => xmlParagraphs(entry.xml, format))
  // The producer preserves the original spaces at soft-wrap boundaries. Adding
  // spaces here would corrupt unbroken record identities and source references.
  const content = normalize(paragraphs.join(""))
  expect(content).toContain(saved.id)
  expect(content).toContain(corpus.annual.start)
  expect(content).toContain(corpus.annual.end)
  expect(captured.some((row) => row.cells[0].includes("REPORTS_LONG_NOTE_END"))).toBe(true)
  expect(content).toContain("No records.")
  expect(content).toContain(`${corpus.forecastField}: ${corpus.before}`)
  expect(content).not.toContain(`${corpus.forecastField}: ${corpus.after}`)

  saved.sections.forEach((section) => {
    expect(content).toContain(section.title)
    expect(content).toContain(`Selected records: ${section.count}`)
  })
  // The ordered, exhaustive row comparison above binds every value and unit to
  // its own period and sources, across all sections and continuation slides.
  corpus.projects.forEach((project) => {
    const identity = `projects[id:${project.id}].id: ${project.id}`
    expect(captured.filter((row) => row.cells[0] === identity), `${format}: exactly one selected source record ${project.id}`).toHaveLength(1)
    expect(captured.filter((row) => row.cells[0] === displayText(`projects[id:${project.id}].name: ${project.name}`))).toHaveLength(1)
  })
  const evidence = { format, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length,
    parts: entries.map((entry) => entry.name), reviewRef: saved.id, projectCount: corpus.projects.length,
    valueRows: captured.length, physicalRows: physicalRows.length,
    semanticContent: "verified-by-assertions", visualClipping: "NOT_PROVEN_BY_XML" }
  await info.attach(`report-${format}-semantic-rows`, { body: JSON.stringify({ reviewRef: saved.id, rows: captured }, null, 2), contentType: "application/json" })
  await info.attach(`report-${format}-semantics`, { body: JSON.stringify(evidence, null, 2), contentType: "application/json" })
  return evidence
}

function normalize(value: string) { return value.replace(/\s+/g, " ").trim() }

function displayText(value: string) { return normalize(value.replace(/\r\n|\r|\n/g, " ↵ ")) }

type Cells = [string, string, string]
type Continuation = [string | undefined, string | undefined, string | undefined]
type PhysicalRow = { part: string; row: number; cells: Cells; continuation: Continuation }
type ExpectedRow = { sectionRef: string; ordinal: number; valueId: string; cells: Cells }

/** Tables retain cell boundaries; a source found elsewhere cannot satisfy a row. */
function xmlTableRows(xml: string, format: "docx" | "pptx", part: string): PhysicalRow[] {
  rejectXmlDeclarations(xml)
  const namespace = format === "docx" ? "w" : "a"
  const rows = new RegExp(`<${namespace}:tr(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${namespace}:tr>`, "g")
  return [...xml.matchAll(rows)].flatMap((row, index) => {
    const cells = new RegExp(`<${namespace}:tc(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${namespace}:tc>`, "g")
    const parsed = [...row[1]!.matchAll(cells)].map((cell) => tableCell(cell[1]!, format))
    const values = parsed.map((cell) => cell.value)
    const continuation = parsed.map((cell) => cell.continuation) as Continuation
    expect(values, `${format}: ${part} table row ${index + 1} must have value, period and sources cells`).toHaveLength(3)
    if (values.map(normalize).join("\u0000") === ["Captured value", "Period", "Sources"].join("\u0000")) {
      expect(continuation.every((label) => label === undefined), "Table headers cannot carry captured-record continuation labels").toBe(true)
      return []
    }
    return [{ part, row: index + 1, cells: values as Cells, continuation }]
  })
}

/** Only an explicitly styled, first paragraph can be layout context. Its identity is checked against the current logical row below. */
function tableCell(xml: string, format: "docx" | "pptx") {
  if (format === "pptx") return { value: xmlParagraphs(xml, format).join(""), continuation: undefined }
  const paragraphs = [...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map((paragraph) => paragraph[0])
  let continuation: string | undefined
  const value = paragraphs.map((paragraph, index) => {
    const properties = paragraph.match(/<w:pPr(?:\s[^>]*)?>([\s\S]*?)<\/w:pPr>/)?.[1] ?? ""
    const styles = [...properties.matchAll(/<w:pStyle\b[^>]*\/>/g)].map((style) => xmlAttributes(style[0])["w:val"])
    if (!styles.includes("SfCapturedContinuation")) return xmlParagraphs(paragraph, format).join("")
    expect(styles, "A continuation paragraph has one unambiguous style").toEqual(["SfCapturedContinuation"])
    expect(index, "Continuation context must be the first paragraph in its cell").toBe(0)
    expect(continuation, "Only one continuation paragraph is allowed per cell").toBeUndefined()
    continuation = xmlParagraphs(paragraph, format).join("")
    return ""
  }).join("")
  return { value, continuation }
}

function verifyContinuation(fragment: PhysicalRow, wanted: ExpectedRow, first: boolean) {
  if (first) {
    expect(fragment.continuation.every((label) => label === undefined), `docx: first fragment of ${wanted.valueId} cannot be a continuation`).toBe(true)
    return
  }
  const [value, period, sources] = fragment.continuation
  const prefix = `Record ${wanted.ordinal} · `
  const suffix = " (continued)"
  expect(value?.startsWith(prefix) && value.endsWith(suffix), `docx: continuation must identify record ${wanted.ordinal}`).toBe(true)
  expect(period?.startsWith("Period: ") && period.endsWith(suffix), `docx: continuation must retain its period`).toBe(true)
  expect(sources, `docx: continuation must retain its source association`).toBe("Sources (continued from the same captured record)")
  // Soft wrapping may insert spaces in these short human labels. Complete data
  // remains subject to the exact ordered value/period/source assertions below.
  const matchesLabel = (label: string, expected: string) => {
    const truncated = label.endsWith("…")
    const shown = (truncated ? label.slice(0, -1) : label).replace(/\s/g, "")
    const complete = displayText(expected).replace(/\s/g, "")
    return truncated ? shown.length > 0 && shown.length < complete.length && complete.startsWith(shown) : shown === complete
  }
  expect(matchesLabel(value!.slice(prefix.length, -suffix.length), wanted.valueId), `docx: continuation label must belong to ${wanted.valueId}`).toBe(true)
  expect(matchesLabel(period!.slice("Period: ".length, -suffix.length), wanted.cells[1]), `docx: continuation period must belong to ${wanted.valueId}`).toBe(true)
}

/** Both formats split long cells into successive physical rows, including across pages or slides. */
function reassembleValueRows(actual: PhysicalRow[], expected: ExpectedRow[], format: "docx" | "pptx") {
  let cursor = 0
  const result = expected.map((wanted) => {
    const cells: Cells = ["", "", ""]
    const fragments: { part: string; row: number }[] = []
    do {
      expect(cursor, `${format}: missing captured value row ${wanted.valueId}`).toBeLessThan(actual.length)
      const fragment = actual[cursor++]!
      if (format === "docx") verifyContinuation(fragment, wanted, fragments.length === 0)
      expect(fragment.cells.some((cell) => normalize(cell).length > 0), `${format}: empty continuation for ${wanted.valueId}`).toBe(true)
      fragments.push({ part: fragment.part, row: fragment.row })
      for (const column of [0, 1, 2] as const) {
        cells[column] += fragment.cells[column]
        expect(wanted.cells[column].startsWith(normalize(cells[column])),
          `${format}: ${wanted.valueId}, ${["value", "period", "sources"][column]} differs in ${fragment.part} row ${fragment.row}`).toBe(true)
      }
    } while (cells.some((cell, column) => normalize(cell) !== wanted.cells[column]))
    const normalized = cells.map(normalize) as Cells
    expect(normalized, `${format}: complete value/period/source tuple ${wanted.valueId}`).toEqual(wanted.cells)
    return { sectionRef: wanted.sectionRef, valueId: wanted.valueId, cells: normalized, fragments }
  })
  expect(cursor, `${format}: no extra, duplicate or unselected value rows`).toBe(actual.length)
  return result
}

// A bounded reader for the ordinary, unencrypted single-disk ZIP emitted by DOCX/PPTX.
// It never extracts paths to disk or executes anything from the downloaded archive.
function xmlEntries(bytes: Buffer, format: "docx" | "pptx") {
  if (bytes.length > 32 * 1024 * 1024) throw new Error("Report exceeds the semantic inspection size limit")
  const end = Array.from({ length: Math.min(bytes.length - 21, 65536) }, (_, index) => bytes.length - 22 - index)
    .find((offset) => offset >= 0 && bytes.readUInt32LE(offset) === 0x06054b50 && offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length)
  if (end === undefined) throw new Error("Downloaded report is not an ordinary complete OOXML ZIP")
  if (bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6) || bytes.readUInt16LE(end + 8) !== bytes.readUInt16LE(end + 10))
    throw new Error("Multi-disk reports are unsupported")
  const count = bytes.readUInt16LE(end + 10)
  const directoryEnd = bytes.readUInt32LE(end + 16) + bytes.readUInt32LE(end + 12)
  if (count === 0xffff || directoryEnd !== end) throw new Error("Unsupported or incomplete report directory")
  const state = { offset: bytes.readUInt32LE(end + 16), expanded: 0 }
  const names = new Set<string>()
  const result: { name: string; xml: string }[] = []
  for (const _entry of Array.from({ length: count })) {
    const offset = state.offset
    if (offset + 46 > directoryEnd || bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid report ZIP directory")
    const flags = bytes.readUInt16LE(offset + 8)
    const method = bytes.readUInt16LE(offset + 10)
    const compressed = bytes.readUInt32LE(offset + 20)
    const expanded = bytes.readUInt32LE(offset + 24)
    const length = bytes.readUInt16LE(offset + 28)
    state.offset += 46 + length + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32)
    if (state.offset > directoryEnd || flags & 1) throw new Error("Invalid or encrypted report ZIP")
    const name = bytes.subarray(offset + 46, offset + 46 + length).toString("utf8")
    if (names.has(name)) throw new Error("Duplicate report ZIP entry")
    names.add(name)
    if (!(format === "docx" ? name === "word/document.xml" : /^ppt\/slides\/slide\d+\.xml$/.test(name)
      || name === "ppt/presentation.xml" || name === "ppt/_rels/presentation.xml.rels")) continue
    const local = bytes.readUInt32LE(offset + 42)
    if (local + 30 > bytes.length || bytes.readUInt32LE(local) !== 0x04034b50) throw new Error("Missing report ZIP payload")
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28)
    state.expanded += expanded
    if (start + compressed > directoryEnd || state.expanded > 16 * 1024 * 1024 || (method !== 0 && method !== 8))
      throw new Error("Unsupported or excessive report XML payload")
    const payload = bytes.subarray(start, start + compressed)
    const xml = method === 8 ? inflateRawSync(payload, { maxOutputLength: 16 * 1024 * 1024 }) : payload
    if (xml.length !== expanded) throw new Error("Incomplete report XML payload")
    result.push({ name, xml: xml.toString("utf8") })
  }
  if (state.offset !== directoryEnd || result.length === 0) throw new Error("No complete report content parts")
  return format === "pptx" ? presentationSlides(result) : result
}

/** Slide filenames are storage identities; the presentation declares their display order. */
function presentationSlides(entries: { name: string; xml: string }[]) {
  const presentation = entries.find((entry) => entry.name === "ppt/presentation.xml")
  const relationships = entries.find((entry) => entry.name === "ppt/_rels/presentation.xml.rels")
  if (!presentation || !relationships) throw new Error("Missing presentation order or relationships")
  rejectXmlDeclarations(presentation.xml)
  rejectXmlDeclarations(relationships.xml)
  const targets = new Map<string, string>()
  for (const relationship of relationships.xml.matchAll(/<Relationship\b[^>]*\/>/g)) {
    const attributes = xmlAttributes(relationship[0])
    if (!attributes.Type?.endsWith("/slide")) continue
    if (!attributes.Id || targets.has(attributes.Id) || attributes.TargetMode === "External" || !/^slides\/slide\d+\.xml$/.test(attributes.Target ?? ""))
      throw new Error("Invalid or duplicate presentation slide relationship")
    targets.set(attributes.Id, `ppt/${attributes.Target}`)
  }
  const ordered = [...presentation.xml.matchAll(/<p:sldId\b[^>]*\/>/g)].map((slide) => {
    const reference = xmlAttributes(slide[0])["r:id"]
    const name = reference ? targets.get(reference) : undefined
    const entry = name ? entries.find((candidate) => candidate.name === name) : undefined
    if (!entry) throw new Error("Presentation points to a missing slide")
    return entry
  })
  const slides = entries.filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry.name))
  if (!ordered.length || new Set(ordered.map((entry) => entry.name)).size !== ordered.length || ordered.length !== slides.length)
    throw new Error("Presentation contains duplicate or unreferenced slide content")
  return ordered
}

function xmlAttributes(tag: string): Record<string, string> {
  return Object.fromEntries([...tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
    .map((attribute) => [attribute[1]!, decodeXml(attribute[2] ?? attribute[3]!)]))
}

function xmlParagraphs(xml: string, format: "docx" | "pptx") {
  rejectXmlDeclarations(xml)
  const namespace = format === "docx" ? "w" : "a"
  const paragraphs = new RegExp(`<${namespace}:p(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${namespace}:p>`, "g")
  return [...xml.matchAll(paragraphs)].map((paragraph) => {
    const tokens = new RegExp(`<${namespace}:t(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${namespace}:t>|<${namespace}:(?:br|tab)\\b[^>]*\\/>`, "g")
    // w:br/a:br are layout breaks. Text runs retain the source's own spaces;
    // concatenating preserves even IDs split in the middle by the producer.
    return [...paragraph[1]!.matchAll(tokens)].map((token) => token[1] === undefined ? (token[0].includes(":tab") ? "\t" : "") : decodeXml(token[1])).join("")
  })
}

function rejectXmlDeclarations(xml: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Unexpected XML declaration in report content")
}

function decodeXml(value: string) {
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_match, entity: string) => {
    const name = entity.toLowerCase()
    return name.startsWith("#") ? String.fromCodePoint(Number.parseInt(name.slice(name[1] === "x" ? 2 : 1), name[1] === "x" ? 16 : 10)) : entities[name]!
  })
}
