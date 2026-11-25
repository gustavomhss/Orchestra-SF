import { expect, test } from "bun:test"
import { createSfPlannerCalculationRoot, readSfPlannerCalculationRootProof } from "../../../../../../../apps/cli/src/sucafina-product/planner-calculation-root.ts"
import { createSfPlannerRecordProofScope, pinSfPlannerRecordReaders } from "../../../../../../../apps/cli/src/sucafina-product/planner-record-proof-scope.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../product/contracts/business-context.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import { currentSfPlannerReadonlySnapshotScope } from "../../../../product/integration/source-lifecycle.ts"
import { rows } from "../../../../runtime/contract.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"
import { sensitivityObservationFixture, sensitivityOk } from "./sensitivity-observation-fixture.ts"

type Root = ReturnType<typeof createSfPlannerCalculationRoot>
type Proof = NonNullable<ReturnType<Root["proof"]>>
type Deadline = ReturnType<typeof compositionTestDeadline>

async function fixture(deadline: Deadline) {
  const native = await sensitivityObservationFixture(deadline, "all", "lte", { plannerRecordProof: true })
  const host = native.authority.host
  const sourceReader = native.business.plannerSources.resolveForecastSource
  const projector = native.business.projectPlannerEvidence
  const evidenceReader = projector.readEvidence
  const scopedReader = native.persistence.readScopedSourcePrepared
  if (!scopedReader) throw new Error("The native prepared source reader is required")
  const atlas = native.business.evidence.current
  if (!atlas || !native.business.plannerProduct.scenarios) throw new Error("The native Planner and Atlas readers are required")
  const pinned = pinSfPlannerRecordReaders([host, host.persistence, native.persistence, native.authority.state, native.business.cases,
    native.business.plannerProduct.scenarios, native.business.plannerProduct.planner, native.business.planner,
    native.business.plannerSources, native.business.results, native.business.context, projector, atlas])
  const readersCurrent = () => pinned() && native.business.projectPlannerEvidence === projector &&
    native.business.evidence.current === atlas
  expect(readersCurrent()).toBe(true)
  const scope = createSfPlannerRecordProofScope({ host, readersCurrent })
  const root = createSfPlannerCalculationRoot({ host })
  return { ...native, host, sourceReader, projector, evidenceReader, scopedReader, readersCurrent, scope, root }
}

type Fixture = Awaited<ReturnType<typeof fixture>>

async function withCall<Value>(f: Fixture, deadline: Deadline,
  work: (call: TrustedDomainContext) => Promise<Value>): Promise<Value> {
  const request = new Request("https://example.test/planner", { method: "POST", signal: deadline.signal,
    headers: { origin: "https://example.test" } })
  const digest = digestSfValue({})
  const call = sensitivityOk(await f.authority.ui.admit(request, "sf_scenario_compare", digest))
  try {
    expect(await f.authority.ui.validate(call, "sf_scenario_compare", digest)).toBe(true)
    return await work(call)
  } finally { f.authority.ui.finish(call) }
}

async function withRoot<Value>(f: Fixture, call: TrustedDomainContext,
  work: (proof: Proof) => Promise<PortResult<Value>>): Promise<PortResult<Value>> {
  expect(f.root.proof(call)).toBeUndefined()
  const prepared = await f.root.prepare(call, async () => true, () => true)
  if (!prepared) throw new Error("The real Planner observation root was not prepared")
  return prepared.run(async () => {
    const proof = f.root.proof(call)
    if (!proof) throw new Error("The real readonly Planner root did not issue its proof")
    return work(proof)
  })
}

function expectFresh(value: BusinessEvidenceResolution) {
  expect(value.state).toBe("fresh")
  expect(value.currentRef).toEqual(value.ref)
  expect(value.authorizedProjection).toBeDefined()
  expect(value.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
}

function mutateDetached(value: BusinessEvidenceResolution) {
  if (value.ref.kind !== "record" || !value.authorizedProjection || !("values" in value.authorizedProjection))
    throw new Error("The real Planner record projection is required")
  expect(Reflect.set(value.ref.target.fields, "length", 0)).toBe(true)
  expect(Reflect.set(value.authorizedProjection, "currency", "mutated-return")).toBe(true)
  value.checkedAt = "mutated-return"
}

function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release }
}

function baselineAmounts(data: Record<string, unknown>): unknown[] {
  const line = rows(rows(data.versions).find((version) => version.id === "v0")?.lines)[0]
  if (!line || !Array.isArray(line.f)) throw new Error("The real Planner forecast line is unavailable")
  return line.f
}

test("Planner record proofs preserve complete canonical values within only one live owner", async () => {
  const deadline = compositionTestDeadline("planner-record-proof-values")
  try {
    const f = await deadline.phase("native-fixture", () => fixture(deadline))
    const reference = structuredClone(f.sources[0]!), other = structuredClone(f.sources[1]!)
    await deadline.phase("native-pins-do-not-evaluate-getters-or-proxies", async () => {
      const descriptor = Object.getOwnPropertyDescriptor(f.projector, "readEvidence")
      if (!descriptor) throw new Error("The native evidence reader descriptor is required")
      let calls = 0
      try {
        Object.defineProperty(f.projector, "readEvidence", { configurable: true,
          get: () => { calls++; return f.evidenceReader } })
        expect(f.readersCurrent()).toBe(false)
        expect(calls).toBe(0)
      } finally { Object.defineProperty(f.projector, "readEvidence", descriptor) }
      const proxy = new Proxy(f.projector, {
        getPrototypeOf: (target) => { calls++; return Reflect.getPrototypeOf(target) },
        ownKeys: (target) => { calls++; return Reflect.ownKeys(target) },
      })
      expect(pinSfPlannerRecordReaders([proxy])()).toBe(false)
      expect(calls).toBe(0)
      expect(f.readersCurrent()).toBe(true)
    })
    await deadline.phase("complete-values-and-detached-hits", () => withCall(f, deadline, async (call) => {
      const captures: BusinessEvidenceResolution[] = []
      let reads = 0, authorizations = 0
      const authorize = async () => { authorizations++; return f.host.revalidate(call) }
      const canonical = async (ref: BusinessEvidenceRef) => {
        reads++
        const value = await f.business.context.resolve(structuredClone(ref), call)
        expectFresh(value)
        captures.push(structuredClone(value))
        return value
      }
      let retained: BusinessEvidenceResolution | undefined
      const first = await withRoot(f, call, (proof) => f.scope.run([reference, other], call, proof, authorize, () => true, async () => {
        const read = async () => { retained = await canonical(reference); return retained }
        const observed = await f.scope.observe(reference, call, read)
        expect(observed).toEqual(captures[0])
        if (!retained) throw new Error("The canonical producer did not run")
        mutateDetached(observed)
        mutateDetached(retained)
        const beforeHit = authorizations
        const hit = await f.scope.observe(reference, call, read)
        expect(hit).toEqual(captures[0])
        expect(authorizations).toBeGreaterThan(beforeHit)
        expect(reads).toBe(1)
        mutateDetached(hit)
        const beforeSecondHit = authorizations
        const repeated = await f.scope.observe(structuredClone(reference), call, read)
        expect(repeated).toEqual(captures[0])
        expect(authorizations).toBeGreaterThan(beforeSecondHit)
        expect(reads).toBe(1)
        const second = await f.scope.observe(other, call, () => canonical(other))
        expect(second).toEqual(captures[1])
        expect(second.ref).toEqual(other)
        expect(reads).toBe(2)
        return { status: "ok", value: [repeated, second] }
      }))
      expect(sensitivityOk(first)).toEqual(captures)
      // A new physical owner in the same admitted request starts the producer again.
      const next = await withRoot(f, call, (proof) => f.scope.run([reference], call, proof, authorize, () => true, async () => {
        const value = await f.scope.observe(reference, call, () => canonical(reference))
        expect(reads).toBe(3)
        expect(value).toEqual(captures[2])
        return { status: "ok", value }
      }))
      expect(sensitivityOk(next)).toEqual(captures[2])
      expect(f.root.proof(call)).toBeUndefined()
    }))
    await deadline.phase("canonical-c08-children-keep-the-physical-owner", () => withCall(f, deadline, async (call) => {
      const request = f.host.requestFor(call)
      if (!request) throw new Error("The admitted transport is required")
      const captures: BusinessEvidenceResolution[] = []
      let reads = 0, children = 0
      const canonical = async (ref: BusinessEvidenceRef) => {
        reads++
        const value = await f.business.context.resolve(structuredClone(ref), call)
        captures.push(structuredClone(value))
        return value
      }
      const result = await withRoot(f, call, async (proof) => {
        const owner = readSfPlannerCalculationRootProof(proof, f.host, call)
        if (!owner?.bytesIdentity) throw new Error("The real physical snapshot proof is required")
        expect(owner.current()).toBe(true)
        return f.scope.run([reference, other], call, proof, () => f.host.revalidate(call), () => true, async () => {
          const first = await f.scope.observe(reference, call, () => canonical(reference))
          expectFresh(first)
          expect(first).toEqual(captures[0])
          const readChild = async (readOther: boolean) => {
            let retained: NonNullable<ReturnType<typeof currentSfPlannerReadonlySnapshotScope>> | undefined
            const child = await f.authority.state.read(request, "cases", async (state, actor) => {
              children++
              const current = currentSfPlannerReadonlySnapshotScope(f.host.persistence)
              if (!current) throw new Error("The real C08 child has no readonly snapshot proof")
              retained = current
              expect(current.current()).toBe(true)
              expect(current.identity).toBe(owner.identity)
              expect(current.bytesIdentity).toBe(owner.bytesIdentity)
              expect(owner.current()).toBe(true)
              expect(f.root.proof(call)).toBe(proof)
              expect(actor.principalRef).toBe(call.binding.principalRef)
              expect(actor.accessRevision).toBe(call.binding.accessRevision)
              expect(state.cases[f.caseRef.id]).toMatchObject(f.caseRef)
              const hit = await f.scope.observe(reference, call, () => canonical(reference))
              expect(hit).toEqual(captures[0])
              expect(reads).toBe(readOther ? 1 : 2)
              const second = await f.scope.observe(other, call, () => canonical(other))
              expectFresh(second)
              expect(second).toEqual(captures[1])
              expect(reads).toBe(2)
              expect(await f.scope.observe(other, call, () => canonical(other))).toEqual(captures[1])
              expect(reads).toBe(2)
              expect(owner.current()).toBe(true)
              return { case: structuredClone(state.cases[f.caseRef.id]), values: [hit, second] }
            })
            if (!retained) throw new Error("The C08 callback did not execute")
            // The logical child still closes independently; the owner must obtain
            // current native proof in whichever legitimate child is active.
            const closed = retained
            expect(() => closed.current()).toThrow()
            expect(owner.current()).toBe(true)
            const restored = currentSfPlannerReadonlySnapshotScope(f.host.persistence)
            expect(restored?.identity).toBe(owner.identity)
            expect(restored?.bytesIdentity).toBe(owner.bytesIdentity)
            expect(restored?.current()).toBe(true)
            return sensitivityOk(child)
          }
          const firstChild = await readChild(true), secondChild = await readChild(false)
          expect(secondChild).toEqual(firstChild)
          expect(await f.scope.observe(reference, call, () => canonical(reference))).toEqual(captures[0])
          expect(reads).toBe(2)
          return { status: "ok", value: secondChild }
        })
      })
      expect(sensitivityOk(result).values).toEqual(captures)
      expect(captures).toHaveLength(2)
      captures.forEach(expectFresh)
      expect(children).toBe(2)
      expect(reads).toBe(2)
      expect(currentSfPlannerReadonlySnapshotScope(f.host.persistence)).toBeUndefined()
      expect(f.root.proof(call)).toBeUndefined()
    }))
    await deadline.phase("unsupported-preserves-the-complete-producer", () => withCall(f, deadline, async (call) => {
      let reads = 0
      const captures: BusinessEvidenceResolution[] = []
      const canonical = async () => {
        reads++
        const value = await f.business.context.resolve(structuredClone(reference), call)
        expectFresh(value)
        captures.push(structuredClone(value))
        return value
      }
      const work = async () => ({ status: "ok" as const, value: [
        await f.scope.observe(reference, call, canonical),
        await f.scope.observe(reference, call, canonical),
      ] })
      expect(sensitivityOk(await f.scope.run([reference], call, undefined,
        () => f.host.revalidate(call), () => true, work))).toEqual(captures)
      expect(reads).toBe(2)
      // Replacing a reader before admission keeps every canonical read; it never
      // inherits an earlier optimized proof or manufactures a fresh result.
      for (const replace of [
        () => {
          f.business.plannerSources.resolveForecastSource = (...args) => f.sourceReader(...args)
          return () => { f.business.plannerSources.resolveForecastSource = f.sourceReader }
        },
        () => {
          f.projector.readEvidence = (...args) => f.evidenceReader(...args)
          return () => { f.projector.readEvidence = f.evidenceReader }
        },
        () => {
          f.persistence.readScopedSourcePrepared = (...args) => f.scopedReader(...args)
          return () => { f.persistence.readScopedSourcePrepared = f.scopedReader }
        },
      ]) {
        const restore = replace()
        const before = reads, firstCapture = captures.length
        try {
          expect(f.readersCurrent()).toBe(false)
          const observed = await withRoot(f, call, (proof) => f.scope.run([reference], call, proof,
            () => f.host.revalidate(call), () => true, work))
          expect(sensitivityOk(observed)).toEqual(captures.slice(firstCapture))
          expect(reads - before).toBe(2)
        } finally { restore() }
      }
      expect(f.readersCurrent()).toBe(true)
    }))
  } finally { await deadline.close() }
}, 120_000)

test("Planner record proofs refuse changed authority, pending work and expired owners without replay", async () => {
  const deadline = compositionTestDeadline("planner-record-proof-boundaries")
  try {
    const f = await deadline.phase("native-fixture", () => fixture(deadline))
    const reference = structuredClone(f.sources[0]!)
    const unavailable = { status: "unavailable", reason: "planner-record-proof-unavailable" } as const

    await deadline.phase("provided-proof-is-never-an-unsupported-fallback", () => withCall(f, deadline, async (call) => {
      let reads = 0, workCalls = 0, retainedProof: Proof | undefined
      const work = async () => {
        workCalls++
        reads++
        return { status: "ok" as const, value: await f.business.context.resolve(structuredClone(reference), call) }
      }
      expect(await f.scope.run([reference], call, Object.freeze({}),
        () => f.host.revalidate(call), () => true, work)).toEqual(unavailable)
      const entered = await withRoot(f, call, async (proof) => {
        retainedProof = proof
        return f.scope.run([reference], call, proof, () => f.host.revalidate(call), () => true, work)
      })
      expectFresh(sensitivityOk(entered))
      expect(reads).toBe(1)
      if (!retainedProof) throw new Error("The native capability was not retained")
      const expired = retainedProof
      expect(await f.scope.run([reference], call, expired,
        () => f.host.revalidate(call), () => true, work)).toEqual(unavailable)
      expect(await withRoot(f, call, () => f.scope.run([reference], call, expired,
        () => f.host.revalidate(call), () => true, work))).toEqual(unavailable)
      expect(workCalls).toBe(1)
      expect(reads).toBe(1)

      // Drift after the witness cannot turn an issued capability into undefined
      // and silently select the complete producer before egress rejects it.
      let refused: PortResult<BusinessEvidenceResolution> | undefined
      const environment = f.host.environment
      await withRoot(f, call, async (proof) => {
        f.host.environment = (...args) => environment(...args)
        try {
          expect(f.root.proof(call)).toBe(proof)
          refused = await f.scope.run([reference], call, f.root.proof(call),
            () => f.host.revalidate(call), () => true, work)
          return refused
        } finally { f.host.environment = environment }
      })
      expect(refused).toEqual(unavailable)
      expect(workCalls).toBe(1)
    }))

    await deadline.phase("reader-and-projector-change-after-the-canonical-await", () => withCall(f, deadline, async (call) => {
      for (const replace of [
        () => {
          f.business.plannerSources.resolveForecastSource = (...args) => f.sourceReader(...args)
          return () => { f.business.plannerSources.resolveForecastSource = f.sourceReader }
        },
        () => {
          f.projector.readEvidence = (...args) => f.evidenceReader(...args)
          return () => { f.projector.readEvidence = f.evidenceReader }
        },
      ]) {
        let restore: (() => void) | undefined, captured: BusinessEvidenceResolution | undefined, reads = 0
        try {
          const result = await withRoot(f, call, (proof) => f.scope.run([reference], call, proof,
            () => f.host.revalidate(call), () => true, async () => ({ status: "ok", value:
              await f.scope.observe(reference, call, async () => {
                reads++
                captured = await f.business.context.resolve(structuredClone(reference), call)
                restore = replace()
                return captured
              }),
            })))
          expect(result).toEqual(unavailable)
          if (!captured || !restore) throw new Error("The real producer did not reach the replacement boundary")
          expectFresh(captured)
          expect(reads).toBe(1)
        } finally { restore?.() }
        expect(f.readersCurrent()).toBe(true)
      }
    }))

    await deadline.phase("prepared-source-port-change-invalidates-a-completed-proof", () => withCall(f, deadline, async (call) => {
      let reads = 0, first: BusinessEvidenceResolution | undefined, changed: BusinessEvidenceResolution | undefined
      try {
        const result = await withRoot(f, call, (proof) => f.scope.run([reference], call, proof,
          () => f.host.revalidate(call), () => true, async () => {
            const canonical = async () => { reads++; return f.business.context.resolve(structuredClone(reference), call) }
            first = await f.scope.observe(reference, call, canonical)
            f.persistence.readScopedSourcePrepared = (...args) => f.scopedReader(...args)
            changed = await f.scope.observe(reference, call, canonical)
            return { status: "ok", value: changed }
          }))
        expect(result).toEqual(unavailable)
        if (!first || !changed) throw new Error("The completed proof did not reach the prepared-reader replacement")
        expectFresh(first)
        expect(changed.state).toBe("unavailable")
        expect(reads).toBe(1)
      } finally { f.persistence.readScopedSourcePrepared = f.scopedReader }
      expect(f.readersCurrent()).toBe(true)
    }))

    await deadline.phase("guards-close-the-authorization-await", () => withCall(f, deadline, async (call) => {
      let reads = 0, authorizeCalls = 0, stillCurrent = true
      const result = await withRoot(f, call, (proof) => f.scope.run([reference], call, proof, async () => {
        authorizeCalls++
        const allowed = await f.host.revalidate(call)
        stillCurrent = false
        return allowed
      }, () => stillCurrent, async () => ({ status: "ok", value: await f.scope.observe(reference, call, async () => {
        reads++
        return f.business.context.resolve(structuredClone(reference), call)
      }) })))
      expect(result).toEqual(unavailable)
      expect(authorizeCalls).toBe(1)
      expect(reads).toBe(0)

      // The producer's returned object is also guarded across the final
      // authorization await, before any completed value can enter the map.
      let returned: BusinessEvidenceResolution | undefined, original: BusinessEvidenceResolution | undefined
      let mutated = false
      const altered = await withRoot(f, call, (proof) => f.scope.run([reference], call, proof, async () => {
        const allowed = await f.host.revalidate(call)
        if (returned) { returned.checkedAt = "changed-during-authorization"; mutated = true }
        return allowed
      }, () => true, async () => ({ status: "ok", value: await f.scope.observe(reference, call, async () => {
        reads++
        returned = await f.business.context.resolve(structuredClone(reference), call)
        original = structuredClone(returned)
        return returned
      }) })))
      expect(altered).toEqual(unavailable)
      if (!original) throw new Error("The real producer did not complete")
      expectFresh(original)
      expect(mutated).toBe(true)
      expect(reads).toBe(1)
    }))

    await deadline.phase("busy-producer-is-not-shared", () => withCall(f, deadline, async (call) => {
      const ready = gate(), release = gate()
      let reads = 0, canonical: BusinessEvidenceResolution | undefined
      let first: Promise<BusinessEvidenceResolution> | undefined
      let concurrent: BusinessEvidenceResolution | undefined
      try {
        const result = await withRoot(f, call, (proof) => f.scope.run([reference], call, proof,
          () => f.host.revalidate(call), () => true, async () => {
            first = f.scope.observe(reference, call, async () => {
              reads++
              let value: BusinessEvidenceResolution
              try { value = await f.business.context.resolve(structuredClone(reference), call); canonical = structuredClone(value) }
              finally { ready.release() }
              await release.promise
              return value
            }).finally(ready.release)
            await ready.promise
            try {
              concurrent = await f.scope.observe(reference, call, async () => {
                reads++
                return f.business.context.resolve(structuredClone(reference), call)
              })
            } finally { release.release() }
            return { status: "ok", value: await first }
          }))
        expect(result).toEqual(unavailable)
        if (!canonical || !concurrent || !first) throw new Error("The concurrent boundary was not reached")
        expectFresh(canonical)
        expect(concurrent.state).toBe("unavailable")
        expect((await first).state).toBe("unavailable")
        expect(reads).toBe(1)
      } finally { release.release(); await first }
    }))

    await deadline.phase("pending-producer-cannot-publish-after-return", () => withCall(f, deadline, async (call) => {
      const ready = gate(), release = gate()
      let reads = 0, canonical: BusinessEvidenceResolution | undefined
      let pending: Promise<BusinessEvidenceResolution> | undefined
      try {
        const result = await withRoot(f, call, (proof) => f.scope.run([reference], call, proof,
          () => f.host.revalidate(call), () => true, async () => {
            pending = f.scope.observe(reference, call, async () => {
              reads++
              let value: BusinessEvidenceResolution
              try { value = await f.business.context.resolve(structuredClone(reference), call); canonical = structuredClone(value) }
              finally { ready.release() }
              await release.promise
              return value
            }).finally(ready.release)
            await ready.promise
            // The owner deliberately returns with real work still outstanding.
            return { status: "ok", value: reference }
          }))
        expect(result).toEqual(unavailable)
        if (!canonical || !pending) throw new Error("The real pending producer was not started")
        expectFresh(canonical)
        release.release()
        expect((await pending).state).toBe("unavailable")
        expect(reads).toBe(1)
      } finally { release.release(); await pending }
    }))

    await deadline.phase("inherited-closed-frames-retain-refusal", () => withCall(f, deadline, async (call) => {
      const release = gate()
      let reads = 0
      let late: Promise<BusinessEvidenceResolution> | undefined
      let lateRun: Promise<PortResult<BusinessEvidenceResolution>> | undefined
      const canonical = async () => { reads++; return f.business.context.resolve(structuredClone(reference), call) }
      try {
        const result = await withRoot(f, call, async (proof) => {
          // This descendant inherits the real root but not a record-proof frame.
          lateRun = (async () => {
            await release.promise
            expect(f.root.proof(call)).toBe(proof)
            return f.scope.run([reference], call, f.root.proof(call),
              () => f.host.revalidate(call), () => true,
              async () => ({ status: "ok", value: await canonical() }))
          })()
          return f.scope.run([reference], call, proof, () => f.host.revalidate(call), () => true, async () => {
            const value = await f.scope.observe(reference, call, canonical)
            late = (async () => { await release.promise; return f.scope.observe(reference, call, canonical) })()
            return { status: "ok", value }
          })
        })
        expectFresh(sensitivityOk(result))
        if (!late || !lateRun) throw new Error("The inherited callbacks were not created")
        release.release()
        expect((await late).state).toBe("unavailable")
        expect(await lateRun).toEqual(unavailable)
        expect(reads).toBe(1)
      } finally { release.release(); await Promise.all([late, lateRun]) }
    }))

    await deadline.phase("closed-c08-child-cannot-borrow-the-live-parent", () => withCall(f, deadline, async (call) => {
      const request = f.host.requestFor(call), release = gate()
      if (!request) throw new Error("The admitted transport is required")
      let reads = 0, first: BusinessEvidenceResolution | undefined
      let late: Promise<BusinessEvidenceResolution> | undefined
      const canonical = async () => { reads++; return f.business.context.resolve(structuredClone(reference), call) }
      try {
        const result = await withRoot(f, call, (proof) => f.scope.run([reference], call, proof,
          () => f.host.revalidate(call), () => true, async () => {
            const child = await f.authority.state.read(request, "cases", async () => {
              first = await f.scope.observe(reference, call, canonical)
              late = (async () => {
                await release.promise
                expect(f.root.proof(call)).toBe(proof)
                return f.scope.observe(reference, call, canonical)
              })()
              return first
            })
            sensitivityOk(child)
            if (!late) throw new Error("The real C08 child did not create its continuation")
            expect(readSfPlannerCalculationRootProof(proof, f.host, call)?.current()).toBe(true)
            expect(currentSfPlannerReadonlySnapshotScope(f.host.persistence)?.current()).toBe(true)
            // Only the child has closed. Its inherited callback cannot reuse
            // the still-open parent's proof or select a legacy producer.
            release.release()
            return { status: "ok", value: await late }
          }))
        expect(result.status).not.toBe("ok")
        if (!first || !late) throw new Error("The closed-child boundary was not reached")
        expectFresh(first)
        expect((await late).state).toBe("unavailable")
        expect(reads).toBe(1)
      } finally { release.release(); await late }
    }))

    await deadline.phase("a-hit-reauthorizes-the-live-principal", () => withCall(f, deadline, async (call) => {
      let reads = 0, first: BusinessEvidenceResolution | undefined, revoked: BusinessEvidenceResolution | undefined
      try {
        const result = await withRoot(f, call, (proof) => f.scope.run([reference], call, proof,
          () => f.host.revalidate(call), () => true, async () => {
            const canonical = async () => { reads++; return f.business.context.resolve(structuredClone(reference), call) }
            first = await f.scope.observe(reference, call, canonical)
            f.control.active = false
            revoked = await f.scope.observe(reference, call, canonical)
            return { status: "ok", value: revoked }
          }))
        expect(result.status).not.toBe("ok")
        if (!first || !revoked) throw new Error("The revocation boundary was not reached")
        expectFresh(first)
        expect(revoked.state).toBe("unavailable")
        expect(reads).toBe(1)
      } finally { f.control.active = true }
    }))

    await deadline.phase("swallowed-nested-write-poisons-the-proof", () => withCall(f, deadline, async (call) => {
      const before = await f.persistence.transaction("planner", async (snapshot) => ({
        commit: false, value: structuredClone(snapshot),
      }))
      let first: BusinessEvidenceResolution | undefined, poisoned: BusinessEvidenceResolution | undefined
      let rejectedWrite = false, reads = 0
      const result = await withRoot(f, call, (proof) => f.scope.run([reference], call, proof,
        () => f.host.revalidate(call), () => true, async () => {
          const canonical = async () => { reads++; return f.business.context.resolve(structuredClone(reference), call) }
          first = await f.scope.observe(reference, call, canonical)
          try {
            await f.persistence.transaction("planner", async (snapshot) => {
              baselineAmounts(snapshot.data)[0] = 999
              return { commit: true, value: undefined }
            })
          } catch (error) {
            rejectedWrite = error instanceof Error && error.message.includes("Nested local writes are forbidden")
          }
          poisoned = await f.scope.observe(reference, call, canonical)
          return { status: "ok", value: poisoned }
        }))
      expect(result.status).not.toBe("ok")
      if (!first || !poisoned) throw new Error("The poison boundary was not reached")
      expectFresh(first)
      expect(rejectedWrite).toBe(true)
      expect(poisoned.state).toBe("unavailable")
      expect(reads).toBe(1)
      expect(await f.persistence.transaction("planner", async (snapshot) => ({
        commit: false, value: snapshot,
      }))).toEqual(before)
    }))

    await deadline.phase("source-change-between-owners-starts-a-new-canonical-read", () => withCall(f, deadline, async (call) => {
      let reads = 0, changed: BusinessEvidenceResolution | undefined
      const canonical = async () => { reads++; return f.business.context.resolve(structuredClone(reference), call) }
      const first = await withRoot(f, call, (proof) => f.scope.run([reference], call, proof,
        () => f.host.revalidate(call), () => true,
        async () => ({ status: "ok", value: await f.scope.observe(reference, call, canonical) })))
      expectFresh(sensitivityOk(first))
      await f.persistence.transaction("planner", async (snapshot) => {
        baselineAmounts(snapshot.data)[0] = 999
        return { commit: true, value: undefined }
      })
      const next = await withRoot(f, call, (proof) => f.scope.run([reference], call, proof,
        () => f.host.revalidate(call), () => true, async () => ({ status: "ok", value:
          await f.scope.observe(reference, call, async () => { changed = await canonical(); return changed }),
        })))
      expect(next).toEqual(unavailable)
      if (!changed) throw new Error("The new owner did not execute the canonical reader")
      expect(changed.state).not.toBe("fresh")
      expect(reads).toBe(2)
      expect(await f.persistence.transaction("planner", async (snapshot) => ({
        commit: false, value: baselineAmounts(snapshot.data)[0],
      }))).toBe(999)
    }))
  } finally { await deadline.close() }
}, 120_000)


test("Planner record proofs preserve original observations outside their retained set", async () => {
  const deadline = compositionTestDeadline("planner-record-proof-outside-set")
  const enterOrFinish = async (entered: ReturnType<typeof gate>, result: Promise<BusinessEvidenceResolution>) => {
    const outcome = await Promise.race([
      entered.promise.then(() => ({ kind: "entered" } as const)),
      result.then((value) => ({ kind: "returned", value } as const), (error: unknown) => ({ kind: "threw", error } as const)),
    ])
    if (outcome.kind === "threw") throw outcome.error
    expect(outcome.kind).toBe("entered")
  }
  try {
    const f = await deadline.phase("native-fixture", () => fixture(deadline))
    const reference = structuredClone(f.sources[0]!), other = structuredClone(f.sources[1]!)
    const unavailable = { status: "unavailable", reason: "planner-record-proof-unavailable" } as const

    await deadline.phase("outside-set-values-are-never-retained", () => withCall(f, deadline, async (call) => {
      let reads = 0
      const returned: BusinessEvidenceResolution[] = []
      const canonical = async () => {
        reads++
        const value = await f.business.context.resolve(structuredClone(other), call)
        expectFresh(value)
        returned.push(value)
        return value
      }
      const observed = await withRoot(f, call, (proof) => f.scope.run([reference], call, proof,
        () => f.host.revalidate(call), () => true, async () => {
          const first = await f.scope.observe(other, call, canonical)
          expect(first).toBe(returned[0])
          const second = await f.scope.observe(other, call, canonical)
          expect(second).toBe(returned[1])
          expect(reads).toBe(2)
          return { status: "ok", value: [first, second] }
        }))
      expect(sensitivityOk(observed)).toEqual(returned)
      expect(reads).toBe(2)
    }))

    await deadline.phase("outside-set-sync-and-async-errors-keep-identity", () => withCall(f, deadline, async (call) => {
      for (const asynchronous of [false, true]) {
        const sentinel = new Error(asynchronous ? "original async rejection" : "original synchronous exception")
        let calls = 0, caught: unknown
        const observed = await withRoot(f, call, (proof) => f.scope.run([reference], call, proof,
          () => f.host.revalidate(call), () => true, async () => {
            try {
              await f.scope.observe(other, call, () => {
                calls++
                if (asynchronous) return Promise.reject(sentinel)
                throw sentinel
              })
            } catch (error) { caught = error }
            expect(caught).toBe(sentinel)
            expect(calls).toBe(1)
            const next = await f.scope.observe(other, call, () => f.business.context.resolve(structuredClone(other), call))
            expectFresh(next)
            return { status: "ok", value: next }
          }))
        expectFresh(sensitivityOk(observed))
        expect(caught).toBe(sentinel)
        expect(calls).toBe(1)
      }
    }))

    await deadline.phase("rejected-outside-read-latches-drift-before-restoration", () => withCall(f, deadline, async (call) => {
      const sentinel = new Error("original rejection after reader drift")
      let calls = 0, replay = 0, caught: unknown
      try {
        const observed = await withRoot(f, call, (proof) => f.scope.run([reference], call, proof,
          () => f.host.revalidate(call), () => true, async () => {
            try {
              await f.scope.observe(other, call, async () => {
                calls++
                f.projector.readEvidence = (...args) => f.evidenceReader(...args)
                throw sentinel
              })
            } catch (error) { caught = error }
            expect(caught).toBe(sentinel)
            f.projector.readEvidence = f.evidenceReader
            const next = await f.scope.observe(other, call, async () => {
              replay++
              return f.business.context.resolve(structuredClone(other), call)
            })
            expect(next.state).toBe("unavailable")
            expect(replay).toBe(0)
            return { status: "ok", value: next }
          }))
        expect(observed).toEqual(unavailable)
        expect(caught).toBe(sentinel)
        expect(calls).toBe(1)
        expect(replay).toBe(0)
      } finally { f.projector.readEvidence = f.evidenceReader }
    }))

    await deadline.phase("outside-set-concurrent-reads-keep-both-producers", () => withCall(f, deadline, async (call) => {
      const enteredFirst = gate(), enteredSecond = gate(), release = gate()
      let first: Promise<BusinessEvidenceResolution> | undefined, second: Promise<BusinessEvidenceResolution> | undefined
      const returned: BusinessEvidenceResolution[] = []
      let calls = 0
      try {
        const observed = await withRoot(f, call, (proof) => f.scope.run([reference], call, proof,
          () => f.host.revalidate(call), () => true, async () => {
            const canonical = async (index: number, entered: ReturnType<typeof gate>) => {
              calls++
              const value = await f.business.context.resolve(structuredClone(other), call)
              expectFresh(value)
              returned[index] = value
              entered.release()
              await release.promise
              return value
            }
            first = f.scope.observe(other, call, () => canonical(0, enteredFirst))
            await enterOrFinish(enteredFirst, first)
            second = f.scope.observe(other, call, () => canonical(1, enteredSecond))
            await enterOrFinish(enteredSecond, second)
            expect(calls).toBe(2)
            release.release()
            const values = await Promise.all([first, second])
            expect(values[0]).toBe(returned[0])
            expect(values[1]).toBe(returned[1])
            return { status: "ok", value: values }
          }))
        if (returned.length !== 2 || returned[0] === undefined || returned[1] === undefined)
          throw new Error("Both original concurrent observations must complete")
        const expected: [BusinessEvidenceResolution, BusinessEvidenceResolution] = [returned[0], returned[1]]
        expect(sensitivityOk(observed)).toEqual(expected)
        expect(calls).toBe(2)
      } finally {
        release.release()
        await Promise.allSettled([first, second])
      }
    }))

    await deadline.phase("outside-set-pending-cannot-publish-after-return", () => withCall(f, deadline, async (call) => {
      const entered = gate(), release = gate()
      let pending: Promise<BusinessEvidenceResolution> | undefined, calls = 0
      try {
        const observed = await withRoot(f, call, (proof) => f.scope.run([reference], call, proof,
          () => f.host.revalidate(call), () => true, async () => {
            pending = f.scope.observe(other, call, async () => {
              calls++
              const value = await f.business.context.resolve(structuredClone(other), call)
              expectFresh(value)
              entered.release()
              await release.promise
              return value
            })
            await enterOrFinish(entered, pending)
            return { status: "ok", value: true }
          }))
        expect(observed).toEqual(unavailable)
        expect(calls).toBe(1)
        expect(f.root.proof(call)).toBeUndefined()
        release.release()
        expect((await pending)?.state).toBe("unavailable")
        expect(calls).toBe(1)
      } finally { release.release(); await Promise.allSettled([pending]) }
    }))

    await deadline.phase("outside-set-keeps-a-real-non-fresh-resolution", async () => {
      // Change the actual source before opening the next owner. The issued ref
      // remains an authentic previous observation; no failure value is stubbed.
      await f.persistence.transaction("planner", async (snapshot) => {
        const version = rows(snapshot.data.versions).find((value) => value.id === "v1")
        const line = rows(version?.lines)[0]
        if (!line || !Array.isArray(line.f)) throw new Error("The actual candidate line is unavailable")
        line.f = Array(12).fill(91)
        return { commit: true, value: undefined }
      })
      await withCall(f, deadline, async (call) => {
        let calls = 0, original: BusinessEvidenceResolution | undefined
        const canonical = async () => {
          calls++
          original = await f.business.context.resolve(structuredClone(other), call)
          expect(original.state).not.toBe("fresh")
          return original
        }
        const observed = await withRoot(f, call, (proof) => f.scope.run([reference], call, proof,
          () => f.host.revalidate(call), () => true, async () => {
            const first = await f.scope.observe(other, call, canonical)
            if (original === undefined) throw new Error("The original non-fresh observation did not complete")
            expect(first).toBe(original)
            const second = await f.scope.observe(other, call, canonical)
            expect(second).toBe(original)
            expect(calls).toBe(2)
            return { status: "ok", value: second }
          }))
        if (original === undefined) throw new Error("The non-fresh control did not reach its original producer")
        expect(sensitivityOk(observed)).toEqual(original)
        expect(sensitivityOk(observed)).not.toBe(original)
        expect(calls).toBe(2)
      })
    })
  } finally { await deadline.close() }
}, 120_000)

test("Planner proof bookkeeping keeps private collections away from late cleanup hooks", async () => {
  const deadline = compositionTestDeadline("planner-record-proof-private-cleanup")
  try {
    const f = await deadline.phase("native-fixture", () => fixture(deadline))
    const reference = structuredClone(f.sources[0]!)
    await deadline.phase("late-map-set-and-invocation-hooks-see-no-private-collections", () => withCall(f, deadline, async (call) => {
      const originalMapClear = Object.getOwnPropertyDescriptor(Map.prototype, "clear")!
      const originalSetClear = Object.getOwnPropertyDescriptor(Set.prototype, "clear")!
      const originalSetDelete = Object.getOwnPropertyDescriptor(Set.prototype, "delete")!
      const originalApply = Object.getOwnPropertyDescriptor(Reflect, "apply")!
      const define = Object.defineProperty
      const sentinel = new Error("A private cleanup hook was invoked")
      const calls = { mapClear: 0, setClear: 0, setDelete: 0, apply: 0 }
      let armed = false, reads = 0, cold: BusinessEvidenceResolution | undefined
      const canonical = async () => {
        reads++
        return f.business.context.resolve(structuredClone(reference), call)
      }
      const result = await withRoot(f, call, async (proof) => {
        try {
          return await f.scope.run([reference], call, proof, async () => {
            const authorized = await f.host.revalidate(call)
            if (armed) {
              define(Map.prototype, "clear", { ...originalMapClear, value: function () { calls.mapClear++; throw sentinel } })
              define(Set.prototype, "clear", { ...originalSetClear, value: function () { calls.setClear++; throw sentinel } })
              define(Set.prototype, "delete", { ...originalSetDelete, value: function () { calls.setDelete++; throw sentinel } })
              define(Reflect, "apply", { ...originalApply, value: function () { calls.apply++; throw sentinel } })
            }
            return authorized
          }, () => true, async () => {
            cold = await f.scope.observe(reference, call, canonical)
            expectFresh(cold)
            expect(reads).toBe(1)
            armed = true
            // The hit enters its busy slot before authorization installs hooks.
            // Refusal and both finally paths therefore execute under drift.
            const refused = await f.scope.observe(reference, call, canonical)
            return { status: "ok", value: refused }
          })
        } finally {
          define(Reflect, "apply", originalApply)
          define(Set.prototype, "delete", originalSetDelete)
          define(Set.prototype, "clear", originalSetClear)
          define(Map.prototype, "clear", originalMapClear)
        }
      })
      expect(cold?.state).toBe("fresh")
      expect(armed).toBe(true)
      expect(reads).toBe(1)
      expect(calls).toEqual({ mapClear: 0, setClear: 0, setDelete: 0, apply: 0 })
      expect(result.status).toBe("unavailable")
      expect(f.root.proof(call)).toBeUndefined()
    }))

    await deadline.phase("late-weakmap-hooks-never-see-the-private-proof-token", () => withCall(f, deadline, async (call) => {
      const originalGet = Object.getOwnPropertyDescriptor(WeakMap.prototype, "get")!
      const originalSet = Object.getOwnPropertyDescriptor(WeakMap.prototype, "set")!
      const originalDelete = Object.getOwnPropertyDescriptor(WeakMap.prototype, "delete")!
      const apply = Reflect.apply, define = Object.defineProperty
      const calls = { get: 0, set: 0, delete: 0 }
      let token: Proof | undefined, active: ReturnType<typeof readSfPlannerCalculationRootProof>
      let retained: ReturnType<typeof readSfPlannerCalculationRootProof>, reads = 0
      try {
        const result = await withRoot(f, call, async (proof) => {
          token = proof
          active = readSfPlannerCalculationRootProof(proof, f.host, call)
          if (!active) throw new Error("A real proof registry entry is required")
          expect(active.current()).toBe(true)
          return f.scope.run([reference], call, proof, () => f.host.revalidate(call), () => true, async () => {
            const cold = await f.scope.observe(reference, call, async () => {
              reads++
              return f.business.context.resolve(structuredClone(reference), call)
            })
            expectFresh(cold)
            define(WeakMap.prototype, "get", { ...originalGet, value: function (this: WeakMap<object, unknown>, key: object) {
              if (key === proof) calls.get++
              return apply(originalGet.value, this, [key])
            } })
            define(WeakMap.prototype, "set", { ...originalSet, value: function (this: WeakMap<object, unknown>, key: object, value: unknown) {
              if (key === proof) calls.set++
              return apply(originalSet.value, this, [key, value])
            } })
            define(WeakMap.prototype, "delete", { ...originalDelete, value: function (this: WeakMap<object, unknown>, key: object) {
              if (key === proof) calls.delete++
              return apply(originalDelete.value, this, [key])
            } })
            retained = readSfPlannerCalculationRootProof(proof, f.host, call)
            expect(retained).toBe(active)
            expect(retained?.current()).toBe(false)
            return { status: "ok", value: cold }
          })
        })
        expect(result.status).toBe("unavailable")
      } finally {
        define(WeakMap.prototype, "delete", originalDelete)
        define(WeakMap.prototype, "set", originalSet)
        define(WeakMap.prototype, "get", originalGet)
      }
      if (!token) throw new Error("The native owner did not emit a proof")
      expect(reads).toBe(1)
      expect(calls).toEqual({ get: 0, set: 0, delete: 0 })
      expect(retained).toBe(active)
      expect(retained?.current()).toBe(false)
      expect(readSfPlannerCalculationRootProof(token, f.host, call)).toBeUndefined()
      expect(f.root.proof(call)).toBeUndefined()
    }))
  } finally { await deadline.close() }
}, 120_000)
