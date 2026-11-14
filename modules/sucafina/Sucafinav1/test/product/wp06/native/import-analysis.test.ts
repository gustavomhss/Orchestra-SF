import { expect, test } from "bun:test"
import { Workbook } from "exceljs"
import { Effect } from "effect"
import { rows } from "../../../../runtime/contract.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { decodeSfOperationOutput, decodeSfSkillInput } from "../../../../product/contracts/schema-admission.ts"
import type { ImportManifest } from "../../../../product/contracts/context.ts"
import type { ContributionEnvelope } from "../../../../product/contracts/resident-ai.ts"
import type { ImportDetail } from "../../../../product/imports/store.ts"
import type { ImportPreviewRequest } from "../../../../product/contracts/operations.ts"
import { createPlannerImportAnalysis } from "../../../../product/planner/import-analysis.ts"
import { verifyPlannerImportTarget } from "../../../../product/imports/source-fences.ts"
import { sfPlannerSourceSelector } from "../../../../product/integration/planner-sources.ts"
import { createSfImportForecastAnalysis } from "../../../../../../../apps/cli/src/sucafina-product/import-analysis.ts"
import { createSfImportIntentAnalysis } from "../../../../../../../apps/cli/src/sucafina-product/import-intent.ts"
import { sfAnalysisPrompt } from "../../../../../../../apps/cli/src/sucafina-product/analysis-verifier.ts"
import { contribution } from "../../../../product/ui/components.ts"
import { readNativeResponse, withNativeWp06 } from "./fixture.ts"

test("real Session and MCP import previews preserve C04 parity across four admissions and reject unadmitted files", async () => {
  await withNativeWp06(async (fixture) => {
    const { request } = await prepareImportWorkbook(fixture)
    const ui = await readNativeResponse<ImportManifest>(await fixture.http("import", "import-preview", request))
    expect(ui.domainApplied).toBe(false)
    expect(ui.issues).toContainEqual({ row: 0, field: "domain", reason: "Unknown currency; the existing currency is retained." })
    const uiReceipt = await fixture.uiDispatch("sf_import_preview", request)
    if (uiReceipt.status !== "ok") throw new Error(`UI sf_import_preview: ${uiReceipt.reason}`)
    expect(uiReceipt.status).toBe("ok")
    expect(uiReceipt.receipt).toMatchObject({ kind: "ui", handlerExport: "previewImport", inputDigest: digestSfValue(request) })
    const uiDispatched = decodeSfOperationOutput("sf_import_preview", uiReceipt.result)
    if (!uiDispatched.ok) throw new Error("UI C04 output schema invalid")
    expect(manifestSemantics(uiDispatched.value)).toEqual(manifestSemantics(ui))
    const previewRun = await fixture.bind("sf-explicar-forecast", {}, undefined, "recorded-explicit")
    expect(previewRun.requestedModel.variant?.toString()).toBe("recorded-explicit")
    expect(previewRun.record.model.variant).toBe("recorded-explicit")
    const storedPreviewSession = await Effect.runPromise(fixture.sessionStore.get(previewRun.session.id))
    expect(digestSfValue(storedPreviewSession?.model)).toBe(digestSfValue(previewRun.record.model))
    expect(digestSfValue(storedPreviewSession?.location)).toBe(digestSfValue(fixture.installation.location))
    const previews: ImportManifest[] = []
    for (const surface of ["native", "mcp"] as const) {
      const result = await previewRun.call(surface, "sf_import_preview", request)
      if (result.status !== "ok") throw new Error(`${surface} sf_import_preview: ${result.reason}`)
      expect(result.status).toBe("ok")
      const decoded = decodeSfOperationOutput("sf_import_preview", result.result)
      if (!decoded.ok) throw new Error("C04 output schema invalid")
      expect(manifestSemantics(decoded.value)).toEqual(manifestSemantics(ui))
      expect(result.receipt).toMatchObject({ kind: "native", runId: previewRun.record.runRef, nativeSessionId: previewRun.session.id,
        handlerExport: uiReceipt.receipt.handlerExport, inputDigest: uiReceipt.receipt.inputDigest, resultDigest: digestSfValue(result.result) })
      previews.push(decoded.value)
    }
    expect(new Set([ui.id, uiDispatched.value.id, ...previews.map((value) => value.id)]).size).toBe(4)
    const invalid = { ...request, admittedFileRef: "unadmitted-workbook" }
    expect((await fixture.http("import", "import-preview", invalid)).status).not.toBe(200)
    for (const surface of ["native", "mcp"] as const) expect((await previewRun.call(surface, "sf_import_preview", invalid)).status).not.toBe("ok")
  }, { traceOperations: true })
}, 120_000)

test("recorded forecast and intent Sessions preserve selected C04 importPreviewRef through rendered preview links and fail after source or authority change", async () => {
  await withNativeWp06(async (fixture) => {
    const { app } = fixture
    // Timed delegates still invoke the real producers with the same arguments and grants.
    const imports = { ...fixture.imports.imports,
      readPreparedPreviewForAnalysis: (...args: Parameters<typeof fixture.imports.imports.readPreparedPreviewForAnalysis>) =>
        fixture.stage("import:prepared-preview", () => fixture.imports.imports.readPreparedPreviewForAnalysis(...args)),
      readPreviewForAnalysis: (...args: Parameters<typeof fixture.imports.imports.readPreviewForAnalysis>) =>
        fixture.stage("import:preview-view", () => fixture.imports.imports.readPreviewForAnalysis(...args)),
    }
    const issueSource: Parameters<typeof createPlannerImportAnalysis>[0]["issueSource"] = (...args) =>
      fixture.stage("import:issue-source", () => fixture.business.plannerProduct.issueSource(...args))
    const dependencies = {
      cases: { ...fixture.business.cases, read: (...args: Parameters<typeof fixture.business.cases.read>) =>
        fixture.stage("analysis:case-read", () => fixture.business.cases.read(...args)) },
      planner: fixture.business.planner, procurement: fixture.business.procurement,
      context: { ...fixture.business.context, context: (...args: Parameters<typeof fixture.business.context.context>) =>
        fixture.stage("analysis:source-context", () => fixture.business.context.context(...args)) },
      host: fixture.authority.host,
    }
    const { domainBefore, form, request } = await prepareImportWorkbook(fixture)
    // This installation selects its own real MCP preview. Both analysis skills keep that exact C04.
    const ui = await readNativeResponse<ImportManifest>(await fixture.http("import", "import-preview", request))
    const previewRun = await fixture.bind("sf-explicar-forecast", {}, undefined, "recorded-explicit")
    const selectedPreview = await previewRun.call("mcp", "sf_import_preview", request)
    if (selectedPreview.status !== "ok") throw new Error(`MCP selected sf_import_preview: ${selectedPreview.reason}`)
    const decodedPreview = decodeSfOperationOutput("sf_import_preview", selectedPreview.result)
    if (!decodedPreview.ok) throw new Error("Selected native C04 output schema invalid")
    const chosen = decodedPreview.value
    if (chosen.id === ui.id) throw new Error("Competing preview must have a distinct admitted operation identity")
    const invalid = { ...request, admittedFileRef: "unadmitted-workbook" }
    const verifyTarget: Parameters<typeof createPlannerImportAnalysis>[0]["verifyTarget"] = (snapshot, manifest, actor, call) => {
      const target = manifest.baseIdentity[0]
      return !!target && target.surface === "planner" && verifyPlannerImportTarget(snapshot, { surface: "planner",
        selectionRef: sfPlannerSourceSelector(target.id, target.incarnation, target.version), incarnation: target.incarnation,
        version: target.version, options: { newVersion: false, removeMissing: false, preview: {} } }, actor, call)
    }
    const selection = { caseRef: fixture.caseRef, previewRef: chosen.id, importRequest: request, period: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD" }
    const analyze = createPlannerImportAnalysis({ host: fixture.authority.host, issueSource,
      readPreview: imports.readPreparedPreviewForAnalysis, verifyTarget })
    const replay = await fixture.ui("sf_import_preview", request, (call) => fixture.stage("forecast:replay", () => analyze(selection, call)))
    if (replay.status !== "ok") throw new Error(replay.reason)
    expect(replay.status).toBe("ok")
    expect(replay.value).toMatchObject({ importPreviewRef: chosen.id, analysisBasis: "import-preview", domainApplied: false, knownDifference: 12000, completeDifference: null })
    const beforeCase = await fixture.authority.state.read(app.request(), "cases", () => null)
    if (beforeCase.status !== "ok") throw new Error(`Case state: ${"reason" in beforeCase ? beforeCase.reason : beforeCase.status}`)
    const updated = await fixture.authority.state.transaction(app.request(), { namespace: "cases", expectedStorageVersion: beforeCase.storageVersion,
      idempotencyKey: crypto.randomUUID(), commandDigest: digestSfValue(replay.value.sourceRefs), targetRef: `case:${fixture.caseRef.id}:${fixture.caseRef.incarnation}`,
      targetIncarnation: fixture.caseRef.incarnation }, async (state) => {
      const current = state.cases[fixture.caseRef.id]!
      current.sourceRefs = replay.value.sourceRefs
      current.version++
      return { commit: true, value: current.version }
    })
    if (updated.status !== "ok") throw new Error(`Case source selection: ${"reason" in updated ? updated.reason : updated.status}`)
    fixture.caseRef.version = updated.value
    for (const surface of ["native", "mcp"] as const) expect((await previewRun.call(surface, "sf_import_preview", request)).status).toBe("denied")
    const producer = createSfImportForecastAnalysis({ ...dependencies, imports,
      issueSource, verifyTarget, intentOperation: "analysis.prepare",
      matchesIntent: async (call, operation, digest) => operation === "analysis.prepare" && digest === digestSfValue(selection) &&
        await fixture.authority.human.authorize(call, "analysis.prepare", selection) })
    const prepared = await fixture.human("analysis.prepare", selection, (call) => fixture.stage("forecast:with-case", () =>
      fixture.business.withCase(call, fixture.caseRef, {}, () => fixture.stage("forecast:prepare", () => producer.prepare(call, selection)))))
    if (prepared.status !== "ok") throw new Error(prepared.reason)
    expect(prepared.status).toBe("ok")
    expect(prepared.value.forecastComparison.importPreviewRef).toBe(chosen.id)
    const analysisRequest = { caseRef: fixture.caseRef, profileId: previewRun.admission.profile.id, profileVersion: previewRun.admission.profile.version,
      skillId: previewRun.receipt.skillId, skillVersion: previewRun.receipt.skillVersion, manifestDigest: previewRun.receipt.manifestDigest,
      outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: previewRun.admission.selected.operationIds, objective: "Explain this exact import preview" }
    const forecastProof = await fixture.human("analysis.read", { caseRef: fixture.caseRef }, (call) =>
      fixture.stage("forecast:verify", () => producer.verifier.verify(prepared.value, analysisRequest, call)))
    if (forecastProof.status !== "ok") throw new Error(forecastProof.reason)
    expect(forecastProof.value.promptContext?.importPreview.manifest).toEqual(chosen)
    const forecastPrompt = sfAnalysisPrompt(analysisRequest.objective, forecastProof.value)
    const native = await fixture.bind("sf-explicar-forecast", prepared.value, forecastPrompt)
    expect(native.requestedModel).not.toHaveProperty("variant")
    expect(native.record.model.variant).toBe("default")
    expect(native.promptAdmission?.prompt.text).toBe(forecastPrompt)
    expect(native.promptAdmission?.sessionID).toBe(native.session.id)
    const complete = await native.complete({ kind: "FinancialAnalysis", payload: prepared.value.forecastComparison, evidenceRefs: prepared.value.sourceRefs }, async (output, call) => {
      const proof = await fixture.stage("forecast:verify-output", () => producer.verifier.verify(prepared.value, analysisRequest, call))
      return proof.status === "ok" ? fixture.stage("forecast:accept-output", () => proof.value.acceptsOutput(output, call)) : proof
    })
    expect(complete.run).toMatchObject({ state: "ready", native: { sessionID: native.session.id, skillReceipt: native.receipt }, outputRef: complete.output.id })
    expect(complete.output.kind).toBe("FinancialAnalysis")
    if (complete.output.kind !== "FinancialAnalysis" || complete.output.state !== "ready") throw new Error("Financial contribution unavailable")
    const contribution = complete.output
    const comparison = contribution.payload
    if (comparison.analysisBasis !== "import-preview") throw new Error("Import comparison missing")
    expect(contribution.runProvenance).toMatchObject({ ...native.receipt, actualModel: "wp06-recorded-ingress/deterministic-public-events" })
    expect(contribution.payload.importPreviewRef).toBe(chosen.id)
    const persisted = await fixture.authority.state.read(app.request(), "contributions", (state) => state.contributions[complete.output.id])
    if (persisted.status !== "ok") throw new Error(`Contribution persistence: ${"reason" in persisted ? persisted.reason : persisted.status}`)
    expect(persisted.status).toBe("ok")
    expect(persisted.value).toEqual(complete.output)
    const assistant = await Effect.runPromise(fixture.sessionStore.message(complete.assistantMessageID))
    expect(assistant?.message.type).toBe("assistant")
    expect(JSON.stringify(assistant)).toContain(chosen.id)
    const forecastLink = renderedPreviewUrl(contribution, app.origin)
    expect(forecastLink.pathname).toBe("/sucafina/planner")
    expect(forecastLink.searchParams.get("importPreviewRef")).toBe(chosen.id)
    const page = await fixture.importHttp(new Request(forecastLink, { headers: { cookie: app.cookie } }), "planner")
    expect(page?.status).toBe(200)
    expect(await page?.text()).toContain("Analysis refers to this simulation")
    forecastLink.searchParams.set("sf", "import-reference")
    const forecastReference = await fixture.importHttp(new Request(forecastLink, { headers: { cookie: app.cookie } }), "planner")
    if (!forecastReference) throw new Error("Rendered import reference unavailable")
    const reference = await readNativeResponse<{ manifest: ImportManifest; detail: ImportDetail }>(forecastReference)
    expect(forecastProof.value.promptContext?.importPreview).toEqual({ importPreviewRef: chosen.id, manifest: chosen, detail: reference.detail })
    expect(reference.manifest).toEqual(chosen)
    expect(reference.manifest.domainApplied).toBe(false)
    expect(reference.manifest.issues).toEqual(chosen.issues)
    expect(reference.detail.changes.some((change) => change.kind === "changed")).toBe(true)
    expect(JSON.stringify(reference.detail)).toContain("124000")
    expect(await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data) }))).toBe(domainBefore)
    await fixture.human("analysis.read", { runRef: native.record.runRef }, async (call) => {
      const proof = await producer.verifier.verify(prepared.value, analysisRequest, call)
      if (proof.status !== "ok") throw new Error(proof.reason)
      expect(proof.status).toBe("ok")
      expect((await proof.value.acceptsOutput({ ...contribution, payload: { ...comparison, importPreviewRef: ui.id } }, call)).status).not.toBe("ok")
    })
    const intentSelection = { caseRef: fixture.caseRef, previewRef: chosen.id, importRequest: request, intentText: "Frame the decision from this exact import preview" }
    const createIntent = (expected = intentSelection) => createSfImportIntentAnalysis({ ...dependencies, imports,
      replayIntent: fixture.business.cases.prepareIntentForCase, state: fixture.authority.state,
      operationIdentity: (call) => call.kind === "ui" ? fixture.authority.ui.operationIdentity(call) : undefined,
      authorize: async (call, value) => digestSfValue(value) === digestSfValue(expected) && await fixture.authority.human.authorize(call, "analysis.prepare", expected) })
    const intentPrepared = await fixture.human("analysis.prepare", intentSelection, (call) => fixture.stage("intent:with-case", () =>
      fixture.business.withCase(call, fixture.caseRef, {}, () => fixture.stage("intent:prepare", () => createIntent().prepare(call, intentSelection)))))
    if (intentPrepared.status !== "ok") throw new Error(intentPrepared.reason)
    expect(intentPrepared.status).toBe("ok")
    expect(decodeSfSkillInput("DecisionIntentInput", intentPrepared.value).ok).toBe(true)
    expect(intentPrepared.value.importPreview).toEqual(request)
    const competingSelection = { ...intentSelection, previewRef: ui.id }
    const competing = await fixture.human("analysis.prepare", competingSelection, (call) => createIntent(competingSelection).prepare(call, competingSelection))
    expect(competing).toEqual({ status: "conflict", reason: "intent-preview-selection-conflict" })
    const intentParent = fixture.selected.find((value) => value.profile.id === "sf_maestro")
    const intentSkill = intentParent?.skills.find((value) => value.id === "sf-enquadrar-decisao")
    if (!intentParent || !intentSkill) throw new Error("Actual intent selection unavailable")
    const intentRequest = { caseRef: fixture.caseRef, profileId: intentParent.profile.id, profileVersion: intentParent.profile.version,
      skillId: intentSkill.id, skillVersion: intentSkill.version, manifestDigest: intentParent.manifestDigest,
      outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: intentSkill.allowedOperations, objective: intentSelection.intentText }
    // A new composition has no in-memory selection cache. It must recover the C08 binding.
    const intentProducer = createIntent()
    const intentProof = await fixture.human("analysis.read", { caseRef: fixture.caseRef }, (call) =>
      fixture.stage("intent:verify", () => intentProducer.verifier.verify(intentPrepared.value, intentRequest, call)))
    if (intentProof.status !== "ok") throw new Error(intentProof.reason)
    expect(intentProof.status).toBe("ok")
    expect(intentProof.value.promptContext?.importPreview).toEqual({ importPreviewRef: chosen.id, manifest: chosen, detail: reference.detail })
    const intentPrompt = sfAnalysisPrompt(intentRequest.objective, intentProof.value)
    const intentNative = await fixture.bind("sf-enquadrar-decisao", intentPrepared.value, intentPrompt)
    expect(intentNative.promptAdmission?.prompt.text).toBe(intentPrompt)
    expect(intentNative.promptAdmission?.sessionID).toBe(intentNative.session.id)
    expect(intentNative.promptAdmission?.admittedSeq).toBeGreaterThan(0)
    expect(await fixture.proof.verify(intentNative.admission)).toBe(true)
    const draftRequest = { objective: intentSelection.intentText, horizon: intentPrepared.value.context.period,
      currency: intentPrepared.value.context.currency, criteria: ["Review the changed forecast before applying the file"], sourceRefs: intentPrepared.value.selectedSourceRefs }
    const drafted = await intentNative.call("mcp", "sf_case_draft", draftRequest)
    if (drafted.status !== "ok") throw new Error(`MCP sf_case_draft: ${drafted.reason}`)
    expect(drafted.status).toBe("ok")
    const intentFrame = decodeSfOperationOutput("sf_case_draft", drafted.result)
    if (!intentFrame.ok) throw new Error("Real Case intent producer output invalid")
    expect(intentFrame.value).toMatchObject({ objective: intentSelection.intentText, analysisBasis: "domain", domainApplied: false })
    expect(drafted.receipt).toMatchObject({ kind: "native", runId: intentNative.record.runRef, nativeSessionId: intentNative.session.id })
    const intentComplete = await intentNative.complete({ kind: "IntentFrame", payload: { ...intentFrame.value,
      analysisBasis: "import-preview", importPreviewRef: chosen.id }, evidenceRefs: intentFrame.value.sourceRefs }, async (output, call) => {
      const proof = await fixture.stage("intent:verify-output", () => intentProducer.verifier.verify(intentPrepared.value, intentRequest, call))
      return proof.status === "ok" ? fixture.stage("intent:accept-output", () => proof.value.acceptsOutput(output, call)) : proof
    })
    if (intentComplete.output.kind !== "IntentFrame" || intentComplete.output.state !== "ready") throw new Error("Intent contribution unavailable")
    const intentOutput = intentComplete.output
    if (intentOutput.payload.analysisBasis !== "import-preview") throw new Error("Intent preview relation unavailable")
    const intentPayload = intentOutput.payload
    expect(intentComplete.run).toMatchObject({ state: "ready", native: { sessionID: intentNative.session.id, skillReceipt: intentNative.receipt }, outputRef: intentOutput.id })
    expect(intentPayload.importPreviewRef).toBe(chosen.id)
    const persistedIntent = await fixture.authority.state.read(app.request(), "contributions", (state) => state.contributions[intentOutput.id])
    if (persistedIntent.status !== "ok") throw new Error(`Intent contribution persistence: ${"reason" in persistedIntent ? persistedIntent.reason : persistedIntent.status}`)
    expect(persistedIntent.status).toBe("ok")
    expect(persistedIntent.value).toEqual(intentOutput)
    const intentLink = renderedPreviewUrl(intentOutput, app.origin)
    expect(intentLink.searchParams.get("importPreviewRef")).toBe(chosen.id)
    const intentPage = await fixture.importHttp(new Request(intentLink, { headers: { cookie: app.cookie } }), "planner")
    expect(intentPage?.status).toBe(200)
    intentLink.searchParams.set("sf", "import-reference")
    const intentReference = await fixture.importHttp(new Request(intentLink, { headers: { cookie: app.cookie } }), "planner")
    if (!intentReference) throw new Error("Intent preview consumer missing")
    expect(await readNativeResponse<{ manifest: ImportManifest; detail: ImportDetail }>(intentReference)).toMatchObject(reference)
    await fixture.human("analysis.read", { runRef: intentNative.record.runRef }, async (call) => {
      const proof = await intentProducer.verifier.verify(intentPrepared.value, intentRequest, call)
      if (proof.status !== "ok") throw new Error(proof.reason)
      expect((await proof.value.acceptsOutput({ ...intentOutput, payload: { ...intentPayload, importPreviewRef: ui.id } }, call)).status).toBe("unavailable")
      expect((await intentProducer.verifier.verify({ ...intentPrepared.value, importPreview: invalid }, intentRequest, call)).status).toBe("unavailable")
    })
    expect(await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data) }))).toBe(domainBefore)
    await app.store.transaction("planner", async (snapshot) => {
      const line = rows(rows(snapshot.data.versions).find((value) => value.id === "v1")?.lines).find((value) => value.id === "42")
      if (!line || !Array.isArray(line.f)) throw new Error("Current forecast source unavailable")
      line.f[10] = 113000
      return { commit: true, value: undefined }
    })
    expect((await fixture.http("import", "import-reference", undefined, { importPreviewRef: chosen.id })).status).not.toBe(200)
    const stale = await fixture.human("analysis.prepare", selection, (call) => producer.prepare(call, selection))
    expect(stale.status).not.toBe("ok")
    const staleIntent = await fixture.human("analysis.prepare", intentSelection, (call) => intentProducer.prepare(call, intentSelection))
    expect(staleIntent.status).not.toBe("ok")
    await fixture.human("analysis.read", { runRef: intentNative.record.runRef }, async (call) => {
      expect((await intentProducer.verifier.verify(intentPrepared.value, intentRequest, call)).status).toBe("unavailable")
    })
    // Admit a fresh target after the version change so logout is the only denial cause
    // for these still-active native operations; the completed analysis runs stay closed.
    const currentChoices = await readNativeResponse<{ label: string; selectionRef: string }[]>(await fixture.http("import", "import-targets", undefined, { surface: "planner" }))
    const currentChoice = currentChoices.find((value) => value.label === "FY27")
    if (!currentChoice) throw new Error("Changed Planner target unavailable")
    form.set("selectionRef", currentChoice.selectionRef)
    const currentFile = await readNativeResponse<{ ref: string }>(await fixture.http("import", "import-admit", form))
    const currentRequest: ImportPreviewRequest = { ...request, admittedFileRef: currentFile.ref }
    const revocable = await fixture.bind("sf-enquadrar-decisao")
    expect((await fixture.http("import", "import-preview", currentRequest)).status).toBe(200)
    for (const surface of ["native", "mcp"] as const) {
      const result = await revocable.call(surface, "sf_import_preview", currentRequest)
      if (result.status !== "ok") throw new Error(`${surface} current import before logout: ${result.reason}`)
      expect(result.status).toBe("ok")
    }
    const beforeLogout = await app.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))
    const logout = await app.identity.handle(new Request(`${app.origin}/sucafina/auth/logout`, { method: "POST", headers: { cookie: app.cookie, origin: app.origin } }))
    expect(logout?.status).toBe(204)
    expect((await fixture.http("import", "import-reference", undefined, { importPreviewRef: chosen.id })).status).toBe(403)
    expect((await fixture.http("import", "import-preview", currentRequest)).status).toBe(403)
    for (const surface of ["native", "mcp"] as const) {
      const denied = await revocable.call(surface, "sf_import_preview", currentRequest)
      expect(denied.status).toBe("denied")
      expect(denied).not.toHaveProperty("result")
    }
    expect(await app.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))).toBe(beforeLogout)
  }, { traceOperations: true, deadlineMs: 300_000 })
}, 360_000)

async function prepareImportWorkbook(fixture: Parameters<Parameters<typeof withNativeWp06>[0]>[0]) {
  const { app } = fixture
  await app.store.transaction("planner", async (snapshot) => {
    snapshot.data.versions = [{ id: "v1", name: "FY27", year: 2027, closed: 9, locked: false,
      lines: [{ id: "42", sec: "opex", el: "licenses", name: "Licences", cur: "USD",
        b: [40000, 45000, 45000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 60000, 60000],
        a: [40000, 40000, 45000, 45000, 45000, 45000, 45000, 45000, 50000, null, null, null],
        f: [null, null, null, null, null, null, null, null, null, 38000, 112000, 40000] }],
      projects: [], fx: [], hc: { positions: [], rates: [], hrAF: {} }, lists: {} }]
    snapshot.data.officials = {}; snapshot.data.entities = []; snapshot.data.allocations = []; snapshot.data.roster = []
    return { commit: true, value: undefined }
  })
  const domainBefore = await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data) }))
  const choices = await readNativeResponse<{ label: string; selectionRef: string; surface: string }[]>(await fixture.http("import", "import-targets", undefined, { surface: "planner" }))
  const choice = choices.find((value) => value.label === "FY27")
  if (!choice) throw new Error("Planner source unavailable")
  const workbook = new Workbook()
  const sheet = workbook.addWorksheet("OPEX")
  sheet.addRow(["Line ID", "Cost element", "Vendor / item", "Currency", "Measure", "Oct", "Nov", "Dec"])
  sheet.addRow(["42", "Licenses", "Licences", "ZZZ", "Forecast", 38000, 124000, 40000])
  const form = new FormData()
  form.set("file", new File([new Uint8Array(await fixture.stage("import:workbook", () => workbook.xlsx.writeBuffer()))], "forecast.xlsx"))
  form.set("surface", "planner"); form.set("selectionRef", choice.selectionRef)
  form.set("options", JSON.stringify({ newVersion: false, removeMissing: false, preview: {} }))
  const admitted = await readNativeResponse<{ ref: string }>(await fixture.http("import", "import-admit", form))
  const request: ImportPreviewRequest = { admittedFileRef: admitted.ref, format: "xlsx", options: {} }
  return { domainBefore, form, request }
}

function renderedPreviewUrl(output: ContributionEnvelope, origin: string) {
  const html = contribution(output, { mount: "/sucafina" })
  const href = /<a href="([^"]+)" data-import-preview-link>/.exec(html)?.[1]
  if (!href) throw new Error("Persisted contribution has no preview link")
  const url = new URL(href.replaceAll("&amp;", "&"), origin)
  expect(url.origin).toBe(origin)
  expect(url.searchParams.get("sf")).toBe("imports")
  return url
}

/** planner-preview derives these identifiers from each actual operationIdentity; store.view
 * exposes operationRef as the command id. Every other C04 field is compared without filtering,
 * including version, source hash, authority, timestamps, target, issues and all impact values. */
function manifestSemantics(manifest: ImportManifest) {
  const { id, commands, ...value } = manifest
  expect(id).toMatch(/^[a-f0-9]{64}$/)
  return { ...value, commands: commands.map((command) => {
    const { id, idempotencyKey, commandDigest, operationRef, ...semantic } = command
    expect(id).toMatch(/^[a-f0-9]{64}$/)
    expect(commandDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(operationRef).toBe(id)
    expect(idempotencyKey).toBe(id)
    return semantic
  }) }
}
