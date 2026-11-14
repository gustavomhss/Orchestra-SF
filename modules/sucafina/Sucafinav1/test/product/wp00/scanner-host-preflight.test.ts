import { expect, test } from "bun:test"
import { generateKeyPairSync } from "node:crypto"
import { realpath } from "node:fs/promises"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { detectAvailableScanner, NO_SCANNER_NAME, runScanner } from "@orchestra/atlas-boundary/native-memory"
import { createMemoryEmit } from "@orchestra/atlas-boundary/business-memory-ports"
import type { MemoryRecord } from "@orchestra/atlas-boundary/business-memory-ports"
import { createSfAtlasScanner, probeSfAtlasScanner } from "../../../product/host-binding/atlas-scanner.ts"
import { createSfAtlasDurableMemory } from "../../../product/host-binding/atlas-store.ts"

test("the Actions runner observes its real scanner or records HOLD with a refused memory write", async () => {
  // test-ci deliberately sets GITHUB_ACTIONS=false for Bun; these identify the actual hosted job.
  expect(process.env.CI).toBe("true")
  expect(process.env.GITHUB_RUN_ID ?? "").toMatch(/^\d+$/)
  expect(process.env.GITHUB_SHA ?? "").toMatch(/^[a-f0-9]{40}$/)
  const started = performance.now()
  const detected = detectAvailableScanner()
  const scanner = createSfAtlasScanner()
  const identity = detected ? await executableIdentity(detected.command) : null
  const version = identity ? await Effect.runPromise(AppProcess.Service.use((process) => Effect.promise(async () => {
    // Register only on the branch that actually invokes AppProcess, never for an absent binary.
    expectSpawn(import.meta.path)
    const result = await Effect.runPromise(process.run(
      ChildProcess.make(identity.realPath, ["--version"], { extendEnv: true, stdin: "ignore" }),
      { timeout: "5 seconds", maxOutputBytes: 4096, maxErrorBytes: 4096 },
    )).catch(() => undefined)
    const product = await probeSfAtlasScanner(process)
    return {
      exitCode: result?.exitCode ?? null,
      text: result?.exitCode === 0 && !result.stdoutTruncated ? result.stdout.toString("utf8").trim() || null : null,
      productName: product?.spec.name ?? null,
      productVersion: product?.version ?? null,
    }
  })).pipe(Effect.provide(LayerNode.compile(AppProcess.node)))) : null

  const clean: MemoryRecord = {
    owner: "wp00-scanner-preflight", kind: "task",
    entry: { taskId: "synthetic-clean", attempted: ["runner scanner preflight"], failedWith: [], stoppedAt: "probe", lesson: "Synthetic clean diagnostic record." },
  }
  // Ephemeral, unused synthetic key; neither the key nor a successful canary record is printed.
  const canary: MemoryRecord = {
    ...clean,
    entry: {
      taskId: "synthetic-canary", attempted: ["runner scanner preflight"], failedWith: [], stoppedAt: "probe",
      lesson: generateKeyPairSync("rsa", { modulusLength: 1024, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs1", format: "pem" } }).privateKey,
    },
  }
  const cleanVerdict = detected ? runScanner(detected, clean) : null
  const canaryVerdict = detected ? runScanner(detected, canary) : null
  // These are the actual product snapshot adapter and Atlas write door, not a scanner/store mock.
  const partition: Parameters<typeof createSfAtlasDurableMemory>[0] = { events: [] }
  const store = createSfAtlasDurableMemory(partition)
  const writer = createMemoryEmit({ store, actor: clean.owner, scanner })
  const cleanWrite = summarizeWrite(writer.emit(clean.entry))
  const beforeCanary = digest(JSON.stringify(partition.events))
  const cleanRecords = store.read().store.length
  const canaryWrite = summarizeWrite(writer.emit(canary.entry))
  const afterCanary = digest(JSON.stringify(partition.events))
  const finalRecords = store.read().store.length
  const after = detected ? await executableIdentity(detected.command) : null
  const verified = !!identity && !!version?.text && version.productVersion === version.text &&
    cleanVerdict === "clean" && canaryVerdict === "hit" && cleanWrite.ok && !canaryWrite.ok &&
    beforeCanary === afterCanary && finalRecords === 1 && JSON.stringify(after) === JSON.stringify(identity)
  console.log("WP00_SCANNER_PREFLIGHT " + JSON.stringify({
    schema: "sf-wp00-scanner-host-preflight-v1",
    environment: "github-actions-runner",
    runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    snapshotSha: process.env.GITHUB_SHA, runnerOs: process.env.RUNNER_OS, runnerArch: process.env.RUNNER_ARCH,
    runnerScannerStatus: !detected ? "absent" : verified ? "verified" : "incomplete-or-unusable",
    scanner: { name: detected?.name ?? null, command: detected?.command ?? null, args: detected?.args ?? null,
      resolvedPath: identity?.resolvedPath ?? null, realPath: identity?.realPath ?? null, sha256: identity?.sha256 ?? null,
      version: version?.text ?? null, versionExitCode: version?.exitCode ?? null, productProbeVersion: version?.productVersion ?? null },
    probes: { clean: cleanVerdict, canary: canaryVerdict },
    writes: { clean: cleanWrite, canary: canaryWrite, cleanRecords, finalRecords, canaryChangedPartition: beforeCanary !== afterCanary },
    elapsedMs: Math.ceil(performance.now() - started),
    c17Status: "HOLD", gnativeStatus: "NOT_PROVEN",
    limitation: "Runner scanner/write-door evidence only; no installed-host identity, native provider, durable host transaction or full C17 acceptance. Executable identity is observed here, not a new product pin.",
  }))

  expect(scanner.name).toBe(detected?.name ?? NO_SCANNER_NAME)
  if (!detected) {
    expect(identity).toBeNull()
    expect(version).toBeNull()
    expect(() => scanner.scan(clean)).toThrow("scanner unavailable")
    expect(cleanWrite).toEqual({ ok: false, refusal: "scanner-unavailable", scanner: NO_SCANNER_NAME })
    expect(canaryWrite).toEqual({ ok: false, refusal: "scanner-unavailable", scanner: NO_SCANNER_NAME })
    expect(finalRecords).toBe(0)
    expect(partition.events.length).toBe(0)
    return
  }
  // A wrong invocation that treats clean input as a hit, or lets the canary through, fails.
  expect(cleanVerdict).not.toBe("hit")
  expect(canaryVerdict).not.toBe("clean")
  expect(cleanWrite.ok).toBe(cleanVerdict === "clean")
  expect(cleanRecords).toBe(cleanVerdict === "clean" ? 1 : 0)
  if (cleanVerdict === "could-not-run")
    expect(cleanWrite).toEqual({ ok: false, refusal: "scanner-unavailable", scanner: detected.name })
  expect(canaryWrite).toEqual({ ok: false, refusal: canaryVerdict === "hit" ? "scanner-blocked" : "scanner-unavailable", scanner: detected.name })
  expect(finalRecords).toBe(cleanRecords)
  expect(afterCanary).toBe(beforeCanary)
  if (identity) {
    expect(identity.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(after).toEqual(identity)
  }
  if (version?.text) {
    expect(version.productName).toBe(detected.name)
    expect(version.productVersion).toBe(version.text)
  }
}, 120_000)

async function executableIdentity(command: string) {
  const resolvedPath = Bun.which(command)
  if (!resolvedPath) return null
  const realPath = await realpath(resolvedPath).catch(() => null)
  if (!realPath) return null
  const bytes = await Bun.file(realPath).arrayBuffer().catch(() => null)
  return bytes ? { resolvedPath, realPath, sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex") } : null
}

function digest(value: string) {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex")
}

function summarizeWrite(result: ReturnType<ReturnType<typeof createMemoryEmit>["emit"]>) {
  return result.ok ? { ok: true as const } : { ok: false as const, refusal: result.refusal, scanner: result.scanner ?? null }
}

