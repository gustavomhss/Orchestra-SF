import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { createSfStaleAnalysisAccess } from "../../../../../../../apps/cli/src/sucafina-product/analysis-stale-commit.ts"
import { object } from "../../../../runtime/contract.ts"
import { withMemoryIntegrityFixture } from "./fixture.ts"

test("Memory integrity retains the original Request despite replacement of constructor input", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (f) => {
    const options = { authority: f.authority, persistence: f.persistence, context: f.business.context,
      request: f.staleRequest, start: f.start, proof: f.proof }
    const access = createSfStaleAnalysisAccess(options)
    const first = await f.admit()
    const replacementRequest = f.request()
    const replacement = await f.admit(replacementRequest)
    try {
      expect((await access.preflight(f.record, first, f.output)).status).toBe("ok")
      expect(f.authority.host.requestFor(first)).toBe(f.staleRequest)
      expect(f.authority.host.requestFor(replacement)).toBe(replacementRequest)
      options.request = replacementRequest
      expect((await access.preflight(f.record, replacement, f.output)).status).toBe("denied")
      expect((await access.preflight(f.record, first, f.output)).status).toBe("ok")
    } finally { f.authority.human.finish(replacement); f.authority.human.finish(first) }
  }, "retained-request")
}, 120_000)

test("Memory integrity rejects record mutation after the real Atlas capture reader awaited", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (f) => {
    const call = await f.admit()
    const context = f.business.context.context
    const readCapture = f.atlas.memory.readOriginalCapture
    const witness = { armed: false, reached: false }
    try {
      expect((await f.stale.preflight(f.record, call, f.output)).status).toBe("ok")
      f.business.context.context = async (selection, trusted) => {
        witness.armed = false
        const sources = await context(selection, trusted)
        witness.armed = !!f.driver.currentSnapshots?.()
        return sources
      }
      f.atlas.memory.readOriginalCapture = async (caseRef, digest, trusted) => {
        const captured = await readCapture(caseRef, digest, trusted)
        if (witness.armed && f.driver.currentSnapshots?.() && !witness.reached && digest === f.original.refDigest) {
          expect(captured?.ref).toEqual(f.original)
          witness.reached = true
          f.record.policyVersion = "replaced-during-await"
        }
        return captured
      }
      expect((await f.stale.preflight(f.record, call, f.output)).status).toBe("denied")
      expect(witness.reached).toBe(true)
    } finally {
      f.business.context.context = context
      f.atlas.memory.readOriginalCapture = readCapture
      f.authority.human.finish(call)
    }
  }, "record-during-await")
}, 120_000)

test("Memory integrity rejects an in-place source change after the real Atlas capture reader awaited", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (f) => {
    const call = await f.admit()
    const context = f.business.context.context
    const readCapture = f.atlas.memory.readOriginalCapture
    const witness = { armed: false, reached: false }
    try {
      expect((await f.stale.preflight(f.record, call, f.output)).status).toBe("ok")
      const before = await f.readAtlas()
      if (!f.persistence.transactionAll) throw new Error("Real C08 scope unavailable")
      const checked = await f.persistence.transactionAll(async (snapshots) => {
        f.business.context.context = async (selection, trusted) => {
          witness.armed = false
          const sources = await context(selection, trusted)
          witness.armed = !!f.driver.currentSnapshots?.()
          return sources
        }
        f.atlas.memory.readOriginalCapture = async (caseRef, digest, trusted) => {
          const captured = await readCapture(caseRef, digest, trusted)
          if (witness.armed && f.driver.currentSnapshots?.() && !witness.reached && digest === f.original.refDigest) {
            expect(captured?.ref).toEqual(f.original)
            witness.reached = true
            // Fault the actual open C08 snapshot, not the cloned reader view.
            const request = object(object(object(snapshots.procurement.data.store).requests)["PR-1"])
            object(object(request.request).pr).estAmount = 190
          }
          return captured
        }
        return { commit: false, value: await f.stale.preflight(f.record, call, f.output) }
      })
      expect(checked.status).toBe("denied")
      expect(witness.reached).toBe(true)
      expect(await f.readAtlas()).toEqual(before)
    } finally {
      f.business.context.context = context
      f.atlas.memory.readOriginalCapture = readCapture
      f.authority.human.finish(call)
    }
  }, "source-during-await")
}, 120_000)

test("Memory integrity respects principal revocation after the last real capture read", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (f) => {
    const call = await f.admit()
    const context = f.business.context.context
    const readCapture = f.atlas.memory.readOriginalCapture
    const witness = { armed: false, reads: 0, target: 0, reached: false }
    try {
      expect((await f.stale.preflight(f.record, call, f.output)).status).toBe("ok")
      f.business.context.context = async (selection, trusted) => {
        witness.armed = false
        const sources = await context(selection, trusted)
        witness.armed = !!f.driver.currentSnapshots?.()
        return sources
      }
      f.atlas.memory.readOriginalCapture = async (caseRef, digest, trusted) => {
        const captured = await readCapture(caseRef, digest, trusted)
        if (witness.armed && f.driver.currentSnapshots?.()) {
          expect(captured?.ref.refDigest).toBe(digest)
          witness.reads += 1
          if (witness.target > 0 && witness.reads === witness.target) {
            expect(f.authority.host.requestFor(trusted)).toBe(f.staleRequest)
            witness.reached = true
            f.access.allowed = false
          }
        }
        return captured
      }
      // Calibrate all protected capture reads in the real integrity proof,
      // including additional references/continuity reads. No reader is replaced.
      expect((await f.stale.preflight(f.record, call, f.output)).status).toBe("ok")
      expect(witness.reads).toBeGreaterThan(0)
      witness.target = witness.reads
      witness.reads = 0
      expect((await f.stale.preflight(f.record, call, f.output)).status).toBe("denied")
      expect(witness.reached).toBe(true)
      expect(witness.reads).toBe(witness.target)
      expect((await f.stale.preflight(f.record, call, f.output)).status).toBe("denied")
    } finally {
      f.business.context.context = context
      f.atlas.memory.readOriginalCapture = readCapture
      f.authority.human.finish(call)
    }
  }, "revoked-after-read")
}, 120_000)

test("Memory integrity rejects headers changed after the final real revalidation", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (f) => {
    const call = await f.admit()
    const revalidate = f.authority.host.revalidate
    const observed = { calls: 0, target: 0, changed: false }
    try {
      // Warm source issuance before counting the stable exact operation. Every
      // measured/attacked revalidation still calls the production authority.
      expect((await f.stale.preflight(f.record, call, f.output)).status).toBe("ok")
      f.authority.host.revalidate = async (trusted) => {
        const allowed = await revalidate(trusted)
        observed.calls += 1
        if (allowed && observed.target > 0 && observed.calls === observed.target) {
          expect(f.authority.host.requestFor(trusted)).toBe(f.staleRequest)
          f.staleRequest.headers.set("authorization", "replacement-principal")
          observed.changed = true
        }
        return allowed
      }
      expect((await f.stale.preflight(f.record, call, f.output)).status).toBe("ok")
      expect(observed.calls).toBeGreaterThan(0)
      observed.target = observed.calls
      observed.calls = 0
      expect((await f.stale.preflight(f.record, call, f.output)).status).toBe("denied")
      expect(observed.changed).toBe(true)
      expect(observed.calls).toBe(observed.target)
      expect(f.staleRequest.signal.aborted).toBe(false)
      expect(f.staleRequest.headers.get("authorization")).toBe("replacement-principal")
    } finally { f.authority.host.revalidate = revalidate; f.authority.human.finish(call) }
  }, "headers-after-final-revalidate")
}, 120_000)

