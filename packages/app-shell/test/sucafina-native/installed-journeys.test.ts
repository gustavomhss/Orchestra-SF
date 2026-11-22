import { closeNativeOwnedPages } from "../../e2e/sucafina/native/fixture/installed-browser.ts"
/** Controls of selection/private evidence boundaries only. DTOs below never authenticate a browser or qualify LIVE. */
import { expect, test } from "bun:test"
import { chmod, link, lstat, mkdtemp, readFile, realpath, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Schema } from "effect"
import { SfTeamContext, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { digest, privateText } from "../../../../script/sf-ci/g08-private-evidence.mjs"
import { nativeCaseIntent, nativeRole, nativeSelectedCase, nativeSuiteCases, nativeTitles } from "../../e2e/sucafina/native/fixture/case-contract.ts"
import { nativeManifestForTarget, readNativeSelectedInstallation, validateNativeSelectedInstallation } from "../../e2e/sucafina/native/fixture/selected-installation.ts"
import { nativeTeamRef, validateNativeManifest, validateNativeTarget } from "../../e2e/sucafina/native/fixture/manifest-contract.ts"
import type { NativeActor, NativeTarget } from "../../e2e/sucafina/native/fixture/manifest-contract.ts"
import type { NativeInstalledSuite } from "../../e2e/sucafina/native/fixture/case-contract.ts"
import { writeNativePrivate } from "../../e2e/sucafina/native/fixture/installed-manifest.ts"
import { resolveSfTeamDomainRoute } from "../../src/orchestra/chapters/sucafina/host/team-domain-route"

const actors = { requester: "33333333-3333-4333-8333-333333333333", holder: "44444444-4444-4444-8444-444444444444",
  denied: "55555555-5555-4555-8555-555555555555", dashboardAdmin: "66666666-6666-4666-8666-666666666666" }
function target(suite: NativeInstalledSuite, extra: Partial<Record<keyof NativeTarget, string>> = {}) {
  const base = { serverKey: "https://native.example.test", discoveryOrigin: "https://native.example.test",
    shellOrigin: "https://native.example.test", publicOrigin: "https://native.example.test", installationId: "metadata-only",
    tenantId: "11111111-1111-4111-8111-111111111111", teamObjectId: "22222222-2222-4222-8222-222222222222",
    projectId: "technical-only", hostId: "host-only", mount: "/sucafina", ...extra }
  const query = new URLSearchParams({ contractRevision: "sf-team-profile/1", server: base.serverKey,
    installationId: base.installationId, tenantId: base.tenantId, teamObjectId: base.teamObjectId })
  if (suite !== "U15") query.set("year", "2026")
  return validateNativeTarget({ ...base, chapterHref: "/orchestra/" + (suite === "U15" ? "sf-procurement/contracts" :
    suite === "U39" ? "sf-dashboard/opex" : "sf-dashboard/capex") + "?" + query })
}
function metadata(suite: NativeInstalledSuite) {
  const main = target(suite)
  return validateNativeManifest({ schema: "sf2h.native-installed-manifest.v2", candidateSha: "a".repeat(40),
    invocation: { treeSha: "b".repeat(40), runId: "1", runAttempt: "1", role: nativeRole(suite),
      invocationId: "c".repeat(32), archiveSha256: "d".repeat(64) },
    target: main, wrongTeam: target(suite, { teamObjectId: "77777777-7777-4777-8777-777777777777" }),
    wrongInstallation: target(suite, { installationId: "foreign-metadata" }),
    wrongServer: target(suite, { serverKey: "https://other.example.test", publicOrigin: "https://other.example.test",
      discoveryOrigin: "https://other.example.test", installationId: "foreign-server-metadata" }),
    actors, scratchRoot: "/tmp/metadata-only-not-installed" })
}
function context(owner: NativeTarget, actor: NativeActor) {
  const profile = nativeTeamRef(owner), principal = { tenantId: owner.tenantId, principalObjectId: actors[actor] }
  return Schema.decodeUnknownSync(SfTeamContext)({
    contractRevision: "sf-team-profile/1", authMode: "microsoft",
    stamp: { installationId: owner.installationId, projectId: owner.projectId, hostId: owner.hostId,
      principalRef: actors[actor], policyVersion: "sf-team-profile/1", accessRevision: "e".repeat(64),
      team: { owner: { profile, principal }, revisions: { configRevision: "f".repeat(64), accessRevision: "e".repeat(64) } } },
    profile: { contractRevision: "sf-team-profile/1", status: "authenticated", installationId: owner.installationId,
      principal, accessRevision: "e".repeat(64), administration: { status: "denied" },
      teams: { status: "ready", choices: [{ profile, displayName: "METADATA ONLY" }], selected: profile, configRevision: "f".repeat(64) } },
    destinations: (["CAP14", "CAP04", "CAP05"] as const).map((cap, index) => ({
      capabilityId: cap, surface: "dashboard", page: ["Vendor Contracts", "OPEX Detail", "CAPEX Projects"][index],
      canRead: actor !== "denied", allowedActionIds: actor === "dashboardAdmin" || actor === "denied" ? [] : ["save"],
    })),
    availability: ["CAP14", "CAP04", "CAP05"].map((cap) => ({ family: "domain-read", resource: cap, state: "ready",
      operations: [{ operationId: "domain.page." + cap, state: "ready", reason: null, operational: true }] })),
  })
}
function bundle(suite: NativeInstalledSuite, manifest = metadata(suite)) {
  const collection = suite === "U15" ? "contracts" : suite === "U39" ? "opexOwners" : "capexProjects"
  return { schema: "sf2h.native-selected-installation.v2", suite, candidateSha: manifest.candidateSha,
    invocation: manifest.invocation, manifestSha256: digest(JSON.stringify(manifest)),
    selections: nativeSuiteCases[suite].map((caseId) => {
      const owner = caseId === "empty" ? manifest.wrongTeam : manifest.target
      const actor: NativeActor = caseId === "denied" ? "denied" : caseId === "readonly" ? "dashboardAdmin" : "requester"
      const current = context(owner, actor), observed = actor === "denied" ? context(owner, "requester") : current
      const binding = Schema.decodeUnknownSync(SfTeamInstallationDescriptor)({
        contractRevision: "sf-team-profile/1", authMode: "microsoft", installationId: owner.installationId,
        tenantId: owner.tenantId, projectId: owner.projectId, hostId: owner.hostId,
        publicOrigin: owner.publicOrigin, mount: owner.mount,
      })
      const href = new URL(owner.chapterHref, owner.shellOrigin)
      const route = resolveSfTeamDomainRoute(href, binding, observed)
      if (!route) throw new Error("METADATA_ROUTE_CONTROL_FAILED")
      return { caseId, actor, target: owner, href: href.href, route,
        routePrincipalRef: observed.stamp.principalRef, intent: nativeCaseIntent(caseId), observed: current.stamp,
        source: caseId === "empty" || caseId === "denied" ? null :
          { collection, recordId: "metadata-record", versionKey: collection + ":metadata-record", version: 0 },
        emptyRows: caseId === "empty" ? 0 : null }
    }) }
}
test("closed original inventory preserves all6/22/22 and eight budget selections", () => {
  expect(Object.values(nativeTitles).map((titles) => titles.length)).toEqual([6, 22, 22])
  for (const suite of ["U15", "U39", "U40"] as const) {
    const cases = nativeTitles[suite].map((title) => nativeSelectedCase(suite, title))
    expect(new Set(cases)).toEqual(new Set(nativeSuiteCases[suite]))
    expect(() => nativeSelectedCase(suite, "unregistered")).toThrow()
  }
  expect(nativeCaseIntent("readonly")).toBe("read")
  expect(nativeCaseIntent("empty")).toBe("read")
})
for (const suite of ["U15", "U39", "U40"] as const) test(suite + " closed selection is metadata, not execution or a grant", () => {
  const manifest = metadata(suite), value = bundle(suite, manifest)
  expect(validateNativeSelectedInstallation(manifest, value).selections.length).toBe(suite === "U15" ? 5 : 8)
  expect(Object.hasOwn(value, "installed")).toBe(false)
  expect(Object.hasOwn(value, "liveQualified")).toBe(false)
})
for (const change of ["missing", "duplicate", "unknown", "readonly-edit", "empty-A", "denied-requester", "wrong-principal",
  "mixed-owner-query", "candidate", "run", "tar", "role", "extra-field"] as const)
  test("selected bundle rejects " + change, () => {
    const manifest = metadata("U39")
    const raw = structuredClone(bundle("U39", manifest))
    const value = raw as unknown as Record<string, unknown>
    const rows = raw.selections
    switch (change) {
      case "missing": rows.pop(); break
      case "duplicate": rows[1] = rows[0]!; break
      case "unknown": value.suite = "U99"; break
      case "readonly-edit": rows.find((row) => row.caseId === "readonly")!.intent = "edit"; break
      case "empty-A": rows.find((row) => row.caseId === "empty")!.target = manifest.target; break
      case "denied-requester": rows.find((row) => row.caseId === "denied")!.actor = "requester"; break
      case "wrong-principal": rows[0]!.observed = context(manifest.target, "holder").stamp; break
      case "mixed-owner-query": rows[0]!.route = { ...rows[0]!.route, href: (rows[0]!.route.href + "&projectId=legacy") as typeof rows[0]["route"]["href"] }; break
      case "candidate": value.candidateSha = "9".repeat(40); break
      case "run": value.invocation = { ...manifest.invocation, runId: "2" }; break
      case "tar": value.invocation = { ...manifest.invocation, archiveSha256: "9".repeat(64) }; break
      case "role": value.invocation = { ...manifest.invocation, role: "u40" }; break
      case "extra-field": value.installed = true; break
    }
    expect(() => validateNativeSelectedInstallation(manifest, value)).toThrow()
  })
test("empty swaps the relative negative Team and cannot carry the original Team choice", () => {
  const manifest = metadata("U39"), other = nativeManifestForTarget(manifest, manifest.wrongTeam)
  expect(other.target.teamObjectId).toBe(manifest.wrongTeam.teamObjectId)
  expect(other.wrongTeam.teamObjectId).toBe(manifest.target.teamObjectId)
  expect(other.wrongInstallation.teamObjectId).toBe(other.target.teamObjectId)
  expect(new URL(other.wrongInstallation.chapterHref, other.target.shellOrigin).searchParams.get("teamObjectId")).toBe(other.target.teamObjectId)
  expect(() => nativeManifestForTarget(manifest, target("U39", { hostId: "other-host" }))).toThrow()
})
test("private writer refuses replacement and hard-linked/symlink roots; no false installed read from metadata", async () => {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "native-controls-"))
  await chmod(root, 0o700)
  try {
    const own = await writeNativePrivate(root, "owned.json", { metadataOnly: true })
    expect((await lstat(own.file)).mode & 0o777).toBe(0o600)
    const before = await readFile(own.file, "utf8")
    await expect(writeNativePrivate(root, "owned.json", { replaced: true })).rejects.toThrow()
    expect(await readFile(own.file, "utf8")).toBe(before)
    await link(own.file, path.join(root, "hard.json"))
    await expect(privateText(root, "owned.json")).rejects.toThrow()
    await expect(readNativeSelectedInstallation({ ...metadata("U39"), scratchRoot: root }, "U39")).rejects.toThrow()
    const alias = path.join(root, "alias")
    await symlink(root, alias)
    await expect(writeNativePrivate(alias, "bad.json", {})).rejects.toThrow()
    await chmod(root, 0o755)
    await expect(writeNativePrivate(root, "public.json", {})).rejects.toThrow()
  } finally {
    await rm(root, { recursive: true, force: true })
    await expect(lstat(root)).rejects.toMatchObject({ code: "ENOENT" })
  }
})

test("owned cleanup attempts every page and disconnect after close failure, without a positive receipt", async () => {
  const attempts: string[] = []
  const first = { close: async () => { attempts.push("first"); throw new Error("CONTROLLED_CLOSE_FAILURE") }, isClosed: () => false }
  let secondClosed = false
  const second = { close: async () => { attempts.push("second"); secondClosed = true }, isClosed: () => secondClosed }
  await expect(closeNativeOwnedPages([first, second], async () => { attempts.push("disconnect") }))
    .rejects.toThrow("F04_OWNED_PAGE_CLEANUP_FAILED")
  expect(attempts).toEqual(["first", "second", "disconnect"])
  expect(secondClosed).toBe(true)
  const remains = { close: async () => { attempts.push("remains") }, isClosed: () => false }
  await expect(closeNativeOwnedPages([remains], async () => { attempts.push("disconnect-again") }))
    .rejects.toThrow("F04_OWNED_PAGE_CLEANUP_FAILED")
  expect(attempts.slice(-2)).toEqual(["remains", "disconnect-again"])
})
