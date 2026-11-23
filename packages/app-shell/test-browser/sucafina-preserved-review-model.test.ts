import { describe, expect, test } from "bun:test"
import { createRenderEffect, createRoot } from "solid-js"
import { createStore, unwrap } from "solid-js/store"
import { Option, Schema } from "effect"
import { SfReviewDomainProjection } from "@orchestra/schema/sucafina/reviews"
import { preservedValueGroups, preservedValuePresentation } from "../src/orchestra/chapters/sucafina/reviews/preserved/presentation"
import { comparableReviewSections, preservedSectionHasChanges, preservedValueRows, readPreservedProjection,
  type PreservedReview, type ReviewProjection } from "../src/orchestra/chapters/sucafina/reviews/preserved/model"

/** Presentation fixture only. It does not qualify a native producer or source admission. */
function projection(): ReviewProjection {
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const source = { surface: "dashboard" as const, type: "budget", id: "design-source",
    incarnation: "design-source-incarnation", version: 1, fields: ["amount", "absent", "flag", "text"],
    period, observedAt: "2026-11-23T00:00:00Z" }
  const evidence = { schema: "sf-evidence-v1" as const, kind: "record" as const, refId: "design-source-evidence",
    installationId: "design-installation", projectId: "design-project",
    refDigest: "a".repeat(64), evidenceLevel: "observed" as const,
    target: { surface: "dashboard" as const, recordType: "budget", recordId: source.id,
      incarnation: source.incarnation, version: 1, fields: source.fields, period, projectionDigest: "b".repeat(64) } }
  const cell = { period, granularity: "record" as const, sourceRefs: [evidence], drilldown: evidence }
  return {
    context: { installationId: "design-installation", projectId: "design-project", principalRef: "design-principal",
      accessRevision: "design-access", policyVersion: "design-policy", surface: "dashboard", period,
      currency: "USD", sourceRefs: [source], capabilities: [] },
    version: 1, engineVersion: "design-engine", components: [],
    values: [
      { ...cell, id: "amount", value: 0, unit: "money", currency: "USD", evidenceState: "confirmed" },
      { ...cell, id: "absent", value: null, unit: "money", currency: "USD", evidenceState: "absent" },
      { ...cell, id: "flag", value: false, evidenceState: "confirmed" },
      { ...cell, id: "text", value: "", evidenceState: "confirmed" },
    ],
    missing: [{ field: "absent", reason: "unavailable" }],
  }
}
function preserved(id: string, content: ReviewProjection): PreservedReview {
  return { id, version: 1, createdAt: "2026-11-23T00:00:00Z", sourceRefs: content.context.sourceRefs,
    sections: [{ id: "budget", title: "Design source budget", period: content.context.period,
      content, count: 4, sourceRefs: content.context.sourceRefs }], comments: [] }
}

describe("Preserved review JSON retains its closed schema after reactive storage", () => {
  test("tracked periods retain every source value, period and provenance field", () => {
    createRoot((dispose) => {
      try {
        const expected = projection()
        const [state] = createStore({ review: preserved("design-review", projection()) })
        createRenderEffect(() => { JSON.stringify(state.review) })
        const content = state.review.sections[0]!.content
        expect(unwrap(content)).not.toBe(content)
        expect(Option.isNone(Schema.decodeUnknownOption(SfReviewDomainProjection)(content))).toBe(true)
        const decoded = readPreservedProjection(content)
        expect(decoded).toEqual(expected)
        expect(decoded!.values.map((value) => value.value)).toEqual([0, null, false, ""])
        expect(decoded!.context.sourceRefs).toEqual(expected.context.sourceRefs)
        expect(decoded!.values[0]!.sourceRefs).toEqual(expected.values[0]!.sourceRefs)
        expect(Reflect.ownKeys(decoded!.context.period)).toEqual(["start", "end"])
      } finally { dispose() }
    })
  })

  test("only compatible original scopes compare, while source-only revisions remain nonnumeric", () => {
    createRoot((dispose) => {
      try {
        const [state] = createStore({ previous: preserved("design-previous", projection()),
          current: preserved("design-current", projection()) })
        createRenderEffect(() => { JSON.stringify(state) })
        expect(comparableReviewSections(state.previous, state.current)).toBe(true)
        expect(preservedSectionHasChanges(state.previous.sections[0]!, state.current.sections[0]!)).toBe(false)
        expect(preservedValueRows(state.previous.sections[0]!, state.current.sections[0]!)).toEqual([])

        const changedSource = projection()
        const currentSource = { ...changedSource.context.sourceRefs[0]!, observedAt: "2026-11-23T00:01:00Z" }
        const sourceRevision = preserved("design-source-revision", {
          ...changedSource, context: { ...changedSource.context, sourceRefs: [currentSource] },
        })
        expect(comparableReviewSections(state.previous, sourceRevision)).toBe(true)
        expect(preservedSectionHasChanges(state.previous.sections[0]!, sourceRevision.sections[0]!)).toBe(true)
        expect(preservedValueRows(state.previous.sections[0]!, sourceRevision.sections[0]!)).toEqual([])

        const otherCurrency = projection()
        expect(comparableReviewSections(state.previous, preserved("design-other-currency", {
          ...otherCurrency, context: { ...otherCurrency.context, currency: "EUR" },
        }))).toBe(false)
        const otherPeriod = projection()
        expect(comparableReviewSections(state.previous, preserved("design-other-period", {
          ...otherPeriod, context: { ...otherPeriod.context, period: { start: "2025-01-01", end: "2025-12-31" } },
        }))).toBe(false)
      } finally { dispose() }
    })
  })

  test("unexpected period keys and uncloneable reactive material stay rejected", () => {
    createRoot((dispose) => {
      try {
        const original = projection()
        const [state] = createStore({ content: {
          ...original, context: { ...original.context, period: { ...original.context.period, unexpected: "source-field" } },
        } })
        createRenderEffect(() => { JSON.stringify(state.content) })
        expect(readPreservedProjection(state.content)).toBeUndefined()
        const [uncloneable] = createStore({ content: { ...projection(), unsupported: () => undefined } })
        expect(unwrap(uncloneable.content)).not.toBe(uncloneable.content)
        expect(readPreservedProjection(uncloneable.content)).toBeUndefined()
        expect(readPreservedProjection(null)).toBeUndefined()
      } finally { dispose() }
    })
  })

  test("plain periods reject non-enumerable excess keys under the original decoder rules", () => {
    const original = projection()
    const ignored = { ...original, unsupported: () => undefined }
    expect(unwrap(ignored)).toBe(ignored)
    expect(readPreservedProjection(ignored)).toEqual(Schema.decodeUnknownSync(SfReviewDomainProjection)(ignored))

    const content = {
      ...original, context: { ...original.context, period: { ...original.context.period } },
    }
    expect(readPreservedProjection(content)).toEqual(original)
    Object.defineProperty(content.context.period, "unexpected", { value: "source-field", enumerable: false })
    expect(unwrap(content)).toBe(content)
    expect(Object.getOwnPropertyDescriptor(content.context.period, "unexpected")).toMatchObject({
      value: "source-field", enumerable: false,
    })
    expect(Option.isNone(Schema.decodeUnknownOption(SfReviewDomainProjection)(content))).toBe(true)
    expect(readPreservedProjection(content)).toBeUndefined()
    expect(Reflect.ownKeys(content.context.period)).toEqual(["start", "end", "unexpected"])
  })
})

describe("captured review field and record identity", () => {
  test("groups exact canonical record fields and uses only captured names", () => {
    const source = projection().values[0]!
    const values = [
      { ...source, id: "opexOwners[id:finance].name", value: "Finance", currency: undefined },
      { ...source, id: "opexOwners[id:finance].year", value: 2026, currency: undefined },
      { ...source, id: "opexOwners[id:finance].budget", value: 180000, currency: "unspecified" },
      { ...source, id: "opexEntries[id:june].ownerId", value: "finance", currency: undefined },
      { ...source, id: "opexEntries[id:june].actual", value: 0, currency: "USD" },
    ]
    const original = structuredClone(values)
    const groups = preservedValueGroups(values)
    expect(groups).toHaveLength(2)
    expect(groups[0]!.presentation).toMatchObject({ recordRef: "opexOwners[id:finance]", recordName: "Finance" })
    expect(groups[1]!.presentation).toMatchObject({ recordRef: "opexEntries[id:june]", recordName: "Finance" })
    expect(preservedValuePresentation(values[1]!, values).fieldKey).toBe("sf.u32.field.year")
    expect(preservedValuePresentation(values[2]!, values).fieldKey).toBe("sf.u32.field.budget")
    expect(groups.flatMap((group) => group.values)).toEqual(original)
  })

  test("never derives financial semantics or names from an opaque identity", () => {
    const value = { ...projection().values[0]!, id: "opaque-year-budget-2026", value: 2026, unit: undefined, currency: undefined }
    expect(preservedValuePresentation(value, [value])).toEqual({ recordRef: value.id })
    expect(preservedValueGroups([value])[0]!.values[0]).toBe(value)
    const malformed = { ...value, id: "unpublished[id:private].budget" }
    expect(preservedValuePresentation(malformed, [malformed])).toEqual({ recordRef: malformed.id })
  })

  test("ambiguous captured names are not silently chosen", () => {
    const source = projection().values[0]!
    const value = { ...source, id: "projects[id:project].budget" }
    const names = [
      { ...source, id: "projects[id:project].name", value: "First" },
      { ...source, id: "projects[id:project].name", value: "Second" },
    ]
    expect(preservedValuePresentation(value, [value, ...names])).toEqual({
      recordRef: "projects[id:project]", fieldKey: "sf.u32.field.budget", recordKey: "sf.u32.record.projects",
    })
  })
})
