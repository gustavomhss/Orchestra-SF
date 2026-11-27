import { expect, test } from "bun:test"
import { Buffer } from "node:buffer"
import { e13Modes, runSfE13Control } from "./fixture/sf613-preview-e13-observation.ts"

/** Synthetic observer mechanisms and real denial/early-return callers; no CPU or latency claim. */
test("E13 causal observation preserves work and bounds its Request phase stream", async () => {
  const reports = []
  for (const mode of e13Modes) {
    const result = await runSfE13Control(import.meta.path, mode)
    expect(result.report.mode).toBe(mode)
    expect(result.report.synthetic).toBe(true)
    expect(result.report.requestGets).toBe(0)
    expect(result.omniSpawns).toBe(1)
    expect(result.omniDelegations).toBe(0)
    reports.push(result)
  }
  expect(reports.length).toBe(7)
  expect(new Set(reports.map((item) => item.pid)).size).toBe(7)
  const line = "SF_E13_OBSERVATION_CONTROL " + JSON.stringify({
    schema: "sf-preview-e13-control-v1", synthetic: true, childModes: [...e13Modes], reports,
  }) + "\n"
  expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(16_384)
  process.stdout.write(line)
}, 35_000)
