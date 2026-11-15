import { expect, type Browser, type Page, type Request, type Response } from "@playwright/test"
import {
  armLostResponse, nativeDashboardCommandTarget, nativeInstalledFixture,
  observeNativeBinding, requireNativeJourney, type InstalledNativeHarness,
} from "../fixture.ts"

const test = nativeInstalledFixture

/**
 * U15 uses the real F04 installed, owner-scoped Dashboard producer. No
 * route.fulfill, synthetic HTTP success, seeded financial result or fake approval.
 * F04 must explicitly provide the isolated fixture URLs; 120 owns execution.
 */
const fixtures = {
  list: process.env.SF_NATIVE_U15_LIST_URL,
  editable: process.env.SF_NATIVE_U15_EDIT_URL,
  denied: process.env.SF_NATIVE_U15_DENIED_URL,
  stale: process.env.SF_NATIVE_U15_STALE_URL,
  lost: process.env.SF_NATIVE_U15_LOST_RESPONSE_URL,
}
test.use({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" })

type Scenario = keyof typeof fixtures

// The URLs are delivered by the genuine installed F04 host, never constructed
// from an actor/ref or accepted from a different installation or shell.
function installedScenarioURL(harness: InstalledNativeHarness, scenario: Scenario): string {
  const raw = fixtures[scenario]
  if (!raw?.trim()) throw new Error(
    "F04_U15_" + scenario.toUpperCase() + "_REAL_SCENARIO_URL_REQUIRED_FROM_187",
  )
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error("F04_U15_" + scenario.toUpperCase() + "_INVALID_INSTALLED_URL")
  }
  const installed = new URL(harness.manifest.target.chapterHref, harness.manifest.target.shellOrigin)
  const route = "/orchestra/sf-procurement/contracts"
  const isCAP14 = (pathname: string) => pathname === route || pathname.startsWith(route + "/")
  if (!isCAP14(installed.pathname) || !isCAP14(url.pathname) ||
      url.origin !== installed.origin || url.search !== installed.search ||
      url.hash || url.username || url.password)
    throw new Error("F04_U15_" + scenario.toUpperCase() + "_URL_NOT_BOUND_TO_INSTALLED_CAP14_OWNER")
  return url.href
}

// The positive path needs BOTH the current CAP14 admission and the installed
// chapter. A visible component by itself cannot establish a producer grant.
async function proveInstalledActor(
  page: Page, harness: InstalledNativeHarness, intent: "read" | "edit",
) {
  const installed = new URL(harness.manifest.target.chapterHref, harness.manifest.target.shellOrigin)
  await page.goto(installed.href)
  const admission = await harness.requireJourney({ actor: "requester", capabilityId: "CAP14", intent })
  const observed = await harness.proveWeb(surface(page))
  if (admission.principalRef !== harness.manifest.actors.requester ||
      observed.principalRef !== admission.principalRef ||
      observed.candidateSha !== harness.manifest.candidateSha)
    throw new Error("F04_U15_REAL_REQUESTER_SESSION_IDENTITY_MISMATCH")
  return admission
}

type CommandTarget = ReturnType<typeof nativeDashboardCommandTarget>
function isContractMutation(request: Request, target: CommandTarget) {
  const url = new URL(request.url())
  return request.method() === target.method && url.origin === target.origin &&
    url.pathname === target.pathname &&
    Object.entries(target.query ?? {}).every(([name, value]) => {
      const selected = url.searchParams.getAll(name)
      return selected.length === 1 && selected[0] === value
    })
}
function isAuthorizedCAP14Read(response: Response, harness: InstalledNativeHarness) {
  const url = new URL(response.url())
  return response.request().method() === "GET" && response.ok() &&
    url.origin === harness.manifest.target.publicOrigin &&
    url.pathname === harness.manifest.target.mount + "/api/ui/pages/CAP14"
}
function nextAuthorizedRead(page: Page, harness: InstalledNativeHarness) {
  return page.waitForResponse((response) => isAuthorizedCAP14Read(response, harness))
}
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined
}

/** Bind a UI-selected record to its actual producer ID and contracts:id CAS
 * version; an ambiguous/absent source fixture is an explicit failure. */
function sourceRecord(
  envelope: unknown, selection: Readonly<{ id?: string; vendor?: string }>,
) {
  const root = asRecord(envelope)
  const value = asRecord(root?.value)
  const data = asRecord(value?.data)
  const versions = asRecord(value?.versions)
  if (root?.status !== "ok" || value?.capabilityId !== "CAP14" ||
      !Array.isArray(data?.contracts) || !versions ||
      (selection.id === undefined && selection.vendor === undefined))
    throw new Error("F04_U15_REAL_CAP14_SOURCE_PROJECTION_REQUIRED")
  const matches = (data.contracts as unknown[]).map(asRecord).filter((row) => {
    if (!row || (typeof row.id !== "string" && typeof row.id !== "number") ||
        typeof row.vendor !== "string") return false
    return (selection.id === undefined || String(row.id) === selection.id) &&
      (selection.vendor === undefined || row.vendor === selection.vendor)
  })
  if (matches.length !== 1)
    throw new Error("F04_U15_UNIQUE_REAL_CONTRACT_REF_REQUIRED")
  const record = matches[0]!
  const id = String(record.id)
  const version = versions["contracts:" + id]
  if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 0)
    throw new Error("F04_U15_REAL_SOURCE_CAS_VERSION_REQUIRED")
  return { id, version, vendor: record.vendor as string }
}

/** F04 does not manufacture or transfer cookies. The authorized runner must
 * retain a distinct, already Microsoft-authenticated browser context for
 * holder or dashboardAdmin in this SAME Playwright browser. No new context,
 * storageState, header, token, manual grant or API impersonation is created. */
async function requireSecondAdmittedEditor(
  browser: Browser, requester: Page, harness: InstalledNativeHarness,
) {
  let foundIdentityWithoutSave = false
  for (const context of browser.contexts()) {
    if (context === requester.context()) continue
    const other = await context.newPage()
    let binding: Awaited<ReturnType<typeof observeNativeBinding>>
    try {
      binding = await observeNativeBinding(other, harness.manifest.target)
    } catch {
      await other.close()
      continue
    }
    const actor = (["holder", "dashboardAdmin"] as const).find((candidate) =>
      harness.manifest.actors[candidate] === binding.stamp.principalRef)
    if (!actor) {
      await other.close()
      continue
    }
    try {
      await requireNativeJourney({
        page: other, manifest: harness.manifest, actor, capabilityId: "CAP14", intent: "edit",
      })
      return { page: other, actor }
    } catch {
      foundIdentityWithoutSave = true
      await other.close()
    }
  }
  throw new Error(foundIdentityWithoutSave
    ? "F04_U15_DISTINCT_REAL_ACTOR_LACKS_CAP14_SAVE_ADMISSION"
    : "F04_U15_DISTINCT_AUTHENTICATED_EDITOR_BROWSER_CONTEXT_REQUIRED_FROM_187")
}
function surface(page: Page) {
  return page.locator('[data-component="sf-vendor-contracts"]')
}

test("CAP14 real authorized list reads Dashboard contracts and keeps filters on filtered-empty", async ({ page, nativeHarness }) => {
  const url = installedScenarioURL(nativeHarness, "list")
  await proveInstalledActor(page, nativeHarness, "read")
  const responses = nextAuthorizedRead(page, nativeHarness)
  await page.goto(url)
  const read = await (await responses).json()
  expect(read).toMatchObject({ status: "ok", value: { capabilityId: "CAP14" } })
  expect(Array.isArray(read.value.data.contracts)).toBe(true)
  await expect(surface(page)).toBeVisible()
  const filter = surface(page).getByRole("searchbox")
  await filter.fill("~~a-contract-never-matching-authorized-fixture~~")
  await expect(filter).toHaveValue("~~a-contract-never-matching-authorized-fixture~~")
  await expect(surface(page).locator('[data-sf-table-state="filtered-empty"]')).toBeVisible()
  expect(await filter.inputValue()).toContain("never-matching")
})

test("CAP14 real edit uses source version and only dashboard save; confirms after authorized reread", async ({ page, nativeHarness }) => {
  const url = installedScenarioURL(nativeHarness, "editable")
  await proveInstalledActor(page, nativeHarness, "edit")
  const target = nativeDashboardCommandTarget(nativeHarness.manifest, "CAP14")
  const writes: Request[] = []
  page.on("request", (request) => { if (isContractMutation(request, target)) writes.push(request) })
  const beforeRead = nextAuthorizedRead(page, nativeHarness)
  await page.goto(url)
  const source = await (await beforeRead).json()
  const vendor = surface(page).locator('[data-field="vendor"] input')
  await expect(vendor).toBeEditable()
  const original = await vendor.inputValue()
  const record = sourceRecord(source, { vendor: original })
  const nextVendor = original + " u15 isolated e2e"
  await vendor.fill(nextVendor)
  await surface(page).getByRole("button", { name: /Review contract change|Revisar alteração contratual/ }).click()
  const submit = surface(page).getByRole("button", { name: /Confirm|Confirmar/ })
  await expect(submit).toBeEnabled()
  const commandResponse = page.waitForResponse((response) => isContractMutation(response.request(), target))
  await submit.click()
  const response = await commandResponse
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ ok: true })
  const body = response.request().postDataJSON()
  expect(body).toMatchObject({
    page: "Vendor Contracts", action: "save", id: record.id,
    values: { vendor: nextVendor }, version: record.version,
  })
  expect(body.values).not.toHaveProperty("docs")
  expect(body.values).not.toHaveProperty("createdAt")
  expect(body.values).not.toHaveProperty("updatedAt")
  expect(body.values).not.toHaveProperty("ownerId")
  expect(writes).toHaveLength(1)
  expect(response.request().headers()["idempotency-key"]).toEqual(expect.any(String))
  await expect(surface(page).getByRole("status")).toContainText(/verified|verificado/)
  const reread = nextAuthorizedRead(page, nativeHarness)
  await page.reload()
  const after = sourceRecord(await (await reread).json(), { id: record.id })
  expect(after.version).toBeGreaterThan(record.version)
  expect(after.vendor).toBe(nextVendor)
  await expect(surface(page).getByText(nextVendor).first()).toBeVisible()
})

test("CAP14 real denied second actor displays no unauthorized contract values or write control", async ({ page, nativeHarness }) => {
  const url = installedScenarioURL(nativeHarness, "denied")
  const installed = new URL(nativeHarness.manifest.target.chapterHref, nativeHarness.manifest.target.shellOrigin)
  await page.goto(installed.href)
  // Negative proof is the real principal + denied CAP14 destination, NOT a
  // visible authorized chapter. The native UI may hide the whole surface.
  const denied = await requireNativeJourney({
    page, manifest: nativeHarness.manifest, actor: "denied", capabilityId: "CAP14", intent: "denied",
  })
  expect(denied.canRead).toBe(false)
  const target = nativeDashboardCommandTarget(nativeHarness.manifest, "CAP14")
  const writes: Request[] = []
  page.on("request", (request) => { if (isContractMutation(request, target)) writes.push(request) })
  await page.goto(url)
  await expect(surface(page).locator(
    '.sf-u15-layout, .sf-u15-list, .sf-u15-read, .sf-u15-edit, [data-field], [data-component="sf-change-review"]',
  )).toHaveCount(0)
  await expect(surface(page).getByRole("button", { name: /Review contract change|Revisar alteração contratual/ })).toHaveCount(0)
  expect(writes).toHaveLength(0)
})

test("CAP14 real version conflict cannot be shown saved", async ({ page, browser, nativeHarness }) => {
  const url = installedScenarioURL(nativeHarness, "stale")
  await proveInstalledActor(page, nativeHarness, "edit")
  const target = nativeDashboardCommandTarget(nativeHarness.manifest, "CAP14")
  const requesterPosts: Request[] = []
  page.on("request", (request) => { if (isContractMutation(request, target)) requesterPosts.push(request) })
  const initialRead = nextAuthorizedRead(page, nativeHarness)
  await page.goto(url)
  const initialSource = await (await initialRead).json()
  const vendor = surface(page).locator('[data-field="vendor"] input')
  await expect(vendor).toBeEditable()
  const original = await vendor.inputValue()
  const base = sourceRecord(initialSource, { vendor: original })
  await vendor.fill(original + " stale requester")
  await surface(page).getByRole("button", { name: /Review contract change|Revisar alteração contratual/ }).click()
  await expect(surface(page).getByRole("button", { name: /Confirm|Confirmar/ })).toBeEnabled()
  expect(requesterPosts).toHaveLength(0)

  // An actual second Microsoft principal commits a different value to the SAME
  // source id/version before the original review is confirmed. A URL or local
  // client mutation alone is not a producer CAS advance.
  const second = await requireSecondAdmittedEditor(browser, page, nativeHarness)
  try {
    const secondRead = nextAuthorizedRead(second.page, nativeHarness)
    await second.page.goto(url)
    const secondSource = await (await secondRead).json()
    const otherVendor = surface(second.page).locator('[data-field="vendor"] input')
    await expect(otherVendor).toBeEditable()
    const otherCurrent = await otherVendor.inputValue()
    const current = sourceRecord(secondSource, { vendor: otherCurrent })
    expect(current.id).toBe(base.id)
    expect(current.version).toBe(base.version)

    const secondValue = otherCurrent + " u15 concurrent CAS"
    await otherVendor.fill(secondValue)
    await surface(second.page).getByRole("button", { name: /Review contract change|Revisar alteração contratual/ }).click()
    const secondSubmit = surface(second.page).getByRole("button", { name: /Confirm|Confirmar/ })
    await expect(secondSubmit).toBeEnabled()
    const committed = second.page.waitForResponse((response) => isContractMutation(response.request(), target))
    const committedRead = nextAuthorizedRead(second.page, nativeHarness)
    await secondSubmit.click()
    const secondResponse = await committed
    expect(secondResponse.status()).toBe(200)
    expect(await secondResponse.json()).toMatchObject({ ok: true })
    expect(secondResponse.request().postDataJSON()).toMatchObject({
      page: "Vendor Contracts", action: "save", id: base.id,
      version: base.version, values: { vendor: secondValue },
    })
    const advanced = sourceRecord(await (await committedRead).json(), { id: base.id })
    expect(advanced.version).toBeGreaterThan(base.version)
    expect(advanced.vendor).toBe(secondValue)

    // The stale review still carries base.version. Require a real 409, not
    // a client-side failure or a synthetic conflict response.
    const staleResponse = page.waitForResponse((response) => isContractMutation(response.request(), target))
    await surface(page).getByRole("button", { name: /Confirm|Confirmar/ }).click()
    const conflict = await staleResponse
    expect(conflict.status()).toBe(409)
    expect(conflict.request().postDataJSON()).toMatchObject({
      page: "Vendor Contracts", action: "save", id: base.id, version: base.version,
    })
    expect(requesterPosts).toHaveLength(1)
    await expect(surface(page).getByText(/verified after saving|verificado após o salvamento/)).toHaveCount(0)
  } finally {
    await second.page.close()
  }
})

test("CAP14 real lost response does not automatically replay the command", async ({ page, nativeHarness }) => {
  const url = installedScenarioURL(nativeHarness, "lost")
  await proveInstalledActor(page, nativeHarness, "edit")
  const target = nativeDashboardCommandTarget(nativeHarness.manifest, "CAP14")
  expect(target.query?.page).toBe("Vendor Contracts")
  const writes: Request[] = []
  page.on("request", (request) => { if (isContractMutation(request, target)) writes.push(request) })
  const beforeRead = nextAuthorizedRead(page, nativeHarness)
  await page.goto(url)
  const source = await (await beforeRead).json()
  const vendor = surface(page).locator('[data-field="vendor"] input')
  await expect(vendor).toBeEditable()
  const original = await vendor.inputValue()
  const base = sourceRecord(source, { vendor: original })
  const nextVendor = original + " response loss"
  await vendor.fill(nextVendor)
  await surface(page).getByRole("button", { name: /Review contract change|Revisar alteração contratual/ }).click()
  // F04 forwards the single original Vendor Contracts POST to the real producer
  // and discards only the transport response, never forges a business outcome.
  const responseLoss = await armLostResponse(page, target)
  try {
    await surface(page).getByRole("button", { name: /Confirm|Confirmar/ }).click()
    await expect(surface(page).getByRole("alert")).toContainText(/not retry|não reenvie/)
    expect(writes).toHaveLength(1)
    const sent = writes[0]!.postDataJSON()
    expect(sent).toMatchObject({
      page: "Vendor Contracts", action: "save", id: base.id,
      version: base.version, values: { vendor: nextVendor },
    })
    const observed = responseLoss.observations()
    expect(observed.attempts).toBe(1)
    expect(observed.producerStatus).toBe(200)
    // Reconcile by NEW authorized CAP14 GET, not by repeating the POST or
    // trusting the intercepted 2xx as a durable commit.
    const reread = nextAuthorizedRead(page, nativeHarness)
    await surface(page).getByRole("button", { name: /Refresh source|Atualizar fonte/ }).click()
    const result = sourceRecord(await (await reread).json(), { id: base.id })
    expect(result.version).toBeGreaterThan(base.version)
    expect(result.vendor).toBe(nextVendor)
    expect(writes).toHaveLength(1)
    await expect(surface(page).getByText(nextVendor).first()).toBeVisible()
  } finally {
    await responseLoss.dispose()
  }
})

test("CAP14 real owner-scoped 320px reflow and keyboard reachability", async ({ page, nativeHarness }) => {
  const url = installedScenarioURL(nativeHarness, "list")
  await proveInstalledActor(page, nativeHarness, "read")
  await page.goto(url)
  await expect(surface(page)).toBeVisible()
  for (const width of [320, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 800 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await expect(surface(page).getByRole("searchbox")).toBeVisible()
    await expect(surface(page).getByRole("searchbox")).toBeEnabled()
  }
  // U15-AC03 also requires 200% text and 400% reflow at 320 CSS px.
  // Use the installed chapter; never substitute a screenshot or fixture UI.
  for (const [width, scale] of [[768, "200%"], [320, "400%"]] as const) {
    await page.setViewportSize({ width, height: 800 })
    await page.evaluate((size) => { document.documentElement.style.fontSize = size }, scale)
    await expect(surface(page).getByRole("searchbox")).toBeVisible()
    await expect(surface(page).getByRole("searchbox")).toBeEnabled()
    expect(await surface(page).evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  }
  await page.keyboard.press("Tab")
  await expect(page.locator(":focus")).toHaveCount(1)
})
