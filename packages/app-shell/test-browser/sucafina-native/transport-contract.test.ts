/**
 * Q01 F02 pure metadata and route contract (no live host).
 * Public I00 metadata is compared to the pinned 305-operation catalog and the
 * explicit source-backed members download extension. This file does not claim installed host admission or authorization.
 */
import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { SfOperationIds } from "@orchestra/schema/sucafina/common"
import { SfOperationExtensions, SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfNativeOperationRoute } from "@orchestra/schema/sucafina/operation-registry"

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
  operations: Record<string, { method: string; pathTemplate: string; effect: string; responseMode?: string;
    fixedQuery?: Record<string, string>; fixedBodyDiscriminator?: Record<string, string> }>
}

describe("Q01 integrated transport contract / original producer", () => {
  test("Q01-TRANSPORT-REGISTRY preserves the frozen catalog and its explicit source extension", () => {
    expect(Object.keys(catalog.operations)).toHaveLength(305)
    expect(SfOperationExtensions).toEqual({
      "files.export.members": { method: "GET", pathTemplate: "{mount}/{surface}", effect: "read",
        responseMode: "bytes", fixedQuery: { download: "members" } },
      "files.export.review": { method: "GET", pathTemplate: "{mount}/{surface}", effect: "read",
        responseMode: "bytes", fixedQuery: { sf: "review-download" } },
      "reviews.report.prepare": { method: "POST", pathTemplate: "{mount}/dashboard", effect: "prepare",
        responseMode: "json", fixedQuery: { sf: "review-report" }, maxRequestBytes: 65536 },
    })
    expect(Object.hasOwn(catalog.operations, "files.export.members")).toBe(false)
    expect(Object.hasOwn(catalog.operations, "files.export.review")).toBe(false)
    expect(Object.hasOwn(catalog.operations, "reviews.report.prepare")).toBe(false)
    // The 305-operation I00 catalog stays frozen. U26's newer similar-cases
    // operation has its own original producer in product/memory/similarity217.ts:
    // real C09 case read, C17 evidence and Atlas recall under current UI authority.
    // Keep it an individually pinned, source-backed addition, NOT a rewrite of I00.
    const similarCases = "intelligence.memory-similar-cases"
    expect(Object.hasOwn(catalog.operations, similarCases)).toBe(false)
    expect(Object.hasOwn(SfOperationExtensions, similarCases)).toBe(false)
    expect(SfOperationRegistry[similarCases]).toEqual({
      method: "POST", pathTemplate: "{mount}/dashboard", effect: "read",
      responseMode: "json", fixedQuery: { sf: "memory-similar-cases" }, maxRequestBytes: 65536,
    })
    // NAV-01 privacy correction is source-backed rather than a silent rewrite
    // of the pinned I00 catalog (which records GET). The real original CLI
    // producer mounts POST bounded JSON only: apps/cli/src/sucafina-product/
    // native-ui/router.ts rejects search queries in the URL, and UI31's
    // search consumer refuses GET to keep private q out of navigation history.
    // Preserve BOTH original facts and exact route/body limits.
    const privateSearch = "projection.search"
    expect(catalog.operations[privateSearch]?.method).toBe("GET")
    expect(SfOperationRegistry[privateSearch]).toEqual({
      method: "POST", pathTemplate: "{mount}/api/ui/projections/search", effect: "read",
      responseMode: "json", maxRequestBytes: 4096,
    })
    const expected = [...Object.keys(catalog.operations), ...Object.keys(SfOperationExtensions), similarCases].sort()
    expect(Object.keys(SfOperationRegistry).sort()).toEqual(expected)
    expect([...SfOperationIds].sort()).toEqual(expected)
    expect(SfOperationRegistry["files.export.members"]).toEqual(SfOperationExtensions["files.export.members"])
    expect(SfOperationRegistry["files.export.review"]).toEqual(SfOperationExtensions["files.export.review"])
    expect(SfOperationRegistry["reviews.report.prepare"]).toEqual(SfOperationExtensions["reviews.report.prepare"])
    for (const [id, source] of Object.entries(catalog.operations)) {
      const actual: SfNativeOperationRoute = SfOperationRegistry[id as keyof typeof SfOperationRegistry]
      expect(actual, "Q01 integrated metadata missing " + id).toBeDefined()
      expect(actual.method, "Q01 original-source method " + id)
        .toBe(id === privateSearch ? "POST" : source.method)
      expect(actual.pathTemplate).toBe(source.pathTemplate)
      expect(actual.effect).toBe(source.effect)
      // The frozen I00 blob does NOT encode responseMode (all 305 source
      // entries omit the property). Do not invent source metadata or assert
      // undefined equals the normalized route's explicit response mode. Only
      // claim equivalence when the original catalog actually specifies it.
      if (source.responseMode !== undefined) expect(actual.responseMode).toBe(source.responseMode)
      else expect(["json", "bytes", "empty", "navigation"]).toContain(actual.responseMode)
      expect(actual.fixedQuery ?? {}).toEqual(source.fixedQuery ?? {})
      expect(actual.fixedBodyDiscriminator ?? {}).toEqual(source.fixedBodyDiscriminator ?? {})
    }
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
