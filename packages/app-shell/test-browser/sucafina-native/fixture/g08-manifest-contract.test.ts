/** Schema/private-file controls only. No fixture metadata is an installed qualification. */
import { expect, test } from "bun:test"
import path from "node:path"
import { tmpdir } from "node:os"
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises"
import { validateNativeManifest, validateNativeTarget, serializeNativeManifest } from "../../../e2e/sucafina/native/fixture/manifest-contract.ts"
import { validateG08NativeManifest, validateInstalledNativeManifest, serializeInstalledNativeManifest } from "../../../e2e/sucafina/native/fixture/g08-manifest-contract.ts"
import { readG08NativeManifest } from "../../../e2e/sucafina/native/fixture/g08-readiness.ts"

const actors = { requester: "33333333-3333-4333-8333-333333333333", holder: "44444444-4444-4444-8444-444444444444",
  denied: "55555555-5555-4555-8555-555555555555", dashboardAdmin: "66666666-6666-4666-8666-666666666666" }
function target(extra: Record<string, string> = {}) {
  const value = { serverKey: "https://native.example.test", discoveryOrigin: "https://native.example.test",
    shellOrigin: "https://native.example.test", publicOrigin: "https://native.example.test", installationId: "metadata-only",
    tenantId: "11111111-1111-4111-8111-111111111111", teamObjectId: "22222222-2222-4222-8222-222222222222",
    projectId: "technical-only", hostId: "host-only", mount: "/sucafina", ...extra }
  const query = new URLSearchParams({ contractRevision: "sf-team-profile/1", server: value.serverKey,
    installationId: value.installationId, tenantId: value.tenantId, teamObjectId: value.teamObjectId })
  return validateNativeTarget({ ...value, chapterHref: "/orchestra/sf-procurement/contracts?" + query })
}
function legacy() {
  return validateNativeManifest({ schema: "sf2h.native-installed-manifest.v2", candidateSha: "a".repeat(40),
    invocation: { treeSha: "b".repeat(40), runId: "1", runAttempt: "1", role: "u15",
      invocationId: "c".repeat(32), archiveSha256: "d".repeat(64) }, target: target(),
    wrongTeam: target({ teamObjectId: "77777777-7777-4777-8777-777777777777" }),
    wrongInstallation: target({ installationId: "foreign-metadata" }),
    wrongServer: target({ serverKey: "https://other.example.test", publicOrigin: "https://other.example.test",
      discoveryOrigin: "https://other.example.test", installationId: "foreign-server-metadata" }),
    actors, scratchRoot: "/tmp/metadata-only-not-installed" })
}
function g08() {
  const { wrongServer: unused, ...original } = legacy()
  void unused
  return validateG08NativeManifest({ ...original, schema: "sf-g08-native-installed-v1" })
}
test("dedicated G08 carries only used boundaries while historical v2 round-trips unchanged", () => {
  expect(serializeInstalledNativeManifest(legacy())).toBe(serializeNativeManifest(legacy()))
  expect(validateInstalledNativeManifest(g08())).toEqual(g08())
  expect(Object.hasOwn(g08(), "wrongServer")).toBe(false)
  expect(g08().actors).toEqual(actors)
  expect(legacy().actors).toEqual(actors)
  expect(g08().invocation).toEqual(legacy().invocation)
})
test("missing foreign server cannot silently turn a historical v2 into G08", () => {
  const { wrongServer: unused, ...incomplete } = legacy()
  void unused
  expect(() => validateNativeManifest(incomplete)).toThrow()
  expect(() => validateInstalledNativeManifest(incomplete)).toThrow()
  expect(() => validateInstalledNativeManifest({ ...g08(), schema: "sf2h.native-installed-manifest.v2" })).toThrow()
  expect(() => validateG08NativeManifest({ ...g08(), wrongServer: legacy().wrongServer })).toThrow()
})
for (const mutation of ["same-team", "same-installation", "other-endpoint", "other-tenant",
  "missing-admin", "duplicate-principal", "missing-run", "unknown-schema"] as const) {
  test("G08 additive manifest refuses " + mutation, () => {
    const value: Record<string, unknown> = { ...g08() }
    if (mutation === "same-team") value.wrongTeam = g08().target
    if (mutation === "same-installation") value.wrongInstallation = g08().target
    if (mutation === "other-endpoint") value.wrongTeam = target({ publicOrigin: "https://other.example.test",
      serverKey: "https://other.example.test", discoveryOrigin: "https://other.example.test", shellOrigin: "https://other.example.test",
      teamObjectId: "77777777-7777-4777-8777-777777777777" })
    if (mutation === "other-tenant") value.wrongTeam = target({ tenantId: "88888888-8888-4888-8888-888888888888",
      teamObjectId: "77777777-7777-4777-8777-777777777777" })
    if (mutation === "missing-admin") value.actors = { requester: actors.requester, holder: actors.holder, denied: actors.denied }
    if (mutation === "duplicate-principal") value.actors = { ...actors, holder: actors.requester }
    if (mutation === "missing-run") value.invocation = { ...g08().invocation, runId: "" }
    if (mutation === "unknown-schema") value.schema = "sf-g08-native-installed-v2"
    expect(() => validateInstalledNativeManifest(value)).toThrow()
  })
}
test("G08 private reader accepts canonical explicit schemas and rejects duplicate keys and stale invocation", async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "g08-manifest-")))
  const file = path.join(root, "native-installed-manifest.json")
  const environment = { GITHUB_ACTIONS: "true", CI: "true", SF_NATIVE_INSTALLED_MANIFEST: file,
    SF_NATIVE_CANDIDATE_SHA: "a".repeat(40), GITHUB_RUN_ID: "1", GITHUB_RUN_ATTEMPT: "1", SF_NATIVE_INVOCATION_ID: "c".repeat(32) }
  const saved = Object.fromEntries(Object.keys(environment).map((key) => [key, process.env[key]]))
  try {
    Object.assign(process.env, environment)
    for (const metadata of [g08(), legacy()]) {
      const value = { ...metadata, scratchRoot: root }
      const raw = serializeInstalledNativeManifest(value)
      await writeFile(file, raw, { mode: 0o600 })
      expect(await readG08NativeManifest()).toEqual(value)
      await writeFile(file, raw.replace('{"schema":', '{"candidateSha":"' + "f".repeat(40) + '","schema":'), { mode: 0o600 })
      await expect(readG08NativeManifest()).rejects.toThrow("WRITER_CONTRACT")
      await writeFile(file, raw, { mode: 0o600 })
      process.env.SF_NATIVE_INVOCATION_ID = "9".repeat(32)
      await expect(readG08NativeManifest()).rejects.toThrow("RUNNER")
      process.env.SF_NATIVE_INVOCATION_ID = environment.SF_NATIVE_INVOCATION_ID
    }
  } finally {
    for (const [key, value] of Object.entries(saved)) if (value === undefined) delete process.env[key]; else process.env[key] = value
    await rm(root, { recursive: true, force: true })
  }
})
