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
import {
  nativeSuiteCases, registerNativeSelectedInstallation, readNativeSelectedInstallation, u15RegisteredEnvironment,
} from "../../../../packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts"
import type {
  NativeInstalledCase, NativeInstalledSuite, NativeSelectionInput,
} from "../../../../packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts"
import { readNativeManifest } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/readiness.ts"
import type { NativeActor, NativeInvocation, NativeTarget } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/readiness.ts"
import { nativeSuiteRole } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/selection.ts"

type LiveActors = NativeInstalledRegistration["actors"]

/** Provider-owned runtime contracts; not fixture objects from a test double.
 * The missing adapter is an explicit external dependency, not a PASS or skip.
 */
export type ApprovedInstalledHost = Readonly<{
  target: NativeTarget
  wrongServer: NativeTarget
  wrongTeam: NativeTarget
  wrongInstallation: NativeTarget
  resolveApprovedConnection: NativeInstalledRegistration["resolveApprovedConnection"]
  /** Attach actor pages from existing Microsoft-authenticated contexts in browser. */
  liveMicrosoftActorPages(browser: Browser): Promise<LiveActors>
  /** Select the provisioned boundaries and original actor page for this scenario. */
  selectOriginalCase(input: Readonly<{ suite: NativeInstalledSuite; caseId: NativeInstalledCase; pages: LiveActors }>):
    Promise<Pick<NativeSelectionInput, "boundaries" | "actor" | "page">>
  /** Select the second original writer on the stale case's exact producer. */
  selectStaleEditor(input: Readonly<{ suite: NativeInstalledSuite; selected: NativeSelectionInput; pages: LiveActors }>):
    Promise<Readonly<{ actor: NativeActor; page: Page }>>
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

export async function registerInstalledProofFromHost(input: Readonly<{
  suite: NativeInstalledSuite
  scratchRoot: string
  candidateSha: string
  invocation: NativeInvocation
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
      input.invocation.role !== nativeSuiteRole(input.suite) ||
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
      scratchRoot: input.scratchRoot, candidateSha: input.candidateSha, invocation: input.invocation,
      target: input.host.target,
      wrongServer: input.host.wrongServer,
      wrongTeam: input.host.wrongTeam,
      wrongInstallation: input.host.wrongInstallation,
      actors: pages,
      resolveApprovedConnection: input.host.resolveApprovedConnection,
    })
    createdManifestPath = registration.path
    const manifest = await readNativeManifest()
    const definitions: NativeSelectionInput[] = []
    const { cases, capabilityId } = nativeSuiteCases[input.suite]
    for (const caseId of cases) {
      const selected = await input.host.selectOriginalCase({ suite: input.suite, caseId, pages })
      const route = caseId === "denied" ? null : await input.host.resolveOriginalF01Route({
        page: selected.page, capabilityId, caseId,
      })
      const sourceRecordId = !route || caseId === "empty" ? undefined
        : await input.host.originalSourceRowId({
          page: selected.page, capabilityId, caseId, route,
        })
      definitions.push({
        ...selected, caseId, route,
        ...(sourceRecordId === undefined ? {} : { sourceRecordId }),
      })
    }
    const stale = definitions.find((entry) => entry.caseId === "stale")
    if (!stale) throw new Error("F04_REGISTERED_STALE_CASE_REQUIRED")
    const staleEditor = await input.host.selectStaleEditor({ suite: input.suite, selected: stale, pages })
    const selected = await registerNativeSelectedInstallation({
      manifest, browser, suite: input.suite,
      selections: definitions, staleEditor, originalActors: pages,
      resolveApprovedConnection: input.host.resolveApprovedConnection,
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
    // We exclusively created the v2 file during this call; do not leave an
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
