import { describe, expect, test } from "bun:test"
import type { SfContext } from "@orchestra/schema/sucafina/context"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import { filesRouteAvailable, parseFilesRouteQuery } from "../../src/orchestra/chapters/sucafina/host/files-route"
import { sourceDestinations } from "../../test/sucafina-native/source-context-fixture"

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
  test("requires the exact files read with CAP-only destinations", () => {
    const candidate = matchSfNativeRoutePath(`/orchestra/sf-imports/${encodeSfRouteRef("manifest")}/preview`)!
    const context = { destinations: sourceDestinations, availability: [{ family: "files", resource: "imports", operations: [{ operationId: "files.import-reference", state: "ready", operational: true }] }] } as unknown as SfContext
    expect(filesRouteAvailable(context, candidate)).toBe(true)
    expect(filesRouteAvailable({ ...context, availability: [] }, candidate)).toBe(false)
    expect(filesRouteAvailable({ ...context, availability: [{ ...context.availability[0]!, operations: [{ ...context.availability[0]!.operations[0]!, operational: false }] }] }, candidate)).toBe(false)
  })
})
