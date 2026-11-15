import { expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { armHeldResponse, armLostResponse, requestRealRevocation, nativeDashboardCommandTarget, nativeInstalledFixture, nativeJourneyEntryHref, observeNativeBinding, requireNativeJourney } from "../fixture.ts"
import type { InstalledNativeHarness } from "../fixture.ts"

/**
 * Installed native CAP05 journey. F04/187 supplies the original authenticated
 * installation and identities; without its real private fixture the test
 * fails explicitly. No authorization flags, mocked grants, fake responses,
 * replayed mutations or browser storage-state exports.
 */
const surfaceId = "CAP05"
const title = "CAPEX Projects"
const recordName = "Project name"

/**
 * F04 is the only installed harness. Its private manifest is bound to the
 * candidate and to real installation/actor identities; the caller must also
 * observe CAP04/CAP05 admission from the producer for this exact browser
 * context. Neither an environment flag nor a visible button is a grant.
 *
 * The private chapterHref must match this selected journey. F04/187 owns
 * preparing a separate admitted chapter binding for each selected spec.
 */
async function requireAdmittedSurface(
  page: Page,
  nativeHarness: InstalledNativeHarness,
  intent: "read" | "edit",
) {
  const { manifest } = nativeHarness
  const { target } = manifest
  const href = nativeJourneyEntryHref(target, surfaceId, 2026)
  const requested = new URL(href)
  if (target.chapterHref !== requested.pathname + requested.search) {
    throw new Error("F04_" + surfaceId + "_REAL_CHAPTER_BINDING_REQUIRED")
  }

  await page.goto(href)
  // Select the actor from the currently authenticated producer principal, not
  // from a role name, a flag, or a presumed admin storage state. The real F04
  // fixture must supply this very BrowserContext with an admitted session.
  const current = await observeNativeBinding(page, target)
  const actor = (["requester", "holder", "dashboardAdmin"] as const).find(
    (candidate) => manifest.actors[candidate] === current.stamp.principalRef,
  )
  if (!actor) throw new Error("F04_" + surfaceId + "_REAL_DASHBOARD_ACTOR_REQUIRED")
  const admitted = await requireNativeJourney({
    page, manifest, actor, capabilityId: surfaceId, intent, year: 2026,
  })
  if (admitted.proofClass !== "INSTALLED_CURRENT_CONTEXT_PRECONDITION_ONLY" ||
      admitted.href !== href || admitted.candidateSha !== manifest.candidateSha ||
      !admitted.canRead || (intent === "edit" && !admitted.canSave) ||
      admitted.principalRef !== current.stamp.principalRef ||
      admitted.policyVersion !== current.stamp.policyVersion ||
      admitted.accessRevision !== current.stamp.accessRevision) {
    throw new Error("F04_" + surfaceId + "_CURRENT_JOURNEY_ADMISSION_CHANGED")
  }

  const surface = page.locator('[data-sf-budget="' + surfaceId + '"]')
  const observed = await nativeHarness.proveWeb(surface)
  if (observed.candidateSha !== admitted.candidateSha ||
      observed.principalRef !== admitted.principalRef ||
      observed.installationId !== target.installationId ||
      observed.projectId !== target.projectId ||
      observed.hostId !== target.hostId) {
    throw new Error("F04_" + surfaceId + "_INSTALLED_PRINCIPAL_CHANGED")
  }

  // A capability grant is insufficient if the actual domain-read adapter is
  // unavailable. Re-read the original SfContext in this same browser context;
  // abort on a policy/access revision change, never infer save from a button.
  const contextURL = new URL(target.mount + "/api/ui/context", target.publicOrigin)
  contextURL.search = new URLSearchParams({
    installationId: target.installationId,
    projectId: target.projectId,
    hostId: target.hostId,
  }).toString()
  const response = await page.request.get(contextURL.toString(), {
    maxRedirects: 0, maxRetries: 0,
  })
  if (response.status() !== 200) {
    throw new Error("F04_" + surfaceId + "_REAL_CONTEXT_UNAVAILABLE_" + response.status())
  }
  const envelope = asRecord(await response.json())
  const context = asRecord(envelope?.value)
  const stamp = asRecord(context?.stamp)
  if (envelope?.status !== "ok" || context?.contractRevision !== "sf-native-ui/1" ||
      context?.authMode !== "microsoft" ||
      stamp?.installationId !== target.installationId ||
      stamp?.projectId !== target.projectId ||
      stamp?.hostId !== target.hostId ||
      stamp?.principalRef !== admitted.principalRef ||
      stamp?.policyVersion !== admitted.policyVersion ||
      stamp?.accessRevision !== admitted.accessRevision) {
    throw new Error("F04_" + surfaceId + "_REAL_CONTEXT_STAMP_MISMATCH")
  }

  const destination = Array.isArray(context.destinations)
    ? context.destinations.map(asRecord).find((entry) => entry?.capabilityId === surfaceId)
    : undefined
  const resource = Array.isArray(context.availability)
    ? context.availability.map(asRecord).find((entry) =>
        entry?.family === "domain-read" && entry.resource === surfaceId)
    : undefined
  const operations = resource?.operations
  const readyOperation = (id: string) =>
    Array.isArray(operations) && operations.map(asRecord).some((entry) =>
      entry?.operationId === id && entry.state === "ready" && entry.operational === true)
  if (destination?.surface !== "dashboard" || destination.page !== title ||
      destination.canRead !== true || !readyOperation("domain.page." + surfaceId)) {
    throw new Error("F04_" + surfaceId + "_REAL_READ_GRANT_REQUIRED")
  }
  if (intent === "edit" &&
      (!Array.isArray(destination.allowedActionIds) ||
       !destination.allowedActionIds.includes("save") ||
       !readyOperation("domain.command." + surfaceId + ".save"))) {
    throw new Error("F04_" + surfaceId + "_REAL_SAVE_GRANT_REQUIRED")
  }
  return surface
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

nativeInstalledFixture.describe("N13 CAP05 · installed native Dashboard", () => {
  nativeInstalledFixture("reads the source through A01 with owner-scoped state, filter-empty and source metadata", async ({ page, nativeHarness }) => {
    const surface = await requireAdmittedSurface(page, nativeHarness, "read")
    await expect(surface).toBeVisible()
    await expect(surface.getByRole("heading", { name: title })).toBeVisible()
    // A projection must reach a terminal state before making an empty-state claim.
    await expect(surface.locator(".sf-state-panel").filter({ has: surface.locator(".sf-budget-owners") })).toBeVisible()
    const owners = surface.locator(".sf-budget-owners")
    const search = owners.getByRole("searchbox", { name: "Name" })
    await expect(search).toBeEnabled()
    await search.fill("__N13_Nonexistent_Record_2026__")
    await expect(surface.locator('[data-sf-state="filtered-empty"]')).toBeVisible()
    await expect(search).toHaveValue("__N13_Nonexistent_Record_2026__")
    await search.fill("")
    await expect(search).toHaveValue("")
    await expect(page.locator('[data-sf-budget="' + surfaceId + '"]')).toHaveCount(1)
    // A missing budget is not asserted as numeric zero, and no financial total
    // is calculated in this journey. Source records are compared by identity.
    const table = owners.locator(".sf-s01-table")
    await expect(table).toBeVisible()
    const refs = await table.locator("tbody tr[data-sf-row]").evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-sf-row")))
    if (!refs.length) throw new Error("F04_" + surfaceId + "_REAL_SOURCE_RECORD_REQUIRED")
    expect(refs.every(Boolean)).toBe(true)
    expect(new Set(refs).size).toBe(refs.length)
  })

  nativeInstalledFixture("new record is a draft until explicit, version-bound change review", async ({ page, nativeHarness }) => {
    const surface = await requireAdmittedSurface(page, nativeHarness, "edit")
    const producer = nativeDashboardCommandTarget(nativeHarness.manifest, surfaceId)
    const financialPosts: string[] = []
    page.on("request", (request) => {
      const url = new URL(request.url())
      if (request.method() === producer.method &&
          url.origin === producer.origin && url.pathname === producer.pathname &&
          Object.entries(producer.query ?? {}).every(([key, value]) => {
            const matches = url.searchParams.getAll(key)
            return matches.length === 1 && matches[0] === value
          })) {
        financialPosts.push(request.url())
      }
    })
    const primary = surface.getByRole("button", { name: "New CAPEX project", exact: true })
    await expect(primary).toBeEnabled()
    await primary.click()
    const form = surface.locator(".sf-budget-form")
    await expect(form).toBeVisible()
    await form.getByRole("textbox", { name: recordName, exact: true }).fill("N13 unsaved review")
    const annualBudget = form.getByRole("spinbutton", { name: "Annual budget", exact: true })
    // Absent is not 0. A required source field must block review while blank.
    await annualBudget.fill("")
    await form.getByRole("button", { name: "Review changes", exact: true }).click()
    await expect(surface.locator('[data-component="sf-change-review"]')).toHaveCount(0)
    await expect(annualBudget).toHaveValue("")
    await annualBudget.fill("0")
    await expect(annualBudget).toHaveValue("0")
    await form.getByRole("button", { name: "Review changes", exact: true }).click()
    const review = surface.locator('[data-component="sf-change-review"]')
    await expect(review).toBeVisible()
    await expect(review).toContainText("N13 unsaved review")
    // No confirmation is clicked. Even a recorded 0 is preserved in review.
    await expect(review).toContainText("0")
    expect(financialPosts, "Review must not POST a financial command before human confirmation").toHaveLength(0)
  })

  nativeInstalledFixture("320–1440 viewports, 200% typography and 400% reflow keep surface controls reachable", async ({ page, nativeHarness }) => {
    const surface = await requireAdmittedSurface(page, nativeHarness, "read")
    await expect(surface).toBeVisible()
    for (const width of [320, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(surface).toBeVisible()
      await expect(surface.getByRole("button", { name: "New CAPEX project", exact: true })).toBeVisible()
      await expect(surface.locator(".sf-budget-owners").getByRole("searchbox", { name: "Name" })).toBeVisible()
      const bounds = await surface.evaluate((element) => ({
        client: element.clientWidth,
        scroll: element.scrollWidth,
      }))
      expect(bounds.scroll, surfaceId + " should not overflow the chapter at width " + width)
        .toBeLessThanOrEqual(bounds.client + 1)
    }
    await page.setViewportSize({ width: 768, height: 900 })
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
    await expect(surface).toBeVisible()
    await page.setViewportSize({ width: 320, height: 900 })
    await page.evaluate(() => { document.documentElement.style.fontSize = "400%" })
    await expect(surface.getByRole("heading", { name: title })).toBeVisible()
    await expect(surface.getByRole("button", { name: "New CAPEX project", exact: true })).toBeVisible()
    await expect(surface.locator(".sf-budget-owners").getByRole("searchbox", { name: "Name" })).toBeVisible()
    // Horizontal scrolling is allowed inside the named month-grid region,
    // never by silently clipping or hiding the write/review controls.
    const viewport = await surface.evaluate((element) => ({
      client: element.clientWidth, scroll: element.scrollWidth,
    }))
    expect(viewport.scroll).toBeLessThanOrEqual(viewport.client + 1)
  })
})


/**
 * 206 functional closure of the original CAP04/CAP05 producer.
 *
 * These tests never synthesize an Actor, write through page.request, override
 * producer results, or reuse a Playwright storageState. Every mutation starts
 * in the installed, producer-admitted browser UI and is verified with an
 * independent authenticated GET against the original A01 projection. Missing
 * source/case/grant/fixture is an explicit failure, not a skip or coverage.
 */
type SourceRow = Record<string, unknown>
type SourcePage = Readonly<{
  owners: readonly SourceRow[]
  entries: readonly SourceRow[]
  deviations: Readonly<Record<string, unknown>>
  ytd: Readonly<Record<string, unknown>>
  versions: Readonly<Record<string, unknown>>
  allowedActionIds: readonly string[]
  principalRef: string
  accessRevision: string
}>
const sourceCollection = surfaceId === "CAP04" ? "opexOwners" : "capexProjects"
const sourceEntries = surfaceId === "CAP04" ? "opexEntries" : "capexEntries"
const sourceKind = surfaceId === "CAP04" ? "opex" : "capex"
const newButtonName = surfaceId === "CAP04" ? "New line" : "New CAPEX project"

function sourceRows(value: unknown, label: string): SourceRow[] {
  if (!Array.isArray(value) || !value.every((row) => asRecord(row) !== undefined)) {
    throw new Error("F04_" + surfaceId + "_ORIGINAL_" + label + "_REQUIRED_NOT_EMPTY_DEFAULT")
  }
  return value as SourceRow[]
}

async function originalPage(page: Page, nativeHarness: InstalledNativeHarness): Promise<SourcePage> {
  const target = nativeHarness.manifest.target
  const live = await observeNativeBinding(page, target)
  const url = new URL(target.mount + "/api/ui/pages/" + surfaceId, target.publicOrigin)
  url.searchParams.set("year", "2026")
  const reply = await page.request.get(url.toString(), { maxRedirects: 0, maxRetries: 0 })
  if (reply.status() !== 200) {
    throw new Error("F04_" + surfaceId + "_ORIGINAL_PAGE_HTTP_" + reply.status())
  }
  const envelope = asRecord(await reply.json())
  const stamp = asRecord(envelope?.context)
  const value = asRecord(envelope?.value)
  const data = asRecord(value?.data)
  const versions = asRecord(value?.versions)
  if (envelope?.status !== "ok" || value?.capabilityId !== surfaceId ||
      !stamp || !data || !versions || !Array.isArray(value.allowedActionIds) ||
      stamp.installationId !== target.installationId ||
      stamp.projectId !== target.projectId || stamp.hostId !== target.hostId ||
      stamp.principalRef !== live.stamp.principalRef ||
      stamp.policyVersion !== live.stamp.policyVersion ||
      stamp.accessRevision !== live.stamp.accessRevision) {
    throw new Error("F04_" + surfaceId + "_ORIGINAL_PROJECTION_OWNER_OR_SCHEMA_MISMATCH")
  }
  const ytd = asRecord(data.budgetYtd)
  const group = asRecord(ytd?.[sourceKind])
  return {
    owners: sourceRows(data[sourceCollection], sourceCollection),
    entries: sourceRows(data[sourceEntries], sourceEntries),
    deviations: asRecord(data.deviations) ?? {},
    ytd: group ?? {},
    versions,
    allowedActionIds: value.allowedActionIds as string[],
    principalRef: live.stamp.principalRef,
    accessRevision: live.stamp.accessRevision,
  }
}

function exactOwner(source: SourcePage, id: string): SourceRow {
  const matching = source.owners.filter((owner) => String(owner.id) === id)
  if (matching.length !== 1) throw new Error("F04_" + surfaceId + "_SOURCE_OWNER_NOT_UNIQUE_" + id)
  return matching[0]!
}

function ownerVersion(source: SourcePage, id: string): number {
  const version = source.versions[sourceCollection + ":" + id]
  if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 0) {
    throw new Error("F04_" + surfaceId + "_SOURCE_OWNER_CAS_MISSING_" + id)
  }
  return version
}

function exactEntry(source: SourcePage, id: string, month: number): SourceRow {
  const matching = source.entries.filter((entry) =>
    String(entry.ownerId ?? entry.projId ?? entry.projectId ?? "") === id &&
    entry.year === 2026 && entry.month === month)
  if (matching.length !== 1) {
    throw new Error("F04_" + surfaceId + "_ORIGINAL_MONTH_" + month + "_NOT_UNIQUE")
  }
  return matching[0]!
}

function originalCommandMatches(request: import("@playwright/test").Request, nativeHarness: InstalledNativeHarness): boolean {
  const producer = nativeDashboardCommandTarget(nativeHarness.manifest, surfaceId)
  const url = new URL(request.url())
  return request.method() === producer.method && url.origin === producer.origin &&
    url.pathname === producer.pathname &&
    Object.entries(producer.query ?? {}).every(([key, value]) =>
      url.searchParams.getAll(key).length === 1 && url.searchParams.get(key) === value)
}

async function commitReviewed(
  page: Page,
  nativeHarness: InstalledNativeHarness,
  action: "save" | "delete" | "save-entry" | "save-deviation" | "annual-entry" | "year-amount",
): Promise<SourceRow> {
  const review = page.locator('[data-sf-budget="' + surfaceId + '"] [data-component="sf-change-review"]')
  await expect(review).toBeVisible()
  const requests: import("@playwright/test").Request[] = []
  const monitor = (request: import("@playwright/test").Request) => {
    if (originalCommandMatches(request, nativeHarness)) requests.push(request)
  }
  page.on("request", monitor)
  try {
    const pending = page.waitForRequest((request) => {
      if (!originalCommandMatches(request, nativeHarness)) return false
      const input = asRecord(request.postDataJSON())
      return input?.action === action && input.page === title
    })
    await review.getByRole("button", { name: action === "delete" ? "Delete" : "Save", exact: true }).click()
    const request = await pending
    const command = asRecord(request.postDataJSON())
    const values = asRecord(command?.values)
    if (command?.page !== title || command?.action !== action ||
        !values || !asRecord(values.versions) ||
        typeof command.version !== "number" || command.version < 0 ||
        !/^[A-Za-z0-9._:-]{8,128}$/.test(request.headers()["idempotency-key"] ?? "")) {
      throw new Error("F04_" + surfaceId + "_NON_CANONICAL_SOURCE_COMMAND_" + action)
    }
    const response = await request.response()
    if (!response || response.status() !== 200) {
      throw new Error("F04_" + surfaceId + "_ORIGINAL_WRITE_REFUSED_" + (response?.status() ?? "NO_RESPONSE"))
    }
    const result = asRecord(await response.json())
    if (result?.ok !== true) {
      throw new Error("F04_" + surfaceId + "_ORIGINAL_PRODUCER_DID_NOT_COMMIT_" + action)
    }
    await expect(review).toHaveCount(0)
    expect(requests, "one reviewed user intent must have one original producer POST").toHaveLength(1)
    return command as SourceRow
  } finally {
    page.off("request", monitor)
  }
}

function ownerRow(surface: import("@playwright/test").Locator, name: string) {
  return surface.locator(".sf-budget-owners tbody tr[data-sf-row]").filter({ hasText: name })
}

async function openOwner(
  surface: import("@playwright/test").Locator, name: string, id: string,
) {
  const row = ownerRow(surface, name)
  await expect(row).toHaveCount(1)
  await expect(row).toHaveAttribute("data-sf-row", id)
  await row.locator('button[data-sf-action="select"]').click()
  const detail = surface.locator(".sf-budget-detail [data-sf-record-detail]")
  await expect(detail).toBeVisible()
  await expect(detail.locator("[data-sf-detail-heading]")).toContainText(name)
  return detail
}

async function reviewForm(surface: import("@playwright/test").Locator) {
  const form = surface.locator(".sf-budget-editor .sf-budget-form")
  await expect(form).toBeVisible()
  await form.getByRole("button", { name: "Review changes", exact: true }).click()
  const review = surface.locator('[data-component="sf-change-review"]')
  await expect(review).toBeVisible()
  return review
}

async function createRealOwner(
  page: Page, nativeHarness: InstalledNativeHarness,
  surface: import("@playwright/test").Locator,
  name: string, budget: string,
): Promise<string> {
  const before = await originalPage(page, nativeHarness)
  if (before.owners.some((owner) => owner.name === name)) {
    throw new Error("F04_" + surfaceId + "_RECORD_ALREADY_EXISTS_NO_REPLAY")
  }
  await surface.getByRole("button", { name: newButtonName, exact: true }).click()
  const form = surface.locator(".sf-budget-editor .sf-budget-form")
  await expect(form).toBeVisible()
  await form.getByRole("textbox", { name: recordName, exact: true }).fill(name)
  await form.getByRole("spinbutton", { name: "Annual budget", exact: true }).fill(budget)
  await reviewForm(surface)
  const write = await commitReviewed(page, nativeHarness, "save")
  expect(write.id).toBeUndefined()
  expect(asRecord(write.values)?.budget).toBe(Number(budget))
  await expect.poll(async () =>
    (await originalPage(page, nativeHarness)).owners.filter((owner) => owner.name === name).length,
  ).toBe(1)
  const next = await originalPage(page, nativeHarness)
  const owner = next.owners.find((entry) => entry.name === name)!
  expect(owner.budget).toBe(Number(budget))
  const id = String(owner.id)
  ownerVersion(next, id)
  await expect(ownerRow(surface, name)).toHaveCount(1)
  return id
}

async function deleteRealOwner(
  page: Page, nativeHarness: InstalledNativeHarness,
  surface: import("@playwright/test").Locator,
  name: string, id: string,
): Promise<void> {
  const before = await originalPage(page, nativeHarness)
  const version = ownerVersion(before, id)
  const detail = await openOwner(surface, name, id)
  await detail.getByRole("button", { name: "Delete", exact: true }).click()
  const write = await commitReviewed(page, nativeHarness, "delete")
  expect(write.id).toBe(id)
  expect(write.version).toBe(version)
  await expect.poll(async () =>
    (await originalPage(page, nativeHarness)).owners.filter((row) => String(row.id) === id).length,
  ).toBe(0)
  await expect(ownerRow(surface, name)).toHaveCount(0)
}

const budgetScenario = (label: string) => "N206 " + surfaceId + " " + label + " " + crypto.randomUUID().slice(0, 12)

nativeInstalledFixture.describe("206 " + surfaceId + " · COMPLETE original-producer functional contracts", () => {
  nativeInstalledFixture("206-AC01 create/edit/delete producer owner CAS and removed detail do not become an empty collection", async ({ page, nativeHarness }) => {
    const surface = await requireAdmittedSurface(page, nativeHarness, "edit")
    const name = budgetScenario("CRUD")
    const id = await createRealOwner(page, nativeHarness, surface, name, "0")
    const created = await originalPage(page, nativeHarness)
    expect(exactOwner(created, id).budget, "Observed zero is a source number, not absence").toBe(0)
    const initialVersion = ownerVersion(created, id)
    const detail = await openOwner(surface, name, id)
    const removedHref = page.url()
    await detail.getByRole("button", { name: "Edit", exact: true }).click()
    const form = surface.locator(".sf-budget-editor .sf-budget-form")
    await expect(form.getByRole("textbox", { name: recordName, exact: true })).toHaveValue(name)
    await form.getByRole("spinbutton", { name: "Annual budget", exact: true }).fill("345.67")
    await reviewForm(surface)
    const changed = await commitReviewed(page, nativeHarness, "save")
    expect(changed.id).toBe(id)
    expect(changed.version).toBe(initialVersion)
    await expect.poll(async () => exactOwner(await originalPage(page, nativeHarness), id).budget).toBe(345.67)
    const updated = await originalPage(page, nativeHarness)
    expect(ownerVersion(updated, id)).toBeGreaterThan(initialVersion)
    // Delete goes through the original record menu, never a request made by the test.
    await deleteRealOwner(page, nativeHarness, surface, name, id)
    await page.goto(removedHref)
    await expect(surface.locator('[data-sf-state="not-found"]')).toBeVisible()
    const remaining = await originalPage(page, nativeHarness)
    if (remaining.owners.length > 0) {
      await expect(surface.locator('[data-sf-state="empty"]')).toHaveCount(0)
    }
    await expect(surface.locator(".sf-budget-detail [data-sf-record-detail]")).toHaveCount(0)
  })

  nativeInstalledFixture("206-AC01 monthly entry create/edit preserves exact budget, actual, forecast, month and CAS", async ({ page, nativeHarness }) => {
    const surface = await requireAdmittedSurface(page, nativeHarness, "edit")
    const name = budgetScenario("monthly")
    const id = await createRealOwner(page, nativeHarness, surface, name, "123")
    const detail = await openOwner(surface, name, id)
    const month = detail.locator(".sf-budget-months tr[data-sf-month='3']")
    await expect(month).toBeVisible()
    await month.getByRole("button", { name: "Save month", exact: true }).click()
    let form = surface.locator(".sf-budget-form")
    await expect(form.getByRole("spinbutton", { name: "Month" })).toHaveValue("3")
    await form.getByRole("spinbutton", { name: "budget", exact: true }).fill("0")
    await form.getByRole("spinbutton", { name: "actual", exact: true }).fill("12.5")
    await form.getByRole("spinbutton", { name: "forecast", exact: true }).fill("22")
    await reviewForm(surface)
    const firstCommand = await commitReviewed(page, nativeHarness, "save-entry")
    expect(firstCommand.id).toBeUndefined()
    expect(asRecord(firstCommand.values)?.month).toBe(3)
    await expect.poll(async () => exactEntry(await originalPage(page, nativeHarness), id, 3).actual).toBe(12.5)
    let source = await originalPage(page, nativeHarness)
    const created = exactEntry(source, id, 3)
    expect(created.budget).toBe(0)
    expect(created.forecast).toBe(22)
    const entryKey = sourceEntries + ":" + String(created.id)
    const entryVersion = source.versions[entryKey]
    expect(typeof entryVersion).toBe("number")
    await expect(month).toContainText("12.5")
    await expect(month).toContainText("22")
    await month.getByRole("button", { name: "Save month", exact: true }).click()
    form = surface.locator(".sf-budget-form")
    await expect(form.getByRole("spinbutton", { name: "actual", exact: true })).toHaveValue("12.5")
    await form.getByRole("spinbutton", { name: "actual", exact: true }).fill("0")
    await form.getByRole("spinbutton", { name: "budget", exact: true }).fill("7")
    await reviewForm(surface)
    const secondCommand = await commitReviewed(page, nativeHarness, "save-entry")
    expect(secondCommand.id).toBe(String(created.id))
    expect(secondCommand.version).toBe(entryVersion)
    await expect.poll(async () => exactEntry(await originalPage(page, nativeHarness), id, 3).actual).toBe(0)
    source = await originalPage(page, nativeHarness)
    expect(exactEntry(source, id, 3).budget).toBe(7)
    expect(exactEntry(source, id, 3).forecast).toBe(22)
    expect(source.versions[entryKey]).toEqual(expect.any(Number))
    expect(source.versions[entryKey]).toBeGreaterThan(entryVersion as number)
    await deleteRealOwner(page, nativeHarness, surface, name, id)
    const afterDelete = await originalPage(page, nativeHarness)
    expect(afterDelete.entries.filter((entry) =>
      String(entry.ownerId ?? entry.projId ?? entry.projectId ?? "") === id)).toHaveLength(0)
  })

  nativeInstalledFixture("206-AC01 annual distribution fields use producer's twelve rows and original versions", async ({ page, nativeHarness }) => {
    const surface = await requireAdmittedSurface(page, nativeHarness, "edit")
    const name = budgetScenario("annual")
    const id = await createRealOwner(page, nativeHarness, surface, name, "2400")
    const detail = await openOwner(surface, name, id)
    const before = await originalPage(page, nativeHarness)
    const version = ownerVersion(before, id)
    await detail.getByRole("button", { name: "Apply annual entry", exact: true }).click()
    const form = surface.locator(".sf-budget-form")
    await form.getByRole("spinbutton", { name: "Annual Entry ÷12" }).fill("1200")
    await form.getByRole("combobox", { name: "Field" }).selectOption("budget")
    await reviewForm(surface)
    const command = await commitReviewed(page, nativeHarness, "annual-entry")
    expect(command.id).toBe(id)
    expect(command.version).toBe(version)
    expect(asRecord(command.values)?.annual).toBe(1200)
    await expect.poll(async () => {
      const current = await originalPage(page, nativeHarness)
      return current.entries.filter((entry) =>
        String(entry.ownerId ?? entry.projId ?? entry.projectId ?? "") === id &&
        entry.year === 2026).length
    }).toBe(12)
    const source = await originalPage(page, nativeHarness)
    for (let monthIndex = 1; monthIndex <= 12; monthIndex++) {
      const record = exactEntry(source, id, monthIndex)
      await expect(detail.locator(".sf-budget-months tr[data-sf-month='" + monthIndex + "']"))
        .toContainText(String(record.budget))
    }
    expect(exactOwner(source, id).budget).toBe(1200)
    expect(ownerVersion(source, id)).toBeGreaterThan(version)
    // A separate actual annual command must not overwrite forecast or create a Planner state.
    await detail.getByRole("button", { name: "Apply annual entry", exact: true }).click()
    await surface.locator(".sf-budget-form").getByRole("spinbutton", { name: "Annual Entry ÷12" }).fill("240")
    await surface.locator(".sf-budget-form").getByRole("combobox", { name: "Field" }).selectOption("actual")
    await reviewForm(surface)
    const actualCommand = await commitReviewed(page, nativeHarness, "annual-entry")
    expect(asRecord(actualCommand.values)?.field).toBe("actual")
    const after = await originalPage(page, nativeHarness)
    expect(exactOwner(after, id).budget).toBe(1200)
    for (let n = 1; n <= 12; n++) {
      expect(exactEntry(after, id, n).budget).toBe(exactEntry(source, id, n).budget)
    }
    await deleteRealOwner(page, nativeHarness, surface, name, id)
  })

  nativeInstalledFixture("206-AC01 year amount records hint, actual/forecast, clearing and immutable monthly source", async ({ page, nativeHarness }) => {
    const surface = await requireAdmittedSurface(page, nativeHarness, "edit")
    const name = budgetScenario("YTD")
    const id = await createRealOwner(page, nativeHarness, surface, name, "900")
    const detail = await openOwner(surface, name, id)
    const before = await originalPage(page, nativeHarness)
    await detail.getByRole("button", { name: "Apply year amount", exact: true }).click()
    let form = surface.locator(".sf-budget-form")
    await form.getByRole("spinbutton", { name: "Year amount", exact: true }).fill("0")
    await reviewForm(surface)
    const command = await commitReviewed(page, nativeHarness, "year-amount")
    expect(asRecord(command.values)?.amount).toBe(0)
    await expect.poll(async () =>
      asRecord((await originalPage(page, nativeHarness)).ytd["2026:" + id])?.amount,
    ).toBe(0)
    let source = await originalPage(page, nativeHarness)
    expect(asRecord(source.ytd["2026:" + id])?.amount).toBe(0)
    const beforeClear = source.entries.filter((entry) =>
      String(entry.ownerId ?? entry.projId ?? entry.projectId ?? "") === id &&
      entry.year === 2026)
    expect(beforeClear).toHaveLength(12)
    await detail.getByRole("button", { name: "Apply year amount", exact: true }).click()
    form = surface.locator(".sf-budget-form")
    await expect(form.getByRole("spinbutton", { name: "Year amount", exact: true })).toHaveValue("0")
    await form.getByRole("spinbutton", { name: "Year amount", exact: true }).fill("")
    await reviewForm(surface)
    const clear = await commitReviewed(page, nativeHarness, "year-amount")
    expect(asRecord(clear.values)?.amount).toBeNull()
    await expect.poll(async () =>
      Object.hasOwn((await originalPage(page, nativeHarness)).ytd, "2026:" + id),
    ).toBe(false)
    source = await originalPage(page, nativeHarness)
    for (const old of beforeClear) {
      const next = exactEntry(source, id, Number(old.month))
      expect(next.actual, "clearing a year hint must not rewrite monthly actual").toBe(old.actual)
      expect(next.forecast, "clearing a year hint must not rewrite monthly forecast").toBe(old.forecast)
    }
    await deleteRealOwner(page, nativeHarness, surface, name, id)
  })

  nativeInstalledFixture("206-AC01 deviation severity and text use one original versioned record", async ({ page, nativeHarness }) => {
    const surface = await requireAdmittedSurface(page, nativeHarness, "edit")
    const name = budgetScenario("deviation")
    const id = await createRealOwner(page, nativeHarness, surface, name, "750")
    const detail = await openOwner(surface, name, id)
    const month = detail.locator(".sf-budget-months tr[data-sf-month='7']")
    const deviationKey = "deviations:" + sourceKind + "-" + id + "-2026-7"
    await month.getByRole("button", { name: "Save deviation", exact: true }).click()
    let form = surface.locator(".sf-budget-form")
    await form.getByRole("combobox", { name: "Flag" }).selectOption("dev-amber")
    await form.getByRole("textbox", { name: "Deviation notes" }).fill("N206 observed original source evidence")
    await reviewForm(surface)
    const command = await commitReviewed(page, nativeHarness, "save-deviation")
    expect(command.id).toBe(id)
    expect(asRecord(command.values)?.month).toBe(7)
    await expect.poll(async () =>
      asRecord((await originalPage(page, nativeHarness)).deviations[sourceKind + "-" + id + "-2026-7])?.flag,
    ).toBe("dev-amber")
    const before = await originalPage(page, nativeHarness)
    const priorVersion = before.versions[deviationKey]
    expect(typeof priorVersion).toBe("number")
    await expect(month).toContainText("N206 observed original source evidence")
    await month.getByRole("button", { name: "Save deviation", exact: true }).click()
    form = surface.locator(".sf-budget-form")
    await expect(form.getByRole("textbox", { name: "Deviation notes" }))
      .toHaveValue("N206 observed original source evidence")
    await form.getByRole("combobox", { name: "Flag" }).selectOption("dev-red")
    await form.getByRole("textbox", { name: "Deviation notes" }).fill("N206 updated producer deviation")
    await reviewForm(surface)
    const updated = await commitReviewed(page, nativeHarness, "save-deviation")
    expect(updated.version).toBe(priorVersion)
    await expect.poll(async () =>
      asRecord((await originalPage(page, nativeHarness)).deviations[sourceKind + "-" + id + "-2026-7])?.text,
    ).toBe("N206 updated producer deviation")
    const after = await originalPage(page, nativeHarness)
    expect(asRecord(after.deviations[sourceKind + "-" + id + "-2026-7])?.flag).toBe("dev-red")
    expect(after.versions[deviationKey]).toBeGreaterThan(priorVersion as number)
    await deleteRealOwner(page, nativeHarness, surface, name, id)
  })
})


/**
 * 206 negative/state/accessibility additions. All tests are declared even
 * when a private installed case is not provisioned. In those situations they
 * fail with F04_REQUIRED_... rather than marking a scenario skipped/passed.
 */
function requireRegisteredLiveCase(
  nativeHarness: InstalledNativeHarness,
  caseName: string,
): void {
  const selected = nativeHarness.selected
  if (!selected || selected.suite !== (surfaceId === "CAP04" ? "U39" : "U40") ||
      !selected.selections.some((entry) => entry.caseId === caseName)) {
    throw new Error("F04_REQUIRED_" + surfaceId + "_SELECTED_LIVE_CASE_" + caseName)
  }
}

function reportableIds(source: SourcePage) {
  return source.owners.map((owner) => String(owner.id))
}

nativeInstalledFixture.describe("206 " + surfaceId + " · FULL states, identities, failures and accessibility", () => {
  nativeInstalledFixture("206-AC02 filter survives list/detail/back, source record remains selected and source metadata is original", async ({ page, nativeHarness }) => {
    const surface = await requireAdmittedSurface(page, nativeHarness, "edit")
    const name = budgetScenario("filtered")
    const id = await createRealOwner(page, nativeHarness, surface, name, "83")
    const owners = surface.locator(".sf-budget-owners")
    const search = owners.getByRole("searchbox", { name: "Name" })
    await search.fill(name)
    await expect(ownerRow(surface, name)).toHaveCount(1)
    const detail = await openOwner(surface, name, id)
    const source = await originalPage(page, nativeHarness)
    const metadata = detail.locator('[data-sf-field="source-version"]')
    await expect(metadata).toContainText(String(ownerVersion(source, id)))
    await expect(detail.locator(".sf-budget-source")).toContainText(sourceCollection + ":" + id)
    await detail.getByRole("button", { name: "Back", exact: true }).click()
    await expect(search, "NAV-01 should retain filters across the original route ref").toHaveValue(name)
    await expect(ownerRow(surface, name)).toHaveCount(1)
    await search.fill("__N206_CANNOT_MATCH_ANY_ORIGINAL_SOURCE__")
    await expect(surface.locator('[data-sf-state="filtered-empty"]')).toBeVisible()
    await expect(surface.locator('[data-sf-state="empty"]')).toHaveCount(0)
    await expect(search).toHaveValue("__N206_CANNOT_MATCH_ANY_ORIGINAL_SOURCE__")
    await search.fill("")
    await deleteRealOwner(page, nativeHarness, surface, name, id)
  })

  nativeInstalledFixture("206-AC02 a genuinely empty original collection is empty, not filtered-empty, partial or not-found", async ({ page, nativeHarness }) => {
    // 199 must provision an isolated producer collection with 0 original rows.
    // A filter-empty search over a populated producer is NEVER this scenario.
    requireRegisteredLiveCase(nativeHarness, "empty")
    const surface = await requireAdmittedSurface(page, nativeHarness, "read")
    const source = await originalPage(page, nativeHarness)
    if (source.owners.length !== 0) {
      throw new Error("F04_REQUIRED_" + surfaceId + "_GENUINE_ZERO_ROW_COLLECTION")
    }
    await expect(surface.locator('[data-sf-state="empty"]')).toBeVisible()
    await expect(surface.locator('[data-sf-state="filtered-empty"]')).toHaveCount(0)
    await expect(surface.locator('[data-sf-state="not-found"]')).toHaveCount(0)
    await expect(surface.locator(".sf-budget-owners tr[data-sf-row]")).toHaveCount(0)
  })

  nativeInstalledFixture("206-AC02 not-found deep link is distinct from empty and never resurrects a removed record", async ({ page, nativeHarness }) => {
    const surface = await requireAdmittedSurface(page, nativeHarness, "edit")
    const name = budgetScenario("removed")
    const id = await createRealOwner(page, nativeHarness, surface, name, "12")
    await openOwner(surface, name, id)
    const actualResolvedHref = page.url()
    const before = await originalPage(page, nativeHarness)
    expect(reportableIds(before)).toContain(id)
    await deleteRealOwner(page, nativeHarness, surface, name, id)
    await page.goto(actualResolvedHref)
    await expect(surface.locator('[data-sf-state="not-found"]')).toBeVisible()
    await expect(surface.locator('[data-sf-state="filtered-empty"]')).toHaveCount(0)
    await expect(surface.locator(".sf-budget-detail")).toHaveCount(0)
    expect(reportableIds(await originalPage(page, nativeHarness))).not.toContain(id)
  })

  nativeInstalledFixture("206-AC01 authorized producer source link and 2026 identity, with CAP04-only import control", async ({ page, nativeHarness }) => {
    requireRegisteredLiveCase(nativeHarness, "source")
    const surface = await requireAdmittedSurface(page, nativeHarness, "read")
    const original = await originalPage(page, nativeHarness)
    const selected = original.owners.filter((owner) =>
      typeof owner.name === "string" && String(owner.name).trim() && owner.id !== undefined)
    if (!selected.length) throw new Error("F04_REQUIRED_" + surfaceId + "_SOURCE_LINK_ORIGINAL_RECORD")
    const source = selected[0]!
    const detail = await openOwner(surface, String(source.name), String(source.id))
    const originalRef = sourceCollection + ":" + String(source.id)
    await expect(detail.locator(".sf-budget-source")).toContainText(originalRef)
    const current = await observeNativeBinding(page, nativeHarness.manifest.target)
    const linked = current.destinations.find((destination) =>
      destination.capabilityId === "CAP03" && destination.canRead)
    if (!linked) throw new Error("F04_REQUIRED_" + surfaceId + "_ORIGINAL_AUTHORIZED_CAP03_SOURCE_LINK")
    const link = detail.getByRole("button", { name: "View source", exact: true })
    await expect(link).toBeEnabled()
    await link.click()
    await expect(page).toHaveURL(/\/orchestra\/sf-dashboard\/budget\?/)
    const href = new URL(page.url())
    expect(href.searchParams.get("year")).toBe("2026")
    // The route carries only the real owner selection; no copied private data.
    expect(href.searchParams.get("project") ?? nativeHarness.manifest.target.projectId)
      .toBe(nativeHarness.manifest.target.projectId)
    await page.goto(nativeJourneyEntryHref(nativeHarness.manifest.target, surfaceId, 2026))
    await expect(surface).toBeVisible()
    if (surfaceId === "CAP05") {
      await expect(surface.getByRole("link", { name: "Import Excel", exact: true })).toHaveCount(0)
    } else {
      const permissions = await originalPage(page, nativeHarness)
      const importControl = surface.getByRole("link", { name: "Import Excel", exact: true })
      if (permissions.allowedActionIds.includes("import")) {
        await expect(importControl).toBeVisible()
        await expect(importControl).toHaveAttribute("href", /\/orchestra\/sf-imports\/new/)
      } else {
        await expect(importControl).toHaveCount(0)
      }
    }
  })

  nativeInstalledFixture("206-AC02 real read-only principal sees source but no enabled mutation or private false affordance", async ({ page, nativeHarness }) => {
    requireRegisteredLiveCase(nativeHarness, "readonly")
    const surface = await requireAdmittedSurface(page, nativeHarness, "read")
    const real = await observeNativeBinding(page, nativeHarness.manifest.target)
    const readOnly = real.destinations.find((entry) => entry.capabilityId === surfaceId)
    if (!readOnly?.canRead || readOnly.allowedActionIds.includes("save")) {
      throw new Error("F04_REQUIRED_" + surfaceId + "_Genuine_READ_ONLY_PRINCIPAL")
    }
    const source = await originalPage(page, nativeHarness)
    await expect(surface.getByRole("button", { name: newButtonName, exact: true })).toBeDisabled()
    const rows = surface.locator(".sf-budget-owners tr[data-sf-row]")
    await expect(rows).toHaveCount(source.owners.length)
    await expect(rows.locator('button[data-sf-action="edit"]:not([disabled])')).toHaveCount(0)
    await expect(rows.locator('button[data-sf-action="delete"]:not([disabled])')).toHaveCount(0)
    const observation: import("@playwright/test").Request[] = []
    const listener = (request: import("@playwright/test").Request) => {
      if (originalCommandMatches(request, nativeHarness)) observation.push(request)
    }
    page.on("request", listener)
    try {
      const search = surface.locator(".sf-budget-owners").getByRole("searchbox", { name: "Name" })
      await search.fill("__N206_FILTER_DOES_NOT_GRANT_WRITE__")
      await expect(surface.locator('[data-sf-state="filtered-empty"]')).toBeVisible()
      await search.fill("")
      expect(observation).toHaveLength(0)
    } finally { page.off("request", listener) }
  })

  nativeInstalledFixture("206-AC02 denied original Microsoft actor never renders private rows, draft or edit, and denial is not empty", async ({ page, nativeHarness }) => {
    requireRegisteredLiveCase(nativeHarness, "denied")
    const { manifest } = nativeHarness
    await page.goto(nativeJourneyEntryHref(manifest.target, surfaceId, 2026))
    const denied = await requireNativeJourney({
      page, manifest, actor: "denied", capabilityId: surfaceId, intent: "denied", year: 2026,
    })
    expect(denied.canRead).toBe(false)
    const live = await observeNativeBinding(page, manifest.target)
    expect(live.stamp.principalRef).toBe(manifest.actors.denied)
    await expect(page.locator('[data-sf-budget="' + surfaceId + '"] .sf-budget-owners tr[data-sf-row]'))
      .toHaveCount(0)
    await expect(page.locator('[data-sf-budget="' + surfaceId + '"] .sf-budget-editor')).toHaveCount(0)
    await expect(page.locator('[data-sf-budget="' + surfaceId + '"] [data-sf-state="empty"]')).toHaveCount(0)
    await expect.poll(async () =>
      page.locator('[data-sf-state="denied"], [data-sf-state="session-expired"]').count(),
    ).toBeGreaterThan(0)
  })

  nativeInstalledFixture("206-AC02 real producer revocation while editing erases private draft after a new host read", async ({ page, nativeHarness }) => {
    requireRegisteredLiveCase(nativeHarness, "revoked")
    const surface = await requireAdmittedSurface(page, nativeHarness, "edit")
    const source = await originalPage(page, nativeHarness)
    const owner = source.owners.find((row) => typeof row.name === "string" && !!String(row.name).trim())
    if (!owner) throw new Error("F04_REQUIRED_" + surfaceId + "_REAL_REVOCABLE_SOURCE_RECORD")
    const name = String(owner.name)
    const detail = await openOwner(surface, name, String(owner.id))
    await detail.getByRole("button", { name: "Edit", exact: true }).click()
    const unpublished = budgetScenario("REVOKED_PRIVATE_DRAFT")
    const form = surface.locator(".sf-budget-form")
    await form.getByRole("textbox", { name: recordName }).fill(unpublished)
    await expect(form).toContainText(recordName)
    const driver = nativeHarness as InstalledNativeHarness & Readonly<{
      revokeViaOriginalProducer?: (input: { capabilityId: string; principalRef: string }) => Promise<{ committed: boolean }>
    }>
    if (typeof driver.revokeViaOriginalProducer !== "function") {
      throw new Error("F04_REQUIRED_" + surfaceId + "_REAL_PRIVILEGED_REVOCATION_DRIVER_199")
    }
    const proof = await requestRealRevocation({
      page, manifest: nativeHarness.manifest, capabilityId: surfaceId,
      revokeViaProducer: () => driver.revokeViaOriginalProducer!({
        capabilityId: surfaceId, principalRef: source.principalRef,
      }),
    })
    expect(["PRODUCER_ACCESS_REVOCATION_OBSERVED", "PRODUCER_AUTHENTICATION_REVOKED"])
      .toContain(proof.phase)
    await page.reload({ waitUntil: "domcontentloaded" })
    await expect(page.getByText(unpublished)).toHaveCount(0)
    await expect(page.locator('[data-sf-budget="' + surfaceId + '"] .sf-budget-editor')).toHaveCount(0)
    await expect(page.locator('[data-sf-budget="' + surfaceId + '"] .sf-budget-owners tr[data-sf-row]'))
      .toHaveCount(0)
    await expect.poll(async () =>
      page.locator('[data-sf-state="denied"], [data-sf-state="session-expired"]').count(),
    ).toBeGreaterThan(0)
  })

  nativeInstalledFixture("206-AC02 real 409 with concurrent authenticated editor blocks stale review; no optimistic overwrite", async ({ page, nativeHarness }) => {
    requireRegisteredLiveCase(nativeHarness, "stale")
    const surface = await requireAdmittedSurface(page, nativeHarness, "edit")
    const current = await originalPage(page, nativeHarness)
    const owner = current.owners.find((row) => typeof row.name === "string" && !!String(row.name).trim())
    if (!owner) throw new Error("F04_REQUIRED_" + surfaceId + "_CONCURRENT_SOURCE_RECORD")
    const ownerId = String(owner.id)
    const initialVersion = ownerVersion(current, ownerId)
    const detail = await openOwner(surface, String(owner.name), ownerId)
    await detail.getByRole("button", { name: "Edit", exact: true }).click()
    const form = surface.locator(".sf-budget-form")
    const draftName = budgetScenario("STALER")
    await form.getByRole("textbox", { name: recordName }).fill(draftName)
    const driver = nativeHarness as InstalledNativeHarness & Readonly<{
      advanceViaSecondAuthenticatedWriter?: (input: { capabilityId: string; recordId: string; expectedVersion: number }) =>
        Promise<{ sourceVersion: number }>
    }>
    if (typeof driver.advanceViaSecondAuthenticatedWriter !== "function") {
      throw new Error("F04_REQUIRED_" + surfaceId + "_SECOND_ORIGINAL_PRODUCER_WRITER_199")
    }
    const conflict = await driver.advanceViaSecondAuthenticatedWriter({
      capabilityId: surfaceId, recordId: ownerId, expectedVersion: initialVersion,
    })
    const changed = await originalPage(page, nativeHarness)
    expect(ownerVersion(changed, ownerId)).toBe(conflict.sourceVersion)
    expect(conflict.sourceVersion).toBeGreaterThan(initialVersion)
    // A stale reviewed command must be rejected by the original producer (409)
    // or by the source-version gate; both prohibit an unversioned overwrite.
    const actions: import("@playwright/test").Request[] = []
    const observe = (request: import("@playwright/test").Request) => {
      if (originalCommandMatches(request, nativeHarness)) actions.push(request)
    }
    page.on("request", observe)
    try {
      await reviewForm(surface)
      const review = surface.locator('[data-component="sf-change-review"]')
      const save = review.getByRole("button", { name: "Save", exact: true })
      if (await save.isEnabled()) {
        const pending = page.waitForResponse((response) =>
          originalCommandMatches(response.request(), nativeHarness) &&
          asRecord(response.request().postDataJSON())?.action === "save")
        await save.click()
        const response = await pending
        expect(response.status()).toBe(409)
      } else {
        await expect(save).toBeDisabled()
        expect(actions).toHaveLength(0)
      }
      expect(exactOwner(await originalPage(page, nativeHarness), ownerId).name).not.toBe(draftName)
    } finally { page.off("request", observe) }
  })

  nativeInstalledFixture("206-AC02 validation error does not dispatch and preserves missing, zero and original editor text", async ({ page, nativeHarness }) => {
    const surface = await requireAdmittedSurface(page, nativeHarness, "edit")
    const name = budgetScenario("validation")
    const id = await createRealOwner(page, nativeHarness, surface, name, "0")
    const detail = await openOwner(surface, name, id)
    const posts: import("@playwright/test").Request[] = []
    const monitor = (request: import("@playwright/test").Request) => {
      if (originalCommandMatches(request, nativeHarness)) posts.push(request)
    }
    page.on("request", monitor)
    try {
      await detail.getByRole("button", { name: "Apply year amount", exact: true }).click()
      let form = surface.locator(".sf-budget-form")
      const amount = form.getByRole("spinbutton", { name: "Year amount" })
      await amount.fill("-1")
      await form.getByRole("button", { name: "Review changes" }).click()
      await expect(surface.locator('[data-component="sf-change-review"]')).toHaveCount(0)
      await expect(amount).toHaveValue("-1")
      await expect(form.getByRole("alert")).toBeVisible()
      await form.getByRole("button", { name: "Cancel", exact: true }).click()
      const row = detail.locator(".sf-budget-months tr[data-sf-month='11']")
      await row.getByRole("button", { name: "Save month", exact: true }).click()
      form = surface.locator(".sf-budget-form")
      await form.getByRole("spinbutton", { name: "budget", exact: true }).fill("")
      await form.getByRole("spinbutton", { name: "actual", exact: true }).fill("0")
      await form.getByRole("spinbutton", { name: "forecast", exact: true }).fill("5")
      await form.getByRole("button", { name: "Review changes" }).click()
      await expect(surface.locator('[data-component="sf-change-review"]')).toHaveCount(0)
      await expect(form.getByRole("spinbutton", { name: "budget", exact: true })).toHaveValue("")
      await expect(form.getByRole("spinbutton", { name: "actual", exact: true })).toHaveValue("0")
      expect(posts).toHaveLength(0)
      await form.getByRole("button", { name: "Cancel" }).click()
    } finally { page.off("request", monitor) }
    await deleteRealOwner(page, nativeHarness, surface, name, id)
  })

  nativeInstalledFixture("206-AC02 real held producer POST is visibly submitting/pending, double confirmation cannot dispatch", async ({ page, nativeHarness }) => {
    const surface = await requireAdmittedSurface(page, nativeHarness, "edit")
    const name = budgetScenario("pending")
    const id = await createRealOwner(page, nativeHarness, surface, name, "121")
    const detail = await openOwner(surface, name, id)
    await detail.getByRole("button", { name: "Edit", exact: true }).click()
    const form = surface.locator(".sf-budget-form")
    await form.getByRole("spinbutton", { name: "Annual budget" }).fill("122")
    await reviewForm(surface)
    await expect(surface.locator(".sf-budget-editor")).toHaveAttribute("data-sf-draft-phase", "reviewing")
    const held = await armHeldResponse(page, nativeDashboardCommandTarget(nativeHarness.manifest, surfaceId))
    try {
      const review = surface.locator('[data-component="sf-change-review"]')
      await review.getByRole("button", { name: "Save", exact: true }).click()
      await expect.poll(() => held.observations().attempts).toBe(1)
      // Separate UI phase from a ready list: leaving the form editable or
      // rendering a second enabled Confirm is a product defect for 189.
      await expect(surface.locator(".sf-budget-editor")).toHaveAttribute("data-sf-draft-phase", "submitting")
      await expect(surface.locator(".sf-budget-editor [role='status']")).toBeVisible()
      await expect(surface.locator(".sf-budget-editor").getByRole("button", { name: "Save", exact: true })).toBeDisabled()
      expect(held.observations().producerStatus).toBe(200)
      held.release()
      await expect.poll(async () => exactOwner(await originalPage(page, nativeHarness), id).budget).toBe(122)
      await expect(surface.locator(".sf-budget-editor")).toHaveCount(0)
      expect(held.observations().attempts).toBe(1)
    } finally {
      held.release()
      await held.dispose()
    }
    await deleteRealOwner(page, nativeHarness, surface, name, id)
  })

  nativeInstalledFixture("206-AC02 lost response remains outcome-unknown until original authorized refetch, never auto-retry", async ({ page, nativeHarness }) => {
    const surface = await requireAdmittedSurface(page, nativeHarness, "edit")
    const name = budgetScenario("lost")
    const before = await originalPage(page, nativeHarness)
    const posts: import("@playwright/test").Request[] = []
    const monitor = (request: import("@playwright/test").Request) => {
      if (originalCommandMatches(request, nativeHarness)) posts.push(request)
    }
    await surface.getByRole("button", { name: newButtonName, exact: true }).click()
    const form = surface.locator(".sf-budget-form")
    await form.getByRole("textbox", { name: recordName }).fill(name)
    await form.getByRole("spinbutton", { name: "Annual budget" }).fill("36")
    await reviewForm(surface)
    const lost = await armLostResponse(page, nativeDashboardCommandTarget(nativeHarness.manifest, surfaceId))
    page.on("request", monitor)
    try {
      await surface.locator('[data-component="sf-change-review"]')
        .getByRole("button", { name: "Save", exact: true }).click()
      const receipt = surface.locator('[data-component="sf-receipt-view"][data-state="outcome-unknown"]')
      await expect(receipt).toBeVisible()
      await expect(receipt.locator('[data-outcome="unconfirmed"]')).toBeVisible()
      await expect(receipt.locator('[data-receipt="producer"]')).toHaveCount(0)
      const observation = lost.observations()
      expect(observation.attempts).toBe(1)
      expect(observation.producerStatus).toBe(200)
      // The real producer may commit while its response is lost. The independent
      // original GET, not this status or a manufactured receipt, is the oracle.
      await expect.poll(async () =>
        (await originalPage(page, nativeHarness)).owners.filter((row) => row.name === name).length,
      ).toBe(1)
      await receipt.getByRole("button", { name: "Check outcome", exact: true }).click()
      await expect(receipt.locator('[data-outcome="unconfirmed"]')).toBeVisible()
      expect(posts).toHaveLength(1)
      const after = await originalPage(page, nativeHarness)
      expect(after.owners.length).toBe(before.owners.length + 1)
      expect(after.owners.find((row) => row.name === name)?.budget).toBe(36)
    } finally {
      page.off("request", monitor)
      await lost.dispose()
    }
    // Do not issue an unreviewed compensating mutation while the draft intent
    // is unresolved. Fixture/200 owns disposing the isolated private dataset.
  })

  nativeInstalledFixture("206-AC02 late original GET after different installation/project never leaks prior draft or owner", async ({ page, nativeHarness }) => {
    requireRegisteredLiveCase(nativeHarness, "late")
    const surface = await requireAdmittedSurface(page, nativeHarness, "edit")
    const original = await originalPage(page, nativeHarness)
    const owner = original.owners.find((row) => typeof row.name === "string" && !!String(row.name).trim())
    if (!owner) throw new Error("F04_REQUIRED_" + surfaceId + "_ORIGINAL_OWNER_FOR_LATE_READ")
    const privateName = String(owner.name)
    await openOwner(surface, privateName, String(owner.id))
    const wrong = nativeHarness.manifest.wrongProject
    if (wrong.projectId === nativeHarness.manifest.target.projectId) {
      throw new Error("F04_REQUIRED_DISTINCT_PROJECT_FOR_OWNER_CHANGE")
    }
    const wrongHref = new URL(nativeJourneyEntryHref(nativeHarness.manifest.target, surfaceId, 2026))
    wrongHref.searchParams.set("server", wrong.serverKey)
    wrongHref.searchParams.set("project", wrong.projectId)
    wrongHref.searchParams.set("installation", wrong.installationId)
    const target = nativeHarness.manifest.target
    const held = await armHeldResponse(page, {
      origin: target.publicOrigin,
      pathname: target.mount + "/api/ui/pages/" + surfaceId,
      method: "GET",
      query: { year: "2026" },
    })
    try {
      await page.reload({ waitUntil: "domcontentloaded" })
      await expect.poll(() => held.observations().attempts).toBe(1)
      await page.goto(wrongHref.toString(), { waitUntil: "domcontentloaded" })
      held.release()
      await expect(page).toHaveURL(wrongHref.toString())
      await expect(page.getByText(privateName, { exact: true })).toHaveCount(0)
      await expect(page.locator('[data-sf-budget="' + surfaceId + '"] .sf-budget-editor')).toHaveCount(0)
      const sourceRows = page.locator('[data-sf-budget="' + surfaceId + '"] .sf-budget-owners tr[data-sf-row]')
      await expect(sourceRows.filter({ hasText: privateName })).toHaveCount(0)
      expect(held.observations().attempts).toBe(1)
    } finally {
      held.release()
      await held.dispose()
    }
  })

  nativeInstalledFixture("206-AC03 complete forms, actions and keyboard at 320/768/1024/1280/1440 plus 200/400 percent reflow", async ({ page, nativeHarness }) => {
    const surface = await requireAdmittedSurface(page, nativeHarness, "edit")
    const name = budgetScenario("a11y")
    const id = await createRealOwner(page, nativeHarness, surface, name, "505")
    const detail = await openOwner(surface, name, id)
    const ownerRowId = detail.locator(".sf-budget-source")
    await expect(ownerRowId).toContainText(sourceCollection + ":" + id)
    const months = detail.getByRole("region", { name: "Annual Entry", exact: true })
    await expect(months).toHaveAttribute("tabindex", "0")
    await expect(months.locator("tr[data-sf-month]")).toHaveCount(12)
    for (const width of [320, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(surface.getByRole("heading", { name: title })).toBeVisible()
      await expect(surface.getByRole("button", { name: newButtonName, exact: true })).toBeEnabled()
      await expect(surface.locator(".sf-budget-owners").getByRole("searchbox", { name: "Name" })).toBeEditable()
      for (const label of ["Edit", "Delete", "Apply annual entry", "Apply year amount"]) {
        await expect(detail.getByRole("button", { name: label, exact: true })).toBeEnabled()
      }
      const source = await originalPage(page, nativeHarness)
      expect(source.owners.some((row) => String(row.id) === id)).toBe(true)
      const widthState = await surface.evaluate((element) => ({
        clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
      }))
      expect(widthState.scrollWidth, "no chapter overflow at " + width)
        .toBeLessThanOrEqual(widthState.clientWidth + 1)
    }
    await months.focus()
    await expect(months).toBeFocused()
    await page.keyboard.press("ArrowRight")
    const monthRow = detail.locator(".sf-budget-months tr[data-sf-month='2']")
    await expect(monthRow.getByRole("button", { name: "Save month" })).toBeEnabled()
    await expect(monthRow.getByRole("button", { name: "Save deviation" })).toBeEnabled()

    // Inspect every editable field/label/action, without submitting commands.
    await detail.getByRole("button", { name: "Edit", exact: true }).click()
    let form = surface.locator(".sf-budget-form")
    await expect(form.getByRole("textbox", { name: recordName, exact: true })).toBeEditable()
    await expect(form.getByRole("spinbutton", { name: "Annual budget" })).toBeEditable()
    await form.getByRole("textbox", { name: recordName }).focus()
    await expect(form.getByRole("textbox", { name: recordName })).toBeFocused()
    await page.keyboard.press("Tab")
    await expect(form.getByRole("spinbutton", { name: "Annual budget" })).toBeFocused()
    await form.getByRole("button", { name: "Cancel" }).click()
    await monthRow.getByRole("button", { name: "Save month" }).click()
    form = surface.locator(".sf-budget-form")
    await expect(form.getByRole("spinbutton", { name: "Month" })).toHaveAttribute("readonly", "")
    for (const field of ["budget", "actual", "forecast"]) {
      await expect(form.getByRole("spinbutton", { name: field, exact: true })).toBeEditable()
    }
    await form.getByRole("button", { name: "Cancel" }).click()
    await monthRow.getByRole("button", { name: "Save deviation" }).click()
    form = surface.locator(".sf-budget-form")
    await expect(form.getByRole("combobox", { name: "Flag" })).toBeEnabled()
    await expect(form.getByRole("textbox", { name: "Deviation notes" })).toBeEditable()
    await form.getByRole("button", { name: "Cancel" }).click()
    await detail.getByRole("button", { name: "Apply annual entry" }).click()
    form = surface.locator(".sf-budget-form")
    await expect(form.getByRole("spinbutton", { name: "Annual Entry ÷12" })).toBeEditable()
    await expect(form.getByRole("combobox", { name: "Field" })).toBeEnabled()
    await form.getByRole("button", { name: "Cancel" }).click()
    await detail.getByRole("button", { name: "Apply year amount" }).click()
    form = surface.locator(".sf-budget-form")
    await expect(form.getByRole("spinbutton", { name: "Year amount" })).toBeEditable()
    await form.getByRole("button", { name: "Cancel" }).click()

    for (const [width, fontSize] of [[768, "200%"], [320, "400%"]] as const) {
      await page.setViewportSize({ width, height: 900 })
      await page.evaluate((value) => { document.documentElement.style.fontSize = value }, fontSize)
      await expect(detail).toBeVisible()
      await expect(months).toBeVisible()
      await expect(detail.getByRole("button", { name: "Apply annual entry" })).toBeVisible()
      await expect(monthRow.getByRole("button", { name: "Save month" })).toBeVisible()
      const sizes = await surface.evaluate((element) => ({
        width: element.clientWidth, scroll: element.scrollWidth,
      }))
      expect(sizes.scroll, "reflow must not conceal actions at " + width + "/" + fontSize)
        .toBeLessThanOrEqual(sizes.width + 1)
    }
    await page.evaluate(() => { document.documentElement.style.removeProperty("font-size") })
    await deleteRealOwner(page, nativeHarness, surface, name, id)
  })
})
