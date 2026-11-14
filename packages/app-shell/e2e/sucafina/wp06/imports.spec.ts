import { expect, test, type Page } from "@playwright/test"
import { renderSfImportWorkbench } from "../../../../../modules/sucafina/Sucafinav1/product/imports/workbench.ts"

// Real production renderer and browser script; only the HTTP boundary is synthetic.
// This suite proves UI behavior, not workbook parsing, domain commits, or native skill authority.
const injected = `<img src=x onerror="document.body.dataset.injected='yes'">`
const period = { start: "2027-01-01", end: "2027-12-31" }

async function openWorkbench(page: Page, outcome: "applied" | "unchanged" | "stale" | "rejected" | "stale-reference" = "applied", failDetail?: "preview" | "receipt", analysis: "ready" | "no-model" | "stale-prepare" | "stale-output" | "retry-start" = "ready") {
  const state = { previews: 0, applies: 0, applied: false, detailFailures: 0, previewKeys: new Set<string>(), analysisStarts: 0, analysisOutputs: 0 }
  const calls: { operation: string; method: string; key?: string; body: string | null }[] = []
  const rendered = renderSfImportWorkbench("planner")
  const html = await rendered.text()
  await page.route("**/sucafina/planner?*", async (route) => {
    const request = route.request()
    const operation = new URL(request.url()).searchParams.get("sf") ?? ""
    if (operation === "imports") {
      await route.fulfill({ status: 200, headers: Object.fromEntries(rendered.headers), body: html })
      return
    }
    calls.push({ operation, method: request.method(), key: request.headers()["idempotency-key"], body: request.postData() })
    if (operation === "workbench-analysis") {
      const body = request.postDataJSON()
      if (body.action === "choices") {
        await route.fulfill({ json: { status: "ok", value: {
          cases: [{ caseRef: { id: "case-1", incarnation: "case-incarnation", version: 7 }, label: injected }],
          analyses: [
            { label: "Enquadrar a decisão sobre o arquivo", profileId: "sf_maestro", skillId: "sf-enquadrar-decisao" },
            { label: "Explicar o impacto no forecast", profileId: "sf_finance", skillId: "sf-explicar-forecast" },
          ].map((item) => ({ ...item, profileVersion: "1", skillVersion: "2", manifestDigest: "a".repeat(64), outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: ["sf_import_preview"] })),
          models: analysis === "no-model" ? [] : [{ providerID: "fixture", id: "configured-model" }],
        } } })
        return
      }
      if (body.action === "prepare") {
        await route.fulfill(analysis === "stale-prepare" ? { status: 409, json: { status: "stale" } } : { json: { status: "ok", value: { fixture: "prepared-closed-skill-input" } } })
        return
      }
      if (body.action === "start") {
        state.analysisStarts++
        await route.fulfill(analysis === "retry-start" && state.analysisStarts === 1 ? { status: 503, json: { status: "unavailable" } } : { json: { status: "ok", value: { runRef: "run-1" } } })
        return
      }
      if (body.action === "read") {
        await route.fulfill({ json: { status: "ok", value: { runRef: "run-1", state: "ready", version: 3, outputRef: "output-1" } } })
        return
      }
      expect(body.action).toBe("output")
      state.analysisOutputs++
      await route.fulfill(analysis === "stale-output" && state.analysisOutputs > 1 ? { status: 409, json: { status: "stale" } } : { json: { status: "ok", value: { html: '<article data-import-analysis-result>Analysis of import preview manifest-1</article>' } } })
      return
    }
    if (operation === "import-targets") {
      await route.fulfill({ json: { status: "ok", value: [{ label: "Planner FY2027", surface: "planner", selectionRef: "selection-1", formats: ["xlsx"], period }] } })
      return
    }
    if (operation === "import-admit") {
      await route.fulfill({ json: { status: "ok", value: { ref: "admitted-1" } } })
      return
    }
    if (operation === "import-preview") { state.previewKeys.add(request.headers()["idempotency-key"]!); state.previews = state.previewKeys.size; state.applied = false }
    if (operation === "import-apply") {
      state.applies++
      if (outcome === "rejected") {
        await route.fulfill({ status: 403, json: { status: "denied" } })
        return
      }
      if (outcome === "stale" && state.applies === 1) {
        await route.fulfill({ status: 409, json: { status: "stale" } })
        return
      }
      state.applied = true
    }
    const rejected = outcome === "rejected" && state.applies > 0
    const manifest = {
      id: `manifest-${state.previews}`, version: state.applied ? 2 : 1,
      state: state.applied ? "applied" : operation === "import-reference" && outcome === "stale-reference" ? "stale" : "preview", domainApplied: state.applied,
      context: { surface: "planner", period, currency: "USD" }, baseIdentity: [{ type: "planner-version", id: "v1", version: 7, period }],
      commands: [{ preview: { engineVersion: "planner-v1", version: 7,
        components: [{ id: "forecast-delta", amount: 12000, currency: "USD", evidenceState: "hypothetical" }],
        values: [{ id: "outlook:after", value: 602000, unit: "USD", evidenceState: "hypothetical" }], missing: [] } }],
      issues: [{ row: 2, field: "Total", reason: "Calculated data ignored" }],
      receipts: state.applied ? [{ principalRef: "actor-1", version: 8, at: "2027-11-01T12:00:00Z" }] : [],
    }
    if (operation === "import-detail" || operation === "import-reference") {
      if (operation === "import-detail" && !state.detailFailures && ((failDetail === "preview" && !state.applied) || (failDetail === "receipt" && state.applied))) {
        state.detailFailures++
        await route.fulfill({ status: 503, json: { status: "unavailable" } })
        return
      }
      await route.fulfill({ json: { status: "ok", value: {
        ...(operation === "import-reference" ? { manifest } : {}),
        detail: { changes: [
          { kind: "changed", path: injected, before: { state: "present", value: 72000 }, after: { state: "present", value: 84000 }, source: { kind: "file", sheet: "OPEX", row: 2, column: 6, address: "F2" } },
          { kind: "ignored", path: "/Total", before: { state: "absent" }, after: { state: "absent" }, source: { kind: "file", sheet: "OPEX", row: 2, column: 7, address: "G2" }, reason: "Calculated total is not applied." },
        ] },
        ...(state.applied || rejected ? { receipt: { outcome: rejected ? "rejected" : outcome === "unchanged" ? "unchanged" : "applied", changedFields: rejected || outcome === "unchanged" ? 0 : 1, receiptId: "receipt-1", manifestId: manifest.id } } : {}),
      } } })
      return
    }
    expect(["import-preview", "import-apply"]).toContain(operation)
    await route.fulfill({ json: { status: "ok", value: manifest } })
  })
  await page.goto("/sucafina/planner?sf=imports")
  await expect(page.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeDisabled()
  await page.getByRole("button", { name: "Find destinations", exact: true }).click()
  await expect(page.getByLabel("Destination", { exact: true })).toBeEnabled()
  await page.getByLabel("Destination", { exact: true }).selectOption("0")
  await page.getByLabel("File", { exact: true }).setInputFiles({
    name: "forecast.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from("Synthetic transport fixture; this suite does not parse workbook bytes."),
  })
  await page.getByLabel("Create a new Planner version", { exact: true }).check()
  await page.getByLabel("Remove records missing from supplied sheets", { exact: true }).check()
  await page.getByRole("button", { name: "Preview changes", exact: true }).click()
  await expect(page.locator("[data-import-workbench]").getByRole("status")).toHaveText(failDetail === "preview" ? "The operation could not be confirmed. Your file and options are preserved. Retry the same action to reconcile its result." : "Review the simulation, including ignored and rejected items. Apply requires your explicit action.")
  await expect(page.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeEnabled({ enabled: failDetail !== "preview" })
  return calls
}

async function expectInputsPreserved(page: Page) {
  await expect(page.getByLabel("File", { exact: true })).toHaveValue(/forecast\.xlsx$/)
  await expect(page.getByLabel("Create a new Planner version", { exact: true })).toBeChecked()
  await expect(page.getByLabel("Remove records missing from supplied sheets", { exact: true })).toBeChecked()
}

test("WP06 real renderer: simulation, literal source content and cancel preserve inputs without Apply", async ({ page }) => {
  const calls = await openWorkbench(page)
  await expect(page.getByRole("heading", { name: "Simulation · no domain changes applied", exact: true })).toBeVisible()
  await expect(page.getByText("2027-01-01 – 2027-12-31 · Currency: USD", { exact: true })).toBeVisible()
  await expect(page.getByText("forecast-delta: 12000 USD · hypothetical", { exact: true })).toBeVisible()
  await expect(page.getByText("outlook:after: 602000 USD · hypothetical", { exact: true })).toBeVisible()
  await page.getByText("changed (1)", { exact: true }).click()
  await page.getByText(injected, { exact: true }).click()
  await expect(page.getByText("72000 → 84000", { exact: true })).toBeVisible()
  await expect(page.getByText("OPEX · row 2, column 6 · F2", { exact: true })).toBeVisible()
  await expect(page.locator("[data-changes] img")).toHaveCount(0)
  await expect(page.locator("[data-injected]")).toHaveCount(0)
  await page.getByText("ignored (1)", { exact: true }).click()
  await page.getByText("/Total", { exact: true }).click()
  await expect(page.getByText("This item will not be applied.", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Cancel preview", exact: true }).click()
  await expect(page.locator("[data-import-workbench]").getByRole("status")).toHaveText("Preview cancelled. Nothing was applied; your file and options are preserved.")
  await expect(page.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeDisabled()
  await expect(page.locator("[data-changes]")).toBeEmpty()
  await expectInputsPreserved(page)
  expect(calls.filter((call) => call.operation === "import-apply")).toHaveLength(0)
  expect(calls.find((call) => call.operation === "import-admit")?.body).toContain('"newVersion":true,"removeMissing":true')
})

test("WP06 real renderer: stale Apply requires a new destination and explicit preview", async ({ page }) => {
  const calls = await openWorkbench(page, "stale")
  await page.getByRole("button", { name: "Apply reviewed import", exact: true }).click()
  await expect(page.locator("[data-import-workbench]").getByRole("status")).toHaveText("The source or authority changed. Your file and options are preserved. Refresh the destination and review a new preview.")
  await expect(page.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeDisabled()
  await expectInputsPreserved(page)
  await page.getByRole("button", { name: "Refresh destination and preview again", exact: true }).click()
  await expect(page.getByLabel("Destination", { exact: true })).toHaveValue("")
  await expect(page.locator("[data-import-workbench]").getByRole("status")).toHaveText("Choose the destination. Your file and options are preserved.")
  await expect(page.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeDisabled()
  await expectInputsPreserved(page)
  expect(calls.filter((call) => call.operation === "import-preview")).toHaveLength(1)
  await page.getByLabel("Destination", { exact: true }).selectOption("0")
  await page.getByRole("button", { name: "Preview changes", exact: true }).click()
  await expect(page.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeEnabled()
  expect(calls.filter((call) => call.operation === "import-preview")).toHaveLength(2)
  expect(calls.filter((call) => call.operation === "import-apply")).toHaveLength(1)
  await page.getByRole("button", { name: "Apply reviewed import", exact: true }).click()
  await expect(page.getByText("Manifest: manifest-2", { exact: true })).toBeVisible()
})

test("WP06 real renderer: failed preview detail cannot enable Apply before review", async ({ page }) => {
  const calls = await openWorkbench(page, "applied", "preview")
  await expect(page.locator("[data-changes]")).toBeEmpty()
  await expectInputsPreserved(page)
  expect(calls.filter((call) => call.operation === "import-apply")).toHaveLength(0)
  await page.getByRole("button", { name: "Preview changes", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Item and field changes", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeEnabled()
  const previews = calls.filter((call) => call.operation === "import-preview")
  expect(previews).toHaveLength(2)
  expect(previews[0]?.key).toBeTruthy()
  expect(previews[1]?.key).toBe(previews[0]?.key)
  expect(calls.filter((call) => call.operation === "import-admit")).toHaveLength(1)
})

test("WP06 real renderer: a receipt read failure retries without another Apply", async ({ page }) => {
  const calls = await openWorkbench(page, "applied", "receipt")
  await page.getByRole("button", { name: "Apply reviewed import", exact: true }).click()
  await expect(page.locator("[data-import-workbench]").getByRole("status")).toHaveText("Import confirmed, but the receipt detail is unavailable. Use Refresh receipt to read the confirmed result.")
  await expect(page.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeDisabled()
  await page.getByRole("button", { name: "Refresh receipt", exact: true }).click()
  await expect(page.getByText("Receipt: receipt-1", { exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Confirmed import", exact: true })).toBeVisible()
  await expect(page.locator("[data-import-workbench]").getByRole("status")).toHaveText("Confirmed receipt refreshed under your current access.")
  expect(calls.filter((call) => call.operation === "import-apply")).toHaveLength(1)
  expect(calls.filter((call) => call.operation === "import-detail")).toHaveLength(2)
  expect(calls.filter((call) => call.operation === "import-reference")).toHaveLength(1)
})

test("WP06 real renderer: rejected Apply displays a rejected receipt and disables replay", async ({ page }) => {
  const calls = await openWorkbench(page, "rejected")
  await page.getByRole("button", { name: "Apply reviewed import", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Rejected import receipt", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Import rejected · no domain changes applied", exact: true })).toBeVisible()
  await expect(page.getByText("Outcome: rejected · Changed fields: 0", { exact: true })).toBeVisible()
  await expect(page.locator("[data-import-workbench]").getByRole("status")).toHaveText("Import rejected. No domain changes were applied. Refresh the destination before preparing another preview.")
  await expect(page.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeDisabled()
  expect(calls.filter((call) => call.operation === "import-apply")).toHaveLength(1)
  expect(calls.filter((call) => call.operation === "import-reference")).toHaveLength(1)
})

test("WP06 real renderer: a stale analysis reference never claims an applied import", async ({ page }) => {
  const calls = await openWorkbench(page, "stale-reference")
  await page.goto("/sucafina/planner?sf=imports&importPreviewRef=manifest-1")
  await expect(page.locator("[data-import-workbench]").getByRole("status")).toHaveText("This preview is no longer applicable. Refresh the destination and review a new preview.")
  await expect(page.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeDisabled()
  await expect(page.getByRole("heading", { name: "Confirmed import", exact: true })).toHaveCount(0)
  expect(calls.filter((call) => call.operation === "import-apply")).toHaveLength(0)
})

for (const outcome of ["applied", "unchanged"] as const) {
  test(`WP06 real renderer: explicit Apply displays confirmed ${outcome} receipt`, async ({ page }) => {
    const calls = await openWorkbench(page, outcome)
    expect(calls.filter((call) => call.operation === "import-apply")).toHaveLength(0)
    await page.getByRole("button", { name: "Apply reviewed import", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Confirmed receipt", exact: true })).toBeVisible()
    await expect(page.getByText(`Outcome: ${outcome} · Changed fields: ${outcome === "unchanged" ? 0 : 1}`, { exact: true })).toBeVisible()
    await expect(page.getByText("Receipt: receipt-1", { exact: true })).toBeVisible()
    await expect(page.getByText("Manifest: manifest-1", { exact: true })).toBeVisible()
    await expect(page.getByText("Actor: actor-1 · Version: 8 · 2027-11-01T12:00:00Z", { exact: true })).toBeVisible()
    await expect(page.locator("[data-import-workbench]").getByRole("status")).toHaveText(outcome === "unchanged" ? "No domain changes were needed. The confirmed receipt is available." : "Import applied. Review the confirmed receipt.")
    await expect(page.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeDisabled()
    const apply = calls.filter((call) => call.operation === "import-apply")
    expect(apply).toHaveLength(1)
    expect(apply[0]?.method).toBe("POST")
    expect(apply[0]?.key).toBeTruthy()
    expect(JSON.parse(apply[0]?.body ?? "null")).toEqual({ manifestId: "manifest-1", version: 1 })
  })
}

// The same real renderer calls production analysis actions. This synthetic HTTP boundary
// checks human intent, references and invalidation; native producers are tested separately.
for (const skill of ["sf-enquadrar-decisao", "sf-explicar-forecast"] as const) {
  test(`WP06 optional ${skill} starts from the exact reviewed file, preview and selected case`, async ({ page }) => {
    const calls = await openWorkbench(page)
    const panel = page.locator("[data-import-analysis]")
    expect(calls.filter((call) => call.operation === "workbench-analysis")).toHaveLength(0)
    await expect(panel.getByRole("button", { name: "Analisar impacto do arquivo", exact: true })).toBeEnabled()
    await panel.getByRole("button", { name: "Analisar impacto do arquivo", exact: true }).click()
    await expect(panel.getByRole("button", { name: "Iniciar análise", exact: true })).toBeEnabled()
    await expect(panel.getByLabel("Decisão", { exact: true })).toHaveText(`${injected} · versão 7`)
    await expect(panel.locator("img")).toHaveCount(0)
    await panel.getByLabel("Tipo de análise", { exact: true }).selectOption(skill === "sf-enquadrar-decisao" ? "0" : "1")
    await panel.getByLabel("Objetivo da análise", { exact: true }).fill("Revisar o impacto desta importação.")
    await panel.getByRole("button", { name: "Iniciar análise", exact: true }).click()
    await expect(panel.locator("[data-analysis-output]")).toHaveText("Analysis of import preview manifest-1")
    await expect(panel.locator("[data-analysis-status]")).toHaveText("Análise disponível. Nenhuma alteração do domínio foi aplicada.")
    const actions = calls.filter((call) => call.operation === "workbench-analysis").map((call) => ({ ...call, value: JSON.parse(call.body ?? "null") }))
    expect(actions.map((call) => call.value.action)).toEqual(["choices", "prepare", "start", "read", "output"])
    const request = { caseRef: { id: "case-1", incarnation: "case-incarnation", version: 7 }, profileId: skill === "sf-enquadrar-decisao" ? "sf_maestro" : "sf_finance",
      profileVersion: "1", skillId: skill, skillVersion: "2", manifestDigest: "a".repeat(64), outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: ["sf_import_preview"], objective: "Revisar o impacto desta importação." }
    expect(actions[1]?.value).toEqual({ action: "prepare", input: { request, selection: { caseRef: request.caseRef, previewRef: "manifest-1", importRequest: { admittedFileRef: "admitted-1", format: "xlsx", options: {} },
      ...(skill === "sf-enquadrar-decisao" ? { intentText: request.objective } : { period, currency: "USD" }) } } })
    expect(actions[2]?.value).toEqual({ action: "start", input: { request, skillInput: { fixture: "prepared-closed-skill-input" }, model: { providerID: "fixture", id: "configured-model" } } })
    expect(actions.every((call) => call.method === "POST" && !!call.key)).toBe(true)
    expect(calls.filter((call) => call.operation === "import-preview")).toHaveLength(1)
    expect(calls.filter((call) => call.operation === "import-apply")).toHaveLength(0)
    await expect(page.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeEnabled()
    await expectInputsPreserved(page)
    await page.getByLabel("Remove records missing from supplied sheets", { exact: true }).uncheck()
    await expect(panel.locator("[data-analysis-output]")).toBeEmpty()
    await expect(panel.getByRole("button", { name: "Analisar impacto do arquivo", exact: true })).toBeDisabled()
    await expect(panel.getByRole("button", { name: "Atualizar análise", exact: true })).toBeDisabled()
    expect(calls.filter((call) => call.operation === "import-apply")).toHaveLength(0)
  })
}

test("WP06 missing analysis model preserves the independent reviewed Apply action", async ({ page }) => {
  const calls = await openWorkbench(page, "applied", undefined, "no-model")
  const panel = page.locator("[data-import-analysis]")
  await panel.getByRole("button", { name: "Analisar impacto do arquivo", exact: true }).click()
  await expect(panel.locator("[data-analysis-status]")).toHaveText("Nenhum modelo está disponível. Você pode continuar a revisão e a importação.")
  await expect(panel.getByRole("button", { name: "Iniciar análise", exact: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeEnabled()
  await page.getByRole("button", { name: "Apply reviewed import", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Confirmed receipt", exact: true })).toBeVisible()
  expect(calls.filter((call) => call.operation === "workbench-analysis").map((call) => JSON.parse(call.body ?? "null").action)).toEqual(["choices"])
})

test("WP06 stale analysis preparation cannot start a session or consume the import Apply action", async ({ page }) => {
  const calls = await openWorkbench(page, "applied", undefined, "stale-prepare")
  const panel = page.locator("[data-import-analysis]")
  await panel.getByRole("button", { name: "Analisar impacto do arquivo", exact: true }).click()
  await expect(panel.getByRole("button", { name: "Iniciar análise", exact: true })).toBeEnabled()
  await panel.getByRole("button", { name: "Iniciar análise", exact: true }).click()
  await expect(panel.locator("[data-analysis-status]")).toHaveText("O caso ou a fonte mudou. Atualize o caso e revise a prévia antes de tentar novamente.")
  await expect(panel.locator("[data-analysis-form]")).toBeHidden()
  await expect(panel.locator("[data-analysis-output]")).toBeEmpty()
  await expect(page.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeEnabled()
  expect(calls.filter((call) => call.operation === "workbench-analysis").map((call) => JSON.parse(call.body ?? "null").action)).toEqual(["choices", "prepare"])
  expect(calls.filter((call) => call.operation === "import-apply")).toHaveLength(0)
})

test("WP06 an uncertain analysis Start retries the exact admitted request and idempotency key", async ({ page }) => {
  const calls = await openWorkbench(page, "applied", undefined, "retry-start")
  const panel = page.locator("[data-import-analysis]")
  await panel.getByRole("button", { name: "Analisar impacto do arquivo", exact: true }).click()
  await expect(panel.getByRole("button", { name: "Iniciar análise", exact: true })).toBeEnabled()
  await panel.getByRole("button", { name: "Iniciar análise", exact: true }).click()
  await expect(panel.locator("[data-analysis-status]")).toHaveText("Não foi possível confirmar a análise. Tente novamente para reconciliar a mesma solicitação. A importação continua disponível.")
  await expect(panel.getByRole("button", { name: "Iniciar análise", exact: true })).toBeEnabled()
  await panel.getByRole("button", { name: "Iniciar análise", exact: true }).click()
  await expect(panel.locator("[data-analysis-output]")).toHaveText("Analysis of import preview manifest-1")
  const actions = calls.filter((call) => call.operation === "workbench-analysis").map((call) => ({ ...call, action: JSON.parse(call.body ?? "null").action }))
  expect(actions.filter((call) => call.action === "prepare")).toHaveLength(1)
  const starts = actions.filter((call) => call.action === "start")
  expect(starts).toHaveLength(2)
  expect(starts[0]?.key).toBeTruthy()
  expect(starts[1]?.key).toBe(starts[0]?.key)
  expect(starts[1]?.body).toBe(starts[0]?.body)
  expect(calls.filter((call) => call.operation === "import-apply")).toHaveLength(0)
})

test("WP06 stale analysis output is removed while the deterministic preview remains visible", async ({ page }) => {
  const calls = await openWorkbench(page, "applied", undefined, "stale-output")
  const panel = page.locator("[data-import-analysis]")
  await panel.getByRole("button", { name: "Analisar impacto do arquivo", exact: true }).click()
  await expect(panel.getByRole("button", { name: "Iniciar análise", exact: true })).toBeEnabled()
  await panel.getByRole("button", { name: "Iniciar análise", exact: true }).click()
  await expect(panel.locator("[data-analysis-output]")).toHaveText("Analysis of import preview manifest-1")
  await expect(panel.getByRole("button", { name: "Atualizar análise", exact: true })).toBeEnabled()
  await panel.getByRole("button", { name: "Atualizar análise", exact: true }).click()
  await expect(panel.locator("[data-analysis-output]")).toBeEmpty()
  await expect(panel.locator("[data-analysis-status]")).toHaveText("O caso ou a fonte mudou. Atualize o caso e revise a prévia antes de tentar novamente.")
  await expect(panel.getByRole("button", { name: "Atualizar análise", exact: true })).toBeDisabled()
  await expect(page.getByRole("heading", { name: "Simulation · no domain changes applied", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Apply reviewed import", exact: true })).toBeEnabled()
  expect(calls.filter((call) => call.operation === "import-apply")).toHaveLength(0)
})
