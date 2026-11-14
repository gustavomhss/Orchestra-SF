import { expect, test } from "bun:test"
import { sfRunSourceFence } from "../../../../product/ai/run-store.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import { object } from "../../../../runtime/contract.ts"
import { createSfSourceFenceReader } from "../../../../../../../apps/cli/src/sucafina-product/source-fence-read.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"

async function seedCase(fixture: Awaited<ReturnType<typeof financialCompositionFixture>>) {
  const value: DecisionCase = { id: "source-fence-case", incarnation: "source-fence-incarnation", version: 1, state: "draft",
    objective: "Source fence counterproof", horizon: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD", criteria: [],
    participants: ["person"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const seeded = await fixture.authority.state.transaction(fixture.request("source-fence-case"), { namespace: "cases", expectedStorageVersion: 0,
    targetRef: fixture.authority.creationTarget.ref, targetIncarnation: fixture.authority.creationTarget.incarnation,
    idempotencyKey: "source-fence-case", commandDigest: digestSfValue(value) }, async (state) => {
    state.cases[value.id] = value
    return { commit: true, value: true }
  })
  expect(seeded.status).toBe("ok")
  return value
}

test("source fences join the real C08 read without opening a nested writer or changing stored state", async () => {
  const fixture = await financialCompositionFixture()
  const call = await fixture.read()
  const request = fixture.authority.host.requestFor(call)
  const transactionAll = fixture.persistence.transactionAll
  if (!request || !transactionAll) throw new Error("Real provider scope unavailable")
  let transactions = 0, nestedWriters = 0
  fixture.persistence.transactionAll = (work, options) => {
    transactions++
    if (fixture.persistence.currentSnapshots?.()) nestedWriters++
    return transactionAll(work, options)
  }
  try {
    const value = await seedCase(fixture)
    const outside = await fixture.business.readSourceFences(call)
    expect(outside).toEqual({ dashboard: expect.stringMatching(/^[a-f0-9]{64}$/), planner: expect.stringMatching(/^[a-f0-9]{64}$/), procurement: expect.stringMatching(/^[a-f0-9]{64}$/) })
    const before = transactions
    const grouped = await fixture.authority.state.read(request, "cases", async (state) => {
      const captured = digestSfValue(fixture.persistence.currentSnapshots?.())
      const first = await fixture.business.readSourceFences(call)
      const second = await fixture.business.readSourceFences(call)
      expect(first).toEqual(outside)
      expect(second).toEqual(first)
      expect(digestSfValue(fixture.persistence.currentSnapshots?.())).toBe(captured)
      expect(state.cases[value.id]).toEqual(value)
      return first
    })
    expect(grouped.status).toBe("ok")
    if (grouped.status !== "ok") throw new Error("Actual C08 read failed")
    expect(grouped.value).toEqual(outside)
    expect(transactions).toBe(before)
    expect(nestedWriters).toBe(0)
    const reopened = await fixture.authority.state.read(request, "cases", (state) => state.cases[value.id])
    expect(reopened.status).toBe("ok")
    if (reopened.status !== "ok") throw new Error("C08 reread unavailable")
    expect(reopened.value).toEqual(value)
  } finally {
    fixture.persistence.transactionAll = transactionAll
    fixture.authority.ui.finish(call)
    await fixture.dispose()
  }
}, 120_000)

test("source fences reject every domain revision and unversioned C08 changes across either authorization boundary", async () => {
  const fixture = await financialCompositionFixture()
  const call = await fixture.read()
  const transactionAll = fixture.persistence.transactionAll
  if (!transactionAll) throw new Error("Real provider scope unavailable")
  try {
    const value = await seedCase(fixture)
    for (const target of ["dashboard", "planner", "procurement", "product-state"] as const) for (const boundary of [1, 2]) {
      await transactionAll(async (snapshots) => {
        let calls = 0
        const beforeSource = sfRunSourceFence(snapshots.dashboard)
        const read = createSfSourceFenceReader({ persistence: fixture.persistence, host: {
          requestFor: fixture.authority.host.requestFor,
          revalidate: async (context) => {
            const authorized = await fixture.authority.host.revalidate(context)
            expect(authorized).toBe(true)
            if (++calls === boundary) {
              if (target === "product-state") {
                // Adversarial unversioned C08 mutation is deliberately made in
                // the real owning transaction, which is always rolled back.
                const decision = object(object(object(snapshots.dashboard.data.__sfProductV1).cases)[value.id])
                expect(decision.objective).toBe(value.objective)
                decision.objective = "Changed while its source fence stays identical"
                expect(sfRunSourceFence(snapshots.dashboard)).toBe(beforeSource)
              } else snapshots[target].versions["source-fence-probe"] = { version: 2, by: "person" }
            }
            return authorized
          },
        } })
        expect(await read(call)).toBeUndefined()
        expect(calls).toBe(boundary)
        return { commit: false, value: undefined }
      })
    }
  } finally { fixture.authority.ui.finish(call); await fixture.dispose() }
}, 120_000)

test("source fences reject changed Requests, all headers, aborted calls and revoked real authority before returning a locked proof", async () => {
  for (const target of ["request", "header", "abort", "lease", "host"] as const) for (const boundary of [1, 2]) {
    const abort = new AbortController()
    const fixture = await financialCompositionFixture({ signal: abort.signal })
    const call = await fixture.read()
    const original = fixture.authority.host.requestFor(call)
    const transactionAll = fixture.persistence.transactionAll
    if (!original || !transactionAll) throw new Error("Real authority/provider scope unavailable")
    let replacement: Request | undefined, calls = 0
    try {
      const read = createSfSourceFenceReader({ persistence: fixture.persistence, host: {
        requestFor: (context) => replacement ?? fixture.authority.host.requestFor(context),
        revalidate: async (context) => {
          const authorized = await fixture.authority.host.revalidate(context)
          expect(authorized).toBe(true)
          if (++calls === boundary) {
            if (target === "request") replacement = new Request(original)
            else if (target === "header") original.headers.set("x-unlisted-authority-header", "changed-during-authentication")
            else if (target === "abort") abort.abort(new Error("Actual Request cancelled"))
            else if (target === "lease") fixture.authority.ui.finish(call)
            else fixture.active.value = false
          }
          return target === "host" && calls === boundary ? fixture.authority.host.revalidate(context) : authorized
        },
      } })
      const result = await transactionAll(async () => ({ commit: false, value: await read(call) }))
      expect(result).toBeUndefined()
      expect(calls).toBe(boundary)
    } finally { fixture.authority.ui.finish(call); await fixture.dispose() }
  }
}, 120_000)
