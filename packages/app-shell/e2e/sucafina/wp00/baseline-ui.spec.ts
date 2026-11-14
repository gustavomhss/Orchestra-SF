import { expect, test } from "@playwright/test"
import type { Page, TestInfo } from "@playwright/test"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { release, tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { flowNames, prepareUiFlow, runUiFlow } from "./flows.ts"
import type { Flow, UiCorpusReceipt } from "./flows.ts"
import { compareMeasurements, createMeasurementPlan, measurementKey, summarizeMeasurements } from "./measurements.ts"
import type { Measurement, MeasurementPlan } from "./measurements.ts"

test.describe.configure({ timeout: 1800000, retries: 0 })

test("WP00 observes seven real business flows, browser zoom and thirty repetitions per configuration", async ({}, testInfo) => {
  expect(process.env.GITHUB_ACTIONS, "Qualification must run in GitHub Actions").toBe("true")
  expect(process.platform, "The isolated local provider requires the selected Linux runner").toBe("linux")
  expect(process.env.GITHUB_SHA).toMatch(/^[a-f0-9]{40}$/)
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..")
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "wp00-ui-"))
  const plan = createMeasurementPlan(flowNames)
  const observations: Measurement[] = []
  const cancellations: Record<string, string> = {}
  const failedFlows = new Map<Flow, string>()
  const logs: string[] = []
  const zoomObservations: { key: string; observed: object }[] = []
  const state = {
    stage: "prepare", exitCode: null as number | null, failure: null as string | null,
    corpus: null as UiCorpusReceipt | null, productSha: null as string | null,
    authenticated: false, browserVersion: null as string | null,
  }
  let processCounters: (() => { spawns: number; delegations: number }) | null = null
  const startedAt = new Date().toISOString()
  const method = "Automation-observed elapsed time from user action to usable business result, then complete asserted outcome; no compositor-paint claim"
  try {
    await mkdir(path.join(directory, "host-tmp"), { mode: 0o700 })
    // Load the process graph only during execution; `playwright --list` remains read-only.
    const { Effect, Stream } = await import("effect")
    const { ChildProcess } = await import("effect/unstable/process")
    const { AppProcess } = await import("@orchestra/core/process")
    const { LayerNode } = await import("@orchestra/core/effect/layer-node")
    const { Omni } = await import("@orchestra/core/omni")
    const { scopedWp00Browser, setBrowserZoom } = await import("./browser.ts")
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
      // test-ci uses a shallow checkout. The raw commit still contains its real parent;
      // rev-parse HEAD^ would incorrectly require the parent object to be fetched.
      const revisions = yield* processService.run(ChildProcess.make("git", ["cat-file", "-p", "HEAD"], { cwd: root }), { timeout: "10 seconds" })
      if (revisions.exitCode !== 0) throw new Error("Cannot bind the observation to its real CI snapshot and product parent")
      const snapshot = createHash("sha1").update(`commit ${revisions.stdout.byteLength}\0`).update(revisions.stdout).digest("hex")
      const product = /^parent ([a-f0-9]{40})$/m.exec(revisions.stdout.toString("utf8"))?.[1]
      if (snapshot !== process.env.GITHUB_SHA || !product || !/^[a-f0-9]{40}$/.test(product)) throw new Error("Invalid observed CI revision chain")
      state.productSha = product
      const prepared = yield* processService.run(ChildProcess.make("bun", [path.join(root, "packages/app-shell/e2e/sucafina/wp00/prepare-installation.ts"), directory], { cwd: root, env: environment }), { timeout: "60 seconds" })
      logs.push(prepared.stdout.toString("utf8"), prepared.stderr.toString("utf8"))
      yield* Effect.promise(async () => {
        expect(prepared.exitCode, "Synthetic installation preparation failed; see wp00-server.log").toBe(0)
        state.corpus = JSON.parse(await readFile(path.join(directory, "corpus-receipt.json"), "utf8")) as UiCorpusReceipt
        expect(state.corpus.schema).toBe("wp00-ui-corpus-v2")
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
          const response = await fetch("http://localhost:4110/sucafina/status", { signal: AbortSignal.timeout(10000) }).catch(() => undefined)
          if (!response?.ok) return "waiting"
          const status: unknown = await response.json()
          if (!status || typeof status !== "object" || !("login" in status) || status.login !== "local-operator") return "waiting"
          return ready.value = "ready"
        }, { timeout: 120000, message: "Existing CLI must expose its real local-operator installation" }).not.toBe("waiting")
        expect(ready.value, "Existing CLI exited before readiness; see wp00-server.log").toBe("ready")
      })
      state.stage = "start-isolated-browser"
      const { browser, context, page, worker } = yield* scopedWp00Browser(directory)
      state.browserVersion = browser.version()
      yield* Effect.promise(async (signal) => {
        state.stage = "authenticate-existing-operator"
        const artifact = await readFile(path.join(directory, "open-local.html"), "utf8")
        const encoded = /location\.replace\(("[^\n]+")\)<\/script>/.exec(artifact)?.[1]
        expect(encoded, "Existing enrollment helper must produce its private handoff").toBeTruthy()
        const enrollment: unknown = JSON.parse(encoded!)
        if (typeof enrollment !== "string" || !enrollment.startsWith("http://localhost:4110/sucafina/auth/local?code=")) throw new Error("Invalid local enrollment destination")
        // The single-use URL and cookie never enter browser traces or attachments.
        const authenticated = await fetch(enrollment, { redirect: "manual", signal: AbortSignal.timeout(10000) }).catch(() => { throw new Error("Local enrollment request failed") })
        expect(authenticated.status).toBe(303)
        const cookie = /^(sucafina_operator_[a-f0-9]{24})=([a-f0-9]{64}); Path=(\/sucafina);/.exec(authenticated.headers.get("set-cookie") ?? "")
        if (!cookie) throw new Error("Real local enrollment did not issue the expected scoped cookie")
        await context.addCookies([{ name: cookie[1]!, value: cookie[2]!, domain: "localhost", path: cookie[3]!, httpOnly: true, secure: false, sameSite: "Lax" }])
        await page.setViewportSize({ width: 1440, height: 900 })
        expect((await page.goto("http://localhost:4110/sucafina/dashboard?page=Budget+Overview&year=2026"))?.status()).toBe(200)
        await expect(page.getByRole("heading", { name: "Budget Overview", exact: true, level: 1 })).toBeVisible()
        state.authenticated = true
        const normalZoom = await setBrowserZoom(page, worker, 100)
        state.stage = "measure-ui"
        for (const configuration of plan) {
          signal.throwIfAborted()
          const flow = configuration.flow as Flow
          const key = measurementKey(configuration)
          const priorFailure = failedFlows.get(flow)
          if (priorFailure) { cancellations[key] = priorFailure; continue }
          try {
            await page.setViewportSize({ width: configuration.viewportWidth, height: configuration.viewportHeight })
            const percent = configuration.zoomPercent === 200 ? 200 : 100
            await setBrowserZoom(page, worker, percent)
            await expect.poll(() => page.evaluate(() => window.devicePixelRatio), { message: "Browser zoom must change the observed device pixel ratio" }).toBe(normalZoom.devicePixelRatio * percent / 100)
            zoomObservations.push({ key, observed: await setBrowserZoom(page, worker, percent) })
            for (let repetition = 1; repetition <= configuration.repetitions; repetition++) {
              signal.throwIfAborted()
              await prepareUiFlow(flow, page, state.corpus!, directory)
              signal.throwIfAborted()
              await observe(page, testInfo, observations, configuration, repetition, signal, (visual) => runUiFlow(flow, page, state.corpus!, directory, testInfo, repetition, visual))
            }
          } catch (error) {
            signal.throwIfAborted()
            const reason = redact(error instanceof Error ? error.message : String(error))
            // A failed stateful outcome is not retried. Independent flows still expose their own results.
            failedFlows.set(flow, reason)
            cancellations[key] = reason
          }
        }
        if (failedFlows.size) throw new Error("Business flows failed: " + [...failedFlows].map(([flow, reason]) => flow + ": " + reason).join("\n"))
        expect(observations).toHaveLength(1260)
        expect(observations.every((item) => item.outcome === "passed")).toBe(true)
        state.stage = "completed"
      })
    })).pipe(Effect.provide(LayerNode.compile(AppProcess.node))), { signal: AbortSignal.timeout(28 * 60_000) })
    const counters = processCounters()
    expect(counters.spawns, "Revision read, seed, CLI and browser must all use Omni").toBeGreaterThanOrEqual(4)
    expect(counters.delegations).toBe(0)
  } catch (error) {
    state.failure = redact(error instanceof Error ? error.message : String(error))
    throw error
  } finally {
    try {
      await mkdir(testInfo.outputDir, { recursive: true })
      await writeFile(testInfo.outputPath("wp00-server.log"), redact(logs.join("")))
      await testInfo.attach("wp00-server", { path: testInfo.outputPath("wp00-server.log"), contentType: "text/plain" })
      // A cancelled Effect can finish before its underlying browser Promise rejects.
      // Snapshot an active attempt as failed with the observed interruption; never invent a duration.
      const settledObservations = observations.map((item) => item.outcome === "failed" && item.failureReason === null
        ? { ...item, failureReason: state.failure ?? "Process scope ended before the active attempt completed" }
        : { ...item })
      const summaries = summarizeMeasurements(plan, settledObservations, cancellations, state.failure ?? "Configuration was not reached")
      const environment = {
        datasetDigest: state.corpus?.datasetDigest ?? null, runtimeVersion: state.corpus?.runtimeVersion ?? null,
        operatingSystem: `${process.platform} ${release()}`, device: "GitHub Actions runner", browserVersion: state.browserVersion,
        cacheState: state.authenticated ? "same authenticated browser context; server responses no-store; repeated navigation" : null, method,
      }
      const comparison = state.productSha && environment.datasetDigest && environment.runtimeVersion && environment.browserVersion && environment.cacheState
        ? compareMeasurements({ productSha: state.productSha, environment: {
          ...environment, datasetDigest: environment.datasetDigest, runtimeVersion: environment.runtimeVersion,
          browserVersion: environment.browserVersion, cacheState: environment.cacheState,
        }, summaries }, null)
        : { state: "unavailable", reason: "Authenticated candidate measurement was not reached and baseline was not measured", comparisons: [] }
      await testInfo.attach("wp00-raw-measurements", { body: JSON.stringify({
        schema: "wp00-real-ui-measurements-v2", executedSnapshotCommit: process.env.GITHUB_SHA, productCommit: state.productSha,
        baselineReferenceCommit: "9e4f3d35833f9b2cea6abdf58f42331f3973d9bf", startedAt, environment,
        unavailableEnvironmentReasons: Object.fromEntries(Object.entries(environment).filter(([, value]) => value === null)
          .map(([key]) => [key, state.failure ?? "The required stage was not reached"])),
        authenticated: state.authenticated, state, plan, observations: settledObservations, summaries, zoomObservations,
        comparison,
        processObservation: processCounters ? { ...processCounters(), canonicalControlVerdict: "Playwright scoped counters; not the Bun canonical control" } : null,
        limits: ["Local operator only; no Microsoft identity or native AI qualification", "Seeded Planner alternatives do not prove a native AI scenario or composite J05", "The original baseline commit has not been timed", "Cancelled attempts have no invented latency or successful outcome"],
      }, null, 2), contentType: "application/json" })
    } finally { await rm(directory, { recursive: true, force: true }) }
  }
})

async function observe(page: Page, testInfo: TestInfo, output: Measurement[], configuration: MeasurementPlan, repetition: number, signal: AbortSignal, action: (visual: () => void) => Promise<void>) {
  const start = performance.now()
  const record: Measurement = { ...configuration, repetition, startedAt: new Date().toISOString(), visualReadyMs: null, completionMs: null, outcome: "failed", failureReason: null, resultEvidenceRef: null }
  output.push(record)
  try {
    await action(() => { signal.throwIfAborted(); record.visualReadyMs ??= performance.now() - start })
    signal.throwIfAborted()
    if (record.visualReadyMs === null) throw new Error("The flow never observed a usable business result")
    record.completionMs = performance.now() - start
    if (repetition === configuration.repetitions) {
      const evidence = `${configuration.flow}-${configuration.viewportWidth}-${configuration.zoomPercent}.png`
      await page.screenshot({ path: testInfo.outputPath(evidence), fullPage: true })
      await testInfo.attach(evidence, { path: testInfo.outputPath(evidence), contentType: "image/png" })
      record.resultEvidenceRef = evidence
    }
    signal.throwIfAborted()
    record.outcome = "passed"
  } catch (error) {
    record.failureReason = redact(error instanceof Error ? error.message : String(error))
    throw error
  }
}

function redact(value: string) {
  return value.replace(/([?&]code=)[a-f0-9]{64}/gi, "$1[redacted]")
    .replace(/(sucafina_operator_[a-f0-9]{24}=)[a-f0-9]{64}/gi, "$1[redacted]")
}
