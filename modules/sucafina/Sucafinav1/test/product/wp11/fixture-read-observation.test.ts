import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainPortHost, PortResult } from "../../../product/contracts/ports.ts"
import type { AuthorizedCaseProjection } from "../../../product/contracts/business-context.ts"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createRenewalCaseOperationVerifier } from "./renewal-operation-verifier.ts"
import { createRenewalSourceFixture } from "./renewal-source-fixture.ts"
import { createFixtureReadObservation, fixtureReaderIdentities } from "./fixture-read-observation.ts"
import { domain } from "../../../runtime/planner.ts"
import { roleMap } from "../../../runtime/admin.ts"
import { plannerSourceActor } from "../../../product/planner/port.ts"

test("fixture observation preserves the complete canonical case, both source passes and C08 while reducing only physical reads", async () => {
  const fixture = await observationFixture()
  try {
    const initial = await fixture.capture()
    fixture.reset()
    const control = await fixture.canonical()
    const controlCounts = { ...fixture.counts }
    expect(control.status).toBe("ok")
    expect(controlCounts.sources).toBeGreaterThan(0)
    fixture.reset()
    const observed = await fixture.read()
    const observedCounts = { ...fixture.counts }
    expect(observed).toEqual(control)
    expect(observedCounts.sources).toBe(controlCounts.sources)
    expect(observedCounts.coverage).toBe(controlCounts.coverage)
    expect(observedCounts.inSnapshot).toBe(observedCounts.sources)
    expect(observedCounts.roots).toBe(1)
    expect(observedCounts.physical).toBeLessThan(controlCounts.physical)
    expect(await fixture.capture()).toEqual(initial)
    fixture.reset()
    expect(await fixture.read()).toEqual(control)
    expect(fixture.counts.roots).toBe(1)
    expect(fixture.counts.sources).toBe(controlCounts.sources)
    expect(await fixture.capture()).toEqual(initial)
  } finally { await fixture.cleanup() }
}, 120000)

for (const fault of ["input", "source-ref", "revocation", "final-revocation", "final-day", "final-actor", "post-envelope-day", "request", "lease", "day", "actor", "reader", "c08", "planner"] as const) {
  test("fixture observation rejects a fresh egress change in " + fault, async () => {
    const fixture = await observationFixture()
    try {
      const before = await fixture.capture()
      const effects = { outside: false, called: 0, write: false, authority: 0, allowed: false }
      fixture.faults.afterRoot = async () => {
        effects.outside = fixture.store.currentSnapshots() === undefined
        if (fault === "input") fixture.argument.caseRef += "-changed"
        if (fault === "source-ref") fixture.sourceRefs[0]!.target.fields = [...fixture.sourceRefs[0]!.target.fields, "changed-field"]
        if (fault === "revocation") fixture.revokeSource(fixture.sourceRefs[0]!.refId)
        if (fault === "final-revocation" || fault === "final-day" || fault === "final-actor") fixture.faults.afterAuthority = (allowed) => {
          if (++effects.authority !== 2) return
          effects.allowed = allowed
          if (fault === "final-revocation") fixture.revokeSource(fixture.sourceRefs[0]!.refId)
          if (fault === "final-day") fixture.faults.day = "2026-11-14T00:00:00Z"
          if (fault === "final-actor") fixture.faults.actor = true
        }
        if (fault === "post-envelope-day") fixture.faults.afterEnvelope = () => { fixture.faults.day = "2026-11-14T00:00:00Z" }
        if (fault === "request") fixture.request.headers.delete("authorization")
        if (fault === "lease") fixture.ui.finish(fixture.context)
        if (fault === "day") fixture.faults.day = "2026-11-14T00:00:00Z"
        if (fault === "actor") fixture.faults.actor = true
        if (fault === "reader") {
          const original = fixture.sources.resolveForecastSource
          fixture.sources.resolveForecastSource = (...args) => original(...args)
        }
        if (fault === "c08") {
          const current = await fixture.state.read(fixture.request, "cases", (value) => value)
          if (current.status !== "ok") throw new Error("Actual C08 mutation admission unavailable")
          const saved = await fixture.state.transaction(fixture.request, { namespace: "cases", expectedStorageVersion: current.storageVersion,
            idempotencyKey: "fresh-egress-case", commandDigest: digestSfValue({ action: "change-objective" }),
            targetRef: fixture.caseRef.id, targetIncarnation: fixture.caseRef.incarnation }, async (value) => {
            value.cases[fixture.caseRef.id]!.objective = "Changed after the prior read closed"
            return { commit: true, value: true }
          })
          effects.write = saved.status === "ok" && saved.value
        }
        if (fault === "planner") {
          effects.write = (await fixture.changePlanner(46000)).ok
        }
      }
      const result = await fixture.observe(fixture.argument, fixture.context, async () => {
        effects.called++
        return fixture.canonical()
      })
      expect(effects.outside).toBe(true)
      expect(effects.called).toBe(1)
      expect(result).toEqual({ status: "unavailable", reason: "fixture-read-observation-changed" })
      if (fault === "c08" || fault === "planner") {
        expect(effects.write).toBe(true)
        expect((await fixture.capture()).snapshots).not.toEqual(before.snapshots)
      } else expect(await fixture.rawSnapshots()).toEqual(before.snapshots)
      if (fault === "final-revocation" || fault === "final-day" || fault === "final-actor") { expect(effects.authority).toBe(2); expect(effects.allowed).toBe(true) }
      if (fault === "actor" || fault === "final-actor") expect(fixture.faults.actorObserved).toBe(true)
      if (fault === "revocation" || fault === "final-revocation") expect((await fixture.evidence.resolve(fixture.sourceRefs[0]!, fixture.context)).state).toBe("revoked")
      if (fault === "request" || fault === "lease") expect(await fixture.host.revalidate(fixture.context)).toBe(false)
    } finally { await fixture.cleanup() }
  }, 120000)
}

test("a caught durable write poisons the real fixture owner without replaying canonical work", async () => {
  const fixture = await observationFixture()
  try {
    const before = await fixture.capture()
    const attempted = { calls: 0, caught: false }
    const result = await fixture.observe(fixture.argument, fixture.context, async () => {
      attempted.calls++
      const value = await fixture.canonical()
      try {
        await fixture.changePlanner(46000)
      } catch { attempted.caught = true }
      return value
    })
    expect(attempted.calls).toBe(1)
    expect(attempted.caught).toBe(true)
    expect(fixture.faults.canonicalWrite).toBe(true)
    expect(result.status).toBe("unavailable")
    expect(await fixture.capture()).toEqual(before)
  } finally { await fixture.cleanup() }
}, 120000)

test("a lexical child executes every callback and keeps its input pinned through the outer fresh witness", async () => {
  const fixture = await observationFixture()
  try {
    const control = await fixture.canonical()
    const child = { caseRef: fixture.argument.caseRef }
    const calls = { outer: 0, inner: 0 }
    const nested = () => fixture.observe(fixture.argument, fixture.context, async () => {
      calls.outer++
      const one = await fixture.canonical()
      const two = await fixture.observe(child, fixture.context, async () => { calls.inner++; return fixture.canonical(child) })
      expect(two).toEqual(one)
      return one
    })
    expect(await nested()).toEqual(control)
    expect(calls).toEqual({ outer: 1, inner: 1 })
    fixture.faults.afterRoot = async () => { child.caseRef += "-after-root" }
    expect((await nested()).status).toBe("unavailable")
    expect(calls).toEqual({ outer: 2, inner: 2 })
  } finally { await fixture.cleanup() }
}, 120000)

test("a foreign production read owner receives the complete original callback without a nested root", async () => {
  const fixture = await observationFixture()
  try {
    const before = await fixture.capture()
    const control = await fixture.canonical()
    fixture.reset()
    const calls = { work: 0 }
    const result = await fixture.store.transaction("planner", async () => ({ commit: false,
      value: await fixture.observe(fixture.argument, fixture.context, async () => { calls.work++; return fixture.canonical() }) }))
    expect(result).toEqual(control)
    expect(calls.work).toBe(1)
    expect(fixture.counts.roots).toBe(0)
    expect(fixture.counts.sources).toBeGreaterThan(0)
    expect(fixture.counts.inSnapshot).toBe(fixture.counts.sources)
    expect(await fixture.capture()).toEqual(before)
  } finally { await fixture.cleanup() }
}, 120000)

test("concurrent sibling observations of the same call use independent physical owners and fresh canonical reads", async () => {
  const fixture = await observationFixture()
  try {
    const control = await fixture.canonical()
    const sources = fixture.counts.sources
    fixture.reset()
    const results = await Promise.all([fixture.read(), fixture.read()])
    expect(results).toEqual([control, control])
    expect(fixture.counts.roots).toBe(2)
    expect(fixture.counts.sources).toBe(sources * 2)
  } finally { await fixture.cleanup() }
}, 120000)

test("an unfinished lexical child cannot publish after its physical owner closes", async () => {
  const fixture = await observationFixture()
  let release = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  let child: Promise<PortResult<AuthorizedCaseProjection>> | undefined
  try {
    const result = await fixture.observe(fixture.argument, fixture.context, async () => {
      child = fixture.observe({ caseRef: fixture.argument.caseRef }, fixture.context, async () => {
        await pending
        return fixture.canonical()
      })
      return fixture.canonical()
    })
    expect(result.status).toBe("unavailable")
    release()
    expect(child).toBeDefined()
    expect((await child!).status).toBe("unavailable")
  } finally {
    release()
    await child
    await fixture.cleanup()
  }
}, 120000)

async function observationFixture() {
  const fixture = await createRenewalSourceFixture("omitted")
  const faults: { afterRoot?: () => Promise<void>; afterAuthority?: (allowed: boolean) => void; afterEnvelope?: () => void; day?: string; actor?: boolean; actorObserved?: boolean; canonicalWrite?: boolean } = {}
  const host: DomainPortHost = { ...fixture.host,
    revalidate: async (context) => { const allowed = await fixture.host.revalidate(context); faults.afterAuthority?.(allowed); return allowed },
    environment: async (request) => { const value = await fixture.host.environment(request); return faults.day ? { ...value, at: faults.day } : value },
    authenticate: async (request, input) => {
      const value = await fixture.host.authenticate(request, input)
      if (!value || !faults.actor) return value
      const changed = { ...value, canWrite: !value.canWrite }
      faults.actorObserved = changed.canWrite !== value.canWrite
      return changed
    },
  }
  const counts = { physical: 0, roots: 0, sources: 0, coverage: 0, inSnapshot: 0 }
  const originalSource = fixture.sources.resolveForecastSource, originalCoverage = fixture.sources.resolveForecastCoverage
  fixture.sources.resolveForecastSource = (...args) => {
    counts.sources++
    if (fixture.store.currentSnapshots()) counts.inSnapshot++
    return originalSource(...args)
  }
  fixture.sources.resolveForecastCoverage = (...args) => { counts.coverage++; return originalCoverage(...args) }
  const transaction = fixture.store.transaction, root = fixture.store.readSnapshotRoot
  fixture.store.transaction = (surface, work, options) => {
    if (!fixture.store.currentSnapshots()) counts.physical++
    return transaction(surface, work, options)
  }
  fixture.store.readSnapshotRoot = async (work, options) => {
    counts.physical++; counts.roots++
    const value = await root(work, options)
    const effect = faults.afterRoot
    faults.afterRoot = undefined
    await effect?.()
    return value
  }
  const stateRead = fixture.state.read
  fixture.state.read = async (request, namespace, read) => {
    const value = await stateRead(request, namespace, read)
    if (!fixture.store.currentSnapshots()) {
      const effect = faults.afterEnvelope
      faults.afterEnvelope = undefined
      effect?.()
    }
    return value
  }
  const verifyOperations = createRenewalCaseOperationVerifier(host, fixture.sources)
  const cases = createDecisionCasePort({ host, state: fixture.state, creationTarget: { ref: fixture.caseRef.id, incarnation: fixture.caseRef.incarnation },
    authorizeCase: async (value) => value.participants.includes(fixture.context.binding.principalRef), verifyScenarioOperations: verifyOperations,
    evidence: fixture.evidence, operationIdentity: () => "fixture-read-control", createId: () => "unused", now: () => "2026-11-13T00:00:00Z" })
  const argument = { caseRef: encodeCaseRef(fixture.caseRef) }
  const observe = createFixtureReadObservation({ host, state: fixture.state,
    identities: () => [verifyOperations, fixture.observationWitness, ...fixtureReaderIdentities(cases, fixture.sources, fixture.evidence)],
    witness: fixture.observationWitness })
  const canonical = (request = argument) => cases.read(request, fixture.context)
  const changePlanner = (amount: number) => fixture.store.transaction("planner", async (snapshot) => {
    const principal = await host.authenticate(fixture.request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
    const actor = plannerSourceActor(snapshot, principal, fixture.context.binding.principalRef)
    if (!actor) throw new Error("Actual Planner author unavailable")
    const environment = await host.environment(fixture.request)
    const versionId = fixture.scenario.baseRef
    const result = domain.execute(snapshot, actor, { page: "OPEX", action: "save", id: "implementation",
      version: snapshot.versions[versionId + ":lines:implementation"]?.version ?? 0, values: { versionId, f10: amount } }, environment)
    faults.canonicalWrite = result.ok
    return { commit: result.ok, value: result }
  })
  const rawSnapshots = () => fixture.store.transactionAll(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
  const capture = async () => ({ state: await fixture.state.read(fixture.request, "cases", (value, authority) => ({ value, authority })), snapshots: await rawSnapshots() })
  return { ...fixture, host, faults, counts, cases, argument, observe, canonical, capture, rawSnapshots, changePlanner,
    read: () => observe(argument, fixture.context, canonical),
    reset: () => { for (const key of Object.keys(counts) as (keyof typeof counts)[]) counts[key] = 0 } }
}
