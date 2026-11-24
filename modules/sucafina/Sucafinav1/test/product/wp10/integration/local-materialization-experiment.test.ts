import { expect, test } from "bun:test"
import { deserialize, serialize } from "bun:jsc"
import { isDeepStrictEqual } from "node:util"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import type { Snapshot } from "../../../../runtime/contract.ts"
import type { Surface } from "../../../../src/identity.ts"
import type { LocalStore } from "../../../../runtime/local-contract.ts"
import {
  decodeSnapshot, encodeSnapshot, experimentSnapshotPlan, experimentMaterializeSnapshot,
  experimentValidateSnapshot, experimentMaterializationUnits,
} from "../../../../runtime/local-store.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"
import { sensitivityObservationFixture } from "./sensitivity-observation-fixture.ts"
import { nativeMaterializationCaptureFixture } from "./materialization-native-fixture.ts"

type Deadline = ReturnType<typeof compositionTestDeadline>
type Span = { count: number; total: number; min: number; max: number }
const span = (): Span => ({ count: 0, total: 0, min: Number.MAX_SAFE_INTEGER, max: 0 })
const micros = (started: number) => Math.max(0, Math.round((performance.now() - started) * 1000))

function measure<Value>(timing: Span, work: () => Value): Value {
  const started = performance.now()
  timing.count++
  try { return work() }
  finally {
    const elapsed = micros(started)
    timing.total += elapsed
    timing.min = Math.min(timing.min, elapsed)
    timing.max = Math.max(timing.max, elapsed)
  }
}

function observation(sample: number) {
  return {
    sample, status: 0, released: 0, pairs: 0, warmup: 0, stage: 0,
    decode: span(), plan: span(), serialize: span(), original: span(), binary: span(), validate: span(),
    parity: 0, parityFailures: 0, detached: 0, detachmentFailures: 0,
  }
}
type Observation = ReturnType<typeof observation>

/** This is active benchmark work, not passive instrumentation or UI qualification.
 * Exactly 28 unsigned integers. No source values, hashes, IDs, paths or sizes.
 * schema, sample, status, released, configuredPairs, measuredPairs,
 * decode count/us, plan count/us, serialize count/us,
 * original count/total/min/max, binary count/total/min/max,
 * parity count/failures, detachment count/failures, validation count/us, warmupPairs, stage.
 * status: 1 complete, 2 no copy plan (inconclusive), 3 experimental cap (inconclusive), 4 failed.
 * sample 0 is only the outer cleanup/result row; its materialization counters remain zero.
 * Validation, encoding for parity, detachment and warmup never enter copy timings.
 */
function emit(value: Observation) {
  const fields = [
    1, value.sample, value.status, value.released, 4, value.pairs,
    value.decode.count, value.decode.total, value.plan.count, value.plan.total,
    value.serialize.count, value.serialize.total,
    value.original.count, value.original.total, value.original.count ? value.original.min : 0, value.original.max,
    value.binary.count, value.binary.total, value.binary.count ? value.binary.min : 0, value.binary.max,
    value.parity, value.parityFailures, value.detached, value.detachmentFailures,
    value.validate.count, value.validate.total, value.warmup, value.stage,
  ]
  if (fields.length !== 28 || fields.some((field) => !Number.isSafeInteger(field) || field < 0))
    throw new Error("Materialization experiment produced invalid numeric diagnostics")
  console.info("SF_MATERIALIZE_EXPERIMENT " + fields.join(" "))
}

async function payload(persistence: Pick<LocalStore, "readSnapshotRoot" | "currentSnapshot">,
  surface: Surface, deadline: Deadline): Promise<string> {
  if (!persistence.readSnapshotRoot || !persistence.currentSnapshot)
    throw new Error("Native snapshot methods are required")
  return persistence.readSnapshotRoot(async () => {
    deadline.check()
    const current = persistence.currentSnapshot?.(surface)
    if (!current) throw new Error("Native snapshot observation is required")
    // This is a fresh public copy under the original native owner. Only the
    // immutable original wire representation leaves this experimental read.
    return encodeSnapshot(current)
  }, { signal: deadline.signal })
}

function compareMaterialization(input: string, sample: number, deadline: Deadline) {
  const value = observation(sample)
  let source: string | undefined = input
  let normalized: Snapshot | undefined
  let plan: ReturnType<typeof experimentSnapshotPlan>
  let binary: ReturnType<typeof serialize> | undefined
  let left: unknown, right: unknown
  try {
    value.stage = 1
    deadline.check()
    // This is only a transient experiment cap; no product budget is changed.
    if (source.length > experimentMaterializationUnits) { value.status = 3; return }
    normalized = measure(value.decode, () => decodeSnapshot(source!))
    value.stage = 2
    plan = measure(value.plan, () => experimentSnapshotPlan(normalized!, source!))
    if (!plan?.copy) { value.status = 2; return }
    value.stage = 3
    binary = measure(value.serialize, () => serialize(normalized, { binaryType: "nodebuffer" }))
    if (binary.byteLength > experimentMaterializationUnits * 2) { value.status = 3; return }
    normalized = undefined

    const original = () => experimentMaterializeSnapshot(plan!, source!)
    const candidate = () => deserialize(binary!)
    const validate = (observed: unknown) => measure(value.validate, () => experimentValidateSnapshot(observed))
    const parity = (first: unknown, second: unknown) => {
      value.parity++
      const a = validate(first), b = validate(second)
      const equal = isDeepStrictEqual(a, b) && encodeSnapshot(a) === source && encodeSnapshot(b) === source
      if (!equal) { value.parityFailures++; throw new Error("Materialization parity failed") }
    }

    value.stage = 4
    left = original()
    right = candidate()
    parity(left, right)
    left = undefined; right = undefined
    value.warmup = 1
    value.stage = 5
    for (let pair = 0; pair < 4; pair++) {
      deadline.check()
      // Alternate AB/BA; no GC command, microtask drain, timer, or extra await.
      if (pair % 2 === 0) {
        left = measure(value.original, original)
        right = measure(value.binary, candidate)
      } else {
        right = measure(value.binary, candidate)
        left = measure(value.original, original)
      }
      value.pairs++
      parity(left, right)
      left = undefined; right = undefined
    }

    value.stage = 6
    left = validate(original())
    right = validate(candidate())
    const a = left as Snapshot, b = right as Snapshot
    const key = "__sf_materialization_experiment_only__"
    const isolated = a !== b && a.data !== b.data && !Object.hasOwn(a.data, key) && !Object.hasOwn(b.data, key)
    if (!isolated) { value.detachmentFailures++; throw new Error("Materialization copies were not independent") }
    Reflect.set(a.data, key, true)
    Reflect.set(b.data, key, false)
    left = undefined; right = undefined
    left = original()
    right = candidate()
    parity(left, right)
    value.detached = 2
    left = undefined; right = undefined
    deadline.check()
    value.stage = 7
    value.status = 1
  } catch {
    value.status = 4
    // The caller reports only a boolean failure, never an error carrying a graph.
    throw new Error("Native materialization experiment failed")
  } finally {
    // No buffer, graph or SQL string is retained across samples. This signals
    // reference release, not a claim that the VM has run garbage collection.
    source = undefined; normalized = undefined; plan = undefined; binary = undefined
    left = undefined; right = undefined
    value.released = 1
    emit(value)
  }
}

test("Experimental native snapshot materialization compares complete immutable payloads", async () => {
  expectSpawn(import.meta.path)
  const deadline = compositionTestDeadline("native-materialization-experiment")
  const outer = observation(0)
  let accepted = true
  try {
    outer.stage = 1
    const materiality = await sensitivityObservationFixture(deadline, "pending")
    outer.stage = 2
    compareMaterialization(await payload(materiality.persistence, "dashboard", deadline), 1, deadline)
    outer.stage = 3
    compareMaterialization(await payload(materiality.persistence, "planner", deadline), 2, deadline)

    outer.stage = 4
    const recall = await nativeMaterializationCaptureFixture(deadline)
    const atlas = recall.business.atlasRecall()
    if (!atlas) throw new Error("The original Atlas reader is required")
    const request = { caseRef: encodeCaseRef(recall.ref) }
    outer.stage = 5
    const receipt = await recall.ui("sf_case_read", request,
      (call) => recall.business.context.emitFromLedger(recall.outbox.eventRef, call))
    if (receipt.status !== "committed") throw new Error("The original publication must complete")
    outer.stage = 6
    if (!await recall.ui("sf_case_read", request, (call) =>
      atlas.memory.readOriginalCapture(recall.ref, recall.source.refDigest, call)))
      throw new Error("The original published capture must be readable")
    outer.stage = 7
    compareMaterialization(await payload(recall.persistence, "dashboard", deadline), 3, deadline)
    outer.stage = 8
  } catch {
    accepted = false
  } finally {
    try { await deadline.close() } catch { accepted = false }
    outer.status = accepted ? 1 : 4
    outer.released = 1
    emit(outer)
  }
  // A graph, path, reference, original error, digest or size can never enter an assertion diff.
  expect(accepted).toBe(true)
}, 120_000)
