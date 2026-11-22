import { expect, test } from "bun:test"
import { Schema } from "effect"
import { SfDomainCommandCap04Save, SfDomainCommandCap09Import } from "@orchestra/schema/sucafina/domain"
import { SfDomainCommandCap18Save, SfDomainCommandCap22Save, SfPlannerMonthlyPreview } from "@orchestra/schema/sucafina/planner"
import { domain } from "../../runtime/dashboard-portfolio.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import { prepareMonthlyDrafts } from "../../product/planner/monthly-edit.ts"
import { plannerMonthlyAmount } from "../../src/planner-accounts.ts"

const actor = { id: "admin", roles: ["admin"], canWrite: true }
const environment = { at: "2026-11-22T00:00:00Z", id: () => "new-project", directory: [] }

test("numeric revisions and supported legacy decimal strings reach the real import CAS", () => {
  for (const version of [0, "0", "00", 7, "7"]) {
    const state: Snapshot = {
      data: { projects: [{ id: "p", name: "ERP", budget: 10 }] },
      versions: { "projects:p": { version: Number(version), by: "previous" } },
      sequences: {}, audit: [], notices: [],
    }
    const input = Schema.decodeUnknownSync(SfDomainCommandCap09Import.input)({
      version: 0, values: { mode: "update", rows: [{ name: "ERP", budget: 20 }], versions: { "projects:p": version } },
    })
    const command = { ...input, page: "All Projects", action: "import" }
    expect(domain.execute(state, actor, command, environment)).toMatchObject({ ok: true })
    expect(state.data.projects).toMatchObject([{ id: "p", name: "ERP", budget: 20 }])
    expect(state.versions["projects:p"]?.version).toBe(Number(version) + 1)
    const beforeRetry = structuredClone(state)
    expect(domain.execute(state, actor, command, environment)).toMatchObject({ ok: false, status: 409 })
    expect(state).toEqual(beforeRetry)
  }
})

test("the public import contract refuses revision strings the producer cannot interpret", () => {
  for (const version of ["", "latest", "-1", "0.5", "1e3", " 0 ", "Infinity", "9007199254740993"]) {
    const values = { mode: "update", rows: [{ name: "ERP", budget: 20 }], versions: { "projects:p": version } }
    expect(Schema.is(SfDomainCommandCap09Import.input)({ version: 0, values })).toBe(false)
    const state: Snapshot = {
      data: { projects: [{ id: "p", name: "ERP", budget: 10 }] },
      versions: { "projects:p": { version: 0, by: "previous" } },
      sequences: {}, audit: [], notices: [],
    }
    const before = structuredClone(state)
    expect(domain.execute(state, actor, { page: "All Projects", action: "import", version: 0, values }, environment))
      .toMatchObject({ ok: false, status: 422 })
    expect(state).toEqual(before)
  }
})

test("editable amount contracts retain producer-supported text, null and explicit zero", () => {
  const domainInput = { version: 0, values: { name: "Finance", budget: "123.45" } }
  expect(Schema.decodeUnknownSync(SfDomainCommandCap04Save.input)(domainInput)).toEqual(domainInput)
  const line = { page: "OPEX", action: "save", version: 0,
    values: { versionId: "v", annual: "123.45", a0: null, f0: "0", b0: "12.5" } }
  expect(Schema.decodeUnknownSync(SfDomainCommandCap18Save.input)(line)).toEqual(line)
  const fx = { page: "FX rates", action: "save", version: 0, values: { versionId: "v", cur: "BRL", rate: "5,125" } }
  expect(Schema.decodeUnknownSync(SfDomainCommandCap22Save.input)(fx)).toEqual(fx)
  expect(plannerMonthlyAmount(null)).toBeNull()
  expect(plannerMonthlyAmount("")).toBeNull()
  expect(plannerMonthlyAmount("0")).toBe(0)
  expect(plannerMonthlyAmount("12.5")).toBe(12.5)
})

test("monthly producer retains invalid measure-label drafts and never emits a mutation for them", () => {
  for (const label of ["budget", "actual", "forecast"]) {
    const wire = Schema.decodeUnknownSync(SfPlannerMonthlyPreview.input)({
      action: "preview", input: { page: "OPEX", versionId: "v",
        drafts: [{ rowId: "l", revision: 0, cells: [{ measure: "forecast", month: 1, text: label }] }] },
    })
    const result = prepareMonthlyDrafts(wire.input.page, wire.input.versionId, wire.input.drafts)
    expect(result[0]?.draft.cells[0]?.text).toBe(label)
    expect(result[0]?.errors).toMatchObject([{ reason: "invalid-number" }])
    expect(result[0]?.command).toBeUndefined()
  }
  const valid = Schema.decodeUnknownSync(SfPlannerMonthlyPreview.input)({
    action: "preview", input: { page: "OPEX", versionId: "v",
      drafts: [{ rowId: "l", revision: 0, cells: [
        { measure: "forecast", month: 1, text: "" },
        { measure: "actual", month: 2, text: "0" },
        { measure: "budget", month: 3, text: "12.5" },
      ] }] },
  })
  const prepared = prepareMonthlyDrafts(valid.input.page, valid.input.versionId, valid.input.drafts)
  expect(prepared[0]?.errors).toEqual([])
  expect(prepared[0]?.command?.values).toEqual({ versionId: "v", f0: null, a1: 0, b2: 12.5 })
})
