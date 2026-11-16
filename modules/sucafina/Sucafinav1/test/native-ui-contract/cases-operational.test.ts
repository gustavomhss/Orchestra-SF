import { expect, test } from "bun:test"
import { createSfDecisionsProjectionHandlers, observeSfCases } from "../../../../../apps/cli/src/sucafina-product/native-ui/decisions.ts"
import { createSfLiveContext } from "../../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts"
import { createSfUiAuthority } from "../../product/integration/ui-authority.ts"
import { digestSfValue } from "../../product/contracts/canonical.ts"
import { operationalCase } from "./operational-fixture.ts"

const stamp = Object.freeze({ installationId: "installation", projectId: "project", hostId: "host",
  principalRef: "person", policyVersion: "policy", accessRevision: "revision" })

test("case list probe admits the original Request and fences authority and source", async () => {
  const original = new Request("http://localhost/sucafina/api/ui/context")
  let revision = "revision"
  let actor = "person"
  let granted = true
  const ui = createSfUiAuthority({
    createId: () => crypto.randomUUID(), now: Date.now, commandIdentity: async () => crypto.randomUUID(),
    authorize: async (request, operation) => {
      expect(request).toBe(original)
      if (!granted || operation !== "sf_case_read") return undefined
      return { installationId: stamp.installationId, projectId: stamp.projectId, principalRef: actor,
        policyVersion: stamp.policyVersion, accessRevision: revision }
    },
  })
  let reads = 0
  let available = true
  let revokeDuringRead = false
  let version = 1
  let changeDuringRead = false
  const runtime = { ui, state: { read: async (request: Request, namespace: string, callback: (state: { cases: Record<string, never>; versions: { cases: number }; revision: number; incarnation: string }, authority: typeof stamp) => unknown) => {
    expect(request).toBe(original)
    expect(namespace).toBe("cases")
    reads++
    if (!available) return { status: "unavailable" }
    const value = callback({ cases: {}, versions: { cases: version }, revision: version, incarnation: "state" }, stamp)
    if (revokeDuringRead) revision = "revoked"
    if (changeDuringRead) version++
    return { status: "ok", storageVersion: version, aggregateRevision: version, incarnation: "state", value }
  } } }
  const deps = { runtime: () => runtime, readContext: async () => { throw new Error("recursive context read") } }
  const handlers = createSfDecisionsProjectionHandlers(deps as never)
  expect(await observeSfCases(deps as never, handlers, original, stamp)).toEqual([
    { operationId: "projection.cases", state: "ready", reason: null, operational: true },
    { operationId: "projection.case", state: "ready", reason: null, operational: true },
  ])
  expect(reads).toBe(1)
  expect(await observeSfCases(deps as never, handlers.filter((item) => item.operationId === "projection.case"), original, stamp)).toEqual([
    { operationId: "projection.case", state: "ready", reason: null, operational: true },
  ])
  expect(await observeSfCases(deps as never, [], original, stamp)).toEqual([])
  available = false
  expect(await observeSfCases(deps as never, handlers, original, stamp)).toEqual([])
  available = true
  revision = "revoked"
  expect(await observeSfCases(deps as never, handlers, original, stamp)).toEqual([])
  revision = "revision"
  actor = "other"
  expect(await observeSfCases(deps as never, handlers, original, stamp)).toEqual([])
  actor = "person"
  changeDuringRead = true
  expect(await observeSfCases(deps as never, handlers, original, stamp)).toEqual([])
  changeDuringRead = false
  revokeDuringRead = true
  expect(await observeSfCases(deps as never, handlers, original, stamp)).toEqual([])
  revision = "revision"
  revokeDuringRead = false
  granted = false
  expect(await observeSfCases(deps as never, handlers, original, stamp)).toEqual([])
  expect(await observeSfCases({ runtime: () => undefined } as never, handlers, original, stamp)).toEqual([])
})

test("case readiness observes health without case dispatch; the actual list remains complete", async () => {
  const original = new Request("http://localhost/sucafina/api/ui/context")
  const ui = createSfUiAuthority({
    createId: () => crypto.randomUUID(), now: Date.now, commandIdentity: async () => crypto.randomUUID(),
    authorize: async (_request, operation) => operation === "sf_case_read"
      ? { installationId: stamp.installationId, projectId: stamp.projectId, principalRef: stamp.principalRef,
          policyVersion: stamp.policyVersion, accessRevision: stamp.accessRevision } : undefined,
  })
  let count = 100
  let dispatches = 0
  const runtime = {
    ui,
    state: { read: async (_request: Request, _namespace: string,
      callback: (state: { cases: Record<string, { id: string; incarnation: string; participants: string[] }>; versions: { cases: number }; revision: number; incarnation: string }, authority: typeof stamp) => unknown) => {
      const cases = Object.fromEntries(Array.from({ length: count }, (_, index) => [String(index),
        { id: String(index), incarnation: "incarnation", participants: ["person"] }]))
      return { status: "ok", storageVersion: 1, aggregateRevision: 1, incarnation: "state", value: callback({ cases, versions: { cases: 1 }, revision: 1, incarnation: "state" }, stamp) }
    } },
    dispatch: async (operation: string, payload: unknown, call: Parameters<typeof ui.validate>[0]) => {
      dispatches++
      return await ui.validate(call, operation, digestSfValue(payload)) ? { status: "ok", result: operationalCase } : { status: "denied" }
    },
  }
  const deps = { runtime: () => runtime, readContext: async () => { throw new Error("recursive context read") } }
  const handlers = createSfDecisionsProjectionHandlers(deps as never)
  expect(await observeSfCases(deps as never, handlers, original, stamp)).toEqual([
    { operationId: "projection.cases", state: "ready", reason: null, operational: true },
    { operationId: "projection.case", state: "ready", reason: null, operational: true },
  ])
  expect(dispatches).toBe(0)
  count = 500
  dispatches = 0
  expect(await observeSfCases(deps as never, handlers, original, stamp)).toEqual([
    { operationId: "projection.cases", state: "ready", reason: null, operational: true },
    { operationId: "projection.case", state: "ready", reason: null, operational: true },
  ])
  expect(dispatches).toBe(0)
  count = 2
  const handler = createSfDecisionsProjectionHandlers({ ...deps, origin: "http://localhost", mount: "/sucafina",
    readContext: async () => ({ status: "ok", value: { stamp } }) } as never).find((item) => item.operationId === "projection.cases")!
  const response = await handler.handle(new Request("http://localhost/sucafina/api/ui/projections/cases"))
  expect(response.status).toBe(200)
  expect((await response.json()).value.cases).toHaveLength(2)
  expect(dispatches).toBe(2)
})

test("case detail leaves the item lease for the dispatcher and rejects revocation", async () => {
  let revision = "revision"
  let revoke = false
  const ui = createSfUiAuthority({ createId: () => crypto.randomUUID(), now: Date.now, commandIdentity: async () => crypto.randomUUID(),
    authorize: async (_request, operation) => operation === "sf_case_read"
      ? { installationId: stamp.installationId, projectId: stamp.projectId, principalRef: stamp.principalRef,
          policyVersion: stamp.policyVersion, accessRevision: revision } : undefined })
  const runtime = { ui, dispatch: async (operation: string, payload: unknown, call: Parameters<typeof ui.validate>[0]) => {
    if (!await ui.validate(call, operation, digestSfValue(payload))) return { status: "denied" }
    if (revoke) revision = "revoked"
    return { status: "ok", result: operationalCase }
  } }
  const deps = { runtime: () => runtime, origin: "http://localhost", mount: "/sucafina",
    readContext: async () => ({ status: "ok", value: { stamp } }) }
  const handler = createSfDecisionsProjectionHandlers(deps as never).find((item) => item.operationId === "projection.case")!
  const request = () => new Request("http://localhost/sucafina/api/ui/projections/case?caseRef=case%3A0%3Aincarnation")
  expect((await handler.handle(request())).status).toBe(200)
  revoke = true
  expect((await handler.handle(request())).status).toBe(403)
})

test("F01 publishes both mounted case operations only while original C08 health is current", async () => {
  const original = new Request("http://localhost/sucafina/api/ui/context?installationId=installation&projectId=project&hostId=host")
  const binding = Object.freeze({ installationId: stamp.installationId, projectId: stamp.projectId, hostId: stamp.hostId })
  let available = true
  const ui = createSfUiAuthority({ createId: () => crypto.randomUUID(), now: Date.now, commandIdentity: async () => crypto.randomUUID(),
    authorize: async (request, operation) => {
      expect(request).toBe(original)
      return operation === "sf_case_read" ? { installationId: stamp.installationId, projectId: stamp.projectId,
        principalRef: stamp.principalRef, policyVersion: stamp.policyVersion, accessRevision: stamp.accessRevision } : undefined
    } })
  const runtime = { ui, state: { read: async (request: Request, namespace: string,
    callback: (state: { versions: { cases: number }; revision: number; incarnation: string }, authority: typeof stamp) => unknown) => {
    expect(request).toBe(original)
    expect(namespace).toBe("cases")
    if (!available) return { status: "unavailable" }
    const state = { versions: { cases: 7 }, revision: 9, incarnation: "state", get cases() { throw new Error("case enumeration") } }
    return { status: "ok", storageVersion: 7, aggregateRevision: 9, incarnation: "state", value: callback(state, stamp) }
  } } }
  const deps = { runtime: () => runtime }
  const handlers = createSfDecisionsProjectionHandlers(deps as never)
  const live = createSfLiveContext({ origin: "http://localhost", mount: "/sucafina", currentBinding: () => binding,
    admit: async () => ({ status: "ok", stamp, authMode: "local-operator", destinations: [] }),
    operational: (request, current) => observeSfCases(deps as never, handlers, request, current) })
  const first = await live.readContext(original, binding)
  if (first.status !== "ok") throw new Error("healthy F01 unavailable")
  const operations = first.value.availability.flatMap((resource) => resource.operations)
  expect(operations.find((item) => item.operationId === "projection.cases")?.state).toBe("ready")
  expect(operations.find((item) => item.operationId === "projection.case")?.state).toBe("ready")
  available = false
  const second = await live.readContext(original, binding)
  if (second.status !== "ok") throw new Error("unavailable source should not invalidate identity")
  const unavailable = second.value.availability.flatMap((resource) => resource.operations)
  expect(unavailable.find((item) => item.operationId === "projection.cases")?.state).toBe("unavailable")
  expect(unavailable.find((item) => item.operationId === "projection.case")?.state).toBe("unavailable")
})
