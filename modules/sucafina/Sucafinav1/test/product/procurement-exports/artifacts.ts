import { expect } from "bun:test"
import { createHash } from "node:crypto"
import { object, text } from "../../../runtime/contract.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { download } from "../../../runtime/downloads.ts"
import { buyer, environment, procurementExportFixture } from "./fixture.ts"

type Fixture = Awaited<ReturnType<typeof procurementExportFixture>>

/** Read real download bytes; robustness premises only modify a discarded snapshot. */
export async function exportFiles(fixture: Fixture, caseId: string, premise?: (request: Record<string, unknown>, snapshot: Snapshot) => void) {
  const persisted = await fixture.material()
  const files = await fixture.persistence.transaction("procurement", async (saved) => {
    const snapshot = structuredClone(saved)
    const request = object(object(object(object(snapshot.data.store).requests)[fixture.target.id]).request)
    premise?.(request, snapshot)
    const before = structuredClone(snapshot)
    const query = new URLSearchParams({ request: fixture.target.id })
    const csvResult = await download("register", snapshot, buyer, environment, query)
    expect(snapshot).toEqual(before)
    const htmlResult = await download("po", snapshot, buyer, environment, query)
    expect(snapshot).toEqual(before)
    const csv = artifactText(csvResult, "procurement-register.csv", "text/csv; charset=utf-8")
    const html = artifactText(htmlResult, (text(object(request.po).number).replace(/[^A-Za-z0-9_-]/g, "_") || "purchase-order") + ".html", "text/html; charset=utf-8")
    const cells = csv.body.split("\r\n").map((line) => [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((match) => match[1]!.replaceAll('""', '"')))
    expect(cells).toHaveLength(2)
    expect(cells[1]).toHaveLength(cells[0]!.length)
    const register = Object.fromEntries(cells[0]!.map((name, index) => [name, cells[1]![index]]))
    const lines = [...html.body.matchAll(/<tr><td>\d+<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g)].map((match) => ({
      description: match[1], quantity: match[2], unit: match[3], unitPrice: match[4], total: match[5],
    }))
    const money = html.body.match(/<p>Monetary state:[\s\S]*?<\/p>/)?.[0]
    expect(money).toBeDefined()
    expect(register["PR number"]).toBe(fixture.target.id)
    expect(html.body).toContain("Requisition: " + fixture.target.id)
    expect(html.body).toContain("Unit price (" + text(object(request.po).currency) + ")")
    expect(html.body).toContain("Total (" + text(object(request.po).currency) + ")")
    return { commit: false, value: { csv, html, register, lines, money } }
  })
  expect(await fixture.material()).toEqual(persisted)
  // The hosted Bun workflow retains logs, not a generic exported-file artifact.
  console.log("PROCUREMENT_EXPORT_EVIDENCE " + JSON.stringify({
    caseId, entrypoint: "runtime/downloads.ts#download(register|po)", actor: buyer.id, requestRef: fixture.target.id,
    artifacts: [files.csv, files.html].map(({ name, type, byteLength, sha256, body }) => ({ name, type, byteLength, sha256, ...(["EXPORT-01", "EXPORT-02"].includes(caseId) ? { utf8: body } : {}) })),
    register: Object.fromEntries(Object.entries(files.register).filter(([name]) => name.startsWith("PO ") || ["Status", "Selected quote total"].includes(name))),
    lines: files.lines, money: files.money, snapshotUnchanged: true, persistedUnchanged: true,
  }))
  return { ...files, csv: files.csv.body, html: files.html.body }
}

function artifactText(result: Awaited<ReturnType<typeof download>>, name: string, type: string) {
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error("Export unavailable: " + result.status)
  expect(result.name).toBe(name)
  expect(result.type).toBe(type)
  expect(result.bytes.byteLength).toBeGreaterThan(0)
  return { name: result.name, type: result.type, byteLength: result.bytes.byteLength,
    sha256: createHash("sha256").update(result.bytes).digest("hex"), body: new TextDecoder().decode(result.bytes) }
}
