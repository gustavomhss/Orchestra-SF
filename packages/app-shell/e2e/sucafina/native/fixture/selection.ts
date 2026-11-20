import inventory from "../../../../../../sf/ci/team-profile-native-cases.json" with { type: "json" }
import type { NativeActor } from "./manifest-contract.ts"
import type { NativeInstalledCase, NativeInstalledSuite } from "./selected-installation.ts"

const suiteRoles = { U15: "u15", U39: "u39", U40: "u40" } as const

export function nativeTeamsSpecSelected(file: string) {
  const name = file.replaceAll("\\", "/")
  const spec = inventory.roles.teams.specFile
  return name === spec || name.endsWith("/" + spec)
}

export function nativeIsolationActor(file: string, title: string): NativeActor | undefined {
  const spec = "e2e/sucafina/native/isolation.spec.ts"
  const name = file.replaceAll("\\", "/")
  if (name !== spec && !name.endsWith("/" + spec)) return undefined
  return (["requester", "holder", "denied"] as const).find((actor) =>
    title === `Q01-ISO-REAL-ACTOR-${actor} must be an authentic principal`)
}

export function nativeSuiteRole(suite: NativeInstalledSuite) {
  return suiteRoles[suite]
}

export function nativeSuiteForSpec(file: string): NativeInstalledSuite | undefined {
  const name = file.replaceAll("\\", "/")
  return (Object.keys(suiteRoles) as NativeInstalledSuite[]).find((suite) => {
    const spec = inventory.roles[suiteRoles[suite]].specFile
    return name === spec || name.endsWith("/" + spec)
  })
}

/** Selection predicate only. A matching filename does NOT start an installed host,
 * collect a spec, or prove a real session. I00 owns shared Playwright registration.
 */
export function nativeSpecSelected(args: readonly string[]): boolean {
  if (args.some((argument) => argument === "--list" || argument.startsWith("--list="))) return false
  return args.some((argument) => {
    // Playwright receives literal paths, escaped CLI regex paths, and Windows paths.
    const normalized = argument.replace(/\\([./])/g, "$1").replaceAll("\\", "/")
    return /(?:^|\/)e2e\/sucafina\/native\/(?!fixture\/)(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.spec\.ts(?::\d+(?::\d+)?)?\$?$/.test(normalized)
  })
}

function fixtureCase(value: string): NativeInstalledCase {
  switch (value) {
    case "edit": return "editable"
    case "list": case "editable": case "denied": case "stale": case "lost":
    case "entry": case "empty": case "source": case "readonly": case "revoked": case "late": return value
    default: throw new Error("F04_SOURCE_CASE_INVENTORY_INVALID")
  }
}
/** Exact source-versioned titles, never a prefix or a default actor selection. */
export function nativeInventoryCases(suite: NativeInstalledSuite) {
  const role = nativeSuiteRole(suite)
  const cases = inventory.roles[role].cases
  if (cases.length !== (suite === "U15" ? 6 : 22) ||
      new Set(cases.map((entry) => entry.id)).size !== cases.length ||
      new Set(cases.map((entry) => entry.title)).size !== cases.length ||
      cases.some((entry, index) => entry.id !== role + "-" + String(index + 1).padStart(2, "0")))
    throw new Error("F04_SOURCE_CASE_INVENTORY_INVALID")
  return cases.map((entry) => ({ id: entry.id, title: entry.title, caseId: fixtureCase(entry.fixtureCase) }))
}
export function nativeCaseIdentity(suite: NativeInstalledSuite, title: string) {
  const matches = nativeInventoryCases(suite).filter((entry) => entry.title === title)
  if (matches.length !== 1) throw new Error("F04_UNKNOWN_REAL_TEST_SELECTION_TITLE")
  return matches[0]!
}
export function nativeSelectedCase(suite: NativeInstalledSuite, title: string): NativeInstalledCase {
  return nativeCaseIdentity(suite, title).caseId
}
