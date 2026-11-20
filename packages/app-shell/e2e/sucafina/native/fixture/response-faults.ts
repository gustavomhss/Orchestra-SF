/** F04 transport-only fault seams on the original, authenticated producer.
 * No route.fulfill mock, forged status/receipt, role override, or replay.
 */
import type { Page, Request, Route } from "@playwright/test"
import { expect } from "@playwright/test"
import { Schema } from "effect"
import { SfTeamContextResult } from "@orchestra/schema/sucafina/context"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { nativeTeamRef } from "./manifest-contract.ts"
import { nativeContextURL, observeNativeBinding } from "./readiness.ts"
import type { NativeManifest, NativeTarget } from "./readiness.ts"

export type NativeFaultTarget = Readonly<{
  origin: string
  pathname: string
  method: "POST" | "GET"
  query?: Readonly<Record<string, string>>
}>

function sameTarget(url: URL, target: NativeFaultTarget) {
  return url.origin === target.origin && url.pathname === target.pathname &&
    Object.entries(target.query ?? {}).every(([key, value]) => {
      const matches = url.searchParams.getAll(key)
      return matches.length === 1 && matches[0] === value
    })
}
function exactURL(request: Request, target: NativeFaultTarget) {
  return request.method() === target.method && sameTarget(new URL(request.url()), target)
}
function requireFaultTarget(target: NativeFaultTarget) {
  const origin = new URL(target.origin)
  if (target.origin !== origin.origin || origin.username || origin.password ||
      !target.pathname.startsWith("/") || target.pathname.startsWith("//") ||
      Object.values(target.query ?? {}).some((value) => typeof value !== "string" || !value))
    throw new Error("F04_FAULT_TARGET_MUST_BE_EXACT_ORIGINAL_PRODUCER")
}

/** Let the original producer respond to ONE mutation, then discard its response.
 * A 2xx response is still NOT proof of durable commit or an approvable receipt.
 */
export async function armLostResponse(page: Page, target: NativeFaultTarget) {
  requireFaultTarget(target)
  if (target.method !== "POST") throw new Error("F04_LOST_RESPONSE_REQUIRES_EXPLICIT_POST")
  let attempts = 0
  let producerStatus: number | null = null
  const matchesURL = (url: URL) => sameTarget(url, target)
  const handler = async (route: Route) => {
    if (!exactURL(route.request(), target)) return route.continue()
    attempts++
    if (attempts !== 1) return route.continue()
    const actual = await route.fetch({ maxRedirects: 0, maxRetries: 0 })
    producerStatus = actual.status()
    await route.abort("failed")
  }
  await page.route(matchesURL, handler)
  return {
    observations: () => {
      if (attempts !== 1 || producerStatus === null)
        throw new Error("F04_REAL_PRODUCER_RESPONSE_NOT_OBSERVED")
      return {
        phase: "RESPONSE_DELIVERY_LOST_AFTER_REAL_PRODUCER_STATUS" as const,
        attempts, producerStatus,
        producerCommit: "UNPROVEN_REQUIRES_ORIGINAL_AUTHORIZED_READ" as const,
        automaticRetryProhibited: true, outcomeUnknownUntilOriginalRead: true,
      }
    },
    dispose: () => page.unroute(matchesURL, handler),
  }
}

/** Hold exactly one real producer response until the caller confirms the
 * actual owner transition; waiting on the gate has no timer or fake body.
 */
export async function armHeldResponse(page: Page, target: NativeFaultTarget) {
  requireFaultTarget(target)
  let attempts = 0
  let producerStatus: number | null = null
  let releaseResponse: () => void = () => {}
  const gate = new Promise<void>((resolve) => { releaseResponse = resolve })
  const matchesURL = (url: URL) => sameTarget(url, target)
  const handler = async (route: Route) => {
    if (!exactURL(route.request(), target)) return route.continue()
    attempts++
    if (attempts !== 1) return route.continue()
    const response = await route.fetch({ maxRedirects: 0, maxRetries: 0 })
    producerStatus = response.status()
    await gate
    await route.fulfill({ response })
  }
  await page.route(matchesURL, handler)
  return {
    observations: () => {
      if (attempts !== 1 || producerStatus === null)
        throw new Error("F04_HELD_REAL_PRODUCER_RESPONSE_NOT_OBSERVED")
      return {
        phase: "REAL_PRODUCER_RESPONSE_HELD" as const,
        attempts, producerStatus,
        ownerTransition: "REQUIRES_SEPARATE_INSTALLED_PRODUCER_PROOF" as const,
      }
    },
    release: () => releaseResponse(),
    dispose: async () => { releaseResponse(); await page.unroute(matchesURL, handler) },
  }
}

/** Disable only the disposable case Team through the real administration route. */
export async function revokeNativeTeam(input: Readonly<{
  page: Page
  admin: Page
  manifest: NativeManifest
  capabilityId: string
  principalRef: string
}>) {
  const { target, actors } = input.manifest
  if (input.page.context() === input.admin.context()) throw new Error("F04_DISTINCT_REVOCATION_ADMIN_REQUIRED")
  const before = await observeNativeBinding(input.page, target)
  if (!before.stamp.team || before.stamp.principalRef !== input.principalRef ||
      !before.destinations.some((entry) => entry.capabilityId === input.capabilityId && entry.canRead))
    throw new Error("F04_REVOCATION_PRECONDITION_UNAUTHORIZED")
  const administrator = await observeNativeBinding(input.admin, target)
  if (administrator.stamp.principalRef !== actors.dashboardAdmin ||
      administrator.profile.administration.status !== "available")
    throw new Error("F04_REAL_TEAMS_ADMINISTRATION_REQUIRED")
  const profile = nativeTeamRef(target)
  const url = new URL(target.mount + "/api/ui/team-profiles", target.publicOrigin)
  url.search = new URLSearchParams({ contractRevision: "sf-team-profile/1",
    installationId: profile.installationId, tenantId: profile.tenantId }).toString()
  const opts = { maxRedirects: 0, maxRetries: 0, timeout: 15000 }
  const catalog = await input.admin.request.get(url.href, opts)
  if (catalog.status() !== 200) throw new Error("F04_REAL_TEAMS_ADMIN_CATALOG_UNAVAILABLE")
  const current = Schema.decodeUnknownSync(TeamProfile.AdminListResult)(await catalog.json())
  if (current.status !== "ok" || current.configRevision !== before.stamp.team.revisions.configRevision ||
      current.profiles.filter((entry) => entry.enabled).length !== 1 ||
      !current.profiles.some((entry) => entry.enabled && entry.profile.installationId === profile.installationId &&
        entry.profile.tenantId === profile.tenantId && entry.profile.teamObjectId === profile.teamObjectId))
    throw new Error("F04_DISPOSABLE_TEAMS_ADMIN_CATALOG_MISMATCH")
  const action = await input.admin.request.post(url.href, { ...opts, headers: { origin: target.publicOrigin },
    data: { action: "disable", profile, expectedRevision: current.configRevision } })
  if (action.status() !== 200) throw new Error("F04_REAL_PRODUCER_REVOCATION_NOT_CONFIRMED")
  const result = Schema.decodeUnknownSync(TeamProfile.AdminConfigureResult)(await action.json())
  if (result.status !== "ok" || !result.changed || result.configRevision !== current.configRevision + 1)
    throw new Error("F04_REAL_PRODUCER_REVOCATION_NOT_CONFIRMED")
  const after = await observeNativeBinding(input.page, target)
  if (after.stamp.principalRef !== before.stamp.principalRef ||
      after.stamp.accessRevision === before.stamp.accessRevision ||
      after.profile.teams.status !== "revoked" || after.stamp.team || after.destinations.length || after.availability.length)
    throw new Error("F04_REVOCATION_NOT_PROVEN_BY_ORIGINAL_CONTEXT")
  return {
    phase: "PRODUCER_ACCESS_REVOCATION_OBSERVED" as const,
    principalRef: before.stamp.principalRef,
    oldAccessRevision: before.stamp.accessRevision,
    newAccessRevision: after.stamp.accessRevision,
    clientProjection: "REQUIRES_SEPARATE_UI_ASSERTION" as const,
  }
}

/** Exercise the original same-document refresh, not a reload that erases every draft anyway. */
export async function refreshRevokedNativeTeam(page: Page, target: NativeTarget, accessRevision: string) {
  const expected = new URL(nativeContextURL(target))
  const documentStart = await page.evaluate(() => performance.timeOrigin)
  const [reply] = await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url())
      return response.request().method() === "GET" && url.origin === expected.origin &&
        url.pathname === expected.pathname && url.searchParams.size === expected.searchParams.size &&
        [...expected.searchParams].every(([key, value]) =>
          url.searchParams.getAll(key).length === 1 && url.searchParams.get(key) === value)
    }),
    page.evaluate(() => window.dispatchEvent(new FocusEvent("focus"))),
  ])
  expect(reply.status()).toBe(200)
  const result = Schema.decodeUnknownSync(SfTeamContextResult)(await reply.json())
  expect(result).toMatchObject({ status: "ok", value: { stamp: { accessRevision }, profile: { teams: { status: "revoked" } } } })
  await expect(page.getByRole("alert").filter({ hasText: /This Team is not available for this account\.|Esta equipe não está disponível para esta conta\./ })).toBeVisible()
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStart)
}
