import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { launchBrowserDriver } from "./browser-driver-fixture.ts"
import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AbsolutePath } from "@orchestra/core/schema"
import { createModule } from "../../../index.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardRecordEvidenceHost } from "../../../product/dashboard/sources.ts"
import { createChoiceSnapshot } from "../../../product/decisions/choice.ts"
import { decorateSfProductHtml } from "../../../product/interface/html.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DecisionCase, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { HotTopicDraft } from "../../../product/decisions/hot-topic-draft.ts"
import { createFixtureBusiness } from "./business-services-fixture.ts"
import { createSfDashboardHttp } from "../../../../../../apps/cli/src/sucafina-product/dashboard-http.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const initialCaseRef = { id: "private-case-identity", incarnation: "case-incarnation", version: 1 }

// The browser uses an encrypted operator session, production module and actual C08/source producers.
// Business records and the already chosen, explicitly conditioned scenario are the only fixtures.
async function fixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-dashboard-workbench-"))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(directory)
  const routing: { handle?: (request: Request) => Promise<Response | undefined> } = {}
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (request) => await routing.handle?.(request) ?? new Response(null, { status: 503 }) })
  const origin = server.url.origin, installationId = randomUUID(), principalRef = `macos:${installationId}:1000`
  const clock = { at: "2026-11-13T08:00:00Z" }, policy = { writable: true }
  const delayed: { next: boolean; release?: () => void; started?: () => void; calls: number } = { next: false, calls: 0 }
  const httpTrace: { mode: string; method: string; state: "received" | "returned" | "threw"; status?: number; elapsedMs?: number }[] = []
  const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID, projectScope: createSfSourceScopeProjector(() => clock.at) })
  const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator: { installationId, uid: 1000, name: "Dashboard reviewer" }, secrets: driver.secrets, key: randomBytes(32) })
  const authenticate: typeof identity.authenticate = async (request, context) => {
    const principal = await identity.authenticate(request, context)
    return principal ? { ...principal, canWrite: policy.writable && principal.canWrite } : null
  }
  const environment = async (request: Request) => ({ at: clock.at, id: randomUUID, directory: await identity.directory(request) })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.hotTopics = [{ id: "topic", action: "Original action", owner: "Operations", due: "2026-12-01", priority: "normal", status: "open", notes: "" }]
    return { commit: true, value: undefined }
  })
  const proposalCoverageWrites = new WeakSet<object>(), dashboardHostWrites = new WeakSet<object>()
  const authority = createSfProductAuthority({ identity: () => ({ installationId, hostId: "host", projectId: "project", location: { directory: AbsolutePath.make(directory) } }),
    installationId, origin, policyVersion: "policy", persistence, authenticate, environment, now: Date.now, createId: randomUUID,
    commandIdentity: async (request, operation) => request.method === "GET" || request.method === "HEAD" ? randomUUID() :
      request.headers.get("idempotency-key") ? digestSfValue({ operation, key: request.headers.get("idempotency-key") }) : undefined,
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined,
    authorizeDocument: async () => undefined, proposalCoverageWrites, dashboardHostWrites,
    grants: [{ principalRef, namespaces: ["cases", "preferences", "reviews", "receipts"], operations: ["sf_dashboard_read", "sf_case_read"],
      humanActions: ["reviews.preserve", "decisions.edit", "decisions.choose", "decisions.prepare-changes", "decisions.apply"] }] })
  const records = createDashboardRecordEvidenceHost({ host: authority.host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host: authority.host, scopedSources: persistence }) })
  const business = await createFixtureBusiness({ authority, persistence, proposalCoverageWrites, dashboardHostWrites }).catch(async (error: unknown) => {
    const failures: unknown[] = [error]
    try { await server.stop(true) } catch (failure) { failures.push(failure) }
    try { await driver.dispose() } catch (failure) { failures.push(failure) }
    try { await rm(directory, { recursive: true, force: true }) } catch (failure) { failures.push(failure) }
    throw failures.length === 1 ? error : new AggregateError(failures, "Business fixture setup and cleanup failed")
  })
  const dashboard = business.dashboardServices, decisions = business.dashboardDecisions
  const http = createSfDashboardHttp({ origin, mount: "/sucafina", runtime: () => ({ authority, dashboard, decisions }) })
  const module = createModule("/sucafina", { persistence, authenticate, environment, product: http, productHtml: decorateSfProductHtml, maxJsonBytes: 100000 })
  routing.handle = async (request) => {
    const mode = new URL(request.url).searchParams.get("sf"), started = performance.now()
    const observation: (typeof httpTrace)[number] | undefined = mode === "dashboard-workbench" || mode === "dashboard-hot-topic-draft" ? { mode, method: request.method, state: "received" } : undefined
    if (observation) httpTrace.push(observation)
    try {
      const response = await identity.handle(request) ?? await module(request)
      if (mode === "dashboard-hot-topic-apply") {
        delayed.calls++
        if (delayed.next) { delayed.next = false; await new Promise<void>((resolve) => { delayed.release = resolve; delayed.started?.() }) }
      }
      if (observation) { observation.state = "returned"; observation.status = response?.status ?? 503 }
      return response
    } catch (error) {
      if (observation) observation.state = "threw"
      throw error
    } finally {
      if (observation) observation.elapsedMs = Math.round(performance.now() - started)
    }
  }
  const login = await identity.handle(new Request(`${origin}/sucafina/auth/local?code=${await identity.enroll()}`))
  const cookie = login?.headers.get("set-cookie")?.split(";")[0]
  if (!cookie) throw new Error("Operator enrollment failed")
  const request = () => new Request(`${origin}/sucafina/dashboard?sf=dashboard-workbench`, { method: "POST", headers: { cookie, origin, "content-type": "application/json", "idempotency-key": randomUUID() }, body: JSON.stringify({ page: "Hot Topics & Actions" }) })
  const read = async <T>(work: (context: TrustedDomainContext) => Promise<T>) => {
    const source = request(), digest = digestSfValue({ page: "Hot Topics & Actions" })
    const admitted = await authority.ui.admit(source, "sf_dashboard_read", digest)
    if (admitted.status !== "ok") throw new Error("UI read admission failed")
    try {
      if (!await authority.ui.validate(admitted.value, "sf_dashboard_read", digest)) throw new Error("UI read validation failed")
      return await work(admitted.value)
    } finally { authority.ui.finish(admitted.value) }
  }
  const decision: DecisionCase = { ...initialCaseRef, objective: "Review the action", state: "investigating", horizon: period, currency: "USD", participants: [principalRef],
    criteria: [{ id: "operational", description: "Operational action", required: true }], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const seeded = await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: 0, targetRef: authority.creationTarget.ref,
    targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "initial-cases", commandDigest: digestSfValue(decision) }, async (state) => {
      state.cases[decision.id] = decision
      state.cases["other-case"] = { ...decision, id: "other-case", incarnation: "other-case-inc", objective: "Unrelated confidential case", participants: ["another-principal"] }
      return { commit: true, value: true }
    })
  expect(seeded.status).toBe("ok")
  return { origin, identity, policy, clock, delayed, httpTrace, principalRef, persistence, authority, dashboard, decisions, records, request, read,
    close: async () => { delayed.release?.(); business.dispose(); await server.stop(true); await driver.dispose(); await rm(directory, { recursive: true, force: true }) } }
}

async function storeExistingChoice(f: Awaited<ReturnType<typeof fixture>>, draft: HotTopicDraft) {
  const result: ScenarioResult = { id: "scenario", version: 1, currency: "USD", horizon: period, components: [], sourceRefs: [draft.targetEvidence],
    unresolvedConditions: ["Financial impact of the Hot Topic change is not assessed."], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: null, total: null,
    costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon: period, issues: [], evaluatedSourceRefs: [draft.targetEvidence],
      coverageState: "pending", entries: [{ status: "pending", categoryId: "other_relevant_costs", reason: "Financial impact is not assessed" }], derivedMissingCategoryIds: ["other_relevant_costs"] } }
  const current = await f.authority.state.read(f.request(), "cases", (state) => state.cases[initialCaseRef.id])
  if (current.status !== "ok" || !current.value) throw new Error("Case unavailable")
  const value: DecisionCase = { ...current.value, sourceRefs: [draft.targetEvidence],
    costCoverageBases: [{ id: "basis", version: 1, decisionType: "operational", categoryIds: ["other_relevant_costs"], additionalCategoryIds: [], sourceRefs: [draft.targetEvidence] }],
    alternatives: [{ id: "alternative", version: 1, title: "Update action", scenario: { baseRef: "case-base", operations: [{ kind: "replace", targetRef: draft.targetEvidence.refId, replacementRef: draft.draftRef }], assumptions: [] }, result }] }
  const selected = createChoiceSnapshot({ case: value, alternativeId: "alternative", alternativeVersion: 1, id: "choice", principalRef: f.principalRef, reason: "Proceed with operational action; no financial claim", at: f.clock.at,
    criteria: ["operational"], values: [], evidenceRefs: [draft.targetEvidence], comparison: { baselineResultRef: "baseline", alternativeResultRef: result.id, costCoverageRefs: ["basis"], criterionResults: [], unresolvedConditions: result.unresolvedConditions, comparisonStatus: "conditioned", knownDifference: null, completeDifference: null } })
  if (selected.status !== "ok") throw new Error(`Choice fixture invalid: ${selected.reason}`)
  const saved = await f.authority.state.transaction(f.request(), { namespace: "cases", expectedStorageVersion: current.storageVersion,
    targetRef: value.id, targetIncarnation: value.incarnation, idempotencyKey: "existing-choice", commandDigest: digestSfValue(selected.choice) }, async (state) => {
      state.cases[value.id] = { ...value, version: 2, state: "chosen", choices: [selected.choice] }; return { commit: true, value: true }
    })
  expect(saved.status).toBe("ok")
}

test("Dashboard contextual controls preserve a real agenda and record, then review and apply an existing C12 choice", async () => {
  expectSpawn(import.meta.path)
  const f = await fixture()
  const browserDriver = await launchBrowserDriver("host-contextual-controls").catch(async (error) => { await f.close(); throw error })
  const browser = browserDriver.browser
  try {
    const page = await browser.newPage(), errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(`${f.origin}/sucafina/auth/local?code=${await f.identity.enroll()}`)
    await page.goto(`${f.origin}/sucafina/dashboard?page=Hot+Topics+%26+Actions`)
    await page.locator("[data-dashboard-workbench-panel] > summary").click()
    const panel = page.locator("[data-dashboard-workbench]")
    await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
    await panel.getByText("Opções carregadas.", { exact: false }).waitFor()
    expect(await panel.locator("[data-dashboard-case]").textContent()).toContain("Review the action")
    expect(await panel.textContent()).not.toContain("Unrelated confidential case")
    expect(await panel.textContent()).not.toContain(initialCaseRef.id)
    expect(await panel.getByRole("button", { name: "Preparar escolha", exact: true }).isEnabled()).toBe(false)
    await panel.getByRole("button", { name: "Pré-visualizar pauta", exact: true }).click()
    await panel.getByText("Pauta pronta para revisão.", { exact: true }).waitFor()
    expect(await panel.locator("[data-dashboard-agenda-view]").textContent()).toContain("Original action")
    expect(await panel.locator("[data-dashboard-agenda-view]").textContent()).toContain("2026-11-13")
    expect(await panel.locator("[data-dashboard-agenda-view]").textContent()).toContain("Confirmado")
    expect(await panel.locator("[data-dashboard-agenda-view] th").allTextContents()).toEqual(["Campo", "Período", "Valor", "Unidade / moeda", "Evidência", "Origem"])
    await panel.getByRole("button", { name: "Preservar reunião", exact: true }).click()
    await panel.getByText("Reunião preservada.", { exact: false }).waitFor()
    await panel.getByLabel("Registro para preservar").selectOption({ label: "Original action" })
    await panel.getByRole("button", { name: "Preservar retrato", exact: true }).click()
    await panel.getByText("Retrato do registro preservado.", { exact: true }).waitFor()
    await f.persistence.transaction("dashboard", async (snapshot) => { rows(snapshot.data.hotTopics)[0]!.action = "Current revised action"; return { commit: true, value: undefined } })
    await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
    await panel.getByText("Opções carregadas.", { exact: false }).waitFor()
    await panel.getByLabel("Reunião ou retrato preservado").selectOption({ index: 1 })
    const historyResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "dashboard-history")
    await panel.getByRole("button", { name: "Abrir histórico", exact: true }).click()
    expect((await historyResponse).status()).toBe(200)
    await panel.getByText("Histórico aberto com seu acesso atual.", { exact: true }).waitFor()
    expect(await panel.locator("[data-dashboard-history-view]").textContent()).toContain("Original action")
    expect(await panel.locator("[data-dashboard-history-view]").textContent()).not.toContain("Current revised action")

    await panel.getByLabel(/^Caso/).selectOption({ label: "Review the action" })
    await panel.getByLabel(/^Rascunho/).selectOption("new")
    await panel.getByLabel(/^Hot Topic de origem/).selectOption({ label: "Current revised action" })
    await panel.getByLabel("Ação", { exact: true }).fill("Approved new action")
    await panel.getByLabel("Prazo", { exact: true }).fill("2026-12-20")
    await panel.getByLabel(/^Prioridade/).selectOption("high")
    await panel.getByLabel("Notas", { exact: true }).fill("Reviewed with Operations")
    await panel.getByRole("button", { name: "Salvar rascunho", exact: true }).click()
    await panel.getByText("Rascunho salvo.", { exact: false }).waitFor()
    expect(await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: rows(snapshot.data.hotTopics)[0]!.action }))).toBe("Current revised action")
    const found = await f.read((context) => f.decisions.drafts.list({ caseRef: initialCaseRef }, context))
    if (found.status !== "ok" || found.value.length !== 1) throw new Error("Saved draft missing")
    const current = await f.read((context) => f.decisions.drafts.readCurrent({ caseRef: initialCaseRef, draftRef: found.value[0]!.draftRef }, context))
    if (current.status !== "ok") throw new Error("Saved draft not current")
    expect(current.value.fields.action).toBe("Approved new action")
    await storeExistingChoice(f, current.value)
    await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
    await panel.getByText("Opções carregadas.", { exact: false }).waitFor()
    expect(await panel.getByRole("button", { name: "Preparar escolha", exact: true }).isEnabled()).toBe(false)
    await panel.getByLabel("Escolha existente para preparar").selectOption({ index: 1 })
    expect(await panel.locator("[data-dashboard-choice-reason]").textContent()).toContain("no financial claim")
    await panel.getByRole("button", { name: "Preparar escolha", exact: true }).click()
    await panel.getByText("Escolha preparada.", { exact: false }).waitFor()
    await panel.getByLabel(/^Alteração preparada/).selectOption({ index: 1 })
    await panel.getByRole("button", { name: "Revisar alterações", exact: true }).click()
    await panel.getByText("Confira os valores atuais e propostos.", { exact: false }).waitFor()
    const review = await panel.locator("[data-dashboard-review-view]").textContent()
    expect(review).toContain("Current revised action")
    expect(review).toContain("Approved new action")
    expect(await panel.textContent()).not.toContain("mutationScope")
    expect(await panel.textContent()).not.toContain("commandDigest")
    expect(await panel.getByRole("button", { name: "Aplicar alterações", exact: true }).isEnabled()).toBe(false)
    await panel.getByLabel("Revisei os campos e confirmo estas alterações.").check()
    await page.evaluate(async () => {
      const runtime: unknown = window
      if (!runtime || typeof runtime !== "object" || !("sucafinaRefresh" in runtime) || typeof runtime.sucafinaRefresh !== "function") throw new Error("Refresh unavailable")
      await runtime.sucafinaRefresh()
    })
    expect(await panel.locator("[data-dashboard-review-view]").textContent()).toBe(review)
    expect(await panel.getByLabel("Revisei os campos e confirmo estas alterações.").isChecked()).toBe(true)
    const started = new Promise<void>((resolve) => { f.delayed.started = resolve })
    f.delayed.next = true
    await panel.getByRole("button", { name: "Aplicar alterações", exact: true }).click()
    await started
    await page.evaluate(async () => {
      const runtime: unknown = window
      if (!runtime || typeof runtime !== "object" || !("sucafinaRefresh" in runtime) || typeof runtime.sucafinaRefresh !== "function") throw new Error("Refresh unavailable")
      await runtime.sucafinaRefresh()
    })
    expect(await panel.locator("[data-dashboard-review-view]").textContent()).toBe(review)
    f.delayed.release?.()
    await panel.getByText("Alterações aplicadas. O comprovante foi registrado no caso.", { exact: false }).waitFor()
    expect(f.delayed.calls).toBe(1)
    const saved = await f.authority.state.read(f.request(), "cases", (state) => state.cases[initialCaseRef.id])
    expect(saved.status === "ok" && saved.value?.receipts).toHaveLength(1)
    expect(saved.status === "ok" && saved.value?.preparedChanges[0]?.state).toBe("applied")
    expect(await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: rows(snapshot.data.hotTopics)[0]!.action }))).toBe("Approved new action")
    expect(errors).toEqual([])
  } finally { try { await browserDriver.close() } finally { await f.close() } }
  browserDriver.report()
}, 60000)

test("Dashboard draft conflict reloads the same draft identity and preserves local edits until the current base is confirmed", async () => {
  expectSpawn(import.meta.path)
  const phase = async <T>(name: string, work: () => Promise<T>) => {
    const started = performance.now()
    console.info("SF_WP02_DRAFT_CONFLICT_PHASE", JSON.stringify({ phase: name, state: "started" }))
    let state = "threw"
    try { const value = await work(); state = "returned"; return value }
    finally { console.info("SF_WP02_DRAFT_CONFLICT_PHASE", JSON.stringify({ phase: name, state, elapsedMs: Math.round(performance.now() - started) })) }
  }
  const f = await phase("fixture.create", fixture)
  const browserDriver = await phase("browser.launch", () => launchBrowserDriver("host-draft-conflict"))
    .catch(async (error) => {
      const [closed] = await Promise.allSettled([phase("fixture.close-after-launch-failure", () => f.close())])
      if (closed?.status === "rejected") throw new AggregateError([error, closed.reason], "Browser launch and fixture cleanup failed")
      throw error
    })
  const browser = browserDriver.browser
  const failures: unknown[] = []
  try {
    const context = await phase("browser.context", () => browser.newContext())
    context.setDefaultTimeout(15000)
    context.setDefaultNavigationTimeout(15000)
    const page = await context.newPage(), errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    const observe = (tab: typeof page, name: string) => {
      tab.on("request", (request) => {
        const mode = new URL(request.url()).searchParams.get("sf")
        if (mode === "dashboard-workbench" || mode === "dashboard-hot-topic-draft") console.info("SF_WP02_DRAFT_CONFLICT_REQUEST", JSON.stringify({ tab: name, mode, method: request.method(), state: "sent" }))
      })
      tab.on("requestfailed", (request) => {
        const mode = new URL(request.url()).searchParams.get("sf")
        if (mode === "dashboard-workbench" || mode === "dashboard-hot-topic-draft") console.info("SF_WP02_DRAFT_CONFLICT_REQUEST", JSON.stringify({ tab: name, mode, method: request.method(), state: "failed" }))
      })
      tab.on("response", (response) => {
        const mode = new URL(response.url()).searchParams.get("sf")
        if (mode === "dashboard-workbench" || mode === "dashboard-hot-topic-draft") console.info("SF_WP02_DRAFT_CONFLICT_HTTP", JSON.stringify({ tab: name, mode, status: response.status() }))
      })
    }
    observe(page, "original")
    await page.goto(`${f.origin}/sucafina/auth/local?code=${await f.identity.enroll()}`)
    await page.goto(`${f.origin}/sucafina/dashboard?page=Hot+Topics+%26+Actions`)
    await page.locator("[data-dashboard-workbench-panel] > summary").click()
    const panel = page.locator("[data-dashboard-workbench]")
    await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
    await panel.getByText("Opções carregadas.", { exact: false }).waitFor()
    await panel.getByLabel(/^Caso/).selectOption({ label: "Review the action" })
    await panel.getByLabel(/^Rascunho/).selectOption("new")
    await panel.getByLabel(/^Hot Topic de origem/).selectOption({ label: "Original action" })
    await panel.getByLabel("Ação", { exact: true }).fill("Initial shared draft")
    const save = (tab: typeof page, target: typeof panel, name: string) => phase(name, async () => {
      // A successful write can be followed by a failed discovery. Qualify both
      // actual responses and the complete success state before selecting again.
      const [written, discovered] = await Promise.all([
        tab.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).searchParams.get("sf") === "dashboard-hot-topic-draft"),
        tab.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).searchParams.get("sf") === "dashboard-workbench"),
        phase(`${name}.click`, () => target.getByRole("button", { name: "Salvar rascunho", exact: true }).click()),
      ])
      expect(written.status()).toBe(200)
      expect(object(await written.json()).status).toBe("ok")
      expect(discovered.status()).toBe(200)
      expect(object(await discovered.json()).status).toBe("ok")
      await target.getByText("Rascunho salvo. Ele pode ser incluído em uma escolha do caso antes da preparação.", { exact: true }).waitFor()
      expect(await target.getByLabel(/^Caso/).isEnabled()).toBe(true)
    })
    await save(page, panel, "draft.initial-save-and-discovery")
    const initial = await f.read((trusted) => f.decisions.drafts.list({ caseRef: initialCaseRef }, trusted))
    if (initial.status !== "ok" || initial.value.length !== 1) throw new Error("Initial draft unavailable")
    const first = await f.read((trusted) => f.decisions.drafts.readCurrent({ caseRef: initialCaseRef, draftRef: initial.value[0]!.draftRef }, trusted))
    if (first.status !== "ok") throw new Error("Initial draft identity unavailable")
    await panel.getByLabel(/^Caso/).selectOption({ label: "Review the action" })
    await panel.getByLabel(/^Rascunho/).selectOption({ label: "Initial shared draft" })

    const other = await context.newPage()
    other.on("pageerror", (error) => errors.push(error.message))
    observe(other, "concurrent")
    await other.goto(`${f.origin}/sucafina/dashboard?page=Hot+Topics+%26+Actions`)
    await other.locator("[data-dashboard-workbench-panel] > summary").click()
    const otherPanel = other.locator("[data-dashboard-workbench]")
    await otherPanel.getByRole("button", { name: "Carregar opções", exact: true }).click()
    await otherPanel.getByText("Opções carregadas.", { exact: false }).waitFor()
    await otherPanel.getByLabel(/^Caso/).selectOption({ label: "Review the action" })
    await otherPanel.getByLabel(/^Rascunho/).selectOption({ label: "Initial shared draft" })
    await panel.getByLabel("Ação", { exact: true }).fill("My retained action")
    await panel.getByLabel("Notas", { exact: true }).fill("My retained explanation")
    await otherPanel.getByLabel("Ação", { exact: true }).fill("Action saved in another tab")
    await save(other, otherPanel, "draft.concurrent-save-and-discovery")
    // A separate draft targets the same case and Hot Topic. Recovery must bind identity, not a matching target or title.
    await phase("draft.independent-select-case", async () => {
      const selected = otherPanel.getByLabel(/^Caso/)
      await selected.selectOption({ label: "Review the action" })
      expect(await selected.locator("option:checked").textContent()).toBe("Review the action")
    })
    await phase("draft.independent-select-new", async () => {
      const selected = otherPanel.getByLabel(/^Rascunho/)
      await selected.selectOption("new")
      expect(await selected.inputValue()).toBe("new")
    })
    await phase("draft.independent-select-source", async () => {
      const selected = otherPanel.getByLabel(/^Hot Topic de origem/)
      await selected.selectOption({ label: "Original action" })
      expect(await selected.locator("option:checked").textContent()).toBe("Original action")
    })
    await phase("draft.independent-edit-action", async () => {
      const action = otherPanel.getByLabel("Ação", { exact: true })
      await action.fill("Independent action draft")
      expect(await action.inputValue()).toBe("Independent action draft")
    })
    await save(other, otherPanel, "draft.independent-save-and-discovery")

    await phase("draft.stale-write-refused", async () => {
      const [conflict] = await Promise.all([
        page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).searchParams.get("sf") === "dashboard-hot-topic-draft"),
        panel.getByRole("button", { name: "Salvar rascunho", exact: true }).click(),
      ])
      expect(conflict.status()).toBe(409)
      await panel.getByText("O rascunho mudou.", { exact: false }).waitFor()
    })
    expect(await panel.getByLabel("Ação", { exact: true }).inputValue()).toBe("My retained action")
    expect(await panel.getByLabel("Notas", { exact: true }).inputValue()).toBe("My retained explanation")
    expect(await panel.getByRole("button", { name: "Salvar rascunho", exact: true }).isEnabled()).toBe(false)
    await phase("draft.reload-current-identity", async () => {
      const [discovered] = await Promise.all([
        page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).searchParams.get("sf") === "dashboard-workbench"),
        panel.getByRole("button", { name: "Carregar versão atual e manter minhas alterações", exact: true }).click(),
      ])
      expect(discovered.status()).toBe(200)
      expect(object(await discovered.json()).status).toBe("ok")
      await panel.getByText("Versão atual carregada. Compare as diferenças e confirme a base antes de salvar seus valores.", { exact: true }).waitFor()
    })
    const comparison = await panel.locator("[data-dashboard-draft-diff]").textContent()
    expect(comparison).toContain("Initial shared draft")
    expect(comparison).toContain("Action saved in another tab")
    expect(comparison).toContain("My retained action")
    expect(comparison).not.toContain("Independent action draft")
    expect(await panel.getByLabel("Notas", { exact: true }).inputValue()).toBe("My retained explanation")
    expect(await panel.getByRole("button", { name: "Salvar rascunho", exact: true }).isEnabled()).toBe(false)
    await panel.getByLabel("Revisei a versão atual do rascunho e quero manter meus valores.", { exact: true }).check()
    await save(page, panel, "draft.confirmed-save-and-discovery")
    const latest = await f.read((trusted) => f.decisions.drafts.list({ caseRef: initialCaseRef }, trusted))
    if (latest.status !== "ok") throw new Error("Current drafts unavailable")
    expect(latest.value).toHaveLength(2)
    const retained = latest.value.find((draft) => draft.label === "My retained action")
    if (!retained) throw new Error("Retained draft not saved")
    const saved = await f.read((trusted) => f.decisions.drafts.readCurrent({ caseRef: initialCaseRef, draftRef: retained.draftRef }, trusted))
    expect(saved.status === "ok" && saved.value).toMatchObject({ id: first.value.id, incarnation: first.value.incarnation, version: 3,
      fields: { action: "My retained action", notes: "My retained explanation", owner: "Operations", due: "2026-12-01" } })
    expect(latest.value.find((draft) => draft.label === "Independent action draft")?.version).toBe(1)
    expect(await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: rows(snapshot.data.hotTopics)[0]!.action }))).toBe("Original action")
    expect(errors).toEqual([])
  } catch (error) {
    failures.push(error)
    // Emit the Playwright call log before cleanup; a closing renderer must not
    // replace the original action failure with the outer Bun timeout.
    console.error("SF_WP02_DRAFT_CONFLICT_FAILURE", error)
    console.error("SF_WP02_DRAFT_CONFLICT_SERVER_TRACE", JSON.stringify(f.httpTrace))
  }
  finally {
    const closed = await Promise.allSettled([phase("browser.close", () => browserDriver.close()), phase("fixture.close", () => f.close())])
    for (const result of closed) if (result.status === "rejected") failures.push(result.reason)
  }
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1) throw new AggregateError(failures, "Dashboard draft conflict and cleanup failed")
  browserDriver.report()
}, 60000)

test("Dashboard discovery fences participant removal after options were assembled", async () => {
  const f = await fixture()
  try {
    const actions = f.authority.humanActions
    f.authority.humanActions = async (request) => {
      const value = await actions(request)
      const current = await f.authority.state.read(request, "cases", (state) => state.cases[initialCaseRef.id])
      if (current.status !== "ok" || !current.value) throw new Error("Case unavailable")
      const saved = await f.authority.state.transaction(request, { namespace: "cases", expectedStorageVersion: current.storageVersion,
        targetRef: initialCaseRef.id, targetIncarnation: initialCaseRef.incarnation, idempotencyKey: "withdraw-participation", commandDigest: digestSfValue({ withdraw: initialCaseRef }) }, async (state) => {
          const actual = state.cases[initialCaseRef.id]!
          state.cases[initialCaseRef.id] = { ...actual, version: actual.version + 1, participants: ["another-principal"] }
          return { commit: true, value: true }
        })
      expect(saved.status).toBe("ok")
      return value
    }
    const result = await f.read((context) => f.decisions.discover(context))
    expect(result).toMatchObject({ status: "stale", reason: "decision-discovery-changed" })
    expect(JSON.stringify(result)).not.toContain("Review the action")
    expect(JSON.stringify(result)).not.toContain(initialCaseRef.id)
  } finally { await f.close() }
})

test("Dashboard discovery resolves real ticket months and Executive signal records", async () => {
  const f = await fixture()
  try {
    await f.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.opsCats = ["Service Desk"]
      snapshot.data.opsTickets = [{ id: "november-tickets", year: 2026, month: 11, "Service Desk|Incidents|Open": 7 }]
      rows(snapshot.data.hotTopics)[0]!.due = "2026-10-01"
      return { commit: true, value: undefined }
    })
    const operations = await f.read((context) => f.dashboard.discover({ page: "IT Operations", period }, context))
    expect(operations.status).toBe("ok")
    if (operations.status !== "ok") return
    expect(operations.value.records).toHaveLength(1)
    expect(operations.value.records[0]!.label).toBe("Chamados · 2026-11")
    const ticket = await f.read((context) => f.records.read(operations.value.records[0]!.sourceRef, context))
    expect(ticket.status).toBe("ok")
    expect(ticket.status === "ok" && ticket.value.values.find((value) => value.id.endsWith(encodeURIComponent("Service Desk|Incidents|Open")))?.value).toBe(7)
    expect(ticket.status === "ok" && ticket.value.context.sourceRefs[0]?.fields).toEqual(["Service Desk|Incidents|Open", "month", "year"])
    if (!operations.value.agenda) throw new Error("Ticket agenda unavailable")
    const agenda = await f.read((context) => f.dashboard.agenda({ sections: [operations.value.agenda!.section] }, context))
    expect(agenda.status === "ok" && agenda.value.sections[0]?.projection.values.find((value) => value.id === "tickets:2026-11:Service Desk|Incidents|Closed")).toMatchObject({ value: null, evidenceState: "absent" })
    const executive = await f.read((context) => f.dashboard.discover({ page: "Executive Dashboard", period }, context))
    expect(executive.status).toBe("ok")
    if (executive.status !== "ok") return
    expect(executive.value.records.some((record) => record.label === "Original action")).toBe(true)
    const selected = executive.value.records.find((record) => record.label === "Original action")!
    const source = await f.read((context) => f.records.resolve(selected.sourceRef, context))
    expect(source).toMatchObject({ status: "ok", value: { target: { recordType: "hotTopics", recordId: "topic", fields: ["due", "status"] } } })
  } finally { await f.close() }
})

test("Dashboard contextual draft retains edits when current write authority is withdrawn", async () => {
  expectSpawn(import.meta.path)
  const f = await fixture()
  const browserDriver = await launchBrowserDriver("host-write-authority").catch(async (error) => { await f.close(); throw error })
  const browser = browserDriver.browser
  try {
    const page = await browser.newPage()
    await page.goto(`${f.origin}/sucafina/auth/local?code=${await f.identity.enroll()}`)
    await page.goto(`${f.origin}/sucafina/dashboard?page=Hot+Topics+%26+Actions`)
    await page.locator("[data-dashboard-workbench-panel] > summary").click()
    const panel = page.locator("[data-dashboard-workbench]")
    await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
    await panel.getByText("Opções carregadas.", { exact: false }).waitFor()
    await panel.getByLabel(/^Caso/).selectOption({ label: "Review the action" })
    await panel.getByLabel(/^Rascunho/).selectOption("new")
    await panel.getByLabel(/^Hot Topic de origem/).selectOption({ label: "Original action" })
    await panel.getByLabel("Ação", { exact: true }).fill("Unsaved operator wording")
    f.policy.writable = false
    await panel.getByRole("button", { name: "Salvar rascunho", exact: true }).click()
    await panel.getByText("Seu acesso não permite esta ação agora.", { exact: false }).waitFor()
    expect(await panel.getByLabel("Ação", { exact: true }).inputValue()).toBe("Unsaved operator wording")
    expect(await panel.locator("[data-dashboard-draft]").getAttribute("data-dirty")).toBe("true")
    await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
    await panel.getByText("Opções atualizadas. As alterações do formulário foram mantidas", { exact: false }).waitFor()
    expect(await panel.getByRole("button", { name: "Salvar rascunho", exact: true }).isEnabled()).toBe(false)
    expect(await panel.getByRole("button", { name: "Preservar retrato", exact: true }).isEnabled()).toBe(false)
    expect(await panel.getByLabel("Ação", { exact: true }).inputValue()).toBe("Unsaved operator wording")
    const state = await f.authority.state.read(f.request(), "preferences", (value) => Object.keys(value.preferences).filter((key) => key.startsWith("sf:proposal-coverage:hot-topic:")))
    expect(state.status === "ok" && state.value).toEqual([])
    const forged = await page.request.post(`${f.origin}/sucafina/dashboard?sf=dashboard-capture`, { headers: { origin: f.origin, "idempotency-key": "forged-after-withdrawal" }, data: { sourceRef: "not-a-grant" } })
    expect(forged.status()).toBe(403)
    expect(await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: rows(snapshot.data.hotTopics)[0]!.action }))).toBe("Original action")
  } finally { try { await browserDriver.close() } finally { await f.close() } }
  browserDriver.report()
}, 60000)
