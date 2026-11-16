import { expect, test } from "bun:test"
import { SfNativeOperationBindings } from "../../../src/sucafina/bindings"
import { createSfContextClient } from "../../../src/sucafina/context"
import { createSfFilesClient } from "../../../src/sucafina/files"
import { createSfTransport, type SfDesktopCapability, type SfDesktopInvocation } from "../../../src/sucafina/transport"

test("members export uses the installed byte codec and bounded desktop chunks", async () => {
  const descriptor = {
    installationId: "installation", projectId: "project", hostId: "host",
    publicOrigin: "https://installation.example", mount: "/sucafina",
    authMode: "microsoft" as const, contractRevision: "sf-native-ui/1" as const,
  }
  const stamp = { installationId: descriptor.installationId, projectId: descriptor.projectId,
    hostId: descriptor.hostId, principalRef: "principal", policyVersion: "policy", accessRevision: "revision" }
  const calls: SfDesktopInvocation[] = []
  const desktop: SfDesktopCapability = {
    registerConnection: async () => ({ status: "cancelled" }),
    bind: async () => ({ status: "denied" }),
    abort: async () => {},
    login: async () => ({ status: "denied" }),
    logout: async () => ({ status: "cleared", remote: "unavailable" }),
    release: async () => {},
    invoke: async (request) => {
      calls.push(request)
      if (request.kind === "response-chunk") return request.sequence === 0
        ? { kind: "byte-chunk", sequence: 0, bytes: new Uint8Array([80, 75, 3, 4]), done: false }
        : { kind: "byte-chunk", sequence: 1, bytes: new Uint8Array(), done: true }
      if (request.operationId === "ctx.context") return {
        kind: "json-response", status: 200, headers: { "content-type": "application/json" },
        body: { status: "ok", value: { stamp, contractRevision: "sf-native-ui/1", authMode: "microsoft",
          destinations: [], availability: [] } },
      }
      return { kind: "byte-response", status: 200, responseHandle: "handle", headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      } }
    },
  }
  const transport = createSfTransport({ binding: descriptor, generation: 1, currentGeneration: () => 1,
    fetch: async () => { throw new Error("desktop must not fetch in renderer") }, operations: SfNativeOperationBindings,
    desktop, desktopBinding: { bindingHandle: "binding-1", descriptor, generation: 1 },
  })
  const options = { signal: new AbortController().signal }
  const context = await createSfContextClient(transport)["ctx.context"]({
    installationId: descriptor.installationId, projectId: descriptor.projectId, hostId: descriptor.hostId,
  }, options)
  expect(context.kind).toBe("response")
  const result = await createSfFilesClient(transport)["files.export.members"]({ surface: "dashboard" }, options)
  expect(result.kind).toBe("response")
  if (result.kind !== "response") throw new Error("Members bytes unavailable")
  expect(result.body).toEqual(new Uint8Array([80, 75, 3, 4]))
  expect(calls.filter((call) => call.kind === "request").map((call) => call.operationId))
    .toEqual(["ctx.context", "files.export.members"])
  expect(calls.filter((call) => call.kind === "response-chunk").map((call) => call.sequence)).toEqual([0, 1])
})
