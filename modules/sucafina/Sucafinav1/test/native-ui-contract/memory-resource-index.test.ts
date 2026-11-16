import { expect, test } from "bun:test"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
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

test("similar-cases is indexed and ready only from an operational observation", async () => {
  const unavailable = await createSfLiveContext(base).readContext(request(), binding)
  if (unavailable.status !== "ok") throw new Error("Context fixture unavailable")
  const missing = unavailable.value.availability.find((resource) => resource.family === "intelligence" && resource.resource === "similar-cases")
  expect(missing?.operations.find((operation) => operation.operationId === "intelligence.memory-similar-cases")).toEqual({
    operationId: "intelligence.memory-similar-cases", state: "unavailable",
    reason: "operational-source-unavailable", operational: false,
  })

  const observation = {
    operationId: "intelligence.memory-similar-cases", state: "ready", reason: null, operational: true,
  } as const
  const ready = await createSfLiveContext({ ...base, operational: async () => [observation] }).readContext(request(), binding)
  if (ready.status !== "ok") throw new Error("Observed context fixture unavailable")
  const similarCases = ready.value.availability.find((resource) => resource.family === "intelligence" && resource.resource === "similar-cases")
  expect(similarCases?.operations.find((operation) => operation.operationId === observation.operationId)).toEqual(observation)
})

test("similar-cases keeps its closed fixed dashboard POST route", () => {
  expect(SfOperationRegistry["intelligence.memory-similar-cases"]).toEqual({
    method: "POST", pathTemplate: "{mount}/dashboard", effect: "read", responseMode: "json",
    fixedQuery: { sf: "memory-similar-cases" }, maxRequestBytes: 65536,
  })
})
