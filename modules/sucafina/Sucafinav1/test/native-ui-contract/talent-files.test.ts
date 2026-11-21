import { expect, test } from "bun:test"
import { Option, Schema } from "effect"
import { SfFiles } from "@orchestra/schema/sucafina/files"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import { SfOperationIds } from "@orchestra/schema/sucafina/common"
import { SfNativeOperationBindings } from "../../../../../packages/client/src/sucafina/bindings"
import { sfAllowedByteMime, sfIsByteOperation } from "../../../../../packages/client/src/sucafina/transport"
import { createSfFilesClient } from "../../../../../packages/client/src/sucafina/files"
import type { SfTransport } from "../../../../../packages/client/src/sucafina/transport"
import { mountSfFilesOriginalRoutes } from "../../runtime/native-files/routing"

test("members export has a closed dashboard-only source contract", () => {
  const operation = Reflect.get(SfFiles.operations, "files.export.members")
  expect(operation).toBeDefined()
  expect(operation.operationId).toBe("files.export.members")
  expect(SfOperationIds).toContain("files.export.members")
  expect(Reflect.get(SfNativeOperationBindings, "files.export.members")).toBeDefined()
  expect(sfIsByteOperation("files.export.members" as never)).toBe(true)
  expect(sfAllowedByteMime("files.export.members" as never,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(true)
  expect(sfAllowedByteMime("files.export.members" as never, "text/html")).toBe(false)
  expect(Reflect.get(SfOperationRegistry, "files.export.members")).toEqual({
    method: "GET", pathTemplate: "{mount}/{surface}", effect: "read",
    responseMode: "bytes", fixedQuery: { download: "members" },
  })
  const decode = Schema.decodeUnknownOption(Schema.toType(operation.input), { onExcessProperty: "error" })
  expect(Option.isSome(decode({ surface: "dashboard" }))).toBe(true)
  expect(Option.isNone(decode({ surface: "planner" }))).toBe(true)
  expect(Option.isNone(decode({ surface: "dashboard", download: "json" }))).toBe(true)
})

test("client admits only dashboard members and delegates the original GET", async () => {
  const seen: string[] = []
  const transport: SfTransport = {
    async execute(operation) {
      seen.push(operation.operationId)
      return { kind: "transport-error", reason: "contract-unavailable" }
    },
  }
  const client = createSfFilesClient(transport)
  const options = { signal: new AbortController().signal }
  await client["files.export.members"]({ surface: "dashboard" }, options)
  expect(seen).toEqual(["files.export.members"])
  expect(await client["files.export.members"]({ surface: "planner" } as never, options)).toEqual({
    kind: "transport-error", reason: "contract-mismatch",
  })
  expect(await client["files.export.members"]({ surface: "dashboard", url: "https://evil.invalid" } as never, options)).toEqual({
    kind: "transport-error", reason: "contract-mismatch",
  })
  expect(seen).toEqual(["files.export.members"])

  const requests: Request[] = []
  const routes = mountSfFilesOriginalRoutes({
    origin: "https://installation.example", mount: "/sucafina",
    sources: { application: async (request) => { requests.push(request); return new Response("original") } },
  })
  const request = new Request("https://installation.example/sucafina/dashboard?download=members")
  expect(await (await routes(request))?.text()).toBe("original")
  expect(requests).toEqual([request])
})
