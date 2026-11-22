import { describe, expect, test } from "bun:test"
import { createRenderEffect, createRoot } from "solid-js"
import { createStore, unwrap } from "solid-js/store"
import { Option, Schema } from "effect"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { SfViewsOpen, SfViewsSave, SfViewsRemove } from "@orchestra/schema/sucafina/work"
import { savedViewCommandSnapshot } from "../src/orchestra/chapters/sucafina/views/command-snapshot"

type Save = typeof SfViewsSave.Input.Type
const original = (): Save => ({
  surface: "planner", action: "save",
  input: {
    expectedVersion: 1,
    view: {
      id: "wave-four-opex-view", title: "Design test data · Regional OPEX view",
      surface: "planner", page: "OPEX", density: "comfortable",
      period: { start: "2026-01-01", end: "2026-12-31" },
      filters: { query: "Design test data", selections: { year: "2026" } },
    },
  },
})

describe("saved views at the unchanged native command boundary", () => {
  test("a reviewed Solid view preserves exact filters, period and CAS in a detached command", () => {
    createRoot((dispose) => {
      try {
        const initial = original()
        const wireRead = SfNativeOperationBindings["views.open"]!.decodeOutput({
          status: "ok", value: { view: initial.input.view, version: 1 },
        })
        expect(wireRead.status).toBe("ok")
        if (wireRead.status !== "ok") throw new Error("Original saved-view output unavailable")
        const opened = Schema.decodeUnknownOption(Schema.toType(SfViewsOpen.Output), {
          onExcessProperty: "error",
        })(wireRead.value)
        if (Option.isNone(opened) || opened.value.status !== "ok") throw new Error("Saved-view output rejected")
        expect(Object.hasOwn(opened.value.value.view, "currency")).toBe(false)
        const [screen, setScreen] = createStore({ record: opened.value.value })
        createRenderEffect(() => {
          Object.values(screen.record.view)
          Object.values(screen.record.view.period!)
          Object.values(screen.record.view.filters!)
          Object.values(screen.record.view.filters!.selections!)
        })
        expect(unwrap(screen.record.view)).not.toBe(screen.record.view)
        const tracked = {
          surface: screen.record.view.surface, action: "save" as const,
          input: {
            view: { ...screen.record.view, title: "Design test data · Regional OPEX review", density: "compact" as const },
            expectedVersion: screen.record.version,
          },
        }
        expect(Option.isNone(Schema.decodeUnknownOption(Schema.toType(SfViewsSave.Input), {
          onExcessProperty: "error",
        })(tracked))).toBe(true)
        const input = savedViewCommandSnapshot(tracked)
        const before = original()
        const exact = { ...before, input: { ...before.input, view: {
          ...before.input.view, title: "Design test data · Regional OPEX review", density: "compact" as const,
        } } }
        expect(input).toEqual(exact)
        expect(Option.isSome(Schema.decodeUnknownOption(Schema.toType(SfViewsSave.Input), {
          onExcessProperty: "error",
        })(input))).toBe(true)
        const admitted = SfNativeOperationBindings["views.save"]!.decodeInput(input)
        expect(admitted.status).toBe("ok")
        if (admitted.status === "ok") expect(admitted.value).toEqual(exact)
        expect(input.input.view.period).not.toBe(screen.record.view.period)
        expect(input.input.view.filters).not.toBe(screen.record.view.filters)
        expect(input.input.view.filters?.selections).not.toBe(screen.record.view.filters?.selections)
        expect(Reflect.ownKeys(input.input.view.period!).every((key) => typeof key === "string")).toBe(true)
        expect(Reflect.ownKeys(input.input.view.filters!.selections!).every((key) => typeof key === "string")).toBe(true)
        setScreen("record", "view", "filters", "query", "Later source query")
        setScreen("record", "view", "period", "end", "2026-11-30")
        setScreen("record", "version", 2)
        expect(input).toEqual(exact)
      } finally { dispose() }
    })
  })

  test("detachment retains invalid fields and scalar values for the original codec to reject", () => {
    const extra = { ...original(), unexpectedApproval: true }
    const unknownNested = original()
    Object.assign(unknownNested.input.view.filters!, { unexpectedFilter: "not admitted" })
    const undefinedField = original()
    Object.assign(undefinedField.input.view, { currency: undefined })
    const current = original()
    const nonFinite = { ...current, input: { ...current.input, expectedVersion: Number.NaN } }
    for (const value of [extra, unknownNested, undefinedField, nonFinite]) {
      createRoot((dispose) => {
        try {
          const [state] = createStore({ value })
          createRenderEffect(() => { Object.values(state.value); Object.values(state.value.input.view) })
          const copied = savedViewCommandSnapshot(state.value)
          expect(SfNativeOperationBindings["views.save"]!.decodeInput(copied).status).toBe("invalid")
        } finally { dispose() }
      })
    }
    expect(Object.hasOwn(savedViewCommandSnapshot(extra), "unexpectedApproval")).toBe(true)
    expect(Object.hasOwn(savedViewCommandSnapshot(unknownNested).input.view.filters!, "unexpectedFilter")).toBe(true)
    expect(Object.hasOwn(savedViewCommandSnapshot(undefinedField).input.view, "currency")).toBe(true)
    expect(savedViewCommandSnapshot(undefinedField).input.view.currency).toBeUndefined()
    expect(Number.isNaN(savedViewCommandSnapshot(nonFinite).input.expectedVersion)).toBe(true)
  })

  test("a remove command keeps the current source identity and expected version unchanged", () => {
    const input = savedViewCommandSnapshot({
      surface: "planner", action: "remove",
      input: { id: original().input.view.id, expectedVersion: 3 },
    })
    expect(Option.isSome(Schema.decodeUnknownOption(Schema.toType(SfViewsRemove.Input), {
      onExcessProperty: "error",
    })(input))).toBe(true)
    const admitted = SfNativeOperationBindings["views.remove"]!.decodeInput(input)
    expect(admitted.status).toBe("ok")
    if (admitted.status === "ok") expect(admitted.value).toEqual(input)
  })
})
