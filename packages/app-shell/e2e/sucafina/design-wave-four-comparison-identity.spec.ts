import { expect } from "@playwright/test"
import { Schema } from "effect"
import { SfDomainPageCap17 } from "@orchestra/schema/sucafina/planner"
import { waveFourTest, enter, observePage, scheme, reflow, capture } from "./design-support/wave-four"

// The existing native fixture owns authentication, data and producer lifetime.
waveFourTest.use({ trace: "off", video: "off" })
waveFourTest.describe.configure({ retries: 0 })

waveFourTest("native Planner comparison · fixed labels cover scrolled source values in both themes", async ({
  page, installation, owner,
}, info) => {
  // Retain the original CAP22/CAP23 journey's bounds for this focused read-only proof.
  waveFourTest.setTimeout(420_000)
  page.setDefaultTimeout(15_000)
  expect(info.project.metadata.bundle).toBe("production")
  const messages = observePage(page)
  const writes: string[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (request.method() === "POST" && url.origin === installation.origin && url.pathname.startsWith(installation.mount + "/"))
      writes.push(url.pathname)
  })
  const target = new URL("/orchestra/sf-planner/versions/compare", installation.origin)
  target.searchParams.set("year", String(installation.year))
  const query = { year: String(installation.year) }
  const receipts = await enter(page, owner, target.href, "Compare versions", undefined, [
    { path: "/api/ui/pages/CAP23", query },
    { path: "/api/ui/pages/CAP17", query },
    { path: "/api/ui/pages/CAP17", query },
  ])
  const comparison = page.locator('[data-sf-surface="CAP23-compare"]')
  await expect(comparison).toHaveAttribute("data-sf-wave", "four")
  const selected = [
    await comparison.getByLabel("Source version", { exact: true }).inputValue(),
    await comparison.getByLabel("Compare budget", { exact: true }).inputValue(),
  ]
  expect(selected[0]).not.toBe("")
  expect(selected[1]).not.toBe("")
  expect(new Set(selected).size).toBe(2)
  const originals = receipts!.filter((receipt) => new URL(receipt.request.url()).pathname.endsWith("/CAP17"))
  expect(originals).toHaveLength(2)
  expect(originals.map((receipt) => new URL(receipt.request.url()).searchParams.get("version")).sort()).toEqual([...selected].sort())
  const sourceVersions = originals.map((receipt) => {
    const body = Schema.decodeUnknownSync(SfDomainPageCap17.output)(receipt.body)
    if (body.status !== "ok") throw new Error("The original comparison source is unavailable")
    const version = new URL(receipt.request.url()).searchParams.get("version")
    const chosen = body.value.data.selectedVersion
    if (!chosen) throw new Error("The original comparison source did not select a version")
    expect(chosen).toMatchObject({ id: version, year: installation.year })
    expect(body.value.data.summary).not.toBeNull()
    return chosen
  })
  const sourceNames = selected.map((id) => {
    const version = sourceVersions.find((value) => value.id === id)
    if (!version || typeof version.name !== "string") throw new Error("The selected source version has no name")
    return version.name
  })
  const measurements: unknown[] = []
  for (const colorScheme of ["dark", "light"] as const) {
    // The native theme control belongs to desktop chrome; no extra admission is needed.
    await page.setViewportSize({ width: 1440, height: 1100 })
    await scheme(page, colorScheme)
    await page.setViewportSize({ width: 320, height: 900 })
    await reflow(page)
    for (const kind of ["summary", "monthly"] as const) {
      const selector = kind === "monthly" ? "table.sf-u46-monthly" : "table:not(.sf-u46-monthly)"
      const table = comparison.locator(selector)
      const panel = comparison.locator(".sf-u46-compare-panel").filter({ has: page.locator(selector) })
      const scroller = panel.locator(".sf-u46-compare-scroll")
      const heading = panel.getByRole("heading", { level: 3 })
      const header = table.locator("thead tr:first-child > th:first-child")
      const rowHeaders = table.getByRole("rowheader")
      await expect(rowHeaders).toHaveCount(kind === "monthly" ? 12 : 5)
      await expect(table.locator(kind === "monthly" ? 'thead th[scope="colgroup"]' : "thead th:not(:first-child)")).toHaveText(sourceNames)
      const sourceText = await table.locator("tbody").innerText()
      const headingLeft = (await heading.boundingBox())!.x
      await expect.poll(() => scroller.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(0)
      await scroller.focus()
      for (const endpoint of ["start", "end"] as const) {
        await scroller.evaluate((element, end) => { element.scrollLeft = end ? element.scrollWidth : 0 }, endpoint === "end")
        await expect.poll(() => scroller.evaluate((element, end) =>
          Math.abs(element.scrollLeft - (end ? element.scrollWidth - element.clientWidth : 0)), endpoint === "end")).toBeLessThanOrEqual(1)
        const scrollerBox = (await scroller.boundingBox())!
        const headerBox = (await header.boundingBox())!
        expect(headerBox.x).toBeGreaterThanOrEqual(scrollerBox.x - 1)
        expect(headerBox.x + headerBox.width).toBeLessThanOrEqual(scrollerBox.x + scrollerBox.width + 1)
        expect(Math.abs((await heading.boundingBox())!.x - headingLeft)).toBeLessThanOrEqual(1)
        const covers = await table.locator("thead tr:first-child > th:first-child, tbody th").evaluateAll((elements) => {
          // Let the browser parse its computed color, including supported CSS color spaces.
          const canvas = document.createElement("canvas")
          canvas.width = canvas.height = 1
          const paint = canvas.getContext("2d")!
          return elements.map((element) => {
            const style = getComputedStyle(element)
            paint.clearRect(0, 0, 1, 1)
            paint.fillStyle = style.backgroundColor
            paint.fillRect(0, 0, 1, 1)
            return { label: element.textContent, background: style.backgroundColor,
              alpha: paint.getImageData(0, 0, 1, 1).data[3], opacity: style.opacity,
              position: style.position, left: element.getBoundingClientRect().left }
          })
        })
        expect(covers).toHaveLength(kind === "monthly" ? 13 : 6)
        for (const cover of covers) {
          expect(cover.position).toBe("sticky")
          expect(cover.alpha, "fixed labels fully cover values passing behind them").toBe(255)
          expect(cover.opacity).toBe("1")
          expect(cover.left).toBeGreaterThanOrEqual(scrollerBox.x - 1)
        }
        await expect(table.locator("tbody")).toHaveText(sourceText, { useInnerText: true })
        measurements.push({ colorScheme, kind, endpoint, covers })
        await capture(page, info, "CAP23-fixed-" + kind + "-" + colorScheme + "-320-" + endpoint + "-test-data")
      }
    }
  }
  expect(writes).toEqual([])
  expect(messages.pageErrors).toEqual([])
  expect(messages.consoleErrors).toEqual([])
  await info.attach("native-planner-fixed-label-evidence", {
    contentType: "application/json",
    body: JSON.stringify({ source: "original CAP23 and two independent original CAP17 responses",
      selected, sourceNames, widths: [320], schemes: ["dark", "light"], measurements, writes, ...messages }, null, 2),
  })
})
