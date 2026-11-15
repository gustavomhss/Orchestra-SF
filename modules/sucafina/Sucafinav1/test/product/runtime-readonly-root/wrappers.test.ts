import { expect, test } from "bun:test"
import type { Surface } from "../../../src/identity.ts"
import { readPortfolioSnapshot } from "../../../product/portfolio/read-snapshot.ts"
import { createCanonicalReadFixture } from "./canonical-fixture.ts"

const surfaces: readonly Surface[] = ["dashboard", "planner", "procurement"]

for (const wrapper of ["source", "fence"] as const) test(`readonly root preserves canonical ${wrapper} callbacks, observations and authorizations against legacy on the same SQLite`, async () => {
  const fixture = await createCanonicalReadFixture({ wrapper })
  try {
    expect(typeof fixture.capablePersistence.readSnapshotRoot).toBe("function")
    expect(Object.hasOwn(fixture.legacyPersistence, "readSnapshotRoot")).toBe(false)
    const records: unknown[] = []
    for (const persistence of [fixture.legacyPersistence, fixture.capablePersistence]) {
      fixture.resetMetrics()
      const host = { ...fixture.host, persistence }
      let work = 0
      let joined = 0
      let observers = 0
      const accepted = await fixture.withinFence(async () => {
        fixture.fence.observe(fixture.context, (snapshots) => {
          observers++
          return surfaces.every((surface) => snapshots[surface].data.marker === surface)
        })
        return readPortfolioSnapshot(host, fixture.context, {}, async () => {
          work++
          for (const surface of surfaces) {
            const marker = await persistence.transaction(surface, async (snapshot) => ({ commit: false, value: snapshot.data.marker }))
            if (marker !== surface) return false
          }
          return readPortfolioSnapshot(host, fixture.context, {}, async () => { joined++; return true }, false)
        }, false)
      })
      expect(accepted).toBe(true)
      expect(work).toBe(1)
      expect(joined).toBe(1)
      expect(observers).toBeGreaterThan(0)
      expect(fixture.metrics.transactions).toEqual({ dashboard: 2, planner: 1, procurement: 1 })
      expect(fixture.metrics.callbacks).toEqual({ dashboard: 2, planner: 1, procurement: 1 })
      records.push({ observers, ...structuredClone(fixture.metrics), roots: 0 })
      expect(fixture.metrics.roots).toBe(persistence === fixture.capablePersistence ? 1 : 0)
    }
    expect(records[1]).toEqual(records[0])
  } finally { await fixture.close() }
})

for (const legacy of [true, false]) test(`readonly root keeps the Dashboard source anchor with partial metadata (${legacy ? "legacy" : "capability"})`, async () => {
  const fixture = await createCanonicalReadFixture({ legacy, initialized: ["procurement"] })
  try {
    let work = 0
    expect(await fixture.read(async () => { work++; return true })).toBe(false)
    expect(work).toBe(0)
    expect(fixture.metrics.transactions.dashboard).toBe(1)
    expect(fixture.metrics.callbacks.dashboard).toBe(0)
    expect(fixture.metrics.transactions.procurement).toBe(0)
  } finally { await fixture.close() }
})

for (const legacy of [true, false]) test(`readonly root admits unobserved partial source metadata without inventing new guards (${legacy ? "legacy" : "capability"})`, async () => {
  const fixture = await createCanonicalReadFixture({ legacy, initialized: ["dashboard"] })
  try {
    expect(await fixture.read(async () => true)).toBe(true)
    expect(fixture.metrics.callbacks).toEqual({ dashboard: 1, planner: 0, procurement: 0 })
    expect(fixture.metrics.revalidations).toBe(1)
    const snapshots = await fixture.driver.transaction("dashboard", async () => ({ commit: false, value: fixture.driver.currentSnapshots!() }))
    expect(snapshots?.dashboard.sfSources?.schemaVersion).toBe(1)
    expect(snapshots?.planner.sfSources).toBeUndefined()
    expect(snapshots?.procurement.sfSources).toBeUndefined()
  } finally { await fixture.close() }
})

for (const surface of surfaces) for (const damage of ["missing", "record", "scope"] as const) test(`readonly root preserves the ${surface} source guard for ${damage} metadata`, async () => {
  const fixture = await createCanonicalReadFixture()
  try {
    await fixture.driver.transaction(surface, async (snapshot) => {
      if (damage === "missing") delete snapshot.sfSources
      if (damage === "record") snapshot.sfSources!.records[JSON.stringify(["readonly-fixture", surface])]!.version = 0
      if (damage === "scope") Reflect.set(snapshot.sfSources!, "scopes", { corrupt: { version: 1 } })
      return { commit: true, value: undefined }
    })
    const observations: unknown[] = []
    for (const persistence of [fixture.legacyPersistence, fixture.capablePersistence]) {
      fixture.resetMetrics()
      let work = 0
      let target = 0
      const accepted = await readPortfolioSnapshot({ ...fixture.host, persistence }, fixture.context, {}, async () => {
        work++
        return persistence.transaction(surface, async () => { target++; return { commit: false, value: true } })
      }, false)
      expect(accepted).toBe(false)
      expect(work).toBe(surface === "dashboard" ? 0 : 1)
      expect(target).toBe(0)
      expect(fixture.metrics.callbacks[surface]).toBe(0)
      observations.push({ ...structuredClone(fixture.metrics), roots: 0 })
    }
    expect(observations[1]).toEqual(observations[0])
  } finally { await fixture.close() }
})

for (const wrapper of ["source", "fence"] as const) test(`readonly root cannot return success before the canonical ${wrapper} publication guard`, async () => {
  const fixture = await createCanonicalReadFixture({ wrapper })
  try {
    let result: boolean | undefined
    let observers = 0
    await expect(fixture.withinFence(async () => {
      fixture.fence.observe(fixture.context, () => { observers++; return false })
      result = await fixture.read(async () => true)
      return result
    })).rejects.toThrow("SF_CURRENT_CHOICE_FENCE_CHANGED")
    expect(result).toBe(false)
    expect(observers).toBeGreaterThan(0)
    expect(fixture.metrics.transactions.dashboard).toBe(1)
    expect(fixture.metrics.callbacks.dashboard).toBe(1)
  } finally { await fixture.close() }
})

for (const drift of ["installation", "project", "request", "authorization", "lease"] as const) test(`readonly root refuses ${drift} drift across a canonical read`, async () => {
  const fixture = await createCanonicalReadFixture()
  try {
    let work = 0
    const accepted = await fixture.read(async () => {
      work++
      if (drift === "installation") fixture.identity.installationId = "different-installation"
      if (drift === "project") fixture.identity.projectId = "different-project"
      if (drift === "request") fixture.controls.requestOverride = new Request(fixture.request.url, { headers: fixture.request.headers })
      if (drift === "authorization") fixture.controls.enabled = false
      if (drift === "lease") fixture.ui.finish(fixture.context)
      return true
    })
    expect(work).toBe(1)
    expect(accepted).toBe(false)
    expect(fixture.request.signal.aborted).toBe(false)
  } finally { await fixture.close() }
})

for (const field of ["installationId", "projectId"] as const) for (const wrapper of ["source", "fence"] as const) test(`readonly root preserves ${wrapper} installation fencing when ${field} changes but UI authority stays valid`, async () => {
  const fixture = await createCanonicalReadFixture({ wrapper })
  try {
    let result: boolean | undefined
    await expect(fixture.withinFence(async () => {
      result = await fixture.read(async () => {
        fixture.controls.identityOverride = {
          installationId: fixture.identity.installationId, projectId: fixture.identity.projectId, [field]: "other-installation-context",
        }
        return true
      })
      return result
    })).rejects.toThrow("SF_CURRENT_CHOICE_FENCE_CHANGED")
    expect(result).toBe(false)
    expect(await fixture.ui.revalidate(fixture.context)).toBe(true)
    expect(fixture.ui.requestFor(fixture.context)).toBe(fixture.request)
  } finally { await fixture.close() }
})

for (const wrapper of ["source", "fence"] as const) for (const legacy of [true, false]) test(`readonly root preserves caught-write poison through ${wrapper} (${legacy ? "legacy" : "capability"})`, async () => {
  const fixture = await createCanonicalReadFixture({ wrapper, legacy })
  try {
    let caught = 0
    expect(await fixture.read(async () => {
      await fixture.persistence.transaction("procurement", async (snapshot) => {
        snapshot.data.marker = "attempted-write"
        return { commit: true, value: true }
      }).catch(() => { caught++; return false })
      return true
    })).toBe(false)
    expect(caught).toBe(1)
    expect(fixture.metrics.callbacks.procurement).toBe(1)
    expect(await fixture.driver.transaction("procurement", async (snapshot) => ({ commit: false, value: snapshot.data.marker }))).toBe("procurement")
  } finally { await fixture.close() }
})

test("readonly root keeps the final host revalidation after the work callback", async () => {
  const fixture = await createCanonicalReadFixture()
  try {
    let workFinished = false
    fixture.controls.onRevalidate = () => {
      expect(workFinished).toBe(true)
      fixture.controls.enabled = false
    }
    expect(await fixture.read(async () => { workFinished = true; return true })).toBe(false)
    expect(fixture.metrics.revalidations).toBe(1)
    expect(fixture.metrics.authorizations).toBe(1)
  } finally { await fixture.close() }
})

test("readonly root joins only the helper's matching own scope and keeps the nested authorization", async () => {
  const fixture = await createCanonicalReadFixture()
  try {
    let foreign = 0
    const refused = await fixture.persistence.transaction("dashboard", async () => ({
      commit: false, value: await fixture.read(async () => { foreign++; return true }),
    }))
    expect(refused).toBe(false)
    expect(foreign).toBe(0)
    fixture.resetMetrics()
    let nested = 0
    expect(await fixture.read(async () => fixture.read(async () => { nested++; return true }))).toBe(true)
    expect(nested).toBe(1)
    expect(fixture.metrics.roots).toBe(1)
    expect(fixture.metrics.transactions.dashboard).toBe(1)
    expect(fixture.metrics.callbacks.dashboard).toBe(1)
    expect(fixture.metrics.revalidations).toBe(2)
  } finally { await fixture.close() }
})

for (const legacy of [true, false]) test(`readonly root pins capability identity during the read (${legacy ? "legacy" : "capability"})`, async () => {
  const fixture = await createCanonicalReadFixture({ legacy })
  try {
    const original = fixture.persistence.readSnapshotRoot
    const capability = fixture.capablePersistence.readSnapshotRoot
    if (!capability) throw new Error("Readonly fixture capability unavailable")
    const accepted = await fixture.read(async () => {
      if (legacy) fixture.persistence.readSnapshotRoot = capability
      if (!legacy) delete fixture.persistence.readSnapshotRoot
      return true
    })
    expect(accepted).toBe(false)
    expect(fixture.metrics.callbacks.dashboard).toBe(1)
    if (original) fixture.persistence.readSnapshotRoot = original
    if (!original) delete fixture.persistence.readSnapshotRoot
  } finally { await fixture.close() }
})

test("legacy persistence remains usable after unrelated capability-backed reads", async () => {
  const fixture = await createCanonicalReadFixture()
  try {
    expect(await fixture.read(async () => true)).toBe(true)
    fixture.resetMetrics()
    expect(await readPortfolioSnapshot({ ...fixture.host, persistence: fixture.legacyPersistence }, fixture.context, {}, async () => true, false)).toBe(true)
    expect(fixture.metrics.roots).toBe(0)
    expect(fixture.metrics.transactions.dashboard).toBe(1)
    expect(fixture.metrics.callbacks.dashboard).toBe(1)
    expect(fixture.metrics.revalidations).toBe(1)
    expect(fixture.driver.currentSnapshots!()).toBeUndefined()
  } finally { await fixture.close() }
})
