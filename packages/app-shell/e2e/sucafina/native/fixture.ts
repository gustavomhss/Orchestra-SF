/** F04 installed Playwright consumer.
 * The browser is an already-running, host-owned CDP browser; every test page
 * inherits an existing Microsoft-authenticated BrowserContext. Never launch,
 * manufacture context/storageState, or copy authentication to a new session.
 */
import { test } from "@playwright/test"
import type { Browser, Locator, Page } from "@playwright/test"
import {
  admittedContext, connectNativeInstalledBrowser,
} from "./fixture/installed-browser.ts"
import type { InstalledBrowserSession } from "./fixture/installed-browser.ts"
import { proveNativeWebReadiness } from "./fixture/readiness.ts"
import type { NativeActor, NativeManifest, NativeWebObservation } from "./fixture/readiness.ts"
import { requireNativeJourney } from "./fixture/journeys.ts"
import type { NativeJourney, NativeJourneyIntent } from "./fixture/journeys.ts"
import {
  consumeCurrentNativeSelection, nativeManifestForCase, nativeSuiteCases, nativeSuiteFromChapter,
  readNativeSelectedInstallation, requireIsolatedNativeRevocation, requireOriginalNativeOperations, u15RegisteredEnvironment,
} from "./fixture/selected-installation.ts"
import type {
  NativeInstalledCase, NativeSelectedInstallation,
} from "./fixture/selected-installation.ts"
import { nativeCaseIdentity, nativeIsolationActor, nativeSuiteForSpec, nativeSuiteRole, nativeTeamsSpecSelected } from "./fixture/selection.ts"
import { revokeNativeTeam } from "./fixture/response-faults.ts"

export { registerNativeInstalledManifest } from "./fixture/installed-manifest.ts"
export { readNativeManifest, observeNativeBinding, proveNativeWebReadiness } from "./fixture/readiness.ts"
export { attachHostedNativeBrowser, connectNativeInstalledBrowser, admittedContext } from "./fixture/installed-browser.ts"
export {
  nativeJourneyEntryHref, nativeJourneyResolvedHref,
  nativeDashboardCommandTarget, requireNativeJourney,
} from "./fixture/journeys.ts"
export {
  registerNativeSelectedInstallation, readNativeSelectedInstallation,
  consumeCurrentNativeSelection, requireOriginalNativeOperations,
  readOriginalNativeSource, nativeSuiteFromChapter, u15RegisteredEnvironment,
} from "./fixture/selected-installation.ts"
export { armLostResponse, armHeldResponse } from "./fixture/response-faults.ts"
export { nativeSelectedCase } from "./fixture/selection.ts"
export type { NativeManifest, NativeActor, NativeTarget, NativeLiveBinding } from "./fixture/readiness.ts"
export type { NativeJourney, NativeJourneyIntent } from "./fixture/journeys.ts"
export type {
  NativeInstalledSuite, NativeInstalledCase, NativeSelectedInstallation,
  NativeSuiteSelection, NativeSourceVersion,
} from "./fixture/selected-installation.ts"

export type NativeJourneyPrecondition = Readonly<{
  actor: NativeActor
  capabilityId: NativeJourney
  intent: NativeJourneyIntent
  year?: number
}>
export type InstalledNativeHarness = Readonly<{
  manifest: NativeManifest
  selected?: NativeSelectedInstallation
  selectedCase?: NativeInstalledCase
  proveWeb: (nativeChapter: Locator, onPage?: Page) => Promise<NativeWebObservation>
  requireJourney: (input: NativeJourneyPrecondition) =>
    ReturnType<typeof requireNativeJourney>
  openSecondEditor: (capabilityId: NativeJourney, year?: number) => Promise<Page>
  openTeamsActorPage: (actor: NativeActor) => Promise<Page>
  revokeSelectedTeam: (capabilityId: "CAP04" | "CAP05", principalRef: string) => Promise<Awaited<ReturnType<typeof revokeNativeTeam>>>
  desktop: "NOT_RUN_D01_REAL_ELECTRON_REQUIRED"
  componentFixture: "NOT_INSTALLED_PROOF"
}>

const attached = new WeakMap<Browser, InstalledBrowserSession>()

type NativeTestBinding = Readonly<{
  session: InstalledBrowserSession
  manifest: NativeManifest
  teamsSpec?: true
  isolationActor?: NativeActor
  selection?: Readonly<{ bundle: NativeSelectedInstallation; caseId: NativeInstalledCase; actor: NativeActor }>
}>

function verifyRunEnvironment(bundle: NativeSelectedInstallation) {
  if (bundle.suite !== "U15") return
  const required = u15RegisteredEnvironment(bundle)
  for (const [name, href] of Object.entries(required)) {
    if (process.env[name] !== href)
      throw new Error("F04_U15_PRIVATE_ORIGINAL_URL_NOT_BOUND_TO_TEST_" + name)
  }
}

/** Original host supplies already authenticated contexts via private CDP
 * descriptor; the default Playwright blank browser MUST NOT be used as
 * evidence of Microsoft sign-in or of the packaged desktop.
 */
export const nativeInstalledFixture = test.extend<{
  nativeTestBinding: NativeTestBinding
  nativeHarness: InstalledNativeHarness
}>({
  browser: [async ({}, use) => {
    const session = await connectNativeInstalledBrowser()
    attached.set(session.browser, session)
    try { await use(session.browser) }
    finally {
      attached.delete(session.browser)
      await session.disconnect()
    }
  }, { scope: "worker" }],
  nativeTestBinding: async ({ browser }, use, testInfo) => {
    const session = attached.get(browser)
    if (!session) throw new Error("F04_NO_HOST_OWNED_BROWSER_SESSION")
    const suite = nativeSuiteForSpec(testInfo.file)
    const role = session.manifest.invocation.role
    if (nativeTeamsSpecSelected(testInfo.file)) {
      if (role !== "teams") throw new Error("F04_NATIVE_SPEC_NOT_BOUND_TO_INVOCATION")
      await use({ session, manifest: session.manifest, teamsSpec: true })
      return
    }
    if (!suite) {
      if (role === "u15" || role === "u39" || role === "u40")
        throw new Error("F04_NATIVE_SPEC_NOT_BOUND_TO_INVOCATION")
      const isolationActor = nativeIsolationActor(testInfo.file, testInfo.title)
      await use({ session, manifest: session.manifest, ...(isolationActor ? { isolationActor } : {}) })
      return
    }
    if (nativeSuiteRole(suite) !== role || nativeSuiteFromChapter(session.manifest) !== suite)
      throw new Error("F04_NATIVE_SPEC_NOT_BOUND_TO_INVOCATION")
    const { caseId } = nativeCaseIdentity(suite, testInfo.title)
    const bundle = await readNativeSelectedInstallation(session.manifest, suite)
    verifyRunEnvironment(bundle)
    const selected = bundle.selections.find((entry) => entry.caseId === caseId)
    if (!selected) throw new Error("F04_CASE_ACTOR_NOT_REGISTERED")
    await use({
      session, manifest: nativeManifestForCase(session.manifest, selected),
      selection: { bundle, caseId, actor: selected.actor },
    })
  },
  context: async ({ nativeTestBinding }, use) => {
    const { session, manifest, selection, isolationActor } = nativeTestBinding
    const context = await admittedContext(session, selection?.actor ?? isolationActor ?? "requester", manifest.target)
    if (selection) {
      const sourcePage = context.pages().find((page) => {
        try { return new URL(page.url()).origin === manifest.target.shellOrigin }
        catch { return false }
      })
      if (!sourcePage) throw new Error("F04_CURRENT_SELECTED_CONTEXT_SHELL_PAGE_REQUIRED")
      await consumeCurrentNativeSelection({
        page: sourcePage, manifest: session.manifest,
        bundle: selection.bundle, caseId: selection.caseId,
      })
    }
    // Do not dispose the host's authenticated context at test completion.
    await use(context)
  },
  page: async ({ context }, use) => {
    const page = await context.newPage()
    try { await use(page) }
    finally { await page.close() }
  },
  nativeHarness: async ({ page, nativeTestBinding }, use) => {
    const { session, manifest, selection, teamsSpec } = nativeTestBinding
    const owned = new Set<Page>()
    try { await use({
      manifest,
      ...(selection ? { selected: selection.bundle, selectedCase: selection.caseId } : {}),
      proveWeb: (nativeChapter, onPage = page) => proveNativeWebReadiness(onPage, manifest, nativeChapter),
      requireJourney: (input) => requireNativeJourney({ ...input, manifest, page }),
      async openTeamsActorPage(actor) {
        if (!teamsSpec) throw new Error("F04_TEAMS_ACTOR_PAGE_REQUIRES_TEAMS_SPEC")
        const context = await admittedContext(session, actor)
        const actorPage = await context.newPage()
        owned.add(actorPage)
        return actorPage
      },
      async revokeSelectedTeam(capabilityId, principalRef) {
        if (!selection || selection.caseId !== "revoked" ||
            nativeSuiteCases[selection.bundle.suite].capabilityId !== capabilityId ||
            principalRef !== manifest.actors[selection.actor])
          throw new Error("F04_REVOCATION_ONLY_FOR_REGISTERED_BUDGET_CASE")
        requireIsolatedNativeRevocation(session.manifest, selection.bundle.selections)
        const context = await admittedContext(session, "dashboardAdmin", manifest.target)
        const admin = context.pages().find((candidate) => {
          try { return new URL(candidate.url()).origin === manifest.target.shellOrigin }
          catch { return false }
        })
        if (!admin) throw new Error("F04_REVOCATION_ADMIN_SHELL_PAGE_REQUIRED")
        return revokeNativeTeam({ page, admin, manifest, capabilityId, principalRef })
      },
      async openSecondEditor(capabilityId, year) {
        if (!selection || selection.caseId !== "stale" ||
            nativeSuiteCases[selection.bundle.suite].capabilityId !== capabilityId)
          throw new Error("F04_SECOND_EDITOR_ONLY_FOR_REGISTERED_STALE_CASE")
        for (const actor of ["requester", "holder", "dashboardAdmin"] as const) {
          const context = session.contexts[actor]
          if (!context || context === page.context()) continue
          const shell = context.pages().find((candidate) => {
            try { return new URL(candidate.url()).origin === manifest.target.shellOrigin }
            catch { return false }
          })
          if (!shell) continue
          try {
            const current = await requireNativeJourney({
              page: shell, manifest, actor, capabilityId, intent: "edit", year,
            })
            await requireOriginalNativeOperations({
              page: shell, manifest, capabilityId, intent: "edit",
              principalRef: current.principalRef, policyVersion: current.policyVersion,
              accessRevision: current.accessRevision,
            })
          } catch { continue }
          return context.newPage()
        }
        throw new Error("F04_DISTINCT_ORIGINAL_SECOND_EDITOR_NOT_ADMITTED")
      },
      desktop: "NOT_RUN_D01_REAL_ELECTRON_REQUIRED",
      componentFixture: "NOT_INSTALLED_PROOF",
    }) } finally {
      await Promise.all([...owned].map((actorPage) => actorPage.close()))
    }
  },
})
