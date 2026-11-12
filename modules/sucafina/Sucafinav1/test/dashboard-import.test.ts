import { expect, test } from "bun:test"
import { prepareDashboardImport } from "../runtime/dashboard-import.ts"
import { object } from "../runtime/contract.ts"

const metadata = {
  roleMap: { admin: { group: "trusted-admins" } },
  access: { leaders: ["trusted"] },
  budgetLineIds: ["line-1"],
  summaries: ["Headcount Overview"],
  assets: [{ id: "file-1", key: "contracts/1/file-1" }],
  noticeDelivery: { sent: ["notice-1"] },
  noticeClaims: { claim: { owner: "worker" } },
  noticeSchedule: { daily: { hour: 8 } },
}

test("installation metadata always comes from current, while business data comes from import", () => {
  const current = { ...structuredClone(metadata), members: [{ id: "old" }] }
  const imported: Record<string, unknown> = Object.fromEntries(
    Object.keys(metadata).map((key) => [key, { injected: true }]),
  )
  imported.members = [{ id: "new", cls: "Talent", notes: "Preserved business talent" }]
  imported.revenueByYear = { "2026": 100 }
  imported.customBusiness = { rows: [1, 2, 3] }
  const beforeCurrent = structuredClone(current)
  const beforeImported = structuredClone(imported)
  const result = prepareDashboardImport(current, imported)
  expect(result).toEqual({
    ok: true,
    data: {
      ...metadata,
      members: imported.members,
      revenueByYear: imported.revenueByYear,
      customBusiness: imported.customBusiness,
    },
  })
  expect(current).toEqual(beforeCurrent)
  expect(imported).toEqual(beforeImported)
})

test("metadata absent from current cannot be injected, including imported asset indexes", () => {
  const result = prepareDashboardImport({}, { ...metadata, members: [{ name: "Business" }] })
  expect(result).toEqual({ ok: true, data: { members: [{ name: "Business" }] } })
})

test("result deeply clones current metadata and imported business data", () => {
  const current = structuredClone(metadata)
  const imported = { members: [{ id: "m", review: { notes: ["Original"] } }] }
  const result = prepareDashboardImport(current, imported)
  expect(result.ok).toBe(true)
  if (!result.ok) return
  for (const key of Object.keys(metadata)) expect(result.data[key]).not.toBe(object(current)[key])
  object(object(result.data.roleMap).admin).group = "changed"
  ;(object(result.data.access).leaders as string[]).push("injected")
  ;(result.data.assets as Record<string, unknown>[])[0]!.key = "changed"
  ;(object((result.data.members as Record<string, unknown>[])[0]!.review).notes as string[]).push("changed")
  expect(current).toEqual(metadata)
  expect(imported.members[0]!.review.notes).toEqual(["Original"])
  current.noticeSchedule.daily.hour = 12
  imported.members[0]!.review.notes.push("later source mutation")
  expect(object(object(result.data.noticeSchedule).daily).hour).toBe(8)
  expect(object((result.data.members as Record<string, unknown>[])[0]!.review).notes).toEqual(["Original", "changed"])
})

for (const field of ["docs", "documents", "attachments"]) {
  test(`${field}: current references survive omitted imported fields and preserve parent business edits`, () => {
    const reference = { id: "d", key: "contracts/1/d", name: "Private.pdf", bytes: 12, nested: { scan: "clean" } }
    const current = { contracts: [{ id: 1, name: "Old", [field]: [reference] }], assets: metadata.assets }
    const imported = {
      contracts: [{ id: "1", name: "Updated", vendor: "Vendor", budget: 12 }],
      assets: [{ key: "attacker" }],
    }
    const result = prepareDashboardImport(current, imported)
    expect(result).toEqual({
      ok: true,
      data: { contracts: [{ ...imported.contracts[0], [field]: [reference] }], assets: metadata.assets },
    })
    if (!result.ok) return
    const refs = (result.data.contracts as Record<string, unknown>[])[0]![field] as Record<string, unknown>[]
    object(refs[0]!.nested).scan = "changed"
    expect(reference.nested.scan).toBe("clean")
  })
  test(`${field}: missing parent with files rejects without mutating either input`, () => {
    const current = { contracts: [{ id: "c", [field]: [{ id: "d", key: "contracts/c/d" }] }] }
    for (const imported of [{}, { contracts: [] }, { contracts: [{ id: "different" }] }]) {
      const before = structuredClone(current)
      const importedBefore = structuredClone(imported)
      const result = prepareDashboardImport(current, imported)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.errors.join(" ")).toContain("has files")
      expect(current).toEqual(before)
      expect(imported).toEqual(importedBefore)
    }
  })
  test(`${field}: new references require verified private restore even with forged asset index`, () => {
    const result = prepareDashboardImport(
      { contracts: [{ id: "c" }] },
      {
        contracts: [{ id: "c", [field]: [{ id: "injected", key: "contracts/c/injected" }] }],
        assets: [{ id: "injected", key: "contracts/c/injected" }],
      },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(" ")).toContain("verified private restore")
  })
}

test("equivalent references retain trusted metadata and cannot change storage locators", () => {
  const current = { contracts: [{ id: "c", docs: [{ id: 2, key: "contracts/c/2", name: "Trusted.pdf" }] }] }
  const result = prepareDashboardImport(current, {
    contracts: [{ id: "c", docs: [{ id: "2", name: "Forged label" }] }],
  })
  expect(result).toEqual({ ok: true, data: current })
  expect(
    prepareDashboardImport(current, { contracts: [{ id: "c", docs: [{ id: 2, key: "private/another-contract" }] }] })
      .ok,
  ).toBe(false)
  expect(prepareDashboardImport(current, { contracts: [{ id: "c", attachments: [{ id: "new" }] }] }).ok).toBe(false)
})

test("references cannot move to another contract or revive a file on a new parent", () => {
  const current = { contracts: [{ id: "c", docs: [{ id: "d", key: "contracts/c/d" }] }, { id: "other" }] }
  const result = prepareDashboardImport(current, {
    contracts: [{ id: "c" }, { id: "other", docs: [{ id: "d", key: "contracts/c/d" }] }],
  })
  expect(result.ok).toBe(false)
  expect(prepareDashboardImport({}, { contracts: [{ id: "new", docs: [{ id: "d" }] }] }).ok).toBe(false)
})

test("contracts without files may disappear; unrelated business data is not filtered", () => {
  const result = prepareDashboardImport(
    { contracts: [{ id: "old", docs: [] }] },
    {
      contracts: [{ id: "new", notes: "Business", custom: { enabled: true } }],
      hotTopics: [{ notes: "Action notes" }],
      members: [{ notes: "Talent notes", cls: "Talent" }],
    },
  )
  expect(result).toEqual({
    ok: true,
    data: {
      contracts: [{ id: "new", notes: "Business", custom: { enabled: true } }],
      hotTopics: [{ notes: "Action notes" }],
      members: [{ notes: "Talent notes", cls: "Talent" }],
    },
  })
})

test("ambiguous parent IDs and malformed reference lists fail closed", () => {
  const current = { contracts: [{ id: 1, docs: [{ id: "d" }] }] }
  for (const imported of [
    { contracts: [{ id: 1 }, { id: "1" }] },
    { contracts: [{ id: 1, docs: "invalid" }] },
    { contracts: [{ id: 1, docs: [{}] }] },
    { contracts: [{ id: 1, attachments: [null] }] },
    { contracts: { "1": { id: 1 } } },
  ])
    expect(prepareDashboardImport(current, imported).ok).toBe(false)
})

test("empty, null and explicitly undefined installation values remain authoritative", () => {
  const current = { roleMap: {}, access: null, assets: [], noticeClaims: undefined }
  const result = prepareDashboardImport(current, metadata)
  expect(result).toEqual({ ok: true, data: current })
  if (!result.ok) return
  expect(Object.hasOwn(result.data, "noticeClaims")).toBe(true)
  expect(Object.hasOwn(result.data, "summaries")).toBe(false)
})

test("omitting all imported references preserves all three trusted attachment collections", () => {
  const current = {
    contracts: [
      {
        id: "c",
        docs: [{ id: "d", key: "contracts/c/d" }],
        documents: [{ id: "e", key: "contracts/c/e" }],
        attachments: [{ id: "f", key: "contracts/c/f" }],
      },
    ],
  }
  const imported = { contracts: [{ id: "c", docs: [], documents: null, name: "Imported business" }] }
  const beforeCurrent = structuredClone(current)
  const beforeImported = structuredClone(imported)
  expect(prepareDashboardImport(current, imported)).toEqual({
    ok: true,
    data: { contracts: [{ ...current.contracts[0], name: "Imported business" }] },
  })
  expect(current).toEqual(beforeCurrent)
  expect(imported).toEqual(beforeImported)
})
