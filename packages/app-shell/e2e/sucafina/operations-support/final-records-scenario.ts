import { randomUUID } from "node:crypto"
import { expect } from "@playwright/test"
import type { Page, TestInfo } from "@playwright/test"
import { Schema } from "effect"
import { SfPlanner } from "@orchestra/schema/sucafina/planner"
import { SfFiles } from "@orchestra/schema/sucafina/files"
import type { DocumentEvidence } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { Account } from "./runtime"
import { observation } from "./runtime"

async function versions(page: Page, account: Account) {
  const response = await page.request.get(account.baseURL + "/api/ui/pages/CAP23", { maxRetries: 0 })
  expect(response.status()).toBe(200)
  const body = Schema.decodeUnknownSync(SfPlanner.operations["domain.page.CAP23"].output)(await response.json())
  if (body.status !== "ok") throw new Error("The original Planner did not admit the scenario precondition")
  expect(body.context.principalRef).toBe(account.principal)
  return body.value
}

async function baseline(page: Page, account: Account, version: string, year: number) {
  const response = await page.request.get(account.baseURL + "/api/ui/pages/CAP18?" +
    new URLSearchParams({ version, year: String(year) }), { maxRetries: 0 })
  expect(response.status()).toBe(200)
  const body = Schema.decodeUnknownSync(SfPlanner.operations["domain.page.CAP18"].output)(await response.json())
  if (body.status !== "ok" || !body.value.data.grid) throw new Error("The scenario's original Planner baseline is unavailable")
  expect(body.context.principalRef).toBe(account.principal)
  expect(body.value.data.selectedVersion?.id).toBe(version)
  return { data: body.value.data, versions: body.value.versions }
}

/** Independent fixture preconditions through the original domain commands; this is not UI coverage. */
export async function prepareRecordScenario(page: Page, account: Account) {
  const before = await versions(page, account)
  expect(before.data.versions.length, "the basic native fixture has at most its original Planner version").toBeLessThanOrEqual(1)
  const source = before.data.versions[0]
  const revision = source ? before.versions["versions:" + source.id]?.version : 0
  if (revision === undefined) throw new Error("Copying the original Planner version requires its current CAS")
  const name = "Design test data · Document scenario " + randomUUID()
  const created = await page.request.post(account.baseURL + "/planner?page=Versions", {
    maxRetries: 0, headers: { Origin: account.origin },
    data: { page: "Versions", action: source ? "copy" : "save", ...(source ? { id: source.id } : {}),
      version: revision, confirmed: true,
      values: source ? { name } : {} },
  })
  expect(created.status()).toBe(200)
  expect(await created.json()).toMatchObject({ ok: true })
  // The original HTTP command intentionally publishes no internal result ID.
  // Identify the sole new version from an independently authorized CAP23 read.
  const current = await versions(page, account)
  const own = current.data.versions.filter((entry) => !before.data.versions.some((prior) => prior.id === entry.id))
  expect(own).toHaveLength(1)
  if (source) expect(own[0]!.name).toBe(name)
  const version = own[0]!.id
  const year = own[0]!.year
  const line = randomUUID()
  const saved = await page.request.post(account.baseURL + "/planner", {
    maxRetries: 0, headers: { Origin: account.origin },
    data: { page: "OPEX", action: "save", id: line, version: 0,
      values: { versionId: version, name: "Design test data · Confirmed document amount",
        el: "licenses", cur: "USD", owner: account.principal, f0: 420 } },
  })
  expect(saved.status()).toBe(200)
  expect(await saved.json()).toMatchObject({ ok: true })
  const original = await baseline(page, account, version, year)
  const rows = original.data.grid!.rows.filter((entry) => entry.id === line)
  expect(rows).toHaveLength(1)
  expect(rows[0]!.cells.find((cell) => cell.month === 1)?.forecast.value).toBe(420)
  return { version, year, line, original }
}

export async function previewRecordScenario(page: Page, info: TestInfo, account: Account,
  confirmed: DocumentEvidence, fixture: Awaited<ReturnType<typeof prepareRecordScenario>>) {
  const surface = page.locator('[data-sf-surface="UI60"]')
  const mode = (url: string, kind: string) => {
    const parsed = new URL(url)
    return parsed.origin === account.origin && parsed.pathname === new URL(account.baseURL).pathname + "/procurement" &&
      parsed.searchParams.get("sf") === kind
  }
  const discovered = page.waitForResponse((response) => mode(response.url(), "document-scenario-targets") &&
    response.request().method() === "GET")
  await surface.locator(`[data-sf-evidence-id=${JSON.stringify(confirmed.id)}]`)
    .getByRole("button", { name: "Use confirmed amount in a scenario", exact: true }).click()
  const discovery = await discovered
  expect(discovery.status()).toBe(200)
  const catalog = Schema.decodeUnknownSync(SfFiles.operations["files.document-scenario-targets"].output)(await discovery.json())
  if (catalog.status !== "ok") throw new Error("No authorized scenario target was supplied by the original producer")
  const matches = catalog.value.map((target, index) => ({ target, index })).filter(({ target }) =>
    target.targetRef === fixture.line + ":1" && target.currency === "USD")
  expect(matches).toHaveLength(1)
  const { target, index } = matches[0]!
  await surface.getByRole("combobox", { name: "Planner destination and month", exact: true }).selectOption(String(index))
  const submit = surface.getByRole("button", { name: "Preview scenario", exact: true })
  await expect(submit).toBeEnabled()
  const previewed = page.waitForResponse((response) => mode(response.url(), "document-scenario-preview") &&
    response.request().method() === "POST")
  await submit.click()
  const response = await previewed
  expect(response.status()).toBe(200)
  expect(response.request().postDataJSON()).toEqual({
    documentRef: confirmed.ref, baseRef: target.baseRef, targetRef: target.targetRef, period: target.period,
  })
  const body = Schema.decodeUnknownSync(SfFiles.operations["files.document-scenario-preview"].output)(await response.json())
  if (body.status !== "ok") throw new Error("The original Planner did not produce the requested document scenario")
  expect(body.value.domainApplied).toBe(false)
  expect(body.value.evidence).toEqual(confirmed)
  expect(body.value.request).toEqual({
    baseRef: target.baseRef,
    operations: [{ kind: "replace", targetRef: target.targetRef, amount: 42, currency: "USD", period: target.period }],
    assumptions: [{ id: "document:" + confirmed.id, value: 42, evidenceRefs: [confirmed.ref], state: "confirmed" }],
  })
  expect(body.value.scenario).toMatchObject({
    currency: "USD", sourceRefs: expect.arrayContaining([confirmed.ref]), total: null,
  })
  await expect(surface).toHaveAttribute("data-sf-phase", "preview")
  const preview = surface.locator('[data-sf-scenario="preview"]')
  await expect(preview.getByRole("heading", { name: "Simulation · no changes applied", exact: true })).toBeVisible()
  await expect(preview).toContainText(/Price:\s*42 USD/)
  await expect(preview).toContainText(confirmed.ref.refId)
  expect(await baseline(page, account, fixture.version, fixture.year)).toEqual(fixture.original)
  await observation(info, "final-records-document-scenario", {
    target, request: body.value.request, result: body.value.scenario,
    evidence: body.value.evidence.ref, domainApplied: body.value.domainApplied,
    baselineAndCASUnchanged: true,
    limits: ["The original producer keeps total unavailable because the confirmed field does not establish complete cost coverage.",
      "No persistent scenario link is submitted in this isolated native preview journey."],
  })
}
