import { expect, test } from "bun:test"
import { canonicalSfValue } from "../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { cloneSfCanonicalValues, sfCanonicalCloneTree, setSfCloneDescriptorDiagnosticBulk } from "../../../modules/sucafina/Sucafinav1/product/contracts/canonical-clone.ts"
import { plannerProjectionReference, plannerProjectionRows } from "./fixture/sucafina-planner-projection-loading.ts"

const define = Object.defineProperty

function fixtures(): { name: string; value: unknown; iterations: number }[] {
  const ref = plannerProjectionReference()
  const shared = { amount: -0, absent: undefined, nested: [null, true, 'quote"\n'] }
  const keys: Record<string, unknown> = Object.create(null)
  define(keys, "__proto__", { enumerable: true, value: { count: -0 } })
  keys[""] = undefined
  keys["\ud800"] = "\udc00"
  keys["\uffff"] = "emoji:\ud83d\ude00"
  keys["\ud83d\ude00"] = "control:\u0000\b\f\n\r\t\"\\"
  const rows = plannerProjectionRows(ref, 32)
  return [
    { name: "tagged-values", iterations: 1000, value: [keys, null, undefined, -0, 0, false, true,
      Number.MIN_VALUE, Number.MAX_VALUE, 1e21, 1e-7, "e\u0301", "\u00e9", "\u2028\u2029"] },
    { name: "evidence-reference", iterations: 1000, value: ref },
    { name: "captured-context", iterations: 500, value: { left: shared, right: shared,
      values: Array.from({ length: 32 }, (_, index) => ({ total: index, optional: undefined, active: true })) } },
    { name: "aliased-projection", iterations: 250, value: rows },
    { name: "distinct-projection", iterations: 250, value: rows.map((row) => structuredClone(row)) },
  ]
}


test("paired descriptor comparison measures native clone registration and full canonical encoding", () => {
  expect(Bun.version).toBe("1.3.14")
  expect(Bun.revision).toBe("0d9b296af33f2b851fcbf4df3e9ec89751734ba4")
  const clock = performance.now.bind(performance)
  const cases = fixtures()
  const rounded = (value: number) => {
    if (!Number.isFinite(value) || value < 0) throw new Error("Invalid monotonic diagnostic duration")
    return Math.round(value * 1000) / 1000
  }
  let lines = 0
  const emit = (data: object) => {
    const line = "SF_CLONE_DESCRIPTOR_DIAGNOSTIC " + JSON.stringify({
      schema: "sf-clone-descriptor-v2", qualification: false, fixtureOnly: true,
      sourceBase: "e78821194263260fd058a2a2648ef6a750ed24c5",
      runtime: { version: Bun.version, revision: Bun.revision }, ...data,
    })
    expect(++lines).toBeLessThanOrEqual(12)
    expect(line.length + 1).toBeLessThanOrEqual(4096)
    expect(/^[\x20-\x7e]+$/.test(line)).toBe(true)
    console.info(line)
  }
  emit({
    phase: "start", lanes: ["shared-bootstrap-per-key", "shared-bootstrap-bulk"],
    modes: ["native-clone-registration-and-canonical", "repeated-canonical-walk"],
    warmupIterationsPerLane: 50, pairs: 4, measurementsMultiplier: 4,
    fullCanonicalMeasured: true, nativeCloneMeasuredInFirstMode: true,
    baselineIncludesNewDescriptorPin: true, baselineIncludesModeBranch: true,
    originalRuntimeAdmissionWidened: false, snapshotOrGrantCacheAdded: false,
    installedPreviewMeasured: false, hasherMeasured: false,
    method: "Five original C14 shapes; pair order alternates; byte equality checked in every iteration; all guards included; mode selected outside timed batch",
  })
  let measuredCanonicalCalls = 0, measuredClones = 0
  for (const fixture of cases) {
    setSfCloneDescriptorDiagnosticBulk(false)
    const expected = canonicalSfValue(fixture.value)
    const initialOriginal = cloneSfCanonicalValues([fixture.value])[0]
    expect(sfCanonicalCloneTree(initialOriginal)).toBeDefined()
    setSfCloneDescriptorDiagnosticBulk(true)
    const initialBulk = (() => {
      try {
        const value = cloneSfCanonicalValues([fixture.value])[0]
        expect(sfCanonicalCloneTree(value)).toBeDefined()
        expect(canonicalSfValue(value)).toBe(expected)
        return value
      } finally { setSfCloneDescriptorDiagnosticBulk(false) }
    })()
    expect(canonicalSfValue(initialOriginal)).toBe(expected)
    for (const mode of ["native-clone-registration-and-canonical", "repeated-canonical-walk"]) {
      const run = (bulk: boolean, iterations: number) => {
        setSfCloneDescriptorDiagnosticBulk(bulk)
        try {
          const repeated = bulk ? initialBulk : initialOriginal
          let units = 0, last = ""
          const start = clock()
          for (let iteration = 0; iteration < iterations; iteration++) {
            const value = mode === "repeated-canonical-walk" ? repeated : cloneSfCanonicalValues([fixture.value])[0]
            last = canonicalSfValue(value)
            if (last !== expected) throw new Error("Canonical bytes changed during diagnostic")
            units += last.length
          }
          const ms = rounded(clock() - start)
          expect(units).toBe(expected.length * iterations)
          expect(last).toBe(expected)
          return ms
        } finally { setSfCloneDescriptorDiagnosticBulk(false) }
      }
      run(false, 50)
      run(true, 50)
      const pairs: { first: string; originalMs: number; bulkMs: number; ratio: number }[] = []
      for (const bulkFirst of [false, true, false, true]) {
        const first = run(bulkFirst, fixture.iterations * 4)
        const second = run(!bulkFirst, fixture.iterations * 4)
        const originalMs = bulkFirst ? second : first
        const bulkMs = bulkFirst ? first : second
        pairs.push({ first: bulkFirst ? "bulk" : "original", originalMs, bulkMs,
          ratio: rounded(bulkMs / Math.max(originalMs, 0.001)) })
        measuredCanonicalCalls += fixture.iterations * 4
        if (mode === "native-clone-registration-and-canonical") measuredClones += fixture.iterations * 4
      }
      emit({ phase: "fixture", fixture: fixture.name, mode, outputUnits: expected.length,
        iterationsPerLane: fixture.iterations * 4, pairs })
    }
  }
  emit({ phase: "complete", fixtures: cases.length, modes: 2,
    measuredCanonicalCallsPerLane: measuredCanonicalCalls, measuredNativeClonesPerLane: measuredClones,
    timeThresholdApplied: false, productAdoption: false })
}, 120_000)
