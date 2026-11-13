import { detectAvailableScanner, KNOWN_SCANNERS, NO_SCANNER_NAME, runScanner } from "@orchestra/atlas-boundary/native-memory"
import type { ScannerBinarySpec } from "@orchestra/atlas-boundary/native-memory"
import type { MemoryRecord, NamedScanner } from "@orchestra/atlas-boundary/business-memory-ports"

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
