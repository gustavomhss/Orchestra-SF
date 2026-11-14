import { expect, test } from "bun:test"
import type { ConfirmationScope } from "../../../product/contracts/context.ts"
import type { ReviewSection } from "../../../product/reviews/port.ts"
import { createReviewConfirmationReader } from "../../../product/routines/review-confirmation.ts"
import { prepareFactualReview } from "../../../product/routines/review.ts"
import { createRoutinePlannerFixture, routineJanuary } from "./planner-review-fixture.ts"

test("review preparation discovers real C06 by material scope without remembering a confirmation id", async () => {
  const fixture = await createRoutinePlannerFixture()
  try {
    const source = await fixture.source("v1")
    const scope: ConfirmationScope = { sourceRef: { surface: "planner", type: "planner-version", id: "v1", incarnation: source.target.incarnation }, fields: ["summary"], period: routineJanuary, materialDependencies: [], scopeDefinitionVersion: "planner-c06-v1" }
    const confirmed = await fixture.confirm(scope, "january-scope")
    const confirmationFor = createReviewConfirmationReader({ confirmation: fixture.confirmations, scopeFor: async () => ({ status: "ok", value: scope }), revalidate: fixture.host.revalidate })
    const read = () => prepareFactualReview({ topicRefs: ["january", "january"], period: routineJanuary, context: fixture.context, host: {
      readTopic: async () => {
        const observed = await fixture.observer.observe(scope, fixture.context)
        if (observed.state !== "available") return { status: "unavailable", reason: "source-unavailable" }
        const section: ReviewSection = { id: "january", title: "January", period: routineJanuary, recordCount: 1, projection: observed.projection }
        const confirmation = await confirmationFor(section, fixture.context)
        return confirmation.status === "ok" ? { status: "ok", value: { projection: section.projection, recordCount: 1, confirmation: confirmation.value } } : confirmation
      }, revalidate: (_refs, context) => fixture.host.revalidate(context),
    } })
    expect(await read()).toMatchObject({ status: "ok", value: { draft: { pendencies: [] } } })
    await fixture.editActual("v1", 1, 41000)
    expect(await read()).toMatchObject({ status: "ok", value: { draft: { pendencies: [] } } })
    await fixture.editActual("v1", 0, 42000)
    expect(await read()).toMatchObject({ status: "ok", value: { draft: { pendencies: [{ topicRef: "january", kind: "material-review" }] } } })
    const repeated = await read()
    if (repeated.status !== "ok") throw new Error(repeated.reason)
    expect(repeated.value.draft.pendencies).toHaveLength(1)
    expect(await fixture.confirmations.inspect(confirmed.id, fixture.context)).toMatchObject({ status: "ok", value: { observedSourceVersion: confirmed.observedSourceVersion, authorId: confirmed.authorId } })
    await fixture.persistence.transaction("planner", async (snapshot) => { snapshot.data.roleMap = []; return { commit: true, value: undefined } })
    const revoked = await read()
    expect(revoked).toMatchObject({ status: "ok", value: { draft: { sections: [], pendencies: [] } } })
    expect(JSON.stringify(revoked)).not.toContain(confirmed.id)
    expect(JSON.stringify(revoked)).not.toContain("42000")
  } finally { await fixture.dispose() }
}, 120_000)

test("a confirmation for a different source cannot close the selected section", async () => {
  const fixture = await createRoutinePlannerFixture()
  try {
    const source = await fixture.source("v1")
    const scope: ConfirmationScope = { sourceRef: { surface: "planner", type: "planner-version", id: "v1", incarnation: source.target.incarnation }, fields: ["summary"], period: routineJanuary, materialDependencies: [], scopeDefinitionVersion: "planner-c06-v1" }
    const observed = await fixture.observer.observe(scope, fixture.context)
    if (observed.state !== "available") throw new Error("Planner scope unavailable")
    const confirmationFor = createReviewConfirmationReader({ confirmation: fixture.confirmations, scopeFor: async () => ({ status: "ok", value: { ...scope, sourceRef: { ...scope.sourceRef, id: "v2" } } }), revalidate: fixture.host.revalidate })
    expect(await confirmationFor({ id: "january", title: "January", period: routineJanuary, recordCount: 1, projection: observed.projection }, fixture.context)).toEqual({ status: "unavailable", reason: "confirmation-scope-mismatch" })
  } finally { await fixture.dispose() }
}, 120_000)
