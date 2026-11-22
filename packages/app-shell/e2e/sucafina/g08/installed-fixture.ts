// Original installed Microsoft sessions only. No launch, storageState, cookie copying or mocked producer.
import { chromium, expect, test } from "@playwright/test"
import type { BrowserContext, Page, Response } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { Schema } from "effect"
import { SfInstallationList, SfTeamContextResult } from "@orchestra/schema/sucafina/context"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { Session } from "@orchestra/schema/session"
import { landing } from "./landing-contract.ts"
import { canonicalAddress, cases, digest, privateText, readPlan, record, validateGrantProof, validateHost, validatePackage, writePrivate } from "../../../../../script/sf-ci/g08-private-evidence.mjs"

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

async function originalRequest(page: Page, url: string, method: "GET" | "POST" | "DELETE" = "GET", body?: unknown, selector?: string) {
  const binding = contextBindings.get(page.context())
  if (!binding || new URL(page.url()).origin !== binding.origin || new URL(url).origin !== binding.origin)
    throw new Error("G08_ORIGINAL_BROWSER_ORIGIN_REQUIRED")
  // The nonce identifies this observation only; the browser supplies its own original cookie jar.
  const nonce = randomUUID()
  const [response] = await Promise.all([
    page.waitForResponse((reply) => reply.url() === url && reply.request().method() === method &&
      reply.request().headers()[observationHeader] === nonce),
    page.evaluate(async ({ requestURL, requestMethod, requestBody, requestNonce, header, requestedSelector }) => {
      await fetch(requestURL, {
        method: requestMethod, credentials: "same-origin", redirect: "manual", cache: "no-store",
        signal: AbortSignal.timeout(30_000),
        headers: { [header]: requestNonce, ...(requestedSelector ? { "x-sf-team-profile": requestedSelector } : {}),
          ...(requestMethod === "POST" ? { "content-type": "application/json" } : {}) },
        ...(requestMethod === "POST" ? { body: JSON.stringify(requestBody) } : {}),
      })
    }, { requestURL: url, requestMethod: method, requestBody: body, requestNonce: nonce, header: observationHeader, requestedSelector: selector }),
  ])
  // Read the original network Response after peer validation, never a body supplied by page JavaScript.
  if (method === "POST" && response.request().postData() !== JSON.stringify(body))
    throw new Error("G08_ORIGINAL_COMMAND_CHANGED")
  if (response.request().headers()["x-sf-team-profile"] !== selector ||
    method === "DELETE" && response.request().postData() !== null)
    throw new Error("G08_ORIGINAL_SESSION_SELECTOR_CHANGED")
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
export function contextURL(target: Target, selection: boolean | "administration" = false) {
  const url = new URL(target.mount + "/api/ui/context", target.publicOrigin)
  url.search = new URLSearchParams({ contractRevision: "sf-team-profile/1", installationId: target.installationId,
    tenantId: target.tenantId, hostId: target.hostId, kind: selection === "administration" ? "administration" : selection ? "selection" : "team",
    ...(selection ? {} : { teamObjectId: target.teamObjectId }) }).toString()
  return url.href
}
export async function contextReply(page: Page, target: Target, selection: boolean | "administration" = false) {
  return originalRequest(page, contextURL(target, selection))
}
export async function observe(page: Page, target: Target, selection: boolean | "administration" = false) {
  if (new URL(page.url()).origin !== target.shellOrigin) throw new Error("G08_ACTOR_OUTSIDE_INSTALLED_SHELL")
  const discovery = new URL("/api/sucafina/installations", target.discoveryOrigin)
  discovery.search = new URLSearchParams({ select: "current", contractRevision: "sf-team-profile/1" }).toString()
  const response = await originalRequest(page, discovery.href)
  if (response.status() !== 200 || response.headers()["cache-control"] !== "no-store" ||
    !/^application\/json(?:;|$)/i.test(response.headers()["content-type"] ?? "")) throw new Error("G08_ORIGINAL_DISCOVERY_UNAVAILABLE")
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
async function contextValue(reply: Response, target: Target, selection: boolean | "administration" = false) {
  if (reply.status() !== 200 || reply.headers()["cache-control"] !== "no-store" ||
    !/^application\/json(?:;|$)/i.test(reply.headers()["content-type"] ?? "")) throw new Error("G08_ORIGINAL_CONTEXT_UNAVAILABLE")
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
  await expect(page.locator(landing.shell)).toHaveAttribute("data-sf-teams-state", "authenticated")
  await expect(page.locator("[data-sf-teams-shell]")).toHaveAttribute("data-sf-team-selected", target.teamObjectId)
  const live = await observe(page, target)
  expect(live.stamp.principalRef).toBe(principal)
  expect(live.profile.teams.status).toBe("ready")
  expect(live.stamp.team?.owner.profile).toEqual(teamRef(target))
  expect(live.profile.principal.principalObjectId).toBe(principal)
  expect(live.stamp.team?.owner.principal).toEqual(live.profile.principal)
  // Selection is not a claim about business grants, which require their own original proof.
  await expect(page.locator(landing.picker)).toHaveValue(target.teamObjectId)
  await expect(page.locator(landing.dashboard)).toHaveAttribute("href", target.mount + "/teams/" + target.teamObjectId + "/dashboard")
  return live
}
export async function uiContext(page: Page, target: Target, action: () => Promise<unknown>, selection: boolean | "administration" = false) {
  return contextValue(await uiReply(page, contextURL(target, selection), "GET", action), target, selection)
}
export async function switchTeam(page: Page, target: Target, principal: string, action: () => Promise<unknown>) {
  const changed = await uiContext(page, target, action)
  expect(changed.stamp.principalRef).toBe(principal)
  expect(changed.profile.teams.status).toBe("ready")
  expect(changed.stamp.team?.owner.profile).toEqual(teamRef(target))
  expect(changed.profile.principal.principalObjectId).toBe(principal)
  expect(changed.stamp.team?.owner.principal).toEqual(changed.profile.principal)
  // The action's original F02 response and the independent re-read must both have the selected owner.
  return selected(page, target, principal)
}
export async function focusRefresh(page: Page, target: Target) {
  const documentStart = await page.evaluate(() => performance.timeOrigin)
  const live = await uiContext(page, target, () => page.evaluate(() => window.dispatchEvent(new FocusEvent("focus"))))
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStart)
  return live
}

// Public shapes observed in integrated295eb / #655. The original mounted producer and current actor remain required.
// ConfigRevision is opaque: preserve the exact token; never coerce or assume +1.
const AdminCatalog = Schema.Struct({
  status: Schema.Literal("ok"), configRevision: TeamProfile.ConfigRevision,
  profiles: Schema.Array(Schema.Struct({ profile: TeamProfile.Ref, enabled: Schema.Boolean })),
})
const AdminResult = Schema.Struct({ status: Schema.Literal("ok"), configRevision: TeamProfile.ConfigRevision, changed: Schema.Boolean })
function adminURL(target: Target) {
  const url = new URL(target.mount + "/api/ui/team-profiles", target.publicOrigin)
  url.search = new URLSearchParams({ contractRevision: "sf-team-profile/1", installationId: target.installationId,
    tenantId: target.tenantId }).toString()
  return url.href
}
export async function adminCatalog(page: Page, target: Target) {
  return adminCatalogValue(await originalRequest(page, adminURL(target)), target)
}
async function adminCatalogValue(response: Response, target: Target) {
  if (response.status() !== 200 || response.headers()["cache-control"] !== "no-store")
    throw new Error("G08_REAL_ADMIN_ROUTE_NOT_AVAILABLE")
  const catalog = Schema.decodeUnknownSync(AdminCatalog, strict)(await response.json())
  if (catalog.profiles.length > 10_000 ||
    new Set(catalog.profiles.map((entry) => JSON.stringify(entry.profile))).size !== catalog.profiles.length ||
    catalog.profiles.some((entry) => entry.profile.installationId !== target.installationId ||
      entry.profile.tenantId !== target.tenantId))
    throw new Error("G08_REAL_ADMIN_CATALOG_INVALID")
  return catalog
}
export async function configureTeam(page: Page, target: Target, action: "enable" | "disable", expectedRevision: TeamProfile.ConfigRevision) {
  const response = await originalRequest(page, adminURL(target), "POST", {
    action, profile: teamRef(target), expectedRevision,
  })
  if (response.status() !== 200 || response.headers()["cache-control"] !== "no-store")
    throw new Error("G08_ADMIN_MUTATION_OUTCOME_REQUIRES_ORIGINAL_READ")
  const result = Schema.decodeUnknownSync(AdminResult, strict)(await response.json())
  if (!result.changed || result.configRevision === expectedRevision)
    throw new Error("G08_ADMIN_MUTATION_OUTCOME_REQUIRES_ORIGINAL_READ")
  return result
}

/** Observe the native #661 panel's own request and rendered rows, never a replacement API-only pass. */
export async function openAdministration(page: Page, target: Target) {
  const toggle = page.locator(landing.adminToggle)
  await expect(toggle).toBeVisible()
  const action = await toggle.getAttribute("aria-expanded") === "true"
    ? () => page.locator(landing.adminRead).click()
    : () => toggle.click()
  const catalog = await adminCatalogValue(await uiReply(page, adminURL(target), "GET", action), target)
  await expect(page.locator(landing.administration)).toHaveAttribute("data-sf-team-administration", "ready")
  // The reserved fixture is intentionally bounded; no partial/paginated UI is promoted to the full catalog.
  expect(catalog.profiles.length).toBeGreaterThan(0)
  expect(catalog.profiles.length).toBeLessThanOrEqual(100)
  await expect(page.locator(landing.adminRow)).toHaveCount(catalog.profiles.length)
  for (const entry of catalog.profiles) {
    const row = page.locator('[data-sf-admin-team="' + entry.profile.teamObjectId + '"]')
    await expect(row).toBeVisible()
    await expect(row.locator('[data-sf-admin-action="' + (entry.enabled ? "disable" : "enable") + '"]')).toBeEnabled()
  }
  return catalog
}

export async function configureTeamUI(page: Page, target: Target, action: "enable" | "disable", expectedRevision: TeamProfile.ConfigRevision) {
  const command = { action, profile: teamRef(target), expectedRevision }
  const control = page.locator('[data-sf-admin-team="' + target.teamObjectId + '"]')
    .locator('[data-sf-admin-action="' + action + '"]')
  const response = await uiReply(page, adminURL(target), "POST", () => control.click())
  expect(response.request().postDataJSON()).toEqual(command)
  if (response.status() !== 200 || response.headers()["cache-control"] !== "no-store")
    throw new Error("G08_ADMIN_MUTATION_OUTCOME_REQUIRES_ORIGINAL_READ")
  const result = Schema.decodeUnknownSync(AdminResult, strict)(await response.json())
  if (!result.changed || result.configRevision === expectedRevision)
    throw new Error("G08_ADMIN_MUTATION_OUTCOME_REQUIRES_ORIGINAL_READ")
  return result
}

// Session.Info at the inspected producer carries this original namespace. Requiring it also
// fails closed when an older producer serializes a technical-mode response without an owner.
const InstalledSessionInfo = Session.Info.mapFields((fields) => ({ ...fields, namespace: TeamProfile.SessionNamespace }))
const SessionReply = Schema.Struct({ data: InstalledSessionInfo })
const SessionList = Schema.Struct({
  data: Schema.Array(InstalledSessionInfo), namespace: TeamProfile.SessionNamespace,
  cursor: Schema.Struct({ previous: Schema.optional(Schema.String), next: Schema.optional(Schema.String) }),
})
export type SessionInventory = {
  namespace: TeamProfile.SessionNamespace
  entries: readonly unknown[]
}
function sessionSelector(target: Target) {
  return JSON.stringify(Schema.decodeUnknownSync(TeamProfile.Selector, strict)({
    contractRevision: "sf-team-profile/1", kind: "team", profile: teamRef(target),
  }))
}
function sessionOwner(namespace: TeamProfile.SessionNamespace, target: Target, principal: string) {
  expect(namespace.owner.profile).toEqual(teamRef(target))
  expect(namespace.owner.principal).toEqual({ tenantId: target.tenantId, principalObjectId: principal })
}
export async function sessionRequest(page: Page, target: Target, suffix = "", method: "GET" | "POST" | "DELETE" = "GET", body?: unknown, invocationId?: string) {
  if (method === "DELETE" && (!invocationId || !/^[a-f0-9]{32}$/.test(invocationId) ||
    !new RegExp("^/ses_g08_" + invocationId + "_[a-f0-9]{32}$").test(suffix)))
    throw new Error("G08_ONLY_CURRENT_INVOCATION_CLEANUP_ALLOWED")
  if (!/^$|^\/ses_g08_[a-f0-9_]+$/.test(suffix)) throw new Error("G08_ONLY_DISPOSABLE_SESSION_PATH_ALLOWED")
  return originalRequest(page, new URL(target.mount + "/api/session" + suffix, target.publicOrigin).href,
    method, body, sessionSelector(target))
}
async function sessionJSON(response: Response) {
  if (response.status() !== 200 || response.headers()["cache-control"] !== "no-store" ||
    !/^application\/json(?:;|$)/i.test(response.headers()["content-type"] ?? ""))
    throw new Error("G08_ORIGINAL_SESSION_RESPONSE_REQUIRED")
  return response.json()
}
export async function sessionValue(response: Response, target: Target, principal: string, id: string) {
  const value = Schema.decodeUnknownSync(Schema.toCodecJson(SessionReply), strict)(await sessionJSON(response))
  sessionOwner(value.data.namespace, target, principal)
  expect(value.data.id).toBe(id)
  return Schema.encodeSync(Schema.toCodecJson(InstalledSessionInfo))(value.data)
}
export async function sessionInventory(page: Page, target: Target, principal: string): Promise<SessionInventory> {
  const entries: unknown[] = [], identifiers = new Set<string>(), cursors = new Set<string>()
  let namespace: TeamProfile.SessionNamespace | undefined, cursor: string | undefined
  for (let pageIndex = 0; pageIndex < 100; pageIndex++) {
    const url = new URL(target.mount + "/api/session", target.publicOrigin)
    url.search = new URLSearchParams(cursor ? { limit: "100", cursor } : {
      limit: "100", includeArchived: "true", order: "asc",
    }).toString()
    const value = Schema.decodeUnknownSync(Schema.toCodecJson(SessionList), strict)(
      await sessionJSON(await originalRequest(page, url.href, "GET", undefined, sessionSelector(target))))
    sessionOwner(value.namespace, target, principal)
    if (namespace) expect(value.namespace).toEqual(namespace)
    else namespace = value.namespace
    for (const entry of value.data) {
      expect(entry.namespace).toEqual(namespace)
      if (identifiers.has(entry.id)) throw new Error("G08_SESSION_INVENTORY_DUPLICATE")
      identifiers.add(entry.id)
      entries.push(Schema.encodeSync(Schema.toCodecJson(InstalledSessionInfo))(entry))
    }
    if (value.data.length === 0 || !value.cursor.next)
      return { namespace, entries: entries.sort((a, b) => String(record(a).id).localeCompare(String(record(b).id))) }
    if (cursors.has(value.cursor.next)) throw new Error("G08_SESSION_CURSOR_REPEATED")
    cursors.add(value.cursor.next)
    cursor = value.cursor.next
  }
  throw new Error("G08_SESSION_INVENTORY_INCOMPLETE")
}
export function chatHref(target: Target) {
  const url = new URL("/orchestra/sf-sessions/new", target.publicOrigin)
  url.search = ownerQuery(target).toString()
  return url.href
}
/** The UI itself must fetch the original Session list after its original F02 action. */
export async function chatAction(page: Page, target: Target, principal: string, action: () => Promise<unknown>) {
  const url = new URL(target.mount + "/api/session", target.publicOrigin)
  url.search = new URLSearchParams({ limit: "50", order: "desc" }).toString()
  const response = await uiReply(page, url.href, "GET", () => switchTeam(page, target, principal, action))
  if (response.request().headers()["x-sf-team-profile"] !== sessionSelector(target))
    throw new Error("G08_NATIVE_CHAT_SELECTOR_CHANGED")
  const value = Schema.decodeUnknownSync(Schema.toCodecJson(SessionList), strict)(await sessionJSON(response))
  sessionOwner(value.namespace, target, principal)
  for (const entry of value.data) expect(entry.namespace).toEqual(value.namespace)
  await expect(page).toHaveURL(chatHref(target))
  await expect(page.locator(landing.workspace)).toHaveAttribute("data-sf-session-state", "ready")
  await expect(page.locator(landing.editor)).toBeEditable()
  return value.namespace
}

export async function removeSessionFixture(page: Page, target: Target, principal: string, id: string, before: SessionInventory, invocationId: string) {
  const current = await sessionInventory(page, target, principal)
  expect(current.namespace).toEqual(before.namespace)
  const found = current.entries.filter((entry) => record(entry).id === id)
  if (found.length) {
    expect(found).toHaveLength(1)
    const removed = await sessionRequest(page, target, "/" + id, "DELETE", undefined, invocationId)
    expect(removed.status()).toBe(204)
    expect(removed.headers()["cache-control"]).toBe("no-store")
    expect(await removed.body()).toHaveLength(0)
  }
  const after = await sessionInventory(page, target, principal)
  expect(after).toEqual(before)
  return after
}
export async function recordGrantProof(plan: Plan, value: unknown) {
  const proof = validateGrantProof(value, plan)
  await writePrivate(plan.scratchRoot, "session-grants.json", proof)
}

export async function expectUnauthenticated(reply: Response) {
  expect(reply.status()).toBe(401)
  expect(reply.headers()["cache-control"]).toBe("no-store")
  expect(reply.headers()["location"]).toBeUndefined()
  const result = Schema.decodeUnknownSync(Schema.toCodecJson(SfTeamContextResult), strict)(await reply.json())
  expect(result).toEqual({ status: "unauthenticated" })
}
export async function businessReply(page: Page, target: Target) {
  return originalRequest(page, new URL(target.mount + "/teams/" + target.teamObjectId + "/dashboard", target.publicOrigin).href)
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
  grants: { attempted: boolean; cleaned: boolean }
  administration: { observed: boolean }
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
    const grants = { attempted: false, cleaned: false }
    const administration = { observed: false }
    try {
      await use({
        plan, revocation, grants, administration,
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
            if (!["document", "script", "stylesheet", "xhr", "fetch"].includes(resource)) return
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
        grantMutationAttempted: grants.attempted, grantFixturesCleaned: grants.cleaned, nativeAdministrationObserved: administration.observed,
      })
      if (closed.some((result) => result.status === "rejected") || contextCount !== 4 || ingressErrors.length || boundDocuments.size !== pages.length)
        throw new Error("G08_PRIVATE_BROWSER_CLEANUP_INCOMPLETE")
    }
  },
})
