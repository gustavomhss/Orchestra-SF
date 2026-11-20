import { describe, expect, test } from "bun:test"
import {
  serializeNativeManifest, validateNativeBoundaries, validateNativeManifest, validateNativeTarget,
} from "../../e2e/sucafina/native/fixture/manifest-contract.ts"
import type { NativeManifest } from "../../e2e/sucafina/native/fixture/manifest-contract.ts"
import { requireIsolatedNativeRevocation } from "../../e2e/sucafina/native/fixture/selected-installation.ts"

const tenantId = "11111111-1111-4111-8111-111111111111"
const teamA = "22222222-2222-4222-8222-222222222222"
const teamB = "33333333-3333-4333-8333-333333333333"
function targetWithChapter<T extends { serverKey: string; installationId: string; tenantId: string; teamObjectId: string }>(target: T) {
  const query = new URLSearchParams({ contractRevision: "sf-team-profile/1", server: target.serverKey,
    installationId: target.installationId, tenantId: target.tenantId, teamObjectId: target.teamObjectId })
  return { ...target, chapterHref: "/orchestra/sf-procurement/contracts?" + query.toString() }
}

// Synthetic metadata only. No actor, host, login, credential or LIVE proof exists.
function manifest(): NativeManifest {
  const target = targetWithChapter({
    serverKey: "https://shell.example.test",
    discoveryOrigin: "https://discovery-a.example.test",
    shellOrigin: "https://shell.example.test",
    publicOrigin: "https://shell.example.test",
    installationId: "contract-only-installation-a",
    tenantId,
    teamObjectId: teamA,
    projectId: "contract-only-project-a",
    hostId: "contract-only-host-a",
    mount: "/sucafina",
  })
  return validateNativeManifest({
    schema: "sf2h.native-installed-manifest.v2",
    candidateSha: "a".repeat(40),
    invocation: { treeSha: "b".repeat(40), runId: "100", runAttempt: "1", role: "u15",
      invocationId: "c".repeat(32), archiveSha256: "d".repeat(64) },
    target,
    wrongServer: targetWithChapter({
      ...target,
      serverKey: "https://sf-b.example.test",
      discoveryOrigin: "https://discovery-b.example.test",
      publicOrigin: "https://sf-b.example.test",
      installationId: "contract-only-installation-b",
      projectId: "contract-only-project-b",
      hostId: "contract-only-host-b",
    }),
    wrongTeam: targetWithChapter({ ...target, teamObjectId: teamB }),
    wrongInstallation: targetWithChapter({ ...target, installationId: "contract-only-installation-b" }),
    actors: {
      requester: "44444444-4444-4444-8444-444444444444",
      holder: "55555555-5555-4555-8555-555555555555",
      denied: "66666666-6666-4666-8666-666666666666",
    },
    scratchRoot: "/private/contract-only-not-created",
  })
}

describe("F04 installed manifest v2 codec (metadata only, no live admission)", () => {
  test("permits revocation only on the invocation's dedicated installation and Team", () => {
    const source = manifest()
    const host = { ...source, actors: { ...source.actors, dashboardAdmin: "77777777-7777-4777-8777-777777777777" } }
    const run = host.invocation.invocationId
    const target = targetWithChapter({ ...host.target, installationId: "disposable-revocation-installation",
      teamObjectId: "88888888-8888-4888-8888-888888888888", mount: "/disposable-revocation" })
    const entry = { caseId: "revoked", actor: "requester", boundaries: { ...host, target } } as const
    expect(() => requireIsolatedNativeRevocation(host, [entry], run)).not.toThrow()
    expect(() => requireIsolatedNativeRevocation(host, [entry], "previous-invocation"))
      .toThrow("F04_DISPOSABLE_REVOCATION_INVOCATION_AND_DISTINCT_ADMIN_REQUIRED")
    expect(() => requireIsolatedNativeRevocation(source, [entry], run))
      .toThrow("F04_DISPOSABLE_REVOCATION_INVOCATION_AND_DISTINCT_ADMIN_REQUIRED")
    expect(() => requireIsolatedNativeRevocation(host, [{ ...entry, actor: "dashboardAdmin" }], run))
      .toThrow("F04_DISPOSABLE_REVOCATION_INVOCATION_AND_DISTINCT_ADMIN_REQUIRED")
    for (const overlap of [{ installationId: host.target.installationId }, { mount: host.target.mount },
      { teamObjectId: host.target.teamObjectId }]) {
      expect(() => requireIsolatedNativeRevocation(host, [{ ...entry, boundaries: { ...entry.boundaries,
        target: targetWithChapter({ ...target, ...overlap }) } }], run)).toThrow("F04_REVOCATION_INSTALLATION_NOT_ISOLATED")
    }
    expect(() => requireIsolatedNativeRevocation(host, [entry, { ...entry, caseId: "late",
      boundaries: { ...host, wrongInstallation: target } }], run)).toThrow("F04_REVOCATION_INSTALLATION_NOT_ISOLATED")
  })
  test("writer bytes round-trip through the reader contract with same-host scope negatives", () => {
    const source = manifest()
    const serialized = serializeNativeManifest(source)
    const raw: unknown = JSON.parse(serialized)
    const decoded = validateNativeManifest(raw)
    expect(decoded).toEqual(source)
    expect(decoded.schema).toBe("sf2h.native-installed-manifest.v2")
    expect(decoded.wrongTeam.publicOrigin).toBe(decoded.target.publicOrigin)
    expect(decoded.wrongInstallation.publicOrigin).toBe(decoded.target.publicOrigin)
    expect(decoded.wrongServer.discoveryOrigin).not.toBe(decoded.target.discoveryOrigin)
    expect(serialized.endsWith("\n")).toBe(true)
    expect(serializeNativeManifest(decoded)).toBe(serialized)
  })

  test("accepts a fourth independently named actor without making its label a grant", () => {
    const source = manifest()
    const withAdmin = {
      ...source, actors: { ...source.actors, dashboardAdmin: "77777777-7777-4777-8777-777777777777" },
    }
    expect(validateNativeManifest(JSON.parse(serializeNativeManifest(withAdmin)))).toEqual(withAdmin)
  })

  test("rejects missing, extra and unsupported manifest fields instead of upgrading legacy metadata", () => {
    const source = manifest()
    const { scratchRoot, ...missingRoot } = source
    expect(scratchRoot).not.toBe("")
    for (const value of [
      missingRoot,
      { ...source, schema: "sf2h.native-installed-manifest.v1" },
      { ...source, teamObjectId: "not-admitted" },
      { ...source, accessToken: "not-a-real-token" },
      { ...source, actors: { ...source.actors, admin: "not-admitted" } },
      { ...source, actors: { requester: source.actors.requester, holder: source.actors.holder } },
      null,
      [],
    ]) expect(() => validateNativeManifest(value)).toThrow("F04_REAL_INSTALLED_MANIFEST_INVALID")
  })

  test("refuses malformed or incomplete invocation provenance before serialization", () => {
    const source = manifest()
    for (const change of [{ role: "desktop" }, { runAttempt: "0" }, { invocationId: "" }, { archiveSha256: "f".repeat(40) }]) {
      expect(() => validateNativeManifest({ ...source, invocation: { ...source.invocation, ...change } }))
        .toThrow("F04_REAL_INVOCATION_BINDING_INVALID")
    }
  })

  test("rejects malformed target fields and unsafe origins at the shared boundary", () => {
    const source = manifest()
    const { hostId, ...missingHost } = source.target
    expect(hostId).not.toBe("")
    expect(() => validateNativeTarget(missingHost)).toThrow("F04_MISSING_OR_EXTRA_REAL_TARGET_FIELD")
    expect(() => validateNativeTarget({ ...source.target, cookie: "not-a-cookie" }))
      .toThrow("F04_MISSING_OR_EXTRA_REAL_TARGET_FIELD")
    for (const origin of [
      "https://user:password@sf.example.test",
      "https://sf.example.test/path",
      "https://sf.example.test?query=1",
      "http://sf.example.test",
    ]) {
      expect(() => validateNativeTarget({ ...source.target, publicOrigin: origin }))
        .toThrow("F04_TARGET_ORIGIN_INVALID")
    }
    for (const mount of ["/", "/sucafina/", "/sucafina//nested", "/sucafina/../private"]) {
      expect(() => validateNativeTarget({ ...source.target, mount }))
        .toThrow("F04_TARGET_MOUNT_OR_CHAPTER_INVALID")
    }
    expect(() => validateNativeTarget({ ...source.target, chapterHref: "//foreign.example.test/path" }))
      .toThrow("F04_TARGET_MOUNT_OR_CHAPTER_INVALID")
  })

  test("rejects a scope negative that changes origin, mount or host instead of only its selector", () => {
    const source = manifest()
    for (const boundary of ["wrongTeam", "wrongInstallation"] as const) {
      for (const change of [
        { publicOrigin: "https://foreign.example.test", serverKey: "https://foreign.example.test" },
        { mount: "/another-mount" },
        { hostId: "another-host" },
        { discoveryOrigin: "https://another-discovery.example.test" },
        { shellOrigin: "https://another-shell.example.test" },
      ]) {
        expect(() => validateNativeBoundaries({
          ...source, [boundary]: targetWithChapter({ ...source[boundary], ...change }),
        })).toThrow("F04_REAL_HOST_BOUNDARIES_NOT_DISTINCT")
      }
    }
  })

  test("requires exactly the Team identity to differ for the same-host Team negative", () => {
    const source = manifest()
    expect(() => validateNativeBoundaries({ ...source, wrongTeam: source.target }))
      .toThrow("F04_REAL_HOST_BOUNDARIES_NOT_DISTINCT")
    expect(() => validateNativeBoundaries({
      ...source, wrongTeam: targetWithChapter({ ...source.wrongTeam, installationId: "another-installation" }),
    })).toThrow("F04_REAL_HOST_BOUNDARIES_NOT_DISTINCT")
  })

  test("requires exactly the installation identity to differ for the same-host installation negative", () => {
    const source = manifest()
    expect(() => validateNativeBoundaries({ ...source, wrongInstallation: source.target }))
      .toThrow("F04_REAL_HOST_BOUNDARIES_NOT_DISTINCT")
    expect(() => validateNativeBoundaries({
      ...source, wrongInstallation: { ...source.wrongInstallation, projectId: "another-project" },
    })).toThrow("F04_REAL_HOST_BOUNDARIES_NOT_DISTINCT")
  })

  test("requires another discovery connection and target within the original shell for wrongServer", () => {
    const source = manifest()
    for (const change of [
      { serverKey: source.target.serverKey, publicOrigin: source.target.publicOrigin },
      { discoveryOrigin: source.target.discoveryOrigin },
      { shellOrigin: "https://foreign-shell.example.test" },
      {
        projectId: source.target.projectId,
        installationId: source.target.installationId,
        hostId: source.target.hostId,
      },
    ]) {
      expect(() => validateNativeBoundaries({
        ...source, wrongServer: targetWithChapter({ ...source.wrongServer, ...change }),
      })).toThrow("F04_REAL_HOST_BOUNDARIES_NOT_DISTINCT")
    }
  })

  test("rejects duplicate principal labels including the optional dashboard actor", () => {
    const source = manifest()
    for (const actors of [
      { ...source.actors, holder: source.actors.requester },
      { ...source.actors, denied: source.actors.holder },
      { ...source.actors, dashboardAdmin: source.actors.requester },
    ]) {
      expect(() => validateNativeManifest({ ...source, actors }))
        .toThrow("F04_REAL_HOST_BOUNDARIES_NOT_DISTINCT")
    }
    expect(() => validateNativeManifest({ ...source, actors: { ...source.actors, denied: " " } }))
      .toThrow("F04_REQUIRED_REAL_TEXT_MISSING")
  })

  test("rejects absent or malformed candidate identity without claiming it is an installed SHA", () => {
    const source = manifest()
    for (const candidateSha of ["abc", "A".repeat(40), "g".repeat(40)]) {
      expect(() => validateNativeManifest({ ...source, candidateSha }))
        .toThrow("F04_REAL_HOST_BOUNDARIES_NOT_DISTINCT")
    }
    expect(() => validateNativeManifest({ ...source, candidateSha: "" }))
      .toThrow("F04_REQUIRED_REAL_TEXT_MISSING")
  })

  test("the writer codec rejects invalid or credential-bearing input before it can be serialized", () => {
    const source = manifest()
    const contaminated = { ...source, bearer: "not-a-real-credential" }
    expect(() => serializeNativeManifest(contaminated)).toThrow("F04_REAL_INSTALLED_MANIFEST_INVALID")
    expect(() => serializeNativeManifest({
      ...source, wrongTeam: targetWithChapter({ ...source.wrongTeam,
        publicOrigin: source.wrongServer.publicOrigin, serverKey: source.wrongServer.publicOrigin }),
    })).toThrow("F04_REAL_HOST_BOUNDARIES_NOT_DISTINCT")
  })

  test("validation copies metadata so a later caller mutation cannot change the validated target", () => {
    const source = manifest()
    const mutable = { ...source, target: { ...source.target }, actors: { ...source.actors } }
    const decoded = validateNativeManifest(mutable)
    mutable.target.projectId = "later-project"
    mutable.actors.requester = "later-principal"
    expect(decoded).toEqual(source)
    expect(decoded.target).not.toBe(mutable.target)
    expect(decoded.actors).not.toBe(mutable.actors)
  })
})
