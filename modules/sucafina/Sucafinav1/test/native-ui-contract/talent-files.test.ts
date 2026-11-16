import { expect, test } from "bun:test"
import { Option, Schema } from "effect"
import { SfFiles } from "@orchestra/schema/sucafina/files"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import { SfOperationIds } from "@orchestra/schema/sucafina/common"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { sfAllowedByteMime, sfIsByteOperation } from "@orchestra/client/sucafina/transport"
import { createSfFilesClient } from "@orchestra/client/sucafina/files"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { mountSfFilesOriginalRoutes } from "../../../../../apps/cli/src/sucafina-product/native-ui/files-routing"
import { planSfOperation } from "../../../../../apps/desktop/src/main/sucafina/protocol"

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

test("desktop plans only the exact members source route through the installed codec", () => {
  const descriptor = {
    installationId: "installation", projectId: "project", hostId: "host",
    publicOrigin: "https://installation.example", mount: "/sucafina",
    authMode: "microsoft" as const, contractRevision: "sf-native-ui/1" as const,
  }
  const request = {
    kind: "request" as const, requestId: "request-1", bindingHandle: "binding-1", generation: 1,
    operationId: "files.export.members" as const, input: { surface: "dashboard" },
  }
  const input = { request, descriptor, operations: SfNativeOperationBindings, principalRef: "person" }
  const plan = planSfOperation(input)
  expect(plan.status).toBe("ok")
  if (plan.status !== "ok") throw new Error("Members route unavailable")
  expect(plan.value.url).toBe("https://installation.example/sucafina/dashboard?download=members")
  expect(plan.value.method).toBe("GET")
  expect(plan.value.mode).toBe("bytes")
  expect(planSfOperation({ ...input, request: { ...request, input: { surface: "planner" } } }).status).toBe("invalid-response")
  expect(planSfOperation({ ...input, request: { ...request, input: { surface: "dashboard", url: "https://evil.invalid" } } }).status).toBe("invalid-response")
  expect(planSfOperation({ ...input, principalRef: undefined }).status).toBe("contract-unavailable")
})
