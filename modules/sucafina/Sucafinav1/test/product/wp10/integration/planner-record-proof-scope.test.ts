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
  const native = await sensitivityObservationFixture(deadline)
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
