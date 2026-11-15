/**
 * Q01.complete / F02 + F04 transport integration.
 * Public I00 metadata is compared to the pinned 305-operation catalog. Actual
 * requests exercise the installed producer's guest denial without cookies;
 * a real authenticated principal is proved by E2E/F04, NOT faked here.
 */
import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Schema } from "effect"
import { SfOperationIds } from "@orchestra/schema/sucafina/common"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfNativeOperationRoute } from "@orchestra/schema/sucafina/operation-registry"
import { createSfTransport } from "@orchestra/client/sucafina/transport"
import { readNativeManifest } from "../../e2e/sucafina/native/fixture/readiness"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")
const catalogPath = path.join(root, "modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/contract-catalog.json")
const catalogText = readFileSync(catalogPath, "utf8")
const sourceBlob = createHash("sha1").update(
  "blob " + Buffer.byteLength(catalogText) + "\0" + catalogText,
).digest("hex")
if (sourceBlob !== "31dbec1726fd8147156b01dc545726650ffd49e1") {
  throw new Error("Q01_TRANSPORT_CATALOG_DRIFT_REQUIRES_I00")
}
const catalog = JSON.parse(catalogText) as {
  operations: Record<string, { method: string; pathTemplate: string; effect: string; responseMode: string;
    fixedQuery?: Record<string, string>; fixedBodyDiscriminator?: Record<string, string> }>
}

describe("Q01 integrated transport contract / original producer", () => {
  test("Q01-TRANSPORT-REGISTRY exactly matches every frozen catalog operation", () => {
    expect(Object.keys(catalog.operations)).toHaveLength(305)
    expect(Object.keys(SfOperationRegistry).sort()).toEqual(Object.keys(catalog.operations).sort())
    expect([...SfOperationIds].sort()).toEqual(Object.keys(catalog.operations).sort())
    for (const [id, source] of Object.entries(catalog.operations)) {
      const actual: SfNativeOperationRoute = SfOperationRegistry[id as keyof typeof SfOperationRegistry]
      expect(actual, "Q01 integrated metadata missing " + id).toBeDefined()
      expect(actual.method).toBe(source.method)
      expect(actual.pathTemplate).toBe(source.pathTemplate)
      expect(actual.effect).toBe(source.effect)
      expect(actual.responseMode).toBe(source.responseMode)
      expect(actual.fixedQuery ?? {}).toEqual(source.fixedQuery ?? {})
      expect(actual.fixedBodyDiscriminator ?? {}).toEqual(source.fixedBodyDiscriminator ?? {})
    }
  })

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

  test("Q01-TRANSPORT-PILOT-ROUTES preserve mutation and response-loss policy", () => {
    const save = catalog.operations["domain.command.CAP25.save"]
    const approve = catalog.operations["domain.command.CAP26.approve"]
    expect(save?.method).toBe("POST")
    expect(approve?.method).toBe("POST")
    expect(save?.effect).toBe("mutation")
    expect(approve?.effect).toBe("mutation")
    expect(save?.pathTemplate).toBe("{mount}/procurement")
    expect(approve?.pathTemplate).toBe("{mount}/procurement")
    expect(save?.fixedBodyDiscriminator).toEqual({ page: "Requests", action: "save" })
    expect(approve?.fixedBodyDiscriminator).toEqual({ page: "My approvals", action: "approve" })
    // An operation table alone NEVER proves that a command was committed.
    // P0/P1 require native browser + original transaction/CAS + holder receipt.
  })
})
