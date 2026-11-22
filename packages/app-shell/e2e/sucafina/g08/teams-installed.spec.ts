import { expect } from "@playwright/test"
import type { Page, Request } from "@playwright/test"
import {
  adminCatalog, businessReply, configureTeam, contextReply, contextURL, expectUnauthenticated,
  focusRefresh, installedTest, observe, selected, switchTeam, uiContext, uiReply,
} from "./installed-fixture.ts"
import type { Target } from "./installed-fixture.ts"
import { landing } from "./landing-contract.ts"

const test = installedTest
const href = (target: Target) => new URL(target.chapterHref, target.shellOrigin).href
test.describe.configure({ mode: "serial" })

async function expectNoBusiness(page: Page, target: Target, principal: string) {
  const live = await observe(page, target)
  expect(live.stamp.principalRef).toBe(principal)
  expect(live.profile.principal.principalObjectId).toBe(principal)
  expect(live.profile.teams.status).toBe("revoked")
  expect(live.stamp.team).toBeUndefined()
  expect(live.destinations).toEqual([])
  expect(live.availability).toEqual([])
  await expect(page.locator(landing.shell)).not.toHaveAttribute("data-sf-team-selected", /.+/)
  await expect(page.locator(landing.dashboard)).toHaveCount(0)
  await expect(page.locator(landing.picker)).toHaveCount(0)
  // The current HTTP reader renders explicit revoked as unavailable; a future denied/authenticated
  // projection is also safe only with the same original revoked F02 and no business owner/control.
  await expect(page.locator(landing.shell)).toHaveAttribute("data-sf-teams-state", /^(authenticated|unavailable|denied)$/)
  const denied = await businessReply(page, target)
  expect(denied.status()).toBe(403)
  expect(await denied.text()).toBe("")
  return live
}

test("Two original Microsoft principals select the same Team without claiming different grants", async ({ harness }) => {
  const { target, actors } = harness.plan
  const page = await harness.page(), holder = await harness.page("holder")
  expect(page.context()).not.toBe(holder.context())
  const [first, second] = await Promise.all([
    uiContext(page, target, () => page.goto(href(target))),
    uiContext(holder, target, () => holder.goto(href(target))),
  ])
  expect(first.stamp.principalRef).toBe(actors.requester)
  expect(second.stamp.principalRef).toBe(actors.holder)
  const requester = await selected(page, target, actors.requester), other = await selected(holder, target, actors.holder)
  expect(requester.stamp.team?.owner.profile).toEqual(other.stamp.team?.owner.profile)
  expect(requester.stamp.team?.owner.principal).not.toEqual(other.stamp.team?.owner.principal)
  // Do not claim different business grants from distinct identities or empty destinations.
  await uiContext(holder, target, () => holder.reload())
  await selected(holder, target, actors.holder)
  await uiContext(page, target, () => page.reload())
  await selected(page, target, actors.requester)
})

test("An explicit A B A Team switch leaves the sibling window on its own Team", async ({ harness }) => {
  const { target, teamB, actors } = harness.plan
  const page = await harness.page(), sibling = await harness.page()
  expect(page.context()).toBe(sibling.context())
  await Promise.all([
    uiContext(page, target, () => page.goto(href(target))),
    uiContext(sibling, target, () => sibling.goto(href(target))),
  ])
  const before = await selected(page, target, actors.requester), siblingBefore = await selected(sibling, target, actors.requester)
  const picker = page.locator(landing.picker)
  await switchTeam(page, teamB, actors.requester, () => picker.selectOption(teamB.teamObjectId))
  await expect(page).toHaveURL(href(teamB))
  await expect(sibling).toHaveURL(href(target))
  expect((await selected(sibling, target, actors.requester)).stamp.team?.owner).toEqual(siblingBefore.stamp.team?.owner)
  expect((await switchTeam(page, target, actors.requester, () => picker.selectOption(target.teamObjectId))).stamp.team?.owner)
    .toEqual(before.stamp.team?.owner)
  await expect(page).toHaveURL(href(target))
  await uiContext(sibling, target, () => sibling.reload())
  await expect(sibling).toHaveURL(href(target))
  expect((await selected(sibling, target, actors.requester)).stamp.team?.owner).toEqual(siblingBefore.stamp.team?.owner)
})

test("An authenticated account without Team access cannot open the original business chapter", async ({ harness }) => {
  const { target, actors } = harness.plan
  const denied = await harness.page("denied")
  const initial = await uiContext(denied, target, () => denied.goto(target.shellOrigin + "/"), true)
  expect(initial.stamp.principalRef).toBe(actors.denied)
  expect(initial.profile.teams.status).toBe("no-teams")
  expect(initial.profile.administration.status).toBe("denied")
  expect(initial.stamp.team).toBeUndefined()
  await uiContext(denied, target, () => denied.goto(href(target)))
  await expectNoBusiness(denied, target, actors.denied)
})

test("A foreign installation deep link and reload cannot inherit the current Team selection", async ({ harness }) => {
  const { target, foreignInstallation, actors } = harness.plan
  const page = await harness.page()
  await uiContext(page, target, () => page.goto(href(target)))
  await selected(page, target, actors.requester)
  await uiContext(page, target, () => page.reload())
  await selected(page, target, actors.requester)
  const attempts: Request[] = []
  const capture = (request: Request) => {
    const url = new URL(request.url())
    if (request.frame() === page.mainFrame() && url.pathname === target.mount + "/api/ui/context") attempts.push(request)
  }
  page.on("request", capture)
  try {
    await page.goto(href(foreignInstallation))
    await expect(page.locator(landing.shell)).toHaveAttribute("data-sf-teams-state", "invalid")
    await expect(page.locator("main").getByRole("alert")).toBeVisible()
    await expect(page).toHaveURL(href(foreignInstallation))
    await expect(page.locator(landing.shell)).not.toHaveAttribute("data-sf-team-selected", /.+/)
    await expect(page.locator(landing.dashboard)).toHaveCount(0)
    await page.reload()
    await expect(page.locator(landing.shell)).toHaveAttribute("data-sf-teams-state", "invalid")
    await expect(page).toHaveURL(href(foreignInstallation))
    await expect(page.locator(landing.dashboard)).toHaveCount(0)
    expect(attempts).toHaveLength(0)
  } finally { page.off("request", capture) }
  await uiContext(page, target, () => page.goto(href(target)))
  await selected(page, target, actors.requester)
})

test("Original Microsoft administration works without granting Team business access", async ({ harness }) => {
  const { target, actors } = harness.plan
  const admin = await harness.page("dashboardAdmin")
  const selection = await uiContext(admin, target, () => admin.goto(target.shellOrigin + "/"), true)
  expect(selection.stamp.principalRef).toBe(actors.dashboardAdmin)
  expect(selection.profile.teams.status).toBe("no-teams")
  const live = await observe(admin, target, "administration")
  expect(live.stamp.principalRef).toBe(actors.dashboardAdmin)
  expect(live.profile.administration.status).toBe("available")
  expect(live.profile.teams.status).toBe("no-teams")
  expect(live.stamp.team).toBeUndefined()
  expect(live.destinations).toEqual([])
  expect(live.availability).toEqual([])
  const catalog = await adminCatalog(admin, target)
  expect(catalog.profiles.some((entry) => entry.enabled && entry.profile.teamObjectId === target.teamObjectId)).toBe(true)
  await uiContext(admin, target, () => admin.goto(href(target)))
  await expectNoBusiness(admin, target, actors.dashboardAdmin)
  // Positive original HTTP administration is useful, but does not replace the original native administration UI.
})

test("Real administration revokes a disposable Team and restores its original configuration", async ({ harness }) => {
  const { target, teamB, actors } = harness.plan
  const page = await harness.page(), holder = await harness.page("holder")
  const admin = await harness.page("dashboardAdmin"), sibling = await harness.page()
  await Promise.all([
    uiContext(page, target, () => page.goto(href(target))),
    uiContext(holder, target, () => holder.goto(href(target))),
    uiContext(admin, target, () => admin.goto(target.shellOrigin + "/"), true),
    uiContext(sibling, teamB, () => sibling.goto(href(teamB))),
  ])
  const before = await selected(page, target, actors.requester)
  await selected(holder, target, actors.holder)
  const siblingBefore = await selected(sibling, teamB, actors.requester)
  expect((await observe(admin, target, "administration")).profile.administration.status).toBe("available")
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
    expect(changed.configRevision).not.toBe(catalog.configRevision)
    const current = await adminCatalog(admin, target)
    expect(current.configRevision).toBe(changed.configRevision)
    expect(profiles(current)).toEqual(profiles(disabled))
    const revoked = await observe(page, target)
    expect(revoked.stamp.accessRevision).not.toBe(before.stamp.accessRevision)
    expect((await focusRefresh(page, target)).stamp.accessRevision).toBe(revoked.stamp.accessRevision)
    await expectNoBusiness(page, target, actors.requester)
    await focusRefresh(holder, target)
    await expectNoBusiness(holder, target, actors.holder)
    expect((await selected(sibling, teamB, actors.requester)).stamp.team?.owner).toEqual(siblingBefore.stamp.team?.owner)
  } finally {
    // Reconcile a lost response by one original catalog read. Never retry disable or guess/coerce a CAS token.
    const current = await adminCatalog(admin, target)
    if (JSON.stringify(profiles(current)) === JSON.stringify(profiles(catalog)) && current.configRevision === catalog.configRevision) {
      harness.revocation.restored = true
    } else {
      expect(current.configRevision).not.toBe(catalog.configRevision)
      expect(profiles(current)).toEqual(profiles(disabled))
      const enabled = await configureTeam(admin, target, "enable", current.configRevision)
      const restored = await adminCatalog(admin, target)
      expect(restored.configRevision).toBe(enabled.configRevision)
      expect(restored.configRevision).not.toBe(current.configRevision)
      expect(restored.configRevision).not.toBe(catalog.configRevision)
      expect(profiles(restored)).toEqual(profiles(catalog))
      await uiContext(page, target, () => page.goto(href(target)))
      await selected(page, target, actors.requester)
      await uiContext(holder, target, () => holder.goto(href(target)))
      await selected(holder, target, actors.holder)
      harness.revocation.restored = true
    }
  }
  expect(harness.revocation.restored).toBe(true)
})

test("Logout invalidates the original Microsoft browser context and preserves the other account", async ({ harness }) => {
  const { target, actors } = harness.plan
  const page = await harness.page(), stale = await harness.page(), holder = await harness.page("holder")
  await Promise.all([
    uiContext(page, target, () => page.goto(href(target))),
    uiContext(stale, target, () => stale.goto(href(target))),
    uiContext(holder, target, () => holder.goto(href(target))),
  ])
  await selected(page, target, actors.requester)
  await selected(stale, target, actors.requester)
  const holderBefore = await selected(holder, target, actors.holder)
  const logout = new URL(target.mount + "/auth/logout", target.publicOrigin).href
  const reply = await uiReply(page, logout, "POST", () => page.locator(landing.logout).click())
  expect(reply.status()).toBe(204)
  expect(reply.request().postData()).toBeNull()
  await expect(page.locator(landing.shell)).toHaveAttribute("data-sf-teams-state", "unauthenticated")
  await expectUnauthenticated(await contextReply(page, target))
  const reloaded = await uiReply(stale, contextURL(target), "GET", () => stale.reload())
  await expectUnauthenticated(reloaded)
  await expect(stale.locator(landing.shell)).toHaveAttribute("data-sf-teams-state", "unauthenticated")
  await expectUnauthenticated(await contextReply(stale, target, true))
  await uiContext(holder, target, () => holder.reload())
  expect((await selected(holder, target, actors.holder)).stamp.team?.owner).toEqual(holderBefore.stamp.team?.owner)
})
