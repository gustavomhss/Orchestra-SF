import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { RoutineResult } from "../../../product/contracts/context.ts"
import type { SfOperationInputMap } from "../../../product/contracts/operations.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { createSfExecutionBindingRegistry } from "../../../product/host-binding/execution-context.ts"
import { createSfDomainAuthority, createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createRoutineCapabilities, prepareRoutine, prepareWatch, readRoutineCatalog, readRoutineResult, readRoutineStatus, runAdmittedRoutine, routineInputSchemas, routineOutputSchemas } from "../../../product/routines/capabilities.ts"
import type { RoutineHost } from "../../../product/routines/capabilities.ts"

type Operation = keyof typeof routineInputSchemas
const operations: readonly Operation[] = ["sf_routine_catalog", "sf_routine_prepare", "sf_routine_run", "sf_routine_status", "sf_routine_result", "sf_watch_prepare"]
const payloads: { [K in Operation]: SfOperationInputMap[K] } = {
  sf_routine_catalog: { purpose: "review" },
  sf_routine_prepare: { publishedRecipeRef: "recipe", inputRefs: [], parameters: {} },
  sf_routine_run: { admittedRunRef: "admission", expectedAdmissionVersion: 3 },
  sf_routine_status: { runRef: "run" },
  sf_routine_result: { runRef: "run" },
  sf_watch_prepare: { caseRef: "case", conditionRef: "condition", recipientRef: "recipient", recurrence: { recipeRef: "recipe", schedule: "daily", timezone: "UTC" } },
}
const exports = { sf_routine_catalog: readRoutineCatalog, sf_routine_prepare: prepareRoutine, sf_routine_run: runAdmittedRoutine, sf_routine_status: readRoutineStatus, sf_routine_result: readRoutineResult, sf_watch_prepare: prepareWatch }
const handlerNames = { sf_routine_catalog: "readRoutineCatalog", sf_routine_prepare: "prepareRoutine", sf_routine_run: "runAdmittedRoutine", sf_routine_status: "readRoutineStatus", sf_routine_result: "readRoutineResult", sf_watch_prepare: "prepareWatch" }
const expectedCalls = { sf_routine_catalog: ["catalog"], sf_routine_prepare: ["resolveRecipe", "prepareAdmission"], sf_routine_run: ["readAdmission", "resolveCase", "run"], sf_routine_status: ["readRun"], sf_routine_result: ["readRun", "resolveResult"], sf_watch_prepare: ["prepareWatch"] }
const admission: RoutineResult = { admission: "admitted", admissionRef: "admission", admissionVersion: 3, documentId: "recipe", publishedVersion: "v1", principalRef: "owner", projectId: "project", correlationId: "protected-correlation-sentinel", authorizationId: "authorization", armRef: "arm", childSessionId: "child-session", sourceRefs: [], pending: [] }
const run: RoutineResult = { ...admission, runRef: "run", resultRef: "result" }

// The UI registry, dispatcher, schemas, receipt checks and exported handlers are real.
// C08/recipe/watch/artifact boundaries below are injected contract probes; this is not GNATIVE or Relay execution evidence.
function fixture(operation: Operation) {
  const request = new Request("https://example.test/wp09/export-matrix", { method: "POST" })
  const state = { allowed: true, revokeOnRead: false, calls: [] as string[], outputValidations: 0 }
  const ui = createSfUiAuthority({
    authorize: async (incoming) => incoming === request && state.allowed ? { installationId: "installation", projectId: "project", principalRef: "owner", policyVersion: "policy", accessRevision: "access" } : undefined,
    commandIdentity: async () => "command",
    createId: () => "matrix-request",
    now: () => Date.parse("2031-01-15T12:00:00Z"),
  })
  const native = createSfExecutionBindingRegistry({ authenticateAndResolve: async () => undefined, revalidateAdmission: async () => false })
  const authority = createSfDomainAuthority({ ui, native })
  const answer = async <T>(name: string, value: T): Promise<PortResult<T>> => {
    state.calls.push(name)
    if (state.revokeOnRead) state.allowed = false
    return { status: "ok", value: structuredClone(value) }
  }
  const host: RoutineHost = {
    routines: {
      catalog: () => answer("catalog", [{ documentId: "recipe", publishedVersion: "v1", planRevisionId: "plan", writeScope: [], title: "protected-title-sentinel" }]),
      prepareAdmission: () => answer("prepareAdmission", admission),
      readAdmission: () => answer("readAdmission", admission),
      run: () => answer("run", run),
      readRun: () => answer("readRun", run),
    },
    resolveRecipe: () => answer("resolveRecipe", { planRevisionId: "plan", writeScope: [], documentId: "recipe", publishedVersion: "v1" }),
    resolveCase: () => answer("resolveCase", { id: "case", incarnation: "incarnation", version: 1 }),
    prepareWatch: (input) => answer("prepareWatch", { caseRef: input.caseRef, conditionRef: input.conditionRef, recipientRef: input.recipientRef, recurrence: input.recurrence.schedule, state: "prepared" as const }),
    resolveResult: (result) => answer("resolveResult", result),
    authority,
    revalidateOutput: async (context) => { state.outputValidations++; return authority.revalidateDomainContext(context) },
    requiredAuthority: { sf_routine_catalog: [], sf_routine_prepare: [], sf_routine_run: [], sf_routine_status: [], sf_routine_result: [], sf_watch_prepare: [] },
  }
  const descriptors = createRoutineCapabilities(host)
  const descriptor = descriptors.find((entry) => entry.id === operation)
  if (!descriptor) throw new Error("Missing producer descriptor")
  const payload = payloads[operation]
  const digest = digestSfValue(payload)
  const admit = async () => {
    const result = await ui.admit(request, operation, digest)
    if (result.status !== "ok") throw new Error(result.reason)
    return result.value
  }
  const dispatch = (context: TrustedUiContext) => dispatchSfCapability({
    operation, payload, context, descriptors, authority,
    validateInput: (selected, value) => selected.id === operation && decodeSfOperationInput(operation, value).ok,
    validateOutput: (selected, result) => selected.id === operation && (result.status !== "ok" || decodeSfOperationOutput(operation, result.result).ok),
  })
  return { host, state, ui, authority, descriptor, descriptors, payload, digest, admit, dispatch }
}

test.each(operations)("%s authorizes the declared export and binds its exact output to the UI receipt", async (operation) => {
  const item = fixture(operation)
  const context = await item.admit()
  expect(item.descriptor.inputSchema).toBe(routineInputSchemas[operation])
  expect(item.descriptor.outputSchema).toBe(routineOutputSchemas[operation])
  expect(item.descriptor.handlerExport).toBe(handlerNames[operation])
  const result = await item.dispatch(context)
  if (result.status !== "ok") throw new Error(result.reason)
  expect(result.receipt).toEqual(item.authority.receiptFor(context, operation, item.digest, digestSfValue(result.result)))
  expect(result.receipt).toMatchObject({ kind: "ui", handlerExport: handlerNames[operation], principalRef: "owner", accessRevision: "access" })
  expect(item.state.calls).toEqual(expectedCalls[operation])
  expect(item.state.outputValidations).toBeGreaterThan(0)
  const calls = item.state.calls.length
  expect((await item.dispatch(context)).status).toBe("denied")
  expect(item.state.calls).toHaveLength(calls)
  item.ui.finish(context)
})

test.each(operations)("%s refuses a direct export call without a consumed grant", async (operation) => {
  const item = fixture(operation)
  const context = await item.admit()
  const direct = await exports[operation](item.payload, context, item.host)
  expect(direct).toMatchObject({ status: "denied", reason: "authority-unavailable", receipt: { kind: "unbound" } })
  expect(item.state.calls).toEqual([])
  expect((await item.dispatch(context)).status).toBe("ok")
  item.ui.finish(context)
})

test.each(operations)("%s rejects a serialized context and revoked permission before calling C08", async (operation) => {
  const item = fixture(operation)
  const context = await item.admit()
  expect((await item.dispatch(structuredClone(context))).status).toBe("denied")
  item.state.allowed = false
  expect((await item.dispatch(context)).status).toBe("denied")
  expect(item.state.calls).toEqual([])
  item.ui.finish(context)
})

test.each(operations)("%s suppresses output if permission is revoked by an awaited boundary", async (operation) => {
  const item = fixture(operation)
  const context = await item.admit()
  item.state.revokeOnRead = true
  const result = await item.dispatch(context)
  expect(result.status).toBe("denied")
  expect(result.receipt.kind).toBe("unbound")
  expect(JSON.stringify(result)).not.toContain("sentinel")
  if (operation === "sf_routine_run") expect(item.state.calls).not.toContain("run")
  item.ui.finish(context)
})

test.each(operations)("%s preserves stale state and refuses a substituted version or result", async (operation) => {
  const item = fixture(operation)
  if (operation === "sf_routine_catalog") item.host.routines.catalog = async () => ({ status: "stale", reason: "catalog-version-changed" })
  if (operation === "sf_routine_prepare") item.host.routines.prepareAdmission = async () => ({ status: "ok", value: { ...admission, publishedVersion: "v2" } })
  if (operation === "sf_routine_run") item.host.routines.readAdmission = async () => ({ status: "ok", value: { ...admission, admissionVersion: 4 } })
  if (operation === "sf_routine_status") item.host.routines.readRun = async () => ({ status: "stale", reason: "run-version-changed" })
  if (operation === "sf_routine_result") item.host.resolveResult = async (value) => ({ status: "ok", value: { ...value, resultRef: "replacement-result" } })
  if (operation === "sf_watch_prepare") item.host.prepareWatch = async (value) => ({ status: "ok", value: { caseRef: value.caseRef, conditionRef: "replacement-condition", recipientRef: value.recipientRef, recurrence: value.recurrence.schedule, state: "prepared" } })
  const reasons = { sf_routine_catalog: "catalog-version-changed", sf_routine_prepare: "recipe-version-changed", sf_routine_run: "admission-changed", sf_routine_status: "run-version-changed", sf_routine_result: "result-run-mismatch", sf_watch_prepare: "watch-proposal-mismatch" }
  const context = await item.admit()
  const result = await item.dispatch(context)
  expect(result).toMatchObject({ status: "stale", reason: reasons[operation], receipt: { kind: "unbound", operation } })
  expect(JSON.stringify(result)).not.toContain("sentinel")
  expect(JSON.stringify(result)).not.toContain("replacement-")
  if (operation === "sf_routine_run") expect(item.state.calls).not.toContain("run")
  item.ui.finish(context)
})

test.each(operations)("%s reports an unavailable dependency without inventing a successful receipt", async (operation) => {
  const item = fixture(operation)
  if (operation === "sf_routine_catalog") item.host.routines.catalog = async () => ({ status: "unavailable", reason: "catalog-unavailable" })
  if (operation === "sf_routine_prepare") item.host.resolveRecipe = async () => ({ status: "unavailable", reason: "recipe-unavailable" })
  if (operation === "sf_routine_run") item.host.routines.readAdmission = async () => ({ status: "unavailable", reason: "admission-unavailable" })
  if (operation === "sf_routine_status") item.host.routines.readRun = async () => ({ status: "unavailable", reason: "run-unavailable" })
  if (operation === "sf_routine_result") delete item.host.resolveResult
  if (operation === "sf_watch_prepare") item.host.prepareWatch = async () => ({ status: "unavailable", reason: "watch-unavailable" })
  const reasons = { sf_routine_catalog: "catalog-unavailable", sf_routine_prepare: "recipe-unavailable", sf_routine_run: "admission-unavailable", sf_routine_status: "run-unavailable", sf_routine_result: "result-reader-unavailable", sf_watch_prepare: "watch-unavailable" }
  const context = await item.admit()
  const result = await item.dispatch(context)
  expect(result).toMatchObject({ status: "unavailable", reason: reasons[operation], receipt: { kind: "unbound", operation } })
  expect(JSON.stringify(result)).not.toContain("sentinel")
  if (operation === "sf_routine_run") expect(item.state.calls).not.toContain("run")
  item.ui.finish(context)
})
