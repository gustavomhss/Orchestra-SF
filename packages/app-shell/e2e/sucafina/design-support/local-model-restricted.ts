import { createHash } from "node:crypto"
import { chmod, mkdir, mkdtemp, open, readFile, readdir, realpath, rm, stat } from "node:fs/promises"
import { createServer } from "node:net"
import { availableParallelism, freemem, totalmem, tmpdir } from "node:os"
import path from "node:path"
import type { APIRequestContext } from "@playwright/test"
import type { ChildProcessHandle } from "effect/unstable/process/ChildProcessSpawner"
import type { DesignInstallation } from "./installation"

// Recording-only model helper. A separate, explicit operator setup restricts Maestro through the public agent-file API.
// This helper only configures the local provider and preserves that already configured policy.
// Pins and licenses: scripts/onboarding/ai/SOURCES.md on the isolated recording branch.
const sourceBase = "55d332a2451d2146e825d494b87878875d63b1c7"
const providerId = "onboarding-local"
const modelId = "qwen35-demo"
const modelName = "Qwen3.5-9B · local demo"
const contextTokens = 16_384
const modelThreads = Math.max(1, Math.min(4, availableParallelism()))
const assets = {
  server: {
    file: "llama-b12632-bin-ubuntu-x64.tar.gz",
    url: "https://github.com/ggml-org/llama.cpp/releases/download/b12632/llama-b12632-bin-ubuntu-x64.tar.gz",
    sha256: "3fe2107f1f58d7fb77c514d65b5873dc68ffe999f8e7fd3789a4448d477eb6e2",
    bytes: 23226195,
    version: "b12632",
    sourceCommit: "8cb0d98ccd0a310879ae8eaa1ce2c41e4b40a052",
    license: "MIT",
  },
  model: {
    file: "Qwen3.5-9B-Q4_K_M.gguf",
    url: "https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/resolve/3885219b6810b007914f3a7950a8d1b469d598a5/Qwen3.5-9B-Q4_K_M.gguf",
    sha256: "03b74727a860a56338e042c4420bb3f04b2fec5734175f4cb9fa853daf52b7e8",
    bytes: 5680522464,
    sourceCommit: "3885219b6810b007914f3a7950a8d1b469d598a5",
    upstreamModelCommit: null, // Exact conversion ancestry is not documented by this quantization publisher.
    documentedBaseModel: "Qwen/Qwen3.5-9B",
    architectureConfigCommit: "21eca8a083a2121a92fba681f4a7c72cf20ff1a7",
    license: "Apache-2.0",
  },
} as const

export const localModelPrompt = "Prepare a regional IT review using only these facts. Staffing: a regional infrastructure position is planned at 1.0 FTE; 0.9 FTE is proposed. The reviewer needs to assess support coverage. Separately, a support purchase has three quotations; one is selected and approval is pending. Prices, specifications and vendor evidence have not been provided. Return exactly three concise Markdown bullets: a staffing coverage question; which missing evidence to request for the selected quotation; one concrete check the human reviewer must perform before deciding on approval. Start each line with a dash. Do not invent people, roles, costs or evidence. Keep staffing and the purchase separate. Do not use tools, change records, or claim you read the business system."

export type LocalModelRecording = {
  providerId: string
  modelId: string
  modelName: string
  agentId: string
  agentName: string
  prompt: string
  readProgress: () => Promise<LocalModelProgress>
  captureProof: (sessionId: string) => Promise<Record<string, unknown>>
}

type ModelSlotProgress = {
  id?: number
  taskId?: number
  contextTokens?: number
  prefixTokens?: number
  processedTokens?: number
  cachedTokens?: number
  decodedTokens?: number
  remainingTokens?: number
  predictLimit?: number
  processing?: boolean
}

type PrefillProgress = {
  observedAtMs: number
  slotId: number
  taskId: number
  processedTokens: number
  progressFraction: number
  elapsedSeconds: number
  tokensPerSecond: number
}

type ProcessResources = {
  pid: number
  startTimeTicks: number
  cpuTicks: number
  rssBytes?: number
  peakRssBytes?: number
  swapBytes?: number
  threads?: number
}

export type LocalModelProgress = {
  elapsedMs: number
  metrics: Record<string, number>
  metricsRead: boolean
  slots: ModelSlotProgress[]
  slotsRead: boolean
  prefill?: PrefillProgress
  process: Partial<ProcessResources> & {
    running: boolean | null
    resourcesRead: boolean
    availableCpus: number
    freeMemoryBytes: number
  }
  stall: {
    baselineObserved: boolean
    noProgressMs: number
    noCpuProgressMs: number
    thresholdMs: number
    suspected: boolean
  }
}

type Recorder = (name: string, proof: object) => Promise<void>
type JsonObject = Record<string, unknown>
type Asset = { file: string; url: string; sha256: string; bytes: number }

/** Keep this scope alive for the actual UI send, streamed reply, and persisted-message readback. */
export async function withLocalModel<T>(
  request: APIRequestContext,
  installed: DesignInstallation,
  use: (model: LocalModelRecording) => Promise<T>,
  record: Recorder,
): Promise<T> {
  if (!process.env.CI || process.platform !== "linux" || process.arch !== "x64")
    throw new Error("The local demonstration model is restricted to the isolated Linux x64 recording CI job")
  const origin = new URL(installed.origin)
  if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || !origin.port || installed.mount !== "/sucafina")
    throw new Error("Expected the genuine isolated native Sucafina installation")
  const installationRoot = await realpath(installed.root)
  const directory = await realpath(path.join(installationRoot, "workspace"))
  const rootInfo = await stat(installationRoot)
  if (directory !== path.join(installationRoot, "workspace") || !rootInfo.isDirectory() || (rootInfo.mode & 0o077) !== 0)
    throw new Error("Expected the installation's private physical workspace")

  // Lazy imports keep Playwright test listing free from native process graph initialization.
  const [{ AppProcess }, { LayerNode }, { Effect, Stream }, { ChildProcess }] = await Promise.all([
    import("@orchestra/core/process"),
    import("@orchestra/core/effect/layer-node"),
    import("effect"),
    import("effect/unstable/process"),
  ])
  const owned: { child?: ChildProcessHandle } = {}
  const timingLines: string[] = []
  const startupLines: string[] = []
  const numericStartup: {
    cpuBackend?: string
    cpuFeatures: Record<string, number>
    nBatch?: number
    nUbatch?: number
    flashAttentionEnabled?: boolean
  } = { cpuFeatures: {} }
  const progressSamples: LocalModelProgress[] = []
  const telemetryStartedAt = Date.now()
  let latestPrefill: PrefillProgress | undefined
  // Preserve the original Maestro role and let ordinary configured permissions
  // determine available guidance/tools. The separately pinned9B model uses a
  // standard16384-token configured context; no request content is pruned.
  const memoryBeforeLoad = { totalBytes: totalmem(), freeBytes: freemem() }
  // Verified Qwen9B architecture: eight full-attention layers, four KV heads, dim256.
  // Two GiB of additional room cover hybrid state, batches and process overhead.
  const estimatedF16KVBytes = 8 * 4 * 256 * 2 * 2 * contextTokens
  const requiredFreeBytes = estimatedF16KVBytes + assets.model.bytes + 2 * 1024 ** 3
  if (memoryBeforeLoad.freeBytes < requiredFreeBytes)
    throw new Error("Runner lacks measured RAM for the " + contextTokens + "-token local context: free=" + memoryBeforeLoad.freeBytes + ", required=" + requiredFreeBytes)
  let stage = "download"
  let modelReady = false
  return Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const launcher = yield* AppProcess.Service
    const root = yield* Effect.acquireRelease(
      Effect.promise(async () => {
        const value = await mkdtemp(path.join(await realpath(tmpdir()), "sf-onboarding-model-"))
        await chmod(value, 0o700)
        await mkdir(path.join(value, "bin"), { mode: 0o700 })
        return value
      }),
      (value) => Effect.gen(function* () {
        if (owned.child && (yield* owned.child.isRunning))
          throw new Error("Owned local model did not stop; temporary files retained")
        yield* Effect.promise(() => rm(value, { recursive: true, force: true }))
      }).pipe(Effect.orDie),
    )
    yield* Effect.promise(() => record("local-model-setup-started", {
      sourceBase, startedAt: new Date().toISOString(), assets, scope: "ephemeral CPU demonstration model",
    }))
    const [archive, modelFile] = yield* Effect.promise(async () => {
      const results = await Promise.allSettled([
        downloadVerified(assets.server, root), downloadVerified(assets.model, root),
      ])
      const files: string[] = []
      for (const result of results) {
        if (result.status === "rejected") throw result.reason
        files.push(result.value)
      }
      return [files[0]!, files[1]!] as const
    })
    stage = "extract-and-version"
    const environment = modelEnvironment(root)
    yield* launcher.run(ChildProcess.make("tar", ["-xzf", archive, "-C", path.join(root, "bin")], {
      cwd: root, env: environment, extendEnv: false, stdin: "ignore", stdout: "pipe", stderr: "pipe",
    }), { timeout: 30_000, maxOutputBytes: 4096, maxErrorBytes: 4096 }).pipe(Effect.flatMap(AppProcess.requireSuccess))
    const binary = yield* Effect.promise(() => findServer(path.join(root, "bin")))
    environment.LD_LIBRARY_PATH = path.dirname(binary)
    const version = yield* launcher.run(ChildProcess.make(binary, ["--version"], {
      cwd: root, env: environment, extendEnv: false, stdin: "ignore", stdout: "pipe", stderr: "pipe",
    }), { timeout: 15_000, maxOutputBytes: 4096, maxErrorBytes: 4096 }).pipe(Effect.flatMap(AppProcess.requireSuccess))
    const versionText = [version.output, version.stdout, version.stderr].filter(Boolean).map((value) => value!.toString("utf8")).join("\n").trim()
    if (!versionText.includes("12632")) throw new Error("The verified model server reported an unexpected build")
    const port = yield* Effect.promise(unusedPort)
    const modelOrigin = "http://127.0.0.1:" + port
    const args = [
      "-m", modelFile, "--alias", modelId, "--host", "127.0.0.1", "--port", String(port),
      "-ngl", "0", "-t", String(modelThreads), "-tb", String(modelThreads), "-c", String(contextTokens), "-np", "1", "-n", "384",
      "--jinja", "--chat-template-kwargs", '{"enable_thinking":false}', "--reasoning", "off",
      "--temp", "0.7", "--top-k", "20", "--top-p", "0.8", "--min-p", "0", "--presence-penalty", "1.5",
      "--metrics", "--timeout", "1800",
    ]
    stage = "start-model"
    const child = yield* launcher.spawn(ChildProcess.make(binary, args, {
      cwd: root, env: environment, extendEnv: false, stdin: "ignore", stdout: "pipe", stderr: "pipe",
      killSignal: "SIGTERM", forceKillAfter: "10 seconds",
    }))
    owned.child = child
    const collect = (line: string) => Effect.sync(() => {
      // Pinned b12632 server_slot::print_timings_pp is numeric and uses task-local
      // progress. Its prefix is defined by SLT_INF in server-common.h. Keep no text.
      const pp = line.match(/\bid\s+(\d+)\s*\|\s*task\s+(\d+)\s*\|\s*prompt processing, n_tokens\s*=\s*(\d+), progress\s*=\s*([\d.]+), t\s*=\s*([\d.]+) s\s*\/\s*([\d.]+) tokens per second/)
      if (pp) {
        const values = pp.slice(1).map(Number)
        if (values.every(Number.isFinite) && values[3]! >= 0 && values[3]! <= 1) {
          latestPrefill = { observedAtMs: Date.now() - telemetryStartedAt, slotId: values[0]!, taskId: values[1]!,
            processedTokens: values[2]!, progressFraction: values[3]!, elapsedSeconds: values[4]!, tokensPerSecond: values[5]! }
        }
      }
      if (!modelReady) {
        // Backend basename and fixed capability flags only; never retain its path.
        const backend = line.match(/loaded CPU backend from .*\b(libggml-cpu(?:-[A-Za-z0-9_-]+)?\.so)\b/)
        if (backend) numericStartup.cpuBackend = backend[1]!
        const batch = line.match(/\bn_(batch|ubatch)\s*=\s*(\d+)\b/)
        if (batch) numericStartup[batch[1] === "batch" ? "nBatch" : "nUbatch"] = Number(batch[2])
        if (/\bFlash Attention enabled\b/.test(line)) numericStartup.flashAttentionEnabled = true
        if (/\bFlash Attention not supported, set to disabled\b/.test(line)) numericStartup.flashAttentionEnabled = false
        if (/\bsystem_info\b/.test(line)) {
          for (const feature of ["AVX", "AVX2", "AVX512", "AVX512_VBMI", "AVX512_VNNI", "AVX512_BF16", "F16C", "FMA", "AVX_VNNI", "AMX_INT8", "REPACK", "LLAMAFILE"]) {
            const value = line.match(new RegExp("\\b" + feature + "\\s*=\\s*([01])\\b"))
            if (value) numericStartup.cpuFeatures[feature] = Number(value[1])
          }
        }
      }
      // Startup precedes any inference; retain a bounded diagnostic tail while
      // omitting tokenizer templates and file paths. Never retain request logs.
      if (!modelReady && line.length < 1600 && !/chat_template|system.prompt|authorization|api.key/i.test(line) &&
          /error|failed|fatal|unable|cannot|warning|n_ctx|n_threads|listen|loading|load_model|model.*loaded/i.test(line)) {
        startupLines.push(safeDiagnostic(line.replaceAll(root, "[model-directory]"), installationRoot))
        if (startupLines.length > 24) startupLines.shift()
      }
      // Keep only numeric server timings, never prompts, messages, paths, headers, or credentials.
      const timing = line.match(/(?:prompt eval time|eval time|total time)\s*=\s*[\d.]+\s*ms[^\r\n]*/)
      if (timing && /^[a-zA-Z0-9_.\s=()/,:+%-]+$/.test(timing[0])) {
        timingLines.push(timing[0].slice(0,300))
        if (timingLines.length > 30) timingLines.shift()
      }
    })
    yield* Effect.forkScoped(child.stdout.pipe(Stream.decodeText, Stream.splitLines, Stream.runForEach(collect)))
    yield* Effect.forkScoped(child.stderr.pipe(Stream.decodeText, Stream.splitLines, Stream.runForEach(collect)))
    yield* Effect.promise(() => waitForModel(modelOrigin)).pipe(Effect.raceFirst(
      child.exitCode.pipe(Effect.flatMap((code) => Effect.fail(new Error("Local model exited before readiness (" + code + ")")))),
    ))
    if (!(yield* child.isRunning)) throw new Error("Local model stopped after readiness")
    modelReady = true
    const capacity = yield* Effect.promise(() => modelCapacity(modelOrigin))
    stage = "configure-provider"

    return yield* Effect.promise(async () => {
      const before = await apiObject(request, new URL("/api/config", origin).href)
      const originalPolicy = policyDigest(before)
      const patch = await request.patch(new URL("/api/config", origin).href, {
        data: {
          model: providerId + "/" + modelId,
          providers: {
            [providerId]: {
              name: "Local demonstration model",
              api: { type: "aisdk", package: "@ai-sdk/openai-compatible", url: modelOrigin + "/v1" },
              models: { [modelId]: { name: modelName } },
            },
          },
        },
        timeout: 30_000,
      })
      if (patch.status() !== 204) throw new Error("Supported custom-provider configuration failed (" + patch.status() + ")")
      const after = await apiObject(request, new URL("/api/config", origin).href)
      if (policyDigest(after) !== originalPolicy)
        throw new Error("Provider configuration unexpectedly changed existing policy or agent engines")
      const [providerRows, modelRows, defaultModel, agentRows] = await Promise.all([
        locationRows(request, origin, "/api/provider", directory),
        locationRows(request, origin, "/api/model", directory),
        apiObject(request, locationURL(origin, "/api/model/default", directory)),
        locationRows(request, origin, "/api/agent", directory),
      ])
      const provider = providerRows.find((value) => value.id === providerId)
      const model = modelRows.find((value) => value.id === modelId && value.providerID === providerId)
      const selectedDefault = object(defaultModel.data)
      if (!provider || provider.disabled === true || !model || model.enabled !== true ||
          selectedDefault.id !== modelId || selectedDefault.providerID !== providerId)
        throw new Error("The ordinary workspace catalog did not admit the configured demonstration model")
      const providerApi = object(provider.api)
      if (providerApi.url !== modelOrigin + "/v1" || providerApi.package !== "@ai-sdk/openai-compatible")
        throw new Error("The admitted provider does not point to the owned loopback server")
      const candidates = agentRows.filter((value) => typeof value.id === "string" &&
        value.hidden === false && (value.mode === "primary" || value.mode === "all") &&
        (value.engine === undefined || value.engine === "orchestra"))
      // The production desktop opens every Chat draft on Maestro. A different
      // primary agent in the catalog is not a substitute for that UI contract.
      const agent = candidates.find((value) => value.id === "maestro")
      if (!agent || typeof agent.id !== "string")
        throw new Error("The actual Maestro is not admitted for the Orchestra engine; inspect supported UI configuration")
      const agentId = agent.id
      const agentName = typeof agent.name === "string" && agent.name ? agent.name : agentId
      const baselineMetrics = await metrics(modelOrigin)
      // Counters are diagnostic only. The actual UI/persisted assistant proof below
      // remains the success gate; the automatic title is not the requested answer.
      const stallThresholdMs = 10 * 60_000
      let stallBaseline: {
        taskId: number; startTimeTicks: number; counters: number[]; cpuTicks: number
        lastProgressMs: number; lastCpuProgressMs: number
      } | undefined
      const readProgress = async (): Promise<LocalModelProgress> => {
        const [metricRead, slotRead, resourceRead, runningRead] = await Promise.allSettled([
          metrics(modelOrigin), modelSlots(modelOrigin), ownedProcessResources(child.pid), Effect.runPromise(child.isRunning),
        ])
        const elapsedMs = Date.now() - telemetryStartedAt
        const observedMetrics: Record<string, number> = metricRead.status === "fulfilled" ? metricRead.value : {}
        const observedSlots = slotRead.status === "fulfilled" ? slotRead.value : []
        const resources = resourceRead.status === "fulfilled" ? resourceRead.value : undefined
        const running = runningRead.status === "fulfilled" ? runningRead.value : null
        const active = observedSlots.filter((slot) => slot.processing === true)
        const slot = active.length === 1 ? active[0] : undefined
        const counters = slot ? [slot.prefixTokens, slot.processedTokens, slot.decodedTokens, observedMetrics["llamacpp:n_decode_total"]] : []
        const valid = metricRead.status === "fulfilled" && slotRead.status === "fulfilled" && running === true &&
          resources !== undefined && slot?.taskId !== undefined && counters.length === 4 &&
          counters.every((value) => typeof value === "number" && Number.isFinite(value)) &&
          (slot.processedTokens ?? 0) > 0
        const stall = { baselineObserved: false, noProgressMs: 0, noCpuProgressMs: 0, thresholdMs: stallThresholdMs, suspected: false }
        if (valid && resources && slot?.taskId !== undefined) {
          const values = counters as number[]
          if (!stallBaseline || stallBaseline.taskId !== slot.taskId || stallBaseline.startTimeTicks !== resources.startTimeTicks ||
              values.some((value, index) => value < stallBaseline!.counters[index]!) || resources.cpuTicks < stallBaseline.cpuTicks) {
            stallBaseline = { taskId: slot.taskId, startTimeTicks: resources.startTimeTicks, counters: values,
              cpuTicks: resources.cpuTicks, lastProgressMs: elapsedMs, lastCpuProgressMs: elapsedMs }
          } else {
            if (values.some((value, index) => value > stallBaseline!.counters[index]!)) stallBaseline.lastProgressMs = elapsedMs
            if (resources.cpuTicks > stallBaseline.cpuTicks) stallBaseline.lastCpuProgressMs = elapsedMs
            stallBaseline.counters = values
            stallBaseline.cpuTicks = resources.cpuTicks
          }
          stall.baselineObserved = true
          stall.noProgressMs = elapsedMs - stallBaseline.lastProgressMs
          stall.noCpuProgressMs = elapsedMs - stallBaseline.lastCpuProgressMs
          stall.suspected = stall.noProgressMs >= stallThresholdMs && stall.noCpuProgressMs >= stallThresholdMs
        } else {
          // Missing or delayed diagnostics are not evidence of stalled inference.
          stallBaseline = undefined
        }
        const value: LocalModelProgress = {
          elapsedMs, metrics: observedMetrics, metricsRead: metricRead.status === "fulfilled",
          slots: observedSlots, slotsRead: slotRead.status === "fulfilled", prefill: latestPrefill,
          process: { ...resources, running, resourcesRead: resources !== undefined,
            availableCpus: availableParallelism(), freeMemoryBytes: freemem() }, stall,
        }
        if (!progressSamples.length || elapsedMs - progressSamples.at(-1)!.elapsedMs >= 55_000 || stall.suspected) {
          progressSamples.push(value)
          if (progressSamples.length > 150) progressSamples.shift()
        }
        return value
      }
      await record("local-model-ready", {
        sourceBase, readyAt: new Date().toISOString(), assets,
        binaryVersion: versionText.replaceAll(root, "[temporary-model-directory]").slice(0,2000),
        provider: { id: providerId, modelId, modelName, endpoint: "owned loopback /v1", credentialsRequired: false },
        agent: { id: agentId, name: agentName, engine: agent.engine ?? "orchestra (default)", mode: agent.mode },
        policyUnchangedByProviderPatch: true, policySha256: originalPolicy,
        policySnapshotScope: "after the explicit project-scoped operator tool restriction",
        server: { cpuOnly: true, threads: modelThreads, context: contextTokens, parallel: 1, maximumDefaultOutputTokens: 384, thinking: false,
          observedContext: capacity.context, modelTrainingContext: capacity.trainingContext },
        memory: { ...memoryBeforeLoad, estimatedF16KVBytes, requiredFreeBytes, freeAfterLoadBytes: freemem() },
        catalog: { providerPresent: true, modelEnabled: true, defaultMatches: true,
          reportedLimit: object(model.limit), limitsConfiguredViaAPI: false },
        baselineMetrics,
        numericStartup,
      })
      stage = "actual-chat"
      return use({
        providerId, modelId, modelName, agentId, agentName, prompt: localModelPrompt, readProgress,
        captureProof: async (sessionId) => {
          if (!/^[A-Za-z0-9_-]{8,160}$/.test(sessionId)) throw new Error("Supply the actual parsed Chat session ID")
          const timeline = await completeMessages(request, origin, sessionId)
          const messages = timeline.messages
          const users = messages.filter((value) => value.type === "user")
          const assistants = messages.filter((value) => value.type === "assistant")
          const candidate = assistants.at(-1)
          const answer = candidate ?? {}
          const content = rows(answer.content ?? [])
          const answerText = content.filter((part) => part.type === "text" && typeof part.text === "string")
            .map((part) => part.text).join("\n").trim()
          const tools = assistants.flatMap((value) => rows(value.content)).filter((part) => part.type === "tool")
          const answerModel = object(answer.model)
          const time = object(answer.time)
          const finalMetrics = await metrics(modelOrigin)
          const finalProgress = await readProgress()
          const checks = {
            actualPrompt: users.length === 1 && users[0]!.text === localModelPrompt,
            actualAgent: answer.agent === agentId,
            actualModel: answerModel.id === modelId && answerModel.providerID === providerId,
            completed: typeof time.completed === "number" && time.completed > 0,
            nonemptyText: answerText.length > 0,
            noToolCalls: tools.length === 0,
            noErrors: assistants.length > 0 && assistants.every((value) => value.error === undefined),
            notTruncated: answer.finish !== "length" && answer.finish !== "max_tokens",
            realGeneratedTokens: (finalMetrics["llamacpp:tokens_predicted_total"] ?? 0) >
              (baselineMetrics["llamacpp:tokens_predicted_total"] ?? 0),
          }
          const proof = {
            capturedAt: new Date().toISOString(), sourceBase, sessionId,
            pagination: { pagesRead: timeline.pagesRead, terminatedOnEmptyPage: true, messageCount: messages.length },
            userMessageIds: users.map((value) => value.id), assistantMessageId: answer.id,
            agent: { id: agentId, name: agentName }, model: { providerId, modelId, name: modelName },
            prompt: users[0]?.text, answer: answerText.slice(0,16000), finish: answer.finish,
            tokens: answer.tokens, time, toolCallCount: tools.length,
            errors: assistants.filter((value) => value.error !== undefined).map((value) => ({
              messageId: value.id, error: modelError(value.error, installationRoot),
            })),
            checks, baselineMetrics, finalMetrics, timingLines: [...timingLines],
            numericStartup, finalProgress, progressSamples: [...progressSamples],
          }
          await record("local-model-chat-proof", proof)
          if (Object.values(checks).some((value) => !value))
            throw new Error("Actual Chat proof failed: " + Object.entries(checks).filter(([,passed]) => !passed).map(([name]) => name).join(", "))
          return proof
        },
      })
    })
  })).pipe(Effect.provide(LayerNode.compile(AppProcess.node)))).catch(async (error: unknown) => {
    await record("local-model-failure", {
      stage, modelReady, error: modelError(error, installationRoot),
      startupDiagnosticTail: startupLines, timingLines,
      numericStartup, progressSamples,
    })
    throw error
  })
}

function safeDiagnostic(value: string, installationRoot: string) {
  return value.replaceAll(installationRoot, "[installation]")
    .replace(/(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "[authorization removed]")
    .replace(/((?:api[_-]?key|token|password|authorization)\s*[=:]\s*)[^\s,;]+/gi, "$1[removed]")
    .replace(/https?:\/\/[^\s"'<>]+/g, "[endpoint]")
    .slice(0, 800)
}

function modelError(value: unknown, installationRoot: string) {
  const item = object(value)
  const nested = object(item.data)
  const fields = ["_tag", "name", "code", "statusCode", "message"] as const
  const result: Record<string, string | number> = {}
  for (const key of fields) {
    const entry = key === "message" && value instanceof Error ? value.message : item[key] ?? nested[key]
    if (typeof entry === "string") result[key] = safeDiagnostic(entry, installationRoot)
    if (typeof entry === "number") result[key] = entry
  }
  return result
}

function object(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}
}

function rows(value: unknown): JsonObject[] {
  if (!Array.isArray(value)) throw new Error("Expected an actual API result array")
  return value.map((item) => object(item))
}

async function completeMessages(request: APIRequestContext, origin: URL, sessionId: string) {
  const messages: JsonObject[] = []
  const cursors = new Set<string>()
  const ids = new Set<string>()
  let cursor: string | undefined
  for (let page = 1; page <= 10; page++) {
    const url = new URL("/api/session/" + encodeURIComponent(sessionId) + "/message", origin)
    // MessageHandler issues a next cursor for every nonempty page, including
    // the last one. Only an empty read proves exhaustion; cursor excludes order.
    url.search = new URLSearchParams(cursor ? { cursor, limit: "200" } : { order: "asc", limit: "200" }).toString()
    const response = await apiObject(request, url.href)
    const batch = rows(response.data)
    if (batch.length === 0) return { messages, pagesRead: page }
    for (const message of batch) {
      if (typeof message.id !== "string" || ids.has(message.id)) throw new Error("Actual message pagination returned a missing or repeated identity")
      ids.add(message.id)
      messages.push(message)
    }
    const next = object(response.cursor).next
    if (typeof next !== "string" || !next || cursors.has(next)) throw new Error("Actual nonempty message page omitted a new continuation cursor")
    cursors.add(next)
    cursor = next
  }
  throw new Error("Actual Chat timeline exceeded the bounded 2000-message recording proof")
}

async function apiObject(request: APIRequestContext, url: string): Promise<JsonObject> {
  const response = await request.get(url, { timeout: 30_000 })
  if (response.status() !== 200) throw new Error("Authenticated API readback failed (" + response.status() + ")")
  return object(await response.json())
}

function locationURL(origin: URL, route: string, directory: string) {
  const url = new URL(route, origin)
  url.searchParams.set("location[directory]", directory)
  return url.href
}

async function locationRows(request: APIRequestContext, origin: URL, route: string, directory: string) {
  return rows((await apiObject(request, locationURL(origin, route, directory))).data)
}

function policyDigest(value: JsonObject) {
  return createHash("sha256").update(JSON.stringify({
    agent: value.agent, agents: value.agents, disabledProviders: value.disabledProviders,
    permission: value.permission, permissions: value.permissions,
  })).digest("hex")
}

async function downloadVerified(asset: Asset, root: string) {
  const destination = path.join(root, asset.file)
  const response = await fetch(asset.url, { signal: AbortSignal.timeout(360_000) })
  if (!response.ok || !response.body) throw new Error("Pinned asset download failed (" + response.status + ")")
  const reader = response.body.getReader()
  const handle = await open(destination, "wx", 0o600)
  const digest = createHash("sha256")
  let bytes = 0
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      bytes += next.value.byteLength
      if (bytes > asset.bytes) throw new Error("Pinned asset exceeded its verified size")
      digest.update(next.value)
      await handle.writeFile(next.value)
    }
    if (bytes !== asset.bytes || digest.digest("hex") !== asset.sha256)
      throw new Error("Pinned asset checksum or size mismatch: " + asset.file)
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
    await handle.close()
  }
  return destination
}

async function findServer(root: string): Promise<string> {
  const found: string[] = []
  async function visit(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(target)
      else if (entry.isFile() && entry.name === "llama-server") found.push(target)
    }
  }
  await visit(root)
  if (found.length !== 1) throw new Error("Expected exactly one llama-server in the verified archive")
  const binary = await realpath(found[0]!)
  if (!binary.startsWith(await realpath(root) + path.sep)) throw new Error("Model binary escaped its private directory")
  await chmod(binary, 0o700)
  return binary
}

function modelEnvironment(root: string): Record<string, string> {
  const values: Record<string, string> = { PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin", TMPDIR: root }
  for (const name of ["LANG", "LC_ALL", "TZ"]) if (process.env[name]) values[name] = process.env[name]!
  return values
}

async function unusedPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (address === null || typeof address === "string") {
        server.close(() => reject(new Error("Could not allocate a loopback model port")))
        return
      }
      server.close((error) => error ? reject(error) : resolve(address.port))
    })
  })
}

async function waitForModel(origin: string) {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    const health = await fetch(origin + "/health", { signal: AbortSignal.timeout(2_000) }).catch(() => undefined)
    if (health?.status === 200) {
      const response = await fetch(origin + "/v1/models", { signal: AbortSignal.timeout(5_000) })
      if (response.status === 200 && rows(object(await response.json()).data).some((value) => value.id === modelId)) return
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error("Pinned local model did not become ready before the CI deadline")
}

async function modelCapacity(origin: string) {
  // Read public server metadata, never a completion/warm-up or a rewritten prompt.
  const [modelsResponse, propsResponse] = await Promise.all([
    fetch(origin + "/v1/models", { signal: AbortSignal.timeout(5_000) }),
    fetch(origin + "/props", { signal: AbortSignal.timeout(5_000) }),
  ])
  if (!modelsResponse.ok || !propsResponse.ok) throw new Error("Actual model capacity metadata unavailable")
  const model = rows(object(await modelsResponse.json()).data).find((value) => value.id === modelId)
  const trainingContext = object(model?.meta).n_ctx_train
  const props = object(await propsResponse.json())
  const context = object(props.default_generation_settings).n_ctx
  if (typeof trainingContext !== "number" || trainingContext < contextTokens)
    throw new Error("Pinned GGUF metadata does not support the requested " + contextTokens + "-token context")
  if (context !== contextTokens || props.total_slots !== 1)
    throw new Error("Owned model server did not report the requested single-slot context")
  return { context, trainingContext }
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

async function modelSlots(origin: string): Promise<ModelSlotProgress[]> {
  const response = await fetch(origin + "/slots", { signal: AbortSignal.timeout(5_000) })
  if (!response.ok) throw new Error("Local model slot metrics unavailable")
  // b12632 may return prompt/generated/grammar here. Never forward or store that
  // response: construct only the fixed numeric/boolean projection below.
  return rows(await response.json()).map((slot) => {
    const next = object(Array.isArray(slot.next_token) ? slot.next_token[0] : slot.next_token)
    const params = object(slot.params)
    return {
      id: finiteNumber(slot.id), taskId: finiteNumber(slot.id_task), contextTokens: finiteNumber(slot.n_ctx),
      // This is the current prefix, not the full input size during prefill.
      prefixTokens: finiteNumber(slot.n_prompt_tokens), processedTokens: finiteNumber(slot.n_prompt_tokens_processed),
      cachedTokens: finiteNumber(slot.n_prompt_tokens_cache), decodedTokens: finiteNumber(next.n_decoded),
      remainingTokens: finiteNumber(next.n_remain), predictLimit: finiteNumber(params.n_predict),
      processing: typeof slot.is_processing === "boolean" ? slot.is_processing : undefined,
    }
  })
}

async function ownedProcessResources(pid: number): Promise<ProcessResources> {
  // ChildProcessHandle.pid is the branded numeric PID of the process this scope
  // owns. Read only Linux numeric accounting; never command line or environment.
  if (!Number.isSafeInteger(pid) || pid <= 1) throw new Error("Owned model process identity unavailable")
  const [statText, statusText] = await Promise.all([
    readFile("/proc/" + pid + "/stat", "utf8"), readFile("/proc/" + pid + "/status", "utf8"),
  ])
  const endName = statText.lastIndexOf(")")
  if (endName < 0 || Number(statText.slice(0, statText.indexOf(" "))) !== pid)
    throw new Error("Owned model process accounting identity mismatch")
  const fields = statText.slice(endName + 2).trim().split(/\s+/)
  // The first remaining field is Linux stat field 3; utime/stime/starttime are 14/15/22.
  const [userTicks, systemTicks, startTimeTicks] = [fields[11], fields[12], fields[19]].map(Number)
  if (![userTicks, systemTicks, startTimeTicks].every((value) => Number.isSafeInteger(value) && value! >= 0))
    throw new Error("Owned model CPU accounting unavailable")
  const bytes = (name: "VmRSS" | "VmHWM" | "VmSwap") => {
    const match = statusText.match(new RegExp("^" + name + ":\\s*(\\d+)\\s+kB$", "m"))
    return match ? Number(match[1]) * 1024 : undefined
  }
  const threads = statusText.match(/^Threads:\s*(\d+)\s*$/m)
  return { pid, startTimeTicks: startTimeTicks!, cpuTicks: userTicks! + systemTicks!,
    rssBytes: bytes("VmRSS"), peakRssBytes: bytes("VmHWM"), swapBytes: bytes("VmSwap"),
    threads: threads ? Number(threads[1]) : undefined }
}

async function metrics(origin: string) {
  const response = await fetch(origin + "/metrics", { signal: AbortSignal.timeout(5_000) })
  if (!response.ok) throw new Error("Local model numeric metrics unavailable")
  const result: Record<string, number> = {}
  for (const line of (await response.text()).split("\n")) {
    const match = line.match(/^(llamacpp:(?:prompt_tokens_total|prompt_seconds_total|tokens_predicted_total|tokens_predicted_seconds_total|requests_processing|requests_deferred|n_tokens_max|n_decode_total))\s+([0-9.eE+-]+)\s*$/)
    if (match && Number.isFinite(Number(match[2]))) result[match[1]!] = Number(match[2])
  }
  return result
}
