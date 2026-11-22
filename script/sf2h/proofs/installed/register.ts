/** Host-only registration: actual existing contexts, original F01/F02 and source rows. No LIVE receipt. */
import { lstat, unlink } from "node:fs/promises"
import path from "node:path"
import type { Browser, Page } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/installed-browser.ts"
import type { SfResolvedRoute } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts"
import { privateText } from "../../../sf-ci/g08-private-evidence.mjs"
import { attachHostedNativeBrowser, disconnectNativeBrowser, prepareNativePage } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/installed-browser.ts"
import { registerNativeInstalledManifest } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/installed-manifest.ts"
import type { NativeInstalledRegistration } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/installed-manifest.ts"
import { nativeCaseIntent, nativeRole, nativeSuiteCases, nativeSuiteCapability } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/case-contract.ts"
import { requireNativeJourney } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/journeys.ts"
import { registerNativeSelectedInstallation, readNativeSelectedInstallation, nativeManifestForTarget,
  readOriginalNativeSource, requireOriginalNativeOperations, u15RegisteredEnvironment } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts"
import type { NativeInstalledCase, NativeInstalledSuite, NativeSelectionInput } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts"
import { observeNativeBinding, readNativeManifest } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/readiness.ts"
import type { NativeActor, NativeManifest, NativeTarget } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/manifest-contract.ts"
import { nativeTargetInReservation, readNativeInstalledHost } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/installed-host.ts"

type LiveActors = NativeInstalledRegistration["actors"]
export type ApprovedInstalledHost = Readonly<{
  target: NativeTarget; teamB: NativeTarget; wrongServer: NativeTarget; wrongTeam: NativeTarget; wrongInstallation: NativeTarget
  resolveApprovedConnection: NativeInstalledRegistration["resolveApprovedConnection"]
  liveMicrosoftActorPages(browser: Browser): Promise<LiveActors>
  /** Must invoke the original F01/UI. The consumer independently resolves and observes its result. */
  resolveOriginalF01Route(input: Readonly<{
    page: Page; target: NativeTarget; capabilityId: "CAP14" | "CAP04" | "CAP05"; caseId: NativeInstalledCase
  }>): Promise<SfResolvedRoute>
  /** Return an ID currently present in the original producer and UI, never seed or filter the dataset. */
  originalSourceRowId(input: Readonly<{
    page: Page; target: NativeTarget; capabilityId: "CAP14" | "CAP04" | "CAP05"; caseId: NativeInstalledCase; route: SfResolvedRoute
  }>): Promise<string>
}>
async function selectActor(manifest: NativeManifest, pages: LiveActors, suite: NativeInstalledSuite, caseId: NativeInstalledCase) {
  const capabilityId = nativeSuiteCapability[suite], intent = nativeCaseIntent(caseId)
  const candidates: readonly NativeActor[] = caseId === "denied" ? ["denied"] :
    suite === "U15" ? ["requester"] : ["dashboardAdmin", "holder", "requester"]
  for (const actor of candidates) {
    const page = pages[actor]
    const context = await observeNativeBinding(page, manifest.target)
    if (context.stamp.principalRef !== manifest.actors[actor]) throw new Error("F04_ORIGINAL_ACTOR_CHANGED")
    const grant = context.destinations.find((entry) => entry.capabilityId === capabilityId)
    if (intent === "denied" ? grant?.canRead : !grant?.canRead ||
      intent === "edit" && !grant.allowedActionIds.includes("save") ||
      caseId === "readonly" && grant.allowedActionIds.length !== 0) continue
    const admitted = await requireNativeJourney({ page, manifest, actor, capabilityId, intent,
      ...(suite === "U15" ? {} : { year: 2026 }) })
    await requireOriginalNativeOperations({ page, manifest, ...admitted, intent })
    if (caseId === "source" && !context.destinations.some((entry) => entry.capabilityId === "CAP03" && entry.canRead))
      throw new Error("F04_ORIGINAL_CAP03_SOURCE_LINK_NOT_AVAILABLE")
    return { actor, page }
  }
  throw new Error("F04_REQUIRED_ORIGINAL_CASE_AUTHORITY_NOT_AVAILABLE")
}
export async function registerInstalledProofFromHost(input: Readonly<{
  suite: NativeInstalledSuite; scratchRoot: string; candidateSha: string; host: ApprovedInstalledHost
}>) {
  const installed = await readNativeInstalledHost(input.scratchRoot)
  if (input.candidateSha !== installed.plan.candidate.sha) throw new Error("F04_ORIGINAL_CANDIDATE_REQUIRED")
  nativeTargetInReservation(installed, input.host.target)
  nativeTargetInReservation(installed, input.host.teamB)
  if (input.host.target.teamObjectId === input.host.teamB.teamObjectId ||
    input.host.wrongTeam.teamObjectId !== input.host.teamB.teamObjectId)
    throw new Error("F04_EMPTY_TEAM_B_AND_NEGATIVE_BOUNDARY_MUST_BE_RESERVED")
  const archive = installed.receipt.archive
  if (!archive || typeof archive !== "object" || !("sha256" in archive) || typeof archive.sha256 !== "string")
    throw new Error("F04_ORIGINAL_TAR_DIGEST_REQUIRED")
  const invocation = { treeSha: installed.plan.candidate.tree, runId: installed.plan.invocation.runId,
    runAttempt: installed.plan.invocation.runAttempt, role: nativeRole(input.suite),
    invocationId: installed.plan.invocation.id, archiveSha256: archive.sha256 }
  const browser = await attachHostedNativeBrowser(input.scratchRoot)
  const owned: Page[] = [], published: Array<{ file: string; bytes: string }> = []
  try {
    const pages = await input.host.liveMicrosoftActorPages(browser)
    const registration = await registerNativeInstalledManifest({ scratchRoot: input.scratchRoot, candidateSha: input.candidateSha,
      invocation, target: input.host.target, wrongServer: input.host.wrongServer,
      wrongTeam: input.host.wrongTeam, wrongInstallation: input.host.wrongInstallation,
      actors: pages, resolveApprovedConnection: input.host.resolveApprovedConnection })
    for (const file of [registration.path, path.join(input.scratchRoot, "native-context-observations.json")])
      published.push({ file, bytes: await privateText(input.scratchRoot, path.basename(file), 4_000_000) })
    const manifest = await readNativeManifest()
    const definitions: NativeSelectionInput[] = []
    for (const caseId of nativeSuiteCases[input.suite]) {
      const target = caseId === "empty" ? input.host.teamB : input.host.target
      const selectedManifest = nativeManifestForTarget(manifest, target)
      const selected = await selectActor(selectedManifest, pages, input.suite, caseId)
      const page = await selected.page.context().newPage()
      owned.push(page)
      await prepareNativePage(page)
      await page.goto(new URL(target.chapterHref, target.shellOrigin).href)
      let routePage = page
      if (caseId === "denied") {
        const admitted = await selectActor(selectedManifest, pages, input.suite, input.suite === "U15" ? "list" : "source")
        routePage = await admitted.page.context().newPage()
        owned.push(routePage)
        await prepareNativePage(routePage)
        await routePage.goto(new URL(target.chapterHref, target.shellOrigin).href)
      }
      const capabilityId = nativeSuiteCapability[input.suite]
      const route = await input.host.resolveOriginalF01Route({ page: routePage, target, capabilityId, caseId })
      const sourceRecordId = caseId === "denied" || caseId === "empty" ? undefined :
        await input.host.originalSourceRowId({ page, target, capabilityId, caseId, route })
      if (caseId === "stale") {
        const first = await readOriginalNativeSource({ page, manifest: selectedManifest, capabilityId, recordId: sourceRecordId! })
        let second = false
        for (const actor of ["holder", "dashboardAdmin", "requester"] as const) {
          if (actor === selected.actor) continue
          const live = await observeNativeBinding(pages[actor], target)
          const grant = live.destinations.find((entry) => entry.capabilityId === capabilityId)
          if (!grant?.canRead || !grant.allowedActionIds.includes("save")) continue
          const current = await requireNativeJourney({ page: pages[actor], manifest: selectedManifest, actor, capabilityId,
            intent: "edit", ...(input.suite === "U15" ? {} : { year: 2026 }) })
          await requireOriginalNativeOperations({ page: pages[actor], manifest: selectedManifest, ...current, intent: "edit" })
          const other = await readOriginalNativeSource({ page: pages[actor], manifest: selectedManifest, capabilityId, recordId: first.recordId })
          if (other.version !== first.version || pages[actor].context() === page.context())
            throw new Error("F04_DISTINCT_SECOND_WRITER_SOURCE_MISMATCH")
          second = true
          break
        }
        if (!second) throw new Error("F04_SECOND_ORIGINAL_WRITER_NOT_ADMITTED")
      }
      definitions.push({ caseId, actor: selected.actor, target, page, routePage, route,
        ...(sourceRecordId === undefined ? {} : { sourceRecordId }) })
    }
    const selected = await registerNativeSelectedInstallation({ manifest, browser, suite: input.suite, selections: definitions })
    published.push({ file: selected.file, bytes: await privateText(input.scratchRoot, path.basename(selected.file), 524288) })
    const consumed = await readNativeSelectedInstallation(manifest, input.suite)
    return { manifestPath: registration.path, selectedPath: selected.file, candidateSha: manifest.candidateSha,
      suite: input.suite, selectedCount: consumed.selections.length,
      privateRunnerEnvironment: input.suite === "U15" ? u15RegisteredEnvironment(consumed) : {},
      proofClass: "REGISTERED_ONLY_NOT_EXECUTED" as const, installed: false, liveQualified: false }
  } catch (error) {
    // Only files created by this call, and only while their private original bytes remain unchanged.
    for (const entry of published.reverse()) {
      if (await privateText(input.scratchRoot, path.basename(entry.file), 4_000_000) !== entry.bytes)
        throw new Error("F04_FAILED_REGISTRATION_CLEANUP_OWNERSHIP_CHANGED")
      await unlink(entry.file)
      try { await lstat(entry.file); throw new Error("F04_FAILED_REGISTRATION_FILE_REMAINS") }
      catch (missing) { if (!(missing instanceof Error && "code" in missing && missing.code === "ENOENT")) throw missing }
    }
    throw error
  } finally {
    for (const page of owned) { await page.close(); if (!page.isClosed()) throw new Error("F04_REGISTRATION_PAGE_NOT_CLOSED") }
    await disconnectNativeBrowser(browser)
  }
}
