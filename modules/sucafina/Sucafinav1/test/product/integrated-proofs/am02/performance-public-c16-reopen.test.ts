import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { decodeSfOperationOutput } from "../../../../product/contracts/schema-admission.ts"
import { dashboardMetricSelector } from "../../../../product/dashboard/sources.ts"
import { object } from "../../../../runtime/contract.ts"
import { withNativeDashboard, nativePeriod, nativeValue } from "../../wp02/native-capabilities-fixture.ts"

/** Independent AM02 Performance producer, extending the Planner producer in
 * forecast-domain-correlation.test.ts. This invokes the genuine product Host,
 * its C08 admissions, SessionV2/SkillV2, ToolRegistry, C16 SDK bridge and
 * Dashboard/BI domains. No synthetic Session/Skill/ToolRegistry or model turn.
 */
test("AM02 Performance UI/C16 private MCP keep three business ports and receipts aligned across host restart", async () => {
  await withNativeDashboard(async (fixture) => {
    const series = await fixture.issue(["budgetSeries"])
    const metrics = await fixture.issue(["budgetMetrics"])
    const routes = [
      { route: "dashboard", operation: "sf_dashboard_read",
        payload: { selectionRef: series.selectionRef, period: nativePeriod, fields: ["budgetSeries"] } },
      { route: "kpi", operation: "sf_kpi_explain",
        payload: { metricRef: dashboardMetricSelector(metrics.selectionRef, "total-budget"), period: nativePeriod } },
      { route: "bi", operation: "sf_bi_view",
        payload: { viewId: "BI01", selectionRef: series.selectionRef, period: nativePeriod } },
    ] as const
    const before = await fixture.snapshot()
    const old = routes.map((row) => ({ route: row.route, call: fixture.call(row.route),
      sessionID: fixture.admission(row.route).sessionID,
      receipt: fixture.admission(row.route).skillReceipts[0]! }))
    for (const row of routes) {
      const admission = fixture.admission(row.route)
      const skill = fixture.bundle.skills.find((item) => item.id === admission.skillReceipts[0]?.skillId)
      if (!skill) throw new Error("Host failed to distribute a real C15 skill")
      const receipt = admission.skillReceipts[0]!
      expect(receipt).toMatchObject({ runId: admission.runId, nativeSessionId: admission.sessionID,
        profileId: admission.profile.id, profileVersion: admission.profile.version,
        profileDigest: admission.profile.sourceDigest,
        skillId: skill.id, skillVersion: skill.version,
        sourceDigest: skill.sourceDigest, instructionsDigest: skill.instructionsDigest,
        manifestDigest: fixture.bundle.manifestDigest })
      const session = await fixture.session(admission.sessionID)
      const messages = await fixture.messages(admission.sessionID)
      expect(session.agent).toBe(admission.profile.id)
      expect(messages).toContainEqual(expect.objectContaining({ id: receipt.loadedMessageId, type: "synthetic" }))
      expect(messages.every((message) => message.type === "synthetic")).toBe(true)
    }
    const unauth = object((await fixture.wrapper(fixture.call("dashboard"), "sf_dashboard_read", routes[0].payload)).output?.structured)
    expect(unauth.status).toBe("denied")
    expect(object(unauth.receipt).kind).toBe("unbound")
    const invalidAdmission = fixture.admission("kpi")
    expect(await fixture.product.native.bind({ ...invalidAdmission, skillReceipts: [] })).toMatchObject({ status: "denied" })
    for (const row of routes) await fixture.bind(row.route)

    const assertions = async (rows: typeof routes, generation: number) => {
      for (const row of rows) {
        const ui = object(await fixture.ui(row.operation, row.payload))
        const context = fixture.call(row.route)
        const result = await fixture.wrapper(context, row.operation, row.payload)
        expect(result.result.type).not.toBe("error")
        const native = object(result.output?.structured)
        expect(native.status).toBe("ok")
        expect(ui.status).toBe("ok")
        const decoded = decodeSfOperationOutput(row.operation, native.result)
        const uiDecoded = decodeSfOperationOutput(row.operation, ui.result)
        if (!decoded.ok || !uiDecoded.ok) throw new Error(`Real ${row.operation} result failed canonical decoding`)
        expect(decoded.value).toEqual(uiDecoded.value)
        const nativeReceipt = object(native.receipt), uiReceipt = object(ui.receipt)
        for (const key of ["operation", "handlerExport", "inputDigest", "resultDigest", "principalRef", "accessRevision"])
          expect(nativeReceipt[key]).toEqual(uiReceipt[key])
        expect(nativeReceipt).toMatchObject({
          kind: "native", operation: row.operation, callId: context.toolCallID,
          runId: fixture.admission(row.route).runId,
          nativeSessionId: fixture.admission(row.route).sessionID,
          providerGeneration: generation, inputDigest: digestSfValue(row.payload),
          resultDigest: digestSfValue(decoded.value),
        })
        expect(uiReceipt).toMatchObject({ kind: "ui", principalRef: "person" })
        let consumerRef = "dashboard-public-ui-view"
        let observedAction = "reopened-public-UI-operation"
        if (row.route === "bi") {
          // An actual authorized BI presentation, not a named hypothetical
          // consumer, observes the projection from the same domain port.
          const lease = nativeValue(await fixture.product.native.lease(fixture.call("bi"),
            "sf_bi_view", digestSfValue(row.payload)))
          try {
            const read = nativeValue(await fixture.presentation(row.payload, lease))
            expect(read.projection).toEqual(decoded.value)
            expect(read.presentation.series.some((series) => series.role === "actual")).toBe(true)
            consumerRef = "readBiPresentation:BI01"
            observedAction = "real-BI-presentation-consumed-domain-values"
          } finally { fixture.product.native.finish(lease) }
        }
        if (row.route === "dashboard") {
          const values = object(native.result).values
          expect(values).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: "budget:2026-01:actual", value: 0, evidenceState: "confirmed" }),
            expect.objectContaining({ id: "budget:2026-02:actual", value: null, evidenceState: "absent" }),
          ]))
        }
        if (row.route === "kpi")
          expect(object(native.result).values).toContainEqual(expect.objectContaining({ id: "budgetMetrics.2026.totalBudget", value: 1300 }))
        const replay = object((await fixture.wrapper(context, row.operation, row.payload)).output?.structured)
        expect(replay.status).toBe("denied")
        expect(object(replay.receipt).kind).toBe("unbound")
        const forged = object((await fixture.wrapper(fixture.call(row.route), row.operation,
          { ...row.payload, principalRef: "not-the-authenticated-person" })).output?.structured)
        expect(forged.status).toBe("denied")
        expect(object(forged.receipt).kind).toBe("unbound")
        console.info("SF_AM02_PERFORMANCE_C16_CONSUMED:" + JSON.stringify({
          githubSha: process.env.GITHUB_SHA ?? null, operation: row.operation, pack: "performance",
          profileId: fixture.admission(row.route).profile.id,
          skillId: fixture.admission(row.route).skillReceipts[0]?.skillId,
          skillReceipt: fixture.admission(row.route).skillReceipts[0],
          caseRef: fixture.caseRef, principalRef: nativeReceipt.principalRef,
          accessRevision: nativeReceipt.accessRevision, domainPort: row.operation,
          inputDigest: nativeReceipt.inputDigest, resultDigest: nativeReceipt.resultDigest,
          bridgeCallID: nativeReceipt.callId, runRef: nativeReceipt.runId,
          nativeSessionId: nativeReceipt.nativeSessionId,
          consumerRef, observedAction, generation, persistedBusinessValues: decoded.value,
          negative: ["missing-binding", "missing-receipt", "replayed-call", "forged-control-field"],
          provenance: "real-Dashboard-domain-and-native-Host/private-MCP",
          providerTurnObserved: false, agentInferenceWitness: false,
          AM02Qualified: false,
        }))
      }
    }
    await assertions(routes, 1)
    const wrongSkill = object((await fixture.wrapper(fixture.call("dashboard"), "sf_kpi_explain",
      routes[1].payload)).output?.structured)
    expect(wrongSkill.status).toBe("denied")
    expect(object(wrongSkill.receipt).kind).toBe("unbound")
    expect(await fixture.snapshot()).toEqual(before)

    await fixture.reopen()
    expect(await fixture.snapshot()).toEqual(before)
    for (const row of old) {
      const denied = object((await fixture.wrapper(row.call,
        routes.find((entry) => entry.route === row.route)!.operation,
        routes.find((entry) => entry.route === row.route)!.payload)).output?.structured)
      expect(denied.status).toBe("denied")
      expect(object(denied.receipt).kind).toBe("unbound")
      expect(await fixture.product.native.bind(fixture.admission(row.route))).toMatchObject({ status: "denied" })
    }
    const freshSeries = await fixture.issue(["budgetSeries"])
    const freshMetrics = await fixture.issue(["budgetMetrics"])
    expect(freshSeries.selectionRef).not.toBe(series.selectionRef)
    expect(freshMetrics.selectionRef).not.toBe(metrics.selectionRef)
    const freshRoutes = [
      { ...routes[0], payload: { ...routes[0].payload, selectionRef: freshSeries.selectionRef } },
      { ...routes[1], payload: { ...routes[1].payload, metricRef: dashboardMetricSelector(freshMetrics.selectionRef, "total-budget") } },
      { ...routes[2], payload: { ...routes[2].payload, selectionRef: freshSeries.selectionRef } },
    ] as typeof routes
    for (const row of freshRoutes) {
      const ready = await fixture.prepare(row.route)
      expect(ready.sessionID).not.toBe(old.find((item) => item.route === row.route)!.sessionID)
      expect(ready.skillReceipts[0]?.loadedMessageId).not.toBe(old.find((item) => item.route === row.route)!.receipt.loadedMessageId)
      await fixture.bind(row.route)
    }
    await assertions(freshRoutes, 2)
    expect(await fixture.snapshot()).toEqual(before)
  })
}, 240_000)
