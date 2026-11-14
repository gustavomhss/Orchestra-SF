import { expect, test } from "bun:test"
import { runAdmittedRoutine } from "../../../product/routines/capabilities.ts"
import type { BusinessPorts } from "../../../product/contracts/ports.ts"
import type { BoundCapabilityReceipt, TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const context = { kind: "native", binding: { entryMode: "interactive", principalRef: "person", projectId: "project", caseId: "case", caseIncarnation: "inc", caseVersion: 1 } } as TrustedDomainContext
const receipt = { kind: "native" } as BoundCapabilityReceipt
const admitted = { admission: "admitted", admissionRef: "admission", admissionVersion: 3, documentId: "recipe", publishedVersion: "1", principalRef: "person", projectId: "project", correlationId: "correlation", sourceRefs: [], pending: [] } as const

test("run requires the current admission version and passes it to the native port", async () => {
  const calls: unknown[] = []
  const host = {
    routines: { readAdmission: async () => ({ status: "ok", value: admitted } as const), run: async (request: unknown) => { calls.push(request); return { status: "ok", value: { ...admitted, runRef: "run" } } as const } } as unknown as BusinessPorts["routines"],
    resolveRecipe: async () => ({ status: "unavailable", reason: "unused" } as const),
    resolveCase: async () => ({ status: "ok", value: { id: "case", incarnation: "inc", version: 1 } } as const),
    prepareWatch: async () => ({ status: "unavailable", reason: "unused" } as const),
    authority: { revalidateDomainContext: async () => true, receiptFor: () => receipt },
    revalidateOutput: async () => true,
    requiredAuthority: { sf_routine_catalog: [], sf_routine_prepare: [], sf_routine_run: [], sf_routine_status: [], sf_routine_result: [], sf_watch_prepare: [] },
  }
  expect((await runAdmittedRoutine({ admittedRunRef: "admission", expectedAdmissionVersion: 2 }, context, host)).status).toBe("stale")
  expect(calls).toHaveLength(0)
  expect((await runAdmittedRoutine({ admittedRunRef: "admission", expectedAdmissionVersion: 3 }, context, host)).status).toBe("ok")
  expect(calls).toEqual([{ admissionRef: "admission", expectedAdmissionVersion: 3, caseRef: { id: "case", incarnation: "inc", version: 1 } }])
  host.routines.run = async () => ({ status: "ok", value: { ...admitted, publishedVersion: "other", runRef: "run" } })
  expect((await runAdmittedRoutine({ admittedRunRef: "admission", expectedAdmissionVersion: 3 }, context, host)).status).toBe("stale")
  const recursive = { ...context, binding: { ...context.binding, entryMode: "routine-result" } } as TrustedDomainContext
  expect((await runAdmittedRoutine({ admittedRunRef: "admission", expectedAdmissionVersion: 3 }, recursive, host)).status).toBe("denied")
  expect(calls).toHaveLength(1)
})

