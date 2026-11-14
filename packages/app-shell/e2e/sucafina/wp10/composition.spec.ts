import { expect, test } from "@playwright/test"
import type { Page, TestInfo } from "@playwright/test"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { release, tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { UiCorpusReceipt } from "../wp00/flows.ts"

const origin = "http://localhost:4110"
const flowNames = ["dashboard-budget", "workbench-create-reopen", "procurement-requests", "bi-table"] as const
type Flow = typeof flowNames[number]
type Observation = {
  flow: Flow
  outcome: "not-reached" | "passed" | "failed"
  failure: string | null
  screenshots: string[]
  facts: Record<string, string | number | boolean | readonly string[]>
  layout?: { viewport: { width: number; height: number }; document: { width: number; scrollWidth: number }; main: { width: number; scrollWidth: number } | null }
}

test.describe.configure({ timeout: 480000, retries: 0 })

test("WP10 composes Dashboard, persisted Workbench decisions, Requests and BI through the real installation", async ({}, testInfo) => {
  expect(process.env.GITHUB_ACTIONS, "This real installation qualification runs only in hosted CI").toBe("true")
  expect(process.platform, "The published WP00 local provider uses the selected Linux runner").toBe("linux")
  expect(process.env.GITHUB_SHA).toMatch(/^[a-f0-9]{40}$/)
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..")
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "wp10-composition-"))
  const startedAt = new Date().toISOString()
  const observations: Observation[] = flowNames.map((flow) => ({ flow, outcome: "not-reached", failure: null, screenshots: [], facts: {} }))
  const logs: string[] = []
  const browserEvents: { kind: string; message: string }[] = []
  const http: { method: string; route: string; status: number }[] = []
  const state = {
    stage: "prepare", exitCode: null as number | null, failure: null as string | null,
    corpus: null as UiCorpusReceipt | null, productSha: null as string | null,
    authenticated: false, browserVersion: null as string | null,
  }
  let processCounters: (() => { spawns: number; delegations: number }) | null = null
  try {
    await mkdir(path.join(directory, "host-tmp"), { mode: 0o700 })
    // Imports with process services stay inside the test, so discovery starts no installation.
    const { Effect, Stream } = await import("effect")
    const { ChildProcess } = await import("effect/unstable/process")
    const { AppProcess } = await import("@orchestra/core/process")
    const { LayerNode } = await import("@orchestra/core/effect/layer-node")
    const { Omni } = await import("@orchestra/core/omni")
    const { scopedWp00Browser } = await import("../wp00/browser.ts")
    const before = Omni.snapshot()
    processCounters = () => {
      const after = Omni.snapshot()
      return { spawns: after.spawns - before.spawns, delegations: after.delegations - before.delegations }
    }
    const environment = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] =>
      entry[1] !== undefined && !["ORCHESTRA_SERVER_PASSWORD", "ORCHESTRA_SERVER_USERNAME", "ORCHESTRA_CONFIG", "ORCHESTRA_CONFIG_CONTENT"].includes(entry[0])))
    Object.assign(environment, {
      XDG_DATA_HOME: path.join(directory, "host-data"), XDG_CONFIG_HOME: path.join(directory, "host-config"),
      XDG_CACHE_HOME: path.join(directory, "host-cache"), XDG_STATE_HOME: path.join(directory, "host-state"),
      ORCHESTRA_CONFIG_DIR: path.join(directory, "host-config"), ORCHESTRA_INHERIT_CREDENTIALS: "0",
      ORCHESTRA_DISABLE_PROJECT_CONFIG: "1", ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(directory, "host-credential.key"),
      TMPDIR: path.join(directory, "host-tmp"), ORCHESTRA_DB: path.join(directory, "host-data", "orchestra.db"),
      SUCAFINA_LOCAL_CONFIG: path.join(directory, "installation.json"),
    })
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const processService = yield* AppProcess.Service
      // A test-ci snapshot is shallow: its raw commit, rather than HEAD^ lookup, binds the parent.
      const revisions = yield* processService.run(ChildProcess.make("git", ["cat-file", "-p", "HEAD"], { cwd: root }), { timeout: "10 seconds" })
      if (revisions.exitCode !== 0) throw new Error("Cannot read the hosted snapshot commit")
      const snapshot = createHash("sha1").update(`commit ${revisions.stdout.byteLength}\0`).update(revisions.stdout).digest("hex")
      const product = /^parent ([a-f0-9]{40})$/m.exec(revisions.stdout.toString("utf8"))?.[1]
      if (snapshot !== process.env.GITHUB_SHA || !product) throw new Error("Cannot bind this observation to its test-ci snapshot and product parent")
      state.productSha = product
      const prepared = yield* processService.run(ChildProcess.make("bun", [path.join(root, "packages/app-shell/e2e/sucafina/wp00/prepare-installation.ts"), directory], { cwd: root, env: environment }), { timeout: "60 seconds" })
      logs.push(prepared.stdout.toString("utf8"), prepared.stderr.toString("utf8"))
      yield* Effect.promise(async () => {
        expect(prepared.exitCode, "WP00 installation preparation failed; see wp10-server.log").toBe(0)
        state.corpus = JSON.parse(await readFile(path.join(directory, "corpus-receipt.json"), "utf8")) as UiCorpusReceipt
        expect(state.corpus.schema).toBe("wp00-ui-corpus-v2")
        expect(state.corpus.authentication).toBe("local-operator")
        expect(state.corpus.counts).toEqual({ financialLines: 1000, purchaseOrders: 200, projects: 100 })
      })
      state.stage = "start-existing-cli"
      const server = yield* processService.spawn(ChildProcess.make("bun", ["run", path.join(root, "apps/cli/src/index.ts"), "serve", "--hostname", "localhost", "--port", "4110", "--installation", path.join(root, "modules/sucafina/Sucafinav1/local/entry.ts")], {
        cwd: directory, env: environment, stdin: "ignore", stdout: "pipe", stderr: "pipe",
      }))
      yield* Effect.forkScoped(Stream.runForEach(server.stdout, (chunk) => Effect.sync(() => logs.push(Buffer.from(chunk).toString("utf8")))))
      yield* Effect.forkScoped(Stream.runForEach(server.stderr, (chunk) => Effect.sync(() => logs.push(Buffer.from(chunk).toString("utf8")))))
      yield* Effect.forkScoped(server.exitCode.pipe(Effect.tap((code) => Effect.sync(() => { state.exitCode = Number(code) }))))
      yield* Effect.promise(async () => {
        const ready = { value: "waiting" }
        await expect.poll(async () => {
          if (state.exitCode !== null) return ready.value = `exited:${state.exitCode}`
          const response = await fetch(origin + "/sucafina/status", { signal: AbortSignal.timeout(10000) }).catch(() => undefined)
          if (!response?.ok) return "waiting"
          const status: unknown = await response.json()
          if (!status || typeof status !== "object" || !("login" in status) || status.login !== "local-operator") return "waiting"
          return ready.value = "ready"
        }, { timeout: 120000, message: "The actual serve process must expose its local-operator installation" }).not.toBe("waiting")
        expect(ready.value, "serve exited before readiness; see wp10-server.log").toBe("ready")
      })
      state.stage = "start-isolated-browser"
      const { browser, context, page } = yield* scopedWp00Browser(directory)
      state.browserVersion = browser.version()
      yield* Effect.promise(async (signal) => {
        // No trace, HAR, storage-state, request headers or enrollment URL is exported.
        page.on("console", (message) => {
          if ((message.type() === "error" || message.type() === "warning") && browserEvents.length < 200) browserEvents.push({ kind: message.type(), message: redact(message.text()) })
        })
        page.on("pageerror", (error) => { if (browserEvents.length < 200) browserEvents.push({ kind: "pageerror", message: redact(error.message) }) })
        page.on("response", (response) => {
          const route = safeRoute(response.url())
          if (route && http.length < 500 && ["document", "fetch", "xhr"].includes(response.request().resourceType())) http.push({ method: response.request().method(), route, status: response.status() })
        })
        page.on("requestfailed", (request) => {
          const route = safeRoute(request.url())
          if (route && browserEvents.length < 200) browserEvents.push({ kind: "requestfailed", message: `${request.method()} ${route}: ${redact(request.failure()?.errorText ?? "unknown")}` })
        })
        state.stage = "authenticate-existing-operator"
        const artifact = await readFile(path.join(directory, "open-local.html"), "utf8")
        const encoded = /location\.replace\(("[^\n]+")\)<\/script>/.exec(artifact)?.[1]
        if (!encoded) throw new Error("Local enrollment artifact was not generated")
        let enrollment: unknown
        try { enrollment = JSON.parse(encoded) } catch { throw new Error("Local enrollment artifact contains invalid JSON") }
        if (typeof enrollment !== "string" || !enrollment.startsWith(origin + "/sucafina/auth/local?code=")) throw new Error("Invalid local enrollment destination")
        const authenticated = await fetch(enrollment, { redirect: "manual", signal: AbortSignal.timeout(10000) }).catch(() => { throw new Error("Local enrollment request failed") })
        expect(authenticated.status).toBe(303)
        const cookie = /^(sucafina_operator_[a-f0-9]{24})=([a-f0-9]{64}); Path=(\/sucafina);/.exec(authenticated.headers.get("set-cookie") ?? "")
        if (!cookie) throw new Error("Local enrollment did not issue the expected scoped operator cookie")
        await context.addCookies([{ name: cookie[1]!, value: cookie[2]!, domain: "localhost", path: cookie[3]!, httpOnly: true, secure: false, sameSite: "Lax" }])
        await page.setViewportSize({ width: 1440, height: 900 })
        const corpus = state.corpus
        if (!corpus) throw new Error("Published synthetic corpus receipt is missing")

        const observe = async (flow: Flow, action: (record: Observation) => Promise<void>) => {
          signal.throwIfAborted()
          const record = observations.find((entry) => entry.flow === flow)!
          state.stage = flow
          try {
            await test.step(flow, async () => {
              await action(record)
              await capture(page, testInfo, record, flow)
              record.outcome = "passed"
            })
          } catch (error) {
            record.outcome = "failed"
            record.failure = redact(error instanceof Error ? error.message : String(error))
            await capture(page, testInfo, record, flow + "-failed").catch((failure: unknown) => {
              record.facts.evidenceFailure = redact(failure instanceof Error ? failure.message : String(failure))
            })
            signal.throwIfAborted()
          }
        }

        await observe("dashboard-budget", async (record) => {
          const opened = await page.goto(origin + "/sucafina/dashboard?page=Budget+Overview&year=2026")
          record.facts.openHttp = opened?.status() ?? 0
          expect(opened?.status()).toBe(200)
          await expect(page.getByRole("heading", { name: "Budget Overview", exact: true, level: 1 })).toBeVisible()
          state.authenticated = true
          const year = page.getByRole("combobox", { name: "FY", exact: true })
          await expect(year).toHaveValue("2026")
          const [changed] = await Promise.all([
            page.waitForResponse((response) => response.request().method() === "GET" && new URL(response.url()).pathname === "/sucafina/dashboard" && new URL(response.url()).searchParams.get("year") === "2027"),
            year.selectOption("2027"),
          ])
          record.facts.filterHttp = changed.status()
          expect(record.facts.filterHttp).toBe(200)
          await expect(year).toHaveValue("2027")
          const opex = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "OPEX", exact: true }) })
          await expect(opex.getByRole("cell", { name: corpus.expected.actual2027, exact: true })).toBeVisible()
          await expect(opex.getByRole("cell", { name: corpus.expected.forecast2027, exact: true })).toBeVisible()
          await expect(page.getByRole("img", { name: "Effective monthly budget", exact: true })).toBeVisible()
          const months = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Flat reference (annual allocations / 12)", exact: true }) })
          await expect(months.getByRole("row")).toHaveCount(13)
          record.facts.year = "2027"
          record.facts.actual = corpus.expected.actual2027
          record.facts.forecast = corpus.expected.forecast2027
          await capture(page, testInfo, record, "dashboard-budget-summary")
          await months.scrollIntoViewIfNeeded()
        })

        await observe("workbench-create-reopen", async (record) => {
          expect((await page.goto(origin + "/sucafina/dashboard?page=Budget+Overview&year=2027"))?.status()).toBe(200)
          await openWorkbench(page)
          const create = page.locator("details").filter({ has: page.locator("summary").filter({ hasText: /^Create a decision$/ }) })
          await expect(create).toHaveCount(1)
          await create.locator("summary").click()
          const form = create.locator("form[data-decision-create]")
          const objective = "WP10 persisted composition decision"
          await form.getByRole("textbox", { name: "Decision objective", exact: true }).fill(objective)
          await form.getByLabel("Start", { exact: true }).fill("2027-01-01")
          await form.getByLabel("End", { exact: true }).fill("2027-12-31")
          await form.getByRole("textbox", { name: "Currency", exact: true }).fill("USD")
          await form.getByRole("textbox", { name: "Criteria, one per line", exact: true }).fill("Budget transparency\nSource traceability")
          // Submit once. An uncertain/refused command is evidence of failure, never a reason to retry creation.
          const [response] = await Promise.all([
            page.waitForResponse((current) => current.request().method() === "POST" && new URL(current.url()).pathname === "/sucafina/dashboard" && new URL(current.url()).searchParams.get("sf") === "workbench-command"),
            form.getByRole("button", { name: "Create decision", exact: true }).click(),
          ])
          const result: unknown = await response.json()
          record.facts.commandHttp = response.status()
          record.facts.commandStatus = statusOf(result)
          record.facts.commandReason = reasonOf(result)
          if (response.status() !== 200 || !result || typeof result !== "object" || !("status" in result) || result.status !== "ok" || !("outputRef" in result) || typeof result.outputRef !== "string" || !result.outputRef) {
            throw new Error(`sf_case_draft did not confirm creation: HTTP ${response.status()}, ${statusOf(result)}, ${reasonOf(result)}`)
          }
          const caseRef = result.outputRef
          record.facts.caseRefDigest = createHash("sha256").update(caseRef).digest("hex")
          const decision = page.getByRole("region", { name: "Decision", exact: true })
          await expect(decision.getByRole("heading", { name: objective, exact: true, level: 2 })).toBeVisible({ timeout: 30000 })
          await expect(decision.locator("header")).toContainText("Version 1")
          await capture(page, testInfo, record, "workbench-created")
          // Leave the DOM and discover the exact saved case in a newly authorized server rendering.
          expect((await page.goto(origin + "/sucafina/dashboard?page=Budget+Overview&year=2027"))?.status()).toBe(200)
          await openWorkbench(page)
          const saved = page.getByRole("link", { name: objective, exact: true })
          await expect(saved).toHaveCount(1)
          await expect(saved).toBeVisible()
          const href = await saved.getAttribute("href")
          if (!href) throw new Error("Persisted decision has no reopen destination")
          const destination = new URL(href, page.url())
          expect(destination.origin).toBe(origin)
          expect(destination.pathname).toBe("/sucafina/dashboard")
          expect(destination.searchParams.get("sf")).toBe("workbench-case")
          expect(createHash("sha256").update(destination.searchParams.get("caseRef") ?? "").digest("hex")).toBe(record.facts.caseRefDigest)
          const [reopened] = await Promise.all([
            page.waitForResponse((current) => current.request().method() === "GET" && current.url() === destination.href),
            saved.click(),
          ])
          record.facts.reopenHttp = reopened.status()
          expect(record.facts.reopenHttp).toBe(200)
          await expect(decision.getByRole("heading", { name: objective, exact: true, level: 2 })).toBeVisible()
          await expect(decision.locator("header")).toContainText("Version 1")
          await expect(decision.locator("header")).toContainText("2027-01-01 – 2027-12-31 · USD")
          await expect(decision.getByRole("listitem").filter({ hasText: /^Budget transparency(?: \(required\))?$/ })).toBeVisible()
          await expect(decision.getByRole("listitem").filter({ hasText: /^Source traceability(?: \(required\))?$/ })).toBeVisible()
          record.facts.objective = objective
          record.facts.createdVersion = 1
          record.facts.reopenedVersion = 1
          record.facts.persistenceObservation = "Authorized command followed by fresh list and case HTTP reads; server remains running"
        })

        await observe("procurement-requests", async (record) => {
          const response = await page.goto(origin + "/sucafina/procurement?page=Requests&q=" + encodeURIComponent(corpus.sourcing.title))
          record.facts.openHttp = response?.status() ?? 0
          expect(response?.status()).toBe(200)
          await expect(page.getByRole("heading", { name: "Requests", exact: true, level: 1 })).toBeVisible()
          const request = page.locator("details").filter({ has: page.locator("summary").filter({ hasText: corpus.sourcing.requestId + " · " + corpus.sourcing.title }) })
          await expect(request).toHaveCount(1)
          if (!await request.evaluate((element) => element.hasAttribute("open"))) await request.locator("summary").click()
          const table = request.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Proposal", exact: true }) })
          await expect(table.getByRole("columnheader")).toHaveText(["Proposal", "Stated total", "Quantity × unit price", "Base amount / FX", "Technical", "Price", "Commercial", "Overall", "Rank"])
          await expect(table.getByRole("row")).toHaveCount(4)
          const a = table.getByRole("row").filter({ has: page.getByRole("cell", { name: "Synthetic Supplier A", exact: true }) })
          const b = table.getByRole("row").filter({ has: page.getByRole("cell", { name: "Synthetic Supplier B", exact: true }) })
          await expect(a.getByRole("cell", { name: "87.9", exact: true })).toBeVisible()
          await expect(b.getByRole("cell", { name: "85.0", exact: true })).toBeVisible()
          await expect(b.getByRole("cell", { name: "30240 USD (submitted FX: 1.08)", exact: true })).toBeVisible()
          record.facts.requestId = corpus.sourcing.requestId
          record.facts.proposals = 3
          record.facts.source = "Published WP00 corpus through the existing local store and Procurement renderer"
          await table.scrollIntoViewIfNeeded()
        })

        await observe("bi-table", async (record) => {
          expect((await page.goto(origin + "/sucafina/dashboard?page=Budget+Overview&year=2027"))?.status()).toBe(200)
          const navigation = page.getByRole("navigation", { name: "Business analysis", exact: true })
          const [opened] = await Promise.all([
            page.waitForResponse((response) => response.request().method() === "GET" && new URL(response.url()).pathname === "/sucafina/dashboard" && new URL(response.url()).searchParams.get("sf") === "bi"),
            navigation.getByRole("link", { name: "Business intelligence", exact: true }).click(),
          ])
          record.facts.openHttp = opened.status()
          expect(record.facts.openHttp).toBe(200)
          await expect(page.getByRole("heading", { name: "Business intelligence", exact: true, level: 1 })).toBeVisible()
          const panel = page.locator("[data-sf-bi]")
          const update = panel.getByRole("button", { name: "Atualizar visualização", exact: true })
          await expect(update).toBeEnabled({ timeout: 30000 })
          await panel.getByRole("combobox", { name: "Visualização", exact: true }).selectOption("BI01")
          await panel.getByLabel("Início", { exact: true }).fill("2027-01-01")
          await panel.getByLabel("Fim", { exact: true }).fill("2027-12-31")
          const [response] = await Promise.all([
            page.waitForResponse((current) => {
              const url = new URL(current.url())
              return current.request().method() === "GET" && url.pathname === "/sucafina/dashboard" && url.searchParams.get("sf") === "bi-data" && url.searchParams.get("viewId") === "BI01" && url.searchParams.get("start") === "2027-01-01" && url.searchParams.get("end") === "2027-12-31"
            }),
            update.click(),
          ])
          const result: unknown = await response.json()
          record.facts.dataHttp = response.status()
          record.facts.dataStatus = statusOf(result)
          record.facts.dataReason = reasonOf(result)
          if (response.status() !== 200 || !result || typeof result !== "object" || !("projection" in result) || !result.projection || typeof result.projection !== "object" || !("values" in result.projection) || !Array.isArray(result.projection.values)) {
            throw new Error(`BI01 did not return its authorized projection: HTTP ${response.status()}, ${statusOf(result)}, ${reasonOf(result)}`)
          }
          // The producer emits basis, effective, actual and forecast for each month. Unknown values stay visible.
          expect(result.projection.values.length).toBe(48)
          await expect(panel.getByRole("status").filter({ hasText: /^Dados atualizados\.$/ })).toBeVisible()
          await expect(panel.getByRole("heading", { name: "Como orçamento, realizado e outlook evoluem?", exact: true, level: 2 })).toBeVisible()
          const table = panel.getByRole("table", { name: "Dados e referências", exact: true })
          await expect(table.getByRole("columnheader")).toHaveText(["Medida", "Valor", "Unidade", "Período", "Granularidade", "Evidência", "Origem"])
          await expect(table.getByRole("row")).toHaveCount(49)
          await expect(table.getByRole("cell", { name: "budget:2027-01:effective", exact: true })).toBeVisible()
          await expect(panel.getByRole("list", { name: "Limitações da visualização", exact: true })).toContainText("Currency is unspecified in Dashboard; missing actual or forecast stays unknown.")
          record.facts.viewId = "BI01"
          record.facts.period = "2027-01-01/2027-12-31"
          record.facts.projectionRows = result.projection.values.length
          record.facts.dataStatus = "authorized-projection-rendered"
          record.facts.limitations = await panel.getByRole("list", { name: "Limitações da visualização", exact: true }).getByRole("listitem").allTextContents()
          const invalid = await context.request.get(origin + "/sucafina/dashboard?sf=bi-data&unexpected=1")
          const refused: unknown = await invalid.json()
          record.facts.invalidSelectionHttp = invalid.status()
          record.facts.invalidSelectionStatus = statusOf(refused)
          record.facts.invalidSelectionReason = reasonOf(refused)
          expect(invalid.status(), "The real host must refuse an unsupported selection query").toBe(400)
          expect(statusOf(refused)).toBe("needs-input")
          expect(reasonOf(refused)).toBe("invalid-query")
          await table.scrollIntoViewIfNeeded()
        })

        const failed = observations.filter((record) => record.outcome !== "passed")
        if (failed.length) throw new Error("WP10 composition failed: " + failed.map((record) => `${record.flow}: ${record.failure ?? record.outcome}`).join("\n"))
        state.stage = "completed"
      })
    })).pipe(Effect.provide(LayerNode.compile(AppProcess.node))), { signal: AbortSignal.timeout(7 * 60000) })
    const counters = processCounters()
    expect(counters.spawns, "Revision, seed, serve and Chromium must use AppProcess/Omni").toBeGreaterThanOrEqual(4)
    expect(counters.delegations).toBe(0)
  } catch (error) {
    state.failure = redact(error instanceof Error ? error.message : String(error))
    throw new Error(state.failure)
  } finally {
    try {
      await mkdir(testInfo.outputDir, { recursive: true })
      await writeFile(testInfo.outputPath("wp10-server.log"), redact(logs.join("")))
      await testInfo.attach("wp10-server", { path: testInfo.outputPath("wp10-server.log"), contentType: "text/plain" })
      await testInfo.attach("wp10-composition-observations", { body: JSON.stringify({
        schema: "wp10-real-composition-v1", executedSnapshotCommit: process.env.GITHUB_SHA, productCommit: state.productSha,
        workflowRunId: process.env.GITHUB_RUN_ID, workflowRunAttempt: process.env.GITHUB_RUN_ATTEMPT, startedAt,
        stage: state.stage, failure: state.failure, authenticated: state.authenticated, serverExitCode: state.exitCode,
        environment: { operatingSystem: `${process.platform} ${release()}`, browserVersion: state.browserVersion, runtimeVersion: state.corpus?.runtimeVersion,
          datasetDigest: state.corpus?.datasetDigest, counts: state.corpus?.counts, provider: state.corpus?.provider, viewport: { width: 1440, height: 900 } },
        observations, http, browserEvents,
        processObservation: processCounters ? { ...processCounters(), control: "Playwright scoped Omni counters; not the Bun canonical control" } : null,
        limits: ["Local operator and synthetic published corpus only", "Decision reopens through fresh authorized HTTP reads; no server restart or recovery qualification", "A visible BI table preserves missing/estimated values and producer limitations; it is not a completeness verdict", "Viewport dimensions and screenshots are observations, not the WP00 zoom/performance matrix", "No native AI, global epic, Microsoft identity or independent review acceptance"],
      }, null, 2), contentType: "application/json" })
    } finally { await rm(directory, { recursive: true, force: true }) }
  }
})

async function openWorkbench(page: Page) {
  const [opened] = await Promise.all([
    page.waitForResponse((response) => response.request().method() === "GET" && new URL(response.url()).pathname === "/sucafina/dashboard" && new URL(response.url()).searchParams.get("sf") === "workbench"),
    page.getByRole("link", { name: "Workbench", exact: true }).click(),
  ])
  expect(opened.status(), "The actual Workbench route must be available").toBe(200)
  await expect(page.getByRole("heading", { name: "Workbench", exact: true, level: 1 })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Decisions", exact: true, level: 2 })).toBeVisible()
}

async function capture(page: Page, testInfo: TestInfo, record: Observation, name: string) {
  if (page.isClosed()) throw new Error("Browser closed before its evidence could be captured")
  record.layout = await page.evaluate(() => {
    const main = document.querySelector("main")
    return { viewport: { width: innerWidth, height: innerHeight }, document: { width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }, main: main ? { width: main.clientWidth, scrollWidth: main.scrollWidth } : null }
  })
  record.facts.renderedRoute = safeRoute(page.url()) ?? "unrecognized"
  // A viewport screenshot preserves the actual desktop layout rather than shrinking a long table to one image.
  const file = name + ".png"
  await page.screenshot({ path: testInfo.outputPath(file), fullPage: false })
  await testInfo.attach(file, { path: testInfo.outputPath(file), contentType: "image/png" })
  record.screenshots.push(file)
}

function statusOf(value: unknown) {
  return value && typeof value === "object" && "status" in value && typeof value.status === "string" ? redact(value.status) : "not-declared"
}

function reasonOf(value: unknown) {
  return value && typeof value === "object" && "reason" in value && typeof value.reason === "string" ? redact(value.reason) : "not-declared"
}

function safeRoute(value: string) {
  const url = new URL(value)
  if (url.origin !== origin || !["/sucafina/dashboard", "/sucafina/planner", "/sucafina/procurement", "/sucafina/status"].includes(url.pathname)) return undefined
  const query = new URLSearchParams()
  for (const key of ["sf", "page", "year", "viewId", "start", "end"]) {
    const selected = url.searchParams.get(key)
    if (selected !== null) query.set(key, selected)
  }
  return url.pathname + (query.size ? "?" + query.toString() : "")
}

function redact(value: string) {
  return value.replace(/([?&](?:code|token|access_token|refresh_token|secret|ticket)=)[^&\s"'<>]+/gi, "$1[redacted]")
    .replace(/sucafina_operator_[a-f0-9]{24}=[a-f0-9]{64}/gi, "[local-operator-cookie-redacted]")
    .replace(/\b(Bearer)\s+[^\s"'<>]+/gi, "$1 [redacted]")
    .replace(/^(\s*(?:authorization|cookie|set-cookie)\s*:).*$/gim, "$1 [redacted]")
}
