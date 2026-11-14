import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SfProductState } from "../../../product/contracts/state.ts"
import { currentChoiceAuthorityFixture } from "./real-authority-fixture.ts"

test("current-choice promotion requires the exact human action, persists atomically, and replays only with current authority", async () => {
  const fixture = await currentChoiceAuthorityFixture()
  try {
    const initial = await fixture.snapshot()
    const unauthorized = await fixture.promote(fixture.promotion, fixture.context)
    expect(unauthorized.status).toBe("denied")
    expect(unauthorized).not.toHaveProperty("value")
    const human = await fixture.admitPromotion()
    expect(await fixture.product.human.authorize(human.context, "decisions.promote-alternative", fixture.promotion)).toBe(true)
    expect(await fixture.product.human.authorize(human.context, "decisions.edit", fixture.promotion)).toBe(false)
    const changed = { ...fixture.promotion, choiceId: "another-choice" }
    expect((await fixture.promote(changed, human.context)).status).toBe("denied")
    expect((await fixture.promote(fixture.promotion, structuredClone(human.context))).status).not.toBe("ok")
    expect(digestSfValue(await fixture.snapshot())).toBe(digestSfValue(initial))

    const promoted = await fixture.promote(fixture.promotion, human.context)
    expect(promoted.status).toBe("ok")
    if (promoted.status !== "ok") throw new Error(`Real promotion unavailable: ${JSON.stringify(promoted)}`)
    expect(promoted.value.caseRef).toEqual({ ...fixture.caseRef, version: 3 })
    const after = await fixture.snapshot()
    const beforeState = initial.dashboard.data.__sfProductV1 as SfProductState
    const state = after.dashboard.data.__sfProductV1 as SfProductState
    const decision = state.cases[fixture.caseRef.id]!
    expect(decision.version).toBe(3)
    expect(decision.state).toBe("reconsidering")
    expect(decision.choices).toEqual(fixture.decision.choices)
    expect(digestSfValue(decision.choices[0])).toBe(digestSfValue(fixture.choice))
    expect(decision.alternatives[0]!.version).toBe(2)
    expect(decision.alternatives[0]!.scenario).toEqual(fixture.promotion.scenario)
    expect(digestSfValue(decision.alternatives[0]!.result)).toBe(fixture.promotion.resultDigest)
    expect(decision.alternatives[0]!.result!.knownSubtotal).toBeNull()
    expect(decision.alternatives[0]!.result!.total).toBeNull()
    expect(decision.alternatives[0]!.result!.costCoverage.coverageState).toBe("pending")
    expect(decision.preparedChanges).toEqual([])
    expect(decision.receipts).toEqual([])
    expect(decision.ledger).toEqual([])
    expect(state.decisionResults?.[promoted.value.resultRef]?.caseRef).toEqual(promoted.value.caseRef)
    expect(state.decisionResults?.[fixture.promotion.resultRef]).toEqual(beforeState.decisionResults?.[fixture.promotion.resultRef])
    expect(state.versions.cases).toBe(beforeState.versions.cases + 1)
    expect(state.versions.preferences).toBe(beforeState.versions.preferences)
    expect(Object.keys(state.transactions).length).toBe(Object.keys(beforeState.transactions).length + 1)
    expect(Object.keys(state.decisionResults ?? {}).length).toBe(Object.keys(beforeState.decisionResults ?? {}).length + 1)
    expect(digestSfValue(state.preferences)).toBe(digestSfValue(beforeState.preferences))
    expect(digestSfValue(after.planner)).toBe(digestSfValue(initial.planner))
    expect(digestSfValue(after.procurement)).toBe(digestSfValue(initial.procurement))

    expect(await fixture.promote(fixture.promotion, human.context)).toEqual(promoted)
    const retried = await fixture.admitPromotion()
    expect(retried.request).not.toBe(human.request)
    expect(retried.context.lease).not.toBe(human.context.lease)
    expect(await fixture.promote(fixture.promotion, retried.context)).toEqual(promoted)
    fixture.product.ui.finish(human.context)
    const revoked = await fixture.promote(fixture.promotion, human.context)
    expect(revoked.status).not.toBe("ok")
    expect(revoked).not.toHaveProperty("value")
    expect(await fixture.product.ui.revalidate(retried.context)).toBe(true)
    expect(digestSfValue(await fixture.snapshot())).toBe(digestSfValue(after))
    expect(fixture.events.producerCalls).toBe(0)
  } finally { await fixture.cleanup() }
})

test("current-choice real command identity rejects the same key with a different authorized payload", async () => {
  const fixture = await currentChoiceAuthorityFixture()
  try {
    const human = await fixture.admitPromotion()
    const promoted = await fixture.promote(fixture.promotion, human.context)
    expect(promoted.status).toBe("ok")
    if (promoted.status !== "ok") throw new Error(`Real promotion unavailable: ${JSON.stringify(promoted)}`)
    const before = await fixture.snapshot()
    const changed = { ...fixture.promotion, choiceId: "different-choice-same-command" }
    const retry = await fixture.admitPromotion(changed)
    expect(fixture.product.ui.operationIdentity(retry.context)).toBe(fixture.product.ui.operationIdentity(human.context))
    expect(await fixture.product.human.authorize(retry.context, "decisions.promote-alternative", changed)).toBe(true)
    expect(await fixture.promote(changed, retry.context)).toEqual({ status: "conflict", reason: "idempotency-content-changed" })
    expect(digestSfValue(await fixture.snapshot())).toBe(digestSfValue(before))
  } finally { await fixture.cleanup() }
})

test("current-choice durable replay suppresses its receipt when ui.finish runs in the final real read authorization", async () => {
  const fixture = await currentChoiceAuthorityFixture()
  try {
    const human = await fixture.admitPromotion()
    expect((await fixture.promote(fixture.promotion, human.context)).status).toBe("ok")
    const before = await fixture.snapshot()
    fixture.hooks.afterFinalCapture = async () => {
      fixture.events.applied += 1
      fixture.product.ui.finish(human.context)
    }
    const replay = await fixture.promote(fixture.promotion, human.context)
    expect(fixture.events.applied).toBe(1)
    expect(fixture.events.finalAuthorization).toBe(1)
    expect(replay.status).not.toBe("ok")
    expect(replay).not.toHaveProperty("value")
    expect(digestSfValue(await fixture.snapshot())).toBe(digestSfValue(before))
  } finally { await fixture.cleanup() }
})

for (const change of ["ui.finish", "expired lease", "request abort", "request headers", "unrelated renewed lease", "principal", "policy", "installation", "project", "source snapshot", "access snapshot"] as const) {
  test(`current-choice real promotion rolls back every staged mutation after final ${change}`, async () => {
    const fixture = await currentChoiceAuthorityFixture()
    try {
      const human = await fixture.admitPromotion()
      expect((await fixture.preview.read(fixture.promotion, human.context)).status).toBe("ok")
      const before = await fixture.snapshot()
      fixture.hooks.afterPromotionWork = async () => {
        fixture.events.applied += 1
        if (change === "ui.finish" || change === "unrelated renewed lease") fixture.product.ui.finish(human.context)
        if (change === "expired lease") fixture.clock.now += 300_001
        if (change === "request abort") fixture.controller.abort()
        if (change === "request headers") human.request.headers.set("x-command", "substituted-after-work")
        if (change === "principal") fixture.authenticated.principal = "another-person"
        if (change === "policy") fixture.changePolicy()
        if (change === "installation") fixture.identity.installationId = "other-installation"
        if (change === "project") fixture.identity.projectId = "other-project"
        if (change === "unrelated renewed lease") {
          const renewed = await fixture.renew()
          expect(renewed.context.lease).not.toBe(human.context.lease)
          expect(renewed.request).not.toBe(human.request)
          expect(fixture.product.ui.requestFor(renewed.context)).toBe(renewed.request)
          expect(await fixture.product.ui.revalidate(renewed.context)).toBe(true)
        }
        if (change === "source snapshot" || change === "access snapshot") {
          // The real authentication callback runs after C08 work, while SQLite
          // still owns the actual work snapshot retained by the timing probe.
          // An authorized actor cannot bless late source or access-scope drift.
          const snapshot = fixture.hooks.promotionSnapshot
          if (!snapshot) throw new Error("Final promotion did not retain its real Planner work snapshot")
          if (change === "source snapshot") {
            const versions = snapshot.data.versions as { lines: { b: number[] }[] }[]
            versions[0]!.lines[0]!.b[0] = 999
          }
          if (change === "access snapshot") snapshot.data.access = { person: { assigned: ["changed-after-work"], domains: [] } }
        }
      }
      const promoted = await fixture.promote(fixture.promotion, human.context)
      expect(fixture.events.applied).toBe(1)
      expect(fixture.events.finalAuthorization).toBe(1)
      expect(promoted.status).not.toBe("ok")
      expect(promoted).not.toHaveProperty("value")
      const after = await fixture.snapshot()
      expect(digestSfValue(after)).toBe(digestSfValue(before))
      const state = after.dashboard.data.__sfProductV1 as SfProductState
      expect(state.cases[fixture.caseRef.id]?.version).toBe(2)
      expect(state.cases[fixture.caseRef.id]?.alternatives[0]?.version).toBe(1)
      expect(state.cases[fixture.caseRef.id]?.choices).toEqual(fixture.decision.choices)
      expect(state.cases[fixture.caseRef.id]?.preparedChanges).toEqual([])
      expect(state.cases[fixture.caseRef.id]?.receipts).toEqual([])
      expect(Object.keys(state.transactions).some((key) => key.endsWith(':promote-current-choice"]'))).toBe(false)
      expect(fixture.events.producerCalls).toBe(0)
    } finally { await fixture.cleanup() }
  })
}
