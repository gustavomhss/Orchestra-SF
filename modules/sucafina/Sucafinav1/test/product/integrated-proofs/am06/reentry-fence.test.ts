import { expect, test } from "bun:test"
import { createRoutineCapabilities } from "../../../../product/routines/capabilities.ts"
import type { RoutineHost } from "../../../../product/routines/capabilities.ts"
import type { BoundCapabilityReceipt, TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"

type RecursiveOperation = "sf_routine_prepare" | "sf_routine_run"
const payloads: Record<RecursiveOperation, unknown> = {
  sf_routine_prepare: { publishedRecipeRef: "pinned-recipe-synthetic", inputRefs: [], parameters: {} },
  sf_routine_run: { admittedRunRef: "admission-synthetic", expectedAdmissionVersion: 3 },
}

/** A deliberately synthetic mode-boundary negative; NOT a real host grant, admission or Task. */
function nativeContext(entryMode: "interactive" | "routine-result"): TrustedDomainContext {
  return {
    kind: "native", lease: {}, binding: {
      installationId: "installation-negative-only", hostId: "host-negative-only",
      projectId: "project-negative-only", locationId: "location-negative-only",
      nativeSessionId: "ses_negative_only", runId: "run_negative_only",
      caseId: "case-negative-only", caseIncarnation: "case-inc-negative-only", caseVersion: 3,
      principalRef: "principal-negative-only", profileId: "sf_maestro", profileVersion: "1.0.0",
      manifestDigest: "a".repeat(64), skillReceipts: [],
      policyVersion: "policy-negative-only", accessRevision: "access-negative-only",
      providerGeneration: 1, expiresAt: "2099-01-01T00:00:00Z", entryMode,
    },
  } as unknown as TrustedDomainContext
}

function negativeOnlyHost() {
  const calls = { receipt: 0, domain: 0, producer: 0, egress: 0 }
  const unreachable = async (): Promise<never> => {
    calls.producer++
    throw new Error("The recursive route must not reach a native producer")
  }
  // This in-memory receipt is ONLY a local condition that exposes the
  // routine-result mode fence. It is never evidence of a host-issued lease.
  const host: RoutineHost = {
    routines: {
      catalog: unreachable, prepareAdmission: unreachable, readAdmission: unreachable,
      readRun: unreachable, run: unreachable,
    },
    resolveRecipe: unreachable, resolveCase: unreachable, prepareWatch: unreachable,
    authority: {
      revalidateDomainContext: async () => { calls.domain++; return true },
      receiptFor: (_context, operation, inputDigest) => {
        calls.receipt++
        return {
          kind: "native", operation, handlerExport: "negative-fixture-only",
          inputDigest, principalRef: "principal-negative-only", callId: "negative-fixture-only",
          accessRevision: "access-negative-only", at: "2099-01-01T00:00:00Z",
          runId: "run_negative_only", nativeSessionId: "ses_negative_only", providerGeneration: 1,
        } satisfies BoundCapabilityReceipt
      },
    },
    revalidateOutput: async () => { calls.egress++; return false },
    resolveResult: unreachable,
    requiredAuthority: {
      sf_routine_catalog: [], sf_routine_prepare: [], sf_routine_run: [],
      sf_routine_status: [], sf_routine_result: [], sf_watch_prepare: [],
    },
  }
  return { host, calls }
}

test("sf_maestro routine-result mode refuses prepare/run before C07 producer or domain side effects", async () => {
  const { host, calls } = negativeOnlyHost()
  const descriptors = createRoutineCapabilities(host)
  for (const operation of ["sf_routine_prepare", "sf_routine_run"] as const) {
    const descriptor = descriptors.find((item) => item.id === operation)
    expect(descriptor?.grantProfiles).toEqual(["sf_maestro"])
    expect(descriptor?.handlerExport).toBe(operation === "sf_routine_prepare" ? "prepareRoutine" : "runAdmittedRoutine")
    if (!descriptor) throw new Error("Canonical routine capability missing")
    const observed = await descriptor.handler(payloads[operation], nativeContext("routine-result"))
    expect(observed).toMatchObject({
      status: "denied", reason: "recursive-routine",
      receipt: { kind: "unbound", operation, code: "invalid-binding" },
    })
  }
  expect(calls).toEqual({ receipt: 2, domain: 0, producer: 0, egress: 0 })
})

test("model-supplied entryMode cannot override the private host mode for the two write routes", async () => {
  const { host, calls } = negativeOnlyHost()
  const descriptors = createRoutineCapabilities(host)
  for (const operation of ["sf_routine_prepare", "sf_routine_run"] as const) {
    const descriptor = descriptors.find((item) => item.id === operation)
    if (!descriptor) throw new Error("Canonical routine capability missing")
    const value = { ...(payloads[operation] as Record<string, unknown>), entryMode: "interactive" }
    const observed = await descriptor.handler(value, nativeContext("routine-result"))
    expect(observed).toMatchObject({
      status: "needs-input", reason: "invalid-input",
      receipt: { kind: "unbound", operation, code: "invalid-input" },
    })
  }
  expect(calls).toEqual({ receipt: 0, domain: 0, producer: 0, egress: 0 })
})
