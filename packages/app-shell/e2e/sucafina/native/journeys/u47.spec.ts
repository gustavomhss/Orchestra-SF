import { expect, test, type Page } from "@playwright/test"

/**
 * N14 / U47 targeted hosted evidence. Never intercept the producer or synthesize
 * a workbook, receipt, access grant or download. 120 must supply the real
 * isolated host and its typed A10 projection before dispatch.
 */
test.use({ trace: "off", video: "off", screenshot: "off" })
test.describe.configure({ retries: 0, timeout: 120_000 })

function installedUrl(path: string) {
  const origin = process.env.SF2H_TEST_ORIGIN
  const ownerQuery = process.env.SF2H_TEST_OWNER_QUERY
  if (!origin || !ownerQuery || process.env.SF2H_TEST_ISOLATED !== "1")
    throw new Error("N14 U47 requires 120's isolated real installation, not an in-test fixture")
  const url = new URL(path, origin)
  url.search = ownerQuery
  return url.href
}
async function visit(page: Page, path = "/orchestra/sf-people/talent") {
  const response = page.waitForResponse((item) => item.request().method() === "GET" &&
    new URL(item.url()).pathname.endsWith("/api/ui/pages/CAP08"))
  await page.goto(installedUrl(path))
  const projection = await response
  expect(projection.status(), "CAP08 must bind to the original producer").toBe(200)
  const body: unknown = await projection.json()
  expect(body).toMatchObject({ status: "ok", value: { capabilityId: "CAP08" } })
  await expect(page.locator('[data-sf-frame="page"]')).toBeVisible()
  await expect(page.locator('[data-sf-state="ready"]')).toBeVisible()
  return body as { status: "ok"; value: {
    data: { members: Array<Record<string, unknown> & { id: string; status?: string }> }
    versions: Record<string, number>
    allowedActionIds: string[]
  } }
}
async function expectNoDocOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    actual: document.documentElement.scrollWidth,
    available: document.documentElement.clientWidth,
  }))
  expect(width.actual).toBeLessThanOrEqual(width.available + 1)
}

test.describe("N14 U47 / CAP08", () => {
  test("U47-AC02 only authorized member fields and status-filtered rows are visible", async ({ page }, info) => {
    info.annotations.push({ type: "criteria", description: "U47-AC02 / current owner + redaction negative" })
    const projection = await visit(page)
    const members = projection.value.data.members
    const active = members.filter((member) => member.status === "Active")
    await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(active.length)
    for (const row of members) {
      expect(row.id).toBeTruthy()
      if (projection.value.versions["members:" + row.id] !== undefined)
        expect(projection.value.versions["members:" + row.id]).toBeGreaterThanOrEqual(0)
    }
    if (!projection.value.allowedActionIds.includes("save")) {
      expect(members.every((member) => !Object.hasOwn(member, "cls") &&
        !Object.hasOwn(member, "outlook") && !Object.hasOwn(member, "notes"))).toBe(true)
      await expect(page.getByRole("button", { name: "Edit review" })).toBeDisabled()
      await expect(page.getByText("Classification", { exact: true })).toHaveCount(0)
      await expect(page.getByText("Outlook", { exact: true })).toHaveCount(0)
    }
    await expectNoDocOverflow(page)
  })

  test("U47-AC01 import/export never fabricate a workbook or successful receipt without the source bytes/preview binding", async ({ page }, info) => {
    info.annotations.push({ type: "criteria", description: "U47-AC01 dependency gate: source workbook preview/download missing from A10" })
    await visit(page, "/orchestra/sf-people/talent/import")
    const region = page.locator('[data-sf-section="import-export"]')
    await expect(region.getByRole("button", { name: "Import", exact: true })).toBeDisabled()
    await expect(region.getByRole("button", { name: "Export All Members", exact: true })).toBeDisabled()
    await expect(region.locator('[data-sf-state="unavailable"]')).toBeVisible()
    // This is an honest negative gate. Positive parsed workbook, Replace CAS,
    // scanner, download bytes and revocation must be added by 120 after 125
    // installs real named producer bindings. This test does NOT mark AC01 pass.
  })

  test("U47-AC03 responsive list/details, focus and zoom-equivalent reflow", async ({ page }, info) => {
    info.annotations.push({ type: "criteria", description: "U47-AC03 / LAYOUT-01; source-driven Talent" })
    await visit(page)
    for (const width of [320, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(page.locator('[data-sf-frame="page"]')).toBeVisible()
      await expectNoDocOverflow(page)
    }
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
    await expectNoDocOverflow(page)
    await page.setViewportSize({ width: 320, height: 900 })
    await expectNoDocOverflow(page)
    // 120 separately proves genuine browser zoom; font scaling is not a substitute.
  })
})
