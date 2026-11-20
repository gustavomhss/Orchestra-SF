/** Hosted F04 consumer for 194/195. Observes the ORIGINAL live producer
 * through already-authenticated Microsoft BrowserContexts, never granting a
 * role, creating a context, or claiming a UI scenario PASS. Real Playwright
 * journeys remain the only evidence of the requested UI behavior.
 */
import type { Page } from "@playwright/test"
import {
  admittedContext, connectNativeInstalledBrowser,
} from "../../../../packages/app-shell/e2e/sucafina/native/fixture/installed-browser.ts"
import {
  consumeCurrentNativeSelection, nativeManifestForCase, readNativeSelectedInstallation,
  u15RegisteredEnvironment,
} from "../../../../packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts"
import { nativeSuiteRole } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/selection.ts"
import type {
  NativeInstalledSuite,
} from "../../../../packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts"

function shellPage(pages: readonly Page[], origin: string): Page {
  const matches = pages.filter((page) => {
    try { return new URL(page.url()).origin === origin }
    catch { return false }
  })
  if (matches.length !== 1)
    throw new Error("F04_REQUIRED_SINGLE_ORIGINAL_ACTOR_SHELL_PAGE")
  return matches[0]!
}

export async function consumeInstalledSuiteFromHost(suite: NativeInstalledSuite) {
  if (process.env.GITHUB_ACTIONS !== "true")
    throw new Error("F04_HOSTED_ACTIONS_ONLY")
  const attached = await connectNativeInstalledBrowser()
  try {
    const { manifest } = attached
    if (manifest.invocation.role !== nativeSuiteRole(suite))
      throw new Error("F04_NATIVE_SPEC_NOT_BOUND_TO_INVOCATION")
    const bundle = await readNativeSelectedInstallation(manifest, suite)
    const cases: string[] = []
    const advanced: string[] = []
    for (const selection of bundle.selections) {
      const { target } = nativeManifestForCase(manifest, selection)
      const actor = await admittedContext(attached, selection.actor, target)
      const page = shellPage(actor.pages(), target.shellOrigin)
      const observed = await consumeCurrentNativeSelection({
        page, manifest, bundle, caseId: selection.caseId,
      })
      if (observed.actor !== selection.actor ||
          observed.href !== selection.href ||
          observed.current.principalRef !== manifest.actors[selection.actor])
        throw new Error("F04_SELECTED_ACTOR_OR_ROUTE_REBOUND_DURING_CONSUMPTION")
      cases.push(selection.caseId)
      if (observed.sourceVersionAdvancedSinceRegistration)
        advanced.push(selection.caseId)
    }
    return {
      suite, candidateSha: manifest.candidateSha, cases,
      total: cases.length, versionsAdvanced: advanced,
      /** Pass directly into private 191 runner env, never into log/artifact. */
      privateRunnerEnvironment: suite === "U15" ? u15RegisteredEnvironment(bundle) : {},
      proofClass: "REVALIDATED_PREREQUISITES_NOT_UI_PASS" as const,
    }
  } finally {
    await attached.disconnect()
  }
}
