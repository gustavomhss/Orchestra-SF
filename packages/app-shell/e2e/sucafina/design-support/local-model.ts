import { createHash } from "node:crypto"
import { chmod, mkdir, mkdtemp, open, readdir, realpath, rm, stat } from "node:fs/promises"
import { createServer } from "node:net"
import { freemem, totalmem, tmpdir } from "node:os"
import path from "node:path"
import type { APIRequestContext } from "@playwright/test"
import type { ChildProcessHandle } from "effect/unstable/process/ChildProcessSpawner"
import type { DesignInstallation } from "./installation"

// Recording-only helper. No product files, credentials, agent definitions, or policies are changed.
// Pins and licenses: scripts/onboarding/ai/SOURCES.md on the isolated recording branch.
const sourceBase = "55d332a2451d2146e825d494b87878875d63b1c7"
const providerId = "onboarding-local"
const modelId = "qwen3-demo"
const modelName = "Qwen3-0.6B · local demo"
const contextTokens = 32_768
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
    file: "Qwen3-0.6B-Q8_0.gguf",
    url: "https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/resolve/1eaf4d9657fe65ad10a51eab76a8db5b363bddaa/Qwen3-0.6B-Q8_0.gguf",
    sha256: "9465e63a22add5354d9bb4b99e90117043c7124007664907259bd16d043bb031",
    bytes: 639446688,
    sourceCommit: "1eaf4d9657fe65ad10a51eab76a8db5b363bddaa",
    license: "Apache-2.0",
  },
} as const

export const localModelPrompt = "Prepare a regional IT review from these example inputs: one infrastructure position is planned at 1.0 FTE, with 0.9 FTE proposed. A support purchase has three quotations; one is selected, with final approval pending. In exactly three short bullets, give the staffing review question, the evidence needed for the selected quote, and the next human review step. Do not use tools, change records, or claim you read the business system. /no_think"

export type LocalModelRecording = {
  providerId: string
  modelId: string
  modelName: string
  agentId: string
  agentName: string
  prompt: string
  captureProof: (sessionId: string) => Promise<Record<string, unknown>>
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
  // The observed AI3 Maestro exposes 103 tools and 67 skills. Preserve all
  // instructions/schemas and use a supported context, with explicit RAM room.
  const memoryBeforeLoad = { totalBytes: totalmem(), freeBytes: freemem() }
  const estimatedF16KVBytes = 28 * 8 * 128 * 2 * 2 * contextTokens
  const requiredFreeBytes = estimatedF16KVBytes + assets.model.bytes + 1024 ** 3
  if (memoryBeforeLoad.freeBytes < requiredFreeBytes)
    throw new Error("Runner lacks measured RAM for the full 32768-token local context: free=" + memoryBeforeLoad.freeBytes + ", required=" + requiredFreeBytes)
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
      "-ngl", "0", "-t", "2", "-tb", "2", "-c", String(contextTokens), "-np", "1", "-n", "256",
      "--jinja", "--chat-template-kwargs", '{"enable_thinking":false}', "--reasoning", "off",
      "--temp", "0.7", "--top-k", "20", "--top-p", "0.8", "--min-p", "0", "--presence-penalty", "1.5",
      "--metrics",
    ]
    stage = "start-model"
    const child = yield* launcher.spawn(ChildProcess.make(binary, args, {
      cwd: root, env: environment, extendEnv: false, stdin: "ignore", stdout: "pipe", stderr: "pipe",
      killSignal: "SIGTERM", forceKillAfter: "10 seconds",
    }))
    owned.child = child
    const collect = (line: string) => Effect.sync(() => {
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
      await record("local-model-ready", {
        sourceBase, readyAt: new Date().toISOString(), assets,
        binaryVersion: versionText.replaceAll(root, "[temporary-model-directory]").slice(0,2000),
        provider: { id: providerId, modelId, modelName, endpoint: "owned loopback /v1", credentialsRequired: false },
        agent: { id: agentId, name: agentName, engine: agent.engine ?? "orchestra (default)", mode: agent.mode },
        policyUnchanged: true, policySha256: originalPolicy,
        server: { cpuOnly: true, threads: 2, context: contextTokens, parallel: 1, maximumDefaultOutputTokens: 256, thinking: false,
          observedContext: capacity.context, modelTrainingContext: capacity.trainingContext },
        memory: { ...memoryBeforeLoad, estimatedF16KVBytes, requiredFreeBytes, freeAfterLoadBytes: freemem() },
        catalog: { providerPresent: true, modelEnabled: true, defaultMatches: true,
          reportedLimit: object(model.limit), limitsConfiguredViaAPI: false },
        baselineMetrics,
      })
      stage = "actual-chat"
      return use({
        providerId, modelId, modelName, agentId, agentName, prompt: localModelPrompt,
        captureProof: async (sessionId) => {
          if (!/^[A-Za-z0-9_-]{8,160}$/.test(sessionId)) throw new Error("Supply the actual parsed Chat session ID")
          const url = new URL("/api/session/" + encodeURIComponent(sessionId) + "/message", origin)
          url.search = new URLSearchParams({ order: "asc", limit: "200" }).toString()
          const response = await apiObject(request, url.href)
          if (object(response.cursor).next) throw new Error("Chat message proof exceeded one complete page")
          const messages = rows(response.data)
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
            userMessageIds: users.map((value) => value.id), assistantMessageId: answer.id,
            agent: { id: agentId, name: agentName }, model: { providerId, modelId, name: modelName },
            prompt: users[0]?.text, answer: answerText.slice(0,16000), finish: answer.finish,
            tokens: answer.tokens, time, toolCallCount: tools.length,
            errors: assistants.filter((value) => value.error !== undefined).map((value) => ({
              messageId: value.id, error: modelError(value.error, installationRoot),
            })),
            checks, baselineMetrics, finalMetrics, timingLines: [...timingLines],
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
    throw new Error("Pinned GGUF metadata does not support the requested 32768-token context")
  if (context !== contextTokens || props.total_slots !== 1)
    throw new Error("Owned model server did not report the requested single-slot context")
  return { context, trainingContext }
}

async function metrics(origin: string) {
  const response = await fetch(origin + "/metrics", { signal: AbortSignal.timeout(5_000) })
  if (!response.ok) throw new Error("Local model numeric metrics unavailable")
  const result: Record<string, number> = {}
  for (const line of (await response.text()).split("\n")) {
    const match = line.match(/^(llamacpp:(?:prompt_tokens_total|prompt_seconds_total|tokens_predicted_total|tokens_predicted_seconds_total|requests_processing|requests_deferred|n_tokens_max))\s+([0-9.eE+-]+)\s*$/)
    if (match && Number.isFinite(Number(match[2]))) result[match[1]!] = Number(match[2])
  }
  return result
}
