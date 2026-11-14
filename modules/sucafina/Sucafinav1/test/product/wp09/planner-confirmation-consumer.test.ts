import { expect, test } from "bun:test"
import { createPlannerForecastInsights } from "../../../product/planner/forecast-insights.ts"
import { createForecastFactsAccess, prepareForecastReview } from "../../../product/routines/forecast.ts"
import { prepareFactualReview } from "../../../product/routines/review.ts"
import { createScopedReviewHost } from "../../../product/routines/review-confirmation.ts"
import { createRoutinePlannerFixture, routineJanuary, routinePlannerPeriod } from "./planner-review-fixture.ts"

test("WP09 consumes Planner 12000/6000 differences, budget margin and missing actual without invented savings or reasons", async () => {
  const fixture = await createRoutinePlannerFixture()
  try {
    const base = await fixture.source("v0")
    const insights = createPlannerForecastInsights({ host: fixture.host, planner: fixture.product.planner, sources: fixture.product.sources })
    const before = await fixture.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data.versions) }))
    for (const [id, difference, margin] of [["v1", 12000, 2000], ["v2", 6000, -4000]] as const) {
      const candidate = await fixture.source(id)
      const result = await prepareForecastReview({
        request: { baseRef: base.refId, candidateRef: candidate.refId, period: routinePlannerPeriod, currency: "USD" }, context: fixture.context,
        host: { planner: fixture.product.planner, confirmations: async () => ({ status: "ok", value: [] }), revalidate: (_request, context) => fixture.host.revalidate(context), ...createForecastFactsAccess(insights) },
      })
      expect(result).toMatchObject({ status: "ok", value: { measured: { differenceAgainstBase: difference, completeDifference: null, budgetMargin: { value: margin, currency: "USD" }, budgetMarginBasis: "outlook-minus-budget" }, reviewState: "unconfirmed", complete: false, synthesisIncluded: false } })
      if (result.status !== "ok") throw new Error("forecast preparation unavailable")
      expect(result.value.gaps.absentActual).toBeArray()
      expect(Array.isArray(result.value.gaps.absentActual) && result.value.gaps.absentActual.length).toBe(3)
      expect(result.value.assignment.groups).toContainEqual({ responsibleRef: "owner:finance", valueIds: ["line:11:outlook-usd"] })
      expect(result.value.justifications).toMatchObject({ status: "unavailable", reason: "justification-source-unavailable" })
      expect(result.value).not.toHaveProperty("savings")
      expect(result.value.changes.every((change) => !("cause" in change))).toBe(true)
    }
    expect(await fixture.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot.data.versions }))).toEqual(before)
  } finally { await fixture.dispose() }
}, 120_000)

test("real C06 January v7 remains valid after February v8; material changes create one pending and revoked access hides review data", async () => {
  const fixture = await createRoutinePlannerFixture()
  try {
    await fixture.source("v1")
    for (const value of [40001, 40002, 40003, 40004, 40005, 40006]) await fixture.editActual("v1", 0, value)
    const version7 = await fixture.source("v1")
    expect(version7.target.version).toBe(7)
    const scope = { sourceRef: { surface: "planner" as const, type: "planner-version", id: "v1", incarnation: version7.target.incarnation }, fields: ["summary"], period: routineJanuary, materialDependencies: [], scopeDefinitionVersion: "planner-c06-v1" }
    const confirmed = await fixture.confirm(scope, "january-v7")
    expect(confirmed.observedSourceVersion).toBe(7)
    const original = structuredClone(confirmed)
    const readReview = () => prepareFactualReview({ topicRefs: ["january", "january"], period: routineJanuary, context: fixture.context, host: createScopedReviewHost({
      readTopic: async () => {
        const current = await fixture.observer.observe(scope, fixture.context)
        return current.state === "available" ? { status: "ok", value: { projection: current.projection, recordCount: 1, confirmationId: confirmed.id } } : { status: "unavailable", reason: "source-unavailable" }
      }, confirmation: fixture.confirmations, revalidate: (_refs, context) => fixture.host.revalidate(context),
    }) })
    const readForecast = async () => {
      const current = await fixture.source("v1")
      return prepareForecastReview({ request: { baseRef: current.refId, candidateRef: current.refId, period: routineJanuary, currency: "USD" }, context: fixture.context,
        host: { planner: fixture.product.planner, confirmations: async (_request, context) => {
          const validity = await fixture.confirmations.project(confirmed.id, context)
          return validity.status === "ok" ? { status: "ok", value: [validity.value, validity.value] } : validity
        }, revalidate: (_request, context) => fixture.host.revalidate(context) },
      })
    }
    await fixture.editActual("v1", 1, 41000)
    expect((await fixture.source("v1")).target.version).toBe(8)
    expect(await fixture.confirmations.project(confirmed.id, fixture.context)).toMatchObject({ status: "ok", value: { state: "valid", evaluatedSourceVersion: 8, reason: "unchanged-scope" } })
    const february = await readReview()
    expect(february).toMatchObject({ status: "ok", value: { draft: { pendencies: [], coverage: { selectedTopics: 1, includedTopics: 1, includedRecordCount: 1 } }, synthesisIncluded: false } })
    expect(await readForecast()).toMatchObject({ status: "ok", value: { pendingConfirmationIds: [], reviewState: "confirmed" } })
    await fixture.editActual("v1", 0, 42000)
    const january = await readReview()
    expect(january).toMatchObject({ status: "ok", value: { draft: { pendencies: [{ topicRef: "january", kind: "material-review", reason: "material-change" }] } } })
    if (january.status !== "ok") throw new Error("January review unavailable")
    expect(january.value.draft.pendencies).toHaveLength(1)
    expect(await readForecast()).toMatchObject({ status: "ok", value: { pendingConfirmationIds: [confirmed.id], reviewState: "pending" } })
    expect(await fixture.confirmations.inspect(confirmed.id, fixture.context)).toMatchObject({ status: "ok", value: { observedSourceVersion: 7, confirmedAt: original.confirmedAt, authorId: original.authorId } })
    expect(confirmed).toEqual(original)
    await fixture.persistence.transaction("planner", async (snapshot) => { snapshot.data.roleMap = []; return { commit: true, value: undefined } })
    const revoked = await readReview()
    expect(revoked).toMatchObject({ status: "ok", value: { topics: [{ state: "unavailable", reason: "source-unavailable" }], draft: { sections: [], pendencies: [] } } })
    expect(JSON.stringify(revoked)).not.toContain(confirmed.id)
    expect(JSON.stringify(revoked)).not.toContain(original.observedScopeFingerprint)
    expect(JSON.stringify(revoked)).not.toContain("42000")
    expect(await fixture.confirmations.project(confirmed.id, fixture.context)).toMatchObject({ status: "ok", value: { state: "unavailable" } })
  } finally { await fixture.dispose() }
}, 120_000)
