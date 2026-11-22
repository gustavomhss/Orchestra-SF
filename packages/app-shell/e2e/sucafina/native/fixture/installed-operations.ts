/** Real original-producer callbacks. They never manufacture actors, authority or a successful receipt. */
import { randomUUID } from "node:crypto"
import { expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { NativeActor, NativeManifest } from "./manifest-contract.ts"
import { nativeTeamRef } from "./manifest-contract.ts"
import { admittedContext, prepareNativePage } from "./installed-browser.ts"
import type { InstalledBrowserSession } from "./installed-browser.ts"
import { observeNativeBinding } from "./readiness.ts"
import { nativeDashboardCommandTarget, nativeJourneyEntryHref, requireNativeJourney } from "./journeys.ts"
import { nativeOriginalRequest, nativeUIResponse } from "./browser-transport.ts"
import { readOriginalNativePage, requireOriginalNativeOperations } from "./selected-installation.ts"

const strict = { onExcessProperty: "error" } as const
type Budget = "CAP04" | "CAP05"
function need(value: unknown, reason: string): asserts value { if (!value) throw new Error(reason) }
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value) }
function same(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b) }
function adminURL(manifest: NativeManifest) {
  const target = manifest.target
  const url = new URL(target.mount + "/api/ui/team-profiles", target.publicOrigin)
  url.search = new URLSearchParams({ contractRevision: "sf-team-profile/1",
    installationId: target.installationId, tenantId: target.tenantId }).toString()
  return url
}
async function catalog(page: Page, manifest: NativeManifest) {
  const response = await nativeOriginalRequest(page, adminURL(manifest).href)
  need(response.status() === 200 && response.headers()["cache-control"] === "no-store", "F04_ORIGINAL_ADMIN_READ_REQUIRED")
  const value = Schema.decodeUnknownSync(TeamProfile.AdminListResult, strict)(await response.json())
  need(value.status === "ok", "F04_ORIGINAL_ADMIN_NOT_ADMITTED")
  const rows = value.profiles.filter((entry) => same(entry.profile, nativeTeamRef(manifest.target)))
  need(rows.length === 1, "F04_ORIGINAL_TEAM_CONFIGURATION_NOT_UNIQUE")
  return { value, selected: rows[0]! }
}
async function configuration(page: Page, manifest: NativeManifest) {
  const url = adminURL(manifest)
  url.pathname += "/configuration"
  url.searchParams.set("teamObjectId", manifest.target.teamObjectId)
  const response = await nativeOriginalRequest(page, url.href)
  const value = Schema.decodeUnknownSync(TeamProfile.ConfigurationReadResult, strict)(await response.json())
  need(response.status() === 200 && response.headers()["cache-control"] === "no-store" && value.status === "ok" &&
    same(value.configuration.profile, nativeTeamRef(manifest.target)), "F04_ORIGINAL_SHARED_CONFIGURATION_REQUIRED")
  return value.configuration
}
async function configure(page: Page, manifest: NativeManifest, action: "enable" | "disable", expectedRevision: TeamProfile.ConfigRevision) {
  const response = await nativeOriginalRequest(page, adminURL(manifest).href, "POST", {
    action, profile: nativeTeamRef(manifest.target), expectedRevision,
  })
  need(response.status() === 200 && response.headers()["cache-control"] === "no-store", "F04_ADMIN_COMMAND_REQUIRES_RECONCILIATION")
  const value = Schema.decodeUnknownSync(TeamProfile.AdminConfigureResult, strict)(await response.json())
  need(value.status === "ok" && value.changed && value.configRevision !== expectedRevision,
    "F04_ORIGINAL_ADMIN_COMMAND_NOT_COMMITTED")
  return value
}
async function row(page: Page, manifest: NativeManifest, cap: Budget, id: string) {
  const source = await readOriginalNativePage(page, manifest, cap)
  const rows = source.rows.filter((item) => String(item.id) === id)
  const key = (cap === "CAP04" ? "opexOwners:" : "capexProjects:") + id
  const version = source.versions[key]
  need(rows.length === 1 && typeof version === "number" && Number.isSafeInteger(version) &&
    typeof rows[0]!.name === "string" && rows[0]!.name.length > 0, "F04_ORIGINAL_CONCURRENT_ROW_REQUIRED")
  return { value: rows[0]!, version }
}
async function editName(page: Page, manifest: NativeManifest, cap: Budget, id: string, expectedVersion: number, name: string) {
  const before = await row(page, manifest, cap, id)
  need(before.version === expectedVersion, "F04_SECOND_WRITER_SOURCE_VERSION_CHANGED")
  await page.goto(nativeJourneyEntryHref(manifest.target, cap, 2026))
  const surface = page.locator('[data-sf-budget="' + cap + '"]')
  const selected = surface.locator(".sf-budget-owners tbody tr[data-sf-row]").filter({ hasText: String(before.value.name) })
  await expect(selected).toHaveCount(1)
  await expect(selected).toHaveAttribute("data-sf-row", id)
  await selected.locator('button[data-sf-action="select"]').click()
  const detail = surface.locator(".sf-budget-detail [data-sf-record-detail]")
  await expect(detail).toBeVisible()
  await detail.getByRole("button", { name: "Edit", exact: true }).click()
  const form = surface.locator(".sf-budget-editor .sf-budget-form")
  await form.getByRole("textbox", { name: cap === "CAP04" ? "Owner name" : "Project name", exact: true }).fill(name)
  await form.getByRole("button", { name: "Review changes", exact: true }).click()
  const target = nativeDashboardCommandTarget(manifest, cap)
  const commandURL = new URL(target.pathname, target.origin)
  commandURL.search = new URLSearchParams(target.query).toString()
  const response = await nativeUIResponse(page, commandURL.href, "POST",
    () => surface.locator('[data-component="sf-change-review"]').getByRole("button", { name: "Save", exact: true }).click())
  const command: unknown = response.request().postDataJSON()
  need(record(command) && command.page === (cap === "CAP04" ? "OPEX Detail" : "CAPEX Projects") &&
    command.action === "save" && command.id === id && command.version === expectedVersion &&
    record(command.values) && command.values.name === name && record(command.values.versions),
    "F04_SECOND_WRITER_ORIGINAL_INTENT_CHANGED")
  const reply: unknown = await response.json()
  need(response.status() === 200 && record(reply) && reply.ok === true, "F04_SECOND_WRITER_COMMAND_FAILED")
  const result = await row(page, manifest, cap, id)
  need(result.version === expectedVersion + 1 && result.value.name === name &&
    same({ ...before.value, name }, result.value), "F04_SECOND_WRITER_ORIGINAL_SOURCE_NOT_ADVANCED")
  return result
}
export function createNativeInstalledOperations(input: Readonly<{
  session: InstalledBrowserSession; manifest: NativeManifest; actor: NativeActor; page: Page; caseId: string
}>) {
  const owned = new Set<Page>()
  const restores: Array<() => Promise<void>> = []
  let closed = false, revoked = false, advanced = false
  const ownPage = async (actor: NativeActor) => {
    const context = await admittedContext(input.session, actor, input.manifest)
    const page = await context.newPage()
    owned.add(page)
    await prepareNativePage(page)
    await page.goto(new URL(input.manifest.target.chapterHref, input.manifest.target.shellOrigin).href)
    return page
  }
  return {
    async revokeViaOriginalProducer(request: { capabilityId: string; principalRef: string }) {
      need(!closed && input.caseId === "revoked" && !revoked &&
        (request.capabilityId === "CAP04" || request.capabilityId === "CAP05") &&
        request.principalRef === input.manifest.actors[input.actor], "F04_REVOCATION_CASE_BINDING_REQUIRED")
      const current = await observeNativeBinding(input.page, input.manifest.target)
      need(current.stamp.principalRef === request.principalRef &&
        current.destinations.some((value) => value.capabilityId === request.capabilityId && value.canRead),
        "F04_REVOCATION_CURRENT_ORIGINAL_ACTOR_REQUIRED")
      const admin = await ownPage("dashboardAdmin")
      const before = await catalog(admin, input.manifest)
      need(before.selected.enabled, "F04_REVOCATION_REQUIRES_ENABLED_RESERVED_TEAM")
      const document = (await configuration(admin, input.manifest)).document
      let ownedRevision: TeamProfile.ConfigRevision | undefined
      // Register reconciliation before dispatch: a lost reply must not leave the Team disabled silently.
      restores.push(async () => {
        const observed = await catalog(admin, input.manifest)
        if (!observed.selected.enabled) {
          need(ownedRevision !== undefined && observed.value.configRevision === ownedRevision, "F04_REVOCATION_RECONCILIATION_REQUIRED")
          await configure(admin, input.manifest, "enable", observed.value.configRevision)
        }
        const after = await catalog(admin, input.manifest)
        need(after.selected.enabled && same((await configuration(admin, input.manifest)).document, document),
          "F04_REVOCATION_RESTORATION_NOT_OBSERVED")
        const restored = await observeNativeBinding(input.page, input.manifest.target)
        need(restored.stamp.principalRef === request.principalRef &&
          restored.destinations.some((value) => value.capabilityId === request.capabilityId && value.canRead),
          "F04_RESTORED_ORIGINAL_ACTOR_NOT_ADMITTED")
      })
      ownedRevision = (await configure(admin, input.manifest, "disable", before.value.configRevision)).configRevision
      const after = await catalog(admin, input.manifest)
      need(!after.selected.enabled, "F04_ORIGINAL_REVOCATION_NOT_OBSERVED")
      revoked = true
      // requestRealRevocation independently re-reads F02 and the installed test observes private UI erasure.
      return { committed: true }
    },
    async advanceViaSecondAuthenticatedWriter(request: { capabilityId: string; recordId: string; expectedVersion: number }) {
      need(!closed && input.caseId === "stale" && !advanced &&
        (request.capabilityId === "CAP04" || request.capabilityId === "CAP05"), "F04_SECOND_WRITER_CASE_BINDING_REQUIRED")
      const cap = request.capabilityId
      const primary = await row(input.page, input.manifest, cap, request.recordId)
      need(primary.version === request.expectedVersion, "F04_REQUESTER_SOURCE_CAS_CHANGED")
      let editor: Page | undefined
      for (const actor of ["dashboardAdmin", "holder", "requester"] as const) {
        if (actor === input.actor) continue
        const page = await ownPage(actor)
        const context = await observeNativeBinding(page, input.manifest.target)
        const grant = context.destinations.find((entry) => entry.capabilityId === cap)
        if (!grant?.canRead || !grant.allowedActionIds.includes("save")) continue
        const admission = await requireNativeJourney({ page, manifest: input.manifest, actor, capabilityId: cap, intent: "edit", year: 2026 })
        await requireOriginalNativeOperations({ page, manifest: input.manifest, capabilityId: cap, ...admission, intent: "edit" })
        need(page.context() !== input.page.context() && admission.principalRef !== input.manifest.actors[input.actor],
          "F04_DISTINCT_SECOND_ORIGINAL_WRITER_REQUIRED")
        editor = page
        break
      }
      need(editor, "F04_SECOND_ORIGINAL_WRITER_NOT_ADMITTED")
      const page = editor
      const second = await row(page, input.manifest, cap, request.recordId)
      need(same(second, primary), "F04_SECOND_WRITER_DIFFERENT_ORIGINAL_ROW")
      const name = "N206 concurrent " + randomUUID()
      restores.push(async () => {
        const current = await row(page, input.manifest, cap, request.recordId)
        if (current.value.name === primary.value.name && same(current.value, primary.value)) return
        need(current.value.name === name && same({ ...primary.value, name }, current.value),
          "F04_CONCURRENT_ROW_CHANGED_BY_OTHER_OWNER")
        await editName(page, input.manifest, cap, request.recordId, current.version, String(primary.value.name))
        need(same((await row(page, input.manifest, cap, request.recordId)).value, primary.value),
          "F04_SECOND_WRITER_RESTORATION_NOT_OBSERVED")
      })
      const result = await editName(page, input.manifest, cap, request.recordId, request.expectedVersion, name)
      advanced = true
      return { sourceVersion: result.version }
    },
    async close() {
      if (closed) throw new Error("F04_OPERATIONS_CLEANUP_ALREADY_CONSUMED")
      closed = true
      const failures: unknown[] = []
      for (const restore of restores.reverse()) {
        try { await restore() } catch (error) { failures.push(error) }
      }
      for (const page of owned) {
        try { await page.close(); need(page.isClosed(), "F04_OWNED_PAGE_STILL_OPEN") }
        catch (error) { failures.push(error) }
      }
      if (failures.length) throw new AggregateError(failures, "F04_CALLBACK_CLEANUP_FAILED")
      return { ownedPagesClosed: owned.size, callbackRestorations: restores.length,
        cleanupScope: "OWN_PAGES_AND_CALLBACK_CHANGES_ONLY" as const, cleanupCompleted: true as const }
    },
  }
}
