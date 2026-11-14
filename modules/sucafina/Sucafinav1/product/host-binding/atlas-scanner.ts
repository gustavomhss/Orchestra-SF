import { detectAvailableScanner, KNOWN_SCANNERS, NO_SCANNER_NAME, runScanner } from "@orchestra/atlas-boundary/native-memory"
import type { ScannerBinarySpec } from "@orchestra/atlas-boundary/native-memory"
import type { MemoryRecord, NamedScanner } from "@orchestra/atlas-boundary/business-memory-ports"
import type { AppProcess } from "@orchestra/core/process"
import { BackendToolkit } from "@orchestra/core/backend-toolkit"
import { realpath } from "node:fs/promises"
import path from "node:path"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"

/** Probe the same executable and invocation specification that the memory writer will pin. */
export async function probeSfAtlasScanner(process: AppProcess.Interface) {
  const known = KNOWN_SCANNERS.find((spec) => spec.name === "gitleaks")
  if (!known) return undefined
  // The existing toolkit verifies the pinned artifact; never select an executable from model input or mutable PATH.
  const ready = await Effect.runPromise(BackendToolkit.ensure("gitleaks")).catch(() => undefined)
  const command = ready ? await realpath(ready.executable).catch(() => undefined) : undefined
  if (!command || !path.isAbsolute(command)) return undefined
  const spec = { ...known, command }
  const result = await Effect.runPromise(process.run(ChildProcess.make(spec.command, ["--version"], { extendEnv: true, stdin: "ignore" }), { timeout: "5 seconds" })).catch(() => undefined)
  if (!result || result.exitCode !== 0 || result.stdoutTruncated) return undefined
  const version = result.stdout.toString("utf8").trim()
  if (!version) return undefined
  return { spec: Object.freeze(spec), version }
}

/** The host supplies this configuration; it is never taken from a model tool argument. */
export function createSfAtlasScanner(config: { scanners?: readonly ScannerBinarySpec[]; timeoutMs?: number } = {}): NamedScanner {
  const scanner = detectAvailableScanner(config.scanners ?? KNOWN_SCANNERS)
  if (!scanner) return { name: NO_SCANNER_NAME, scan: () => { throw new Error("scanner unavailable") } }
  return {
    name: scanner.name,
    scan(record: MemoryRecord) {
      const result = runScanner(scanner, record, config.timeoutMs ?? 5_000)
      if (result === "could-not-run") throw new Error("scanner unavailable")
      return result === "hit"
    },
  }
}
