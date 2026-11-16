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
    // A caller-supplied principal header is reauthenticated, not elevated by
    // the C16 model/tool input or by copying an already authorized payload.
    expect(await fixture.product.ui.admit(new Request(fixture.request, {
      headers: { "x-test-principal": "ungranted-person" },
    }), "sf_bi_view", digestSfValue(routes[2].payload))).toMatchObject({
      status: "denied", reason: "ui-authority-unavailable",
    })
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
          // A pending lease is not a consumed grant. Direct BI presentation
          // cannot bypass the host's one-use dispatch authority.
          const unconsumed = nativeValue(await fixture.product.native.lease(fixture.call("bi"),
            "sf_bi_view", digestSfValue(row.payload)))
          try {
            expect(await fixture.presentation(row.payload, unconsumed)).toMatchObject({
              status: "denied", reason: "authority-unavailable",
            })
          } finally { fixture.product.native.finish(unconsumed) }
          // Authenticate and consume the public UI's own exact BI request.
          // The C16 private MCP already consumed a separate native tool call.
          const read = nativeValue(await fixture.uiPresentation(row.payload))
          expect(read.projection).toEqual(decoded.value)
          expect(read.presentation.series.some((series) => series.role === "actual")).toBe(true)
          consumerRef = "readBiPresentation:BI01"
          observedAction = "authenticated-UI-presentation-consumed-native-domain-values"
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
          negative: ["missing-binding", "missing-receipt", "replayed-call", "forged-control-field",
            ...(row.route === "bi" ? ["unconsumed-lease"] : [])],
          provenance: "real-Dashboard-domain-and-native-Host/private-MCP",
          providerTurnObserved: false, agentInferenceWitness: false,
          AM02Qualified: false,
        }))
      }
      // Exercise the same out-of-grant boundary in both host generations.
      const crossSkill = object((await fixture.wrapper(fixture.call("dashboard"), "sf_kpi_explain",
        rows[1].payload)).output?.structured)
      expect(crossSkill.status).toBe("denied")
      expect(object(crossSkill.receipt).kind).toBe("unbound")
    }
    await assertions(routes, 1)
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

    // Revoke the principal's real Dashboard role in the persisted domain.
    // The old native binding and new authenticated UI must both fail closed.
    await fixture.revokeOwner()
    for (const row of freshRoutes) {
      const deniedUi = await fixture.product.ui.admit(fixture.request, row.operation, digestSfValue(row.payload))
      expect(deniedUi).toMatchObject({ status: "denied", reason: "ui-authority-unavailable" })
      const deniedNative = object((await fixture.wrapper(fixture.call(row.route), row.operation,
        row.payload)).output?.structured)
      expect(deniedNative.status).toBe("denied")
      expect(object(deniedNative.receipt).kind).toBe("unbound")
      console.info("SF_AM02_PERFORMANCE_C16_REVOKED:" + JSON.stringify({
        githubSha: process.env.GITHUB_SHA ?? null, operation: row.operation,
        caseRef: fixture.caseRef, runRef: fixture.admission(row.route).runId,
        nativeSessionId: fixture.admission(row.route).sessionID,
        revokedPrincipalRef: "person", result: "denied", source: "revoked-persisted-role-map",
        providerTurnObserved: false, AM02Qualified: false,
      }))
    }
  })
}, 240_000)
