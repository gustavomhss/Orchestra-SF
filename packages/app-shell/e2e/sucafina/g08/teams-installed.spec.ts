import { expect } from "@playwright/test"
import { randomUUID } from "node:crypto"
import type { Page, Request } from "@playwright/test"
import {
  adminCatalog, businessReply, chatAction, chatHref, configureTeam, configureTeamUI, contextReply, contextURL, expectUnauthenticated,
  focusRefresh, installedTest, observe, openAdministration, ownerQuery, recordGrantProof, removeSessionFixture,
  readTeamConfiguration, selected, sessionInventory, sessionRequest, sessionValue, switchTeam, teamConfiguration, teamRef, uiContext, uiReply,
} from "./installed-fixture.ts"
import type { Target } from "./installed-fixture.ts"
import { landing } from "./landing-contract.ts"
import { destinationGrants, requireDistinctDestinationGrants } from "../../../../../script/sf-ci/g08-private-evidence.mjs"

const test = installedTest
const href = (target: Target) => {
  const url = new URL(target.chapterHref, target.shellOrigin)
  // The plan admits the closed query by values; compare the canonical URL emitted by the native page.
  url.search = ownerQuery(target).toString()
  return url.href
}
test.describe.configure({ mode: "serial" })

// Retain the original stability oracle. Equal empty projections never prove different grants.
const grants = (live: Awaited<ReturnType<typeof observe>>) => live.destinations
  .map((entry) => JSON.stringify([entry.capabilityId, entry.canRead, [...entry.allowedActionIds].sort()])).sort()

async function withoutPosts(page: Page, action: () => Promise<void>) {
  const requests: Request[] = []
  const capture = (request: Request) => { if (request.method() === "POST") requests.push(request) }
  page.on("request", capture)
  try {
    await action()
    expect(requests).toHaveLength(0)
  } finally { page.off("request", capture) }
}

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

test("Two distinct Microsoft accounts enter the same installed Team with their own authority", async ({ harness }) => {
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
  expect(first.stamp.team?.owner).toEqual(requester.stamp.team?.owner)
  expect(second.stamp.team?.owner).toEqual(other.stamp.team?.owner)
  expect(destinationGrants(first)).toEqual(destinationGrants(requester))
  expect(destinationGrants(second)).toEqual(destinationGrants(other))
  requireDistinctDestinationGrants(first, second)
  const before = await sessionInventory(page, target, actors.requester)
  const holderBefore = await sessionInventory(holder, target, actors.holder)
  const positiveId = "ses_g08_" + harness.plan.invocation.id + "_" + randomUUID().replaceAll("-", "")
  const negativeId = "ses_g08_" + harness.plan.invocation.id + "_" + randomUUID().replaceAll("-", "")
  expect(before.entries.some((entry) => typeof entry === "object" && entry !== null && "id" in entry && entry.id === positiveId)).toBe(false)
  expect(holderBefore.entries.some((entry) => typeof entry === "object" && entry !== null && "id" in entry && entry.id === negativeId)).toBe(false)
  // The two lists are separately owner-bound. Never mistake cross-principal isolation for a missing action grant.
  let observations: unknown
  try {
    harness.grants.attempted = true
    const create = await sessionRequest(page, target, "", "POST", { id: positiveId })
    const created = await sessionValue(create, target, actors.requester, positiveId)
    const read = await sessionRequest(page, target, "/" + positiveId)
    const observed = await sessionValue(read, target, actors.requester, positiveId)
    expect(observed).toEqual(created)
    const afterCreate = await sessionInventory(page, target, actors.requester)
    expect(afterCreate.namespace).toEqual(before.namespace)
    const denied = await sessionRequest(holder, target, "", "POST", { id: negativeId })
    expect(denied.status()).toBe(401)
    expect(denied.headers()["cache-control"]).toBe("no-store")
    expect(denied.headers()["location"]).toBeUndefined()
    const holderAfterDenial = await sessionInventory(holder, target, actors.holder)
    expect(holderAfterDenial).toEqual(holderBefore)
    // A fresh admitted read and F02 after the refusal distinguish missing action authority from logout.
    await selected(holder, target, actors.holder)
    expect(await sessionValue(await sessionRequest(page, target, "/" + positiveId), target, actors.requester, positiveId))
      .toEqual(created)
    observations = {
      schema: "sf-g08-session-grants-v1", invocationId: harness.plan.invocation.id, profile: teamRef(target),
      fixtureIds: { requester: positiveId, holder: negativeId },
      requester: { namespace: before.namespace, before: before.entries, created, observed,
        afterCreate: afterCreate.entries, createStatus: create.status(), readStatus: read.status() },
      holder: { namespace: holderBefore.namespace, before: holderBefore.entries,
        afterDenial: holderAfterDenial.entries, deniedStatus: denied.status(), readStatus: 200 },
    }
  } finally {
    // No retry or broad removal. Only this invocation's random IDs may be removed, by their original owners.
    // Both cleanups run even if one fails; any unknown effect or remaining row prevents the receipt.
    const cleanup = await Promise.allSettled([
      removeSessionFixture(page, target, actors.requester, positiveId, before, harness.plan.invocation.id),
      removeSessionFixture(holder, target, actors.holder, negativeId, holderBefore, harness.plan.invocation.id),
    ])
    harness.grants.cleaned = cleanup.every((result) => result.status === "fulfilled")
    expect(harness.grants.cleaned).toBe(true)
    if (observations && typeof observations === "object" &&
      cleanup[0]?.status === "fulfilled" && cleanup[1]?.status === "fulfilled")
      observations = { ...observations, cleanup: { requester: cleanup[0].value, holder: cleanup[1].value } }
  }
  await recordGrantProof(harness.plan, observations)
  // Only original destination pages/permissions prove the difference, never identity, revision or availability.
  const holderReload = await uiContext(holder, target, () => holder.reload())
  const holderCurrent = await selected(holder, target, actors.holder)
  expect(holderReload.stamp.principalRef).toBe(actors.holder)
  expect(holderReload.stamp.team?.owner).toEqual(other.stamp.team?.owner)
  expect(holderCurrent.stamp.team?.owner).toEqual(other.stamp.team?.owner)
  expect(destinationGrants(holderReload)).toEqual(destinationGrants(other))
  expect(destinationGrants(holderCurrent)).toEqual(destinationGrants(other))
  const requesterReload = await uiContext(page, target, () => page.reload())
  const requesterCurrent = await selected(page, target, actors.requester)
  expect(requesterReload.stamp.principalRef).toBe(actors.requester)
  expect(requesterReload.stamp.team?.owner).toEqual(requester.stamp.team?.owner)
  expect(requesterCurrent.stamp.team?.owner).toEqual(requester.stamp.team?.owner)
  expect(destinationGrants(requesterReload)).toEqual(destinationGrants(requester))
  expect(destinationGrants(requesterCurrent)).toEqual(destinationGrants(requester))
  requireDistinctDestinationGrants(requesterReload, holderReload)
  await expect(page).toHaveURL(href(target))
  await expect(holder).toHaveURL(href(target))
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
  expect(grants(await selected(page, target, actors.requester))).toEqual(grants(before))
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

test("Native Microsoft administration remains usable without Team business access", async ({ harness }) => {
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
  const catalog = await openAdministration(admin, target)
  harness.administration.observed = true
  expect(catalog.profiles.some((entry) => entry.enabled && entry.profile.teamObjectId === target.teamObjectId)).toBe(true)
  expect(await adminCatalog(admin, target)).toEqual(catalog)
  await withoutPosts(admin, async () => {
    const open = admin.locator('[data-sf-admin-team="' + target.teamObjectId + '"] [data-sf-admin-configuration]')
    await expect(open).toBeEnabled()
    const displayed = await readTeamConfiguration(admin, target, () => open.click())
    const editor = admin.locator("[data-sf-team-configuration]")
    await expect(editor).toHaveAttribute("data-sf-team-configuration", "ready")
    expect(await readTeamConfiguration(admin, target)).toEqual(displayed)
    if (displayed.status === "not-found") expect(await adminCatalog(admin, target)).toEqual(catalog)
    const document = displayed.status === "ok" ? displayed.configuration.document : undefined
    await expect(editor.locator("[data-sf-configuration-model]")).toHaveValue(document?.settings.model ?? "")
    await expect(editor.locator("[data-sf-configuration-agent]")).toHaveValue(document?.settings.default_agent ?? "")
    await expect(editor.locator("[data-sf-configuration-read]")).toBeEnabled()
    await editor.locator("[data-sf-configuration-close]").click()
    await expect(editor).toHaveCount(0)
    await expect(admin.locator(landing.adminRead)).toBeEnabled()
  })
  await expect(admin.locator(landing.newChat)).toHaveCount(0)
  await expect(admin.locator(landing.workspace)).toHaveCount(0)
  await uiContext(admin, target, () => admin.goto(href(target)))
  await expectNoBusiness(admin, target, actors.dashboardAdmin)
  // The native panel remains usable even on the authenticated revoked projection, without business ownership.
  await openAdministration(admin, target)
  await expect(admin.locator(landing.dashboard)).toHaveCount(0)
})

test("Keyboard navigation opens a new Team chat draft on narrow Web without changing owner", async ({ harness }) => {
  const { target, actors } = harness.plan
  const page = await harness.page()
  await page.setViewportSize({ width: 320, height: 720 })
  await uiContext(page, target, () => page.goto(href(target)))
  const before = await selected(page, target, actors.requester)
  const sessions = await sessionInventory(page, target, actors.requester)
  const writes: Request[] = []
  const capture = (request: Request) => {
    if (new URL(request.url()).pathname.startsWith(target.mount + "/api/session") &&
      !["GET", "HEAD"].includes(request.method())) writes.push(request)
  }
  page.on("request", capture)
  try {
    await page.locator(landing.picker).focus()
    await page.keyboard.press("Tab")
    await expect(page.locator(landing.dashboard)).toBeFocused()
    await page.keyboard.press("Tab")
    await expect(page.locator(landing.newChat)).toBeFocused()
    const namespace = await chatAction(page, target, actors.requester, () => page.keyboard.press("Enter"))
    expect(namespace.owner).toEqual(before.stamp.team?.owner)
    const editor = page.locator(landing.editor)
    await editor.focus()
    await expect(editor).toBeFocused()
    const draft = "G08 private draft " + harness.plan.invocation.id
    await editor.fill(draft)
    await expect(editor).toHaveText(draft)
    await expect(editor).toBeInViewport()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321)
    expect((await selected(page, target, actors.requester)).stamp.team?.owner).toEqual(before.stamp.team?.owner)
    expect(await sessionInventory(page, target, actors.requester)).toEqual(sessions)
    expect(writes).toHaveLength(0)
    // Draft text is never submitted to a model; the new route and native composer are the actual product.
    await expect(page).toHaveURL(chatHref(target))
  } finally { page.off("request", capture) }
})

test("A Team switch keeps a canceled chat draft and discards it only on confirmation", async ({ harness }) => {
  const { target, teamB, actors } = harness.plan
  const page = await harness.page()
  await uiContext(page, target, () => page.goto(href(target)))
  const before = await selected(page, target, actors.requester)
  const beforeA = await sessionInventory(page, target, actors.requester)
  const beforeB = await sessionInventory(page, teamB, actors.requester)
  await chatAction(page, target, actors.requester, () => page.locator(landing.newChat).click())
  const draft = "G08 private A draft " + harness.plan.invocation.id
  await page.locator(landing.editor).fill(draft)
  const actions: Request[] = [], writes: Request[] = []
  const capture = (request: Request) => {
    const url = new URL(request.url())
    if (request.headers()["x-sf-g08-observation"]) return
    if (url.pathname === target.mount + "/api/ui/context" || url.pathname === target.mount + "/api/session") actions.push(request)
    if (url.pathname.startsWith(target.mount + "/api/session") && !["GET", "HEAD"].includes(request.method())) writes.push(request)
  }
  page.on("request", capture)
  try {
    await page.locator(landing.picker).selectOption(teamB.teamObjectId)
    await expect(page.locator(landing.discardDialog)).toBeVisible()
    await expect(page).toHaveURL(chatHref(target))
    await expect(page.locator(landing.picker)).toHaveValue(target.teamObjectId)
    await expect(page.locator(landing.editor)).toHaveText(draft)
    await page.locator(landing.keepEditing).click()
    await expect(page.locator(landing.discardDialog)).toHaveCount(0)
    await expect(page.locator(landing.editor)).toBeEditable()
    await expect(page.locator(landing.editor)).toHaveText(draft)
    expect(actions).toHaveLength(0)
    expect((await selected(page, target, actors.requester)).stamp.team?.owner).toEqual(before.stamp.team?.owner)
    await page.locator(landing.picker).selectOption(teamB.teamObjectId)
    await expect(page.locator(landing.discardDialog)).toBeVisible()
    expect(actions).toHaveLength(0)
    await chatAction(page, teamB, actors.requester, () => page.locator(landing.confirmDiscard).click())
    await expect(page.locator(landing.discardDialog)).toHaveCount(0)
    await expect(page.locator(landing.editor)).toHaveText("")
    await chatAction(page, target, actors.requester, () => page.locator(landing.picker).selectOption(target.teamObjectId))
    await expect(page.locator(landing.editor)).toHaveText("")
    expect((await selected(page, target, actors.requester)).stamp.team?.owner).toEqual(before.stamp.team?.owner)
    expect(await sessionInventory(page, target, actors.requester)).toEqual(beforeA)
    expect(await sessionInventory(page, teamB, actors.requester)).toEqual(beforeB)
    expect(writes).toHaveLength(0)
  } finally { page.off("request", capture) }
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
  const catalog = await openAdministration(admin, target)
  harness.administration.observed = true
  expect(catalog.profiles.filter((entry) => entry.enabled).map((entry) => entry.profile.teamObjectId).sort())
    .toEqual([target.teamObjectId, teamB.teamObjectId].sort())
  expect(catalog.configRevision).toBe(before.stamp.team?.revisions.configRevision)
  const documents = await Promise.all([teamConfiguration(admin, target), teamConfiguration(admin, teamB)])
  for (const document of documents) expect(document.configRevision).toBe(catalog.configRevision)
  const profiles = (value: typeof catalog) => value.profiles.map((entry) => JSON.stringify(entry)).sort()
  const disabled = { ...catalog, profiles: catalog.profiles.map((entry) => ({
    ...entry, enabled: entry.profile.teamObjectId === target.teamObjectId ? false : entry.enabled,
  })) }
  try {
    harness.revocation.attempted = true
    const changed = await configureTeamUI(admin, target, "disable", catalog.configRevision)
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
    const unchanged = JSON.stringify(profiles(current)) === JSON.stringify(profiles(catalog)) &&
      current.configRevision === catalog.configRevision
    // Enable only after the original reread proves the expected disabled state.
    if (!unchanged) {
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
    }
    const restored = await adminCatalog(admin, target)
    expect(profiles(restored)).toEqual(profiles(catalog))
    const preserved = await Promise.all([teamConfiguration(admin, target), teamConfiguration(admin, teamB)])
    for (const [index, document] of documents.entries()) {
      expect(preserved[index]?.configRevision).toBe(restored.configRevision)
      expect(preserved[index]?.document).toEqual(document.document)
    }
    // Shared documents survive; restoring access must not rewind the global CAS revision.
    harness.revocation.restored = true
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
  const holderAfter = await selected(holder, target, actors.holder)
  expect(holderAfter.stamp.team?.owner).toEqual(holderBefore.stamp.team?.owner)
  expect(grants(holderAfter)).toEqual(grants(holderBefore))
})
