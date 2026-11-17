/** Q01 / F04 live installed-host negative proofs.
 * Requires the manifest from a real installation bound to the candidate SHA;
 * never substitute fake credentials or a local development server.
 */
import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { createSfTransport } from "@orchestra/client/sucafina/transport"
import { readNativeManifest } from "../../e2e/sucafina/native/fixture/readiness"

describe("Q01 integrated transport contract / original producer", () => {
  test("Q01-TRANSPORT-GUEST true installed context refuses a caller without real session", async () => {
    const { target, candidateSha } = await readNativeManifest()
    expect(candidateSha).toMatch(/^[0-9a-f]{40}$/)
    const context = new URL(target.mount + "/api/ui/context", target.publicOrigin)
    for (const [key, value] of Object.entries({
      installationId: target.installationId, projectId: target.projectId, hostId: target.hostId,
    })) context.searchParams.set(key, value)
    // A fresh Node/Bun fetch has no browser cookie jar or Microsoft identity.
    // Never import F04's named principal as a credential or attach an auth header.
    const response = await fetch(context.href, {
      method: "GET", redirect: "manual", cache: "no-store",
      headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30_000),
    })
    expect([401, 403], "Uncredentialed real producer must not return another user's context")
      .toContain(response.status)
    expect(response.headers.get("location")).toBeNull()
  })

  test("Q01-TRANSPORT-INVALID-OWNER rejects a malformed selector without an actor", async () => {
    const { target } = await readNativeManifest()
    const context = new URL(target.mount + "/api/ui/context", target.publicOrigin)
    context.searchParams.set("installationId", target.installationId)
    context.searchParams.append("projectId", target.projectId)
    context.searchParams.append("projectId", target.projectId)
    context.searchParams.set("hostId", target.hostId)
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
    const invalidNetwork: typeof fetch = async () => {
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
        authMode: target.publicOrigin.startsWith("https:") ? "microsoft" : "local-operator",
      },
      generation: 1, currentGeneration: () => 2,
      fetch: invalidNetwork, operations: {},
    })
    const result = await client.execute({
      operationId: "ctx.context", input: Schema.Undefined, output: Schema.Unknown,
    }, undefined, { signal: new AbortController().signal })
    expect(result).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    expect(networkCalls).toBe(0)
  })

})
