import { expect, test } from "@playwright/test"
import type { Page, Response, TestInfo } from "@playwright/test"
import { Schema } from "effect"
import { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import { SfDomainPageCap03 } from "@orchestra/schema/sucafina/domain"
import { SfContextResult } from "@orchestra/schema/sucafina/context"
import { SfBiBiDataOutput, SfBiBiOptionsOutput } from "@orchestra/schema/sucafina/bi"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { release, tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { UiCorpusReceipt } from "../wp00/flows.ts"
import { qualifyWp10ExtendedUi } from "./extended-flows.ts"
import { prepareWp10ReviewRevocation } from "./review-revocation.ts"
import { connectInstalledShell, installedShellOrigin } from "../installed-shell"
import { readOperatorSessionCookie } from "../decisions-support/operator-session-cookie"
import { enterWorkbench } from "../decisions-support/journey"

const origin = installedShellOrigin()
const flowNames = ["dashboard-budget", "workbench-create-reopen", "procurement-requests", "bi-table", "extended-ui", "bi-revocation"] as const
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
      const prepared = yield* processService.run(ChildProcess.make("bun", [path.join(root, "packages/app-shell/e2e/sucafina/wp00/prepare-installation.ts"), directory, origin], { cwd: root, env: environment }), { timeout: "60 seconds" })
      logs.push(prepared.stdout.toString("utf8"), prepared.stderr.toString("utf8"))
      yield* Effect.promise(async () => {
        expect(prepared.exitCode, "WP00 installation preparation failed; see wp10-server.log").toBe(0)
        state.corpus = JSON.parse(await readFile(path.join(directory, "corpus-receipt.json"), "utf8")) as UiCorpusReceipt
        expect(state.corpus.schema).toBe("wp00-ui-corpus-v2")
        expect(state.corpus.authentication).toBe("local-operator")
        expect(state.corpus.counts).toEqual({ financialLines: 1000, purchaseOrders: 200, projects: 100 })
      })
      state.stage = "start-existing-cli"
      const server = yield* processService.spawn(ChildProcess.make("bun", ["run", path.join(root, "apps/cli/src/index.ts"), "serve", "--hostname", "localhost", "--port", "4110", "--public-origin", origin, "--installation", path.join(root, "modules/sucafina/Sucafinav1/local/entry.ts")], {
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
        let contextReadUrl: string | undefined
        page.on("response", (response) => {
          const target = new URL(response.url())
          if (response.request().method() === "GET" && target.origin === origin &&
              target.pathname === "/sucafina/api/ui/context") contextReadUrl = target.toString()
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
        const cookie = readOperatorSessionCookie(authenticated.headers, origin)
        await context.addCookies([cookie])
        const profile = JSON.parse(await readFile(environment.SUCAFINA_LOCAL_CONFIG!, "utf8")) as { localOperator: { installationId: string; uid: number } }
        await page.setViewportSize({ width: 1440, height: 900 })
        await connectInstalledShell(page, { root: directory, origin, mount: "/sucafina",
          actorId: `macos:${profile.localOperator.installationId}:${profile.localOperator.uid}` })
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
          const initial = page.waitForResponse((response) => response.request().method() === "GET" &&
            new URL(response.url()).pathname === "/sucafina/api/ui/pages/CAP03" &&
            new URL(response.url()).searchParams.get("year") === "2026")
          const opened = await page.goto(origin + "/orchestra/sf-dashboard/budget?year=2026")
          expect(opened?.status()).toBe(200)
          const initialResponse = await initial
          record.facts.openHttp = initialResponse.status()
          await nativeBody(initialResponse)
          await expect(page.getByRole("heading", { name: "Budget Overview", exact: true, level: 1 })).toBeVisible()
          state.authenticated = true
          const budget = page.locator('[data-sf-surface="CAP03"]')
          const year = budget.getByLabel("Year", { exact: true })
          await expect(year).toHaveValue("2026")
          const pendingYear = page.waitForResponse((response) => response.request().method() === "GET" &&
            new URL(response.url()).pathname === "/sucafina/api/ui/pages/CAP03" &&
            new URL(response.url()).searchParams.get("year") === "2027")
          await year.selectOption("2027")
          const changed = await pendingYear
          const projection = Schema.decodeUnknownSync(Schema.toType(SfDomainPageCap03.output))(await nativeBody(changed))
          if (projection.status !== "ok") throw new Error("The original CAP03 financial projection was unavailable")
          record.facts.filterHttp = changed.status()
          expect(projection.value.selection.year).toBe(2027)
          expect(projection.value.data.totals?.opexActual).toBe(1000)
          expect(projection.value.data.totals?.opexForecast).toBe(2000)
          expect(corpus.expected.actual2027).toBe("$1000")
          expect(corpus.expected.forecast2027).toBe("$2000")
          await expect(year).toHaveValue("2027")
          const opex = budget.getByRole("row").filter({ has: budget.getByRole("rowheader", { name: "OPEX", exact: true }) })
          // The native source declares no currency. Keep the exact amounts
          // without relabeling them as USD based on the old console's dollar glyph.
          await expect(opex.getByRole("cell").nth(1)).toHaveText("1,000")
          await expect(opex.getByRole("cell").nth(2)).toHaveText("2,000")
          await expect(budget.getByRole("img", { name: "Effective monthly budget", exact: true })).toBeVisible()
          const months = budget.getByRole("table").filter({ has: budget.getByRole("columnheader", { name: "Flat reference (annual allocations / 12)", exact: true }) })
          await expect(months.getByRole("row")).toHaveCount(13)
          expect(projection.value.data.budgetSeries?.effective).toHaveLength(12)
          expect(projection.value.data.budgetSeries?.flatReference).toHaveLength(12)
          record.facts.year = "2027"
          record.facts.actual = corpus.expected.actual2027
          record.facts.forecast = corpus.expected.forecast2027
          await capture(page, testInfo, record, "dashboard-budget-summary")
          await months.scrollIntoViewIfNeeded()
        })

        await observe("workbench-create-reopen", async (record) => {
          await enterWorkbench(page, origin)
          await page.getByRole("button", { name: "New case", exact: true }).click()
          const create = page.locator("section.sf-n24-create form")
          await expect(create).toHaveCount(1)
          const objective = "WP10 persisted composition decision"
          const criteria = ["Budget transparency", "Source traceability"]
          await create.getByLabel("Decision objective", { exact: true }).fill(objective)
          await create.getByLabel("Start", { exact: true }).fill("2027-01-01")
          await create.getByLabel("End", { exact: true }).fill("2027-12-31")
          await create.getByLabel("Currency", { exact: true }).fill("USD")
          await create.getByLabel("Criteria, one per line", { exact: true }).fill(criteria.join("\n"))
          let commands = 0
          const countCreate = (request: import("@playwright/test").Request) => {
            if (request.method() === "POST" && new URL(request.url()).searchParams.get("sf") === "workbench-command" &&
              request.postDataJSON()?.operation === "sf_case_draft") commands++
          }
          page.on("request", countCreate)
          await create.getByRole("button", { name: "Review creation", exact: true }).click()
          await expect(create.getByRole("group", { name: "Review creation", exact: true }).getByRole("listitem")).toHaveText(criteria)
          expect(commands).toBe(0)
          const pendingCreation = page.waitForResponse((response) => response.request().method() === "POST" &&
            new URL(response.url()).pathname === "/sucafina/dashboard" &&
            new URL(response.url()).searchParams.get("sf") === "workbench-command" &&
            response.request().postDataJSON()?.operation === "sf_case_draft")
          await create.getByRole("button", { name: "Confirm this decision creation", exact: true }).click()
          const response = await pendingCreation
          const result = await nativeBody(response)
          record.facts.commandHttp = response.status()
          record.facts.commandStatus = statusOf(result)
          record.facts.commandReason = reasonOf(result)
          if (!result || typeof result !== "object" || !("status" in result) || result.status !== "ok" ||
              !("outputRef" in result) || typeof result.outputRef !== "string" || !result.outputRef)
            throw new Error("sf_case_draft did not return its authoritative case reference")
          expect(response.request().postDataJSON()).toEqual({ operation: "sf_case_draft",
            input: { objective, horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", criteria, sourceRefs: [] } })
          expect(commands).toBe(1)
          const caseRef = result.outputRef
          record.facts.caseRefDigest = createHash("sha256").update(caseRef).digest("hex")
          const initialCase = page.waitForResponse((current) => current.request().method() === "GET" &&
            new URL(current.url()).pathname === "/sucafina/api/ui/projections/case" &&
            new URL(current.url()).searchParams.get("caseRef") === caseRef)
          await create.getByRole("link", { name: "Open decision", exact: true }).click()
          const created = Schema.decodeUnknownSync(Schema.toType(SfDecisions.operations["projection.case"].output))(await nativeBody(await initialCase))
          if (created.status !== "ok") throw new Error("The original case projection was unavailable")
          const originalCase = created.value.projection.case
          expect(originalCase).toMatchObject({ objective, version: 1, horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD" })
          expect(originalCase.criteria.map((criterion) => criterion.description)).toEqual(criteria)
          await expect(page.getByRole("heading", { name: "Case summary", exact: true, level: 1 })).toBeVisible()
          await expect(page.getByRole("region", { name: "Question", exact: true })).toContainText(objective)
          await expect(page.locator(".sf-n24-metadata")).toContainText("Current version: 1")
          await capture(page, testInfo, record, "workbench-created")
          const listed = page.waitForResponse((current) => current.request().method() === "GET" &&
            new URL(current.url()).pathname === "/sucafina/api/ui/projections/cases")
          await page.goto(origin + "/orchestra/sf-decisions")
          const list = Schema.decodeUnknownSync(Schema.toType(SfDecisions.operations["projection.cases"].output))(await nativeBody(await listed))
          if (list.status !== "ok") throw new Error("The fresh authorized case list was unavailable")
          const exactCases = list.value.cases.filter((entry) => entry.caseRef === caseRef)
          expect(exactCases).toHaveLength(1)
          expect(exactCases[0]).toMatchObject({ title: objective, version: 1 })
          const saved = page.locator(".sf-n24-record-list > li").filter({ hasText: objective })
          await expect(saved).toHaveCount(1)
          await expect(saved.locator("small")).toHaveText(caseRef)
          const link = saved.getByRole("link", { name: "Open decision", exact: true })
          const destination = new URL((await link.getAttribute("href"))!, page.url())
          expect(destination.origin).toBe(origin)
          expect(destination.pathname).toBe("/orchestra/sf-decisions/" + encodeSfRouteRef(caseRef))
          const pendingReopen = page.waitForResponse((current) => current.request().method() === "GET" &&
            new URL(current.url()).pathname === "/sucafina/api/ui/projections/case" &&
            new URL(current.url()).searchParams.get("caseRef") === caseRef)
          await link.click()
          const reopenedResponse = await pendingReopen
          const reopened = Schema.decodeUnknownSync(Schema.toType(SfDecisions.operations["projection.case"].output))(await nativeBody(reopenedResponse))
          if (reopened.status !== "ok") throw new Error("The fresh case read was unavailable")
          expect(reopened.value.projection.case).toEqual(originalCase)
          record.facts.reopenHttp = reopenedResponse.status()
          await expect(page.getByRole("region", { name: "Question", exact: true })).toContainText(objective)
          const metadata = page.locator(".sf-n24-metadata")
          await expect(metadata).toContainText("Current version: 1")
          await expect(metadata).toContainText("2027-01-01")
          await expect(metadata).toContainText("2027-12-31")
          await expect(metadata).toContainText("USD")
          const shownCriteria = page.getByRole("region", { name: "Criteria", exact: true }).getByRole("listitem")
          await expect(shownCriteria).toHaveCount(2)
          for (const [index, description] of criteria.entries()) await expect(shownCriteria.nth(index)).toContainText(description)
          expect(commands).toBe(1)
          page.off("request", countCreate)
          record.facts.objective = objective
          record.facts.createdVersion = 1
          record.facts.reopenedVersion = 1
          record.facts.persistenceObservation = "One original command, then fresh authorized native list and case projections"
        })

        await observe("procurement-requests", async (record) => {
          const response = await page.goto(origin + "/orchestra/sf-procurement/requests/" +
            encodeSfRouteRef(corpus.sourcing.requestId) + "/sourcing/compare")
          record.facts.openHttp = response?.status() ?? 0
          expect(response?.status()).toBe(200)
          const sourcing = page.locator(".sf-u12-root")
          try {
            await expect(sourcing.locator('p[data-request-summary="' + corpus.sourcing.requestId + '"]')).toContainText(corpus.sourcing.title)
          } catch (failure) {
            // Inspect the original context only after admission failed. Preserve
            // its actual selector URL; publish no identity, headers or cookies.
            if (contextReadUrl) {
              try {
                const diagnostic = await page.request.get(contextReadUrl)
                record.facts.contextHttp = diagnostic.status()
                const original = Schema.decodeUnknownSync(SfContextResult)(await diagnostic.json())
                record.facts.contextStatus = original.status
                if (original.status === "ok") {
                  record.facts.cap25Destinations = JSON.stringify(original.value.destinations
                    .filter((entry) => entry.capabilityId === "CAP25")
                    .map(({ capabilityId, canRead, allowedActionIds }) => ({ capabilityId, canRead, allowedActionIds })))
                  record.facts.cap25Availability = JSON.stringify(original.value.availability.filter((entry) => entry.resource === "CAP25"))
                }
              } catch {
                record.facts.contextDiagnostic = "Original context unavailable; original UI assertion retained"
              }
            }
            throw failure
          }
          await expect(sourcing.locator("header[data-source-version]")).toHaveAttribute("data-source-version", /^[1-9]\d*$/)
          const table = sourcing.getByRole("table", { name: "Quotations", exact: true })
          await expect(table.getByRole("columnheader")).toHaveText([
            "Supplier", "Eligibility", "Currency", "Stated total", "Base amount / FX", "Technical", "Price",
            "Commercial", "Overall", "Rank", "Excluded reason", "Quantity", "Unit price", "Technical scores", "Commercial scores", "Actions",
          ])
          await expect(table.getByRole("row")).toHaveCount(4)
          const a = table.locator("tbody tr").filter({ has: table.locator(".sf-s01-cell-value").filter({ hasText: /^Synthetic Supplier A$/ }) })
          const b = table.locator("tbody tr").filter({ has: table.locator(".sf-s01-cell-value").filter({ hasText: /^Synthetic Supplier B$/ }) })
          await expect(a.getByRole("cell", { name: "87.9", exact: true })).toBeVisible()
          await expect(b.getByRole("cell", { name: "85.0", exact: true })).toBeVisible()
          await expect(b.getByRole("cell", { name: "30240 USD (submitted FX: 1.08)", exact: true })).toBeVisible()
          // Quantity and unit price remain separate original inputs. The native
          // renderer deliberately does not multiply them into a browser subtotal.
          record.facts.requestId = corpus.sourcing.requestId
          record.facts.proposals = 3
          record.facts.source = "Published WP00 corpus through the existing store and native source-owned comparison facts"
          await table.scrollIntoViewIfNeeded()
        })

        let budgetBiSelection: string | undefined
        await observe("bi-table", async (record) => {
          const result = await openBudgetBi(page)
          budgetBiSelection = result.request.selectionRef
          record.facts.openHttp = 200
          record.facts.dataHttp = 200
          const panel = page.locator('[data-sf-catalog="UI46"]')
          expect(result.projection.context.surface).toBe("dashboard")
          expect(result.request.viewId).toBe("BI01")
          expect(result.request.period).toEqual({ start: "2027-01-01", end: "2027-12-31" })
          expect(result.projection.values).toHaveLength(48)
          await expect(panel.getByRole("heading", { name: "How do budget, actuals and outlook evolve?", exact: true }).first()).toBeVisible()
          const table = panel.getByRole("table", { name: "Authorized values and source references", exact: true })
          await expect(table.getByRole("columnheader")).toHaveText(["Measure", "Value", "Unit", "Period", "Granularity", "Evidence", "Source reference", "Show details"])
          await expect(table.getByRole("row")).toHaveCount(49)
          const values = new Map(result.projection.values.map((value) => [value.id, value]))
          const seriesRows = result.presentation.series.flatMap((series) => series.valueIds.map((id) => {
            const value = values.get(id)
            if (!value) throw new Error("The original presentation referenced an absent value")
            return { measure: series.label + " · " + value.id, granularity: value.granularity }
          }))
          expect(seriesRows).toHaveLength(36)
          const presentedIds = new Set(result.presentation.series.flatMap((series) => [...series.valueIds]))
          const basis = result.projection.values.filter((value) => !presentedIds.has(value.id))
          expect(basis.map((value) => value.id)).toEqual(Array.from({ length: 12 }, (_, index) =>
            "budget:2027-" + String(index + 1).padStart(2, "0") + ":basis"))
          const rows = [...seriesRows, ...basis.map((value) => ({ measure: value.id, granularity: value.granularity }))]
          expect(rows).toHaveLength(48)
          for (const [index, expected] of rows.entries()) {
            const cells = table.locator("tbody tr").nth(index).locator("td, th")
            await expect(cells.nth(0)).toHaveText(expected.measure)
            await expect(cells.nth(4)).toHaveText(expected.granularity)
          }
          for (const [index, value] of basis.entries()) {
            expect(typeof value.value).toBe("string")
            await expect(table.locator("tbody tr").nth(seriesRows.length + index).locator("td, th").nth(1))
              .toHaveText(String(value.value))
          }
          await expect(table.getByRole("cell").filter({ hasText: "budget:2027-01:effective" })).toHaveCount(1)
          const limitations = panel.locator(".sf-bi-limitations").getByRole("listitem")
          await expect(limitations).toHaveText(result.presentation.limitations)
          expect(result.presentation.limitations).toContain("Currency is unspecified in Dashboard; missing actual or forecast stays unknown.")
          record.facts.viewId = "BI01"
          record.facts.period = "2027-01-01/2027-12-31"
          record.facts.projectionRows = result.projection.values.length
          record.facts.dataStatus = "authorized-projection-rendered"
          record.facts.limitations = result.presentation.limitations
          const invalid = await context.request.get(origin + "/sucafina/dashboard?sf=bi-data&unexpected=1")
          const refused: unknown = await invalid.json()
          record.facts.invalidSelectionHttp = invalid.status()
          record.facts.invalidSelectionStatus = statusOf(refused)
          record.facts.invalidSelectionReason = reasonOf(refused)
          expect(invalid.status(), "The real host refuses an unsupported selection query").toBe(400)
          expect(statusOf(refused)).toBe("needs-input")
          expect(reasonOf(refused)).toBe("invalid-query")
          await table.scrollIntoViewIfNeeded()
        })

        let reviewRevocationUrl: string | undefined
        await observe("extended-ui", async (record) => {
          const facts = await qualifyWp10ExtendedUi({ page, origin, testInfo })
          Object.assign(record.facts, facts)
          if (typeof facts.reviewRevocationUrl === "string") reviewRevocationUrl = facts.reviewRevocationUrl
        })

        await observe("bi-revocation", async (record) => {
          if (!reviewRevocationUrl) throw new Error("A preserved review is required for the revocation proof")
          const reviewPrivacy = await prepareWp10ReviewRevocation({ context, url: reviewRevocationUrl, testInfo })
          try {
            if (!budgetBiSelection) throw new Error("The original BI01 selector is required for reload and revocation")
            await openBudgetBi(page, budgetBiSelection)
            const panel = page.locator('[data-sf-catalog="UI46"]')
            await expect(panel.getByRole("table", { name: "Authorized values and source references", exact: true })).toBeVisible()
            expect(await panel.locator('[data-sf-field="selection"] option').count()).toBeGreaterThan(1)
            const logout = await context.request.post(origin + "/sucafina/auth/logout", { headers: { origin } })
            record.facts.logoutHttp = logout.status()
            expect(logout.status()).toBe(204)
            const rejected = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-options")
            await panel.getByRole("button", { name: "Choose context", exact: true }).click()
            record.facts.recheckHttp = (await rejected).status()
            expect([401, 403]).toContain(record.facts.recheckHttp)
            await expect(panel).toContainText(/Sign in again to continue\.|You do not have access to this content\./)
            await expect(panel.getByRole("table")).toHaveCount(0)
            await expect(panel.locator('[data-sf-field="selection"] option, [data-sf-field="base-ref"] option, [data-sf-field="candidate-ref"] option')).toHaveCount(0)
            await expect(panel.getByRole("navigation", { name: "Authorized source links", exact: true }).getByRole("link")).toHaveCount(0)
            record.facts.privateProjectionRemoved = true
            record.facts.privateChoicesRemoved = true
            const deniedContext = page.waitForResponse((response) => new URL(response.url()).pathname === "/sucafina/api/ui/context" && response.status() === 401)
            await page.getByRole("button", { name: "Refresh access", exact: true }).click()
            expect((await deniedContext).status()).toBe(401)
            await expect(page.locator('[data-sf-f01="unauthenticated"]')).toBeVisible()
            const reviewStatuses = await reviewPrivacy.verifyAfterLogout()
            for (const [operation, status] of Object.entries(reviewStatuses)) record.facts[`review-${operation}-denied`] = status
            record.facts.reviewPrivateSectionsRemoved = true
            record.facts.reviewLateResponseDiscarded = true
          } finally { await reviewPrivacy.dispose() }
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

async function nativeBody(response: Response): Promise<unknown> {
  expect(response.status()).toBe(200)
  expect(await response.finished()).toBeNull()
  expect(response.request().failure()).toBeNull()
  return response.json()
}

async function openBudgetBi(page: Page, expectedSelection?: string) {
  if (expectedSelection !== undefined) {
    const reloaded = page.waitForResponse((response) => response.request().method() === "GET" &&
      new URL(response.url()).searchParams.get("sf") === "bi-data" &&
      new URL(response.url()).searchParams.get("viewId") === "BI01" &&
      new URL(response.url()).searchParams.get("selectionRef") === expectedSelection)
    await page.goto(origin + "/orchestra/sf-bi/" + encodeSfRouteRef("BI01"))
    const body = Schema.decodeUnknownSync(Schema.toType(SfBiBiDataOutput))(await nativeBody(await reloaded))
    if (!("request" in body)) throw new Error("Reload did not reauthorize the original BI01 selection")
    expect(body.request.selectionRef).toBe(expectedSelection)
    expect(body.request.period).toEqual({ start: "2027-01-01", end: "2027-12-31" })
    await expect(page.locator('[data-sf-field="selection"]')).toHaveValue(expectedSelection)
    return body
  }
  await page.goto(origin + "/orchestra/sf-bi/" + encodeSfRouteRef("BI01"))
  const panel = page.locator('[data-sf-catalog="UI46"]')
  await panel.locator('[data-sf-field="start"]').fill("2027-01-01")
  await panel.locator('[data-sf-field="end"]').fill("2027-12-31")
  const pendingOptions = page.waitForResponse((response) => response.request().method() === "GET" &&
    new URL(response.url()).searchParams.get("sf") === "bi-options")
  await panel.getByRole("button", { name: "Choose context", exact: true }).click()
  const options = Schema.decodeUnknownSync(Schema.toType(SfBiBiOptionsOutput))(await nativeBody(await pendingOptions))
  if (options.status !== "ok") throw new Error("The original BI01 catalog was unavailable")
  expect(options.value.choices).toHaveLength(1)
  const selection = panel.locator('[data-sf-field="selection"]')
  await expect(selection).toHaveValue("")
  await selection.selectOption(options.value.choices[0]!.selectionRef)
  const pendingData = page.waitForResponse((response) => response.request().method() === "GET" &&
    new URL(response.url()).searchParams.get("sf") === "bi-data" &&
    new URL(response.url()).searchParams.get("viewId") === "BI01")
  await panel.locator('[data-sf-action="view-data"]').click()
  const result = Schema.decodeUnknownSync(Schema.toType(SfBiBiDataOutput))(await nativeBody(await pendingData))
  if (!("request" in result)) throw new Error("BI01 did not return its authorized original projection")
  expect(result.request.selectionRef).toBe(options.value.choices[0]!.selectionRef)
  return result
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
  if (url.origin !== origin) return undefined
  const api = ["/sucafina/dashboard", "/sucafina/planner", "/sucafina/procurement", "/sucafina/status"].includes(url.pathname) ||
    /^\/sucafina\/api\/ui\/(?:context|pages\/CAP\d+|projections\/(?:case|cases|review))$/.test(url.pathname)
  const chapter = /^\/orchestra\/sf-(?:dashboard|planner|procurement|bi|decisions|reviews)(?:\/|$)/.test(url.pathname)
  if (!api && !chapter) return undefined
  const query = new URLSearchParams()
  for (const key of ["sf", "page", "year", "viewId", "start", "end"]) {
    const selected = url.searchParams.get(key)
    if (selected !== null) query.set(key, selected)
  }
  return url.pathname.replace(/\/r_[^/]+/g, "/:ref") + (query.size ? "?" + query.toString() : "")
}

function redact(value: string) {
  return value.replace(/([?&](?:code|token|access_token|refresh_token|secret|ticket)=)[^&\s"'<>]+/gi, "$1[redacted]")
    .replace(/sucafina_operator_[a-f0-9]{24}=[a-f0-9]{64}/gi, "[local-operator-cookie-redacted]")
    .replace(/\b(Bearer)\s+[^\s"'<>]+/gi, "$1 [redacted]")
    .replace(/^(\s*(?:authorization|cookie|set-cookie)\s*:).*$/gim, "$1 [redacted]")
}
