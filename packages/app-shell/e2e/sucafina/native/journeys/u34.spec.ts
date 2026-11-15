import { expect, test } from "@playwright/test"

// Original BusinessPorts schedule installation, not Maestro/Core Schedule.
function installed(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(name + " requires the installed 120/119 N29 schedule fixture")
  return value
}
test.use({ trace: "off", video: "off", screenshot: "off" })
test.describe("N29 U34 native Schedule with current-version fencing", () => {
  test.describe.configure({ retries: 0 })

  test("UI66 lists actual producer schedule identities and fences editing without scheduleDetails.read", async ({ page }) => {
    const ref = installed("SF_NATIVE_U34_SCHEDULE_REF")
    await page.goto(installed("SF_NATIVE_U34_NO_DETAIL_URL"))
    const surface = page.locator('[data-sf-surface="UI66"]')
    await expect(surface).toHaveAttribute("data-state", "ready")
    const row = surface.getByRole("article").filter({ has: page.getByRole("heading", { name: ref, exact: true }) })
    await expect(row).toBeVisible()
    await row.getByRole("button", { name: /Review schedule|Revisar recorrência/ }).click()
    await expect(surface.getByText(/schedule-detail-port-unavailable/)).toBeVisible()
    await expect(surface.getByRole("button", { name: /Edit schedule|Editar recorrência/ })).toBeDisabled()
    await expect(surface.getByRole("button", { name: /New recurrence|Nova recorrência/ })).toBeVisible()
  })

  test("UI66 requires review and current immutable identity for an installed create", async ({ page }) => {
    await page.goto(installed("SF_NATIVE_U34_CREATE_URL"))
    const surface = page.locator('[data-sf-surface="UI66"]')
    await expect(surface).toBeVisible()
    await surface.getByRole("button", { name: /New recurrence|Nova recorrência/ }).click()
    await surface.getByRole("textbox", { name: /Condition reference|Referência da condição/ }).fill(installed("SF_NATIVE_U34_CONDITION_REF"))
    await surface.getByRole("textbox", { name: /Recipe reference|Referência da receita/ }).fill(installed("SF_NATIVE_U34_RECIPE_REF"))
    await surface.getByRole("textbox", { name: /^Recurrence$|^Recorrência$/ }).fill(installed("SF_NATIVE_U34_RECURRENCE"))
    await surface.getByRole("textbox", { name: /Timezone|Fuso horário/ }).fill(installed("SF_NATIVE_U34_TIMEZONE"))
    await expect(surface.getByRole("button", { name: /Review proposed changes|Revisar alterações propostas/ })).toBeEnabled()
    await surface.getByRole("button", { name: /Review proposed changes|Revisar alterações propostas/ }).click()
    await expect(surface).toHaveAttribute("data-phase", "reviewing")
    await expect(surface.getByRole("button", { name: /Confirm reviewed change|Confirmar alteração revisada/ })).toBeVisible()
    // This stops before mutation; separate 120 owner-scoped producer test executes create/pause.
  })

  test("UI66 preserves reachable details in 320px and 400% reflow", async ({ page }) => {
    await page.goto(installed("SF_NATIVE_U34_NO_DETAIL_URL"))
    const surface = page.locator('[data-sf-surface="UI66"]')
    await expect(surface).toHaveAttribute("data-state", "ready")
    for (const width of [320, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 850 })
      await expect(surface.getByRole("heading", { name: /Schedules|Recorrências/ })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false)
    }
    await page.setViewportSize({ width: 1280, height: 850 })
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
    await page.setViewportSize({ width: 320, height: 850 })
    await expect(surface.getByRole("heading", { name: /Schedules|Recorrências/ })).toBeVisible()
  })
})
