import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { createHash } from "node:crypto"
import { join } from "node:path"
import type { Snapshot } from "../../../runtime/contract.ts"
import type { Surface } from "../../../src/identity.ts"
import { readPortfolioSnapshot } from "../../../product/portfolio/read-snapshot.ts"
import { createCanonicalReadFixture } from "./canonical-fixture.ts"

type Fixture = Awaited<ReturnType<typeof createCanonicalReadFixture>>
type Row = { __readonlyRootSurface: Surface; index: number; amount: number; detail: { label: string; active: boolean; values: number[] } }
const surfaces = ["dashboard", "planner", "procurement"] as const
const rowCount = 160
const observations = 6
const hash = (value: string) => createHash("sha256").update(value).digest("hex")
const counts = () => ({ dashboard: 0, planner: 0, procurement: 0 })

function consume(snapshot: Snapshot, surface: Surface) {
  const rows = snapshot.data.readonlyRootRows as Row[]
  if (snapshot.data.marker !== surface || !Array.isArray(rows) || rows.length !== rowCount) throw new Error("Readonly cost fixture shape changed")
  let digest = 0
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]!
    if (row.__readonlyRootSurface !== surface || row.index !== index || row.amount !== 1000 + index ||
      row.detail.label !== `${surface}-row-${index}` || row.detail.active !== (index % 2 === 0) ||
      row.detail.values.length !== 2 || row.detail.values[0] !== index || row.detail.values[1] !== index + 1)
      throw new Error("Readonly cost fixture lost data or copy isolation")
    digest += row.amount + row.detail.values[0]! + row.detail.values[1]!
  }
  // Every following observation must still consume the original value.
  rows[0]!.amount = -1
  rows[0]!.detail.values[0] = -1
  return digest
}

async function workload(fixture: Fixture, variant: "legacy" | "capability", probe: { active: boolean }) {
  const persistence = variant === "legacy" ? fixture.legacyPersistence : fixture.capablePersistence
  const host = { ...fixture.host, persistence }
  const work = { callbacks: 0, nested: counts(), observations: 0, consumedRows: counts(), digest: 0, order: [] as string[] }
  const retained: Partial<Record<Surface, Snapshot>> = {}
  fixture.resetMetrics()
  const started = performance.now()
  const accepted = await fixture.withinFence(() => readPortfolioSnapshot(host, fixture.context, {}, async () => {
    work.callbacks++
    probe.active = true
    try {
      for (let observation = 0; observation < observations; observation++) {
        for (const surface of ["dashboard", "planner", "dashboard", "procurement"] as const) {
          await persistence.transaction(surface, async (snapshot) => {
            work.callbacks++
            work.nested[surface]++
            work.order.push(surface)
            if (retained[surface] === snapshot || retained[surface]?.data === snapshot.data) throw new Error("Readonly observation shared a mutable graph")
            work.digest += consume(snapshot, surface)
            work.consumedRows[surface] += rowCount
            retained[surface] = snapshot
            return { commit: false, value: undefined }
          })
        }
        const current = persistence.currentSnapshots!()
        if (!current) throw new Error("Readonly observation disappeared")
        work.observations++
        work.order.push("current:all")
        for (const surface of surfaces) {
          if (retained[surface] === current[surface] || retained[surface]?.data === current[surface].data)
            throw new Error("Readonly currentSnapshots shared a mutable graph")
          work.digest += consume(current[surface], surface)
          work.consumedRows[surface] += rowCount
          retained[surface] = current[surface]
        }
      }
      return true
    } finally { probe.active = false }
  }, false))
  const elapsedMs = performance.now() - started
  if (!accepted) throw new Error("Canonical readonly cost workload was refused")
  expect(fixture.metrics.roots).toBe(variant === "capability" ? 1 : 0)
  const { roots: _roots, ...metrics } = structuredClone(fixture.metrics)
  return { variant, elapsedMs, summary: { ...work, order: hash(work.order.join("\n")), metrics } }
}

function countWork(probe: { active: boolean }) {
  const descriptors = Object.getOwnPropertyDescriptors
  const parse = JSON.parse
  const result = { descriptors: 0, markedObjects: counts(), parseCalls: 0, parseCharacters: 0, wireParses: 0 }
  Object.getOwnPropertyDescriptors = ((value: object) => {
    const observed = descriptors(value)
    if (probe.active) {
      result.descriptors++
      const surface: unknown = observed.__readonlyRootSurface?.value
      if (surface === "dashboard" || surface === "planner" || surface === "procurement") result.markedObjects[surface]++
    }
    return observed
  }) as typeof Object.getOwnPropertyDescriptors
  JSON.parse = (...args: Parameters<typeof JSON.parse>) => {
    if (probe.active) {
      result.parseCalls++
      result.parseCharacters += args[0].length
      if (args[0].startsWith('["sucafina-snapshot",1,')) result.wireParses++
    }
    return parse(...args)
  }
  return { result, restore: () => { Object.getOwnPropertyDescriptors = descriptors; JSON.parse = parse } }
}

function distribution(samples: number[]) {
  const ordered = [...samples].sort((left, right) => left - right)
  return { samples, min: ordered[0], median: (ordered[1]! + ordered[2]!) / 2, max: ordered.at(-1) }
}

// One serial test, same driver/SQLite/guards, alternating AB/BA order. Timed
// samples use native functions. Pass-through probes run separately and only
// attribute synchronous descriptor/parsing work inside the unchanged workload.
test("readonly root removes defensive Dashboard traversal with equivalent real SQLite Source and CurrentChoice work", async () => {
  const fixture = await createCanonicalReadFixture({ rows: rowCount })
  try {
    const persisted = () => {
      const db = new Database(join(fixture.directory, "installation.sqlite"), { strict: true })
      try {
        return surfaces.map((surface) => {
          const row = db.query<{ payload: string }, [string]>("SELECT payload FROM snapshots WHERE surface = ?").get(surface)
          if (!row) throw new Error("Readonly cost fixture SQL row missing")
          return { surface, characters: row.payload.length, sha256: hash(row.payload) }
        })
      } finally { db.close() }
    }
    const before = persisted()
    const probe = { active: false }
    const expected = (await workload(fixture, "legacy", probe)).summary
    expect((await workload(fixture, "capability", probe)).summary).toEqual(expected)
    expect(expected.callbacks).toBe(25)
    expect(expected.nested).toEqual({ dashboard: 12, planner: 6, procurement: 6 })
    expect(expected.observations).toBe(6)
    expect(expected.consumedRows).toEqual({ dashboard: 2880, planner: 1920, procurement: 1920 })
    expect(expected.metrics.transactions).toEqual({ dashboard: 13, planner: 6, procurement: 6 })
    expect(expected.metrics.callbacks).toEqual(expected.metrics.transactions)
    const samples: { variant: "legacy" | "capability"; elapsedMs: number }[] = []
    for (let pair = 0; pair < 4; pair++) {
      const order = pair % 2 === 0 ? ["legacy", "capability"] as const : ["capability", "legacy"] as const
      for (const variant of order) {
        const observed = await workload(fixture, variant, probe)
        expect(observed.summary).toEqual(expected)
        samples.push({ variant, elapsedMs: observed.elapsedMs })
      }
    }
    const structural: Partial<Record<"legacy" | "capability", ReturnType<typeof countWork>["result"]>> = {}
    for (const variant of ["legacy", "capability"] as const) {
      const counter = countWork(probe)
      try {
        expect((await workload(fixture, variant, probe)).summary).toEqual(expected)
        structural[variant] = counter.result
      } finally { counter.restore() }
    }
    expect(structural.legacy!.markedObjects.dashboard).toBeGreaterThan(0)
    expect(structural.capability!.markedObjects.dashboard).toBe(0)
    expect(structural.legacy!.markedObjects.planner).toBe(0)
    expect(structural.legacy!.markedObjects.procurement).toBe(0)
    expect(structural.capability!.markedObjects.planner).toBe(0)
    expect(structural.capability!.markedObjects.procurement).toBe(0)
    expect(structural.capability!.wireParses).toBe(0)
    expect(persisted()).toEqual(before)
    const metrics = { ...expected.metrics, events: hash(expected.metrics.events.join("\n")) }
    console.log("RUNTIME59_COST " + JSON.stringify({
      schema: "sf2h.runtime-readonly-root.cost.v1", rowsPerSurface: rowCount, observations, persisted: before,
      work: { ...expected, metrics }, samples, structural,
      legacy: distribution(samples.filter((sample) => sample.variant === "legacy").map((sample) => sample.elapsedMs)),
      capability: distribution(samples.filter((sample) => sample.variant === "capability").map((sample) => sample.elapsedMs)),
      limitations: "One hosted runner, four AB/BA pairs, descriptive timing only; no elapsed-time/ratio assertion, heap estimate, P03 result or clone-only CPU claim. Structural probe excludes root admission and final publication, keeps real wrappers, and is restored before reporting.",
    }))
  } finally { await fixture.close() }
}, 120000)
