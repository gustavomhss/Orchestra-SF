import { expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { nativeDashboardCommandTarget, nativeInstalledFixture, nativeJourneyEntryHref, observeNativeBinding, requireNativeJourney } from "../fixture.ts"
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
