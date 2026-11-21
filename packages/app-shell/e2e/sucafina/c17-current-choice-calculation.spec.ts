import { errors, expect, test } from "@playwright/test"
import type { APIResponse, Page, Request } from "@playwright/test"
import { createHash, randomUUID } from "node:crypto"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { DecisionCase } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import { canonicalSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import { object, productURL, text } from "./reports-support/model.ts"
import { withReportsInstallation } from "./reports-support/production-installation.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>

const horizon = { start: "2027-01-01", end: "2027-12-31" }
const currency = "USD"
const objective = "Record-only C17 calculation on the installed Planner"
const criterion = "Keep the increase in known subtotal at or below 2000 USD"
const pending = "The synthetic service amount does not establish complete coverage"

test.use({ trace: "off", video: "off", screenshot: "off" })
test.describe.configure({ retries: 0, timeout: 580_000 })

test("C17 CurrentChoice calculates and persists the recorded Planner scenario in the installed browser", async ({ page }, info) => {
  const preconditionsDeadline = performance.now() + 180_000
  const preconditionBudget = () => {
    const timeout = Math.floor(preconditionsDeadline - performance.now())
    if (timeout <= 0) throw new Error("C17 installation and Atlas preconditions timed out")
    return { timeout }
  }
  expect(info.project.metadata.bundle).toBe("production")
  expect(info.config.workers).toBe(1)
  info.annotations.push({ type: "proof-scope", description: "Installed record-only calculation. Recursive ancestry is covered in hosted run 44871314900." })

  await withReportsInstallation({
    page, setupEntry: "c17-calculation-state.ts", startupTimeoutMs: 120_000,
    initialize: async (app) => { await app.setup("seed") },
  }, async (app) => {
    const saved = await test.step("Record the choice through the installed workbench",
      () => createRecordedChoice(page, app.dashboardURL), preconditionBudget())
    const selector = productURL(app.dashboardURL, "current-choice", { case: saved.reference })
    const choicePage = page.locator("section.sf-current-choice")
    const expectedPrepare = { caseRef: saved.caseRef, choiceId: saved.choice.id,
      alternativeRef: { id: saved.choice.alternativeId, version: saved.choice.alternativeVersion }, coverageRef: saved.coverageRef }
    const readSelection = async () => {
      const options = object(JSON.parse(await page.locator("#current-choice-data").textContent() ?? "null"))
      return object(options.selected)
    }
    const prepare = choicePage.getByRole("button", { name: "Preparar escolha vigente", exact: true })
    await test.step("Verify the same choice cannot be prepared without Atlas", async () => {
      expect((await page.goto(selector.href))?.status()).toBe(200)
      await expect(choicePage.getByRole("heading", { name: "Escolha vigente", exact: true })).toBeVisible()
      await expect(choicePage.getByRole("heading", { name: objective, exact: true })).toBeVisible()
      const beforeArchive = await readSelection()
      expect(beforeArchive.caseRef).toEqual(saved.caseRef)
      expect(beforeArchive.choices).toEqual([{
        id: saved.choice.id, title: saved.source.target.recordId, reason: "A fonte ou a cobertura vigente requer revisão.",
      }])
      await expect(prepare).toHaveCount(1)
      await expect(prepare).toBeDisabled()
      const unavailable = await page.request.post(productURL(app.dashboardURL, "current-choice-prepare").href, {
        data: expectedPrepare,
        headers: { origin: app.origin, "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
      })
      expect(unavailable.status()).toBe(503)
      expect(await unavailable.json()).toEqual({ status: "unavailable", reason: "choice-source-continuity-unavailable" })
      await expect(choicePage.locator("#current-choice-review")).toBeHidden()
    }, preconditionBudget())

    const archived = await test.step("Archive the real ledger event and verify prepare is enabled", async () => {
      const capture = object(JSON.parse(await app.setup("archive-choice", [
        JSON.stringify(saved.caseRef), saved.source.refDigest,
      ])))
      expect(capture).toEqual({ eventId: expect.any(String), plannerDigest: saved.source.refDigest, scanner: "clean" })
      expect((await page.reload())?.status()).toBe(200)
      await expect(choicePage.getByRole("heading", { name: objective, exact: true })).toBeVisible()
      const selected = await readSelection()
      expect(selected.caseRef).toEqual(saved.caseRef)
      expect(selected.choices).toMatchObject([{ id: saved.choice.id, title: saved.source.target.recordId, request: expectedPrepare }])
      await expect(prepare).toBeEnabled()
      return capture
    }, preconditionBudget())
    const { received, elapsedMs } = await test.step("Send one browser prepare and observe its bounded result", async () => {
      const responseBudget = 280_000
      const dispatchTimeout = 10_000
      const target = productURL(app.dashboardURL, "current-choice-prepare").href
      const matchesPrepare = (request: Request) => request.method() === "POST" && request.url() === target
      const completed = Promise.withResolvers<"finished" | "failed" | undefined>()
      const observation: { matchingPosts: number; matched?: { request: Request; started: number } } = { matchingPosts: 0 }
      const countPrepare = (request: Request) => { if (matchesPrepare(request)) observation.matchingPosts++ }
      const finished = (request: Request) => { if (request === observation.matched?.request) completed.resolve("finished") }
      const failed = (request: Request) => { if (request === observation.matched?.request) completed.resolve("failed") }
      page.on("request", countPrepare)
      page.on("requestfinished", finished)
      page.on("requestfailed", failed)
      try {
        const sent = page.waitForRequest((request) => {
          if (!matchesPrepare(request)) return false
          observation.matched = { request, started: performance.now() }
          return true
        }, { timeout: dispatchTimeout })
        const [sentResult, click] = await Promise.allSettled([sent, prepare.click({ timeout: dispatchTimeout })])
        if (click.status === "rejected") throw click.reason
        if (sentResult.status === "rejected") {
          if (!(sentResult.reason instanceof errors.TimeoutError)) throw sentResult.reason
          throw new Error("The installed browser did not send its prepare POST")
        }
        const matched = observation.matched
        if (!matched || matched.request !== sentResult.value) throw new Error("The exact prepare POST was not observed")
        const request = matched.request
        const prepareStarted = matched.started
        const deadline = prepareStarted + responseBudget
        expect(request.postDataJSON()).toEqual(expectedPrepare)
        const key = request.headers()["idempotency-key"]
        const command = key && /^[A-Za-z0-9._:-]{8,128}$/.test(key)
          ? createHash("sha256").update(canonicalSfValue({ operation: "sf-human:planner.preview", key })).digest("hex")
          : undefined
        const sampleReceipts = async (timeoutMs: number) => {
          if (!command) return { observation: "command-identity-unavailable" }
          if (timeoutMs <= 0) return { observation: "receipt-observation-budget-exhausted" }
          return test.step("Sample the committed C17 receipts without replay", async () => {
            try {
              return JSON.parse(await app.setup("observe-prepare", [JSON.stringify(saved.caseRef), command], { timeoutMs })) as unknown
            } catch {
              return { observation: "receipt-read-unavailable" }
            }
          })
        }

        // Keep the same request active across these observations.
        let result: Awaited<typeof completed.promise> = undefined
        for (const checkpoint of [90, 150, 210, 260]) {
          result = await until(completed.promise, prepareStarted + checkpoint * 1_000)
          if (result) break
          const elapsedMs = Math.round(performance.now() - prepareStarted)
          const httpStatus = request.existingResponse()?.status() ?? null
          const receipts = await sampleReceipts(Math.min(8_000, Math.floor(deadline - performance.now())))
          await info.attach(`c17-prepare-pending-${checkpoint}s.json`, { contentType: "application/json",
            body: JSON.stringify({ outcome: "response-pending", elapsedMs, httpStatus, receipts }) })
        }
        result ??= await until(completed.promise, deadline)
        const response = request.existingResponse()
        const bodyBudget = Math.floor(deadline - performance.now())
        const received: unknown = result === "finished" && response && bodyBudget > 0
          ? await test.step("Read the prepare response body", () => response.json(), { timeout: bodyBudget }).catch(() => undefined)
          : undefined
        const elapsedMs = Math.round(performance.now() - prepareStarted)
        const reason = typeof received === "object" && received !== null && "reason" in received &&
          typeof received.reason === "string" && received.reason.length <= 100 &&
          /^(?:current-choice|choice|calculation|scenario|coverage|result|product-state|baseline|planner|case|source|operation|ui|human)(?:-[a-z0-9]+)+$/.test(received.reason)
          ? received.reason : "reason-unavailable"
        if (response?.status() !== 200 || received === undefined) {
          const outcome = result === "failed" ? "request-failed"
            : result === "finished" ? received === undefined ? "response-body-unavailable" : "http-response"
            : "response-pending"
          const receipts = await sampleReceipts(7_000)
          await info.attach("c17-prepare-failure.json", { contentType: "application/json",
            body: JSON.stringify({ outcome, elapsedMs, responseBudget, httpStatus: response?.status() ?? null,
              reason, receipts, matchingPosts: observation.matchingPosts }) })
          throw new Error(`The installed producer did not return the computed preview (${outcome}, ${response?.status() ?? "no response"}, ${reason})`)
        }
        expect(observation.matchingPosts).toBe(1)
        return { received, elapsedMs }
      } finally {
        page.off("request", countPrepare)
        page.off("requestfinished", finished)
        page.off("requestfailed", failed)
        completed.resolve(undefined)
      }
    })
    await test.step("Verify the exact result, persisted binding and installed reload", async () => {
      const body = object(received)
      expect(body.status).toBe("ok")
      const preview = object(body.value)
      const promotion = object(preview.promotion)
      expect(promotion).toMatchObject({ caseRef: saved.caseRef, choiceId: saved.choice.id,
        scenario: { baseRef: saved.source.refId, operations: [], assumptions: [] }, resultDigest: expect.stringMatching(/^[0-9a-f]{64}$/) })
      expect(preview.historical).toEqual(saved.choice.result)
      expect(preview.current).toMatchObject({ currency, horizon, knownSubtotal: 2400, total: null,
        sourceRefs: expect.arrayContaining([saved.source]), costCoverage: { coverageState: "pending" } })
      await expect(choicePage.locator("#current-choice-review")).toBeVisible()
      await expect(choicePage.getByRole("button", { name: "Promover resultado vigente", exact: true })).toBeDisabled()

      const stored = object(JSON.parse(await app.setup("observe", [JSON.stringify(promotion)])))
      expect(stored).toEqual({ producerResultRef: expect.stringMatching(/^decision-result:/), engineVersion: "planner-runtime-v1",
        caseVersion: saved.caseRef.version, choices: 1, ledgerKinds: ["choice-recorded"], preparedChanges: 0, receipts: 0 })
      expect(stored.producerResultRef).not.toBe(promotion.resultRef)
      const proof = { caseRef: saved.caseRef, choiceId: saved.choice.id, atlas: archived, prepareElapsedMs: elapsedMs, ...stored, recursiveAncestry: false }
      await info.attach("c17-installed-prepare.json", { contentType: "application/json", body: JSON.stringify(proof) })
      const started = performance.now()
      const reloaded = await page.reload()
      const reloadElapsedMs = Math.round(performance.now() - started)
      if (reloaded?.status() !== 200) {
        const failure: unknown = await reloaded?.json().catch(() => undefined)
        const reason = failure && typeof failure === "object" && "reason" in failure ? failure.reason : undefined
        const reasons = ["current-choice-unavailable", "current-choice-publication-unavailable", "current-choice-options-unavailable", "current-choice-options-changed",
          "current-choice-options-case-unavailable", "current-choice-options-case-evidence-unavailable",
          "current-choice-options-case-access-unavailable", "current-choice-options-case-state-unavailable",
          "current-choice-options-product-state-unavailable", "current-choice-options-product-access-unavailable",
          "current-choice-options-product-authority-changed", "current-choice-options-memory-case-read-changed",
          "current-choice-options-pin-unavailable"]
        await info.attach("c17-installed-reload-failure.json", { contentType: "application/json", body: JSON.stringify({
          status: reloaded?.status() ?? null, reloadElapsedMs,
          reason: typeof reason === "string" && reasons.includes(reason) ? reason : "unknown",
        }) })
      }
      expect(reloaded?.status()).toBe(200)
      await expect(choicePage.getByRole("heading", { name: objective, exact: true })).toBeVisible()
      await expect(prepare).toBeEnabled()
      await info.attach("c17-installed-calculation.json", { contentType: "application/json", body: JSON.stringify({ ...proof, reloadElapsedMs }) })
    }, { timeout: 80_000 })
  })
})

async function until<T>(observation: Promise<T>, deadline: number) {
  const remaining = deadline - performance.now()
  if (remaining <= 0) return undefined
  const elapsed = Promise.withResolvers<undefined>()
  const timer = setTimeout(() => elapsed.resolve(undefined), remaining)
  try {
    return await Promise.race([observation, elapsed.promise])
  } finally {
    clearTimeout(timer)
    elapsed.resolve(undefined)
  }
}

async function createRecordedChoice(page: Page, dashboard: string) {
  // The prepared case page intentionally excludes the legacy alternatives form.
  // Use the same installed HTTP commands and obtain each source from BI.
  const created = await post(page, dashboard, "workbench-command", { operation: "sf_case_draft",
    input: { objective, horizon, currency, criteria: [criterion], sourceRefs: [] } })
  const reference = text(created.outputRef)
  const readControls = async () => {
    const result = await ok(await page.request.get(productURL(dashboard, "decision-controls", { case: reference, format: "json" }).href), "decision-controls")
    const selected = object(object(result.value).selected)
    return { caseRef: selected.caseRef as CaseRef, decision: selected.decision as DecisionCase }
  }
  const draft = await readControls()
  const criteria = draft.decision.criteria.map((entry) => entry.id)
  expect(criteria).toHaveLength(1)
  const sourceRefs = await plannerEvidence(page, dashboard)
  const edited = await post(page, dashboard, "decision-edit", {
    caseRef: draft.caseRef, objective, horizon, currency, criteria: draft.decision.criteria, sourceRefs,
  })
  const basis = { id: `human-cost-inventory:${randomUUID()}`, version: 1, decisionType: "renewal-transition-v1",
    categoryIds: RENEWAL_TRANSITION_CATEGORIES, additionalCategoryIds: [], sourceRefs }
  const entries = basis.categoryIds.map((categoryId) => ({ categoryId, status: "pending", reason: pending }))
  let caseRef = object(edited.value).caseRef as CaseRef
  let coverageRef = ""
  for (const source of sourceRefs) {
    const coverage = await post(page, dashboard, "decision-coverage", { caseRef, source, basis, entries, expectedVersion: 0 })
    coverageRef = text(object(coverage.value).coverageRef)
    const alternative = await post(page, dashboard, "decision-promote", { caseRef, coverageRef,
      title: source.target.recordId, scenario: { baseRef: source.refId, operations: [], assumptions: [] } })
    caseRef = object(alternative.value).caseRef as CaseRef
  }
  const comparisonCase = await readControls()
  expect(comparisonCase.caseRef).toEqual(caseRef)
  const [baseline, candidate] = sourceRefs.map((source) => {
    const alternative = comparisonCase.decision.alternatives.find((entry) => entry.scenario.baseRef === source.refId)
    if (!alternative) throw new Error("The authorized alternative could not be reopened")
    return alternative
  })
  await post(page, dashboard, "decision-criteria", { caseRef, criterionId: criteria[0],
    metricRef: "planner:known-subtotal-difference", operator: "lte", value: 2000, unit: currency, period: horizon,
    evidenceRefs: sourceRefs, expectedRuleVersion: 0 })
  const compared = object((await post(page, dashboard, "decision-compare", { caseRef, baselineAlternativeId: baseline!.id,
    alternativeId: candidate!.id, criteria })).value)
  expect(compared.comparison).toMatchObject({ comparisonStatus: "conditioned", knownDifference: 1200, completeDifference: null })
  const chosen = await post(page, dashboard, "decision-choose", { caseRef, alternativeId: candidate!.id, alternativeVersion: candidate!.version,
    comparison: compared.request, criteria, reason: "Keep the candidate under the recorded pending cost conditions" })
  const recorded = await readControls()
  expect(recorded.caseRef).toEqual(object(chosen.value).caseRef)
  expect(recorded.decision.choices).toHaveLength(1)
  const choice = recorded.decision.choices[0]!
  expect(choice.scenario).toEqual({ baseRef: sourceRefs[1]!.refId, operations: [], assumptions: [] })
  return { reference, caseRef: recorded.caseRef, choice, coverageRef, source: sourceRefs[1]! }
}

async function plannerEvidence(page: Page, dashboard: string) {
  const parameters = { viewId: "BI01", ...horizon }
  const options = object((await ok(await page.request.get(productURL(dashboard, "bi-options", parameters).href), "bi-options")).value)
  const versions = (options.versions as unknown[]).map(object)
  const sources: RecordEvidence[] = []
  for (const id of ["c17-baseline", "c17-candidate"]) {
    const version = versions.find((entry) => text(entry.label).startsWith(`${id} (${id})`))
    if (!version) throw new Error(`The installed Planner did not expose ${id}`)
    const ref = text(version.ref)
    const reply = await page.request.get(productURL(dashboard, "bi-data", { ...parameters, baseRef: ref, candidateRef: ref, currency }).href)
    expect(reply.status()).toBe(200)
    const projection = object(object(await reply.json()).projection)
    const values = (projection.values as unknown[]).map(object)
    const evidence = values.flatMap((entry) => [...entry.sourceRefs as BusinessEvidenceRef[], entry.drilldown as BusinessEvidenceRef | undefined])
    const selected = evidence.find((entry): entry is RecordEvidence => entry?.kind === "record" && entry.refId === ref &&
      entry.target.surface === "planner" && entry.target.recordType === "planner-version" && entry.target.recordId === id)
    if (!selected) throw new Error(`The installed BI producer did not emit the Planner source for ${id}`)
    sources.push(selected)
  }
  return sources
}

async function post(page: Page, dashboard: string, mode: string, data: unknown) {
  const url = productURL(dashboard, mode)
  return ok(await page.request.post(url.href, {
    data, headers: { origin: url.origin, "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
  }), mode)
}

async function ok(response: APIResponse, mode: string) {
  const body = object(await response.json())
  expect(body.status, `${mode} responded ${response.status()}: ${String(body.reason ?? "")}`).toBe("ok")
  expect(response.status()).toBe(200)
  return body
}
