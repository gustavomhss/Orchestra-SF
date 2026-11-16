import { expect, test } from "bun:test"
import { createSfUiAuthority } from "../../product/integration/ui-authority.ts"

const stamp = Object.freeze({ installationId: "installation", projectId: "project", hostId: "host",
  principalRef: "person", policyVersion: "policy", accessRevision: "revision" })
const work = await import("../../../../../apps/cli/src/sucafina-product/native-ui/work.ts")
const observeSfHome = (work as unknown as { observeSfHome: (runtime: never, request: Request, stamp: typeof stamp) => Promise<unknown> }).observeSfHome

test("home probe executes the real producer and checks original admission and revocation", async () => {
  const original = new Request("http://localhost/sucafina/api/ui/context")
  let revision = "revision"
  let actor = "person"
  let available = true
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
    return available ? { status: "ok", value: callback({ cases: {} }, stamp) } : { status: "unavailable" }
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
  expect(await observeSfHome(undefined as never, original, stamp)).toEqual([])
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
  const cases = Object.fromEntries(Array.from({ length: 500 }, (_, index) => [String(index),
    { id: String(index), incarnation: "incarnation", participants: ["person"] }]))
  const runtime = {
    ui,
    state: { read: async (_request: Request, _namespace: string,
      callback: (state: { cases: typeof cases }, authority: typeof stamp) => unknown) =>
      ({ status: "ok", value: callback({ cases }, stamp) }) },
    dispatch: async () => { dispatches++; return { status: "denied" } },
  }
  expect(await observeSfHome(runtime as never, original, stamp)).toEqual([])
  expect(dispatches).toBe(1)
})
