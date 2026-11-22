/** Recheck all original case selections. This is prerequisite inspection, never an installed journey PASS. */
import { admittedContext, connectNativeInstalledBrowser, prepareNativePage } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/installed-browser.ts"
import { consumeCurrentNativeSelection, nativeManifestForTarget, readNativeSelectedInstallation,
  u15RegisteredEnvironment } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts"
import type { NativeInstalledSuite } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts"
import type { NativeActor } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/manifest-contract.ts"

export async function consumeInstalledSuiteFromHost(suite: NativeInstalledSuite) {
  const attached = await connectNativeInstalledBrowser()
  try {
    const { manifest } = attached
    const bundle = await readNativeSelectedInstallation(manifest, suite)
    const observedCases: Array<{ caseId: string; actor: string; teamObjectId: string; sourceVersionAdvanced: boolean }> = []
    for (const selected of bundle.selections) {
      const owner = nativeManifestForTarget(manifest, selected.target)
      const context = await admittedContext(attached, selected.actor, owner)
      const page = await context.newPage()
      let routePage = page
      try {
        await prepareNativePage(page)
        await page.goto(selected.href)
        if (selected.caseId === "denied") {
          const observer = (Object.keys(manifest.actors) as NativeActor[]).find((actor) =>
            manifest.actors[actor] === selected.routePrincipalRef && actor !== selected.actor)
          if (!observer) throw new Error("F04_ORIGINAL_ROUTE_OBSERVER_REQUIRED")
          routePage = await (await admittedContext(attached, observer, owner)).newPage()
          await prepareNativePage(routePage)
          await routePage.goto(selected.href)
        }
        const result = await consumeCurrentNativeSelection({ page, routePage, manifest, bundle, caseId: selected.caseId })
        observedCases.push({ caseId: result.caseId, actor: result.actor, teamObjectId: result.manifest.target.teamObjectId,
          sourceVersionAdvanced: result.sourceVersionAdvancedSinceRegistration })
      } finally {
        if (routePage !== page) await routePage.close()
        await page.close()
        if (!routePage.isClosed() || !page.isClosed()) throw new Error("F04_CONSUMER_OWNED_PAGE_REMAINS")
      }
    }
    return { suite, candidateSha: manifest.candidateSha, invocation: manifest.invocation, cases: observedCases,
      total: observedCases.length, privateRunnerEnvironment: suite === "U15" ? u15RegisteredEnvironment(bundle) : {},
      proofClass: "REVALIDATED_PREREQUISITES_NOT_UI_PASS" as const, installed: false, liveQualified: false }
  } finally { await attached.disconnect() }
}
