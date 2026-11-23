import { describe, expect, test } from "bun:test"
import type { SfIntentRef, SfRef, SfVersion } from "@orchestra/schema/sucafina/context"
import type { SfCopyKey, SfDisplayValue, SfMessage, SfUnit } from "../frame/types"
import type { SfReviewField, SfReviewSnapshot } from "./types"
import { sfReviewComparison, sfReviewReasons } from "./compare"

const label: SfMessage = { key: "sf.common.currentSource" as SfCopyKey }
const usd: SfUnit = { kind: "currency", code: "USD" }
const eur: SfUnit = { kind: "currency", code: "EUR" }
const number = (value: number, unit: SfUnit = usd, fractionDigits = 2): SfDisplayValue =>
  ({ kind: "number", value, unit, fractionDigits })
const field = (path: string, value: SfDisplayValue): SfReviewField => ({ path, label, value })
const persisted = (fields: readonly SfReviewField[]): SfReviewSnapshot =>
  ({ kind: "persisted", ref: "record" as SfRef, version: 0 as SfVersion, fields })
const draft = (fields: readonly SfReviewField[]): SfReviewSnapshot =>
  ({ kind: "draft", intentRef: "intent" as SfIntentRef, sourceRef: null, sourceVersion: null, fields })
const unknown: SfReviewSnapshot = { kind: "not-provided", reason: label }

describe("read-only review comparison", () => {
  test("compares the proposal to the supplied current source and identifies source drift separately", () => {
    const base = persisted([field("amount", number(100))])
    const current = persisted([field("amount", number(120))])
    const proposed = draft([field("amount", number(120))])
    const row = sfReviewComparison(base, current, proposed)[0]!
    expect(row.difference).toBe("same")
    expect(row.sourceChanged).toBe(true)
    expect(row.base).toBe(base.kind === "persisted" ? base.fields[0] : undefined)
    expect(row.current).toBe(current.kind === "persisted" ? current.fields[0] : undefined)
    expect(row.proposed).toBe(proposed.kind === "draft" ? proposed.fields[0] : undefined)
    expect(sfReviewComparison(base, current, draft([field("amount", number(130))]))[0]!.difference).toBe("changed")
  })

  test("uses the base only when a current version is not part of the review", () => {
    const base = persisted([field("amount", number(1))])
    const proposed = draft([field("amount", number(2))])
    expect(sfReviewComparison(base, null, proposed)[0]!.difference).toBe("changed")
    expect(sfReviewComparison(base, unknown, proposed)[0]!.difference).toBe("unavailable")
    expect(sfReviewComparison(base, persisted([]), proposed)[0]!.difference).toBe("unavailable")
  })

  test("never treats missing, unavailable, omitted or nonfinite values as zero", () => {
    const zero = draft([field("amount", number(0))])
    for (const value of [
      { kind: "missing", reason: label },
      { kind: "unavailable", reason: label },
      number(Number.NaN),
    ] satisfies readonly SfDisplayValue[]) {
      expect(sfReviewComparison(null, persisted([field("amount", value)]), zero)[0]!.difference).toBe("unavailable")
    }
    expect(sfReviewComparison(null, persisted([]), zero)[0]!.difference).toBe("unavailable")
    expect(sfReviewComparison(null, persisted([field("amount", number(0))]), zero)[0]!.difference).toBe("same")
    expect(sfReviewComparison(null, persisted([field("amount", number(1))]), zero)[0]!.difference).toBe("changed")
  })

  test("does not infer currency conversion or change from display precision", () => {
    const current = persisted([field("amount", number(10, usd, 2))])
    expect(sfReviewComparison(null, current, draft([field("amount", number(10, usd, 0))]))[0]!.difference).toBe("same")
    expect(sfReviewComparison(null, current, draft([field("amount", number(10, eur))]))[0]!.difference).toBe("changed")
  })

  test("retains opaque paths, repeated values and versions without mutating source fields", () => {
    const original = Object.freeze([
      field("opaque/0", number(2)),
      field("opaque/0", number(3)),
      field("original-only", number(4)),
    ])
    const proposed = Object.freeze([
      field("opaque/0", number(2)),
      field("opaque/0", number(5)),
      field("proposed-only", number(6)),
    ])
    const rows = sfReviewComparison(persisted(original), null, draft(proposed))
    expect(rows.map((row) => [row.path, row.occurrence])).toEqual([
      ["opaque/0", 0], ["opaque/0", 1], ["original-only", 0], ["proposed-only", 0],
    ])
    expect(rows.map((row) => row.difference)).toEqual(["unavailable", "unavailable", "unavailable", "unavailable"])
    expect(rows[2]!.base).toBe(original[2])
    expect(rows[3]!.proposed).toBe(proposed[2])
    expect(original.map((item) => item.value)).toEqual([number(2), number(3), number(4)])
    expect(proposed.map((item) => item.value)).toEqual([number(2), number(5), number(6)])
  })

  test("compares message parameters independently of key order and preserves list order", () => {
    const text = (params: Readonly<Record<string, string | number>>): SfDisplayValue =>
      ({ kind: "text", text: { kind: "message", message: { ...label, params } } })
    const current = persisted([field("message", text({ amount: 1, unit: "USD" }))])
    expect(sfReviewComparison(null, current, draft([field("message", text({ unit: "USD", amount: 1 }))]))[0]!.difference).toBe("same")
    expect(sfReviewComparison(null, current, draft([field("message", text({ unit: "EUR", amount: 1 }))]))[0]!.difference).toBe("changed")
    const list = (items: readonly SfDisplayValue[]): SfDisplayValue => ({ kind: "list", items })
    const known = persisted([field("items", list([number(1), number(2)]))])
    expect(sfReviewComparison(null, known, draft([field("items", list([number(2), number(1)]))]))[0]!.difference).toBe("changed")
    expect(sfReviewComparison(null, known, draft([field("items", list([number(1), { kind: "missing", reason: label }]))]))[0]!.difference).toBe("unavailable")
  })

  test("retains current values when a deletion provides no proposed snapshot", () => {
    const current = persisted([field("amount", number(0))])
    const rows = sfReviewComparison(current, current, unknown)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.current).toBe(current.kind === "persisted" ? current.fields[0] : undefined)
    expect(rows[0]!.proposed).toBeUndefined()
    expect(rows[0]!.difference).toBe("unavailable")
  })
})

describe("source snapshots without record identity", () => {
  test("compares a versioned scalar source without fabricating a record reference", () => {
    const source: SfReviewSnapshot = { kind: "source", version: 7 as SfVersion,
      scope: { kind: "data", text: "Current month · 2026" }, fields: [field("month", number(6))] }
    const result = sfReviewComparison(source, source, draft([field("month", number(7))]))[0]!
    expect(result.difference).toBe("changed")
    expect(result.sourceChanged).toBe(false)
    expect(result.base?.value).toEqual(number(6))
    expect(result.current?.value).toEqual(number(6))
    expect(result.proposed?.value).toEqual(number(7))
    expect(sfReviewComparison(source, unknown, draft([field("month", number(7))]))[0]!.difference).toBe("unavailable")
  })
})

describe("review blocking reasons", () => {
  test("retains ordered reason identity while removing duplicate keys and parameters", () => {
    const first: SfMessage = { key: label.key, params: { field: "amount", version: 4 } }
    const equivalent: SfMessage = { key: label.key, params: { version: 4, field: "amount" } }
    const differentValue: SfMessage = { key: label.key, params: { field: "amount", version: 5 } }
    const differentKey: SfMessage = { key: "sf.common.unknown" as SfCopyKey, params: first.params }
    expect(sfReviewReasons([first, equivalent, differentValue, differentKey, first]))
      .toEqual([first, differentValue, differentKey])
    expect(sfReviewReasons([label, { ...label, params: {} }])).toEqual([label])
  })
})
