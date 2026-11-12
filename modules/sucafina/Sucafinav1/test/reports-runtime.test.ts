import { expect, test } from "bun:test"
import JSZip from "jszip"
import { createReport } from "../runtime/reports.ts"
import { download } from "../runtime/downloads.ts"
import { empty } from "./fixture/persistence.ts"

const actor = { id: "admin", canWrite: true, roles: ["admin"] }
const environment = {
  at: "2026-11-11T12:00:00Z",
  id: () => "unused",
  directory: [],
}

test("PowerPoint contains the server's twelve-month totals and at most twelve table rows per slide", async () => {
  const snapshot = empty()
  snapshot.data.opexOwners = [{ id: "o", budget: 1200 }]
  snapshot.data.opexEntries = [
    {
      ownerId: "o",
      year: 2026,
      month: 1,
      budget: 500,
      actual: 10,
      forecast: 20,
    },
  ]
  snapshot.data.hotTopics = Array.from({ length: 30 }, (_, index) => ({
    id: `t-${index}`,
    action: `Topic ${index}`,
    status: "open",
    priority: "normal",
  }))
  const result = await createReport(snapshot, actor, environment, {
    format: "pptx",
    year: 2026,
    topics: ["Executive Dashboard", "Hot Topics & Actions"],
  })
  if (!result.ok) throw new Error("Report refused")
  expect(result.bytes.byteLength).toBeGreaterThan(1000)
  const zip = await JSZip.loadAsync(result.bytes)
  const executive = await zip.file("ppt/slides/slide1.xml")!.async("string")
  expect(executive).toContain("$1600")
  const topics = await zip.file("ppt/slides/slide2.xml")!.async("string")
  expect((topics.match(/<a:tr\b/g) ?? []).length).toBeLessThanOrEqual(12)
  expect(topics).toContain("Topic 11")
  expect(topics).not.toContain("Topic 12")
})

test("Word is an actual DOCX presenter script with all bullets rather than slide limits", async () => {
  const snapshot = empty()
  snapshot.data.hotTopics = Array.from({ length: 30 }, (_, index) => ({
    action: `Topic ${index}`,
    status: "open",
    priority: "normal",
  }))
  const result = await createReport(snapshot, actor, environment, {
    format: "docx",
    title: "Quarter <review>",
    year: 2026,
    topics: ["Hot Topics & Actions"],
  })
  if (!result.ok) throw new Error("Report refused")
  expect(result.name).toBe("Quarter_review_.docx")
  const zip = await JSZip.loadAsync(result.bytes)
  const document = await zip.file("word/document.xml")!.async("string")
  expect(document).toContain("Presenter script")
  expect(document).toContain("Topic 29")
  expect(document).toContain("Key figures to reference")
  expect(document).toContain("Quarter &lt;review&gt;")
  expect(
    (
      await createReport(snapshot, actor, environment, {
        format: "docx",
        year: 2026,
        topics: [],
      })
    ).ok,
  ).toBe(false)
})

test("report scopes never expose talent and unauthorized Executive Summary cannot bypass page visibility", async () => {
  const snapshot = empty()
  snapshot.data.members = [{ id: "m", name: "Member", cls: "PRIVATE-CLASS", notes: "PRIVATE-NOTES" }]
  const lead = { id: "lead", roles: ["domain leader"], canWrite: true }
  expect(
    await createReport(snapshot, lead, environment, {
      format: "docx",
      year: 2026,
      topics: ["Talent Review"],
    }),
  ).toMatchObject({ ok: false, status: 403 })
  const contributor = { id: "ops", roles: ["contributor"], canWrite: true }
  expect(
    await createReport(snapshot, contributor, environment, {
      format: "docx",
      year: 2026,
      topics: ["Executive Summary"],
    }),
  ).toMatchObject({ ok: false, status: 403 })
  const viewer = { id: "viewer", roles: ["viewer"], canWrite: false }
  const result = await createReport(snapshot, viewer, environment, {
    format: "docx",
    year: 2026,
    topics: ["Executive Dashboard"],
  })
  if (!result.ok) throw new Error("Viewer Executive refused")
  const document = await (await JSZip.loadAsync(result.bytes)).file("word/document.xml")!.async("string")
  expect(document).not.toContain("PRIVATE")
})

test("PO HTML omits bank fields, escapes description, and the register respects requester scope", async () => {
  const snapshot = empty()
  snapshot.data.store = {
    requests: {
      r1: {
        request: {
          number: "r1",
          status: "po_issued",
          createdBy: "owner",
          pr: { title: "Laptop" },
          po: {
            number: "PO-2026-0001",
            supplier: "Vendor",
            description: "<script>alert(1)</script>",
            iban: "PRIVATE-IBAN",
            account: "PRIVATE-ACCOUNT",
            lines: [{ description: "Laptop", qty: 2, unitPrice: 50 }],
          },
        },
      },
      r2: {
        request: {
          number: "OTHER-REQUEST",
          status: "draft",
          createdBy: "other",
        },
      },
    },
  }
  const requester = { id: "owner", roles: ["requester"], canWrite: true }
  const document = await download("po", snapshot, requester, environment, new URLSearchParams({ request: "r1" }))
  if (!document.ok) throw new Error("PO refused")
  const html = new TextDecoder().decode(document.bytes)
  expect(html).toContain("&lt;script&gt;")
  expect(html).not.toContain("<script>")
  expect(html).not.toContain("PRIVATE")
  const register = await download("register", snapshot, requester, environment, new URLSearchParams())
  if (!register.ok) throw new Error("Register refused")
  expect(new TextDecoder().decode(register.bytes)).not.toContain("OTHER-REQUEST")
})
