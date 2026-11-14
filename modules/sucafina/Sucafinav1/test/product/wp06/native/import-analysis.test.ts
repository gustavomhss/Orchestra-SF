import { expect, test } from "bun:test"
import { Workbook } from "exceljs"
import { Effect } from "effect"
import { rows } from "../../../../runtime/contract.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { decodeSfOperationOutput } from "../../../../product/contracts/schema-admission.ts"
import type { ImportManifest } from "../../../../product/contracts/context.ts"
import type { ImportDetail } from "../../../../product/imports/store.ts"
import type { ImportPreviewRequest } from "../../../../product/contracts/operations.ts"
import { createPlannerImportAnalysis } from "../../../../product/planner/import-analysis.ts"
import { verifyPlannerImportTarget } from "../../../../product/imports/source-fences.ts"
import { sfPlannerSourceSelector } from "../../../../product/integration/planner-sources.ts"
import { createSfImportForecastAnalysis } from "../../../../../../../apps/cli/src/sucafina-product/import-analysis.ts"
import { readNativeResponse, withNativeWp06 } from "./fixture.ts"

test("recorded native Session contribution preserves C04 importPreviewRef into the actual preview consumer and fails after source or authority change", async () => {
  await withNativeWp06(async (fixture) => {
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
    sheet.addRow(["42", "Licenses", "Licences", "USD", "Forecast", 38000, 124000, 40000])
    const form = new FormData()
    form.set("file", new File([new Uint8Array(await workbook.xlsx.writeBuffer())], "forecast.xlsx"))
    form.set("surface", "planner"); form.set("selectionRef", choice.selectionRef)
    form.set("options", JSON.stringify({ newVersion: false, removeMissing: false, preview: {} }))
    const admitted = await readNativeResponse<{ ref: string }>(await fixture.http("import", "import-admit", form))
    const request: ImportPreviewRequest = { admittedFileRef: admitted.ref, format: "xlsx", options: {} }
    const ui = await readNativeResponse<ImportManifest>(await fixture.http("import", "import-preview", request))
    expect(ui.domainApplied).toBe(false)
    const uiReceipt = await fixture.ui("sf_import_preview", request, (call) => fixture.dispatch("sf_import_preview", request, call))
    expect(uiReceipt.status).toBe("ok")
    if (uiReceipt.status !== "ok") throw new Error(uiReceipt.reason)
    expect(uiReceipt.receipt).toMatchObject({ kind: "ui", handlerExport: "previewImport", inputDigest: digestSfValue(request) })
    const uiDispatched = decodeSfOperationOutput("sf_import_preview", uiReceipt.result)
    if (!uiDispatched.ok) throw new Error("UI C04 output schema invalid")
    expect(manifestSemantics(uiDispatched.value)).toEqual(manifestSemantics(ui))
    const previewRun = await fixture.bind("sf-explicar-forecast")
    const previews: ImportManifest[] = []
    for (const surface of ["native", "mcp"] as const) {
      const result = await previewRun.call(surface, "sf_import_preview", request)
      expect(result.status).toBe("ok")
      if (result.status !== "ok") throw new Error(result.reason)
      const decoded = decodeSfOperationOutput("sf_import_preview", result.result)
      if (!decoded.ok) throw new Error("C04 output schema invalid")
      expect(manifestSemantics(decoded.value)).toEqual(manifestSemantics(ui))
      expect(result.receipt).toMatchObject({ kind: "native", runId: previewRun.record.runRef, nativeSessionId: previewRun.session.id,
        handlerExport: uiReceipt.receipt.handlerExport, inputDigest: uiReceipt.receipt.inputDigest, resultDigest: digestSfValue(result.result) })
      previews.push(decoded.value)
    }
    expect(new Set([ui.id, uiDispatched.value.id, ...previews.map((value) => value.id)]).size).toBe(4)
    const chosen = previews[1]!
    const invalid = { ...request, admittedFileRef: "unadmitted-workbook" }
    expect((await fixture.http("import", "import-preview", invalid)).status).not.toBe(200)
    for (const surface of ["native", "mcp"] as const) expect((await previewRun.call(surface, "sf_import_preview", invalid)).status).not.toBe("ok")
    const verifyTarget: Parameters<typeof createPlannerImportAnalysis>[0]["verifyTarget"] = (snapshot, manifest, actor, call) => {
      const target = manifest.baseIdentity[0]
      return !!target && target.surface === "planner" && verifyPlannerImportTarget(snapshot, { surface: "planner",
        selectionRef: sfPlannerSourceSelector(target.id, target.incarnation, target.version), incarnation: target.incarnation,
        version: target.version, options: { newVersion: false, removeMissing: false, preview: {} } }, actor, call)
    }
    const selection = { caseRef: fixture.caseRef, previewRef: chosen.id, importRequest: request, period: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD" }
    const analyze = createPlannerImportAnalysis({ host: fixture.authority.host, issueSource: fixture.business.plannerProduct.issueSource,
      readPreview: fixture.imports.imports.readPreparedPreviewForAnalysis, verifyTarget })
    const replay = await fixture.ui("sf_import_preview", request, (call) => analyze(selection, call))
    expect(replay.status).toBe("ok")
    if (replay.status !== "ok") throw new Error(replay.reason)
    expect(replay.value).toMatchObject({ importPreviewRef: chosen.id, analysisBasis: "import-preview", domainApplied: false, knownDifference: 12000, completeDifference: null })
    const beforeCase = await fixture.authority.state.read(app.request(), "cases", () => null)
    if (beforeCase.status !== "ok") throw new Error("Case state unavailable")
    const updated = await fixture.authority.state.transaction(app.request(), { namespace: "cases", expectedStorageVersion: beforeCase.storageVersion,
      idempotencyKey: crypto.randomUUID(), commandDigest: digestSfValue(replay.value.sourceRefs), targetRef: `case:${fixture.caseRef.id}:${fixture.caseRef.incarnation}`,
      targetIncarnation: fixture.caseRef.incarnation }, async (state) => {
      const current = state.cases[fixture.caseRef.id]!
      current.sourceRefs = replay.value.sourceRefs
      current.version++
      return { commit: true, value: current.version }
    })
    if (updated.status !== "ok") throw new Error("Case source selection failed")
    fixture.caseRef.version = updated.value
    for (const surface of ["native", "mcp"] as const) expect((await previewRun.call(surface, "sf_import_preview", request)).status).toBe("denied")
    const dependencies = { cases: fixture.business.cases, planner: fixture.business.planner, procurement: fixture.business.procurement,
      context: fixture.business.context, host: fixture.authority.host }
    const producer = createSfImportForecastAnalysis({ ...dependencies, imports: fixture.imports.imports,
      issueSource: fixture.business.plannerProduct.issueSource, verifyTarget, intentOperation: "analysis.prepare",
      matchesIntent: async (call, operation, digest) => operation === "analysis.prepare" && digest === digestSfValue(selection) &&
        await fixture.authority.human.authorize(call, "analysis.prepare", selection) })
    const prepared = await fixture.human("analysis.prepare", selection, (call) => fixture.business.withCase(call, fixture.caseRef, {}, () => producer.prepare(call, selection)))
    expect(prepared.status).toBe("ok")
    if (prepared.status !== "ok") throw new Error(prepared.reason)
    expect(prepared.value.forecastComparison.importPreviewRef).toBe(chosen.id)
    const native = await fixture.bind("sf-explicar-forecast", prepared.value)
    const analysisRequest = { caseRef: fixture.caseRef, profileId: native.admission.profile.id, profileVersion: native.admission.profile.version,
      skillId: native.receipt.skillId, skillVersion: native.receipt.skillVersion, manifestDigest: native.receipt.manifestDigest,
      outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: native.admission.selected.operationIds, objective: "Explain this exact import preview" }
    const complete = await native.complete({ kind: "FinancialAnalysis", payload: prepared.value.forecastComparison, evidenceRefs: prepared.value.sourceRefs }, async (output, call) => {
      const proof = await producer.verifier.verify(prepared.value, analysisRequest, call)
      return proof.status === "ok" ? proof.value.acceptsOutput(output, call) : proof
    })
    expect(complete.run).toMatchObject({ state: "ready", native: { sessionID: native.session.id, skillReceipt: native.receipt }, outputRef: complete.output.id })
    expect(complete.output.kind).toBe("FinancialAnalysis")
    if (complete.output.kind !== "FinancialAnalysis" || complete.output.state !== "ready") throw new Error("Financial contribution unavailable")
    const contribution = complete.output
    expect(contribution.runProvenance).toMatchObject({ ...native.receipt, actualModel: "wp06-recorded-ingress/deterministic-public-events" })
    expect(contribution.payload.importPreviewRef).toBe(chosen.id)
    const persisted = await fixture.authority.state.read(app.request(), "contributions", (state) => state.contributions[complete.output.id])
    expect(persisted.status).toBe("ok")
    if (persisted.status !== "ok") throw new Error("Contribution not persisted")
    expect(persisted.value).toEqual(complete.output)
    const assistant = await Effect.runPromise(fixture.sessionStore.message(complete.assistantMessageID))
    expect(assistant?.message.type).toBe("assistant")
    expect(JSON.stringify(assistant)).toContain(chosen.id)
    const reference = await readNativeResponse<{ manifest: ImportManifest; detail: ImportDetail }>(await fixture.http("import", "import-reference", undefined, { importPreviewRef: contribution.payload.importPreviewRef! }))
    expect(reference.manifest).toEqual(chosen)
    expect(reference.manifest.domainApplied).toBe(false)
    expect(reference.manifest.issues).toEqual(chosen.issues)
    expect(reference.detail.changes.some((change) => change.kind === "changed")).toBe(true)
    expect(JSON.stringify(reference.detail)).toContain("124000")
    const page = await fixture.http("import", "imports", undefined, { importPreviewRef: chosen.id })
    expect(page.status).toBe(200)
    expect(await page.text()).toContain("Analysis refers to this simulation")
    expect(await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data) }))).toBe(domainBefore)
    await fixture.human("analysis.read", { runRef: native.record.runRef }, async (call) => {
      const proof = await producer.verifier.verify(prepared.value, analysisRequest, call)
      expect(proof.status).toBe("ok")
      if (proof.status !== "ok") throw new Error(proof.reason)
      expect((await proof.value.acceptsOutput({ ...contribution, payload: { ...contribution.payload, importPreviewRef: ui.id } }, call)).status).not.toBe("ok")
    })
    await app.store.transaction("planner", async (snapshot) => {
      const line = rows(rows(snapshot.data.versions).find((value) => value.id === "v1")?.lines).find((value) => value.id === "42")
      if (!line || !Array.isArray(line.f)) throw new Error("Current forecast source unavailable")
      line.f[10] = 113000
      return { commit: true, value: undefined }
    })
    expect((await fixture.http("import", "import-reference", undefined, { importPreviewRef: chosen.id })).status).not.toBe(200)
    const stale = await fixture.human("analysis.prepare", selection, (call) => producer.prepare(call, selection))
    expect(stale.status).not.toBe("ok")
    const logout = await app.identity.handle(new Request(`${app.origin}/sucafina/auth/logout`, { method: "POST", headers: { cookie: app.cookie, origin: app.origin } }))
    expect(logout?.status).toBe(204)
    expect((await fixture.http("import", "import-reference", undefined, { importPreviewRef: chosen.id })).status).toBe(403)
  })
}, 120_000)

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
