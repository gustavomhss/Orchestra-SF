import { expect, test } from "bun:test"
import type { SfProductState } from "../../product/contracts/state.ts"
import { selectSfCaseHealth } from "../../product/host-binding/state-provider.ts"
import { createStateIsolationFixture } from "../product/finance-state-read-performance/fixture.ts"

test("C08 health selects metadata before cloning unrelated state; opaque callbacks remain isolated", async () => {
  const f = await createStateIsolationFixture()
  try {
    let cloned = 0
    f.controls.observe = (snapshot, _request, mode, index) => {
      if (mode !== "read" || index !== 1) return
      const state = snapshot.data.__sfProductV1 as SfProductState
      state.preferences.large = Object.defineProperty({}, "sentinel", { enumerable: true, get: () => { cloned++; return "read" } })
    }
    const selector = selectSfCaseHealth(f.context.binding)
    expect(await f.state.read(f.request, "cases", selector)).toMatchObject({ status: "ok", value: { storageVersion: 1, aggregateRevision: 1 } })
    expect(cloned).toBe(0)
    f.controls.checks.length = 0
    expect(await f.state.read(f.request, "cases", (state, authority) => {
      state.cases.case!.objective = "private mutation"
      return selector(state, authority)
    })).toMatchObject({ status: "ok", value: { storageVersion: 1, aggregateRevision: 1 } })
    expect(cloned).toBe(1)
    f.controls.observe = undefined
    f.controls.checks.length = 0
    expect(await f.state.read(f.request, "cases", (state) => state.cases.case?.objective)).toMatchObject({ status: "ok", value: f.decision.objective })
  } finally { await f.close() }
})

test("C08 health never reads case rows and fails closed on changed authority and revocation", async () => {
  const f = await createStateIsolationFixture()
  try {
    const selector = selectSfCaseHealth(f.context.binding)
    let beyond = 0
    f.controls.observe = (snapshot, _request, mode, index) => {
      if (mode !== "read" || index !== 1) return
      const state = snapshot.data.__sfProductV1 as SfProductState
      state.cases = Object.fromEntries(Array.from({ length: 500 }, (_, index) => [`c${index}`, { ...f.decision, id: `c${index}`, participants: ["other"] }]))
      Object.defineProperty(state.cases, "beyond", { enumerable: true, get: () => { beyond++; throw new Error("read beyond ceiling") } })
    }
    expect(await f.state.read(f.request, "cases", selector)).toMatchObject({ status: "ok", value: { storageVersion: 1, aggregateRevision: 1 } })
    expect(beyond).toBe(0)
    f.controls.checks.length = 0
    f.controls.observe = (snapshot, _request, mode, index) => {
      if (mode === "read" && index === 1) (snapshot.data.__sfProductV1 as SfProductState).cases = {}
    }
    expect(await f.state.read(f.request, "cases", selector)).toMatchObject({ status: "ok", value: { storageVersion: 1, aggregateRevision: 1 } })
    f.controls.observe = undefined
    f.controls.checks.length = 0
    const outsider = await f.admit("outsider")
    expect(await f.state.read(outsider.request, "cases", selector)).toMatchObject({ status: "ok", value: undefined })
    f.controls.checks.length = 0
    f.controls.observe = (_snapshot, _request, mode, index) => { if (mode === "read" && index === 2) f.controls.enabled = false }
    expect(await f.state.read(f.request, "cases", selector)).toEqual({ status: "denied", reason: "product-authority-changed" })
  } finally { await f.close() }
})
