import { expect } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture"

test.describe("N16 U30 installed risk and stakeholder workspaces", () => {
  for (const [surface,route] of [
    ["CAP13","/orchestra/sf-operations/risks"],
    ["CAP15","/orchestra/sf-operations/stakeholders"],
  ] as const) {
    test(surface + " retains the real owner fence and never permits an unadmitted mutation", async ({ page,nativeHarness }) => {
      const target=nativeHarness.manifest.target
      await page.goto(new URL(route,target.shellOrigin).toString())
      const chapter=page.locator('[data-sf-surface="' + surface + '"]')
      await expect(chapter).toBeVisible()
      const authority=await chapter.getAttribute("data-sf-authorized")
      expect(["true","false"]).toContain(authority)
      if (authority==="false") {
        await expect(chapter.getByRole("button",{name:/New risk|New relationship|Novo risco|Novo relacionamento/})).toHaveCount(0)
        await expect(chapter.locator("form.sf-u30-editor")).toHaveCount(0)
      } else {
        await expect(chapter.locator("section.sf-u30-filters")).toBeVisible()
        await expect(chapter.locator("section.sf-u30-list")).toBeVisible()
      }
    })
  }
})
