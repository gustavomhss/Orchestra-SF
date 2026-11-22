import { expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import {
  adminCatalog, configureTeam, contextReply, focusRefresh, installedTest,
  observe, ownerQuery, selected, switchTeam, teamRef, uiContext, uiReply,
} from "./installed-fixture.ts"
import type { Target } from "./installed-fixture.ts"

const test = installedTest
const shell = "[data-sf-teams-shell]"
test.describe.configure({ mode: "serial" })
const grants = (live: Awaited<ReturnType<typeof observe>>) => live.destinations
  .map((entry) => JSON.stringify([entry.capabilityId, entry.canRead, [...entry.allowedActionIds].sort()])).sort()
const href = (target: Target) => new URL(target.chapterHref, target.shellOrigin).href
const deniedMessage = /This Team is not available for this account\.|Esta equipe não está disponível para esta conta\./

async function expectRevoked(page: Page, target: Target, principal: string) {
  const live = await observe(page, target)
  expect(live.stamp.principalRef).toBe(principal)
  expect(live.profile.teams.status).toBe("revoked")
  expect(live.stamp.team).toBeUndefined()
  expect(live.destinations).toEqual([])
  expect(live.availability).toEqual([])
  await expect(page.locator(shell)).not.toHaveAttribute("data-sf-team-selected", /.+/)
  await expect(page.locator("main").getByRole("alert").filter({ hasText: deniedMessage })).toBeVisible()
  await expect(page.locator("[data-sf-open-chat]:visible")).toBeDisabled()
  return live
}

test("Two distinct Microsoft accounts enter the same installed Team with their own authority", async ({ harness }) => {
  const { target, actors } = harness.plan
  const page = await harness.page(), holder = await harness.page("holder")
  expect(page.context()).not.toBe(holder.context())
  await Promise.all([page.goto(href(target)), holder.goto(href(target))])
  const requester = await selected(page, target, actors.requester), other = await selected(holder, target, actors.holder)
  expect(requester.stamp.team?.owner.profile).toEqual(other.stamp.team?.owner.profile)
  expect(requester.stamp.principalRef).not.toBe(other.stamp.principalRef)
  expect(grants(requester)).not.toEqual(grants(other))
  await holder.reload()
  expect(grants(await selected(holder, target, actors.holder))).toEqual(grants(other))
  await page.reload()
  expect(grants(await selected(page, target, actors.requester))).toEqual(grants(requester))
})

test("An explicit A B A Team switch leaves the sibling window on its own Team", async ({ harness }) => {
  const { target, teamB, actors } = harness.plan
  const page = await harness.page(), sibling = await harness.page()
  expect(page.context()).toBe(sibling.context())
  await page.setViewportSize({ width: 1280, height: 800 })
  await Promise.all([page.goto(href(target)), sibling.goto(href(target))])
  const before = await selected(page, target, actors.requester), siblingBefore = await selected(sibling, target, actors.requester)
  if (before.profile.teams.status !== "ready") throw new Error("G08_INITIAL_TEAM_NOT_READY")
  expect(before.profile.teams.choices.some((choice) => choice.profile.teamObjectId === teamB.teamObjectId)).toBe(true)
  const picker = page.locator("[data-sf-team-picker]:visible")
  await expect(picker).toHaveValue(target.teamObjectId)
  await switchTeam(page, teamB, actors.requester, () => picker.selectOption(teamB.teamObjectId))
  await expect(sibling).toHaveURL(href(target))
  expect((await selected(sibling, target, actors.requester)).stamp.team?.owner).toEqual(siblingBefore.stamp.team?.owner)
  expect(grants(await switchTeam(page, target, actors.requester, () => picker.selectOption(target.teamObjectId))))
    .toEqual(grants(before))
  await sibling.reload()
  expect((await selected(sibling, target, actors.requester)).stamp.team?.owner).toEqual(siblingBefore.stamp.team?.owner)
})

test("An authenticated account without Team access cannot open the original business chapter", async ({ harness }) => {
  const { target, actors } = harness.plan
  const denied = await harness.page("denied")
  await denied.goto(href(target))
  await expect(denied.locator(shell)).toHaveAttribute("data-sf-teams-state", "authenticated")
  const live = await observe(denied, target)
  expect(live.stamp.principalRef).toBe(actors.denied)
  expect(["denied", "revoked"]).toContain(live.profile.teams.status)
  expect(live.stamp.team).toBeUndefined()
  expect(live.destinations).toEqual([])
  expect(live.availability).toEqual([])
  await expect(denied.locator("main").getByRole("alert").filter({ hasText: deniedMessage })).toBeVisible()
  await expect(denied.locator(shell)).not.toHaveAttribute("data-sf-team-selected", /.+/)
  await expect(denied.locator("[data-sf-open-chat]:visible")).toBeDisabled()
})

test("A foreign installation deep link and reload cannot inherit the current Team selection", async ({ harness }) => {
  const { target, foreignInstallation, actors } = harness.plan
  const page = await harness.page()
  await page.goto(href(target))
  await selected(page, target, actors.requester)
  await page.goto(href(foreignInstallation))
  const error = page.locator("main").getByRole("alert").filter({
    hasText: /This link does not identify a valid Team profile for this installation\.|Este link não identifica um perfil do Teams válido para esta instalação\./,
  })
  await expect(page).toHaveURL(href(foreignInstallation))
  await expect(error).toBeVisible()
  await expect(page.locator(shell)).not.toHaveAttribute("data-sf-team-selected", /.+/)
  await page.reload()
  await expect(page).toHaveURL(href(foreignInstallation))
  await expect(error).toBeVisible()
  await expect(page.locator(shell)).not.toHaveAttribute("data-sf-team-selected", /.+/)
  await page.goto(href(target))
  await selected(page, target, actors.requester)
})

test("A Microsoft configuration administrator without Teams cannot acquire business access", async ({ harness }) => {
  const { target, actors } = harness.plan
  const admin = await harness.page("dashboardAdmin")
  const configuration = new URL("/orchestra/sf-home/administration", target.shellOrigin)
  configuration.search = ownerQuery(target).toString()
  configuration.searchParams.delete("teamObjectId")
  await admin.goto(configuration.href)
  await expect(admin.locator("[data-sf-team-administration]")).toHaveAttribute("data-sf-team-administration", "ready")
  const live = await observe(admin, target, true)
  expect(live.stamp.principalRef).toBe(actors.dashboardAdmin)
  expect(live.profile.administration.status).toBe("available")
  expect(live.profile.teams.status).toBe("no-teams")
  expect(live.stamp.team).toBeUndefined()
  expect(live.destinations).toEqual([])
  expect(live.availability).toEqual([])
  await expect(admin.locator("[data-sf-open-chat]:visible")).toBeDisabled()
  await admin.goto(href(target))
  await expectRevoked(admin, target, actors.dashboardAdmin)
})

test("Keyboard navigation opens a new Team chat draft on narrow Web without changing owner", async ({ harness }) => {
  const { target, actors } = harness.plan
  const page = await harness.page()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(href(target))
  const live = await selected(page, target, actors.requester)
  const root = page.locator(shell), toggle = root.locator("button.sf-team-menu-toggle"), mobile = root.locator(".sf-team-mobile")
  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAttribute("aria-expanded", "false")
  await toggle.press("Enter")
  await expect(toggle).toHaveAttribute("aria-expanded", "true")
  await expect(mobile.locator("[data-sf-team-picker]")).toHaveValue(target.teamObjectId)
  const openChat = mobile.locator("button[data-sf-open-chat]")
  await expect(openChat).toBeEnabled()
  await openChat.press("Enter")
  await expect(mobile).toBeHidden()
  const newChatURL = new URL("/orchestra/sf-sessions/new", target.shellOrigin)
  newChatURL.search = ownerQuery(target).toString()
  await expect(page).toHaveURL(newChatURL.href)
  const workspace = root.locator("[data-sf-session-workspace]")
  await expect(workspace).toHaveAttribute("data-sf-session-state", "ready")
  const newChat = workspace.locator("button[data-sf-new-chat]")
  await expect(newChat).toBeEnabled()
  const revalidated = await uiContext(page, target, () => newChat.press("Enter"))
  expect(revalidated.stamp).toEqual(live.stamp)
  await expect(workspace.locator("[data-sf-session-transcript] .sf-team-session-empty")).toBeVisible()
  await expect(workspace.locator(".sf-team-session-compose").getByRole("textbox")).toBeEditable()
  expect(await page.evaluate(() => "api" in window)).toBe(false)
  await expect(page.locator('[data-component="session-new-design"], .directory-picker-v2')).toHaveCount(0)
})

test("A Team switch keeps a canceled chat draft and discards it only on confirmation", async ({ harness }) => {
  const { target, teamB, actors } = harness.plan
  const page = await harness.page(), source = new URL("/orchestra/sf-sessions/new", target.shellOrigin)
  source.search = ownerQuery(target).toString()
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(source.href)
  await selected(page, target, actors.requester)
  const editor = page.locator(".sf-team-session-compose").getByRole("textbox")
  await expect(editor).toBeEditable()
  const draft = "Unsaved qualification draft; never submit"
  await editor.fill(draft)
  await expect(editor).toHaveText(draft)
  const picker = page.locator("[data-sf-team-picker]:visible"), dialog = page.locator("dialog.sf-team-dialog[open]")
  await picker.selectOption(teamB.teamObjectId)
  await expect(dialog).toBeVisible()
  await dialog.locator("button[autofocus]").click()
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(source.href)
  await selected(page, target, actors.requester)
  await expect(editor).toHaveText(draft)
  await expect(picker).toHaveValue(target.teamObjectId)
  await picker.selectOption(teamB.teamObjectId)
  await expect(dialog).toBeVisible()
  await switchTeam(page, teamB, actors.requester, () => dialog.locator("[data-sf-confirm-discard]").click())
  await expect(dialog).toHaveCount(0)
  await expect(editor).toHaveCount(0)
  await switchTeam(page, target, actors.requester, () => picker.selectOption(target.teamObjectId))
  await page.locator("[data-sf-open-chat]:visible").click()
  await page.locator("[data-sf-new-chat]").click()
  await expect(editor).toBeEditable()
  await expect(editor).toHaveText("")
})

test("Real administration revokes a disposable Team and restores its original configuration", async ({ harness }) => {
  const { target, teamB, actors } = harness.plan
  const page = await harness.page(), holder = await harness.page("holder")
  const admin = await harness.page("dashboardAdmin"), sibling = await harness.page()
  await Promise.all([page.goto(href(target)), holder.goto(href(target)), admin.goto(href(target)), sibling.goto(href(teamB))])
  const before = await selected(page, target, actors.requester)
  await selected(holder, target, actors.holder)
  const siblingBefore = await selected(sibling, teamB, actors.requester)
  expect((await observe(admin, target, true)).profile.administration.status).toBe("available")
  const catalog = await adminCatalog(admin, target)
  expect(catalog.profiles.filter((entry) => entry.enabled).map((entry) => entry.profile.teamObjectId).sort())
    .toEqual([target.teamObjectId, teamB.teamObjectId].sort())
  expect(catalog.configRevision).toBe(before.stamp.team?.revisions.configRevision)
  const profiles = (value: typeof catalog) => value.profiles.map((entry) => JSON.stringify(entry)).sort()
  const disabled = { ...catalog, profiles: catalog.profiles.map((entry) => ({
    ...entry, enabled: entry.profile.teamObjectId === target.teamObjectId ? false : entry.enabled,
  })) }
  try {
    harness.revocation.attempted = true
    const changed = await configureTeam(admin, target, "disable", catalog.configRevision)
    expect(changed.configRevision).toBe(catalog.configRevision + 1)
    const revoked = await observe(page, target)
    expect(revoked.stamp.accessRevision).not.toBe(before.stamp.accessRevision)
    expect((await focusRefresh(page, target)).stamp.accessRevision).toBe(revoked.stamp.accessRevision)
    await expectRevoked(page, target, actors.requester)
    await focusRefresh(holder, target)
    await expectRevoked(holder, target, actors.holder)
    expect((await selected(sibling, teamB, actors.requester)).stamp.team?.owner).toEqual(siblingBefore.stamp.team?.owner)
  } finally {
    // Resolve an unknown disable outcome by original read. Never retry the mutation.
    const current = await adminCatalog(admin, target)
    if (JSON.stringify(profiles(current)) === JSON.stringify(profiles(catalog)) && current.configRevision === catalog.configRevision) {
      harness.revocation.restored = true
    } else {
      expect(current.configRevision).toBe(catalog.configRevision + 1)
      expect(profiles(current)).toEqual(profiles(disabled))
      await configureTeam(admin, target, "enable", current.configRevision)
      const restored = await adminCatalog(admin, target)
      expect(restored.configRevision).toBe(catalog.configRevision + 2)
      expect(profiles(restored)).toEqual(profiles(catalog))
      await page.goto(href(target))
      await selected(page, target, actors.requester)
      await holder.goto(href(target))
      await selected(holder, target, actors.holder)
      harness.revocation.restored = true
    }
  }
  expect(harness.revocation.restored).toBe(true)
})

test("Logout invalidates the original Microsoft browser context and preserves the other account", async ({ harness }) => {
  const { target, actors } = harness.plan
  const page = await harness.page(), stale = await harness.page(), holder = await harness.page("holder")
  await Promise.all([page.goto(href(target)), stale.goto(href(target)), holder.goto(href(target))])
  await selected(page, target, actors.requester)
  await selected(stale, target, actors.requester)
  const holderBefore = await selected(holder, target, actors.holder)
  const logout = new URL(target.mount + "/auth/logout", target.publicOrigin).href
  const reply = await uiReply(page, logout, "POST", () =>
    page.locator(shell).locator("header").getByRole("button", { name: /^(Sign out|Sair)$/ }).click())
  expect(reply.status()).toBe(204)
  await expect(page.locator(shell)).toHaveAttribute("data-sf-teams-state", "unauthenticated")
  expect((await contextReply(page, target)).status()).toBe(401)
  await stale.reload()
  await expect(stale.locator(shell)).toHaveAttribute("data-sf-teams-state", "unauthenticated")
  expect((await contextReply(stale, target, true)).status()).toBe(401)
  await holder.reload()
  expect(grants(await selected(holder, target, actors.holder))).toEqual(grants(holderBefore))
})
