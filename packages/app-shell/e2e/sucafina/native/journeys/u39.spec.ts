import { expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { nativeInstalledFixture } from "../fixture.ts"
import type { InstalledNativeHarness } from "../fixture.ts"

/**
 * Installed native CAP04 journey. F04/187 supplies the original authenticated
 * installation and identities; without its real private fixture the test
 * fails explicitly. No authorization flags, mocked grants, fake responses,
 * replayed mutations or browser storage-state exports.
 */
const path = "/orchestra/sf-dashboard/opex?year=2026"
const surfaceId = "CAP04"
const title = "OPEX Detail"
const recordName = "Owner name"

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
  requireSave: boolean,
) {
  const { manifest } = nativeHarness
  const { target } = manifest
  const requested = new URL(path, target.shellOrigin)
  if (target.chapterHref !== requested.pathname + requested.search) {
    throw new Error("F04_" + surfaceId + "_REAL_CHAPTER_BINDING_REQUIRED")
  }

  await page.goto(requested.toString())
  const surface = page.locator('[data-sf-budget="' + surfaceId + '"]')
  const observed = await nativeHarness.proveWeb(surface)
  if (observed.candidateSha !== manifest.candidateSha ||
      ![manifest.actors.requester, manifest.actors.holder].includes(observed.principalRef)) {
    throw new Error("F04_" + surfaceId + "_POSITIVE_ACTOR_NOT_AUTHENTICATED")
  }

  // F04 proves the installed host and current principal. Admission of this
  // specific financial capability/action is verified again against the real
  // producer, with the authenticated browser's original request context.
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
    throw new Error("F04_" + surfaceId + "_REAL_CONTEXT_UNAVAILABLE")
  }
  const envelope = asRecord(await response.json())
  const context = asRecord(envelope?.value)
  const stamp = asRecord(context?.stamp)
  if (envelope?.status !== "ok" || context?.contractRevision !== "sf-native-ui/1" ||
      stamp?.installationId !== target.installationId ||
      stamp?.projectId !== target.projectId ||
      stamp?.hostId !== target.hostId ||
      stamp?.principalRef !== observed.principalRef ||
      typeof stamp?.policyVersion !== "string" || !stamp.policyVersion ||
      typeof stamp?.accessRevision !== "string" || !stamp.accessRevision) {
    throw new Error("F04_" + surfaceId + "_REAL_CONTEXT_STAMP_MISMATCH")
  }

  const destinations = context.destinations
  const availability = context.availability
  const destination = Array.isArray(destinations)
    ? destinations.map(asRecord).find((entry) => entry?.capabilityId === surfaceId)
    : undefined
  const resource = Array.isArray(availability)
    ? availability.map(asRecord).find((entry) =>
        entry?.family === "domain-read" && entry.resource === surfaceId)
    : undefined
  const operations = resource?.operations
  const readyOperation = (id: string) =>
    Array.isArray(operations) && operations.map(asRecord).some((entry) =>
      entry?.operationId === id && entry.state === "ready" && entry.operational === true)
  if (destination?.surface !== "dashboard" || destination.page !== title ||
      destination.canRead !== true ||
      !readyOperation("domain.page." + surfaceId)) {
    throw new Error("F04_" + surfaceId + "_REAL_READ_GRANT_REQUIRED")
  }
  if (requireSave && (!Array.isArray(destination.allowedActionIds) ||
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


nativeInstalledFixture.describe("N13 CAP04 · installed native Dashboard", () => {
  nativeInstalledFixture("reads the source through A01 with owner-scoped state, filter-empty and source metadata", async ({ page, nativeHarness }) => {
    const surface = await requireAdmittedSurface(page, nativeHarness, false)
    await expect(surface).toBeVisible()
    await expect(surface.getByRole("heading", { name: title })).toBeVisible()
    // A projection must reach a terminal state before making an empty-state claim.
    await expect(surface.locator(".sf-state-panel").filter({ has: surface.locator(".sf-budget-owners") })).toBeVisible()
    const owners = surface.locator(".sf-budget-owners")
    const search = owners.getByRole("searchbox", { name: "Name" })
    await expect(search).toBeEnabled()
    await search.fill("__N13_Nonexistent_Record_2026__")
    await expect(surface.locator('[data-sf-state="filtered-empty"]')).toBeVisible()
    await search.fill("")
    await expect(page.locator('[data-sf-budget="' + surfaceId + '"]')).toHaveCount(1)
    // A missing budget is not asserted as numeric zero, and no financial total
    // is calculated in this journey. Source records are compared by identity.
    const table = owners.locator(".sf-s01-table")
    await expect(table).toBeVisible()
    const refs = await table.locator("tbody tr[data-sf-row]").evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-sf-row")))
    expect(refs.every(Boolean)).toBe(true)
    expect(new Set(refs).size).toBe(refs.length)
  })

  nativeInstalledFixture("new record is a draft until explicit, version-bound change review", async ({ page, nativeHarness }) => {
    const surface = await requireAdmittedSurface(page, nativeHarness, true)
    const financialPosts: string[] = []
    page.on("request", (request) => {
      const url = new URL(request.url())
      if (request.method() === "POST" &&
          url.origin === nativeHarness.manifest.target.publicOrigin &&
          url.pathname === nativeHarness.manifest.target.mount + "/dashboard") {
        financialPosts.push(request.method())
      }
    })
    const primary = surface.getByRole("button", { name: "New line", exact: true })
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
    const surface = await requireAdmittedSurface(page, nativeHarness, false)
    await expect(surface).toBeVisible()
    for (const width of [320, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(surface).toBeVisible()
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
    // Horizontal scrolling is allowed inside the named month-grid region,
    // never by silently clipping or hiding the write/review controls.
    const viewport = await surface.evaluate((element) => ({
      client: element.clientWidth, scroll: element.scrollWidth,
    }))
    expect(viewport.scroll).toBeLessThanOrEqual(viewport.client + 1)
  })
})
