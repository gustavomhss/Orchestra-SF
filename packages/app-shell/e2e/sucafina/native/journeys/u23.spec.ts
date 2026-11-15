import { expect, type Page } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture"

// Installed host only. No request interception, fake auth, mock documents,
// self-issued "clean" scan, or retry of a mutation after a lost response.
test.describe("N27/U23 — real native import and export leaves", () => {
  test.describe.configure({ retries: 0 })

  const visit = async (page: Page, origin: string, path: string) => {
    const destination = new URL(path, origin)
    if (destination.origin !== origin) throw new Error("U23_CROSS_OWNER_ROUTE_REJECTED")
    await page.goto(destination.href)
  }
  const required = (key: string) => {
    const value = process.env[key]
    if (!value?.trim()) throw new Error("U23_REAL_INSTALLED_SEED_REQUIRED:" + key)
    return value
  }
  const token = (ref: string) => "r_" + Buffer.from(ref, "utf8").toString("base64url")
  const noOverflow = async (page: Page) => {
    const dimensions = await page.locator('[data-sf-leaf="u23"]').evaluate((leaf) => ({
      width: leaf.clientWidth, content: leaf.scrollWidth,
    }))
    expect(dimensions.content, "The files leaf must reflow without horizontal overflow").toBeLessThanOrEqual(dimensions.width + 1)
  }

  test("UI55 requires an authorized target and file before a preview; no Apply or receipt on load", async ({ page, nativeHarness }, info) => {
    info.annotations.push({ type: "criteria-scope", description: "U23-AC01; U23-AC02; file/target/options admission" })
    await visit(page, nativeHarness.manifest.target.shellOrigin, "/orchestra/sf-imports/new")
    const leaf = page.locator('[data-sf-leaf="u23"][data-sf-surface="UI55"]')
    await expect(leaf).toBeVisible()
    await expect(leaf.locator('input[type="file"]')).toBeVisible()
    await expect(leaf.getByRole("button", { name: /Generate preview|Gerar prévia/ })).toBeDisabled()
    await expect(leaf.getByRole("button", { name: /Apply reviewed import/ })).toHaveCount(0)
    await expect(leaf.locator('[data-sf-receipt="producer"]')).toHaveCount(0)
    await expect(leaf.locator('[data-sf-phase="submitting"]')).toHaveCount(0)
  })

  test("UI56/57 current-base review and receipt are different routes; receipt load never applies", async ({ page, nativeHarness }, info) => {
    info.annotations.push({ type: "criteria-scope", description: "U23-AC01; U23-AC02; manifest-source fence" })
    const id = required("SF_NATIVE_IMPORT_MANIFEST_REF")
    const surface = required("SF_NATIVE_IMPORT_SURFACE")
    if (surface !== "planner" && surface !== "dashboard") throw new Error("U23_INVALID_REAL_SURFACE")
    const encoded = token(id)
    const origin = nativeHarness.manifest.target.shellOrigin
    await visit(page, origin, "/orchestra/sf-imports/" + encoded + "/preview")
    const preview = page.locator('[data-sf-leaf="u23"][data-sf-surface="UI56"]')
    await expect(preview).toBeVisible()
    await preview.getByRole("combobox").selectOption(surface)
    await preview.getByRole("button", { name: /Refresh receipt/ }).click()
    await expect(preview.locator(".sf-files-change").or(preview.getByRole("heading", { name: /Domain impact/ }))).toBeVisible()
    await expect(preview.getByRole("button", { name: /Apply reviewed import/ })).toHaveCount(0)

    const receiptId = required("SF_NATIVE_IMPORT_RECEIPT_MANIFEST_REF")
    await visit(page, origin, "/orchestra/sf-imports/" + token(receiptId) + "/receipt")
    const receipt = page.locator('[data-sf-leaf="u23"][data-sf-surface="UI57"]')
    await expect(receipt).toBeVisible()
    await receipt.getByRole("combobox").selectOption(surface)
    await receipt.getByRole("button", { name: /Refresh receipt/ }).click()
    await expect(receipt.locator('[data-sf-receipt="producer"]')).toBeVisible()
    await expect(receipt.getByRole("button", { name: /Apply reviewed import/ })).toHaveCount(0)
  })

  test("UI68 consumes actual byte exports and exposes one producer-backed download", async ({ page, nativeHarness }, info) => {
    info.annotations.push({ type: "criteria-scope", description: "U23-AC01; UI68 authorized byte download" })
    await visit(page, nativeHarness.manifest.target.shellOrigin, "/orchestra/sf-imports/exports")
    const leaf = page.locator('[data-sf-leaf="u23"][data-sf-surface="UI68"]')
    await expect(leaf).toBeVisible()
    await expect(leaf.getByRole("combobox")).toHaveValue("xlsx")
    await expect(leaf.locator('[data-sf-export="authorized-bytes"]')).toHaveCount(0)
    await page.getByRole("button", { name: /Exportar|Export/, exact: true }).click()
    const link = leaf.locator('[data-sf-export="authorized-bytes"]')
    await expect(link).toBeVisible()
    const downloaded = page.waitForEvent("download")
    await link.click()
    expect((await downloaded).suggestedFilename()).toMatch(/\.xlsx$/)
  })

  test("UI55 January→February invalidates the real target and requires a new authorized discovery", async ({ page, nativeHarness }, info) => {
    info.annotations.push({
      type: "criteria-scope",
      description: "PRE147-R02-04; U23-AC01; U23-AC02; R02-AC02; real producer discovery, no simulated authorization",
    })
    const year = required("SF_NATIVE_IMPORT_PERIOD_TEST_YEAR")
    if (!/^\d{4}$/.test(year)) throw new Error("U23_REAL_PERIOD_YEAR_REQUIRED")
    const sourceFile = required("SF_NATIVE_IMPORT_FILE_PATH")
    const january = { start: year + "-01-01", end: year + "-01-31" }
    const february = { start: year + "-02-01", end: year + "-02-28" }
    const issuedMutations: string[] = []
    page.on("request", (request) => {
      const operation = new URL(request.url()).searchParams.get("sf")
      if (operation === "import-admit" || operation === "import-preview" || operation === "import-apply")
        issuedMutations.push(operation)
    })

    await visit(page, nativeHarness.manifest.target.shellOrigin, "/orchestra/sf-imports/new")
    const leaf = page.locator('[data-sf-leaf="u23"][data-sf-surface="UI55"]')
    await expect(leaf).toBeVisible()
    const start = leaf.getByLabel("Period start")
    const end = leaf.getByLabel("Period end")
    const destination = leaf.getByLabel("Destination", { exact: true })
    const generate = leaf.getByRole("button", { name: "Generate preview" })
    const find = leaf.getByRole("button", { name: "Find destinations" })

    await start.fill(january.start)
    await end.fill(january.end)
    const januaryRequest = page.waitForRequest((request) => {
      const url = new URL(request.url())
      return url.searchParams.get("sf") === "import-targets" &&
        url.searchParams.get("start") === january.start && url.searchParams.get("end") === january.end
    })
    await find.click()
    await januaryRequest
    await expect(destination).toBeEnabled()
    await expect(destination.locator('option[value]:not([value=""])')).not.toHaveCount(0)
    await destination.selectOption({ index: 1 })
    await leaf.locator('input[type="file"]').setInputFiles(sourceFile)
    await expect(generate).toBeEnabled()

    // Changing just the start already revokes January selection, even before end is updated.
    await start.fill(february.start)
    await expect(destination).toBeDisabled()
    await expect(destination).toHaveValue("")
    await expect(destination.locator("option")).toHaveCount(1)
    await expect(generate).toBeDisabled()
    await expect(leaf.locator('[data-sf-discovery="required"]')).toBeVisible()
    await expect(leaf).toHaveAttribute("data-sf-phase", "selecting")
    await expect(leaf.locator('[data-sf-receipt="producer"]')).toHaveCount(0)

    await end.fill(february.end)
    await expect(destination).toBeDisabled()
    await expect(generate).toBeDisabled()
    const februaryRequest = page.waitForRequest((request) => {
      const url = new URL(request.url())
      return url.searchParams.get("sf") === "import-targets" &&
        url.searchParams.get("start") === february.start && url.searchParams.get("end") === february.end
    })
    await find.click()
    await februaryRequest
    await expect(destination).toBeEnabled()
    // Even an identical selectionRef must be chosen again in the new period.
    await expect(destination).toHaveValue("")
    await expect(generate).toBeDisabled()
    await expect(leaf.locator('[data-sf-discovery="required"]')).toHaveCount(0)

    await destination.selectOption({ index: 1 })
    await expect(generate).toBeEnabled()
    await leaf.getByLabel("source").selectOption("dashboard")
    await expect(destination).toBeDisabled()
    await expect(destination).toHaveValue("")
    await expect(generate).toBeDisabled()
    await expect(leaf.locator('[data-sf-discovery="required"]')).toBeVisible()
    // Returning to the import leaf must never resurrect the old selection or review.
    await visit(page, nativeHarness.manifest.target.shellOrigin, "/orchestra/sf-imports/exports")
    await visit(page, nativeHarness.manifest.target.shellOrigin, "/orchestra/sf-imports/new")
    await expect(leaf).toBeVisible()
    await expect(destination).toBeDisabled()
    await expect(generate).toBeDisabled()
    await expect(leaf.locator('[data-sf-receipt="producer"]')).toHaveCount(0)
    expect(issuedMutations, "Changing period/surface/route must not admit, preview or apply an old target").toEqual([])
  })

  test("UI55 responsive source fields and actions remain reachable at all frozen widths", async ({ page, nativeHarness }, info) => {
    info.annotations.push({ type: "criteria-scope", description: "U23-AC03; 320/768/1024/1280/1440" })
    await visit(page, nativeHarness.manifest.target.shellOrigin, "/orchestra/sf-imports/new")
    const leaf = page.locator('[data-sf-leaf="u23"][data-sf-surface="UI55"]')
    for (const width of [320, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(leaf.locator('input[type="file"]')).toBeVisible()
      await expect(leaf.getByRole("button", { name: /Find destinations/ })).toBeVisible()
      await noOverflow(page)
    }
  })
})
