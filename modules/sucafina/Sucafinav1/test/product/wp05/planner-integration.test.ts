import { expect, test } from "bun:test"
import path from "node:path"
import type { Page } from "@playwright/test"
import { inspectWp05Browser } from "./browser.ts"
import { resolveWaterfall } from "../../../product/analytics/waterfall.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import { plannerDifferencePresentation } from "../../../product/planner/bi-difference.ts"
import { bindProjectedPlannerBiPort, createProjectedPlannerBiSource } from "../../../product/analytics/planner-projected.ts"
import { plannerCapacityPresentation, plannerMonthlyPresentation } from "../../../product/planner/bi.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import { bindPlannerBiPort, createPlannerBiSource } from "../../../product/analytics/planner.ts"
import { createBiDescriptor, readBiPresentation } from "../../../product/analytics/capabilities.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { SfDomainValidation } from "../../../product/contracts/runtime.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { resolve } from "../../../src/identity.ts"
import { testPersistence } from "../../fixture/persistence.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const actor = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }
const initial = (): Snapshot => ({ data: { roleMap: [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }], versions: [72000, 84000].map((license, index) => ({ id: `v${index}`, year: 2027, closed: 9, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: [40000, 45000, 45000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 60000, 60000], a: [null, 0, 45000, 45000, 45000, 45000, 45000, 45000, 50000, null, null, null], f: [null, null, null, null, null, null, null, null, null, 38000, 40000 + license, 40000] }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })) }, versions: {}, sequences: {}, audit: [], notices: [] })

test("real planner projection reaches BI with distinct missing and zero values", async () => {
  const storage = testPersistence({ planner: initial() })
  const refs = ["v0", "v1"].map((id): Extract<BusinessEvidenceRef, { kind: "record" }> => {
    const projection = projectPlannerSource(storage.state.planner, actor, id)!
    const ref: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", refId: id, installationId: "i", projectId: "p", refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "planner-version", recordId: id, incarnation: `inc-${id}`, version: 1, fields: Object.keys(projection), period, projectionDigest: digestSfValue({ versionId: id, projection }) } }
    ref.refDigest = digestSfEvidenceRef(ref)
    return ref
  })
  const ids = { count: 0 }
  const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "finance", policyVersion: "1", accessRevision: "1" }), commandIdentity: async () => "command", createId: () => `request-${++ids.count}`, now: () => Date.parse("2026-11-13T00:00:00Z") })
  const request = { viewId: "BI01", selectionRef: "selection", period }
  const admitted = await ui.admit(new Request("https://example.test"), "sf_bi_view", digestSfValue(request))
  expect(admitted.status).toBe("ok")
  if (admitted.status !== "ok") return
  const context = admitted.value
  expect(await ui.validate(context, "sf_bi_view", digestSfValue(request))).toBe(true)
  const authority: SfDomainValidation = {
    validateDomainContext: async (input, operation, digest) => input.kind === "ui" && await ui.validate(input, operation, digest),
    revalidateDomainContext: async (input) => input.kind === "ui" && await ui.revalidate(input),
    receiptFor: (input, operation, digest, resultDigest) => input.kind === "ui" ? ui.receiptFor(input, operation, digest, resultDigest) : undefined,
  }
  const observations = { count: 0 }
  const planner = createPlannerPort({
    host: { persistence: storage.persistence, authenticate: async (_request, input) => resolve("finance", [...input!.roleMap], (group) => group === "finance-group"), environment: async () => ({ at: new Date(Date.parse("2026-11-13T00:00:00Z") + ++observations.count * 1000).toISOString(), id: () => "unused", directory: [] }), requestFor: (input) => input.kind === "ui" ? ui.requestFor(input) : undefined, revalidate: async (input) => input.kind === "ui" && await ui.revalidate(input) },
    sources: { resolveForecastSource: async (id) => { const ref = refs.find((item) => item.refId === id); return ref ? { status: "ok", value: { versionId: id, evidence: ref } } : { status: "unavailable", reason: "missing" } }, resolveForecastCoverage: async () => ({ status: "unavailable", reason: "missing" }) },
  })
  const host = bindPlannerBiPort({ planner, resolve: async () => ({ status: "ok", value: { comparison: { baseRef: "v0", candidateRef: "v1", period, currency: "USD" }, side: "candidate", present: (analysis) => plannerMonthlyPresentation(analysis.candidate) } }), revalidate: async (_request, input) => input.kind === "ui" && await ui.revalidate(input) })
  const result = await readBiPresentation(request, context, createPlannerBiSource(host), authority)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  const values = result.value.projection.values
  expect(values.find((value) => value.id === "line:1:actual")?.value).toBeNull()
  expect(values.find((value) => value.id === "line:2:actual")?.value).toBe(0)
  expect(observations.count).toBeGreaterThan(1)
  expect(result.value.presentation.series.map((series) => series.role)).toEqual(["budget", "actual", "outlook"])
  expect(result.value.presentation.series.find((series) => series.role === "actual")?.valueIds).toEqual(Array.from({ length: 12 }, (_, index) => `month:${index + 1}:actual`))
  expect(values.find((value) => value.id === "month:1:actual")?.value).toBeNull()
  expect(values.find((value) => value.id === "month:2:actual")?.value).toBe(0)
  expect(values.find((value) => value.id === "line:2:actual")?.drilldown?.refId).toBe("v1")
  const second = await ui.admit(new Request("https://example.test"), "sf_bi_view", digestSfValue(request))
  expect(second.status).toBe("ok")
  if (second.status !== "ok") return
  const dispatchContext = second.value
  const dispatch = () => dispatchSfCapability({ operation: "sf_bi_view", payload: request, context: dispatchContext, descriptors: [createBiDescriptor(createPlannerBiSource(host), authority)], authority, validateInput: (_descriptor, payload) => decodeSfOperationInput("sf_bi_view", payload).ok, validateOutput: (_descriptor, output) => output.status !== "ok" || decodeSfOperationOutput("sf_bi_view", output.result).ok })
  const capability = await dispatch()
  expect(capability.status).toBe("ok")
  if (capability.status === "ok") {
    expect(capability.receipt.handlerExport).toBe("readBiView")
    const output = decodeSfOperationOutput("sf_bi_view", capability.result)
    expect(output.ok).toBe(true)
    if (output.ok) expect(output.value.values.find((value) => value.id === "line:2:actual")?.value).toBe(0)
  }
  expect((await dispatch()).status).toBe("denied")

  await inspectBiProjection(request, result.value, async (page) => {
    const mark = page.getByRole("button", { name: /^actual · month:2:actual: 0 / })
    expect(await mark.count()).toBe(1)
    await mark.click()
    const clicked = JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null")
    await page.evaluate(() => { delete document.body.dataset.selection })
    await mark.focus()
    await page.keyboard.press("Enter")
    const keyed = JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null")
    expect(keyed).toEqual(clicked)
    const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "month:2:actual", exact: true }) })
    expect(await row.getByRole("cell").nth(1).textContent()).toBe("0")
    await row.getByRole("button", { name: "Abrir origem" }).click()
    const tabular = JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null")
    expect(tabular).toEqual(clicked)
    expect(clicked).toMatchObject({ selectionRef: request.selectionRef, valueId: "month:2:actual", context: { period }, visualPeriod: period, reference: { refId: "v1" } })
    expect(clicked.reference).toEqual(values.find((value) => value.id === "month:2:actual")?.drilldown)
    expect(await page.getByRole("row").filter({ has: page.getByRole("cell", { name: "month:1:actual", exact: true }) }).getByRole("cell").nth(1).textContent()).toBe("Indisponível")
  })
}, 180000)


test("real planner comparison supplies the same reconciled waterfall to BI and dispatcher", async () => {
  const initialState = initial()
  const versions = initialState.data.versions as { lines: { a: (number | null)[] }[] }[]
  versions.forEach((version) => { version.lines[0]!.a[0] = 40000; version.lines[0]!.a[1] = 40000 })
  const storage = testPersistence({ planner: initialState })
  const refs = ["v0", "v1"].map((id): Extract<BusinessEvidenceRef, { kind: "record" }> => {
    const projection = projectPlannerSource(storage.state.planner, actor, id)!
    const ref: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", refId: id, installationId: "i", projectId: "p", refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "planner-version", recordId: id, incarnation: `inc-${id}`, version: 1, fields: Object.keys(projection), period, projectionDigest: digestSfValue({ versionId: id, projection }) } }
    ref.refDigest = digestSfEvidenceRef(ref)
    return ref
  })
  const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "finance", policyVersion: "1", accessRevision: "1" }), commandIdentity: async () => "command", createId: () => "waterfall-request", now: () => Date.parse("2026-11-13T00:00:00Z") })
  const request = { viewId: "BI02", selectionRef: "selection", period }
  const admitted = await ui.admit(new Request("https://example.test"), "sf_bi_view", digestSfValue(request))
  expect(admitted.status).toBe("ok")
  if (admitted.status !== "ok") return
  const authority: SfDomainValidation = { validateDomainContext: (input, operation, digest) => input.kind === "ui" ? ui.validate(input, operation, digest) : Promise.resolve(false), revalidateDomainContext: (input) => input.kind === "ui" ? ui.revalidate(input) : Promise.resolve(false), receiptFor: (input, operation, digest, result) => input.kind === "ui" ? ui.receiptFor(input, operation, digest, result) : undefined }
  const planner = createPlannerPort({ host: { persistence: storage.persistence, authenticate: async (_request, input) => resolve("finance", [...input!.roleMap], (group) => group === "finance-group"), environment: async () => ({ at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [] }), requestFor: (input) => input.kind === "ui" ? ui.requestFor(input) : undefined, revalidate: authority.revalidateDomainContext }, sources: { resolveForecastSource: async (id) => { const ref = refs.find((item) => item.refId === id); return ref ? { status: "ok", value: { versionId: id, evidence: ref } } : { status: "unavailable", reason: "missing" } }, resolveForecastCoverage: async () => ({ status: "unavailable", reason: "missing" }) } })
  const source = createProjectedPlannerBiSource(bindProjectedPlannerBiPort({ planner, resolve: async () => ({ status: "ok", value: { comparison: { baseRef: "v0", candidateRef: "v1", period, currency: "USD" }, project: (analysis) => plannerDifferencePresentation(analysis, "BI02") } }), revalidate: async (_request, binding) => authority.revalidateDomainContext(binding) }))
  const dispatched = await dispatchSfCapability({ operation: "sf_bi_view", payload: request, context: admitted.value, descriptors: [createBiDescriptor(source, authority)], authority, validateInput: (_descriptor, value) => decodeSfOperationInput("sf_bi_view", value).ok, validateOutput: (_descriptor, result) => result.status !== "ok" || decodeSfOperationOutput("sf_bi_view", result.result).ok })
  expect(dispatched.status).toBe("ok")
  if (dispatched.status !== "ok") return
  const output = decodeSfOperationOutput("sf_bi_view", dispatched.result)
  expect(output.ok).toBe(true)
  if (!output.ok) return
  expect(output.value.values.find((value) => value.id === "difference:baseline")?.value).toBe(590000)
  expect(output.value.values.find((value) => value.id === "difference:candidate-total")?.value).toBe(602000)
  const uiProjection = await readBiPresentation(request, admitted.value, source, authority)
  expect(uiProjection.status).toBe("ok")
  if (uiProjection.status !== "ok") return
  expect(uiProjection.value.projection).toEqual(output.value)
  expect(uiProjection.value.presentation.waterfall?.reconciliation).toBe("reconciled")

  const plan = uiProjection.value.presentation.waterfall
  expect(plan).toBeDefined()
  if (!plan) return
  const resolved = resolveWaterfall(uiProjection.value.projection, plan)
  expect(resolved.status).toBe("ok")
  if (resolved.status !== "ok") return
  const zero = resolved.segments.find((segment) => segment.amount === 0)
  expect(zero).toBeDefined()
  if (!zero) return
  expect(zero.start).not.toBeNull()
  expect(zero.end).toBe(zero.start)
  expect(zero.source.evidenceState).not.toBe("absent")
  await inspectBiProjection(request, uiProjection.value, async (page) => {
    const mark = page.locator(`svg g[data-bi-value="${zero.componentValueId}"]`)
    expect(await mark.count()).toBe(1)
    expect(await mark.locator("circle").count()).toBe(1)
    const line = mark.locator("line")
    expect(await line.getAttribute("y1")).toBe(await line.getAttribute("y2"))
    expect(await mark.locator("title").textContent()).toBe(`${zero.label}: 0 USD`)
    const composition = page.locator("table").filter({ has: page.locator("caption", { hasText: "Composição e origens" }) })
    const row = composition.getByRole("row").filter({ has: page.getByRole("cell", { name: zero.label, exact: true }) })
    expect(await row.getByRole("cell").nth(2).textContent()).toBe("0")
    const equivalent = page.locator("table").filter({ has: page.locator("caption", { hasText: "Dados e referências" }) })
    expect(await equivalent.getByRole("row").filter({ has: page.getByRole("cell", { name: zero.componentValueId, exact: true }) }).getByRole("cell").nth(1).textContent()).toBe("0")
    expect(await page.locator("body").textContent()).toContain("Reconciliação: reconciled")
  })
}, 180000)


for (const role of ["finance", "viewer"] as const) test(`real planner capacity preserves aligned filtered panels and personal-data absence for ${role}`, async () => {
  const data = initial()
  data.data.roleMap = [{ surface: "planner", role, entra: "finance-group", version: 1, by: "admin" }]
  const scopedActor = { ...actor, roles: [role], canWrite: role === "finance" }
  const versions = data.data.versions as { hc: { positions: { id: string; include: boolean; fte: number; start: number; end: number; type: string; name: string; salary: number }[] } }[]
  versions[1]!.hc.positions = [{ id: "position", include: true, fte: 0.5, start: 1, end: 3, type: "Employee", name: "PRIVATE_NAME_WP05", salary: 97531.25 }]
  const storage = testPersistence({ planner: data })
  const refs = ["v0", "v1"].map((id): Extract<BusinessEvidenceRef, { kind: "record" }> => {
    const source = projectPlannerSource(storage.state.planner, scopedActor, id)!
    const ref: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", refId: id, installationId: "i", projectId: "p", refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "planner-version", recordId: id, incarnation: `inc-${id}`, version: 1, fields: Object.keys(source), period, projectionDigest: digestSfValue({ versionId: id, projection: source }) } }
    ref.refDigest = digestSfEvidenceRef(ref)
    return ref
  })
  const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "finance", policyVersion: "1", accessRevision: "1" }), commandIdentity: async () => "command", createId: () => "capacity-request", now: () => Date.parse("2026-11-13T00:00:00Z") })
  const request = { viewId: "BI04", selectionRef: "selection", period }
  const admission = await ui.admit(new Request("https://example.test"), "sf_bi_view", digestSfValue(request))
  expect(admission.status).toBe("ok")
  if (admission.status !== "ok") return
  const authority: SfDomainValidation = { validateDomainContext: (input, operation, digest) => input.kind === "ui" ? ui.validate(input, operation, digest) : Promise.resolve(false), revalidateDomainContext: (input) => input.kind === "ui" ? ui.revalidate(input) : Promise.resolve(false), receiptFor: (input, operation, digest, result) => input.kind === "ui" ? ui.receiptFor(input, operation, digest, result) : undefined }
  const planner = createPlannerPort({ host: { persistence: storage.persistence, authenticate: async (_request, input) => resolve("finance", [...input!.roleMap], (group) => group === "finance-group"), environment: async () => ({ at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [] }), requestFor: (input) => input.kind === "ui" ? ui.requestFor(input) : undefined, revalidate: authority.revalidateDomainContext }, sources: { resolveForecastSource: async (id) => { const ref = refs.find((item) => item.refId === id); return ref ? { status: "ok", value: { versionId: id, evidence: ref } } : { status: "unavailable", reason: "missing" } }, resolveForecastCoverage: async () => ({ status: "unavailable", reason: "missing" }) } })
  const source = createPlannerBiSource(bindPlannerBiPort({ planner, resolve: async () => ({ status: "ok", value: { comparison: { baseRef: "v0", candidateRef: "v1", period, currency: "USD" }, side: "candidate", present: (analysis) => plannerCapacityPresentation(analysis.candidate) } }), revalidate: async (_request, binding) => authority.revalidateDomainContext(binding) }))
  const output = await dispatchSfCapability({ operation: "sf_bi_view", payload: request, context: admission.value, descriptors: [createBiDescriptor(source, authority)], authority, validateInput: (_descriptor, value) => decodeSfOperationInput("sf_bi_view", value).ok, validateOutput: (_descriptor, result) => result.status !== "ok" || decodeSfOperationOutput("sf_bi_view", result.result).ok })
  expect(output.status).toBe("ok")
  if (output.status !== "ok") return
  const result = await readBiPresentation(request, admission.value, source, authority)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.projection.values.find((value) => value.id === "month:1:fte")).toMatchObject({ value: 0.5, unit: "fte" })
  expect(result.value.projection.values.find((value) => value.id === "month:1:hr-budget")).toMatchObject({ value: null, evidenceState: "absent" })
  expect(result.value.presentation.series.map((series) => series.role)).toEqual(["fte", "cost"])
  expect(result.value.presentation.series[0]?.alignmentKeys).toEqual(result.value.presentation.series[1]?.alignmentKeys)

  expect(JSON.stringify(storage.state.planner.data)).toContain("PRIVATE_NAME_WP05")
  expect(JSON.stringify(storage.state.planner.data)).toContain("97531.25")
  expect(JSON.stringify(result.value)).not.toContain("PRIVATE_NAME_WP05")
  expect(JSON.stringify(result.value)).not.toContain("97531.25")
  if (role === "viewer") {
    const restricted = projectPlannerSource(storage.state.planner, scopedActor, "v1")
    expect(JSON.stringify(restricted)).not.toContain("97531.25")
  }
  await inspectBiProjection(request, result.value, async (page, phase) => {
    phase("capacity-filter")
    const filtered = { start: "2027-02-01", end: "2027-03-31" }
    await page.getByLabel("Início do período", { exact: true }).fill(filtered.start)
    await page.getByLabel("Fim do período", { exact: true }).fill(filtered.end)
    await page.getByRole("button", { name: "Aplicar filtro" }).click()
    expect(await page.locator('svg [data-bi-series="fte"]').count()).toBe(2)
    expect(await page.locator('svg [data-bi-series="cost"]').count()).toBe(0)
    expect(await page.locator("body").textContent()).toContain("Orçamento de pessoas · USD: indisponível")
    for (const month of [2, 3]) {
      phase(`capacity-table:${month}`)
      const fte = page.getByRole("row").filter({ has: page.getByRole("cell", { name: `month:${month}:fte`, exact: true }) })
      const cost = page.getByRole("row").filter({ has: page.getByRole("cell", { name: `month:${month}:hr-budget`, exact: true }) })
      expect(await fte.getByRole("cell").nth(1).textContent()).toBe("0.5")
      expect(await fte.getByRole("cell").nth(2).textContent()).toBe("fte")
      expect(await cost.getByRole("cell").nth(1).textContent()).toBe("Indisponível")
      expect(await cost.getByRole("cell").nth(2).textContent()).toBe("USD")
      expect(await fte.getByRole("cell").nth(3).textContent()).toBe(await cost.getByRole("cell").nth(3).textContent())
      for (const row of [fte, cost]) {
        phase(`capacity-navigation:${month}`)
        await row.getByRole("button", { name: "Abrir origem" }).click()
        const selection = JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null")
        expect(selection.context.period).toEqual(period)
        expect(selection.visualPeriod).toEqual(filtered)
        expect(selection.reference).toEqual(refs[1])
        expect(JSON.stringify(selection)).not.toContain("PRIVATE_NAME_WP05")
        expect(JSON.stringify(selection)).not.toContain("97531.25")
      }
    }
    phase("capacity-exclusions")
    for (const id of ["month:1:fte", "month:1:hr-budget", "month:4:fte", "month:4:hr-budget"]) expect(await page.getByRole("cell", { name: id, exact: true }).count()).toBe(0)
    phase("capacity-html")
    const rendered = await page.content()
    expect(rendered).not.toContain("PRIVATE_NAME_WP05")
    expect(rendered).not.toContain("97531.25")
  })
}, 180000)

async function inspectBiProjection(
  request: Parameters<typeof readBiPresentation>[0],
  value: Extract<Awaited<ReturnType<typeof readBiPresentation>>, { status: "ok" }>["value"],
  inspect: (page: Page, phase: (name: string) => void) => Promise<void>,
) {
  const built = await Bun.build({ entrypoints: [path.resolve(import.meta.dir, "../../../product/analytics/view.ts")], target: "browser", format: "esm" })
  if (!built.success || !built.outputs[0]) throw new Error("analytics browser bundle failed")
  const url = `data:text/javascript;base64,${Buffer.from(await built.outputs[0].text()).toString("base64")}`
  await inspectWp05Browser(`Planner ${request.viewId}`, async (page, phase) => {
    phase("module-import")
    await page.evaluate(async (url) => {
      const module = await import(url)
      if (typeof module.renderBiView !== "function") throw new Error("BI renderer export unavailable")
    }, url)
    phase("render")
    await page.evaluate(async (input) => {
      const module = await import(input.url)
      document.body.append(module.renderBiView(input.request, input.value.projection, (selection: unknown) => { document.body.dataset.selection = JSON.stringify(selection) }, input.value.presentation))
    }, { url, request, value })
    phase("inspect")
    await inspect(page, phase)
  })
}
