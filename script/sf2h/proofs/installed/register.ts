/** Host-only, executable F04 registration driver.
 * Invoked by the existing approved GitHub Actions installation harness (191).
 * The adapter must hand back LIVE host-owned BrowserContexts, original F01
 * route resolver results and the real approved Orchestra connection registry.
 * No secrets, grants, login scripts or fake users are accepted or serialized.
 */
import { rm } from "node:fs/promises"
import type { Browser, Page } from "@playwright/test"
import type { SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import { attachHostedNativeBrowser } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/installed-browser.ts"
import { registerNativeInstalledManifest } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/installed-manifest.ts"
import type { NativeInstalledRegistration } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/installed-manifest.ts"
import { requireNativeJourney } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/journeys.ts"
import {
  registerNativeSelectedInstallation, readNativeSelectedInstallation,
  requireOriginalNativeOperations, u15RegisteredEnvironment,
} from "../../../../packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts"
import type {
  NativeInstalledCase, NativeInstalledSuite, NativeSelectionInput,
} from "../../../../packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts"
import { readNativeManifest } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/readiness.ts"
import type { NativeActor, NativeManifest, NativeTarget } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/readiness.ts"

type LiveActors = NativeInstalledRegistration["actors"]
const suiteCases = {
  U15: ["list", "editable", "denied", "stale", "lost"],
  U39: ["entry"],
  U40: ["entry"],
} as const
const suiteCapability = { U15: "CAP14", U39: "CAP04", U40: "CAP05" } as const

/** Provider-owned runtime contracts; not fixture objects from a test double.
 * The missing adapter is an explicit external dependency, not a PASS or skip.
 */
export type ApprovedInstalledHost = Readonly<{
  target: NativeTarget
  wrongServer: NativeTarget
  wrongProject: NativeTarget
  wrongInstallation: NativeTarget
  resolveApprovedConnection: NativeInstalledRegistration["resolveApprovedConnection"]
  /** Attach actor pages from existing Microsoft-authenticated contexts in browser. */
  liveMicrosoftActorPages(browser: Browser): Promise<LiveActors>
  /** Call original F01 producer/route resolver, never build a URL from a role. */
  resolveOriginalF01Route(input: Readonly<{
    page: Page; capabilityId: "CAP14" | "CAP04" | "CAP05"
    caseId: NativeInstalledCase
  }>): Promise<SfResolvedRoute>
  /** Select a real row from the ORIGINAL producer and visible installed UI. */
  originalSourceRowId(input: Readonly<{
    page: Page; capabilityId: "CAP14" | "CAP04" | "CAP05"
    caseId: NativeInstalledCase; route: SfResolvedRoute
  }>): Promise<string>
}>

async function selectBudgetActor(
  manifest: NativeManifest, pages: LiveActors, suite: "U39" | "U40",
): Promise<Readonly<{ actor: NativeActor; page: Page }>> {
  const capabilityId = suiteCapability[suite]
  for (const actor of ["dashboardAdmin", "holder", "requester"] as const) {
    const page = pages[actor]
    if (!page) continue
    try {
      const admitted = await requireNativeJourney({
        page, manifest, actor, capabilityId, intent: "edit", year: 2026,
      })
      await requireOriginalNativeOperations({
        page, manifest, capabilityId, principalRef: admitted.principalRef,
        policyVersion: admitted.policyVersion, accessRevision: admitted.accessRevision,
        intent: "edit",
      })
      return { actor, page }
    } catch { /* Different actor is acceptable only if independently admitted. */ }
  }
  throw new Error("F04_" + suite + "_NO_CURRENT_MICROSOFT_ACTOR_WITH_REAL_READ_AND_SAVE")
}

async function selectStaleEditor(manifest: NativeManifest, pages: LiveActors) {
  for (const actor of ["holder", "dashboardAdmin"] as const) {
    const page = pages[actor]
    if (!page) continue
    try {
      const admitted = await requireNativeJourney({
        page, manifest, actor, capabilityId: "CAP14", intent: "edit",
      })
      await requireOriginalNativeOperations({
        page, manifest, capabilityId: "CAP14", principalRef: admitted.principalRef,
        policyVersion: admitted.policyVersion, accessRevision: admitted.accessRevision,
        intent: "edit",
      })
      return { actor, page }
    } catch { /* Neither actor name nor a stale URL is authority. */ }
  }
  throw new Error("F04_U15_NO_DISTINCT_REAL_SECOND_CAP14_EDITOR_ADMITTED")
}

export async function registerInstalledProofFromHost(input: Readonly<{
  suite: NativeInstalledSuite
  scratchRoot: string
  candidateSha: string
  host: ApprovedInstalledHost
}>): Promise<Readonly<{
  manifestPath: string
  selectedPath: string
  candidateSha: string
  suite: NativeInstalledSuite
  selectedCount: number
  /** Only shell URLs, not cookies/IDs/headers; pass via private runner to 194. */
  u15Urls: Readonly<Record<string, string>>
  proofClass: "REGISTERED_ONLY_NOT_EXECUTED"
}>> {
  if (process.env.GITHUB_ACTIONS !== "true" ||
      input.candidateSha !== process.env.SF_NATIVE_CANDIDATE_SHA ||
      !/^[0-9a-f]{40}$/.test(input.candidateSha))
    throw new Error("F04_AUTHORIZED_ACTIONS_CANDIDATE_REQUIRED")
  const browser = await attachHostedNativeBrowser(input.scratchRoot)
  let createdManifestPath: string | undefined
  let createdSelectedPath: string | undefined
  try {
    const pages = await input.host.liveMicrosoftActorPages(browser)
    // The real writer independently verifies distinct authenticated Microsoft
    // sessions, denied CAP14, approved server/provider and negative boundaries.
    const registration = await registerNativeInstalledManifest({
      scratchRoot: input.scratchRoot, candidateSha: input.candidateSha,
      target: input.host.target,
      wrongServer: input.host.wrongServer,
      wrongProject: input.host.wrongProject,
      wrongInstallation: input.host.wrongInstallation,
      actors: pages,
      resolveApprovedConnection: input.host.resolveApprovedConnection,
    })
    createdManifestPath = registration.path
    const manifest = await readNativeManifest()
    const budget = input.suite === "U39" || input.suite === "U40"
      ? await selectBudgetActor(manifest, pages, input.suite)
      : undefined
    const definitions: NativeSelectionInput[] = []
    for (const caseId of suiteCases[input.suite]) {
      const selected = budget ?? (caseId === "denied"
        ? { actor: "denied" as const, page: pages.denied }
        : { actor: "requester" as const, page: pages.requester })
      const capabilityId = suiteCapability[input.suite]
      const route = await input.host.resolveOriginalF01Route({
        page: selected.page, capabilityId, caseId,
      })
      const sourceRecordId = caseId === "denied" ? undefined
        : await input.host.originalSourceRowId({
          page: selected.page, capabilityId, caseId, route,
        })
      definitions.push({
        caseId, actor: selected.actor, page: selected.page, route,
        ...(sourceRecordId === undefined ? {} : { sourceRecordId }),
      })
    }
    const staleEditor = input.suite === "U15" ? await selectStaleEditor(manifest, pages) : undefined
    const selected = await registerNativeSelectedInstallation({
      manifest, browser, suite: input.suite,
      selections: definitions, ...(staleEditor ? { staleEditor } : {}),
    })
    createdSelectedPath = selected.file
    const consumed = await readNativeSelectedInstallation(manifest, input.suite)
    return {
      manifestPath: registration.path,
      selectedPath: selected.file,
      candidateSha: manifest.candidateSha,
      suite: input.suite,
      selectedCount: consumed.selections.length,
      u15Urls: input.suite === "U15" ? u15RegisteredEnvironment(consumed) : {},
      proofClass: "REGISTERED_ONLY_NOT_EXECUTED",
    }
  } catch (error) {
    // We exclusively created the v1 file during this call; do not leave an
    // orphaned 'installed' manifest after a failed selection registration.
    if (createdSelectedPath) await rm(createdSelectedPath, { force: true })
    if (createdManifestPath) await rm(createdManifestPath, { force: true })
    throw error
  } finally {
    // A connected CDP Browser.close disconnects the client; the browser is
    // host-owned and was never launched/restarted by this driver.
    await browser.close()
  }
}
