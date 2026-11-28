import { expect, test } from "bun:test"
import { Buffer } from "node:buffer"
import { e14Modes, runSfE14Control } from "./fixture/sf613-preview-e14-observation.ts"

/** Synthetic mechanisms plus real analysis with controlled ports; no installed authority or latency claim. */
test("E14 observation reserves the first analysis and preserves its real calls and values", async () => {
  const reports = []
  for (const mode of e14Modes) {
    const result = await runSfE14Control(import.meta.path, mode)
    expect(result.report.mode).toBe(mode)
    expect(result.report.synthetic).toBe(true)
    expect(result.report.requestGets).toBe(0)
    expect(result.omniSpawns).toBe(1)
    expect(result.omniDelegations).toBe(0)
    reports.push(result)
  }
  expect(reports.length).toBe(8)
  expect(new Set(reports.map((item) => item.pid)).size).toBe(8)
  const line = "SF_E14_OBSERVATION_CONTROL " + JSON.stringify({
    schema: "sf-preview-e14-control-v1", synthetic: true, childModes: [...e14Modes], reports,
  }) + "\n"
  expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(16_384)
  process.stdout.write(line)
}, 35_000)
