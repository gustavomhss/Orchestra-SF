import { expect, test } from "bun:test"
import { createSfWorkProjectionHandlers, observeSfHome } from "../../../../../apps/cli/src/sucafina-product/native-ui/work.ts"
import { createSfUiAuthority } from "../../product/integration/ui-authority.ts"
import { digestSfValue } from "../../product/contracts/canonical.ts"
import { operationalCase } from "./operational-fixture.ts"

const stamp = Object.freeze({ installationId: "installation", projectId: "project", hostId: "host",
  principalRef: "person", policyVersion: "policy", accessRevision: "revision" })

test("home probe executes the real producer and checks original admission and revocation", async () => {
  const original = new Request("http://localhost/sucafina/api/ui/context")
  let revision = "revision"
  let actor = "person"
  let available = true
  let revokeDuringRead = false
  const ui = createSfUiAuthority({
    createId: () => crypto.randomUUID(), now: Date.now, commandIdentity: async () => crypto.randomUUID(),
    authorize: async (request, operation) => {
      expect(request).toBe(original)
      if (operation !== "sf_case_read") return undefined
      return { installationId: stamp.installationId, projectId: stamp.projectId, principalRef: actor,
        policyVersion: stamp.policyVersion, accessRevision: revision }
    },
  })
  const runtime = { ui, state: { read: async (request: Request, _namespace: string,
    callback: (state: { cases: Record<string, never> }, authority: typeof stamp) => unknown) => {
    expect(request).toBe(original)
    if (!available) return { status: "unavailable" }
    const value = callback({ cases: {} }, stamp)
    if (revokeDuringRead) revision = "revoked"
    return { status: "ok", value }
  } } }
  expect(await observeSfHome(runtime as never, original, stamp)).toEqual([
    { operationId: "projection.home", state: "ready", reason: null, operational: true },
  ])
  revision = "revoked"
  expect(await observeSfHome(runtime as never, original, stamp)).toEqual([])
  revision = "revision"
  actor = "other"
  expect(await observeSfHome(runtime as never, original, stamp)).toEqual([])
  actor = "person"
  available = false
  expect(await observeSfHome(runtime as never, original, stamp)).toEqual([])
  available = true
  revokeDuringRead = true
  expect(await observeSfHome(runtime as never, original, stamp)).toEqual([])
  expect(await observeSfHome(undefined, original, stamp)).toEqual([])
})

test("a large home source samples at most one case and fails closed on a failed sample", async () => {
  const original = new Request("http://localhost/sucafina/api/ui/context")
  const ui = createSfUiAuthority({
    createId: () => crypto.randomUUID(), now: Date.now, commandIdentity: async () => crypto.randomUUID(),
    authorize: async (request, operation) => {
      expect(request).toBe(original)
      if (operation !== "sf_case_read") return undefined
      return { installationId: stamp.installationId, projectId: stamp.projectId, principalRef: stamp.principalRef,
        policyVersion: stamp.policyVersion, accessRevision: stamp.accessRevision }
    },
  })
  let dispatches = 0
  let denied = false
  const cases = Object.fromEntries(Array.from({ length: 500 }, (_, index) => [String(index),
    { id: String(index), incarnation: "incarnation", participants: ["person"] }]))
  const runtime = {
    ui,
    state: { read: async (_request: Request, _namespace: string,
      callback: (state: { cases: typeof cases }, authority: typeof stamp) => unknown) =>
      ({ status: "ok", value: callback({ cases }, stamp) }) },
    dispatch: async (operation: string, payload: unknown, call: Parameters<typeof ui.validate>[0]) => {
      dispatches++
      if (!await ui.validate(call, operation, digestSfValue(payload)) || denied) return { status: "denied" }
      return { status: "ok", result: operationalCase }
    },
  }
  expect(await observeSfHome(runtime as never, original, stamp)).toEqual([
    { operationId: "projection.home", state: "ready", reason: null, operational: true },
  ])
  expect(dispatches).toBe(1)
  denied = true
  dispatches = 0
  expect(await observeSfHome(runtime as never, original, stamp)).toEqual([])
  expect(dispatches).toBe(1)
})

test("the actual home projection still reads every accessible case", async () => {
  const ui = createSfUiAuthority({ createId: () => crypto.randomUUID(), now: Date.now, commandIdentity: async () => crypto.randomUUID(),
    authorize: async (_request, operation) => operation === "sf_case_read"
      ? { installationId: stamp.installationId, projectId: stamp.projectId, principalRef: stamp.principalRef,
          policyVersion: stamp.policyVersion, accessRevision: stamp.accessRevision } : undefined })
  const cases = Object.fromEntries(["0", "1"].map((id) => [id, { id, incarnation: "incarnation", participants: ["person"] }]))
  let dispatches = 0
  const runtime = { ui, state: { read: async (_request: Request, _namespace: string,
    callback: (state: { cases: typeof cases }, authority: typeof stamp) => unknown) => ({ status: "ok", value: callback({ cases }, stamp) }) },
    dispatch: async (operation: string, payload: unknown, call: Parameters<typeof ui.validate>[0]) => {
      dispatches++
      return await ui.validate(call, operation, digestSfValue(payload)) ? { status: "ok", result: operationalCase } : { status: "denied" }
    } }
  const deps = { origin: "http://localhost", mount: "/sucafina", runtime: () => runtime }
  const handler = createSfWorkProjectionHandlers(deps as never).find((item) => item.operationId === "projection.home")!
  const result = await handler.handle(new Request("http://localhost/sucafina/api/ui/projections/home"))
  expect(result.status).toBe(200)
  expect((await result.json()).value.cases.items).toHaveLength(2)
  expect(dispatches).toBe(2)
})
