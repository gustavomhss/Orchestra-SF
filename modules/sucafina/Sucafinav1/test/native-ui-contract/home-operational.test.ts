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
  let version = 1
  let changeDuringRead = false
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
    callback: (state: { cases: Record<string, never>; versions: { cases: number }; revision: number; incarnation: string }, authority: typeof stamp) => unknown) => {
    expect(request).toBe(original)
    if (!available) return { status: "unavailable" }
    const value = callback({ cases: {}, versions: { cases: version }, revision: version, incarnation: "state" }, stamp)
    if (revokeDuringRead) revision = "revoked"
    if (changeDuringRead) version++
    return { status: "ok", storageVersion: version, aggregateRevision: version, incarnation: "state", value }
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
  changeDuringRead = true
  expect(await observeSfHome(runtime as never, original, stamp)).toEqual([])
  changeDuringRead = false
  available = false
  expect(await observeSfHome(runtime as never, original, stamp)).toEqual([])
  available = true
  revokeDuringRead = true
  expect(await observeSfHome(runtime as never, original, stamp)).toEqual([])
  expect(await observeSfHome(undefined, original, stamp)).toEqual([])
})

test("home health never dispatches case or routine reads", async () => {
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
  const cases = Object.fromEntries(Array.from({ length: 500 }, (_, index) => [String(index),
    { id: String(index), incarnation: "incarnation", participants: ["person"] }]))
  const runtime = {
    ui,
    state: { read: async (_request: Request, _namespace: string,
      callback: (state: { cases: typeof cases; versions: { cases: number }; revision: number; incarnation: string }, authority: typeof stamp) => unknown) =>
      ({ status: "ok", storageVersion: 1, aggregateRevision: 1, incarnation: "state", value: callback({ cases, versions: { cases: 1 }, revision: 1, incarnation: "state" }, stamp) }) },
    dispatch: async (operation: string, payload: unknown, call: Parameters<typeof ui.validate>[0]) => {
      dispatches++
      if (!await ui.validate(call, operation, digestSfValue(payload))) return { status: "denied" }
      return { status: "ok", result: operationalCase }
    },
  }
  expect(await observeSfHome(runtime as never, original, stamp)).toEqual([
    { operationId: "projection.home", state: "ready", reason: null, operational: true },
  ])
  expect(dispatches).toBe(0)
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
