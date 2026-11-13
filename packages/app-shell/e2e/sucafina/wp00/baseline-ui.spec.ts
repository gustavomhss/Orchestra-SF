import { expect, test } from "@playwright/test"
import type { Page, TestInfo } from "@playwright/test"
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { release, tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

type Observation = {
  flow: string; repetition: number; viewportWidth: number; viewportHeight: number; zoomPercent: number
  startedAt: string; visualReadyMs: number | null; completionMs: number | null
  outcome: "passed" | "failed"; failureReason: string | null; resultEvidenceRef: string | null
}
type CorpusReceipt = {
  schema: string; datasetDigest: string; counts: { financialLines: number; purchaseOrders: number; projects: number }
  expected: { actual2027: string; forecast2027: string; openRequests: number; firstRequest: string; firstAmount: string; lastRequest: string; lastAmount: string }
  runtimeVersion: string; authentication: string; provider: string
}

test.describe.configure({ timeout: 600000, retries: 0 })

test("WP00 observes real local installation, volume consumers and comparable UI repetitions", async ({ page, browser }, testInfo) => {
  expect(process.env.GITHUB_ACTIONS, "Qualification must run in GitHub Actions").toBe("true")
  expect(process.platform, "The isolated local provider requires the selected Linux runner").toBe("linux")
  expect(process.env.GITHUB_SHA).toMatch(/^[a-f0-9]{40}$/)
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..")
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "wp00-ui-"))
  const output: Observation[] = []
  const logs: string[] = []
  const state = { stage: "prepare", exitCode: null as number | null, failure: null as string | null, corpus: null as CorpusReceipt | null }
  const startedAt = new Date().toISOString()
  try {
    await mkdir(path.join(directory, "host-tmp"), { mode: 0o700 })
    // Load the process graph only during execution; `playwright --list` must be read-only.
    const { Effect, Stream } = await import("effect")
    const { ChildProcess } = await import("effect/unstable/process")
    const { AppProcess } = await import("@orchestra/core/process")
    const { LayerNode } = await import("@orchestra/core/effect/layer-node")
    const { Omni } = await import("@orchestra/core/omni")
    const before = Omni.snapshot()
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
      const process = yield* AppProcess.Service
      // Preparation uses Bun because the authoritative provider is bun:sqlite.
      const prepared = yield* process.run(ChildProcess.make("bun", [path.join(root, "packages/app-shell/e2e/sucafina/wp00/prepare-installation.ts"), directory], { cwd: root, env: environment }), { timeout: "60 seconds" })
      logs.push(prepared.stdout.toString("utf8"), prepared.stderr.toString("utf8"))
      yield* Effect.promise(async () => {
        expect(prepared.exitCode, "Synthetic installation preparation failed; see wp00-server.log").toBe(0)
        state.corpus = JSON.parse(await readFile(path.join(directory, "corpus-receipt.json"), "utf8")) as CorpusReceipt
        expect(state.corpus.counts).toEqual({ financialLines: 1000, purchaseOrders: 200, projects: 100 })
      })
      state.stage = "start-existing-cli"
      const server = yield* process.spawn(ChildProcess.make("bun", ["run", path.join(root, "apps/cli/src/index.ts"), "serve", "--hostname", "localhost", "--port", "4110", "--installation", path.join(root, "modules/sucafina/Sucafinav1/local/entry.ts")], {
        cwd: directory, env: environment, stdin: "ignore", stdout: "pipe", stderr: "pipe",
      }))
      yield* Effect.forkScoped(Stream.runForEach(server.stdout, (chunk) => Effect.sync(() => logs.push(Buffer.from(chunk).toString("utf8")))))
      yield* Effect.forkScoped(Stream.runForEach(server.stderr, (chunk) => Effect.sync(() => logs.push(Buffer.from(chunk).toString("utf8")))))
      yield* Effect.forkScoped(server.exitCode.pipe(Effect.tap((code) => Effect.sync(() => { state.exitCode = Number(code) }))))
      yield* Effect.promise(async () => {
        const ready = { value: "waiting" }
        await expect.poll(async () => {
          if (state.exitCode !== null) return ready.value = `exited:${state.exitCode}`
          const response = await fetch("http://localhost:4110/sucafina/status", { signal: AbortSignal.timeout(10000) }).catch(() => undefined)
          if (!response?.ok) return "waiting"
          const status: unknown = await response.json()
          if (!status || typeof status !== "object" || !("login" in status) || status.login !== "local-operator") return "waiting"
          return ready.value = "ready"
        }, { timeout: 120000, message: "Existing CLI must expose its real local-operator installation" }).not.toBe("waiting")
        expect(ready.value, "Existing CLI exited before readiness; see wp00-server.log").toBe("ready")
        state.stage = "authenticate-existing-operator"
        const artifact = await readFile(path.join(directory, "open-local.html"), "utf8")
        const encoded = /location\.replace\(("[^\n]+")\)<\/script>/.exec(artifact)?.[1]
        expect(encoded, "Existing enrollment helper must produce its private handoff").toBeTruthy()
        const enrollment: unknown = JSON.parse(encoded!)
        if (typeof enrollment !== "string" || !enrollment.startsWith("http://localhost:4110/sucafina/auth/local?code=")) throw new Error("Invalid local enrollment destination")
        // Keep the single-use enrollment URL out of Playwright traces; use only the cookie actually issued by the real endpoint.
        const authenticated = await fetch(enrollment, { redirect: "manual", signal: AbortSignal.timeout(10000) }).catch(() => { throw new Error("Local enrollment request failed") })
        expect(authenticated.status).toBe(303)
        const cookie = /^(sucafina_operator_[a-f0-9]{24})=([a-f0-9]{64}); Path=(\/sucafina);/.exec(authenticated.headers.get("set-cookie") ?? "")
        if (!cookie) throw new Error("Real local enrollment did not issue the expected scoped cookie")
        await page.context().addCookies([{ name: cookie[1]!, value: cookie[2]!, domain: "localhost", path: cookie[3]!, httpOnly: true, secure: false, sameSite: "Lax" }])
        await page.goto("http://localhost:4110/sucafina/dashboard?page=Budget+Overview&year=2026")
        await expect(page.getByRole("heading", { name: "Budget Overview", exact: true, level: 1 })).toBeVisible()
        await expect(page.getByRole("combobox", { name: "FY", exact: true })).toHaveValue("2026")
        state.stage = "measure-ui"
        for (const width of [320, 768, 1440]) {
          await page.setViewportSize({ width, height: 900 })
          for (let repetition = 1; repetition <= 30; repetition++) {
            await page.goto("http://localhost:4110/sucafina/dashboard?page=Budget+Overview&year=2026")
            await expect(page.getByRole("combobox", { name: "FY", exact: true })).toHaveValue("2026")
            await observe(page, testInfo, output, "dashboard-budget-filter", width, repetition, async (visual) => {
              const response = page.waitForResponse((entry) => entry.request().method() === "GET" && new URL(entry.url()).pathname === "/sucafina/dashboard" && new URL(entry.url()).searchParams.get("year") === "2027")
              await page.getByRole("combobox", { name: "FY", exact: true }).selectOption("2027")
              expect((await response).status()).toBe(200)
              await expect(page.getByRole("combobox", { name: "FY", exact: true })).toHaveValue("2027")
              await expect(page.getByRole("heading", { name: "Budget Overview", exact: true, level: 1 })).toBeVisible()
              const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "OPEX", exact: true }) })
              await expect(row.getByRole("cell", { name: state.corpus!.expected.actual2027, exact: true })).toBeVisible()
              visual()
              await expect(row.getByRole("cell", { name: state.corpus!.expected.forecast2027, exact: true })).toBeVisible()
              await expect(page.getByRole("img", { name: "Effective monthly budget", exact: true })).toBeVisible()
              const months = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Flat reference (annual allocations / 12)", exact: true }) })
              await expect(months.getByRole("row")).toHaveCount(13)
            })
            await observe(page, testInfo, output, "procurement-volume-open", width, repetition, async (visual) => {
              const response = await page.goto("http://localhost:4110/sucafina/procurement?page=Dashboard")
              expect(response?.status()).toBe(200)
              await expect(page.getByRole("heading", { name: "Dashboard", exact: true, level: 1 })).toBeVisible()
              await expect(page.getByRole("link", { name: "Download request register", exact: true })).toBeEnabled()
              const table = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Request", exact: true }) })
              const initial = table.getByRole("row").filter({ has: page.getByRole("cell", { name: state.corpus!.expected.firstRequest, exact: true }) })
              await expect(initial.getByRole("cell", { name: state.corpus!.expected.firstAmount, exact: true })).toBeVisible()
              visual()
              await expect(table.getByRole("row")).toHaveCount(state.corpus!.expected.openRequests + 1)
              const row = table.getByRole("row").filter({ has: page.getByRole("cell", { name: state.corpus!.expected.lastRequest, exact: true }) })
              await expect(row.getByRole("cell", { name: state.corpus!.expected.lastAmount, exact: true })).toBeVisible()
            })
          }
        }
        expect(output).toHaveLength(180)
        state.stage = "completed"
      })
    })).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
    const after = Omni.snapshot()
    expect(after.spawns - before.spawns, "The owned seed and CLI must both use Omni").toBeGreaterThanOrEqual(2)
    expect(after.delegations - before.delegations).toBe(0)
    await testInfo.attach("wp00-process-observation", { body: JSON.stringify({ spawns: after.spawns - before.spawns, delegations: after.delegations - before.delegations, canonicalControlVerdict: "not applicable to Playwright runner; these are separate scoped process counters" }), contentType: "application/json" })
  } catch (error) {
    state.failure = redact(error instanceof Error ? error.message : String(error))
    throw error
  } finally {
    try {
      await mkdir(testInfo.outputDir, { recursive: true })
      await writeFile(testInfo.outputPath("wp00-server.log"), redact(logs.join("")))
      await testInfo.attach("wp00-server", { path: testInfo.outputPath("wp00-server.log"), contentType: "text/plain" })
      await testInfo.attach("wp00-raw-measurements", { body: JSON.stringify({
      schema: "wp00-real-ui-measurements-v1", executedCommit: process.env.GITHUB_SHA, baselineReferenceCommit: "9e4f3d35833f9b2cea6abdf58f42331f3973d9bf",
      comparisonState: "candidate-only; baseline reference was not measured in this run", startedAt,
      operatingSystem: `${process.platform} ${release()}`, device: "GitHub Actions runner", browserVersion: browser.version(),
      cacheState: "same authenticated browser context; server responses no-store; repeated navigation",
      method: "Automation-observed elapsed time: a current usable business result, then the complete asserted business outcome; neither timestamp claims compositor paint time",
      state, observations: output,
      limits: ["Local operator only; no Microsoft identity or native AI qualification", "Planner comparison, sourcing ranking, report preparation and exact reimport are not measured by this spec", "Zoom 200% is not measured; CSS zoom and page-scale emulation are not substituted", "The original baseline commit has not been timed"],
      }, null, 2), contentType: "application/json" })
    } finally { await rm(directory, { recursive: true, force: true }) }
  }
})

async function observe(page: Page, testInfo: TestInfo, output: Observation[], flow: string, width: number, repetition: number, action: (visual: () => void) => Promise<void>) {
  const start = performance.now()
  const record: Observation = { flow, repetition, viewportWidth: width, viewportHeight: 900, zoomPercent: 100, startedAt: new Date().toISOString(), visualReadyMs: null, completionMs: null, outcome: "failed", failureReason: null, resultEvidenceRef: null }
  output.push(record)
  try {
    await action(() => { record.visualReadyMs = performance.now() - start })
    record.completionMs = performance.now() - start
    record.outcome = "passed"
    if (repetition === 30) {
      record.resultEvidenceRef = `${flow}-${width}.png`
      await page.screenshot({ path: testInfo.outputPath(record.resultEvidenceRef), fullPage: true })
      await testInfo.attach(record.resultEvidenceRef, { path: testInfo.outputPath(record.resultEvidenceRef), contentType: "image/png" })
    }
  } catch (error) {
    record.outcome = "failed"
    record.failureReason = redact(error instanceof Error ? error.message : String(error))
    throw error
  }
}

function redact(value: string) {
  return value.replace(/([?&]code=)[a-f0-9]{64}/gi, "$1[redacted]")
    .replace(/(sucafina_operator_[a-f0-9]{24}=)[a-f0-9]{64}/gi, "$1[redacted]")
}
