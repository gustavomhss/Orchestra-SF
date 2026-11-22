import { expect, test } from "bun:test"
import { admitBusinessBundle } from "../script/build"

const root = new URL("../../../../", import.meta.url)
const read = (file: string) => Bun.file(new URL(file, root)).text()

test("canonical admission rejects packaging counterexamples", async () => {
  const input = {
    edges: 1,
    emitter: await read("modules/atlas/packages/adapter-io/src/memory-emit.ts"),
    entry: await read("modules/atlas/boundary/src/business-memory-entry.ts"),
    source: await read("modules/atlas/boundary/src/generated/business-memory-ports.js"),
    native: await read("modules/atlas/packages/adapter-io/src/native-bound.ts"),
    allowlist: await read("script/spawn-allowlist.json"),
  }
  expect(() => admitBusinessBundle(input)).not.toThrow()
  expect(() => admitBusinessBundle({ ...input, source: `${input.source}\nexport { runScanner } from "@orchestra/atlas-boundary/native-memory"` })).toThrow()
  expect(() => admitBusinessBundle({ ...input, edges: 0 })).toThrow()
  expect(() => admitBusinessBundle({ ...input, source: `${input.source}\nimport(variable)` })).toThrow()
  const copied = input.source.replace(/import\s*\{\s*NO_SCANNER_NAME\s*\}\s*from\s*["']@orchestra\/atlas-boundary\/native-memory["'];?/, 'const NO_SCANNER_NAME = "no-scanner-on-path";')
  expect(copied).not.toBe(input.source)
  expect(() => admitBusinessBundle({ ...input, source: copied })).toThrow()
  expect(() => admitBusinessBundle({ ...input, allowlist: `${input.allowlist} ` })).toThrow()
  expect(() => admitBusinessBundle({ ...input, native: `${input.native}\nexport { createMemoryEmit } from "./memory-emit.js"` })).toThrow()
})

test("native API retains bound memory and business API exposes real doors", async () => {
  const native = await import("../src/generated/native-memory.js")
  const business = await import("../src/generated/business-memory-ports.js")
  expect(typeof native.createNativeMemory).toBe("function")
  expect(typeof native.runScanner).toBe("function")
  expect(typeof native.detectAvailableScanner).toBe("function")
  expect("createMemoryEmit" in native).toBe(false)
  expect("createMemoryRead" in native).toBe(false)
  expect("createDurableMemory" in native).toBe(false)
  expect(typeof business.createMemoryEmit).toBe("function")
  expect(typeof business.createMemoryRead).toBe("function")
  expect(typeof business.versioned).toBe("function")
  expect(typeof business.respawnFromRecord).toBe("function")
  expect("runScanner" in business).toBe(false)
})
