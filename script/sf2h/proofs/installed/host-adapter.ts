/** Concrete original UI/registry adapter. No caller-supplied callbacks, cookies, auth or record URLs. */
import { expect } from "@playwright/test"
import type { Browser, BrowserContext, Page } from "@playwright/test"
import { Schema } from "effect"
import { SfInstallationList, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import type { SfResolvedRoute, SfTeamContext } from "@orchestra/schema/sucafina/context"
import { digest } from "../../../sf-ci/g08-private-evidence.mjs"
import type { ApprovedInstalledHost } from "./register.ts"
import { nativeTeamRef, validateNativeTarget } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/manifest-contract.ts"
import type { NativeActor, NativeTarget } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/manifest-contract.ts"
import type { NativeActorPages } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/installed-manifest.ts"
import { readNativeInstalledHost, nativeTargetInReservation } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/installed-host.ts"
import type { NativeHost } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/installed-host.ts"
import { observeNativeBinding } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/readiness.ts"
import { readG08NativeManifest } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/g08-readiness.ts"
import { nativeOriginalRequest } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/browser-transport.ts"
import { nativeJourneyEntryHref, requireNativeJourney } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/journeys.ts"
import type { NativeJourney } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/journeys.ts"
import { nativeCaseIntent, nativeSuiteCapability } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/case-contract.ts"
import type { NativeInstalledCase, NativeInstalledSuite } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/case-contract.ts"
import { nativeManifestForTarget, readOriginalNativePage, readOriginalNativeSource } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts"
import { resolveSfTeamDomainRoute } from "../../../../packages/app-shell/src/orchestra/chapters/sucafina/host/team-domain-route.ts"

export type RegistrationKind = NativeInstalledSuite | "F04"
const names = ["requester", "holder", "denied", "dashboardAdmin"] as const
const collections = { CAP14: "contracts", CAP04: "opexOwners", CAP05: "capexProjects" } as const
function need(value: unknown, reason: string): asserts value { if (!value) throw new Error(reason) }
function same(a: unknown, b: unknown) { return digest(JSON.stringify(a)) === digest(JSON.stringify(b)) }
function onOrigin(page: Page, origin: string) { try { return new URL(page.url()).origin === origin } catch { return false } }
const strict = { onExcessProperty: "error" } as const

/** Decodes the shipped current-installation response, not a general ServerProvider registry. */
export function decodeOriginalCurrentInstallation(value: unknown, target: NativeTarget) {
  const result = Schema.decodeUnknownSync(Schema.toCodecJson(SfInstallationList), strict)(value)
  need(result.installations.length === 1, "G08_NATIVE_ONE_CURRENT_INSTALLATION_REQUIRED")
  const descriptor = Schema.decodeUnknownSync(SfTeamInstallationDescriptor, strict)(result.installations[0])
  need(descriptor.authMode === "microsoft" && descriptor.contractRevision === "sf-team-profile/1" &&
    descriptor.installationId === target.installationId && descriptor.tenantId === target.tenantId &&
    descriptor.projectId === target.projectId && descriptor.hostId === target.hostId &&
    descriptor.publicOrigin === target.publicOrigin && descriptor.mount === target.mount &&
    target.discoveryOrigin === descriptor.publicOrigin && target.serverKey === descriptor.publicOrigin,
    "G08_NATIVE_CURRENT_INSTALLATION_MISMATCH")
  return descriptor
}
/** Pure admission of observed principals; the concrete collector below supplies actual context identities. */
export function requireObservedActorIndices(
  actors: NativeHost["plan"]["actors"],
  observed: readonly Readonly<{ principalRef: string; microsoft: boolean; context: object }>[],
): Record<NativeActor, number> {
  const entries = names.map((name) => {
    const matches = observed.map((value, index) => ({ value, index })).filter(({ value }) =>
      value.microsoft && value.principalRef === actors[name])
    need(matches.length === 1, "G08_NATIVE_UNIQUE_RESERVED_MICROSOFT_CONTEXT_REQUIRED")
    return [name, matches[0]!.index] as const
  })
  need(new Set(entries.map(([, index]) => observed[index]!.context)).size === 4,
    "G08_NATIVE_FOUR_DISTINCT_CONTEXTS_REQUIRED")
  return Object.fromEntries(entries) as Record<NativeActor, number>
}
/** Select only a unique producer ID actually exposed by the original table.
 * A label, row index, missing version or duplicate vendor never supplies the source identity. */
export function chooseOriginalSourceRow(
  rows: readonly Record<string, unknown>[], versions: Record<string, unknown>,
  uiIds: readonly (string | null)[], capabilityId: NativeJourney,
) {
  for (const id of uiIds) {
    if (!id || id.length > 256 || /[\u0000-\u001f\u007f]/.test(id) || uiIds.filter((entry) => entry === id).length !== 1) continue
    const matches = rows.filter((row) => (typeof row.id === "string" || typeof row.id === "number") && String(row.id) === id)
    if (matches.length !== 1) continue
    const row = matches[0]!, field = capabilityId === "CAP14" ? "vendor" : "name", label = row[field]
    const versionKey = collections[capabilityId] + ":" + id, version = versions[versionKey]
    if (typeof label !== "string" || !label.trim() || rows.filter((item) => item[field] === label).length !== 1 ||
      typeof version !== "number" || !Number.isSafeInteger(version) || version < 0) continue
    return { recordId: id, label, version, versionKey }
  }
  throw new Error("G08_NATIVE_UNIQUE_RENDERED_SOURCE_AND_CAS_REQUIRED")
}
function forKind(value: unknown, kind: RegistrationKind): NativeTarget {
  const original = validateNativeTarget(value)
  if (kind === "F04") return original
  const url = new URL(nativeJourneyEntryHref(original, nativeSuiteCapability[kind], kind === "U15" ? undefined : 2026))
  return validateNativeTarget({ ...original, chapterHref: url.pathname + url.search })
}
function descriptor(target: NativeTarget) {
  return Schema.decodeUnknownSync(SfTeamInstallationDescriptor, strict)({
    contractRevision: "sf-team-profile/1", authMode: "microsoft", installationId: target.installationId,
    tenantId: target.tenantId, projectId: target.projectId, hostId: target.hostId,
    publicOrigin: target.publicOrigin, mount: target.mount,
  })
}
export async function createOriginalInstalledHost(scratchRoot: string, kind: RegistrationKind) {
  const installed = await readNativeInstalledHost(scratchRoot)
  const target = forKind(installed.plan.target, kind), teamB = forKind(installed.plan.teamB, kind)
  const wrongInstallation = forKind(installed.plan.foreignInstallation, kind)
  let pages: NativeActorPages | undefined, attached: Browser | undefined
  let originalContexts: readonly BrowserContext[] = [], originalPages: readonly Page[] = []
  const sources = new WeakMap<Page, { capabilityId: NativeJourney; caseId: NativeInstalledCase; recordId: string }>()
  const routeObservations: Array<{ capabilityId: NativeJourney; caseId: NativeInstalledCase; target: NativeTarget;
    href: string; route: SfResolvedRoute; principalRef: string; stamp: SfTeamContext["stamp"]; observedAt: string }> = []
  let connectionObservation: Readonly<{ schema: "sf-g08-original-current-installation-v1"; source: "SfTrustedInstallationSource.current";
    url: string; status: 200; descriptor: ReturnType<typeof descriptor>; peer: { ipAddress: string; port: number };
    principalRef: string; observedAt: string }> | undefined
  async function actorFor(page: Page, selected: NativeTarget) {
    need(pages, "G08_NATIVE_ACTORS_NOT_OBSERVED")
    const actor = names.find((name) => pages![name].context() === page.context())
    need(actor, "G08_NATIVE_PAGE_NOT_IN_RESERVED_CONTEXT")
    const live = await observeNativeBinding(page, selected)
    need(live.authMode === "microsoft" && live.stamp.principalRef === installed.plan.actors[actor],
      "G08_NATIVE_ORIGINAL_PRINCIPAL_CHANGED")
    return { actor, live }
  }
  async function currentRoute(page: Page, selected: NativeTarget, capabilityId: NativeJourney) {
    const current = await actorFor(page, selected)
    const route = resolveSfTeamDomainRoute(new URL(page.url()), descriptor(selected), current.live)
    need(route && route.surfaceId === capabilityId, "G08_NATIVE_ORIGINAL_F01_NOT_RESOLVED")
    return { route, ...current }
  }
  async function selectSource(page: Page, selected: NativeTarget, capabilityId: NativeJourney) {
    const manifest = nativeManifestForTarget(await readG08NativeManifest(), selected)
    const original = await readOriginalNativePage(page, manifest, capabilityId)
    const surface = page.locator(capabilityId === "CAP14" ? '[data-component="sf-vendor-contracts"]' :
      '[data-sf-budget="' + capabilityId + '"]')
    const rows = surface.locator(capabilityId === "CAP14" ? "tbody tr[data-sf-row]" : ".sf-budget-owners tbody tr[data-sf-row]")
    await expect(rows.first()).toBeVisible()
    const ids = await rows.evaluateAll((values) => values.map((row) => row.getAttribute("data-sf-row")))
    const selectedRow = chooseOriginalSourceRow(original.rows, original.versions, ids, capabilityId)
    const index = ids.indexOf(selectedRow.recordId)
    const row = rows.nth(index)
    await expect(row).toHaveAttribute("data-sf-row", selectedRow.recordId)
    await row.locator('button[data-sf-action="select"]').click()
    const detail = surface.locator(capabilityId === "CAP14" ? ".sf-u15-detail" :
      capabilityId === "CAP04" ? "[data-sf-opex-detail]" : "[data-sf-capex-detail]")
    await expect(detail).toBeVisible()
    const reference = detail.locator(capabilityId === "CAP14" ? "details.sf-u15-source" : "details.sf-opex-reference")
    if (await reference.getAttribute("open") === null) await reference.locator(":scope > summary").click()
    await expect(reference.locator("code")).toHaveText(capabilityId === "CAP14" ?
      selectedRow.recordId : collections[capabilityId] + ":" + selectedRow.recordId)
    const actual = await readOriginalNativeSource({ page, manifest, capabilityId, recordId: selectedRow.recordId })
    need(actual.version === selectedRow.version, "G08_NATIVE_SOURCE_CHANGED_DURING_UI_SELECTION")
    return { ...selectedRow, reference, surface }
  }
  const confirmOriginalContexts = () => {
    need(attached && originalContexts.every((context) => attached!.contexts().includes(context)) &&
      originalPages.every((page) => !page.isClosed() && page.context().pages().includes(page)),
      "G08_NATIVE_ORIGINAL_CONTEXT_OR_PAGE_REMOVED")
  }
  const host: ApprovedInstalledHost = {
    target, teamB, wrongTeam: teamB, wrongInstallation, confirmOriginalContexts,
    async liveMicrosoftActorPages(browser) {
      need(!attached && !pages, "G08_NATIVE_ADAPTER_ALREADY_ATTACHED")
      attached = browser
      originalContexts = [...browser.contexts()]
      originalPages = originalContexts.flatMap((context) => context.pages())
      const observations: Array<{ page: Page; principalRef: string; microsoft: boolean; context: BrowserContext }> = []
      for (const context of originalContexts) {
        const page = context.pages().find((entry) => onOrigin(entry, target.shellOrigin))
        if (!page) continue
        const live = await observeNativeBinding(page, target)
        observations.push({ page, context, principalRef: live.stamp.principalRef, microsoft: live.authMode === "microsoft" })
      }
      const indices = requireObservedActorIndices(installed.plan.actors, observations)
      pages = { requester: observations[indices.requester]!.page, holder: observations[indices.holder]!.page,
        denied: observations[indices.denied]!.page, dashboardAdmin: observations[indices.dashboardAdmin]!.page }
      return pages
    },
    async resolveApprovedConnection(serverKey) {
      need(pages && serverKey === target.serverKey, "G08_NATIVE_CURRENT_INSTALLATION_NOT_OBSERVED")
      const live = await actorFor(pages.requester, target)
      const url = new URL("/api/sucafina/installations", target.discoveryOrigin)
      url.search = new URLSearchParams({ select: "current", contractRevision: "sf-team-profile/1" }).toString()
      const response = await nativeOriginalRequest(pages.requester, url.href)
      need(response.status() === 200 && response.headers()["cache-control"] === "no-store", "G08_NATIVE_CURRENT_DISCOVERY_HTTP_REQUIRED")
      const actual = decodeOriginalCurrentInstallation(await response.json(), target)
      const peer = await response.serverAddr()
      need(peer && peer.port === 443, "G08_NATIVE_CURRENT_DISCOVERY_PEER_REQUIRED")
      const final = await actorFor(pages.requester, target)
      need(same(live.live.stamp, final.live.stamp), "G08_NATIVE_CURRENT_DISCOVERY_PRINCIPAL_CHANGED")
      connectionObservation = { schema: "sf-g08-original-current-installation-v1", source: "SfTrustedInstallationSource.current",
        url: url.href, status: 200, descriptor: actual, peer, principalRef: final.live.stamp.principalRef, observedAt: new Date().toISOString() }
      return { serverKey: actual.publicOrigin, origin: actual.publicOrigin }
    },
    async resolveOriginalF01Route({ page, target: selected, capabilityId, caseId }) {
      nativeTargetInReservation(installed, selected)
      const manifest = nativeManifestForTarget(await readG08NativeManifest(), selected)
      const observed = await actorFor(page, selected)
      const intent = caseId === "denied" ? "read" : nativeCaseIntent(caseId)
      const admission = await requireNativeJourney({ page, manifest, actor: observed.actor, capabilityId, intent,
        ...(capabilityId === "CAP14" ? {} : { year: 2026 }) })
      const link = page.locator('nav[data-sf-team-domain-navigation] a[data-sf-capability-id="' + capabilityId + '"]')
      await expect(link).toHaveCount(1)
      const href = await link.getAttribute("href")
      need(href && new URL(href, selected.shellOrigin).href === admission.href, "G08_NATIVE_ORIGINAL_ENTRY_LINK_REQUIRED")
      await link.click()
      await expect(page).toHaveURL(admission.href)
      let current = await currentRoute(page, selected, capabilityId)
      need(current.route.kind === "entry", "G08_NATIVE_ORIGINAL_ENTRY_ROUTE_REQUIRED")
      if (capabilityId === "CAP14" && ["editable", "stale", "lost"].includes(caseId)) {
        const source = await selectSource(page, selected, capabilityId)
        sources.set(page, { capabilityId, caseId, recordId: source.recordId })
        // The detail href is produced by the original leaf. The Team host normalizes its technical selector.
        await source.reference.locator("a[href]").click()
        await expect.poll(async () => (await currentRoute(page, selected, capabilityId)).route.kind).toBe("detail")
        const edit = page.locator('.sf-u15-detail [class~="sf-u15-detail-nav"] button.primary')
        await expect(edit).toBeEnabled()
        await edit.click()
        await expect.poll(async () => (await currentRoute(page, selected, capabilityId)).route.kind).toBe("edit")
        await expect(page.locator('[data-component="sf-vendor-contracts"] [data-field="vendor"] input')).toBeEditable()
        current = await currentRoute(page, selected, capabilityId)
        need(current.route.surfaceId === "CAP14" && current.route.kind === "edit" &&
          current.route.params.contractRef === source.recordId, "G08_NATIVE_ORIGINAL_EDIT_SOURCE_REQUIRED")
      }
      const again = await requireNativeJourney({ page, manifest, actor: current.actor, capabilityId, intent,
        ...(capabilityId === "CAP14" ? {} : { year: 2026 }) })
      need(again.principalRef === observed.live.stamp.principalRef &&
        again.accessRevision === current.live.stamp.accessRevision && again.policyVersion === current.live.stamp.policyVersion &&
        same(current.live.stamp, observed.live.stamp), "G08_NATIVE_F01_AUTHORITY_CHANGED")
      routeObservations.push({ capabilityId, caseId, target: selected, href: page.url(), route: current.route,
        principalRef: current.live.stamp.principalRef, stamp: current.live.stamp, observedAt: new Date().toISOString() })
      return current.route
    },
    async originalSourceRowId({ page, target: selected, capabilityId, caseId, route }) {
      const cached = sources.get(page)
      const source = cached && cached.capabilityId === capabilityId && cached.caseId === caseId ? cached :
        await selectSource(page, selected, capabilityId)
      const manifest = nativeManifestForTarget(await readG08NativeManifest(), selected)
      const actual = await readOriginalNativeSource({ page, manifest, capabilityId, recordId: source.recordId })
      if (route.surfaceId === "CAP14" && route.kind === "edit")
        need(route.params.contractRef === actual.recordId, "G08_NATIVE_RECORD_ROUTE_SOURCE_MISMATCH")
      return actual.recordId
    },
  }
  return { host, installed,
    observation() {
      need(connectionObservation && pages, "G08_NATIVE_REGISTRATION_OBSERVATIONS_MISSING")
      return { connection: connectionObservation, routes: [...routeObservations] }
    },
    confirmOriginalContexts,
    disconnected() { return !!attached && !attached.isConnected() },
  }
}
