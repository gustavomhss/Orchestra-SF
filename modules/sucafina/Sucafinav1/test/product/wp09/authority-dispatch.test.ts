import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import type { SfOperationInputMap } from "../../../product/contracts/operations.ts"
import type { SfOperationOutputMap } from "../../../product/contracts/outputs.ts"
import type { BusinessPorts } from "../../../product/contracts/ports.ts"
import { createSfDomainAuthority, createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfExecutionBindingRegistry } from "../../../product/host-binding/execution-context.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { createRoutineCapabilities } from "../../../product/routines/capabilities.ts"

test("all six routine operations use the consumed UI lease through the common dispatcher", async () => {
  const request = new Request("https://example.test/routines", { method: "POST" })
  const state = { allowed: true, revokedDuringRead: false, pendingResult: false, invoked: 0, id: 0 }
  const ui = createSfUiAuthority({
    authorize: async (incoming) => incoming === request && state.allowed ? { installationId: "install", projectId: "project", principalRef: "person", policyVersion: "policy", accessRevision: "access" } : undefined,
    commandIdentity: async () => "command",
    createId: () => `request-${++state.id}`,
    now: () => Date.parse("2026-11-13T04:01:10Z"),
  })
  const native = createSfExecutionBindingRegistry({ authenticateAndResolve: async () => undefined, revalidateAdmission: async () => false })
  const authority = createSfDomainAuthority({ ui, native })
  const run = { documentId: "recipe", publishedVersion: "v1", principalRef: "person", projectId: "project", admission: "admitted", admissionRef: "admission", admissionVersion: 3, runRef: "run", resultRef: "result", correlationId: "correlation", sourceRefs: [], pending: [] } as const
  const { resultRef, ...pendingRun } = run
  const mark = <T>(value: T) => { state.invoked++; return Promise.resolve({ status: "ok" as const, value }) }
  const routines = {
    catalog: async () => { if (state.revokedDuringRead) state.allowed = false; return mark([{ documentId: "recipe", publishedVersion: "v1", planRevisionId: "plan", writeScope: [], title: "Review" }]) },
    prepareAdmission: async () => mark(run), readAdmission: async () => mark(run), readRun: async () => mark(state.pendingResult ? pendingRun : run), run: async () => mark(run),
  } satisfies BusinessPorts["routines"]
  const descriptors = createRoutineCapabilities({
    routines,
    resolveRecipe: async () => ({ status: "ok", value: { planRevisionId: "plan", writeScope: [] } }),
    resolveCase: async () => ({ status: "ok", value: { id: "case", incarnation: "inc", version: 1 } }),
    prepareWatch: async () => mark({ caseRef: "case", conditionRef: "condition", recurrence: "daily", state: "prepared" as const }),
    authority,
    revalidateOutput: (context) => authority.revalidateDomainContext(context),
    resolveResult: async (result) => ({ status: "ok", value: result }),
    requiredAuthority: { sf_routine_catalog: [], sf_routine_prepare: [], sf_routine_run: [], sf_routine_status: [], sf_routine_result: [], sf_watch_prepare: [] },
  })
  const cases = [
    ["sf_routine_catalog", { purpose: "review" }],
    ["sf_routine_prepare", { publishedRecipeRef: "recipe", inputRefs: [], parameters: {} }],
    ["sf_routine_run", { admittedRunRef: "admission", expectedAdmissionVersion: 3 }],
    ["sf_routine_status", { runRef: "run" }],
    ["sf_routine_result", { runRef: "run" }],
    ["sf_watch_prepare", { caseRef: "case", conditionRef: "condition", recurrence: { recipeRef: "recipe", schedule: "daily", timezone: "UTC" } }],
  ] as const
  for (const [operation, payload] of cases) {
    const admitted = await ui.admit(request, operation, digestSfValue(payload))
    if (admitted.status !== "ok") throw new Error(admitted.reason)
    const call = () => dispatchSfCapability({ operation, payload, context: admitted.value, descriptors, authority,
      validateInput: () => decodeSfOperationInput(operation as keyof SfOperationInputMap, payload).ok,
      validateOutput: (_, result) => result.status !== "ok" || decodeSfOperationOutput(operation as keyof SfOperationOutputMap, result.result).ok })
    const first = await call()
    expect(first.status).toBe("ok")
    const count = state.invoked
    expect((await call()).status).toBe("denied")
    expect(state.invoked).toBe(count)
    ui.finish(admitted.value)
  }
  state.pendingResult = true
  const resultPayload = { runRef: "run" }
  const pending = await ui.admit(request, "sf_routine_result", digestSfValue(resultPayload))
  if (pending.status !== "ok") throw new Error(pending.reason)
  const notReady = await dispatchSfCapability({ operation: "sf_routine_result", payload: resultPayload, context: pending.value, descriptors, authority, validateInput: () => true, validateOutput: () => true })
  expect(notReady.status).toBe("needs-input")
  ui.finish(pending.value)
  const payload = { purpose: "review" }
  const admitted = await ui.admit(request, "sf_routine_catalog", digestSfValue(payload))
  if (admitted.status !== "ok") throw new Error(admitted.reason)
  state.revokedDuringRead = true
  const revoked = await dispatchSfCapability({ operation: "sf_routine_catalog", payload, context: admitted.value, descriptors, authority, validateInput: () => true, validateOutput: () => true })
  expect(revoked.status).toBe("denied")
  expect(JSON.stringify(revoked)).not.toContain("Review")
})

