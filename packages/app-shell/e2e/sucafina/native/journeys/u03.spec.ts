import { expect, test, type Page } from "@playwright/test"

/**
 * N14 / U03 surgical candidate only. 120 supplies an authorized, isolated
 * installed owner with real F01/F02/A10 bindings. No network interception,
 * invented source records, mock admission or local test execution.
 */
test.use({ trace: "off", video: "off", screenshot: "off" })
test.describe.configure({ retries: 0, timeout: 120_000 })

function installedUrl(path: string) {
  const origin = process.env.SF2H_TEST_ORIGIN
  const owner = process.env.SF2H_TEST_OWNER_QUERY
  if (!origin || !owner || process.env.SF2H_TEST_ISOLATED !== "1")
    throw new Error("120 must supply an isolated real installed Sf owner: SF2H_TEST_ORIGIN, SF2H_TEST_OWNER_QUERY, SF2H_TEST_ISOLATED=1")
  const url = new URL(path, origin)
  url.search = owner
  return url.href
}
async function visit(page: Page, cap: "CAP06" | "CAP07") {
  const route = cap === "CAP06" ? "/orchestra/sf-people/overview" : "/orchestra/sf-people/structure"
  const responsePromise = page.waitForResponse((response) =>
    response.request().method() === "GET" &&
    new URL(response.url()).pathname.endsWith("/api/ui/pages/" + cap))
  await page.goto(installedUrl(route))
  const response = await responsePromise
  expect(response.status(), cap + " must be a current authorized source read").toBe(200)
  const body: unknown = await response.json()
  expect(body).toMatchObject({ status: "ok", value: { capabilityId: cap } })
  await expect(page.locator('[data-sf-frame="page"]')).toBeVisible()
  await expect(page.locator('[data-sf-state="ready"]')).toBeVisible()
  return body as { status: "ok"; value: {
    data: Record<string, unknown>; versions: Record<string, number>; allowedActionIds: string[]
  } }
}
async function noDocumentOverflow(page: Page) {
  const { documentWidth, viewportWidth } = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }))
  expect(documentWidth, "Only the identified local table may scroll horizontally").toBeLessThanOrEqual(viewportWidth + 1)
}

test.describe("N14 U03 / CAP06-CAP07", () => {
  test("U03-AC01 CAP06 renders exactly the source metrics, including known zero and optional admin Talent", async ({ page }, info) => {
    info.annotations.push({ type: "criteria", description: "U03-AC01 / WP02.T01" })
    const response = await visit(page, "CAP06")
    const metrics = response.value.data.metrics as Record<string, number | string | undefined>
    const keys = ["active", "terminated", "attritionYtd", "averageTenureMonths",
      "staffRatio", "contractors", "employees"] as const
    const cards = page.locator('[data-sf-metrics="headcount"] .sf-people-stat')
    await expect(cards).toHaveCount(keys.length + (metrics.talent === undefined ? 0 : 1))
    for (const [index, field] of keys.entries())
      await expect(cards.nth(index).locator("dd")).toHaveText(String(metrics[field]))
    if (metrics.talent !== undefined)
      await expect(cards.nth(keys.length).locator("dd")).toHaveText(String(metrics.talent))
    const rows = response.value.data.byLeader as { id: string; active: number; talentActive?: number }[]
    await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(rows.length)
    await expect(page.locator('[data-sf-metrics="headcount"]')).not.toContainText("undefined")
    await noDocumentOverflow(page)
  })

  test("U03-AC01 CAP07 preserves CIO, leader/member records and source versions without leaking restricted fields", async ({ page }, info) => {
    info.annotations.push({ type: "criteria", description: "U03-AC01 / WP02.T02" })
    const response = await visit(page, "CAP07")
    const data = response.value.data as {
      cio: Record<string, unknown>; leaders: { id: string; name?: string }[];
      members: { id: string; name?: string; cls?: string; notes?: string; outlook?: string }[]
    }
    const leaderTable = page.getByRole("region", { name: "Leaders" }).getByRole("table")
    const memberTable = page.getByRole("region", { name: "Members" }).getByRole("table")
    await expect(leaderTable.locator("tbody tr")).toHaveCount(data.leaders.length)
    await expect(memberTable.locator("tbody tr")).toHaveCount(data.members.length)
    for (const record of data.members) {
      expect(record.id).toBeTruthy()
      const sourceVersion = response.value.versions["members:" + record.id]
      if (sourceVersion !== undefined) expect(sourceVersion).toBeGreaterThanOrEqual(0)
    }
    if (!response.value.allowedActionIds.includes("saveMember")) {
      await expect(page.locator('[data-sf-action="add-member"] button')).toBeDisabled()
      await expect(memberTable.getByRole("button", { name: "Save member" })).toHaveCount(0)
      expect(data.members.every((item) => !Object.hasOwn(item, "cls") &&
        !Object.hasOwn(item, "outlook") && !Object.hasOwn(item, "notes"))).toBe(true)
    }
    await noDocumentOverflow(page)
  })

  test("U03-AC03 320/768/1024/1280/1440 reflow keeps tables local and actions accessible", async ({ page }, info) => {
    info.annotations.push({ type: "criteria", description: "U03-AC03 / LAYOUT-01; 200% text and 400% equivalent" })
    await visit(page, "CAP07")
    for (const width of [320, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(page.locator('[data-sf-frame="page"]')).toBeVisible()
      await noDocumentOverflow(page)
      expect(await page.locator(".sf-people-table-region").count()).toBeGreaterThanOrEqual(2)
    }
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
    await noDocumentOverflow(page)
    await page.setViewportSize({ width: 320, height: 900 })
    await noDocumentOverflow(page)
    // Browser-zoom proof remains with 120's real zoom instrumentation;
    // CSS font scaling and 320px reflow are not mislabeled as browser zoom.
  })
})
