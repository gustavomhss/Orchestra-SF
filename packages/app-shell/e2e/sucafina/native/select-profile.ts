import { expect } from "@playwright/test"
import type { Page } from "@playwright/test"

type SfProfile = {
  origin: string
  directory: string
  chapterPath?: string
}

/** Select the enrolled installation's real directory through the shell profile UI. */
export async function selectSfProfile(page: Page, input: SfProfile) {
  const chapter = new URL(input.chapterPath ?? "/orchestra/sf-dashboard/budget", input.origin)
  expect(chapter.origin).toBe(new URL(input.origin).origin)
  expect(chapter.search).toBe("")
  expect(input.directory).not.toBe("")
  await page.goto(chapter.href)

  const profile = page.locator('[data-slot="orchestra-profile"]')
  await expect(profile).toBeVisible()
  await profile.click()
  const picker = page.locator('[data-component="orchestra-profile-picker"]')
  const add = picker.getByRole("menuitem", { name: "Add project", exact: true })
  await expect(add, "The isolated context has one selected server").toHaveCount(1)
  await add.click()

  const dialog = page.getByRole("dialog", { name: "Open project", exact: true })
  await dialog.getByPlaceholder("Search folders", { exact: true }).fill(input.directory)
  const directory = dialog.locator(`[data-directory-path=${JSON.stringify(input.directory)}]`)
  await expect(directory).toHaveCount(1)
  const discovered = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return response.request().method() === "GET" && url.origin === chapter.origin
      && url.pathname === "/api/sucafina/installations"
      && url.searchParams.get("select") === "location"
      && url.searchParams.get("location[directory]") === input.directory
  })
  await directory.click()
  const response = await discovered
  expect(response.status()).toBe(200)
  const installed: unknown = await response.json()
  expect(installed).toEqual({
    installations: [expect.objectContaining({
      installationId: expect.stringMatching(/\S/),
      projectId: expect.stringMatching(/\S/),
      publicOrigin: chapter.origin,
      contractRevision: "sf-native-ui/1",
    })],
  })

  const owner = page.locator('[data-sf-host="owner-runtime231"]')
  await expect(owner).toHaveAttribute("data-sf-provider-state", "ready")
  await expect(profile.locator("small")).toHaveAttribute("title", input.directory)
  // A bare route and reload must keep the real profile; exact business anchors
  // deliberately do not carry server/project/installation query parameters.
  await page.reload()
  await expect(page).toHaveURL(chapter.href)
  await expect(owner).toHaveAttribute("data-sf-provider-state", "ready")
  await expect(profile.locator("small")).toHaveAttribute("title", input.directory)
}
