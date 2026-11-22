/** Q01 / F04 live installed-host negative proofs.
 * Requires the manifest from a real installation bound to the candidate SHA;
 * never substitute fake credentials or a local development server.
 */
import { describe, expect, test } from "bun:test"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { createSfContextClient } from "@orchestra/client/sucafina/context"
import { createSfTransport, type SfTransportFetch } from "@orchestra/client/sucafina/transport"
import { nativeContextURL, readNativeManifest } from "../../e2e/sucafina/native/fixture/readiness"

describe("Q01 integrated transport contract / original producer", () => {
  test("Q01-TRANSPORT-GUEST true installed context refuses a caller without real session", async () => {
    const { target, candidateSha } = await readNativeManifest()
    expect(candidateSha).toMatch(/^[0-9a-f]{40}$/)
    const context = nativeContextURL(target)
    // A fresh Node/Bun fetch has no browser cookie jar or Microsoft identity.
    // Never import F04's named principal as a credential or attach an auth header.
    const response = await fetch(context, {
      method: "GET", redirect: "manual", cache: "no-store",
      headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30_000),
    })
    expect([401, 403], "Uncredentialed real producer must not return another user's context")
      .toContain(response.status)
    expect(response.headers.get("location")).toBeNull()
  })

  test("Q01-TRANSPORT-INVALID-OWNER rejects a malformed selector without an actor", async () => {
    const { target } = await readNativeManifest()
    const context = new URL(nativeContextURL(target))
    context.searchParams.append("teamObjectId", target.teamObjectId)
    const response = await fetch(context.href, {
      method: "GET", redirect: "manual", cache: "no-store",
      headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30_000),
    })
    expect(response.status, "Duplicate selectors never authorize a GET").not.toBe(200)
    expect([400, 401, 403, 404, 409]).toContain(response.status)
  })

  test("Q01-TRANSPORT-STALE-FENCE never invokes network on a disposed generation", async () => {
    const { target } = await readNativeManifest()
    let networkCalls = 0
    let generationChecks = 0
    const invalidNetwork: SfTransportFetch = async () => {
      networkCalls++
      throw new Error("Q01_STALE_DISPATCH_MUST_NOT_HAPPEN")
    }
    // A descriptor is not an identity or login. This case is ONLY the
    // negative client preflight: no simulated success response or fake broker.
    const client = createSfTransport({
      binding: {
        installationId: target.installationId, projectId: target.projectId,
        hostId: target.hostId, publicOrigin: target.publicOrigin,
        mount: target.mount, contractRevision: "sf-native-ui/1",
        authMode: "microsoft",
      },
      generation: 1,
      currentGeneration: () => {
        generationChecks++
        return 2
      },
      fetch: invalidNetwork, operations: SfNativeOperationBindings,
    })
    const result = await createSfContextClient(client)["ctx.context"]({
      installationId: target.installationId, projectId: target.projectId, hostId: target.hostId,
    }, { signal: new AbortController().signal })
    expect(result).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    expect(generationChecks).toBe(1)
    expect(networkCalls).toBe(0)
  })

})
