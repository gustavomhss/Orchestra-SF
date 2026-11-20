import { isDeepStrictEqual } from "node:util"
import { expect, type Page } from "@playwright/test"
import { SfTeamContextResult } from "@orchestra/schema/sucafina/context"
import { Schema } from "effect"
import { nativeOwnerQuery, nativeTeamRef, validateNativeTarget, type NativeTarget } from "./manifest-contract.ts"
import { nativeContextURL, observeNativeBinding } from "./readiness.ts"

/** Installed narrow-Web draft entry only; never submit or open an existing chat. */
export async function proveNarrowTeamChat(page: Page, target: NativeTarget, principalRef: string): Promise<void> {
  const selected = validateNativeTarget(target)
  const chapter = new URL(selected.chapterHref, selected.shellOrigin)
  const newChatURL = new URL("/orchestra/sf-sessions/new", selected.shellOrigin)
  newChatURL.search = nativeOwnerQuery(selected).toString()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(chapter.href, { waitUntil: "domcontentloaded" })
  const shell = page.locator("[data-sf-teams-shell]")
  await expect(shell).toHaveAttribute("data-sf-teams-state", "authenticated")
  await expect(shell).toHaveAttribute("data-sf-team-selected", selected.teamObjectId)
  await expect(page).toHaveURL(chapter.href)

  const live = await observeNativeBinding(page, selected)
  if (live.contractRevision !== "sf-team-profile/1" || live.authMode !== "microsoft" ||
      live.stamp.principalRef !== principalRef || live.profile.teams.status !== "ready" ||
      !isDeepStrictEqual(live.stamp.team?.owner.profile, nativeTeamRef(selected)))
    throw new Error("F04_NARROW_CHAT_CONTEXT_OWNER_MISMATCH")

  const toggle = shell.locator("button.sf-team-menu-toggle")
  const mobile = shell.locator(".sf-team-mobile")
  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAttribute("aria-expanded", "false")
  await toggle.press("Enter")
  await expect(toggle).toHaveAttribute("aria-expanded", "true")
  const picker = mobile.locator("[data-sf-team-picker]")
  await expect(picker).toBeVisible()
  await expect(picker).toHaveValue(selected.teamObjectId)
  const openChat = mobile.locator("button[data-sf-open-chat]")
  await expect(openChat).toBeVisible()
  await expect(openChat).toBeEnabled()
  await openChat.press("Enter")
  await expect(mobile).toBeHidden()
  await expect(page).toHaveURL(newChatURL.href)

  const workspace = shell.locator("[data-sf-session-workspace]")
  await expect(workspace).toHaveAttribute("data-sf-session-state", "ready")
  const newChat = workspace.locator("button[data-sf-new-chat]")
  await expect(newChat).toBeVisible()
  await expect(newChat).toBeEnabled()
  // The route is already /new. Require the workspace button's original F02 revalidation, not just an unchanged URL.
  const contextURL = new URL(nativeContextURL(selected))
  contextURL.searchParams.sort()
  const [response] = await Promise.all([
    page.waitForResponse((candidate) => {
      const url = new URL(candidate.url())
      url.searchParams.sort()
      return candidate.request().method() === "GET" && url.href === contextURL.href
    }),
    newChat.press("Enter"),
  ])
  if (response.status() !== 200) throw new Error("F04_NARROW_CHAT_CONTEXT_REVALIDATION_FAILED")
  const renewed = Schema.decodeUnknownSync(Schema.toCodecJson(SfTeamContextResult), { onExcessProperty: "error" })(await response.json())
  if (renewed.status !== "ok" || !isDeepStrictEqual(renewed.value.stamp, live.stamp))
    throw new Error("F04_NARROW_CHAT_CONTEXT_STAMP_CHANGED")

  await expect(page).toHaveURL(newChatURL.href)
  await expect(shell).toHaveAttribute("data-sf-team-selected", selected.teamObjectId)
  await expect(workspace.locator("[data-sf-session-transcript] .sf-team-session-empty")).toBeVisible()
  const draft = workspace.locator(".sf-team-session-compose").getByRole("textbox")
  await expect(draft).toBeVisible()
  await expect(draft).toBeEditable()

  // The Electron preload exposes window.api; this journey must stay in Web.
  expect(await page.evaluate(() => "api" in window)).toBe(false)
  await expect(page.locator('[data-component="session-new-design"], .directory-picker-v2')).toHaveCount(0)
}
