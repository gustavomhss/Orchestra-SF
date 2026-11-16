import { expect, test } from "bun:test"
import { createSfLiveContext, type SfLiveContextSources } from "../../../../../apps/cli/src/sucafina-product/native-ui/live-context"

const origin = "http://127.0.0.1:4096"
const mount = "/sucafina"
const binding = Object.freeze({ installationId: "installation-a", projectId: "project-a", hostId: "host-a" })
const stamp = Object.freeze({ ...binding, principalRef: "principal-a", policyVersion: "policy-a", accessRevision: "access-a" })
const request = () => new Request(origin + mount + "/api/ui/context?installationId=installation-a&projectId=project-a&hostId=host-a")
const base: SfLiveContextSources = {
  origin, mount, currentBinding: () => binding,
  admit: async () => ({ status: "ok", stamp, authMode: "local-operator", destinations: [] }),
}

test("members export stays unavailable without an original operational observation", async () => {
  const result = await createSfLiveContext(base).readContext(request(), binding)
  if (result.status !== "ok") throw new Error("Context fixture unavailable")
  const exports = result.value.availability.find((resource) => resource.family === "files" && resource.resource === "exports")
  expect(exports?.operations.find((op) => op.operationId === "files.export.members")).toEqual({
    operationId: "files.export.members", state: "unavailable", reason: "operational-source-unavailable", operational: false,
  })
})

test("members export requires a stable observation across context reauthorization", async () => {
  const observation = { operationId: "files.export.members", state: "ready", reason: null, operational: true } as const
  const ready = await createSfLiveContext({ ...base, operational: async () => [observation] }).readContext(request(), binding)
  if (ready.status !== "ok") throw new Error("Context fixture unavailable")
  const exports = ready.value.availability.find((resource) => resource.family === "files" && resource.resource === "exports")
  expect(exports?.operations.find((op) => op.operationId === observation.operationId)).toEqual(observation)
  let calls = 0
  const changed = createSfLiveContext({ ...base, operational: async () => ++calls === 1 ? [observation] : [] })
  expect(await changed.readContext(request(), binding)).toEqual({ status: "unavailable", reason: "contract-mismatch" })
})
