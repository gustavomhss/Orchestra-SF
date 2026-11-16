import { describe, expect, test } from "bun:test"
import type { SfContext } from "@orchestra/schema/sucafina/context"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import { filesRouteAvailable, parseFilesRouteQuery } from "../../src/orchestra/chapters/sucafina/host/files-route"

describe("files routes", () => {
  test("preserves producer references and rejects control queries", () => {
    const paths = [`/orchestra/sf-imports/${encodeSfRouteRef("manifest")}/preview`, `/orchestra/sf-documents/${encodeSfRouteRef("doc")}/evidence`]
    for (const path of paths) {
      const candidate = matchSfNativeRoutePath(path)!
      expect(parseFilesRouteQuery(new URLSearchParams(), candidate)).toEqual({})
      for (const query of ["server=s", "server=s&server=t&project=p&installation=i", "source=other", "returnTo=x"])
        expect(parseFilesRouteQuery(new URLSearchParams(query), candidate)).toBeUndefined()
    }
  })
  test("requires the exact files read and readable destination", () => {
    const candidate = matchSfNativeRoutePath(`/orchestra/sf-imports/${encodeSfRouteRef("manifest")}/preview`)!
    const context = { destinations: [{ capabilityId: "UI56", canRead: true }], availability: [{ family: "files", resource: "imports", operations: [{ operationId: "files.import-reference", state: "ready", operational: true }] }] } as unknown as SfContext
    expect(filesRouteAvailable(context, candidate)).toBe(true)
    expect(filesRouteAvailable({ ...context, availability: [] }, candidate)).toBe(false)
    expect(filesRouteAvailable({ ...context, destinations: [{ ...context.destinations[0]!, canRead: false }] }, candidate)).toBe(false)
  })
})
