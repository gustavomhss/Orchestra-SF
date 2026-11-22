// Original installed Microsoft sessions only. No launch, storageState, cookie copying or mocked producer.
import { chromium, expect, test } from "@playwright/test"
import type { BrowserContext, Page, Response } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { Schema } from "effect"
import { SfInstallationList, SfTeamContextResult } from "@orchestra/schema/sucafina/context"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { canonicalAddress, cases, digest, privateText, readPlan, record, validateHost, validatePackage, writePrivate } from "../../../../../script/sf-ci/g08-private-evidence.mjs"

export type Plan = Awaited<ReturnType<typeof readPlan>>
export type Target = Plan["target"]
export type Actor = keyof Plan["actors"]
const strict = { onExcessProperty: "error" } as const
const observationHeader = "x-sf-g08-observation"
// Network provenance only. These values neither supply nor alter actor authority.
const contextBindings = new WeakMap<BrowserContext, { origin: string; addresses: readonly string[] }>()

export async function requireBoundPeer(page: Page, response: Response) {
  const binding = contextBindings.get(page.context())
  if (!binding || new URL(response.url()).origin !== binding.origin || response.fromServiceWorker() ||
    response.frame().page() !== page) throw new Error("G08_ORIGINAL_BROWSER_RESPONSE_REQUIRED")
  const peer = await response.serverAddr()
  if (!peer || peer.port !== 443 || !binding.addresses.includes(canonicalAddress(peer.ipAddress)))
    throw new Error("G08_BROWSER_INGRESS_NOT_RESERVED_VM")
}

async function originalRequest(page: Page, url: string, method: "GET" | "POST" = "GET", body?: unknown) {
  const binding = contextBindings.get(page.context())
  if (!binding || new URL(page.url()).origin !== binding.origin || new URL(url).origin !== binding.origin)
    throw new Error("G08_ORIGINAL_BROWSER_ORIGIN_REQUIRED")
  // The nonce identifies this observation only; the browser supplies its own original cookie jar.
  const nonce = randomUUID()
  const [response] = await Promise.all([
    page.waitForResponse((reply) => reply.url() === url && reply.request().method() === method &&
      reply.request().headers()[observationHeader] === nonce),
    page.evaluate(async ({ requestURL, requestMethod, requestBody, requestNonce, header }) => {
      await fetch(requestURL, {
        method: requestMethod, credentials: "same-origin", redirect: "manual", cache: "no-store",
        signal: AbortSignal.timeout(30_000),
        headers: { [header]: requestNonce, ...(requestMethod === "POST" ? { "content-type": "application/json" } : {}) },
        ...(requestMethod === "POST" ? { body: JSON.stringify(requestBody) } : {}),
      })
    }, { requestURL: url, requestMethod: method, requestBody: body, requestNonce: nonce, header: observationHeader }),
  ])
  // Read the original network Response after peer validation, never a body supplied by page JavaScript.
  if (method === "POST" && response.request().postData() !== JSON.stringify(body))
    throw new Error("G08_ORIGINAL_ADMIN_COMMAND_CHANGED")
  await requireBoundPeer(page, response)
  return response
}

export async function uiReply(page: Page, url: string, method: "GET" | "POST", action: () => Promise<unknown>) {
  const expected = new URL(url)
  const [request] = await Promise.all([
    page.waitForRequest((entry) => {
      const actual = new URL(entry.url())
      return entry.method() === method && entry.frame() === page.mainFrame() &&
        entry.headers()[observationHeader] === undefined &&
        actual.origin === expected.origin && actual.pathname === expected.pathname &&
        actual.searchParams.size === expected.searchParams.size &&
        [...expected.searchParams].every(([key, value]) =>
          actual.searchParams.getAll(key).length === 1 && actual.searchParams.get(key) === value)
    }),
    action(),
  ])
  const response = await request.response()
  if (!response) throw new Error("G08_ORIGINAL_UI_RESPONSE_REQUIRED")
  await requireBoundPeer(page, response)
  return response
}
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
  return originalRequest(page, contextURL(target, selection))
}
export async function observe(page: Page, target: Target, selection = false) {
  if (new URL(page.url()).origin !== target.shellOrigin) throw new Error("G08_ACTOR_OUTSIDE_INSTALLED_SHELL")
  const discovery = new URL("/api/sucafina/installations", target.discoveryOrigin)
  discovery.search = new URLSearchParams({ select: "current", contractRevision: "sf-team-profile/1" }).toString()
  const response = await originalRequest(page, discovery.href)
  if (response.status() !== 200) throw new Error("G08_ORIGINAL_DISCOVERY_UNAVAILABLE")
  const value = Schema.decodeUnknownSync(Schema.toCodecJson(SfInstallationList), strict)(await response.json())
  if (value.installations.length !== 1) throw new Error("G08_DISCOVERY_OWNER_NOT_UNIQUE")
  const descriptor = value.installations[0]!
  if (descriptor.contractRevision !== "sf-team-profile/1" || descriptor.authMode !== "microsoft" ||
    descriptor.installationId !== target.installationId ||
    descriptor.tenantId !== target.tenantId || descriptor.projectId !== target.projectId ||
    descriptor.hostId !== target.hostId || descriptor.publicOrigin !== target.publicOrigin || descriptor.mount !== target.mount)
    throw new Error("G08_DISCOVERY_OWNER_MISMATCH")
  return contextValue(await contextReply(page, target, selection), target, selection)
}
async function contextValue(reply: Response, target: Target, selection = false) {
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
export async function uiContext(page: Page, target: Target, action: () => Promise<unknown>) {
  return contextValue(await uiReply(page, contextURL(target), "GET", action), target)
}
export async function switchTeam(page: Page, target: Target, principal: string, action: () => Promise<unknown>) {
  const changed = await uiContext(page, target, action)
  expect(changed.stamp.principalRef).toBe(principal)
  expect(changed.profile.teams.status).toBe("ready")
  expect(changed.stamp.team?.owner.profile).toEqual(teamRef(target))
  expect(changed.destinations.some((entry) => entry.canRead)).toBe(true)
  // The action's original F02 response and the independent re-read must both have the selected owner.
  return selected(page, target, principal)
}
export async function focusRefresh(page: Page, target: Target) {
  const documentStart = await page.evaluate(() => performance.timeOrigin)
  const live = await uiContext(page, target, () => page.evaluate(() => window.dispatchEvent(new FocusEvent("focus"))))
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStart)
  return live
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
  const response = await originalRequest(page, adminURL(target))
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
  const response = await originalRequest(page, adminURL(target), "POST", {
    action, profile: teamRef(target), expectedRevision,
  })
  if (response.status() !== 200) throw new Error("G08_ADMIN_MUTATION_OUTCOME_REQUIRES_ORIGINAL_READ")
  const result = Schema.decodeUnknownSync(AdminResult, strict)(await response.json())
  if (!result.changed || result.configRevision !== expectedRevision + 1)
    throw new Error("G08_ADMIN_MUTATION_OUTCOME_REQUIRES_ORIGINAL_READ")
  return result
}

async function attach(plan: Plan, addresses: readonly string[]) {
  const endpoint = (await privateText(plan.scratchRoot, "browser-endpoint.txt", 4096)).trim()
  const url = new URL(endpoint)
  if (!["ws:", "http:"].includes(url.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    !url.port || url.username || url.password || url.hash) throw new Error("G08_PRIVATE_LOOPBACK_CDP_REQUIRED")
  const browser = await chromium.connectOverCDP(endpoint, { timeout: 30_000 })
  try {
    if (browser.contexts().length !== 4) throw new Error("G08_EXACT_FOUR_ORIGINAL_CONTEXTS_REQUIRED")
    const found: Partial<Record<Actor, BrowserContext>> = {}
    for (const context of browser.contexts()) {
      contextBindings.set(context, { origin: plan.target.publicOrigin, addresses })
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
  } catch (error) {
    for (const context of browser.contexts()) contextBindings.delete(context)
    await browser.close()
    throw error
  }
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
    const host = validateHost(JSON.parse(await privateText(root, "host-before.json")), plan, receipt)
    const ingressAddresses = Schema.decodeUnknownSync(Schema.Array(Schema.String))(record(host.binding).ingressAddresses).map(canonicalAddress)
    const entry = cases.find((item) => item.title === info.title)
    if (!entry) throw new Error("G08_UNREGISTERED_CASE")
    const session = await attach(plan, ingressAddresses)
    const pages: Page[] = []
    const boundDocuments = new Set<Page>()
    const ingressErrors: string[] = []
    const responseChecks: Promise<void>[] = []
    const delivery = { resources: 0, cacheBypassPages: 0 }
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
          const protocol = await context.newCDPSession(page)
          await protocol.send("Network.enable")
          await protocol.send("Network.setCacheDisabled", { cacheDisabled: true })
          await protocol.send("Network.setBypassServiceWorker", { bypass: true })
          delivery.cacheBypassPages++
          page.on("response", (response) => {
            const resource = response.request().resourceType()
            if (!["document", "script", "stylesheet"].includes(resource)) return
            const check = (async () => {
              await requireBoundPeer(page, response)
              delivery.resources++
              if (resource === "document" && response.frame() === page.mainFrame()) boundDocuments.add(page)
            })().catch(() => { ingressErrors.push("G08_BROWSER_INGRESS_NOT_PROVEN") })
            responseChecks.push(check)
          })
          return page
        },
      })
    } finally {
      await Promise.all(responseChecks)
      const closed = await Promise.allSettled(pages.map((page) => page.close()))
      await Promise.all(responseChecks)
      const contextCount = session.browser.contexts().length
      for (const context of session.browser.contexts()) contextBindings.delete(context)
      await session.browser.close()
      await writePrivate(root, "cleanup-" + entry.id + ".json", {
        schema: "sf-g08-cleanup-v1", caseId: entry.id, invocationId: plan.invocation.id,
        originalContexts: 4, createdContexts: contextCount - 4, openedPages: pages.length,
        closedPages: pages.filter((page) => page.isClosed()).length, disconnected: true,
        boundDocuments: boundDocuments.size, ingressResources: delivery.resources, ingressErrors: ingressErrors.length,
        cacheBypassPages: delivery.cacheBypassPages,
        revocationAttempted: revocation.attempted, revocationRestored: revocation.restored,
      })
      if (closed.some((result) => result.status === "rejected") || contextCount !== 4 || ingressErrors.length || boundDocuments.size !== pages.length)
        throw new Error("G08_PRIVATE_BROWSER_CLEANUP_INCOMPLETE")
    }
  },
})
