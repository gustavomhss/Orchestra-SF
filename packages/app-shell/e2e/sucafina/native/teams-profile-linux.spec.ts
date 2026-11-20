import { expect, type Page } from "@playwright/test"
import { Schema } from "effect"
import { SfTeamContextResult } from "@orchestra/schema/sucafina/context"
import { nativeInstalledFixture, observeNativeBinding } from "./fixture.ts"
import type { NativeTarget } from "./fixture.ts"
import { nativeContextURL } from "./fixture/readiness.ts"
import { nativeOwnerQuery, nativeTeamRef } from "./fixture/manifest-contract.ts"
import { proveNarrowTeamChat } from "./fixture/teams-narrow.ts"

const test = nativeInstalledFixture
const shell = "[data-sf-teams-shell]"

async function expectSelectedTeam(page: Page, target: NativeTarget, principalRef: string) {
  await expect(page.locator(shell)).toHaveAttribute("data-sf-team-selected", target.teamObjectId)
  const live = await observeNativeBinding(page, target)
  expect(live.authMode).toBe("microsoft")
  expect(live.profile.teams.status).toBe("ready")
  expect(live.stamp.team?.owner.profile).toEqual(nativeTeamRef(target))
  expect(live.stamp.principalRef).toBe(principalRef)
  expect(live.destinations.some((destination) => destination.canRead)).toBe(true)
  return live
}

test("Two distinct Microsoft accounts enter the same installed Team with their own authority", async ({ page, nativeHarness }) => {
  const { actors, target } = nativeHarness.manifest
  const holder = await nativeHarness.openTeamsActorPage("holder")
  expect(holder.context()).not.toBe(page.context())
  const href = new URL(target.chapterHref, target.shellOrigin).href
  await Promise.all([page.goto(href), holder.goto(href)])
  const [requester, other] = await Promise.all([
    expectSelectedTeam(page, target, actors.requester),
    expectSelectedTeam(holder, target, actors.holder),
  ])
  expect(requester.stamp.team?.owner.profile).toEqual(other.stamp.team?.owner.profile)
  expect(requester.stamp.principalRef).not.toBe(other.stamp.principalRef)
  const grants = (context: typeof requester) => context.destinations
    .map((entry) => JSON.stringify([entry.capabilityId, entry.canRead, [...entry.allowedActionIds].sort()])).sort()
  expect(grants(requester)).not.toEqual(grants(other))

  // Re-read in the opposite order with both browser contexts still attached.
  await holder.reload()
  expect(grants(await expectSelectedTeam(holder, target, actors.holder))).toEqual(grants(other))
  await page.reload()
  expect(grants(await expectSelectedTeam(page, target, actors.requester))).toEqual(grants(requester))
})

test("An explicit Team switch in one window leaves the sibling window on its own Team", async ({ page, nativeHarness }) => {
  const { actors, target, wrongTeam: secondTeam } = nativeHarness.manifest
  const sibling = await nativeHarness.openTeamsActorPage("requester")
  expect(sibling.context()).toBe(page.context())
  const href = new URL(target.chapterHref, target.shellOrigin).href
  await page.setViewportSize({ width: 1280, height: 800 })
  await Promise.all([page.goto(href), sibling.goto(href)])
  const siblingBefore = await expectSelectedTeam(sibling, target, actors.requester)
  const before = await expectSelectedTeam(page, target, actors.requester)
  if (before.profile.teams.status !== "ready") throw new Error("F04_TEAMS_SWITCH_INITIAL_SELECTION_REQUIRED")
  expect(before.profile.teams.choices.some((choice) => choice.profile.teamObjectId === secondTeam.teamObjectId)).toBe(true)
  const picker = page.locator("[data-sf-team-picker]:visible")
  await expect(picker).toHaveValue(target.teamObjectId)
  await picker.selectOption(secondTeam.teamObjectId)
  await expectSelectedTeam(page, secondTeam, actors.requester)
  await expect(sibling).toHaveURL(href)
  const siblingAfter = await expectSelectedTeam(sibling, target, actors.requester)
  expect(siblingAfter.stamp.team?.owner).toEqual(siblingBefore.stamp.team?.owner)
  await expectSelectedTeam(page, secondTeam, actors.requester)
})

test("An authenticated account without Team access cannot open the original business chapter", async ({ nativeHarness }) => {
  const { actors, target } = nativeHarness.manifest
  const denied = await nativeHarness.openTeamsActorPage("denied")
  await denied.setViewportSize({ width: 1280, height: 800 })
  await denied.goto(new URL(target.chapterHref, target.shellOrigin).href)
  await expect(denied.locator(shell)).toHaveAttribute("data-sf-teams-state", "authenticated")
  const live = await observeNativeBinding(denied, target)
  expect(live.stamp.principalRef).toBe(actors.denied)
  expect(["denied", "revoked"]).toContain(live.profile.teams.status)
  expect(live.stamp.team).toBeUndefined()
  expect(live.destinations).toEqual([])
  expect(live.availability).toEqual([])
  await expect(denied.locator("main").getByRole("alert").filter({
    hasText: /This Team is not available for this account\.|Esta equipe não está disponível para esta conta\./,
  })).toBeVisible()
  await expect(denied.locator(shell)).not.toHaveAttribute("data-sf-team-selected", /.+/)
  await expect(denied.locator("[data-sf-open-chat]:visible")).toBeDisabled()
})

test("A foreign installation deep link cannot inherit the current Team selection", async ({ page, nativeHarness }) => {
  const { actors, target, wrongInstallation } = nativeHarness.manifest
  const href = new URL(target.chapterHref, target.shellOrigin).href
  await page.goto(href)
  await expectSelectedTeam(page, target, actors.requester)

  const foreign = new URL(wrongInstallation.chapterHref, wrongInstallation.shellOrigin).href
  await page.goto(foreign)
  await expect(page).toHaveURL(foreign)
  await expect(page.locator("main").getByRole("alert").filter({
    hasText: /This link does not identify a valid Team profile for this installation\.|Este link não identifica um perfil do Teams válido para esta instalação\./,
  })).toBeVisible()
  await expect(page.locator(shell)).not.toHaveAttribute("data-sf-team-selected", /.+/)

  await page.goto(href)
  await expectSelectedTeam(page, target, actors.requester)
})

test("A Microsoft configuration administrator without Teams cannot acquire business access", async ({ nativeHarness }) => {
  const { actors, target } = nativeHarness.manifest
  if (!actors.dashboardAdmin) throw new Error("F04_TEAMS_CONFIGURATION_ADMIN_REQUIRED")
  const admin = await nativeHarness.openTeamsActorPage("dashboardAdmin")
  await admin.setViewportSize({ width: 1280, height: 800 })
  const configuration = new URL("/orchestra/sf-home/administration", target.shellOrigin)
  configuration.search = nativeOwnerQuery(target).toString()
  configuration.searchParams.delete("teamObjectId")
  await admin.goto(configuration.href)
  await expect(admin.locator("[data-sf-team-administration]")).toHaveAttribute("data-sf-team-administration", "ready")

  const selection = new URL(nativeContextURL(target))
  selection.searchParams.set("kind", "selection")
  selection.searchParams.delete("teamObjectId")
  const response = await admin.request.get(selection.href, { maxRedirects: 0, maxRetries: 0 })
  expect(response.status()).toBe(200)
  const context = Schema.decodeUnknownSync(Schema.toCodecJson(SfTeamContextResult))(await response.json())
  if (context.status !== "ok") throw new Error("F04_TEAMS_CONFIGURATION_ADMIN_NOT_AUTHENTICATED")
  expect(context.value.authMode).toBe("microsoft")
  expect(context.value.stamp.principalRef).toBe(actors.dashboardAdmin)
  expect(context.value.profile.administration.status).toBe("available")
  expect(context.value.profile.teams.status).toBe("no-teams")
  expect(context.value.stamp.team).toBeUndefined()
  expect(context.value.destinations).toEqual([])
  expect(context.value.availability).toEqual([])
  await expect(admin.locator("[data-sf-open-chat]:visible")).toBeDisabled()

  await admin.goto(new URL(target.chapterHref, target.shellOrigin).href)
  await expect(admin.locator("main").getByRole("alert").filter({
    hasText: /This Team is not available for this account\.|Esta equipe não está disponível para esta conta\./,
  })).toBeVisible()
  const denied = await observeNativeBinding(admin, target)
  expect(denied.stamp.principalRef).toBe(actors.dashboardAdmin)
  expect(denied.profile.teams.status).toBe("revoked")
  expect(denied.stamp.team).toBeUndefined()
  expect(denied.destinations).toEqual([])
})

test("Keyboard navigation opens a new Team chat draft on narrow Web without changing owner", async ({ page, nativeHarness }) => {
  const { actors, target } = nativeHarness.manifest
  await proveNarrowTeamChat(page, target, actors.requester)
})

test("A Team switch keeps a canceled chat draft and discards it only on confirmation", async ({ page, nativeHarness }) => {
  const { actors, target, wrongTeam: secondTeam } = nativeHarness.manifest
  const source = new URL("/orchestra/sf-sessions/new", target.shellOrigin)
  source.search = nativeOwnerQuery(target).toString()
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(source.href)
  await expectSelectedTeam(page, target, actors.requester)
  const editor = page.locator(".sf-team-session-compose").getByRole("textbox")
  await expect(editor).toBeEditable()
  const draft = "Unsaved qualification draft, never submit"
  await editor.fill(draft)
  await expect(editor).toHaveText(draft)

  const picker = page.locator("[data-sf-team-picker]:visible")
  const dialog = page.locator("dialog.sf-team-dialog[open]")
  await expect(picker).toHaveValue(target.teamObjectId)
  await picker.selectOption(secondTeam.teamObjectId)
  await expect(dialog).toBeVisible()
  await dialog.locator("button[autofocus]").click()
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(source.href)
  await expectSelectedTeam(page, target, actors.requester)
  await expect(editor).toHaveText(draft)
  await expect(picker).toHaveValue(target.teamObjectId)

  await picker.selectOption(secondTeam.teamObjectId)
  await expect(dialog).toBeVisible()
  await dialog.locator("[data-sf-confirm-discard]").click()
  await expect(dialog).toHaveCount(0)
  await expectSelectedTeam(page, secondTeam, actors.requester)
  await expect(editor).toHaveCount(0)

  await picker.selectOption(target.teamObjectId)
  await expectSelectedTeam(page, target, actors.requester)
  await page.locator("[data-sf-open-chat]:visible").click()
  await page.locator("[data-sf-new-chat]").click()
  await expect(editor).toBeEditable()
  await expect(editor).toHaveText("")
})
