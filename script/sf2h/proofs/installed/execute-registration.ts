/** Invoke only the original installed-host adapter. No callbacks/modules/shell environment are loaded from a file. */
import path from "node:path"
import { fileURLToPath } from "node:url"
import { digest, privateText } from "../../../sf-ci/g08-private-evidence.mjs"
import { createOriginalInstalledHost } from "./host-adapter.ts"
import type { RegistrationKind } from "./host-adapter.ts"
import { registerInstalledProofFromHost } from "./register.ts"
import { attachHostedNativeBrowser, disconnectNativeBrowser } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/installed-browser.ts"
import { registerG08NativeInstalledManifest, writeNativePrivate } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/installed-manifest.ts"
import { readG08NativeManifest } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/g08-readiness.ts"
import { readNativeInstalledHost } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/installed-host.ts"
import { readNativeSelectedInstallation, u15RegisteredEnvironment } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts"

function need(value: unknown, reason: string): asserts value { if (!value) throw new Error(reason) }
export function parseRegistrationArguments(args: readonly string[]): RegistrationKind {
  if (args.length !== 1 || args[0] !== "U15" && args[0] !== "U39" && args[0] !== "U40" && args[0] !== "F04")
    throw new Error("G08_NATIVE_ONE_REGISTRATION_KIND_REQUIRED")
  return args[0]
}
/** The wrapper may parse this JSON and use these exact values; never source or eval it. */
export function validateU15RegisteredEnvironment(value: unknown, selected: Parameters<typeof u15RegisteredEnvironment>[0]) {
  const expected = u15RegisteredEnvironment(selected)
  need(value && typeof value === "object" && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype, "G08_NATIVE_CLOSED_RUNNER_ENV_REQUIRED")
  const actual = Object.entries(value)
  need(actual.length === Object.keys(expected).length &&
    actual.every(([key, href]) => Object.hasOwn(expected, key) && expected[key] === href),
    "G08_NATIVE_ORIGINAL_U15_URLS_REQUIRED")
  return expected
}
export async function executeRegistration(kind: RegistrationKind, scratchRoot: string) {
  need(process.env.SF_G08_PRIVATE_ROOT === scratchRoot && path.resolve(scratchRoot) === scratchRoot &&
    process.env.SF_NATIVE_INSTALLED_MANIFEST === path.join(scratchRoot, "native-installed-manifest.json"),
    "G08_NATIVE_PRIVATE_ROOT_AND_MANIFEST_BINDING_REQUIRED")
  const adapter = await createOriginalInstalledHost(scratchRoot, kind)
  const installed = adapter.installed
  need(process.env.SF_NATIVE_CANDIDATE_SHA === installed.plan.candidate.sha &&
    process.env.SF_NATIVE_INVOCATION_ID === installed.plan.invocation.id, "G08_NATIVE_RUN_ENV_MISMATCH")
  let selectedCount = 0, ownedPagesClosed = 0
  const files: Array<{ path: string; sha256: string }> = []
  if (kind === "F04") {
    const archive = installed.receipt.archive
    need(archive && typeof archive === "object" && "sha256" in archive && typeof archive.sha256 === "string",
      "G08_NATIVE_ORIGINAL_TAR_REQUIRED")
    const browser = await attachHostedNativeBrowser(scratchRoot)
    try {
      const actors = await adapter.host.liveMicrosoftActorPages(browser)
      await registerG08NativeInstalledManifest({ scratchRoot, candidateSha: installed.plan.candidate.sha,
        invocation: { treeSha: installed.plan.candidate.tree, runId: installed.plan.invocation.runId,
          runAttempt: installed.plan.invocation.runAttempt, role: "teams",
          invocationId: installed.plan.invocation.id, archiveSha256: archive.sha256 },
        target: adapter.host.target, wrongTeam: adapter.host.wrongTeam, wrongInstallation: adapter.host.wrongInstallation,
        actors, resolveApprovedConnection: adapter.host.resolveApprovedConnection })
    } finally {
      try { adapter.confirmOriginalContexts() }
      finally {
        await disconnectNativeBrowser(browser)
        need(!browser.isConnected(), "G08_NATIVE_CDP_CLIENT_NOT_DISCONNECTED")
      }
    }
  } else {
    const registration = await registerInstalledProofFromHost({
      suite: kind, scratchRoot, candidateSha: installed.plan.candidate.sha, host: adapter.host,
    })
    selectedCount = registration.selectedCount
    ownedPagesClosed = registration.cleanup.ownPagesClosed
    const manifest = await readG08NativeManifest()
    const selected = await readNativeSelectedInstallation(manifest, kind)
    files.push({ path: path.basename(registration.selectedPath),
      sha256: digest(await privateText(scratchRoot, path.basename(registration.selectedPath), 524288)) })
    if (kind === "U15") {
      const environment = validateU15RegisteredEnvironment(registration.privateRunnerEnvironment, selected)
      await writeNativePrivate(scratchRoot, "native-runner-environment.json", environment)
      files.push({ path: "native-runner-environment.json",
        sha256: digest(await privateText(scratchRoot, "native-runner-environment.json", 65536)) })
    }
  }
  need(adapter.disconnected(), "G08_NATIVE_REGISTRATION_STILL_CONNECTED")
  const current = await readNativeInstalledHost(scratchRoot)
  need(current.planSha256 === installed.planSha256 && current.packageSha256 === installed.packageSha256 &&
    current.hostSha256 === installed.hostSha256, "G08_NATIVE_HOST_CHANGED_DURING_REGISTRATION")
  const observation = adapter.observation()
  await writeNativePrivate(scratchRoot, "native-registration-observations.json", observation)
  const manifest = await readG08NativeManifest()
  for (const name of ["native-installed-manifest.json", "native-context-observations.json", "native-registration-observations.json"])
    files.push({ path: name, sha256: digest(await privateText(scratchRoot, name, 4_000_000)) })
  const receipt = {
    schema: "sf-g08-native-registration-v1", status: "REGISTERED_ONLY_NOT_EXECUTED",
    source: installed.plan.candidate, invocation: manifest.invocation, kind, manifestSchema: manifest.schema,
    selectedCount, connectionSource: "SfTrustedInstallationSource.current",
    bindings: { planSha256: installed.planSha256, packageReceiptSha256: installed.packageSha256,
      hostBeforeSha256: installed.hostSha256, actorsReferenceSha256: installed.actorsReferenceSha256,
      reservationSha256: digest(JSON.stringify(installed.plan.reservation)) },
    files, cleanup: { completed: true, ownPagesClosed: ownedPagesClosed, originalPagesPreserved: true, clientDisconnected: true },
    installed: false, liveQualified: false, g08Closed: false, finalCandidate: false, productionCutover: false,
    limits: ["Actual registration prerequisites only; no journey body or F04 has executed.",
      "The original process exit, reports, host-after and independent workflow provenance remain required.",
      "This G08 manifest has no foreign-server assertion; the strict historical v2 remains separate."],
  }
  await writeNativePrivate(scratchRoot, "native-registration.json", receipt)
  return receipt
}
async function main() {
  const kind = parseRegistrationArguments(process.argv.slice(2)), root = process.env.SF_G08_PRIVATE_ROOT
  need(root, "G08_NATIVE_PRIVATE_ROOT_REQUIRED")
  await executeRegistration(kind, root)
  console.log("G08 native registration prepared; installed execution and independent chain remain required")
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message.match(/(?:G08_NATIVE|F04)_[A-Z0-9_]+/)?.[0] : undefined
    console.error(message ?? "G08_NATIVE_REGISTRATION_REFUSED")
    process.exitCode = 1
  })
