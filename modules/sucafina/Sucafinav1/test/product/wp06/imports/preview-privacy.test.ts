import { expect, test } from "bun:test"
import { object, rows } from "../../../../runtime/contract.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { projectPlannerSource } from "../../../../product/planner/port.ts"
import { importHostFixture } from "./host-fixture.ts"

test("C04 budget-owner preview and detail exclude two people's private HR inputs and individual calculated amounts", async () => {
  // The signed session, Planner projection and C08 are real. Budget-owner policy is
  // explicit fixture input: the local operator provider assigns admin, not corporate roles.
  const app = await importHostFixture([72000, 518000], (snapshot) => {
    const version = rows(snapshot.data.versions)[0]!
    version.fx = [{ id: "EUR", cur: "EUR", rate: 1.2 }]
    version.hc = { inc: 10, incMonth: 7, hrAF: {},
      positions: [123456.78, 22222.22].map((rateOverride, index) => ({ id: `private-position-${index}`, name: `Synthetic person ${index}`, title: "Analyst", include: true, domain: "Team", location: "Geneva", type: "Employee", fte: 1, start: 1, end: 12, rateId: "private-rate", rateOverride })),
      rates: [{ id: "private-rate", name: "PRIVATE_RATE_LABEL", locs: "Geneva", annual: 987654.32, cur: "EUR" }] }
  })
  try {
    app.policy.role = "budget owner"
    const before = await app.read()
    const adminProjection = projectPlannerSource(before, { id: app.principal.id, roles: ["admin"], canWrite: true, assigned: [], domains: [] }, "v1")
    if (!adminProjection) throw new Error("Private comparison projection missing")
    const positions = rows(object(adminProjection.summary).positions)
    expect(positions).toHaveLength(2)
    const individualAmounts = positions.flatMap((position) => {
      const months = position.months as number[]
      expect(months).toHaveLength(12)
      expect(months.every((amount) => Number.isFinite(amount) && amount > 0)).toBe(true)
      return [...months, months.reduce((sum, amount) => sum + amount, 0)]
    })
    const preview = await app.prepare([["owned", "Licenses", "owned", "USD", "Forecast", 84000]])
    if (preview.status !== "ok") throw new Error(preview.reason)
    const selection = { manifestId: preview.value.id, version: preview.value.version }
    const digest = digestSfValue(selection)
    const grant = await app.ui.admit(app.request, "sf_import_preview", digest)
    if (grant.status !== "ok" || !await app.ui.validate(grant.value, "sf_import_preview", digest)) throw new Error("Detail grant missing")
    const detail = await app.imports.detail(selection, grant.value)
    app.ui.finish(grant.value)
    if (detail.status !== "ok") throw new Error(detail.reason)
    const publicResult = { manifest: preview.value, detail: detail.value }
    const serialized = JSON.stringify(publicResult)
    expect(serialized).not.toContain("PRIVATE_RATE_LABEL")
    expect(serialized).not.toContain("private-rate")
    const numericValues = new Set<number>()
    const visit = (value: unknown): void => {
      if (typeof value === "number") numericValues.add(value)
      else if (Array.isArray(value)) value.forEach(visit)
      else if (value && typeof value === "object") Object.values(value).forEach(visit)
    }
    visit(publicResult)
    for (const privateAmount of [987654.32, 123456.78, 22222.22, ...individualAmounts]) {
      expect(numericValues.has(privateAmount)).toBe(false)
      expect(serialized).not.toContain(String(privateAmount))
    }
    const impact = preview.value.commands[0]!.preview
    expect(impact.values.find((value) => value.id === "before:owned:1:forecast")?.value).toBe(72000)
    expect(impact.values.find((value) => value.id === "after:owned:1:forecast")?.value).toBe(84000)
    const aggregate = rows(object(adminProjection.summary).hr).find((line) => line.id === "HR:Team")!
    expect(impact.values.find((value) => value.id === "after:HR:Team:1:budget")?.value).toBe((aggregate.b as number[])[0])
    expect(detail.value.receipt).toBeUndefined()
    expect(await app.read()).toEqual(before)
  } finally { await app.close() }
}, 90_000)
