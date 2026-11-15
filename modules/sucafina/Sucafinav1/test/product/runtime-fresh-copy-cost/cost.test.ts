import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { createHash } from "node:crypto"
import { join } from "node:path"
import type { Snapshot } from "../../../runtime/contract.ts"
import type { LocalStore } from "../../../runtime/local-contract.ts"
import { decodeSnapshot, encodeSnapshot } from "../../../runtime/local-store.ts"
import { current, surfaces, withStores } from "./fixture.ts"

type Surface = typeof surfaces[number]
type Phase = "admission" | "copies" | "callback" | "settlement"
type Snapshots = Record<Surface, Snapshot>
type Row = {
  __runtimeFreshCopySurface: Surface
  index: number
  amount: number
  quantity: number
  label: string
  detail: {
    __runtimeFreshCopySurface: Surface
    weight: number
    tags: number[]
    optional: undefined
    minusZero: number
  }
}

const rowCounts: Record<Surface, number> = { dashboard: 300, planner: 1200, procurement: 400 }
const pairs = 6
const observationsPerRoot = 20
const marker = "__runtimeFreshCopySurface"
const phases: Phase[] = ["admission", "copies", "callback", "settlement"]
const hash = (value: string) => createHash("sha256").update(value).digest("hex")
const surfaceCounts = (): Record<Surface, number> => ({ dashboard: 0, planner: 0, procurement: 0 })

function fixtureRows(surface: Surface): Row[] {
  return Array.from({ length: rowCounts[surface] }, (_, index) => ({
    __runtimeFreshCopySurface: surface,
    index,
    amount: 1000 + index * 7,
    quantity: index + 1,
    label: `${surface}:${index}:fixed-payload-with-identical-fields-in-both-revisions`,
    detail: {
      __runtimeFreshCopySurface: surface,
      weight: (index % 11) + 0.5,
      tags: [index, index + 1, index + 2],
      optional: undefined,
      minusZero: -0,
    },
  }))
}

function rows(snapshot: Snapshot): Row[] {
  if (!Array.isArray(snapshot.data.records)) throw new Error("Cost fixture records missing")
  return snapshot.data.records as Row[]
}

// Every callback consumes every row. The root's live change affects only its
// first row; copied/nested mutations must never appear in a later observation.
function verify(snapshot: Snapshot, surface: Surface, changed: boolean): number {
  const records = rows(snapshot)
  if (records.length !== rowCounts[surface] || snapshot.data.surface !== surface || snapshot.data.revision !== (changed ? 1 : 0))
    throw new Error(`Cost fixture changed shape or revision: ${surface}`)
  let digest = 0
  for (let index = 0; index < records.length; index++) {
    const item = records[index]!
    const amount = 1000 + index * 7 + (changed && index === 0 ? 13 : 0)
    if (item[marker] !== surface || item.index !== index || item.amount !== amount || item.quantity !== index + 1 ||
        item.label !== `${surface}:${index}:fixed-payload-with-identical-fields-in-both-revisions` ||
        item.detail[marker] !== surface || item.detail.weight !== (index % 11) + 0.5 ||
        item.detail.tags.length !== 3 || item.detail.tags[0] !== index || item.detail.tags[1] !== index + 1 || item.detail.tags[2] !== index + 2 ||
        !Object.hasOwn(item.detail, "optional") || item.detail.optional !== undefined || !Object.is(item.detail.minusZero, -0))
      throw new Error(`Cost fixture lost data, freshness, or normalization: ${surface}/${index}`)
    digest += item.amount + item.quantity + item.detail.weight + item.detail.tags[0]! + item.detail.tags[1]! + item.detail.tags[2]!
  }
  return digest
}

function changeCopy(snapshot: Snapshot, offset: number) {
  const item = rows(snapshot)[1]!
  item.amount = -1000 - offset
  item.detail.weight = -2000 - offset
  item.detail.tags[0] = -3000 - offset
}

function independent(left: Snapshot, right: Snapshot) {
  expect(left).not.toBe(right)
  expect(left.data).not.toBe(right.data)
  expect(rows(left)).not.toBe(rows(right))
  expect(rows(left)[0]).not.toBe(rows(right)[0])
  expect(rows(left)[0]!.detail).not.toBe(rows(right)[0]!.detail)
  expect(rows(left)[0]!.detail.tags).not.toBe(rows(right)[0]!.detail.tags)
}

type Work = {
  counts: { root: number; nested: Record<Surface, number>; current: number; callbacks: number; consumedRows: Record<Surface, number> }
  digest: number
  order: string[]
  timing: { totalWallMs: number; rootAdmissionWallMs: number; nestedBeforeCallbackSyncMs: number; currentSnapshotsSyncMs: number; callbackSyncMs: number }
}

async function workload(store: LocalStore, probe: { phase: Phase }): Promise<Work> {
  const result: Work = {
    counts: { root: 0, nested: surfaceCounts(), current: 0, callbacks: 0, consumedRows: surfaceCounts() },
    digest: 0,
    order: [],
    timing: { totalWallMs: 0, rootAdmissionWallMs: 0, nestedBeforeCallbackSyncMs: 0, currentSnapshotsSyncMs: 0, callbackSyncMs: 0 },
  }
  const callback = <T>(body: () => T): T => {
    probe.phase = "callback"
    const started = performance.now()
    try { return body() } finally { result.timing.callbackSyncMs += performance.now() - started }
  }
  const consume = (snapshot: Snapshot, surface: Surface, changed: boolean) => {
    result.digest += verify(snapshot, surface, changed)
    result.counts.consumedRows[surface] += rowCounts[surface]
  }
  const nestedCopies: Partial<Record<Surface, Snapshot>> = {}
  let previous: Snapshots | undefined
  let first: Snapshots | undefined
  probe.phase = "admission"
  const started = performance.now()
  await store.transaction("dashboard", async (root) => {
    result.timing.rootAdmissionWallMs = performance.now() - started
    callback(() => {
      result.counts.root++
      result.counts.callbacks++
      result.order.push("root:dashboard")
      consume(root, "dashboard", false)
    })
    for (let observation = 0; observation < observationsPerRoot; observation++) {
      // Fixed order: three planner reads, one procurement read, one complete
      // observation. No driver replacement, skipped callback, or reduced load.
      for (const surface of ["planner", "planner", "planner", "procurement"] as const) {
        probe.phase = "copies"
        const beforeNested = performance.now()
        await store.transaction(surface, async (snapshot) => {
          // Nested callbacks enter synchronously after the fresh copy. This is
          // measured before callback work, never as an inclusive await span.
          result.timing.nestedBeforeCallbackSyncMs += performance.now() - beforeNested
          callback(() => {
            result.counts.nested[surface]++
            result.counts.callbacks++
            result.order.push(`nested:${surface}`)
            consume(snapshot, surface, false)
            const prior = nestedCopies[surface]
            if (prior) independent(snapshot, prior)
            if (previous) independent(snapshot, previous[surface])
            changeCopy(snapshot, observation)
            nestedCopies[surface] = snapshot
          })
          probe.phase = "settlement"
          return { commit: false, value: undefined }
        })
      }
      probe.phase = "copies"
      const beforeCurrent = performance.now()
      const observed = current(store)
      result.timing.currentSnapshotsSyncMs += performance.now() - beforeCurrent
      callback(() => {
        result.counts.current++
        result.order.push("current:all")
        for (const surface of surfaces) {
          consume(observed[surface], surface, surface === "dashboard" && observation > 0)
          if (previous) independent(observed[surface], previous[surface])
          const nested = nestedCopies[surface]
          if (nested) independent(observed[surface], nested)
          changeCopy(observed[surface], observation)
        }
        independent(observed.dashboard, root)
        if (observation === 0) {
          first = observed
          root.data.revision = 1
          rows(root)[0]!.amount += 13
        }
        // The first observation survives live root mutation and all later
        // materializations. Its own row-1 mutation is intentionally retained.
        expect(first!.dashboard.data.revision).toBe(0)
        expect(rows(first!.dashboard)[0]!.amount).toBe(1000)
        expect(rows(first!.dashboard)[1]!.amount).toBe(-1000)
        previous = observed
      })
    }
    probe.phase = "settlement"
    return { commit: false, value: undefined }
  })
  result.timing.totalWallMs = performance.now() - started
  return result
}

type PhaseWork = { descriptorCalls: number; descriptorObjectsBySurface: Record<Surface, number>; parseCalls: number; parseCharacters: number; wireParseCalls: number }
type ProbeWork = Record<Phase, PhaseWork>

function countWork(probe: { phase: Phase }, output: ProbeWork): () => void {
  const descriptors = Object.getOwnPropertyDescriptors
  const parse = JSON.parse
  Object.getOwnPropertyDescriptors = ((value: object) => {
    const result = descriptors(value)
    const phase = output[probe.phase]
    phase.descriptorCalls++
    const surface: unknown = result[marker]?.value
    if (surface === "dashboard" || surface === "planner" || surface === "procurement") phase.descriptorObjectsBySurface[surface]++
    return result
  }) as typeof Object.getOwnPropertyDescriptors
  JSON.parse = (...args: Parameters<typeof JSON.parse>) => {
    const phase = output[probe.phase]
    phase.parseCalls++
    phase.parseCharacters += args[0].length
    if (args[0].startsWith('["sucafina-snapshot",1,')) phase.wireParseCalls++
    return parse(...args)
  }
  return () => {
    Object.getOwnPropertyDescriptors = descriptors
    JSON.parse = parse
  }
}

function summary(work: Work) {
  return { counts: work.counts, digest: work.digest, orderHash: hash(work.order.join("\n")) }
}

function distribution(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  return { samples: values, min: sorted[0], median: (sorted[5]! + sorted[6]!) / 2, max: sorted.at(-1) }
}

// One serial test; wrappers exist only for the final, separately labelled work
// accounting pass and are restored before logging/assertions. All timed pairs
// execute with the native globals, in exactly the same fixed workload order.
test("real SQLite fresh-copy workload preserves load while warm non-target copies avoid descriptor traversal", async () => {
  await withStores(async (directory, open) => {
    let store = await open()
    for (const surface of surfaces) {
      await store.transaction(surface, async (snapshot) => {
        snapshot.data = { surface, revision: 0, records: fixtureRows(surface) }
        snapshot.versions.fixture = { version: 1, by: "runtime-fresh-copy-cost" }
        snapshot.sequences.fixture = rowCounts[surface]
        snapshot.audit = [{ who: "fixture", at: "2026-11-14", record: surface, was: undefined, became: "cost-fixture" }]
        snapshot.notices = [{ kind: "pending", to: ["fixture"], record: surface, at: "2026-11-14" }]
        return { commit: true, value: undefined }
      })
    }
    await store.dispose()
    store = await open()
    const inspectPersisted = () => {
      const db = new Database(join(directory, "installation.sqlite"), { strict: true })
      try {
        return Object.fromEntries(surfaces.map((surface) => {
          const row = db.query<{ payload: string }, [string]>("SELECT payload FROM snapshots WHERE surface = ?").get(surface)
          if (!row) throw new Error(`Missing persisted ${surface}`)
          const decoded = decodeSnapshot(row.payload)
          const digest = verify(decoded, surface, false)
          // Full wire bytes and data counts are checked outside timed/probed
          // work. The same file supplies these inputs to preimage and product.
          expect(encodeSnapshot(decoded)).toBe(row.payload)
          return [surface, { rows: rows(decoded).length, characters: row.payload.length, sha256: hash(row.payload), digest }]
        })) as Record<Surface, { rows: number; characters: number; sha256: string; digest: number }>
      } finally { db.close() }
    }
    const persisted = inspectPersisted()
    const probe: { phase: Phase } = { phase: "admission" }
    const expectedOrder = ["root:dashboard", ...Array.from({ length: observationsPerRoot }, () => ["nested:planner", "nested:planner", "nested:planner", "nested:procurement", "current:all"]).flat()]
    const expected = {
      counts: {
        root: 1, nested: { dashboard: 0, planner: 60, procurement: 20 }, current: 20, callbacks: 81,
        consumedRows: { dashboard: 6300, planner: 96000, procurement: 16000 },
      },
      digest: persisted.dashboard.digest * 21 + persisted.planner.digest * 80 + persisted.procurement.digest * 40 + 13 * 19,
      orderHash: hash(expectedOrder.join("\n")),
    }
    const warmup = await workload(store, probe)
    expect(summary(warmup)).toEqual(expected)
    const timed: { pair: number; member: "first" | "second"; work: Work }[] = []
    for (let pair = 0; pair < pairs; pair++) {
      for (const member of ["first", "second"] as const) {
        const work = await workload(store, probe)
        expect(summary(work)).toEqual(expected)
        timed.push({ pair, member, work })
      }
    }
    const instrumented = Object.fromEntries(phases.map((phase) => [phase, {
      descriptorCalls: 0, descriptorObjectsBySurface: surfaceCounts(), parseCalls: 0, parseCharacters: 0, wireParseCalls: 0,
    }])) as ProbeWork
    const restore = countWork(probe, instrumented)
    let accounted: Work
    try { accounted = await workload(store, probe) } finally { restore() }
    expect(summary(accounted)).toEqual(expected)
    expect(inspectPersisted()).toEqual(persisted)
    await store.dispose()
    store = await open()
    await store.transaction("dashboard", async () => {
      const reopened = current(store)
      for (const surface of surfaces) expect(verify(reopened[surface], surface, false)).toBe(persisted[surface].digest)
      return { commit: false, value: undefined }
    })
    const timings = Object.fromEntries((Object.keys(timed[0]!.work.timing) as (keyof Work["timing"])[]).map((name) => [name, distribution(timed.map((sample) => sample.work.timing[name]))]))
    console.log("RUNTIME_FRESH_COPY_COST", JSON.stringify({
      schema: "runtime-fresh-copy-cost/v1", runtime: { bun: Bun.version, platform: process.platform, arch: process.arch },
      workload: { rowCounts, timedPairs: pairs, measuredRoots: timed.length, warmupRoots: 1, instrumentedRoots: 1, perRoot: expected },
      persisted, measured: timed.map(({ pair, member, work }) => ({ pair, member, timing: work.timing })), timings,
      work: instrumented,
      limits: {
        timing: "Native globals in all 12 timed roots; wrappers only in one separate work-accounting root. No timing-ratio assertion.",
        attribution: "Nested admission and currentSnapshots are disjoint synchronous spans; callbackSyncMs excludes them. rootAdmissionWallMs and totalWallMs are wall observations, not additive copy costs.",
        scope: "Real SQLite/local-store synthetic workload. This is not a Portfolio/P03 run or a proof of composed product latency.",
      },
    }))
    expect(instrumented.admission.wireParseCalls + instrumented.copies.wireParseCalls).toBe(0)
    expect(instrumented.copies.descriptorObjectsBySurface.dashboard).toBeGreaterThan(0)
    // Deliberate last oracle: the unmodified preimage prints the same workload
    // and passes semantic checks above, then fails here because it traverses
    // immutable non-target graphs on every nested/current fresh observation.
    expect(instrumented.copies.descriptorObjectsBySurface.planner + instrumented.copies.descriptorObjectsBySurface.procurement).toBe(0)
  })
}, 60000)
