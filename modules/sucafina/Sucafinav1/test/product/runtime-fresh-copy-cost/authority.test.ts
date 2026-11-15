import { expect, test } from "bun:test"
import { selectSfCase } from "../../../product/host-binding/state-provider.ts"
import { createStateIsolationFixture } from "../finance-state-read-performance/fixture.ts"
import { current, record, warm } from "./fixture.ts"

test("non-target state reads keep both real authorization callbacks and reject final lease revocation", async () => {
  const f = await createStateIsolationFixture()
  try {
    await warm(f.store)
    await f.store.transaction("planner", async () => {
      const first = current(f.store)
      const selected = await f.state.read(f.request, "cases", selectSfCase("case", f.context))
      expect(selected).toMatchObject({ status: "ok", value: f.decision })
      expect(f.controls.checks.map((check) => check.mode)).toEqual(["read", "read"])
      record(record(first.dashboard.data.__sfProductV1).cases).case = "copy-only"
      expect(await f.state.read(f.request, "cases", selectSfCase("case", f.context))).toMatchObject({ status: "ok", value: f.decision })
      expect(f.controls.checks).toHaveLength(4)
      f.controls.checks.length = 0
      f.controls.observe = (_snapshot, _request, mode, index) => {
        if (mode === "read" && index === 2) f.ui.finish(f.context)
      }
      expect(await f.state.read(f.request, "cases", selectSfCase("case", f.context))).toEqual({ status: "denied", reason: "product-authority-changed" })
      expect(f.controls.checks.map((check) => check.request)).toEqual([f.request, f.request])
      f.controls.observe = undefined
      f.controls.checks.length = 0
      expect(await f.state.read(f.request, "cases", selectSfCase("case", f.context))).toEqual({ status: "denied", reason: "product-access-unavailable" })
      expect(f.controls.checks).toHaveLength(1)
      return { commit: false, value: undefined }
    })
    const admitted = await f.admit()
    expect(await f.state.read(admitted.request, "cases", selectSfCase("case", admitted.context))).toMatchObject({ status: "ok", value: f.decision })
  } finally { await f.close() }
})

test("non-target state reads keep final Request abort and never turn old copies into authority", async () => {
  const f = await createStateIsolationFixture()
  try {
    await warm(f.store)
    const controller = new AbortController()
    const admitted = await f.admit("principal", controller.signal)
    await f.store.transaction("planner", async () => {
      const before = current(f.store)
      f.controls.checks.length = 0
      f.controls.observe = (_snapshot, _request, mode, index) => {
        if (mode === "read" && index === 2) controller.abort(new Error("fresh observation request aborted"))
      }
      await expect(f.state.read(admitted.request, "cases", selectSfCase("case", admitted.context))).rejects.toThrow("fresh observation request aborted")
      expect(f.controls.checks.map((check) => check.request)).toEqual([admitted.request, admitted.request])
      expect(current(f.store)).toEqual(before)
      return { commit: false, value: undefined }
    })
    f.controls.observe = undefined
    expect(await f.state.read(f.request, "cases", selectSfCase("case", f.context))).toMatchObject({ status: "ok", value: f.decision })
  } finally { await f.close() }
})
