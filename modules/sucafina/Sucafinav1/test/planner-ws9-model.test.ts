import { expect, test } from "bun:test"
import { domain } from "../runtime/planner.ts"
import { rows } from "../runtime/contract.ts"
import type { Actor, Snapshot, Environment } from "../runtime/contract.ts"

const admin: Actor = { id: "admin", canWrite: true, roles: ["admin"] }
const finance: Actor = { id: "finance", canWrite: true, roles: ["finance"] }
const environment: Environment = {
  at: "2026-11-17T12:00:00Z",
  id: () => "generated",
  directory: [],
}

function seed(): Snapshot {
  return {
    data: {
      versions: [{
        id: "v", name: "Plan", year: 2026, locked: false, closed: 0,
        lines: [], projects: [],
        hc: { positions: [], rates: [], inc: 0, incMonth: 1, hrAF: {} },
        fx: [], lists: {},
      }],
      officials: {}, entities: [], allocations: [], roster: [],
    },
    versions: {}, sequences: {}, audit: [], notices: [],
  }
}
function run(state: Snapshot, page: string, action: string, id: string,
  values: Record<string, unknown>, version = 0, who: Actor = admin) {
  return domain.execute(state, who, {
    page, action, id, version, values: { versionId: "v", ...values },
  }, environment)
}
function plan(state: Snapshot) { return rows(state.data.versions)[0]! }

test("WS9 CAP19 retains approval state and investment window; invalid windows and status fail atomically", () => {
  const state = seed()
  expect(run(state, "CAPEX", "save", "capex-1", {
    collection: "projects", name: "New roaster", approvalState: "pending",
    investmentStart: "2026-04", investmentEnd: "2026-12",
  })).toMatchObject({ ok: true })
  expect(rows(plan(state).projects)[0]).toMatchObject({
    id: "capex-1", approvalState: "pending",
    investmentStart: "2026-04", investmentEnd: "2026-12",
  })
  expect(state.versions["v:projects:capex-1"]?.version).toBe(1)
  const before = structuredClone(state)
  expect(run(state, "CAPEX", "save", "capex-1", {
    collection: "projects", investmentStart: "2027-02", investmentEnd: "2027-01",
  }, 1)).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
  expect(run(state, "CAPEX", "save", "capex-1", {
    collection: "projects", approvalState: "not-a-state",
  }, 1)).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
  expect(run(state, "CAPEX", "save", "capex-1", {
    collection: "projects", approvalState: "approved",
  }, 1, { id: "owner", canWrite: true, roles: ["budget owner"] }))
    .toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
  expect(run(state, "CAPEX", "save", "capex-1", {
    collection: "projects", approvalState: "approved",
  }, 1, finance)).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
  expect(run(state, "CAPEX", "save", "capex-1", {
    collection: "projects", approvalState: "approved",
  }, 1, admin)).toMatchObject({ ok: true })
  expect(rows(plan(state).projects)[0]?.approvalState).toBe("approved")
  expect(state.audit.at(-1)?.record).toBe("v:projects:capex-1")
})

test("WS9 preserves legacy project shape when optional metadata is not submitted", () => {
  const state = seed()
  expect(run(state, "CAPEX", "save", "legacy", {
    collection: "projects", name: "Existing compatible project",
  })).toMatchObject({ ok: true })
  const record = rows(plan(state).projects)[0]!
  expect(Object.hasOwn(record, "approvalState")).toBe(false)
  expect(Object.hasOwn(record, "investmentStart")).toBe(false)
  expect(Object.hasOwn(record, "investmentEnd")).toBe(false)
  expect(run(state, "CAPEX", "save", "legacy", {
    collection: "projects", desc: "Description update",
  }, 1)).toMatchObject({ ok: true })
  const updated = rows(plan(state).projects)[0]!
  expect(Object.hasOwn(updated, "approvalState")).toBe(false)
  expect(Object.hasOwn(updated, "investmentStart")).toBe(false)
  expect(Object.hasOwn(updated, "investmentEnd")).toBe(false)
})

test("WS9 CAP21 stores contract distribution only at exact 100%; references and stale writes are fenced", () => {
  const state = seed()
  expect(run(state, "Entities & allocations", "save", "br", {
    collection: "entities", name: "Brazil", code: "BR",
  })).toMatchObject({ ok: true })
  expect(run(state, "Entities & allocations", "save", "ch", {
    collection: "entities", name: "Switzerland", code: "CH",
  })).toMatchObject({ ok: true })
  const splits = [{ entityRef: "br", percent: 62.5 }, { entityRef: "ch", percent: 37.5 }]
  expect(run(state, "Entities & allocations", "save", "shared", {
    collection: "allocations", name: "Group allocation",
    contractRef: "contract:2026/42", splits,
  })).toMatchObject({ ok: true })
  expect(rows(state.data.allocations)[0]).toMatchObject({
    id: "shared", contractRef: "contract:2026/42", splits,
  })
  expect(rows(domain.view(state, admin, environment).data.allocations)[0]?.splits).toEqual(splits)
  expect(state.versions["allocations:shared"]?.version).toBe(1)
  for (const invalidSplits of [
    [{ entityRef: "br", percent: 62.5 }, { entityRef: "ch", percent: 36.5 }],
    [{ entityRef: "br", percent: 60.001 }, { entityRef: "ch", percent: 39.999 }],
    [{ entityRef: "br", percent: 50 }, { entityRef: "br", percent: 50 }],
    [{ entityRef: "br", percent: 50 }, { entityRef: "unknown", percent: 50 }],
  ]) {
    const before = structuredClone(state)
    expect(run(state, "Entities & allocations", "save", "shared", {
      collection: "allocations", splits: invalidSplits,
    }, 1)).toMatchObject({ ok: false, status: 422 })
    expect(state).toEqual(before)
  }
  const before = structuredClone(state)
  expect(run(state, "Entities & allocations", "delete", "br", {
    collection: "entities",
  }, 1)).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
  expect(run(state, "Entities & allocations", "save", "shared", {
    collection: "allocations", contractRef: "contract:2026/43",
  }, 0)).toMatchObject({ ok: false, status: 409 })
  expect(state).toEqual(before)
  expect(run(state, "Entities & allocations", "common", "", {
    collection: "allocations",
  })).toMatchObject({ ok: true })
  expect(rows(state.data.allocations).length).toBeGreaterThan(1)
})

test("WS9 CAP22 records temporal rate provenance; missing, stale and future evidence cannot overwrite", () => {
  const state = seed()
  const fields = {
    cur: "EUR", rate: 1.2345678, sourceRef: "doc:central-bank/eur",
    provider: "ECB", observedAt: "2026-11-17T10:00:00Z",
  }
  expect(run(state, "FX rates", "save", "eur", fields)).toMatchObject({ ok: true })
  expect(rows(plan(state).fx)[0]).toMatchObject({
    ...fields, rate: 1.234568,
  })
  expect(rows(domain.view(state, admin, environment).data.versions)
    .flatMap((version) => rows(version.fx))[0]?.observedAt).toBe(fields.observedAt)
  const before = structuredClone(state)
  expect(run(state, "FX rates", "save", "gbp", {
    cur: "GBP", rate: 1.28, sourceRef: "doc:gbp", observedAt: "2026-11-17T11:00:00Z",
  })).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
  expect(run(state, "FX rates", "save", "gbp", {
    cur: "GBP", rate: 1.28, sourceRef: "doc:gbp", provider: "Bank",
    observedAt: "2026-11-18T11:00:00Z",
  })).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
  expect(run(state, "FX rates", "save", "eur", {
    rate: 1.25, sourceRef: fields.sourceRef, provider: fields.provider,
    observedAt: fields.observedAt,
  }, 1)).toMatchObject({ ok: false, status: 422 })
  expect(state).toEqual(before)
  expect(run(state, "FX rates", "save", "eur", {
    rate: 1.25, sourceRef: fields.sourceRef, provider: fields.provider,
    observedAt: "2026-11-17T11:00:00Z",
  }, 1)).toMatchObject({ ok: true })
  expect(state.versions["v:fx:eur"]?.version).toBe(2)
  const applied = structuredClone(state)
  expect(run(state, "FX rates", "save", "eur", {
    rate: 1.26, sourceRef: "doc:other", provider: "ECB",
    observedAt: "2026-11-17T11:30:00Z",
  }, 1)).toMatchObject({ ok: false, status: 409 })
  expect(state).toEqual(applied)
  // Legacy rates without provenance remain decodable and editable by the original producer.
  expect(run(state, "FX rates", "save", "gbp", { cur: "GBP", rate: null }))
    .toMatchObject({ ok: true })
  expect(rows(plan(state).fx).find((rate) => rate.cur === "GBP")?.rate).toBeNull()
})
