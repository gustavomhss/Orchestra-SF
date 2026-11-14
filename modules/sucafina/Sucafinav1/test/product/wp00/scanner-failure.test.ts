import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { detectAvailableScanner, KNOWN_SCANNERS, runScanner } from "@orchestra/atlas-boundary/native-memory"
import { createMemoryEmit } from "@orchestra/atlas-boundary/business-memory-ports"
import type { MemoryRecord } from "@orchestra/atlas-boundary/business-memory-ports"
import { createSfAtlasScanner } from "../../../product/host-binding/atlas-scanner.ts"
import { createSfAtlasDurableMemory } from "../../../product/host-binding/atlas-store.ts"

test("C17 controlled invocation failure reaches the real adapter and refuses append", async () => {
  expect(process.env.CI).toBe("true")
  expect(process.env.GITHUB_RUN_ID ?? "").toMatch(/^\d+$/)
  expect(process.env.GITHUB_SHA ?? "").toMatch(/^[a-f0-9]{40}$/)
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "wp00-scanner-failure-"))
  try {
    await chmod(directory, 0o700)
    const canonical = KNOWN_SCANNERS.find((scanner) => scanner.name === "trufflehog")
    if (!canonical) throw new Error("The canonical scanner descriptor is unavailable")
    const missing = path.join(directory, "nonexistent-scanner-input.ts")
    expect(await Bun.file(missing).exists()).toBe(false)
    // Bun is the real runner executable, not an installed scanner. Its missing-script failure
    // exercises an undocumented exit through the real host-configurable scanner seam.
    // No program is created to manufacture clean/hit results, and PATH is never changed.
    const invocation = { ...canonical, command: await realpath(process.execPath), args: ["run", missing] }
    expectSpawn(import.meta.path)
    const execution = await Effect.runPromise(AppProcess.Service.use((service) => service.run(
      ChildProcess.make(invocation.command, invocation.args, { cwd: directory, extendEnv: true, stdin: "ignore" }),
      { timeout: "5 seconds", maxOutputBytes: 4096, maxErrorBytes: 4096 },
    )).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
    const detected = detectAvailableScanner([invocation])
    const record: MemoryRecord = {
      owner: "wp00-controlled-invocation-failure", kind: "task",
      entry: { taskId: "synthetic-invalid-invocation", attempted: ["controlled missing-script regression"], failedWith: [], stoppedAt: "probe", lesson: "Synthetic clean record; unavailable scanning must not append." },
    }
    const verdict = runScanner(invocation, record)
    const scanner = createSfAtlasScanner({ scanners: [invocation] })
    const adapter = { returned: null as boolean | null, error: null as string | null }
    try { adapter.returned = scanner.scan(record) }
    catch (error) { adapter.error = error instanceof Error ? error.message : String(error) }
    const partition: Parameters<typeof createSfAtlasDurableMemory>[0] = { events: [] }
    const store = createSfAtlasDurableMemory(partition)
    const result = createMemoryEmit({ store, actor: record.owner, scanner }).emit(record.entry)
    const observed = {
      detectedCommand: detected?.command ?? null,
      exitAllowedAsClean: invocation.cleanExitCodes.includes(execution.exitCode),
      exitAllowedAsHit: invocation.hitExitCodes.includes(execution.exitCode),
      stderrNamesMissingScript: execution.stderr.toString("utf8").includes(missing),
      stderrTruncated: execution.stderrTruncated,
      verdict,
      adapter,
      write: result.ok ? { ok: true } : { ok: false, refusal: result.refusal, scanner: result.scanner ?? null },
      records: store.read().store.length,
      events: partition.events,
    }
    console.log("WP00_SCANNER_CONTROLLED_FAILURE " + JSON.stringify({
      schema: "sf-wp00-scanner-controlled-failure-v1", runId: process.env.GITHUB_RUN_ID, snapshotSha: process.env.GITHUB_SHA,
      evidenceKind: "controlled-invocation-failure-regression", runtimeExecutable: invocation.command, runtimeVersion: Bun.version,
      classifierDescriptor: canonical.name, observedExitCode: execution.exitCode, observed,
      installedScanner: "NOT_PROVEN", c17Status: "HOLD", gnativeStatus: "NOT_PROVEN",
      limitation: "Real Bun failure, canonical subprocess classifier, product adapter and Atlas write door only. Bun is not a scanner; no installed gitleaks/trufflehog, timeout, clean/hit detection or durable host qualification is claimed.",
    }))
    expect(observed).toEqual({
      detectedCommand: invocation.command,
      exitAllowedAsClean: false,
      exitAllowedAsHit: false,
      stderrNamesMissingScript: true,
      stderrTruncated: false,
      verdict: "could-not-run",
      adapter: { returned: null, error: "scanner unavailable" },
      write: { ok: false, refusal: "scanner-unavailable", scanner: canonical.name },
      records: 0,
      events: [],
    })
  } finally { await rm(directory, { recursive: true, force: true }) }
}, 30_000)
