import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import type { BiViewRequest, DashboardReadRequest, KpiExplainRequest } from "../../../product/contracts/operations.ts"
import type { BoundCapabilityReceipt } from "../../../product/contracts/sf-execution.ts"
import { dashboardMetricSelector } from "../../../product/dashboard/sources.ts"
import { object } from "../../../runtime/contract.ts"
import { nativePeriod, nativeValue, withNativeDashboard } from "./native-capabilities-fixture.ts"

type Operation = "sf_dashboard_read" | "sf_kpi_explain" | "sf_bi_view"

function projection(operation: Operation, result: unknown) {
  const value = object(result)
  expect(value.status).toBe("ok")
  const decoded = decodeSfOperationOutput(operation, value.result)
  if (!decoded.ok) throw new Error(`Invalid ${operation} output`)
  const receipt = object(value.receipt)
  expect(receipt.operation).toBe(operation)
  expect(receipt.resultDigest).toBe(digestSfValue(decoded.value))
  expect(receipt.principalRef).toBe("person")
  expect(receipt.accessRevision).toMatch(/^[a-f0-9]{64}$/)
  return decoded.value
}

function comparableReceipt(result: unknown) {
  const receipt = object(object(result).receipt)
  return { operation: receipt.operation, handlerExport: receipt.handlerExport, inputDigest: receipt.inputDigest,
    resultDigest: receipt.resultDigest, principalRef: receipt.principalRef, accessRevision: receipt.accessRevision }
}

// The dispatcher deliberately strips the handler's admission receipt from every non-ok result.
function refusedUnbound(result: unknown, status: "denied" | "unavailable" | "stale", reason?: string) {
  const value = object(result)
  expect(value.status).toBe(status)
  if (reason) expect(value.reason).toBe(reason)
  expect(Object.hasOwn(value, "result")).toBe(false)
  expect(object(value.receipt).kind).toBe("unbound")
  expect(Object.hasOwn(object(value.receipt), "resultDigest")).toBe(false)
}

// A directly invoked handler with a consumed valid lease retains only its native admission receipt.
function refusedNativeHandler(result: unknown, expected: BoundCapabilityReceipt | undefined, status: "denied" | "stale", reason: string) {
  if (!expected || expected.kind !== "native") throw new Error("Expected native admission receipt unavailable")
  const value = object(result)
  expect(value.status).toBe(status)
  expect(value.reason).toBe(reason)
  expect(Object.hasOwn(value, "result")).toBe(false)
  const receipt = object(value.receipt)
  expect(Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== "at"))).toEqual(Object.fromEntries(Object.entries(expected).filter(([key]) => key !== "at")))
  expect(receipt.kind).toBe("native")
  expect(Object.hasOwn(receipt, "resultDigest")).toBe(false)
}

test("AM02: real SessionV2 skill admission reaches Dashboard, KPI and WP05 through native C16 with current authority", async () => {
  await withNativeDashboard(async (fixture) => {
    const routeNames = ["dashboard", "kpi", "bi"] as const
    // loadSfSkill invokes the real SessionV2.skill({ resume: false }). Receipt message IDs and hashes
    // below come from the native loader and its durable synthetic messages, never from a literal fixture.
    for (const route of routeNames) {
      const admission = fixture.admission(route)
      const receipt = admission.skillReceipts[0]!
      const skill = fixture.bundle.skills.find((skill) => skill.id === receipt.skillId)
      expect(skill).toBeDefined()
      expect(receipt).toMatchObject({ nativeSessionId: admission.sessionID, runId: admission.runId, profileId: admission.profile.id,
        profileVersion: admission.profile.version, profileDigest: admission.profile.sourceDigest, manifestDigest: fixture.bundle.manifestDigest,
        sourceDigest: skill?.sourceDigest, instructionsDigest: skill?.instructionsDigest })
      const messages = await fixture.messages(admission.sessionID)
      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject({ id: receipt.loadedMessageId, type: "synthetic" })
      expect(await fixture.session(admission.sessionID)).toMatchObject({ agent: admission.profile.id, location: fixture.location,
        cost: 0, tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } })
      expect(nativeValue(await fixture.product.state.read(fixture.request, "contributions", (state) => state.nativeRuns?.[admission.runId]))).toMatchObject({
        state: "queued", version: 2, caseRef: fixture.caseRef, selection: admission.selected, native: { sessionID: admission.sessionID, skillReceipt: receipt },
      })
    }
    expect(new Set(routeNames.map((route) => fixture.admission(route).sessionID)).size).toBe(3)

    const series = await fixture.issue(["budgetSeries"])
    const metrics = await fixture.issue(["budgetMetrics"])
    const read: DashboardReadRequest = { selectionRef: series.selectionRef, fields: ["budgetSeries"], period: nativePeriod }
    const explain: KpiExplainRequest = { metricRef: dashboardMetricSelector(metrics.selectionRef, "total-budget"), period: nativePeriod }
    const bi: BiViewRequest = { selectionRef: series.selectionRef, viewId: "BI01", period: nativePeriod }
    const before = await fixture.snapshot()

    // An existing native Session and loaded skill still grant no business call without a host binding.
    refusedUnbound((await fixture.wrapper(fixture.call("dashboard"), "sf_dashboard_read", read)).output?.structured, "denied")
    const dashboardAdmission = fixture.admission("dashboard")
    expect(await fixture.product.native.bind({ ...dashboardAdmission, skillReceipts: [] })).toMatchObject({ status: "denied", reason: "invalid-native-admission" })
    expect(await fixture.product.native.bind({ ...dashboardAdmission, skillReceipts: [{ ...dashboardAdmission.skillReceipts[0]!, sourceDigest: digestSfValue("different source bytes") }] })).toMatchObject({ status: "denied", reason: "skill-receipt-mismatch" })
    expect(await fixture.product.native.bind({ ...dashboardAdmission, skillReceipts: [{ ...dashboardAdmission.skillReceipts[0]!, loadedMessageId: "msg_not_observed" }] })).toMatchObject({ status: "denied", reason: "native-authority-unavailable" })
    const dashboardBinding = await fixture.bind("dashboard")
    await fixture.bind("kpi")
    await fixture.bind("bi")

    const cases = [
      { route: "dashboard", operation: "sf_dashboard_read", payload: read, handler: "readDashboard" },
      { route: "kpi", operation: "sf_kpi_explain", payload: explain, handler: "explainKpi" },
      { route: "bi", operation: "sf_bi_view", payload: bi, handler: "readBiView" },
    ] as const
    for (const item of cases) {
      const ui = await fixture.ui(item.operation, item.payload)
      const call = fixture.call(item.route)
      const context = nativeValue(await fixture.product.native.lease(call, item.operation, digestSfValue(item.payload)))
      try {
        const direct = await fixture.dispatch(item.operation, item.payload, context)
        const canonical = item.route === "kpi" ? nativeValue(await fixture.dashboard.explain(explain, context)) : nativeValue(await fixture.dashboard.read(read, context))
        const native = projection(item.operation, direct)
        expect(native).toEqual(canonical)
        expect(native).toEqual(projection(item.operation, ui))
        expect(comparableReceipt(direct)).toEqual(comparableReceipt(ui))
        expect(object(direct.receipt)).toMatchObject({ kind: "native", operation: item.operation, handlerExport: item.handler,
          callId: call.toolCallID, inputDigest: digestSfValue(item.payload), nativeSessionId: fixture.admission(item.route).sessionID,
          runId: fixture.admission(item.route).runId, providerGeneration: 1 })

        const wrapperCall = fixture.call(item.route)
        const settled = await fixture.wrapper(wrapperCall, item.operation, item.payload)
        expect(settled.result.type).not.toBe("error")
        expect(projection(item.operation, settled.output?.structured)).toEqual(native)
        expect(comparableReceipt(settled.output?.structured)).toEqual(comparableReceipt(direct))
        expect(object(object(settled.output?.structured).receipt)).toMatchObject({ kind: "native", callId: wrapperCall.toolCallID,
          runId: fixture.admission(item.route).runId, nativeSessionId: fixture.admission(item.route).sessionID })
        console.info("AM02 native capability proof:", JSON.stringify({
          scope: "SessionV2.skill(resume:false), host admission, C16 and consumer; no LLM/GNATIVE assertion",
          transports: ["ui", "native-direct", "native-wrapper/private-mcp"],
          skillReceipt: fixture.admission(item.route).skillReceipts[0], receipt: comparableReceipt(direct),
        }))

        if (item.route === "kpi") {
          expect(native.values).toHaveLength(1)
          expect(native.values[0]).toMatchObject({ id: "budgetMetrics.2026.totalBudget", value: 1300, currency: "unspecified" })
        }
        if (item.route !== "kpi") {
          expect(native.values).toContainEqual(expect.objectContaining({ id: "budget:2026-01:actual", value: 0, evidenceState: "confirmed" }))
          expect(native.values).toContainEqual(expect.objectContaining({ id: "budget:2026-02:actual", value: null, evidenceState: "absent" }))
          expect(native.missing).toContainEqual({ field: "budget:2026-02:actual", reason: "missing" })
        }
        if (item.route === "bi") {
          const presentation = nativeValue(await fixture.presentation(bi, context))
          expect(presentation.projection).toEqual(native)
          expect(presentation.projection).toEqual(projection("sf_dashboard_read", await fixture.ui("sf_dashboard_read", read)))
          expect(presentation.presentation.series.find((series) => series.role === "actual")?.valueIds).toContain("budget:2026-01:actual")
          expect(presentation.presentation.series.find((series) => series.role === "actual")?.valueIds).toContain("budget:2026-02:actual")
          expect(presentation.presentation.limitations).toContain("Currency is unspecified in Dashboard; missing actual or forecast stays unknown.")
        }
        refusedUnbound(await fixture.dispatch(item.operation, item.payload, context), "denied")
        expect(await fixture.product.native.lease(call, item.operation, digestSfValue(item.payload))).toMatchObject({ status: "denied", reason: "native-call-already-issued" })
        refusedUnbound((await fixture.wrapper(wrapperCall, item.operation, item.payload)).output?.structured, "denied")
      } finally { fixture.product.native.finish(context) }
    }
    expect(await fixture.snapshot()).toEqual(before)

    // The handler cannot borrow an unconsumed lease, and serialized authority cannot extend the closed input schema.
    const unconsumed = nativeValue(await fixture.product.native.lease(fixture.call("dashboard"), "sf_dashboard_read", digestSfValue(read)))
    const descriptor = fixture.descriptors.find((descriptor) => descriptor.id === "sf_dashboard_read")
    if (!descriptor) throw new Error("Dashboard descriptor unavailable")
    refusedUnbound(await descriptor.handler(read, unconsumed), "unavailable")
    fixture.product.native.finish(unconsumed)
    refusedUnbound((await fixture.wrapper(fixture.call("dashboard"), "sf_kpi_explain", explain)).output?.structured, "denied")
    refusedUnbound((await fixture.wrapper(fixture.call("dashboard"), "sf_dashboard_read", { ...read, principalRef: "another-person", accessRevision: dashboardBinding.accessRevision })).output?.structured, "denied")
    const missing = { ...read, selectionRef: `sf-source:${randomUUID()}:1` }
    const missingContext = nativeValue(await fixture.product.native.lease(fixture.call("dashboard"), "sf_dashboard_read", digestSfValue(missing)))
    try {
      expect(await fixture.product.authority.validateDomainContext(missingContext, "sf_dashboard_read", digestSfValue(missing))).toBe(true)
      refusedNativeHandler(await descriptor.handler(missing, missingContext), fixture.product.native.receiptFor(missingContext, "sf_dashboard_read", digestSfValue(missing)), "denied", "source-unavailable")
    } finally { fixture.product.native.finish(missingContext) }
    refusedUnbound((await fixture.wrapper(fixture.call("dashboard"), "sf_dashboard_read", missing)).output?.structured, "denied", "source-unavailable")
    expect(await fixture.snapshot()).toEqual(before)

    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: null, version: 2, by: "person" }]
      return { commit: true, value: undefined }
    })
    const revoked = await fixture.snapshot()
    for (const item of cases) refusedUnbound((await fixture.wrapper(fixture.call(item.route), item.operation, item.payload)).output?.structured, "denied")
    expect(await fixture.product.ui.admit(fixture.request, "sf_dashboard_read", digestSfValue(read))).toMatchObject({ status: "denied" })
    expect(await fixture.snapshot()).toEqual(revoked)
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "native-dashboard-admins", version: 3, by: "person" }]
      return { commit: true, value: undefined }
    })
    fixture.product.native.revoke(dashboardBinding)
    refusedUnbound((await fixture.wrapper(fixture.call("dashboard"), "sf_dashboard_read", read)).output?.structured, "denied")
    await fixture.bind("dashboard")

    // Restoring the same effective roles revalidates the binding, while the role-map
    // revision keeps every previously issued source scope revoked.
    for (const item of cases) refusedUnbound((await fixture.wrapper(fixture.call(item.route), item.operation, item.payload)).output?.structured, "denied", "source-unavailable")
    const restoredSeries = await fixture.issue(["budgetSeries"])
    const restoredMetrics = await fixture.issue(["budgetMetrics"])
    expect(restoredSeries.selectionRef).not.toBe(series.selectionRef)
    expect(restoredMetrics.selectionRef).not.toBe(metrics.selectionRef)
    const restoredRead: DashboardReadRequest = { ...read, selectionRef: restoredSeries.selectionRef }
    const restoredExplain: KpiExplainRequest = { ...explain, metricRef: dashboardMetricSelector(restoredMetrics.selectionRef, "total-budget") }
    const restoredBi: BiViewRequest = { ...bi, selectionRef: restoredSeries.selectionRef }
    const restoredCases = [
      { ...cases[0], payload: restoredRead },
      { ...cases[1], payload: restoredExplain },
      { ...cases[2], payload: restoredBi },
    ] as const
    for (const item of restoredCases) {
      const native = (await fixture.wrapper(fixture.call(item.route), item.operation, item.payload)).output?.structured
      expect(projection(item.operation, native)).toEqual(projection(item.operation, await fixture.ui(item.operation, item.payload)))
    }

    const held = nativeValue(await fixture.product.native.lease(fixture.call("bi"), "sf_bi_view", digestSfValue(restoredBi)))
    try {
      projection("sf_bi_view", await fixture.dispatch("sf_bi_view", restoredBi, held))
      await fixture.persistence.transaction("dashboard", async (snapshot) => {
        snapshot.data.opexOwners = [{ id: "owner", budget: 1320 }]
        return { commit: true, value: undefined }
      })
      expect(await fixture.presentation(restoredBi, held)).toMatchObject({ status: "stale" })
      const changed = await fixture.snapshot()
      const staleContext = nativeValue(await fixture.product.native.lease(fixture.call("dashboard"), "sf_dashboard_read", digestSfValue(restoredRead)))
      try {
        expect(await fixture.product.authority.validateDomainContext(staleContext, "sf_dashboard_read", digestSfValue(restoredRead))).toBe(true)
        refusedNativeHandler(await descriptor.handler(restoredRead, staleContext), fixture.product.native.receiptFor(staleContext, "sf_dashboard_read", digestSfValue(restoredRead)), "stale", "source-replaced-or-changed")
      } finally { fixture.product.native.finish(staleContext) }
      for (const item of restoredCases) refusedUnbound((await fixture.wrapper(fixture.call(item.route), item.operation, item.payload)).output?.structured, "stale", "source-replaced-or-changed")
      expect(await fixture.snapshot()).toEqual(changed)
    } finally { fixture.product.native.finish(held) }

    // Reopen the actual product SQLite database. Durable cases/runs/sources survive; process-local
    // admissions and observations do not. This is not a claim that an LLM turn ran or resumed.
    const durable = await fixture.snapshot()
    const priorSession = fixture.admission("dashboard").sessionID
    const priorCall = fixture.call("dashboard")
    await fixture.reopen()
    expect(await fixture.snapshot()).toEqual(durable)
    refusedUnbound((await fixture.wrapper(priorCall, "sf_dashboard_read", read)).output?.structured, "denied")
    expect(await fixture.product.native.bind(fixture.admission("dashboard"))).toMatchObject({ status: "denied", reason: "native-authority-unavailable" })
    const current = await fixture.issue(["budgetSeries"])
    expect(current.selectionRef).not.toBe(series.selectionRef)
    expect(current.selectionRef).not.toBe(restoredSeries.selectionRef)
    const currentRead = { ...restoredRead, selectionRef: current.selectionRef }
    const fresh = await fixture.prepare("dashboard")
    expect(fresh.sessionID).not.toBe(priorSession)
    expect(fresh.skillReceipts[0]?.loadedMessageId).not.toBe(dashboardAdmission.skillReceipts[0]?.loadedMessageId)
    await fixture.bind("dashboard")
    const refreshed = (await fixture.wrapper(fixture.call("dashboard"), "sf_dashboard_read", currentRead)).output?.structured
    expect(projection("sf_dashboard_read", refreshed)).toEqual(projection("sf_dashboard_read", await fixture.ui("sf_dashboard_read", currentRead)))
    expect(object(object(refreshed).receipt).providerGeneration).toBe(2)
    expect(projection("sf_dashboard_read", refreshed).values).toContainEqual(expect.objectContaining({ id: "budget:2026-02:effective", value: 110 }))
    expect((await fixture.messages(fresh.sessionID)).every((message) => message.type === "synthetic")).toBe(true)
    expect(nativeValue(await fixture.product.state.read(fixture.request, "contributions", (state) => Object.values(state.contributions)))).toEqual([])
  })
}, 120_000)
