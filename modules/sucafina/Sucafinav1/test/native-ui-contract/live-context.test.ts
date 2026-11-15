/**
 * Mission172 F01 negative/contract tests only.
 * These synthetic boundary callbacks deliberately exercise failures; no test
 * here attests a real Microsoft/OS principal, native engine, scanner or grant.
 * Positive AM/runtime admission remains NOT_RUN until 162/163/164 qualify C.
 */
import { expect, test } from "bun:test"
import { createSfLiveContext, type SfLiveContextSources } from "../../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts"

const origin = "http://127.0.0.1:4096"
const mount = "/sucafina"
const binding = Object.freeze({ installationId: "installation-a", projectId: "project-a", hostId: "host-a" })
const stamp = Object.freeze({
  ...binding, principalRef: "principal-a", policyVersion: "policy-a", accessRevision: "access-a",
})
const request = (options: RequestInit = {}) =>
  new Request(origin + mount + "/api/ui/context?installationId=installation-a&projectId=project-a&hostId=host-a", options)

/** Fixture is a contract boundary, never a real host/authority proof. */
const sources = (overrides: Partial<SfLiveContextSources> = {}): SfLiveContextSources => ({
  origin, mount, currentBinding: () => binding,
  admit: async () => ({ status: "ok", stamp, authMode: "local-operator", destinations: [] }),
  ...overrides,
})

const mismatch = { status: "unavailable", reason: "contract-mismatch" }
const identities = { status: "unavailable", reason: "identity-unavailable" }

test("F01 negative: no mounted runtime returns identity-unavailable without auth read", async () => {
  let reads = 0
  const live = createSfLiveContext(sources({
    currentBinding: () => undefined,
    admit: async () => { reads++; return { status: "denied" } },
  }))
  expect(await live.readContext(request(), binding)).toEqual(identities)
  expect(reads).toBe(0)
})

test("F01 negative: expected host mismatch rejects before authority or operational probes", async () => {
  let reads = 0
  const live = createSfLiveContext(sources({
    admit: async () => { reads++; return { status: "unauthenticated" } },
    operational: async () => { reads++; return [] },
  }))
  expect(await live.readContext(request(), { ...binding, hostId: "other-host" })).toEqual(mismatch)
  expect(reads).toBe(0)
})

test("F01 negative: direct HEAD/POST calls, duplicate query and cross-origin are inert", async () => {
  let reads = 0
  const live = createSfLiveContext(sources({
    admit: async () => { reads++; return { status: "denied" } },
  }))
  expect(await live.readContext(request({ method: "HEAD" }), binding)).toEqual(mismatch)
  expect(await live.readContext(request({ method: "POST" }), binding)).toEqual(mismatch)
  expect(await live.readContext(new Request(request().url + "&projectId=project-a"), binding)).toEqual(mismatch)
  expect(await live.readContext(new Request(request().url + "&role=admin"), binding)).toEqual(mismatch)
  expect(await live.readContext(new Request("http://localhost:4096" + mount + "/api/ui/context?installationId=installation-a&projectId=project-a&hostId=host-a"), binding)).toEqual(mismatch)
  expect(reads).toBe(0)
})

test("F01 negative: absent and revoked authority never produce an optimistic context", async () => {
  let probes = 0
  for (const state of ["unauthenticated", "denied"] as const) {
    const live = createSfLiveContext(sources({
      admit: async () => ({ status: state }),
      operational: async () => { probes++; return [] },
    }))
    expect(await live.readContext(request(), binding)).toEqual({ status: state })
  }
  expect(probes).toBe(0)
})

test("F01 negative: original Request object is never recreated for reauthorization", async () => {
  const observed: Request[] = []
  const live = createSfLiveContext(sources({
    admit: async (current) => { observed.push(current); return { status: "denied" } },
  }))
  const original = request()
  await live.readContext(original, binding)
  expect(observed).toEqual([original])
})

test("F01 negative: identical tuple but replacement identity object rejects late result", async () => {
  let active = binding
  let release: (() => void) | undefined
  const delayed = new Promise<void>((resolve) => { release = resolve })
  const live = createSfLiveContext(sources({
    currentBinding: () => active,
    admit: async () => { await delayed; return { status: "ok", stamp, authMode: "local-operator", destinations: [] } },
  }))
  const pending = live.readContext(request(), binding)
  active = Object.freeze({ ...binding })
  release?.()
  expect(await pending).toEqual(mismatch)
})

test("F01 negative: abort after Request admission rejects a late grant", async () => {
  const controller = new AbortController()
  let release: (() => void) | undefined
  const delayed = new Promise<void>((resolve) => { release = resolve })
  const live = createSfLiveContext(sources({
    admit: async () => { await delayed; return { status: "ok", stamp, authMode: "local-operator", destinations: [] } },
  }))
  const pending = live.readContext(request({ signal: controller.signal }), binding)
  controller.abort()
  release?.()
  expect(await pending).toEqual(mismatch)
})

test("F01 negative: policy/accessRevision change during source read is denied", async () => {
  let n = 0
  const live = createSfLiveContext(sources({
    admit: async () => ({
      status: "ok", stamp: { ...stamp, accessRevision: ++n === 1 ? "access-a" : "access-revoked" },
      authMode: "local-operator", destinations: [],
    }),
  }))
  expect(await live.readContext(request(), binding)).toEqual(mismatch)
  expect(n).toBe(2)
})

test("F01 negative: principal change across awaits is denied", async () => {
  let n = 0
  const live = createSfLiveContext(sources({
    admit: async () => ({
      status: "ok", stamp: { ...stamp, principalRef: ++n === 1 ? "principal-a" : "principal-b" },
      authMode: "local-operator", destinations: [],
    }),
  }))
  expect(await live.readContext(request(), binding)).toEqual(mismatch)
})

test("F01 negative: forged page/action must match the frozen CAP source exactly", async () => {
  const forged = createSfLiveContext(sources({
    admit: async () => ({
      status: "ok", stamp, authMode: "local-operator",
      destinations: [{
        capabilityId: "CAP01", surface: "planner", page: "Executive Dashboard", canRead: true,
        allowedActionIds: ["save-users"],
      }],
    }),
  }))
  expect(await forged.readContext(request(), binding)).toEqual(mismatch)
  const extra = createSfLiveContext(sources({
    admit: async () => ({
      status: "ok", stamp, authMode: "local-operator",
      destinations: [{
        capabilityId: "CAP01", surface: "dashboard", page: "Executive Dashboard", canRead: true,
        allowedActionIds: ["invented-approval"],
      }],
    }),
  }))
  expect(await extra.readContext(request(), binding)).toEqual(mismatch)
})

test("F01 negative: catalog membership alone leaves all other operations unavailable", async () => {
  const live = createSfLiveContext(sources())
  const value = await live.readContext(request(), binding)
  if (value.status !== "ok") throw new Error("Contract fixture rejected unexpectedly")
  const ctx = value.value.availability.find((entry) => entry.family === "ctx")
  expect(ctx?.state).toBe("partial")
  expect(ctx?.operations.find((entry) => entry.operationId === "ctx.context")?.state).toBe("ready")
  expect(ctx?.operations.find((entry) => entry.operationId === "ctx.installations")?.state).toBe("unavailable")
  expect(value.value.availability.filter((entry) => entry.family !== "ctx")
    .every((entry) => entry.operations.every((operation) => operation.state === "unavailable"))).toBe(true)
  // A fixture proves only fail-closed mapping; it is NOT real acceptance evidence.
})

test("F01 negative: a source cannot inject an undeclared ready operation", async () => {
  const live = createSfLiveContext(sources({
    operational: async () => [
      { operationId: "unregistered.operation" as never, state: "ready", operational: true, reason: null },
    ],
  }))
  expect(await live.readContext(request(), binding)).toEqual(mismatch)
})

test("F01 negative: duplicate operation observations cannot prove readiness", async () => {
  const live = createSfLiveContext(sources({
    operational: async () => [
      { operationId: "ctx.installations", state: "ready", reason: null, operational: true },
      { operationId: "ctx.installations", state: "ready", reason: null, operational: true },
    ],
  }))
  expect(await live.readContext(request(), binding)).toEqual(mismatch)
})

test("F01 negative: late operation state change invalidates the snapshot", async () => {
  let reads = 0
  const live = createSfLiveContext(sources({
    operational: async () => [
      ++reads === 1
        ? { operationId: "ctx.installations", state: "ready", reason: null, operational: true }
        : { operationId: "ctx.installations", state: "unavailable", reason: "provider-revoked", operational: false },
    ],
  }))
  expect(await live.readContext(request(), binding)).toEqual(mismatch)
  expect(reads).toBe(2)
})

test("F01 negative: context 200 cannot be fabricated by a denied ctx.context probe", async () => {
  const live = createSfLiveContext(sources({
    operational: async () => [
      { operationId: "ctx.context", state: "denied", reason: "authority-revoked", operational: false },
    ],
  }))
  expect(await live.readContext(request(), binding)).toEqual(mismatch)
})
