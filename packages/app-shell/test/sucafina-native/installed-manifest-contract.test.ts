import { describe, expect, test } from "bun:test"
import {
  serializeNativeManifest, validateNativeBoundaries, validateNativeManifest, validateNativeTarget,
} from "../../e2e/sucafina/native/fixture/manifest-contract.ts"
import type { NativeManifest } from "../../e2e/sucafina/native/fixture/manifest-contract.ts"

// Synthetic metadata only. No actor, host, login, credential or LIVE proof exists.
function manifest(): NativeManifest {
  const target = {
    serverKey: "contract-only-server-a",
    discoveryOrigin: "https://discovery-a.example.test",
    shellOrigin: "https://shell.example.test",
    publicOrigin: "https://sf-a.example.test",
    installationId: "contract-only-installation-a",
    projectId: "contract-only-project-a",
    hostId: "contract-only-host-a",
    mount: "/sucafina",
    chapterHref: "/orchestra/sf-procurement/contracts",
  }
  return {
    schema: "sf2h.native-installed-manifest.v1",
    candidateSha: "a".repeat(40),
    target,
    wrongServer: {
      ...target,
      serverKey: "contract-only-server-b",
      discoveryOrigin: "https://discovery-b.example.test",
      publicOrigin: "https://sf-b.example.test",
      installationId: "contract-only-installation-b",
      projectId: "contract-only-project-b",
      hostId: "contract-only-host-b",
    },
    wrongProject: { ...target, projectId: "contract-only-project-b" },
    wrongInstallation: { ...target, installationId: "contract-only-installation-b" },
    actors: {
      requester: "contract-only-requester",
      holder: "contract-only-holder",
      denied: "contract-only-denied",
    },
    scratchRoot: "/private/contract-only-not-created",
  }
}

describe("F04 installed manifest v1 codec (metadata only, no live admission)", () => {
  test("writer bytes round-trip through the reader contract with same-host scope negatives", () => {
    const source = manifest()
    const serialized = serializeNativeManifest(source)
    const raw: unknown = JSON.parse(serialized)
    const decoded = validateNativeManifest(raw)
    expect(decoded).toEqual(source)
    expect(decoded.schema).toBe("sf2h.native-installed-manifest.v1")
    expect(decoded.wrongProject.publicOrigin).toBe(decoded.target.publicOrigin)
    expect(decoded.wrongInstallation.publicOrigin).toBe(decoded.target.publicOrigin)
    expect(decoded.wrongServer.discoveryOrigin).not.toBe(decoded.target.discoveryOrigin)
    expect(serialized.endsWith("\n")).toBe(true)
    expect(serializeNativeManifest(decoded)).toBe(serialized)
  })

  test("accepts a fourth independently named actor without making its label a grant", () => {
    const source = manifest()
    const withAdmin = {
      ...source, actors: { ...source.actors, dashboardAdmin: "contract-only-admin" },
    }
    expect(validateNativeManifest(JSON.parse(serializeNativeManifest(withAdmin)))).toEqual(withAdmin)
  })

  test("rejects missing, extra and unsupported manifest fields instead of upgrading legacy metadata", () => {
    const source = manifest()
    const { scratchRoot, ...missingRoot } = source
    expect(scratchRoot).not.toBe("")
    for (const value of [
      missingRoot,
      { ...source, schema: "sf2h.native-installed-manifest.v2" },
      { ...source, teamObjectId: "not-admitted" },
      { ...source, accessToken: "not-a-real-token" },
      { ...source, actors: { ...source.actors, admin: "not-admitted" } },
      { ...source, actors: { requester: source.actors.requester, holder: source.actors.holder } },
      null,
      [],
    ]) expect(() => validateNativeManifest(value)).toThrow("F04_REAL_INSTALLED_MANIFEST_INVALID")
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
    for (const boundary of ["wrongProject", "wrongInstallation"] as const) {
      for (const change of [
        { publicOrigin: "https://foreign.example.test" },
        { mount: "/another-mount" },
        { hostId: "another-host" },
        { serverKey: "another-server" },
        { discoveryOrigin: "https://another-discovery.example.test" },
        { shellOrigin: "https://another-shell.example.test" },
      ]) {
        expect(() => validateNativeBoundaries({
          ...source, [boundary]: { ...source[boundary], ...change },
        })).toThrow("F04_REAL_HOST_BOUNDARIES_NOT_DISTINCT")
      }
    }
  })

  test("requires exactly the project identity to differ for the same-host project negative", () => {
    const source = manifest()
    expect(() => validateNativeBoundaries({ ...source, wrongProject: source.target }))
      .toThrow("F04_REAL_HOST_BOUNDARIES_NOT_DISTINCT")
    expect(() => validateNativeBoundaries({
      ...source, wrongProject: { ...source.wrongProject, installationId: "another-installation" },
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
      { serverKey: source.target.serverKey },
      { discoveryOrigin: source.target.discoveryOrigin },
      { shellOrigin: "https://foreign-shell.example.test" },
      {
        projectId: source.target.projectId,
        installationId: source.target.installationId,
        hostId: source.target.hostId,
      },
    ]) {
      expect(() => validateNativeBoundaries({
        ...source, wrongServer: { ...source.wrongServer, ...change },
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
      ...source, wrongProject: { ...source.wrongProject, publicOrigin: source.wrongServer.publicOrigin },
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
