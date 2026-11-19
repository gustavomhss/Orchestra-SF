import { expect } from "@playwright/test"
import type { Page, Response, TestInfo } from "@playwright/test"
import { Schema } from "effect"
import { SfBiBiDataOutput, SfBiBiOptionsOutput } from "@orchestra/schema/sucafina/bi"
import { SfProjectionReview, SfDashboardDashboardAgenda, SfDashboardDashboardReviewPreserve,
  SfReviewsReviewRead, SfReviewsReviewUpdate } from "@orchestra/schema/sucafina/reviews"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import { object, text } from "../reports-support/model"

/** Called by the real WP10 installation after original operator enrollment. */
export async function qualifyWp10ExtendedUi(input: { page: Page; origin: string; testInfo: TestInfo }) {
  const { page, origin, testInfo } = input
  const facts: Record<string, string | number | boolean> = {}
  const href = (path: string) => new URL(path, origin).href
  const operation = (name: string, method = "GET") => (response: Response) => {
    const url = new URL(response.url())
    return response.request().method() === method && url.origin === origin &&
      url.pathname === "/sucafina/dashboard" && url.searchParams.get("sf") === name
  }
  const reviewHref = (reference: string, sectionRef?: string) => href("/orchestra/sf-reviews/reviews/" +
    encodeSfRouteRef(reference) + (sectionRef === undefined ? "" : "?" + new URLSearchParams({ sectionRef })))

  await page.goto(href("/orchestra/sf-bi/" + encodeSfRouteRef("BI02")))
  const bi = page.locator('[data-sf-catalog="UI46"]')
  await bi.locator('[data-sf-field="start"]').fill("2027-01-01")
  await bi.locator('[data-sf-field="end"]').fill("2027-12-31")
  const pendingOptions = page.waitForResponse(operation("bi-options"))
  await bi.getByRole("button", { name: "Choose context", exact: true }).click()
  const options = Schema.decodeUnknownSync(Schema.toType(SfBiBiOptionsOutput))(await responseBody(await pendingOptions))
  if (options.status !== "ok") throw new Error("The original BI02 catalog was unavailable")
  const versions = options.value.versions
  facts.plannerVersions = versions.length
  expect(versions.length).toBeGreaterThanOrEqual(2)
  const plannerLinks = options.value.links.filter((link) => link.surface === "planner" && link.page === "Versions")
  expect(plannerLinks).toHaveLength(1)
  const plannerLink = bi.getByRole("link", { name: plannerLinks[0]!.label, exact: true })
  const plannerDestination = new URL((await plannerLink.getAttribute("href"))!, origin)
  expect(plannerDestination.origin).toBe(origin)
  expect(plannerDestination.pathname).toBe("/orchestra/sf-planner/versions")
  expect(plannerDestination.searchParams.get("year")).toBe("2027")
  const baseline = bi.locator('[data-sf-field="base-ref"]')
  const candidate = bi.locator('[data-sf-field="candidate-ref"]')
  const view = bi.locator('[data-sf-action="view-data"]')
  await expect(baseline).toHaveValue("")
  await expect(candidate).toHaveValue("")
  await expect(bi.locator('[data-sf-field="currency"]')).toHaveValue("")
  await expect(view).toBeDisabled()
  await expect(baseline.locator("option")).toHaveCount(versions.length + 1)
  await expect(candidate.locator("option")).toHaveCount(versions.length + 1)
  await baseline.selectOption(versions[0]!.ref)
  await candidate.selectOption(versions[1]!.ref)
  await expect(view).toBeDisabled()
  await bi.locator('[data-sf-field="currency"]').fill("USD")
  const pendingComparison = page.waitForResponse(operation("bi-data"))
  await view.click()
  const comparisonResponse = await pendingComparison
  const comparison = Schema.decodeUnknownSync(Schema.toType(SfBiBiDataOutput))(await responseBody(comparisonResponse))
  if (!("request" in comparison)) throw new Error("The original BI02 comparison was unavailable")
  expect(Object.fromEntries(new URL(comparisonResponse.url()).searchParams)).toMatchObject({
    viewId: "BI02", start: "2027-01-01", end: "2027-12-31",
    baseRef: versions[0]!.ref, candidateRef: versions[1]!.ref, currency: "USD",
  })
  expect(comparison.request.viewId).toBe("BI02")
  expect(comparison.projection.context.currency).toBe("USD")
  await expect(bi.getByRole("table", { name: "Authorized values and source references", exact: true })).toBeVisible()
  facts.plannerChoiceAvailable = true
  facts.plannerHttp = comparisonResponse.status()
  facts.plannerResult = "authorized-projection"
  await testInfo.attach("wp10-bi-explicit-versions.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })

  await page.goto(href("/orchestra/sf-bi/" + encodeSfRouteRef("BI05")))
  await bi.locator('[data-sf-field="start"]').fill("2027-01-01")
  await bi.locator('[data-sf-field="end"]').fill("2027-12-31")
  const pendingCollections = page.waitForResponse(operation("bi-options"))
  await bi.getByRole("button", { name: "Choose context", exact: true }).click()
  const collections = Schema.decodeUnknownSync(Schema.toType(SfBiBiOptionsOutput))(await responseBody(await pendingCollections))
  if (collections.status !== "ok") throw new Error("The original Procurement catalog was unavailable")
  expect(collections.value.choices, "The published corpus exposes exactly one authorized Procurement collection").toHaveLength(1)
  const collection = bi.locator('[data-sf-field="selection"]')
  await expect(collection).toHaveValue("")
  await expect(view).toBeDisabled()
  await collection.selectOption(collections.value.choices[0]!.selectionRef)
  const pendingRequests = page.waitForResponse(operation("bi-data"))
  await view.click()
  const requests = await pendingRequests
  const requestData = Schema.decodeUnknownSync(Schema.toType(SfBiBiDataOutput))(await responseBody(requests))
  if (!("request" in requestData)) throw new Error("The original Procurement projection was unavailable")
  expect(requestData.request.selectionRef).toBe(collections.value.choices[0]!.selectionRef)
  expect(requestData.request.viewId).toBe("BI05")
  facts.procurementHttp = requests.status()
  await expect(bi.getByRole("table", { name: "Authorized operational measures", exact: true })).toBeVisible()
  await testInfo.attach("wp10-bi-procurement-choice.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })

  await page.goto(href("/orchestra/sf-dashboard/opex?year=2027"))
  await page.getByRole("link", { name: "Reports and backup", exact: true }).click()
  expect(new URL(page.url()).pathname).toBe("/orchestra/sf-reviews/agenda")
  expect(new URL(page.url()).searchParams.get("sourcePage")).toBe("OPEX Detail")
  expect(new URL(page.url()).searchParams.get("year")).toBe("2027")
  const agenda = page.locator('[data-sf-surface="UI47"]')
  await expect(agenda.getByLabel("Source dashboard page", { exact: true })).toHaveValue("OPEX Detail")
  await expect(agenda.locator("[data-sf-agenda-order] > li")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Review selected sections", exact: true })).toBeDisabled()
  const pendingDiscovery = page.waitForResponse((response) => response.request().method() === "GET" &&
    new URL(response.url()).pathname === "/sucafina/api/ui/projections/review")
  await agenda.getByRole("button", { name: "Find authorized sections", exact: true }).click()
  const discovered = Schema.decodeUnknownSync(Schema.toType(SfProjectionReview.output))(await responseBody(await pendingDiscovery))
  if (discovered.status !== "ok" || !("items" in discovered.value)) throw new Error("The original OPEX agenda was unavailable")
  expect(discovered.value.items).toHaveLength(1)
  const section = discovered.value.items[0]!
  expect(section.period).toEqual({ start: "2027-01-01", end: "2027-12-31" })
  await agenda.getByRole("button", { name: "Add to agenda", exact: true }).click()
  await expect(agenda.locator("[data-sf-agenda-order] > li")).toHaveAttribute("data-section-id", section.id)
  const pendingAgenda = page.waitForResponse(operation("dashboard-agenda", "POST"))
  await page.getByRole("button", { name: "Review selected sections", exact: true }).click()
  const preview = Schema.decodeUnknownSync(Schema.toType(SfDashboardDashboardAgenda.output))(await responseBody(await pendingAgenda))
  if (preview.status !== "ok") throw new Error("The original OPEX preview was unavailable")
  expect(preview.value.sections).toHaveLength(1)
  expect(preview.value.sections[0]!.id).toBe(section.id)
  expect(preview.value.sections[0]!.period).toEqual(section.period)
  const pendingPreserved = page.waitForResponse(operation("dashboard-review-preserve", "POST"))
  await agenda.getByRole("button", { name: "Confirm preservation", exact: true }).click()
  const preserved = Schema.decodeUnknownSync(Schema.toType(SfDashboardDashboardReviewPreserve.output))(await responseBody(await pendingPreserved))
  if (preserved.status !== "ok") throw new Error("The original OPEX review was not preserved")
  const original = preserved.value
  expect(original.sections).toHaveLength(1)
  expect(original.sections[0]).toMatchObject({ id: section.id, title: "OPEX Detail", period: section.period, content: preview.value.sections[0]!.projection })
  await expect(agenda.locator("[data-sf-preserved-confirmed]").locator("dd").first()).toHaveText(original.id)
  const opening = page.waitForResponse(operation("review-read"))
  await page.goto(reviewHref(original.id))
  const opened = Schema.decodeUnknownSync(Schema.toType(SfReviewsReviewRead.output))(await responseBody(await opening))
  expect(opened).toEqual({ status: "ok", value: original })
  const pendingInitialUpdate = page.waitForResponse(operation("review-update"))
  await page.getByRole("button", { name: "Check for updates", exact: true }).click()
  const initialUpdate = Schema.decodeUnknownSync(Schema.toType(SfReviewsReviewUpdate.output))(await responseBody(await pendingInitialUpdate))
  if (initialUpdate.status !== "ok") throw new Error("The original successor admission was unavailable")
  expect(initialUpdate.value.previousReviewRef).toBe(original.id)
  expect(initialUpdate.value.available).toBe(false)
  await expect(page.locator("[data-sf-successor-availability]")).toHaveAttribute("data-sf-successor-availability", "false")
  // Availability is not a changed/unchanged flag. The immutable read and the
  // next preview prove content continuity without inventing such a flag.
  const beforeEdit = await page.request.get(origin + "/sucafina/dashboard?" + new URLSearchParams({ sf: "review-read", reviewRef: original.id }))
  expect(beforeEdit.status()).toBe(200)
  expect(await beforeEdit.json()).toEqual({ status: "ok", value: original })

  const loaded = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return response.request().method() === "GET" && url.origin === origin &&
      url.pathname === "/sucafina/api/ui/pages/CAP04" && url.searchParams.get("year") === "2027"
  })
  await page.goto(href("/orchestra/sf-dashboard/opex?year=2027"))
  const loadedBody = object(await responseBody(await loaded))
  expect(loadedBody.status).toBe("ok")
  const owners = object(object(loadedBody.value).data).opexOwners
  if (!Array.isArray(owners)) throw new Error("CAP04 did not expose authorized OPEX owners")
  const ownerIds = owners.map((owner: unknown) => text(object(owner).id)).sort()
  expect(ownerIds.length).toBeGreaterThan(0)
  const ownerId = ownerIds[0]!
  const ownerRow = page.locator('tr[data-sf-row="' + ownerId + '"]')
  await expect(ownerRow).toHaveCount(1)
  await ownerRow.locator('button[data-sf-action="edit"]').click()
  const ownerForm = page.locator('section.sf-budget-editor[data-sf-action="save"] form.sf-budget-form')
  await expect(ownerForm).toHaveCount(1)
  const oldBudget = Number(await ownerForm.getByLabel("Annual budget", { exact: true }).inputValue())
  expect(Number.isFinite(oldBudget)).toBe(true)
  const newBudget = oldBudget + 120
  await ownerForm.getByLabel("Annual budget", { exact: true }).fill(String(newBudget))
  await ownerForm.getByRole("button", { name: "Review changes", exact: true }).click()
  const change = page.locator('[data-component="sf-change-review"]')
  const edited = page.waitForResponse((response) => {
    const url = new URL(response.url())
    if (response.request().method() !== "POST" || url.origin !== origin || url.pathname !== "/sucafina/dashboard") return false
    const body = object(response.request().postDataJSON())
    return body.page === "OPEX Detail" && body.action === "save" && body.id === ownerId
  })
  await change.getByRole("button", { name: "Save", exact: true }).click()
  const edit = await edited
  expect(object(edit.request().postDataJSON())).toMatchObject({ id: ownerId, values: { budget: newBudget } })
  expect(await responseBody(edit)).toMatchObject({ ok: true })
  await expect(ownerForm).toHaveCount(0)
  await page.reload()
  await expect(ownerRow).toHaveCount(1)
  await ownerRow.locator('button[data-sf-action="edit"]').click()
  await expect(ownerForm.getByLabel("Annual budget", { exact: true })).toHaveValue(String(newBudget))

  const reopening = page.waitForResponse(operation("review-read"))
  await page.goto(reviewHref(original.id))
  expect(Schema.decodeUnknownSync(Schema.toType(SfReviewsReviewRead.output))(await responseBody(await reopening))).toEqual({ status: "ok", value: original })
  const pendingUpdated = page.waitForResponse(operation("review-update"))
  await page.getByRole("button", { name: "Check for updates", exact: true }).click()
  const updated = Schema.decodeUnknownSync(Schema.toType(SfReviewsReviewUpdate.output))(await responseBody(await pendingUpdated))
  if (updated.status !== "ok") throw new Error("The original producer did not offer successor preparation")
  expect(updated.value.previousReviewRef).toBe(original.id)
  expect(updated.value.available).toBe(true)
  expect(updated.value.unavailableSections).toEqual([])
  expect(updated.value.items).toHaveLength(1)
  expect(updated.value.items[0]).toMatchObject({ id: original.sections[0]!.id, period: original.sections[0]!.period })
  await expect(page.locator("[data-sf-successor-availability]")).toHaveAttribute("data-sf-successor-availability", "true")
  await expect(agenda).toHaveCount(0)
  let successorWrites = 0
  const countPreservation = (request: import("@playwright/test").Request) => {
    if (request.method() === "POST" && new URL(request.url()).searchParams.get("sf") === "dashboard-review-preserve") successorWrites++
  }
  page.on("request", countPreservation)
  await page.getByRole("button", { name: "Prepare current data as a new revision", exact: true }).click()
  await expect(agenda.locator("[data-sf-agenda-order] > li")).toHaveAttribute("data-section-id", original.sections[0]!.id)
  expect(successorWrites).toBe(0)
  const pendingSuccessorPreview = page.waitForResponse(operation("dashboard-agenda", "POST"))
  await page.getByRole("button", { name: "Review selected sections", exact: true }).click()
  const successorPreview = Schema.decodeUnknownSync(Schema.toType(SfDashboardDashboardAgenda.output))(await responseBody(await pendingSuccessorPreview))
  if (successorPreview.status !== "ok") throw new Error("The successor selection was not admitted")
  expect(successorPreview.value.sections).toHaveLength(1)
  expect(successorPreview.value.sections[0]).toMatchObject({ id: original.sections[0]!.id, period: original.sections[0]!.period })
  expect(successorPreview.value.sections[0]!.projection).not.toEqual(original.sections[0]!.content)
  expect(successorWrites).toBe(0)
  const pendingSuccessor = page.waitForResponse(operation("dashboard-review-preserve", "POST"))
  await agenda.getByRole("button", { name: "Confirm preservation", exact: true }).click()
  const successorResponse = await pendingSuccessor
  expect(successorResponse.request().postDataJSON()).toMatchObject({
    previousReviewRef: original.id, selectionRef: successorPreview.value.selectionRef, sectionRefs: [original.sections[0]!.id],
  })
  const successor = Schema.decodeUnknownSync(Schema.toType(SfDashboardDashboardReviewPreserve.output))(await responseBody(successorResponse))
  page.off("request", countPreservation)
  expect(successorWrites).toBe(1)
  if (successor.status !== "ok") throw new Error("The producer did not preserve the explicitly confirmed successor")
  expect(successor.value.id).not.toBe(original.id)
  expect(successor.value.previousReviewRef).toBe(original.id)
  expect(successor.value.sections).toHaveLength(1)
  expect(successor.value.sections[0]).toMatchObject({ id: original.sections[0]!.id, period: original.sections[0]!.period })
  expect(successor.value.sections[0]!.content).not.toEqual(original.sections[0]!.content)
  const reopenSuccessor = page.waitForResponse(operation("review-read"))
  await page.goto(reviewHref(successor.value.id, successor.value.sections[0]!.id))
  expect(Schema.decodeUnknownSync(Schema.toType(SfReviewsReviewRead.output))(await responseBody(await reopenSuccessor))).toEqual(successor)
  await expect(page.locator("[data-sf-review-selected-section]")).toHaveAttribute("data-section-id", successor.value.sections[0]!.id)
  await page.goto(reviewHref(original.id, original.sections[0]!.id))
  const selected = page.locator("[data-sf-review-selected-section]")
  await expect(selected).toHaveAttribute("data-section-id", original.sections[0]!.id)
  await expect(selected.getByRole("heading", { name: "OPEX Detail", exact: true })).toBeVisible()
  facts.reviewRevocationUrl = reviewHref(successor.value.id, successor.value.sections[0]!.id)
  facts.reviewPredecessorLinked = true
  facts.reviewNonBudgetContextPreserved = true
  facts.reviewRequiresExplicitSuccessorConfirmation = true
  facts.reviewOrdinarySourceEditPreservedHistory = true
  await testInfo.attach("wp10-review-linked-section.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
  await testInfo.attach("wp10-extended-ui.json", { body: JSON.stringify({ schema: "wp10-extended-ui-v1", facts }), contentType: "application/json" })
  return facts
}

async function responseBody(response: Response): Promise<unknown> {
  expect(response.status()).toBe(200)
  expect(await response.finished()).toBeNull()
  expect(response.request().failure()).toBeNull()
  return response.json()
}
