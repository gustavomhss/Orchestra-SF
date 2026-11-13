import { expect, test } from "bun:test"
import { importHostFixture } from "./host-fixture.ts"

test("C04 includes the real Planner C02 impact and never doubles the included forecast", async () => {
  const app = await importHostFixture([72000, 518000])
  try {
    const original = await app.read()
    const preview = await app.prepare([["owned", "Licenses", "owned", "USD", "Forecast", 84000]])
    if (preview.status !== "ok") throw new Error(preview.reason)
    expect(await app.read()).toEqual(original)
    const impact = preview.value.commands[0]!.preview
    expect(impact.engineVersion).toBe("planner-runtime-v1")
    expect(impact.components).toHaveLength(24)
    expect(impact.components.reduce((total, component) => total + (component.amount ?? 0), 0)).toBe(602000)
    expect(impact.components.every((component) => component.evidenceState === "hypothetical")).toBe(true)
    expect(impact.values.find((value) => value.id === "before:owned:1:forecast")?.value).toBe(72000)
    expect(impact.values.find((value) => value.id === "after:owned:1:forecast")?.value).toBe(84000)
    expect(impact.values.find((value) => value.id === "before:foreign:1:forecast")?.value).toBe(518000)
    expect(impact.values.find((value) => value.id === "after:foreign:1:forecast")?.value).toBe(518000)
    expect(impact.values.find((value) => value.id === "after:owned:1:actual")).toMatchObject({ value: null, evidenceState: "absent" })
    expect(impact.context).toMatchObject({ currency: "USD", period: { start: "2027-01-01", end: "2027-12-31" } })
    const applied = await app.apply({ manifestId: preview.value.id, version: preview.value.version })
    expect(applied).toMatchObject({ status: "ok", value: { state: "applied", domainApplied: true } })
    if (applied.status !== "ok") throw new Error(applied.reason)
    expect(applied.value.commands[0]!.preview).toEqual(impact)
    expect(await app.apply({ manifestId: preview.value.id, version: preview.value.version })).toEqual(applied)
  } finally { await app.close() }
})
