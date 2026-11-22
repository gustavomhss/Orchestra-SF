/**
 * Mission 231 — negative contracts only. No installed auth, grants or AM
 * positive proof is emulated by these browser-source checks.
 * Genuine attached-browser scenarios are in closure231/patches/e2e...inert.txt
 * for 232, and U01's already shipped installed-browser driver is reused.
 */
import { describe, expect, test } from "bun:test"
import type { SfOwnerSelection, SfServerKey, SfRef } from "@orchestra/schema/sucafina/context"
import { ServerConnection } from "../../src/context/server"
import { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import { encodeSfRouteRef, decodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { SfOwnerRuntime231, createSfInstalledOwnerSource231 } from "../../src/orchestra/chapters/sucafina/host/owner-runtime231"
import { chapterPages } from "../../src/orchestra/chapter-route"

const selected = (server: string): SfOwnerSelection => ({
  serverKey: server as SfServerKey,
  projectId: "original-project" as SfRef,
  installationId: "original-installation" as SfRef,
})

describe("F01/231 native host ownership", () => {
  test("new root callsites are registered to the SAME owner runtime outside the keyed chapter leaf", () => {
    expect(chapterPages["sf-home"]).toBe(SfOwnerRuntime231)
    expect(chapterPages["sf-decisions"]).toBe(SfOwnerRuntime231)
  })

  test("wrong registered ServerConnection cannot discover another owner's installation", async () => {
    const registered: ServerConnection.Http = {
      type: "http",
      http: { url: "https://registered.invalid" },
    }
    const attempts: string[] = []
    // A fail-closed sentinel cannot manufacture a successful response.
    const noNetwork = (async (url: RequestInfo | URL) => {
      attempts.push(String(url))
      throw new Error("unexpected network request")
    }) as typeof globalThis.fetch
    const source = createSfInstalledOwnerSource231(registered, noNetwork)
    expect(await source.listByIds(selected("https://other.invalid"), new AbortController().signal))
      .toBeUndefined()
    expect(attempts).toEqual([])
    expect(source.transportIdentity).toBe(ServerConnection.key(registered))
  })

  test("UI29 and UI34 originate from Q01 exact native routes, not an invented chapter", () => {
    const home = matchSfNativeRoutePath("/orchestra/sf-home")
    const detail = matchSfNativeRoutePath("/orchestra/sf-decisions/" + encodeSfRouteRef("original/κ"))
    expect(home).toMatchObject({ surfaceId: "UI29", chapterId: "sf-home", kind: "entry" })
    expect(detail).toMatchObject({
      surfaceId: "UI34", chapterId: "sf-decisions", kind: "entry",
      parameters: { caseRef: "original/κ" },
    })
    for (const value of ["", "r_", "r_A", "r_abc=", "title/path", "../", "%2F", "r_abc?access=1"]) {
      expect(decodeSfRouteRef(value)).toBeUndefined()
      expect(matchSfNativeRoutePath("/orchestra/sf-decisions/" + value)).toBeUndefined()
    }
  })

  test("only the original typed projection.case GET can preflight/resume, no write or guessed handler", () => {
    const operation = SfDecisions.operations["projection.case"]
    const route = SfOperationRegistry["projection.case"]
    expect(operation.operationId).toBe("projection.case")
    expect(operation.effect).toBe("read")
    expect(operation.method).toBe("GET")
    expect(route.method).toBe("GET")
    expect(route.pathTemplate).toBe("{mount}/api/ui/projections/case")
    expect(SfOperationRegistry["projection.home"].pathTemplate).not.toBe(route.pathTemplate)
  })

  test("unknown native chapter and unsafe encoded refs never become an admitted UI34", () => {
    for (const pathname of [
      "/orchestra/sf-decisions/r_A%2fb", "/orchestra/sf-decisions/r_A/other",
      "/orchestra/sf-decisions/../sf-home",
      "/orchestra/sf-home/admin",
      "/orchestra/sf-identity/escalate",
    ]) {
      const match = matchSfNativeRoutePath(pathname)
      expect(match?.surfaceId === "UI34" && match.kind === "entry").toBe(false)
    }
  })
})
