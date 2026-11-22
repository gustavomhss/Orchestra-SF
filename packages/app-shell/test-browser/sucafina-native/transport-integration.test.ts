/** F04's three original installed controls. Bun/HappyDOM is separate from the CDP journeys. */
import { describe, expect, test } from "bun:test"
import { createSfTeamDomainTransport } from "@orchestra/client/sucafina/team-domain"
import type { SfTransportFetch } from "@orchestra/client/sucafina/transport"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import { nativeContextURL } from "../../e2e/sucafina/native/fixture/readiness"
import { readG08NativeManifest as readNativeManifest } from "../../e2e/sucafina/native/fixture/g08-readiness"
import { requireNativeInstalledHost } from "../../e2e/sucafina/native/fixture/installed-host"
import { readNativeContextObservation } from "../../e2e/sucafina/native/fixture/installed-manifest"

describe("Q01 integrated transport contract / original producer", () => {
  test("Q01-TRANSPORT-GUEST true installed context refuses a caller without real session", async () => {
    const manifest = await readNativeManifest()
    await requireNativeInstalledHost(manifest)
    expect(manifest.candidateSha).toMatch(/^[0-9a-f]{40}$/)
    // A fresh Bun fetch has no browser cookie jar. Neither the named principal nor a file supplies credentials.
    const response = await fetch(nativeContextURL(manifest.target), {
      method: "GET", redirect: "manual", cache: "no-store",
      headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30_000),
    })
    expect([401, 403]).toContain(response.status)
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("cache-control")).toBe("no-store")
  })
  test("Q01-TRANSPORT-INVALID-OWNER rejects a malformed selector without an actor", async () => {
    const manifest = await readNativeManifest()
    await requireNativeInstalledHost(manifest)
    const { target } = manifest
    const duplicate = new URL(nativeContextURL(target))
    duplicate.searchParams.append("teamObjectId", target.teamObjectId)
    const partial = new URL(nativeContextURL(target))
    partial.searchParams.delete("tenantId")
    const mixed = new URL(nativeContextURL(target))
    mixed.searchParams.set("projectId", target.projectId)
    const legacy = new URL(nativeContextURL(target))
    legacy.search = new URLSearchParams({ installationId: target.installationId,
      projectId: target.projectId, hostId: target.hostId }).toString()
    for (const context of [duplicate, partial, mixed, legacy]) {
      const response = await fetch(context.href, {
        method: "GET", redirect: "manual", cache: "no-store",
        headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30_000),
      })
      expect([400, 401, 403, 409]).toContain(response.status)
      expect(response.headers.get("location")).toBeNull()
      expect(response.headers.get("cache-control")).toBe("no-store")
    }
  })
  test("Q01-TRANSPORT-STALE-FENCE never invokes network on a disposed generation", async () => {
    const manifest = await readNativeManifest()
    await requireNativeInstalledHost(manifest)
    const { target } = manifest
    // An actual earlier F02 observation is input to a zero-network negative, never current authority.
    const observed = await readNativeContextObservation(manifest)
    let networkCalls = 0, generationChecks = 0
    const invalidNetwork: SfTransportFetch = async () => {
      networkCalls++
      throw new Error("Q01_STALE_DISPATCH_MUST_NOT_HAPPEN")
    }
    const dom = window as unknown as { happyDOM?: { setURL?: (url: string) => void } }
    if (typeof dom.happyDOM?.setURL !== "function") throw new Error("Q01_ORIGINAL_HAPPYDOM_REQUIRED")
    const previous = window.location.href
    dom.happyDOM.setURL(target.publicOrigin + "/")
    try {
      const client = createSfTeamDomainTransport({
        binding: { installationId: target.installationId, tenantId: target.tenantId,
          projectId: target.projectId, hostId: target.hostId, publicOrigin: target.publicOrigin,
          mount: target.mount, contractRevision: "sf-team-profile/1", authMode: "microsoft" },
        context: () => observed, generation: 1,
        currentGeneration: () => { generationChecks++; return 2 }, fetch: invalidNetwork,
      })
      const result = await client.execute(SfDomain.operations["domain.page.CAP14"], {},
        { signal: new AbortController().signal })
      expect(result).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
      expect(generationChecks).toBe(1)
      expect(networkCalls).toBe(0)
    } finally { dom.happyDOM.setURL(previous) }
  })
})
