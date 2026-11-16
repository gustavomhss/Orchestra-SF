import { describe, expect, test } from "bun:test"
import type { SfContext, SfOwnerSelection, SfRef, SfServerKey } from "@orchestra/schema/sucafina/context"
import { encodeSfRouteRef, resolveSfUrlSelection } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import { biRouteAvailable, validBiRoute } from "../../src/orchestra/chapters/sucafina/host/bi-route"

const catalog = matchSfNativeRoutePath("/orchestra/sf-bi")!
const visual = matchSfNativeRoutePath("/orchestra/sf-bi/" + encodeSfRouteRef("BI09"))!
const selection = { serverKey: "server-a" as SfServerKey, projectId: "project-a" as SfRef,
  installationId: "install-a" as SfRef } satisfies SfOwnerSelection
const context = (options: string, data: string, operational = true) => ({ availability: [
  { family: "bi", resource: "catalog", operations: [{ operationId: "bi.bi-options", state: options, operational }] },
  { family: "bi", resource: "visual", operations: [{ operationId: "bi.bi-data", state: data, operational }] },
] }) as unknown as SfContext

describe("BI native route admission", () => {
  test("uses the real Q01 decoder and rejects unknown views and malformed query selectors", () => {
    expect(validBiRoute(visual, new URLSearchParams())).toBe(true)
    const unknown = matchSfNativeRoutePath("/orchestra/sf-bi/" + encodeSfRouteRef("BI12"))!
    expect(validBiRoute(unknown, new URLSearchParams())).toBe(false)
    expect(matchSfNativeRoutePath("/orchestra/sf-bi/BI09")).toBeUndefined()
    for (const query of ["project=project-b", "server=a&server=b&project=p&installation=i", "year=2026"]) {
      expect(validBiRoute(visual, new URLSearchParams(query))).toBe(false)
    }
    expect(validBiRoute(visual, new URLSearchParams("server=b&project=p&installation=i"))).toBe(true)
  })
  test("explicit foreign owner stays explicit and cannot borrow the selected owner", () => {
    const resolved = resolveSfUrlSelection("/orchestra/sf-bi/" + encodeSfRouteRef("BI09") +
      "?server=server-b&project=project-b&installation=install-b", "/orchestra/sf-home", selection)
    expect(resolved.status).toBe("selected")
    if (resolved.status === "selected") expect(resolved.selection.projectId).toBe("project-b")
    expect(resolveSfUrlSelection("/orchestra/sf-bi?project=project-b", "/orchestra/sf-home", selection).status).toBe("invalid-link")
  })
  test("catalog and visual require their actual operational read operations", () => {
    expect(biRouteAvailable(context("ready", "denied"), catalog)).toBe(true)
    expect(biRouteAvailable(context("ready", "denied"), visual)).toBe(false)
    expect(biRouteAvailable(context("denied", "ready"), visual)).toBe(false)
    expect(biRouteAvailable(context("ready", "ready", false), visual)).toBe(false)
    expect(biRouteAvailable(context("ready", "ready"), visual)).toBe(true)
  })
})
