/**
 * Q01.pilot: P0 title/CAS and P1 actual PR holder path.
 * Only original F04 producer fixtures and authenticated native HTTP/UI count.
 * Neither a test-supplied principal nor a synthetic approval satisfies P0/P1.
 */
import { expect } from "@playwright/test"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import { armLostResponse, nativeCorpus, nativeInstalledFixture as test } from "./fixture"
import type { NativeTarget } from "./fixture/readiness"

const p0Title = "F04 real domain P0 draft title"
const p1Title = "F04 real domain P1 submitted PR"
type Row = Record<string, unknown>
type Projection = { data: { requests: Row[] }; versions: Record<string, { version: number }> }
function record(value: unknown): value is Row {
  return !!value && typeof value === "object" && !Array.isArray(value)
}
function requestId(value: unknown): string {
  if (typeof value !== "string" || !/^PR-\d{4}-\d+$/.test(value)) throw new Error("Q01_REAL_PR_ID_REQUIRED")
  return value
}
function nativeUrl(target: NativeTarget, path: string): string {
  const url = new URL(path, target.shellOrigin)
  url.searchParams.set("server", target.serverKey)
  url.searchParams.set("project", target.projectId)
  url.searchParams.set("installation", target.installationId)
  return url.href
}
async function actualProjection(page: import("@playwright/test").Page, target: NativeTarget, capability: "CAP25" | "CAP26") {
  const url = new URL(target.mount + "/api/ui/pages/" + capability, target.publicOrigin)
  const response = await page.request.get(url.href, {
    headers: { Accept: "application/json" }, maxRedirects: 0, maxRetries: 0,
  })
  expect(response.status(), "A03's installed original projection must be reachable").toBe(200)
  expect(response.headers()["content-type"]).toMatch(/^application\/json\b/)
  const json: unknown = await response.json()
  if (!record(json) || json.status !== "ok" || !record(json.value) ||
      !record(json.value.data) || !Array.isArray(json.value.data.requests) ||
      !record(json.value.versions)) throw new Error("Q01_ORIGINAL_PRODUCER_PROJECTION_CONTRACT_UNAVAILABLE")
  return json.value as unknown as Projection
}
function uniqueRequest(view: Projection, expectedTitle: string): Row {
  const rows = view.data.requests.filter((item) =>
    record(item) && record(item.pr) && item.pr.title === expectedTitle)
  if (rows.length !== 1) throw new Error("Q01_F04_SEEDED_REQUEST_NOT_UNIQUE_OR_VISIBLE")
  return rows[0]!
}
function version(view: Projection, id: string): number {
  const value = view.versions["requests:" + id]?.version
  if (!Number.isSafeInteger(value) || value! < 0) throw new Error("Q01_SOURCE_RECORD_CAS_REQUIRED")
  return value!
}
async function proveRole(page: import("@playwright/test").Page,
                         harness: import("./fixture").InstalledNativeHarness,
                         actor: "requester" | "holder" | "denied") {
  const { target, actors } = harness.manifest
  await page.goto(new URL(target.chapterHref, target.shellOrigin).href)
  const context = await harness.proveWeb(page.locator('[data-sf-frame="page"]'))
  expect(context.principalRef,
    "Real " + actor + " authentication must be supplied by the installed runner, never the manifest")
    .toBe(actors[actor])
  return target
}

test.describe("Q01 P0/P1 installed pilot against the real procurement producer", () => {
  test.describe.configure({ retries: 0, timeout: 180_000 })

  test("Q01-P0-PR-TITLE-CAS-LOST: one original save, real CAS refetch, no replay on uncertain outcome", async ({ page, nativeHarness }) => {
    const target = await proveRole(page, nativeHarness, "requester")
    const source = await actualProjection(page, target, "CAP25")
    const row = uniqueRequest(source, p0Title)
    const id = requestId(row.number)
    const baseline = version(source, id)
    await page.goto(nativeUrl(target, "/orchestra/sf-procurement/requests/" + encodeSfRouteRef(id)))
    const title = page.getByRole("textbox", { name: "Title", exact: true })
    await expect(title).toHaveValue(p0Title)
    const newTitle = "Q01 P0 lost-response " + id
    await title.fill(newTitle)
    const fault = await armLostResponse(page, {
      origin: target.publicOrigin, pathname: target.mount + "/procurement", method: "POST",
    })
    try {
      const save = page.getByRole("button", { name: "Save", exact: true })
      await expect(save).toBeEnabled()
      await save.click({ noWaitAfter: true }) // Exactly ONCE. No navigation retry or re-submit.
      await expect(page.locator(
        '[data-sf-state="outcome-unknown"], [data-sf-draft-phase="outcome-unknown"]',
      )).toBeVisible()
      const lost = fault.observations()
      expect(lost.attempts).toBe(1)
      expect(lost.producerStatus).toBe(200)
      expect(lost.producerCommit).toBe("UNPROVEN_REQUIRES_ORIGINAL_AUTHORIZED_READ")
    } finally { await fault.dispose() }
    // Only the original producer read can resolve outcome uncertainty.
    // No extra POST is issued, even if a response delivery failed after commit.
    const fresh = await actualProjection(page, target, "CAP25")
    const persisted = fresh.data.requests.filter((item) => item.number === id)
    expect(persisted).toHaveLength(1)
    expect((persisted[0]!.pr as Row).title).toBe(newTitle)
    expect(version(fresh, id)).toBeGreaterThan(baseline)
  })

  test("Q01-P1-HOLDER: only current real approval holder can resolve submitted PR", async ({ page, nativeHarness }) => {
    const target = await proveRole(page, nativeHarness, "holder")
    const before = await actualProjection(page, target, "CAP25")
    const pr = uniqueRequest(before, p1Title)
    const id = requestId(pr.number)
    expect(pr.status).toBe("pr_pending")
    const approval = record(pr.prApproval) ? pr.prApproval : undefined
    const steps = record(approval) && Array.isArray(approval.steps) ? approval.steps : []
    expect(steps.some((step) => record(step) && step.holderId === nativeHarness.manifest.actors.holder &&
      step.status === "pending"), "Original producer must identify the CURRENT holder").toBe(true)
    const originalVersion = version(before, id)
    await page.goto(nativeUrl(target, "/orchestra/sf-procurement/approvals/" +
      encodeSfRouteRef(id) + "/review"))
    await expect(page.locator('[data-sf-frame="page"]')).toBeVisible()
    const approve = page.getByRole("button", { name: "Approve", exact: true })
    await expect(approve).toBeEnabled()
    const response = page.waitForResponse((item) =>
      item.request().method() === "POST" &&
      new URL(item.url()).pathname === target.mount + "/procurement" &&
      new URL(item.url()).searchParams.get("page") === "My approvals")
    await approve.click() // One holder decision; never replay or create receipt in test.
    const committed = await response
    expect(committed.status()).toBe(200)
    const after = await actualProjection(page, target, "CAP25")
    const current = after.data.requests.filter((item) => item.number === id)
    expect(current).toHaveLength(1)
    expect(current[0]!.status).not.toBe("pr_pending")
    expect(version(after, id)).toBeGreaterThan(originalVersion)
    const originalHistory = Array.isArray(current[0]!.history) ? current[0]!.history : []
    expect(originalHistory.some((entry) => record(entry) &&
      entry.by === nativeHarness.manifest.actors.holder &&
      /approv/i.test(String(entry.action))), "Only original producer approval history counts").toBe(true)
  })

  test("Q01-P1-DENIED: second real approver cannot accept someone else's held PR", async ({ page, nativeHarness }) => {
    const target = await proveRole(page, nativeHarness, "denied")
    const read = await actualProjection(page, target, "CAP26")
    // A denied actor's genuine projection must not include the holder's pending
    // approval action; absence of a fabricated button is not a 403 receipt.
    const authorizedQueue = read.data.requests.filter((item) =>
      record(item.pr) && item.pr.title === p1Title)
    expect(authorizedQueue).toHaveLength(0)
    await page.goto(nativeUrl(target, "/orchestra/sf-procurement/approvals"))
    await expect(page.locator('[data-sf-frame="page"]')).toBeVisible()
    await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0)
  })
})
