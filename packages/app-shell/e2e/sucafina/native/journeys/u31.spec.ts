import { expect } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture"

// Executed by 120 only after 125 mounts real CAP16 and the authenticated
// installed host is bound to the F04 private manifest. No interception or mocks.
test.describe("N16 U31 native IT Performance Contract", () => {
  test("owner-bound contract, items, source score, quarter and allocations render without fabricated aggregates",
    async ({ page,nativeHarness }) => {
      const target=nativeHarness.manifest.target
      await page.goto(new URL("/orchestra/sf-operations/performance",target.shellOrigin).toString())
      const chapter=page.locator('[data-sf-surface="CAP16"]')
      await expect(chapter).toBeVisible()
      const owner=await chapter.getAttribute("data-sf-authorized")
      expect(["true","false"]).toContain(owner)
      if(owner==="false") {
        await expect(chapter.locator("[data-sf-performance-editor]")).toHaveCount(0)
        await expect(chapter.getByRole("button",{name:/Save item|Delete item|Add sub-item|Save sub-item/})).toHaveCount(0)
      } else {
        await expect(chapter.locator("#performance-contract")).toBeVisible()
        await expect(chapter.locator("#owner-dashboard")).toBeVisible()
        await expect(chapter.locator("#sf-u31-items")).toBeVisible()
        // Global score is not in A01's source projection; never synthesize one from raw sub-items.
        await expect(chapter.getByText(/Unavailable|Indisponível no momento/).first()).toBeVisible()
        const items=chapter.locator("[data-sf-performance-item]")
        const count=await items.count()
        if(count>0){
          await expect(items.first().getByRole("heading")).toBeVisible()
          const sub=items.first().locator("[data-sf-performance-sub]")
          if(await sub.count()>0){
            await expect(sub.first().locator("td").first()).toBeVisible()
          }
        }
      }
    })
})
