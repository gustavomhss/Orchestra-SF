// Original installed Microsoft sessions only. No launch, storageState, cookie copying or mocked producer.
import { chromium, expect, test } from "@playwright/test"
import type { BrowserContext, Page } from "@playwright/test"
import { Schema } from "effect"
import { SfInstallationList, SfTeamContextResult } from "@orchestra/schema/sucafina/context"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { cases, digest, privateText, readPlan, validateHost, validatePackage, writePrivate } from "../../../../../script/sf-ci/g08-private-evidence.mjs"

export type Plan = Awaited<ReturnType<typeof readPlan>>
export type Target = Plan["target"]
export type Actor = keyof Plan["actors"]
const strict = { onExcessProperty: "error" } as const
const requestOptions = { maxRedirects: 0, maxRetries: 0, timeout: 30_000 }
const actors = ["requester", "holder", "denied", "dashboardAdmin"] as const

export function teamRef(target: Target) {
  return Schema.decodeUnknownSync(TeamProfile.Ref, strict)({
    installationId: target.installationId, tenantId: target.tenantId, teamObjectId: target.teamObjectId,
  })
}
export function ownerQuery(target: Target) {
  return new URLSearchParams({ contractRevision: "sf-team-profile/1", server: target.serverKey,
    installationId: target.installationId, tenantId: target.tenantId, teamObjectId: target.teamObjectId })
}
export function contextURL(target: Target, selection = false) {
  const url = new URL(target.mount + "/api/ui/context", target.publicOrigin)
  url.search = new URLSearchParams({ contractRevision: "sf-team-profile/1", installationId: target.installationId,
    tenantId: target.tenantId, hostId: target.hostId, kind: selection ? "selection" : "team",
    ...(selection ? {} : { teamObjectId: target.teamObjectId }) }).toString()
  return url.href
}
export async function contextReply(page: Page, target: Target, selection = false) {
  return page.request.get(contextURL(target, selection), requestOptions)
}
export async function observe(page: Page, target: Target, selection = false) {
  if (new URL(page.url()).origin !== target.shellOrigin) throw new Error("G08_ACTOR_OUTSIDE_INSTALLED_SHELL")
  const discovery = new URL("/api/sucafina/installations", target.discoveryOrigin)
  discovery.search = new URLSearchParams({ select: "current", contractRevision: "sf-team-profile/1" }).toString()
  const response = await page.request.get(discovery.href, requestOptions)
  if (response.status() !== 200) throw new Error("G08_ORIGINAL_DISCOVERY_UNAVAILABLE")
  const value = Schema.decodeUnknownSync(Schema.toCodecJson(SfInstallationList), strict)(await response.json())
  if (value.installations.length !== 1) throw new Error("G08_DISCOVERY_OWNER_NOT_UNIQUE")
  const descriptor = value.installations[0]!
  if (descriptor.contractRevision !== "sf-team-profile/1" || descriptor.authMode !== "microsoft" ||
    descriptor.installationId !== target.installationId ||
    descriptor.tenantId !== target.tenantId || descriptor.projectId !== target.projectId ||
    descriptor.hostId !== target.hostId || descriptor.publicOrigin !== target.publicOrigin || descriptor.mount !== target.mount)
    throw new Error("G08_DISCOVERY_OWNER_MISMATCH")
  const reply = await contextReply(page, target, selection)
  if (reply.status() !== 200) throw new Error("G08_ORIGINAL_CONTEXT_UNAVAILABLE")
  const result = Schema.decodeUnknownSync(Schema.toCodecJson(SfTeamContextResult), strict)(await reply.json())
  if (result.status !== "ok") throw new Error("G08_ORIGINAL_MICROSOFT_CONTEXT_REQUIRED")
  const live = result.value
  if (live.authMode !== "microsoft" || live.stamp.installationId !== target.installationId ||
    live.stamp.projectId !== target.projectId || live.stamp.hostId !== target.hostId ||
    live.profile.principal.tenantId !== target.tenantId ||
    !selection && live.profile.teams.status === "ready" &&
      live.profile.teams.selected.teamObjectId !== target.teamObjectId ||
    !selection && live.stamp.team && JSON.stringify(live.stamp.team.owner.profile) !== JSON.stringify(teamRef(target)) ||
    new Set(live.destinations.map((entry) => entry.capabilityId)).size !== live.destinations.length)
    throw new Error("G08_LIVE_OWNER_MISMATCH")
  return live
}
export async function selected(page: Page, target: Target, principal: string) {
  await expect(page.locator("[data-sf-teams-shell]")).toHaveAttribute("data-sf-teams-state", "authenticated")
  await expect(page.locator("[data-sf-teams-shell]")).toHaveAttribute("data-sf-team-selected", target.teamObjectId)
  const live = await observe(page, target)
  expect(live.stamp.principalRef).toBe(principal)
  expect(live.profile.teams.status).toBe("ready")
  expect(live.stamp.team?.owner.profile).toEqual(teamRef(target))
  expect(live.destinations.some((entry) => entry.canRead)).toBe(true)
  return live
}
export async function focusRefresh(page: Page, target: Target) {
  const expected = new URL(contextURL(target))
  const documentStart = await page.evaluate(() => performance.timeOrigin)
  const [reply] = await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url())
      return response.request().method() === "GET" && url.origin === expected.origin &&
        url.pathname === expected.pathname && url.searchParams.size === expected.searchParams.size &&
        [...expected.searchParams].every(([key, value]) => url.searchParams.getAll(key).length === 1 && url.searchParams.get(key) === value)
    }),
    page.evaluate(() => window.dispatchEvent(new FocusEvent("focus"))),
  ])
  expect(reply.status()).toBe(200)
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStart)
  const result = Schema.decodeUnknownSync(Schema.toCodecJson(SfTeamContextResult), strict)(await reply.json())
  if (result.status !== "ok") throw new Error("G08_FOCUS_CONTEXT_NOT_AUTHENTICATED")
  return result.value
}

// Original HTTP contract from 08fa1796. Missing route blocks this case; nothing here registers a handler.
const AdminCatalog = Schema.Struct({
  status: Schema.Literal("ok"), configRevision: Schema.Number,
  profiles: Schema.Array(Schema.Struct({ profile: TeamProfile.Ref, enabled: Schema.Boolean })),
})
const AdminResult = Schema.Struct({ status: Schema.Literal("ok"), configRevision: Schema.Number, changed: Schema.Boolean })
function adminURL(target: Target) {
  const url = new URL(target.mount + "/api/ui/team-profiles", target.publicOrigin)
  url.search = new URLSearchParams({ contractRevision: "sf-team-profile/1", installationId: target.installationId,
    tenantId: target.tenantId }).toString()
  return url.href
}
export async function adminCatalog(page: Page, target: Target) {
  const response = await page.request.get(adminURL(target), requestOptions)
  if (response.status() !== 200) throw new Error("G08_REAL_ADMIN_ROUTE_NOT_AVAILABLE")
  const catalog = Schema.decodeUnknownSync(AdminCatalog, strict)(await response.json())
  if (!Number.isSafeInteger(catalog.configRevision) || catalog.configRevision < 0 ||
    new Set(catalog.profiles.map((entry) => JSON.stringify(entry.profile))).size !== catalog.profiles.length ||
    catalog.profiles.some((entry) => entry.profile.installationId !== target.installationId ||
      entry.profile.tenantId !== target.tenantId))
    throw new Error("G08_REAL_ADMIN_CATALOG_INVALID")
  return catalog
}
export async function configureTeam(page: Page, target: Target, action: "enable" | "disable", expectedRevision: number) {
  const response = await page.request.post(adminURL(target), {
    ...requestOptions, headers: { origin: target.publicOrigin }, data: { action, profile: teamRef(target), expectedRevision },
  })
  if (response.status() !== 200) throw new Error("G08_ADMIN_MUTATION_OUTCOME_REQUIRES_ORIGINAL_READ")
  const result = Schema.decodeUnknownSync(AdminResult, strict)(await response.json())
  if (!result.changed || result.configRevision !== expectedRevision + 1)
    throw new Error("G08_ADMIN_MUTATION_OUTCOME_REQUIRES_ORIGINAL_READ")
  return result
}

async function attach(plan: Plan) {
  const endpoint = (await privateText(plan.scratchRoot, "browser-endpoint.txt", 4096)).trim()
  const url = new URL(endpoint)
  if (!["ws:", "http:"].includes(url.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    !url.port || url.username || url.password || url.hash) throw new Error("G08_PRIVATE_LOOPBACK_CDP_REQUIRED")
  const browser = await chromium.connectOverCDP(endpoint, { timeout: 30_000 })
  try {
    if (browser.contexts().length !== 4) throw new Error("G08_EXACT_FOUR_ORIGINAL_CONTEXTS_REQUIRED")
    const found: Partial<Record<Actor, BrowserContext>> = {}
    for (const context of browser.contexts()) {
      const pages = context.pages().filter((page) => {
        try { return new URL(page.url()).origin === plan.target.shellOrigin } catch { return false }
      })
      if (pages.length === 0) throw new Error("G08_ORIGINAL_SHELL_TAB_REQUIRED")
      const live = await observe(pages[0]!, plan.target, true)
      const actor = actors.find((entry) => plan.actors[entry] === live.stamp.principalRef)
      if (!actor || found[actor]) throw new Error("G08_ORIGINAL_PRINCIPAL_AMBIGUOUS")
      found[actor] = context
    }
    if (actors.some((actor) => !found[actor])) throw new Error("G08_FOUR_REAL_ACTORS_REQUIRED")
    return { browser, contexts: found }
  } catch (error) { await browser.close(); throw error }
}
type Harness = {
  plan: Plan
  page(actor?: Actor): Promise<Page>
  revocation: { attempted: boolean; restored: boolean }
}
export const installedTest = test.extend<{ harness: Harness }>({
  harness: async ({}, use, info) => {
    const root = process.env.SF_G08_PRIVATE_ROOT
    if (!root) throw new Error("G08_PRIVATE_PLAN_REQUIRED")
    const plan = await readPlan(root)
    const packageRaw = await privateText(root, "package-receipt.json")
    if (digest(packageRaw) !== plan.packageReceiptSha256) throw new Error("G08_PACKAGE_BYTES_CHANGED")
    const receipt = validatePackage(JSON.parse(packageRaw), plan)
    validateHost(JSON.parse(await privateText(root, "host-before.json")), plan, receipt)
    const entry = cases.find((item) => item.title === info.title)
    if (!entry) throw new Error("G08_UNREGISTERED_CASE")
    const session = await attach(plan)
    const pages: Page[] = []
    const revocation = { attempted: false, restored: false }
    try {
      await use({
        plan, revocation,
        page: async (actor = "requester") => {
          const context = session.contexts[actor]
          if (!context) throw new Error("G08_ACTOR_CONTEXT_MISSING")
          const original = context.pages().find((page) => {
            try { return new URL(page.url()).origin === plan.target.shellOrigin } catch { return false }
          })
          if (!original) throw new Error("G08_ORIGINAL_SHELL_DISAPPEARED")
          const live = await observe(original, plan.target, true)
          if (live.stamp.principalRef !== plan.actors[actor]) throw new Error("G08_PRINCIPAL_CHANGED")
          const page = await context.newPage()
          pages.push(page)
          return page
        },
      })
    } finally {
      const closed = await Promise.allSettled(pages.map((page) => page.close()))
      const contextCount = session.browser.contexts().length
      await session.browser.close()
      await writePrivate(root, "cleanup-" + entry.id + ".json", {
        schema: "sf-g08-cleanup-v1", caseId: entry.id, invocationId: plan.invocation.id,
        originalContexts: 4, createdContexts: contextCount - 4, openedPages: pages.length,
        closedPages: pages.filter((page) => page.isClosed()).length, disconnected: true,
        revocationAttempted: revocation.attempted, revocationRestored: revocation.restored,
      })
      if (closed.some((result) => result.status === "rejected") || contextCount !== 4)
        throw new Error("G08_PRIVATE_BROWSER_CLEANUP_INCOMPLETE")
    }
  },
})
