import { expect, mock, test } from "bun:test"
import type { BusinessEvidenceResolution } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfPlannerCalculationRootProof } from "../../src/sucafina-product/planner-calculation-root.ts"

export const plannerRecordAdmissionModes = ["canonical", "custom-projector", "custom-clock", "custom-enumerate", "runtime-before-factory"] as const
type Mode = typeof plannerRecordAdmissionModes[number]
type Receipt = {
  schema: "sf-planner-record-admission-v1"
  mode: Mode
  pid: number
  order: string[]
  bootstrapCurrent: boolean
  projectorMarked: boolean
  proofIssued: boolean
  canonicalReads: number
  coldAndHit: boolean
  opaqueWork: number
  opaqueOriginalIdentity: boolean
  statefulCallsAfterChange: number
  statefulThrowsAfterChange: number
  phases: { entered: boolean; cold: boolean; assertions: boolean }
  rootEgress: string
  directRootEgress: string
  originalOutcome: { rejected: boolean; state: string; sameSentinel: boolean }
  directRootParity: boolean
  lateViewCompleted: boolean
  lateInputs: { name: string; proofInvalidBeforeFrame: boolean; noReplayAfterFrame: boolean; replacementCalls: number }[]
  portCases: string[]
  intrinsicCases: string[]
  globalBindingCases: { name: string; current: boolean; marked: boolean; traps: number; getterCalls: number;
    restoredCurrent: boolean; restoredMarked: boolean }[]
}

/** Only process orchestration is imported in the parent. Each child owns its
 * module graph, input factories, late hooks and original native fixture. */
export async function runSfPlannerRecordAdmissionControl(file: string, mode: Mode) {
  const [{ AppProcess }, { LayerNode }, { expectSpawn }, { Effect }, { ChildProcess }, { Omni }] = await Promise.all([
    import("@orchestra/core/process"), import("@orchestra/core/effect/layer-node"),
    import("@orchestra/core/test/fixture/omni-expect"), import("effect"), import("effect/unstable/process"),
    import("@orchestra/core/omni"),
  ])
  expectSpawn(file)
  const before = Omni.snapshot()
  const result = await Effect.runPromise(Effect.scoped(Effect.provide(Effect.gen(function* () {
    const processes = yield* AppProcess.Service
    return yield* processes.run(ChildProcess.make(process.execPath, ["test", import.meta.path, "--timeout", "120000"], {
      cwd: import.meta.dir, extendEnv: true, env: { SF_PLANNER_RECORD_ADMISSION_CHILD: mode },
      stdin: "ignore", stdout: "pipe", stderr: "pipe", killSignal: "SIGTERM", forceKillAfter: "1 second",
    }), { timeout: 135_000, maxOutputBytes: 1_048_576, maxErrorBytes: 1_048_576 })
  }), LayerNode.compile(AppProcess.node))))
  const after = Omni.snapshot()
  console.info("SF_PLANNER_RECORD_ADMISSION_OUTPUT " + JSON.stringify({ schema: "sf-child-output-v1", mode,
    exitCode: result.exitCode, stdoutTruncated: result.stdoutTruncated, stderrTruncated: result.stderrTruncated,
    stdoutBytes: result.stdout.length, stderrBytes: result.stderr.length,
    stdoutBase64: result.stdout.toString("base64"), stderrBase64: result.stderr.toString("base64") }))
  if (result.exitCode !== 0 || result.stdoutTruncated || result.stderrTruncated)
    throw new Error("Planner record admission child failed: " + JSON.stringify({ mode, exitCode: result.exitCode,
      stdoutTruncated: result.stdoutTruncated, stderrTruncated: result.stderrTruncated }))
  const prefix = "SF_PLANNER_RECORD_ADMISSION "
  const lines = result.stdout.toString("utf8").split("\n").filter((line) => line.startsWith(prefix))
  if (lines.length !== 1) throw new Error("The child must publish exactly one completed admission receipt")
  const receipt: unknown = JSON.parse(lines[0]!.slice(prefix.length))
  if (!receipt || typeof receipt !== "object" || !("schema" in receipt) || receipt.schema !== "sf-planner-record-admission-v1" ||
    !("mode" in receipt) || receipt.mode !== mode) throw new Error("Invalid Planner record admission receipt")
  return { ...(receipt as Receipt), omniSpawns: after.spawns - before.spawns,
    omniDelegations: after.delegations - before.delegations }
}

async function admission(mode: Mode) {
  const order: string[] = []
  const define = Object.defineProperty, descriptor = Object.getOwnPropertyDescriptor, apply = Reflect.apply
  const sentinel = new Error("original-stateful-projector-or-clock")
  const producer = await import("../../../../modules/sucafina/Sucafinav1/runtime/planner.ts")
  const originalView = descriptor(producer.domain, "view")!
  let live = true, viewCalls = 0, projectorCalls = 0, clockCalls = 0, enumerateCalls = 0, statefulThrows = 0
  order.push("runtime-producer-loaded")
  if (mode === "runtime-before-factory") {
    define(producer.domain, "view", { ...originalView, value: function (this: unknown, ...args: unknown[]) {
      viewCalls++
      if (!live) { statefulThrows++; throw sentinel }
      return apply(originalView.value, this, args)
    } })
    expect(producer.sfOriginalPlannerViewCurrent()).toBe(false)
    order.push("stateful-view-installed-before-factory-import")
  }

  const projection = await import("../../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts")
  const lifecycle = await import("../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts")
  const makePersistence = lifecycle.createSfSourcePersistence
  type SourceInput = Parameters<typeof makePersistence>[0]
  const captures: { input: SourceInput; port: ReturnType<typeof makePersistence> }[] = []
  const lifecyclePath = new URL("../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts", import.meta.url).pathname
  const nativeClock = () => { clockCalls++; if (!live) { statefulThrows++; throw sentinel }; return "2027-02-02T00:00:00Z" }
  const customClockProjector = projection.createSfSourceScopeProjector(nativeClock)
  expect(projection.isSfCanonicalPlannerSourceProjector(customClockProjector)).toBe(false)
  mock.module(lifecyclePath, () => ({ ...lifecycle, createSfSourcePersistence: (input: SourceInput) => {
    // These intentionally opaque alternatives are installed before this factory
    // is born. The original factory is still invoked once with that exact input.
    if (mode === "custom-projector") {
      const original = input.projectScope
      if (!original) throw new Error("The native fixture must provide its original projector")
      input.projectScope = (...args) => { projectorCalls++; return live ? original(...args) : undefined }
    }
    if (mode === "custom-clock") input.projectScope = customClockProjector
    if (mode === "custom-enumerate") {
      const original = input.enumerate
      input.enumerate = (...args) => { enumerateCalls++; return original(...args) }
    }
    const port = makePersistence(input)
    captures.push({ input, port })
    return port
  } }))
  order.push("factory-loaded-and-input-capture-installed")
  const { sensitivityObservationFixture, sensitivityOk } = await import("../../../../modules/sucafina/Sucafinav1/test/product/wp10/integration/sensitivity-observation-fixture.ts")
  const { compositionTestDeadline } = await import("../../../../modules/sucafina/Sucafinav1/test/product/wp10/integration/composition-test-deadline.ts")
  const { createSfPlannerCalculationRoot, readSfPlannerCalculationRootProof } = await import("../../src/sucafina-product/planner-calculation-root.ts")
  const { createSfPlannerRecordProofScope } = await import("../../src/sucafina-product/planner-record-proof-scope.ts")
  const { PLANNER_TABS } = await import("../../../../modules/sucafina/Sucafinav1/src/nav.ts")
  const deadline = compositionTestDeadline("planner-record-proof-admission-" + mode)
  const receipt: Receipt = { schema: "sf-planner-record-admission-v1", mode, pid: process.pid, order,
    bootstrapCurrent: projection.sfCanonicalPlannerSourceRuntimeCurrent(), projectorMarked: false, proofIssued: false,
    canonicalReads: 0, coldAndHit: false, opaqueWork: 0, opaqueOriginalIdentity: false, statefulCallsAfterChange: 0,
    statefulThrowsAfterChange: 0, phases: { entered: false, cold: false, assertions: false }, rootEgress: "not-entered", directRootEgress: "not-applicable",
    originalOutcome: { rejected: false, state: "not-observed", sameSentinel: false },
    directRootParity: false, lateViewCompleted: false, lateInputs: [], portCases: [], intrinsicCases: [], globalBindingCases: [] }
  try {
    const native = await deadline.phase("native-fixture", () => sensitivityObservationFixture(deadline, "all", "lte", { plannerRecordProof: true }))
    order.push("native-fixture-ready")
    const host = native.authority.host, call = native.call
    const captured = captures.filter((entry) => entry.port.currentSnapshots === native.persistence.currentSnapshots)
    expect(captured).toHaveLength(1)
    const source = captured[0]!
    const readersCurrent = () => lifecycle.isSfPlannerSourcePortCurrent(host.persistence, native.persistence)
    receipt.projectorMarked = projection.isSfCanonicalPlannerSourceProjector(source.input.projectScope)
    expect(receipt.bootstrapCurrent).toBe(mode !== "runtime-before-factory")
    expect(readersCurrent()).toBe(mode === "canonical")
    expect(receipt.projectorMarked).toBe(mode === "canonical" || mode === "custom-enumerate")
    const reference = native.sources[0]!
    const withRoot = async <Value>(work: (root: ReturnType<typeof createSfPlannerCalculationRoot>) => Promise<PortResult<Value>>) => {
      const root = createSfPlannerCalculationRoot({ host })
      const prepared = await root.prepare(call, async () => true, () => true)
      if (!prepared) throw new Error("The original native readonly root must be available for this control")
      let emitted: SfPlannerCalculationRootProof | undefined
      const result = await prepared.run(async () => {
        emitted = root.proof(call)
        return work(root)
      })
      expect(root.proof(call)).toBeUndefined()
      if (emitted) expect(readSfPlannerCalculationRootProof(emitted, host, call)).toBeUndefined()
      return result
    }

    await deadline.phase("native-owner-and-original-producer", () => native.business.withCase(call, native.caseRef, {}, async () => {
      const scope = createSfPlannerRecordProofScope({ host, readersCurrent })
      let completed = false
      const result = await withRoot(async (root) => {
        const proof = root.proof(call)
        receipt.proofIssued = !!proof
        expect(!!proof).toBe(mode === "canonical")
        if (proof) {
          const owner = readSfPlannerCalculationRootProof(proof, host, call)
          expect(owner?.current()).toBe(true)
          expect(owner?.identity).toBeDefined()
          expect(owner?.bytesIdentity).toBeDefined()
        }
        return scope.run([reference], call, proof, () => host.revalidate(call), () => true, async () => {
          receipt.opaqueWork++
          receipt.phases.entered = true
          let original: BusinessEvidenceResolution | undefined
          const canonical = async () => { receipt.canonicalReads++; return original = await native.business.context.resolve(reference, call) }
          const first = await scope.observe(reference, call, canonical)
          if (original === undefined) throw new Error("The original resolver did not return the first observation")
          expect(first.state).toBe("fresh")
          expect(receipt.canonicalReads).toBe(1)
          receipt.phases.cold = true
          if (mode === "canonical") {
            const second = await scope.observe(reference, call, canonical)
            expect(second).toEqual(first)
            expect(second).not.toBe(first)
            expect(receipt.canonicalReads).toBe(1)
            receipt.coldAndHit = true
            completed = true
            receipt.phases.assertions = true
            return { status: "ok", value: true }
          }
          expect(first).toBe(original)
          const beforeCalls = mode === "custom-projector" ? projectorCalls : mode === "custom-clock" ? clockCalls :
            mode === "runtime-before-factory" ? viewCalls : enumerateCalls
          const beforeThrows = statefulThrows
          if (mode !== "custom-enumerate") live = false
          let failed = false, originalFailure: unknown
          try {
            let result: BusinessEvidenceResolution | undefined, caught = false, caughtValue: unknown
            try {
              result = await scope.observe(reference, call, async () => {
                receipt.canonicalReads++
                try { return original = await native.business.context.resolve(reference, call) }
                catch (error) { failed = true; originalFailure = error; throw error }
              })
            } catch (error) { caught = true; caughtValue = error }
            expect(receipt.canonicalReads).toBe(2)
            expect(caught).toBe(failed)
            if (failed) expect(caughtValue).toBe(originalFailure)
            if (!failed) expect(result).toBe(original)
            receipt.opaqueOriginalIdentity = true
            receipt.originalOutcome = { rejected: failed, state: result?.state ?? "rejected", sameSentinel: failed && originalFailure === sentinel }
            receipt.statefulThrowsAfterChange = statefulThrows - beforeThrows
            const afterCalls = mode === "custom-projector" ? projectorCalls : mode === "custom-clock" ? clockCalls :
              mode === "runtime-before-factory" ? viewCalls : enumerateCalls
            receipt.statefulCallsAfterChange = afterCalls - beforeCalls
            if (mode === "custom-enumerate") expect(receipt.statefulCallsAfterChange).toBe(0)
            if (mode !== "custom-enumerate") expect(receipt.statefulCallsAfterChange).toBeGreaterThan(0)
            if (mode === "custom-clock" || mode === "runtime-before-factory") expect(receipt.statefulThrowsAfterChange).toBeGreaterThan(0)
            completed = true
            receipt.phases.assertions = true
            return { status: "ok", value: true }
          } finally { live = true }
        })
      })
      // A root can legitimately refuse egress after an original callback throws.
      // Completion is asserted outside its catch; compare the direct original
      // route under a separate real owner instead of requiring an artificial ok.
      expect(completed).toBe(true)
      expect(receipt.phases).toEqual({ entered: true, cold: true, assertions: true })
      receipt.rootEgress = result.status
      if (mode === "canonical") expect(sensitivityOk(result)).toBe(true)
      if (mode !== "canonical") {
        let baselineCompleted = false, baselineReads = 0
        const baseline = await withRoot(async (root) => {
          expect(root.proof(call)).toBeUndefined()
          baselineReads++
          const first = await native.business.context.resolve(reference, call)
          expect(first.state).toBe("fresh")
          const beforeProducer = mode === "custom-projector" ? projectorCalls : mode === "custom-clock" ? clockCalls : viewCalls
          if (mode !== "custom-enumerate") live = false
          try {
            baselineReads++
            // The original resolver can return a refusal or reject; the above
            // observe assertions preserve that exact original return/exception.
            await native.business.context.resolve(reference, call).catch(() => undefined)
            const afterProducer = mode === "custom-projector" ? projectorCalls : mode === "custom-clock" ? clockCalls : viewCalls
            if (mode !== "custom-enumerate") expect(afterProducer).toBeGreaterThan(beforeProducer)
            baselineCompleted = true
            return { status: "ok", value: true }
          } finally { live = true }
        })
        expect(baselineCompleted).toBe(true)
        expect(baselineReads).toBe(2)
        expect(result).toEqual(baseline)
        receipt.directRootEgress = baseline.status
        receipt.directRootParity = true
      }
      expect(receipt.opaqueWork).toBe(1)
      return result
    }))

    if (mode === "canonical") {
      await deadline.phase("same-factory-port-provenance-without-accessors", async () => {
        const own = { ...native.persistence }
        expect(lifecycle.isSfPlannerSourcePortCurrent(host.persistence, own)).toBe(true)
        receipt.portCases.push("same-factory-spread")
        const sibling = makePersistence({ ...source.input })
        expect(lifecycle.isSfPlannerSourcePortCurrent(host.persistence, sibling)).toBe(false)
        receipt.portCases.push("different-factory-same-store")
        expect(lifecycle.isSfPlannerSourcePortCurrent(host.persistence, { ...own, readScopedSource: sibling.readScopedSource })).toBe(false)
        receipt.portCases.push("mixed-factory-readers")
        let invoked = 0
        const replaced = { ...own, readScopedSource: (...args: Parameters<NonNullable<typeof own.readScopedSource>>) => {
          invoked++; return own.readScopedSource!(...args)
        } }
        expect(lifecycle.isSfPlannerSourcePortCurrent(host.persistence, replaced)).toBe(false)
        expect(invoked).toBe(0)
        receipt.portCases.push("wrapper-not-invoked")
        const accessor = { ...own }
        define(accessor, "readScopedSource", { configurable: true, enumerable: true, get: () => { invoked++; return own.readScopedSource } })
        expect(lifecycle.isSfPlannerSourcePortCurrent(host.persistence, accessor)).toBe(false)
        expect(invoked).toBe(0)
        receipt.portCases.push("accessor-not-invoked")
        const proxied = new Proxy(own, { ownKeys: (target) => { invoked++; return Reflect.ownKeys(target) },
          getOwnPropertyDescriptor: (target, key) => { invoked++; return descriptor(target, key) } })
        expect(lifecycle.isSfPlannerSourcePortCurrent(host.persistence, proxied)).toBe(false)
        expect(invoked).toBe(0)
        receipt.portCases.push("proxy-not-inspected")
        expect(lifecycle.isSfPlannerSourcePortCurrent(source.input.persistence, source.input.persistence)).toBe(false)
        if (!source.input.persistence.readSnapshotRoot) throw new Error("The actual native store needs its own readonly root")
        let rawEntries = 0
        const accepted = await source.input.persistence.readSnapshotRoot(async () => {
          rawEntries++
          expect(lifecycle.currentSfPlannerReadonlySnapshotScope(source.input.persistence)).toBeUndefined()
          return true
        }, { signal: deadline.signal })
        expect(accepted).toBe(true)
        expect(rawEntries).toBe(1)
        receipt.portCases.push("raw-local-store-no-planner-proof")
      })

      for (const name of ["enumerate", "projectScope"] as const) {
        await deadline.phase("late-" + name + "-invalidates-token-before-frame", () => native.business.withCase(call, native.caseRef, {}, async () => {
          const currentDescriptor = descriptor(source.input, name)!
          let replacementCalls = 0, work = 0
          const scope = createSfPlannerRecordProofScope({ host, readersCurrent })
          const result = await withRoot(async (root) => {
            const proof = root.proof(call), owner = proof && readSfPlannerCalculationRootProof(proof, host, call)
            if (!proof || !owner || !owner.current()) throw new Error("The late-input test needs the original genuine proof")
            define(source.input, name, { ...currentDescriptor, value: () => { replacementCalls++; throw sentinel } })
            try {
              const refused = await scope.run([reference], call, proof, () => host.revalidate(call), () => true,
                async () => { work++; return { status: "ok", value: true } })
              expect(refused.status).toBe("unavailable")
              expect(work).toBe(0)
              expect(replacementCalls).toBe(0)
            } finally { define(source.input, name, currentDescriptor) }
            expect(owner.current()).toBe(false)
            return { status: "ok", value: true }
          })
          expect(sensitivityOk(result)).toBe(true)
          expect(readersCurrent()).toBe(true)
          receipt.lateInputs.push({ name, proofInvalidBeforeFrame: true, noReplayAfterFrame: false, replacementCalls })
          return result
        }))
        await deadline.phase("late-" + name + "-latches-after-cold", () => native.business.withCase(call, native.caseRef, {}, async () => {
          const currentDescriptor = descriptor(source.input, name)!
          let replacementCalls = 0, reads = 0, completed = false
          const scope = createSfPlannerRecordProofScope({ host, readersCurrent })
          const result = await withRoot(async (root) => {
            const proof = root.proof(call)
            if (!proof) throw new Error("The admitted late-input phase needs its genuine proof")
            return scope.run([reference], call, proof, () => host.revalidate(call), () => true, async () => {
              const canonical = () => { reads++; return native.business.context.resolve(reference, call) }
              const cold = await scope.observe(reference, call, canonical)
              expect(cold.state).toBe("fresh")
              expect(reads).toBe(1)
              define(source.input, name, { ...currentDescriptor, value: () => { replacementCalls++; throw sentinel } })
              try {
                expect((await scope.observe(reference, call, canonical)).state).toBe("unavailable")
                expect(reads).toBe(1)
                expect(replacementCalls).toBe(0)
              } finally { define(source.input, name, currentDescriptor) }
              expect(readersCurrent()).toBe(true)
              expect((await scope.observe(reference, call, canonical)).state).toBe("unavailable")
              expect(reads).toBe(1)
              completed = true
              return { status: "ok", value: true }
            })
          })
          expect(completed).toBe(true)
          expect(result.status).toBe("unavailable")
          expect(replacementCalls).toBe(0)
          receipt.lateInputs.find((entry) => entry.name === name)!.noReplayAfterFrame = true
          return result
        }))
      }

      await deadline.phase("finite-current-descriptors-never-invoke-the-substitute", async () => {
        // This checks descriptor admission, not a replay of the skipped producer.
        // Captured test restoration remains outside product/fallback semantics.
        const check = (label: string, owner: object, key: PropertyKey) => {
          const original = descriptor(owner, key)
          if (!original || !("value" in original) || typeof original.value !== "function") throw new Error("Missing original method: " + label)
          let calls = 0, admitted = true, marked = true
          define(owner, key, { ...original, value: () => { calls++; throw sentinel } })
          try {
            admitted = projection.sfCanonicalPlannerSourceRuntimeCurrent()
            marked = projection.isSfCanonicalPlannerSourceProjector(source.input.projectScope)
          } finally { define(owner, key, original) }
          expect(admitted).toBe(false)
          expect(marked).toBe(false)
          expect(calls).toBe(0)
          expect(projection.sfCanonicalPlannerSourceRuntimeCurrent()).toBe(true)
          receipt.intrinsicCases.push(label)
        }
        check("Date.UTC", Date, "UTC")
        check("Date.getUTCDate", Date.prototype, "getUTCDate")
        check("Date.toISOString", Date.prototype, "toISOString")
        check("Number.isSafeInteger", Number, "isSafeInteger")
        check("Object.entries", Object, "entries")
        check("Math.round", Math, "round")
        check("String.normalize", String.prototype, "normalize")
        check("RegExp.replace", RegExp.prototype, Symbol.replace)
        check("Map.get", Map.prototype, "get")
        check("Set.has", Set.prototype, "has")
        check("Array.iterator.next", Object.getPrototypeOf([][Symbol.iterator]()), "next")
        check("Set.iterator.next", Object.getPrototypeOf(new Set()[Symbol.iterator]()), "next")
        check("JSON.parse", JSON, "parse")
        check("Promise.catch", Promise.prototype, "catch")
        check("structuredClone", globalThis, "structuredClone")
        check("producer.domain.view", producer.domain, "view")
        const firstTab = descriptor(PLANNER_TABS, "0")!
        let admitted = true
        define(PLANNER_TABS, "0", { ...firstTab, value: "Not the canonical tab" })
        try { admitted = projection.sfCanonicalPlannerSourceRuntimeCurrent() }
        finally { define(PLANNER_TABS, "0", firstTab) }
        expect(admitted).toBe(false)
        expect(projection.sfCanonicalPlannerSourceRuntimeCurrent()).toBe(true)
        receipt.intrinsicCases.push("PLANNER_TABS.literal")
      })

      await deadline.phase("captured-global-binding-refuses-proxy-and-accessor-without-effects", async () => {
        const realm = globalThis, original = descriptor(realm, "globalThis")
        if (!original || !("value" in original) || original.value !== realm)
          throw new Error("The clean realm must expose its original data globalThis binding")
        for (const kind of ["data-proxy", "accessor"] as const) {
          let traps = 0, getterCalls = 0, current = true, marked = true
          const trapped = () => { traps++; throw sentinel }
          const replacement: PropertyDescriptor = kind === "data-proxy"
            ? { ...original, value: new Proxy(realm, {
              get: trapped, getOwnPropertyDescriptor: trapped, getPrototypeOf: trapped, ownKeys: trapped,
              has: trapped, isExtensible: trapped, set: trapped, defineProperty: trapped,
              deleteProperty: trapped, setPrototypeOf: trapped, preventExtensions: trapped,
            }) }
            : { configurable: original.configurable, enumerable: original.enumerable,
              get: () => { getterCalls++; return realm } }
          define(realm, "globalThis", replacement)
          try {
            current = projection.sfCanonicalPlannerSourceRuntimeCurrent()
            marked = projection.isSfCanonicalPlannerSourceProjector(source.input.projectScope)
          } finally { define(realm, "globalThis", original) }
          const restoredCurrent = projection.sfCanonicalPlannerSourceRuntimeCurrent()
          const restoredMarked = projection.isSfCanonicalPlannerSourceProjector(source.input.projectScope)
          expect(current).toBe(false)
          expect(marked).toBe(false)
          expect(traps).toBe(0)
          expect(getterCalls).toBe(0)
          expect(restoredCurrent).toBe(true)
          expect(restoredMarked).toBe(true)
          receipt.globalBindingCases.push({ name: "globalThis." + kind, current, marked, traps, getterCalls,
            restoredCurrent, restoredMarked })
        }
      })

      await deadline.phase("late-producer-view-closes-already-admitted-frame", () => native.business.withCase(call, native.caseRef, {}, async () => {
        const scope = createSfPlannerRecordProofScope({ host, readersCurrent })
        let reads = 0, hooks = 0
        const result = await withRoot(async (root) => {
          const proof = root.proof(call)
          if (!proof) throw new Error("The late-view control needs the actual proof")
          return scope.run([reference], call, proof, () => host.revalidate(call), () => true, async () => {
            const canonical = () => { reads++; return native.business.context.resolve(reference, call) }
            expect((await scope.observe(reference, call, canonical)).state).toBe("fresh")
            define(producer.domain, "view", { ...originalView, value: () => { hooks++; throw sentinel } })
            try { expect((await scope.observe(reference, call, canonical)).state).toBe("unavailable") }
            finally { define(producer.domain, "view", originalView) }
            expect((await scope.observe(reference, call, canonical)).state).toBe("unavailable")
            expect(reads).toBe(1)
            expect(hooks).toBe(0)
            receipt.lateViewCompleted = true
            return { status: "ok", value: true }
          })
        })
        expect(receipt.lateViewCompleted).toBe(true)
        expect(result.status).toBe("unavailable")
        return result
      }))
    }
    // withCase may refuse without invoking action. These execution flags live
    // outside every withCase/root catch, so early refusal cannot pass the test.
    expect(receipt.phases).toEqual({ entered: true, cold: true, assertions: true })
    if (mode === "canonical") {
      expect(receipt.lateInputs).toEqual([
        { name: "enumerate", proofInvalidBeforeFrame: true, noReplayAfterFrame: true, replacementCalls: 0 },
        { name: "projectScope", proofInvalidBeforeFrame: true, noReplayAfterFrame: true, replacementCalls: 0 },
      ])
      expect(receipt.lateViewCompleted).toBe(true)
      expect(receipt.globalBindingCases).toHaveLength(2)
    }
    if (mode !== "canonical") expect(receipt.directRootParity).toBe(true)
    order.push("all-admission-assertions-completed")
  } finally {
    live = true
    define(producer.domain, "view", originalView)
    await deadline.close()
  }
  order.push("native-resources-closed")
  console.info("SF_PLANNER_RECORD_ADMISSION " + JSON.stringify(receipt))
}

const selected = process.env.SF_PLANNER_RECORD_ADMISSION_CHILD
if (plannerRecordAdmissionModes.some((mode) => mode === selected)) {
  test("Planner record factory admission and original fallback: " + selected, () => admission(selected as Mode), 120_000)
}
