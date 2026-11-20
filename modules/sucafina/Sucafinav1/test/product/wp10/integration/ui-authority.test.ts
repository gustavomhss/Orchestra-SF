import { expect, test } from "bun:test"
import { createSfUiAuthority } from "../../../../product/integration/ui-authority.ts"

async function fixture() {
  const state = { at: Date.parse("2026-11-13T04:01:10Z"), allowed: true, revision: "access-1", counter: 0 }
  const request = new Request("https://example.test/sucafina/planner", { method: "POST" })
  const ui = createSfUiAuthority({
    authorize: async (received) => received === request && state.allowed
      ? { installationId: "installation-1", projectId: "project-1", principalRef: "principal-1", policyVersion: "policy-1", accessRevision: state.revision }
      : undefined,
    createId: () => `request-${++state.counter}`, now: () => state.at,
    commandIdentity: async (received) => received === request ? "command-1" : undefined,
  })
  const admitted = await ui.admit(request, "sf_forecast_compare", "a".repeat(64))
  if (admitted.status !== "ok") throw new Error(admitted.reason)
  return { state, request, ui, context: admitted.value }
}

test("UI lease pins the private Request and consumes once across concurrent dispatches", async () => {
  const f = await fixture()
  expect(f.ui.requestFor(f.context)).toBeUndefined()
  const admitted = await Promise.all([f.ui.validate(f.context, "sf_forecast_compare", "a".repeat(64)), f.ui.validate(f.context, "sf_forecast_compare", "a".repeat(64))])
  expect(admitted.filter(Boolean)).toHaveLength(1)
  expect(f.ui.requestFor(f.context)).toBe(f.request)
  const before = f.ui.receiptFor(f.context, "sf_forecast_compare", "a".repeat(64))
  const after = f.ui.receiptFor(f.context, "sf_forecast_compare", "a".repeat(64), "b".repeat(64))
  if (!before) throw new Error("Admitted UI receipt missing")
  expect(before).toMatchObject({ kind: "ui", principalRef: "principal-1", callId: "request-1", requestId: "request-1", handlerExport: "compareForecast" })
  expect(after).toEqual({ ...before, resultDigest: "b".repeat(64) })
  f.ui.finish(f.context)
  expect(f.ui.requestFor(f.context)).toBeUndefined()
  expect(f.ui.receiptFor(f.context, "sf_forecast_compare", "a".repeat(64))).toBeUndefined()
})

test("serializing UI context never recovers authority, and selectors cannot change its operation", async () => {
  const f = await fixture()
  expect(await Reflect.apply(f.ui.validate, f.ui, [structuredClone(f.context), "sf_forecast_compare", "a".repeat(64)])).toBe(false)
  expect(await f.ui.validate(f.context, "sf_case_draft", "a".repeat(64))).toBe(false)
  expect(await f.ui.validate(f.context, "sf_forecast_compare", "b".repeat(64))).toBe(false)
  expect(await f.ui.validate(f.context, "sf_forecast_compare", "a".repeat(64))).toBe(true)
  expect(f.ui.receiptFor(f.context, "sf_case_draft", "a".repeat(64))).toBeUndefined()
})

test("revocation and changed access revision dispose UI admission before disclosure", async () => {
  const f = await fixture()
  expect(await f.ui.validate(f.context, "sf_forecast_compare", "a".repeat(64))).toBe(true)
  f.state.allowed = false
  expect(await f.ui.revalidate(f.context)).toBe(false)
  expect(f.ui.requestFor(f.context)).toBeUndefined()
  expect(f.ui.receiptFor(f.context, "sf_forecast_compare", "a".repeat(64))).toBeUndefined()
  const changed = await fixture()
  changed.state.revision = "access-2"
  expect(await changed.ui.validate(changed.context, "sf_forecast_compare", "a".repeat(64))).toBe(false)
})

test("expired UI context and invalid operation cannot acquire a Request or receipt", async () => {
  const f = await fixture()
  f.state.at += 5 * 60 * 1000
  expect(await f.ui.validate(f.context, "sf_forecast_compare", "a".repeat(64))).toBe(false)
  expect(f.ui.requestFor(f.context)).toBeUndefined()
  expect(await f.ui.admit(f.request, "invented_operation", "a".repeat(64))).toEqual({ status: "denied", reason: "invalid-ui-operation" })
})

test("a transport readmission has a new call identity and preserves the host command intention", async () => {
  const f = await fixture()
  expect(await f.ui.validate(f.context, "sf_forecast_compare", "a".repeat(64))).toBe(true)
  expect(f.ui.operationIdentity(f.context)).toBe("command-1")
  f.ui.finish(f.context)
  const retried = await f.ui.admit(f.request, "sf_forecast_compare", "a".repeat(64))
  if (retried.status !== "ok") throw new Error(retried.reason)
  expect(retried.value.binding.requestId).not.toBe(f.context.binding.requestId)
  expect(await f.ui.validate(retried.value, "sf_forecast_compare", "a".repeat(64))).toBe(true)
  expect(f.ui.operationIdentity(retried.value)).toBe("command-1")
})


for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])
for (const boundary of ["before", "during"] as const)
test("non-finite clock " + invalid + " " + boundary + " authorization permanently discards a consumed UI lease", async () => {
  const initial = Date.parse("2026-11-13T04:01:10Z")
  const clock = { at: initial, afterAuthorization: undefined as number | undefined }
  let serial = 0
  const request = new Request("https://example.test/action", { method: "POST" })
  const ui = createSfUiAuthority({
    authorize: async () => {
      await Promise.resolve()
      if (clock.afterAuthorization !== undefined) {
        clock.at = clock.afterAuthorization
        clock.afterAuthorization = undefined
      }
      return { installationId: "installation", projectId: "project", principalRef: "principal", policyVersion: "policy", accessRevision: "access" }
    },
    commandIdentity: async () => "command",
    createId: () => "request-" + ++serial,
    now: () => clock.at,
  })
  const admitted = await ui.admit(request, "sf_forecast_compare", "a".repeat(64))
  if (admitted.status !== "ok") throw new Error("initial UI admission unavailable")
  expect(await ui.validate(admitted.value, "sf_forecast_compare", "a".repeat(64))).toBe(true)
  if (boundary === "before") {
    clock.at = invalid
    expect(ui.requestFor(admitted.value)).toBeUndefined()
  } else clock.afterAuthorization = invalid
  expect(await ui.revalidate(admitted.value)).toBe(false)
  clock.at = initial
  expect(ui.requestFor(admitted.value)).toBeUndefined()
  expect(ui.receiptFor(admitted.value, "sf_forecast_compare", "a".repeat(64))).toBeUndefined()
  expect(ui.operationIdentity(admitted.value)).toBeUndefined()
  expect(await ui.revalidate(admitted.value)).toBe(false)
  const fresh = await ui.admit(request, "sf_forecast_compare", "a".repeat(64))
  if (fresh.status !== "ok") throw new Error("fresh UI admission unavailable")
  expect(fresh.value.binding.requestId).not.toBe(admitted.value.binding.requestId)
  expect(await ui.validate(fresh.value, "sf_forecast_compare", "a".repeat(64))).toBe(true)
  expect(ui.operationIdentity(fresh.value)).toBe("command")
})

test("finite expiry preserves a consumed command identity for current reauthorization", async () => {
  const f = await fixture()
  expect(await f.ui.validate(f.context, "sf_forecast_compare", "a".repeat(64))).toBe(true)
  f.state.at += 5 * 60 * 1000
  expect(f.ui.requestFor(f.context)).toBe(f.request)
  expect(await f.ui.revalidate(f.context)).toBe(true)
  expect(f.ui.operationIdentity(f.context)).toBe("command-1")
  expect(f.ui.receiptFor(f.context, "sf_forecast_compare", "a".repeat(64))).toMatchObject({
    callId: f.context.binding.requestId, principalRef: f.context.binding.principalRef,
  })
})

for (const boundary of ["before", "during"] as const)
for (const offset of [0, 1])
test("consumed artifact lease expires " + boundary + " authorization at deadline plus " + offset + "ms", async () => {
  const initial = Date.parse("2026-11-13T04:01:10Z")
  const clock = { at: initial, afterAuthorization: undefined as number | undefined }
  let serial = 0
  const request = new Request("https://example.test/sucafina/dashboard?sf=review-download&artifactRef=report:" + "b".repeat(64))
  const ui = createSfUiAuthority({
    authorize: async (received) => {
      await Promise.resolve()
      if (clock.afterAuthorization !== undefined) {
        clock.at = clock.afterAuthorization
        clock.afterAuthorization = undefined
      }
      return received === request
        ? { installationId: "installation", projectId: "project", principalRef: "principal", policyVersion: "policy", accessRevision: "access" }
        : undefined
    },
    commandIdentity: async (received) => received === request ? "download-command" : undefined,
    createId: () => "request-" + ++serial,
    now: () => clock.at,
  })
  const operation = "sf_artifact_get", digest = "a".repeat(64)
  const admitted = await ui.admit(request, operation, digest)
  if (admitted.status !== "ok") throw new Error("initial artifact admission unavailable")
  expect(await ui.validate(admitted.value, operation, digest)).toBe(true)
  const deadline = Date.parse(admitted.value.binding.expiresAt)
  expect(deadline).toBe(initial + 5 * 60 * 1000)
  clock.at = deadline - 1
  expect(ui.requestFor(admitted.value)).toBe(request)
  expect(await ui.revalidate(admitted.value)).toBe(true)
  expect(ui.receiptFor(admitted.value, operation, digest)).toBeDefined()
  if (boundary === "before") {
    clock.at = deadline + offset
    expect(ui.requestFor(admitted.value)).toBeUndefined()
  } else clock.afterAuthorization = deadline + offset
  expect(await ui.revalidate(admitted.value)).toBe(false)
  // A later clock correction cannot resurrect the discarded disclosure lease.
  clock.at = initial
  expect(ui.requestFor(admitted.value)).toBeUndefined()
  expect(ui.matchesIntent(admitted.value, operation, digest)).toBe(false)
  expect(ui.receiptFor(admitted.value, operation, digest)).toBeUndefined()
  expect(ui.operationIdentity(admitted.value)).toBeUndefined()
  expect(await ui.revalidate(admitted.value)).toBe(false)
  const fresh = await ui.admit(request, operation, digest)
  if (fresh.status !== "ok") throw new Error("fresh artifact admission unavailable")
  expect(fresh.value.binding.requestId).not.toBe(admitted.value.binding.requestId)
  expect(await ui.validate(fresh.value, operation, digest)).toBe(true)
  expect(ui.requestFor(fresh.value)).toBe(request)
  ui.finish(fresh.value)
})

test("a consumed command still renews when its clock crosses expiry during authorization", async () => {
  const initial = Date.parse("2026-11-13T04:01:10Z")
  const clock = { at: initial, afterAuthorization: undefined as number | undefined }
  let serial = 0
  const request = new Request("https://example.test/sucafina/planner", { method: "POST" })
  const ui = createSfUiAuthority({
    authorize: async (received) => {
      await Promise.resolve()
      if (clock.afterAuthorization !== undefined) {
        clock.at = clock.afterAuthorization
        clock.afterAuthorization = undefined
      }
      return received === request
        ? { installationId: "installation", projectId: "project", principalRef: "principal", policyVersion: "policy", accessRevision: "access" }
        : undefined
    },
    commandIdentity: async (received) => received === request ? "original-command" : undefined,
    createId: () => "request-" + ++serial,
    now: () => clock.at,
  })
  const operation = "sf_forecast_compare", digest = "a".repeat(64)
  const admitted = await ui.admit(request, operation, digest)
  if (admitted.status !== "ok") throw new Error("initial command admission unavailable")
  expect(await ui.validate(admitted.value, operation, digest)).toBe(true)
  const deadline = Date.parse(admitted.value.binding.expiresAt)
  clock.at = deadline - 1
  clock.afterAuthorization = deadline
  expect(await ui.revalidate(admitted.value)).toBe(true)
  expect(ui.requestFor(admitted.value)).toBe(request)
  expect(ui.operationIdentity(admitted.value)).toBe("original-command")
  expect(ui.receiptFor(admitted.value, operation, digest)).toMatchObject({
    callId: admitted.value.binding.requestId, principalRef: admitted.value.binding.principalRef,
  })
  ui.finish(admitted.value)
})
