import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { ProjectionValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"

// Type-only SF imports cannot initialize canonical or the consumer in the child.
type LoadingMode = "clean" | "late-every" | "late-detector" | "missing-detector"
export const plannerProjectionLoadingModes: readonly LoadingMode[] = ["clean", "late-every", "late-detector", "missing-detector"]
export function plannerProjectionReference(): Extract<BusinessEvidenceRef, { kind: "record" }> {
  return { schema: "sf-evidence-v1", kind: "record", refId: "planner-version:one",
    installationId: "install", projectId: "project", refDigest: "digest", evidenceLevel: "observed",
    target: { surface: "planner", recordType: "planner-version", recordId: "one", incarnation: "incarnation",
      version: 1, fields: ["year"], period: { start: "2026-01-01", end: "2026-12-31" }, projectionDigest: "projection" } }
}
export function plannerProjectionRows(ref: BusinessEvidenceRef, count = 3): ProjectionValue[] {
  return Array.from({ length: count }, (_, index): ProjectionValue => ({ id: String(index), value: index,
    period: { start: "2026-01-01", end: "2026-12-31" }, granularity: "month",
    sourceRefs: [ref], drilldown: ref, evidenceState: "confirmed" }))
}

export async function runSfPlannerProjectionLoadingControl(file: string, mode: LoadingMode) {
  const [{ AppProcess }, { LayerNode }, { expectSpawn }, { Effect }, { ChildProcess }, { Omni }] = await Promise.all([
    import("@orchestra/core/process"), import("@orchestra/core/effect/layer-node"),
    import("@orchestra/core/test/fixture/omni-expect"), import("effect"), import("effect/unstable/process"),
    import("@orchestra/core/omni"),
  ])
  expectSpawn(file)
  const before = Omni.snapshot()
  const result = await Effect.runPromise(Effect.scoped(Effect.provide(Effect.gen(function* () {
    const processes = yield* AppProcess.Service
    return yield* processes.run(ChildProcess.make(process.execPath, [import.meta.path, mode], {
      cwd: import.meta.dir, extendEnv: true, stdin: "ignore", stdout: "pipe", stderr: "pipe",
      killSignal: "SIGTERM", forceKillAfter: "1 second",
    }), { timeout: 3_000, maxOutputBytes: 65_536, maxErrorBytes: 65_536 })
  }), LayerNode.compile(AppProcess.node))))
  const after = Omni.snapshot()
  const stdout = result.stdout.toString("utf8"), stderr = result.stderr.toString("utf8")
  if (result.exitCode !== 0 || result.stdoutTruncated || result.stderrTruncated)
    throw new Error("Planner projection child did not complete: " + JSON.stringify({
      mode, exitCode: result.exitCode, stdoutTruncated: result.stdoutTruncated,
      stderrTruncated: result.stderrTruncated, stdout, stderr,
    }))
  const receipt: unknown = JSON.parse(stdout)
  if (!receipt || typeof receipt !== "object" || !("mode" in receipt) || receipt.mode !== mode)
    throw new Error("Planner projection child returned an invalid receipt")
  return { receipt, omniSpawns: after.spawns - before.spawns, omniDelegations: after.delegations - before.delegations }
}

async function child(mode: LoadingMode) {
  const property = Object.getOwnPropertyDescriptor, define = Object.defineProperty
  const remove = Reflect.deleteProperty, apply = Reflect.apply, nativeEvery = Array.prototype.every
  const proxyTypes: unknown = process.getBuiltinModule("node:util/types")
  if (!proxyTypes || typeof proxyTypes !== "object") throw new Error("Pinned builtin type detectors are required")
  const detector = property(proxyTypes, "isArrayBufferView")
  if (!detector || !Object.hasOwn(detector, "value") || typeof detector.value !== "function")
    throw new Error("Pinned array-buffer-view detector is required")
  function replace(owner: object, key: PropertyKey, replacement: PropertyDescriptor) {
    const saved = property(owner, key)
    define(owner, key, replacement)
    return () => { if (saved) define(owner, key, saved); else remove(owner, key) }
  }
  let restoreBootstrap = () => {}, restoreHook = () => {}
  const order: string[] = [], trace: string[] = []
  if (mode === "missing-detector") {
    restoreBootstrap = replace(proxyTypes, "isArrayBufferView", { ...detector, value: undefined })
    order.push("bootstrap-limited")
  }
  try {
    const canonical = await import("../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts")
    order.push("canonical-loaded")
    restoreBootstrap(); restoreBootstrap = () => {}
    const beforeHookAdmitted = !!canonical.sfCanonicalProjectionRuntime()
    const oldCaptureBefore = !!canonical.sfCanonicalCaptureRuntime()
    if (mode === "late-every") {
      const saved = property(Array.prototype, "every")
      if (!saved) throw new Error("Expected native every descriptor")
      restoreHook = replace(Array.prototype, "every", { ...saved,
        value: function(this: unknown[], ...args: unknown[]) { trace.push("every"); return apply(nativeEvery, this, args) } })
    } else if (mode === "late-detector") {
      restoreHook = replace(proxyTypes, "isArrayBufferView", { ...detector, value: () => { trace.push("detector"); return false } })
    }
    order.push("hook-arranged")
    const duringHookAdmitted = !!canonical.sfCanonicalProjectionRuntime()
    trace.length = 0
    const helper = await import("../../../../modules/sucafina/Sucafinav1/product/host-binding/planner-projection-source-refs.ts")
    order.push("helper-loaded")
    const loadTrace = trace.slice(); trace.length = 0
    const left = plannerProjectionReference(), right = plannerProjectionReference()
    const values = plannerProjectionRows(left), oracle = plannerProjectionRows(left)
    // Preserve the current every, including its hook; own presence selects fallback.
    define(oracle, "every", { configurable: true, value: values.every })
    const expected = helper.matchesSfPlannerProjectionSourceRefs(oracle, right)
    const expectedTrace = trace.slice(); trace.length = 0
    const actual = helper.matchesSfPlannerProjectionSourceRefs(values, right)
    const actualTrace = trace.slice(); trace.length = 0
    left.target.version = 2
    const changedExpected = helper.matchesSfPlannerProjectionSourceRefs(oracle, right)
    const changedExpectedTrace = trace.slice(); trace.length = 0
    const changedActual = helper.matchesSfPlannerProjectionSourceRefs(values, right)
    const changedActualTrace = trace.slice(); trace.length = 0
    restoreHook(); restoreHook = () => {}
    order.push("restored")
    return { mode, order, beforeHookAdmitted, duringHookAdmitted,
      restoredAdmitted: !!canonical.sfCanonicalProjectionRuntime(), oldCaptureBefore,
      oldCaptureRestored: !!canonical.sfCanonicalCaptureRuntime(), loadTrace,
      expected, actual, expectedTrace, actualTrace, changedExpected, changedActual,
      changedExpectedTrace, changedActualTrace }
  } finally { restoreHook(); restoreBootstrap() }
}

if (import.meta.main) {
  const mode = process.argv[2]
  if (mode !== "clean" && mode !== "late-every" && mode !== "late-detector" && mode !== "missing-detector")
    throw new Error("Unknown planner projection loading mode")
  process.stdout.write(JSON.stringify(await child(mode)) + "\n")
}
