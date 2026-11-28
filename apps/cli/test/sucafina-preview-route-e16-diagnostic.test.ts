import { expect, test } from "bun:test"
import { Buffer } from "node:buffer"
import { e16Modes, runSfE16Control } from "./fixture/sucafina-preview-route-e16-diagnostic.ts"

/** Controlled launcher and observer mechanisms, including a native fixture; no installed UI qualification or latency claim. */
test("E16 binding observation preserves invocation ownership and the first five validations", async () => {
  const reports = []
  for (const mode of e16Modes) {
    const result = await runSfE16Control(import.meta.path, mode)
    expect(result.report.mode).toBe(mode)
    expect(result.report.synthetic).toBe(true)
    expect(result.report.requestGets).toBe(0)
    expect(result.omniSpawns).toBe(1)
    expect(result.omniDelegations).toBe(0)
    reports.push(result)
  }
  expect(reports.length).toBe(e16Modes.length)
  expect(new Set(reports.map((item) => item.pid)).size).toBe(e16Modes.length)
  const line = "SF_E16_ROUTE_CONTROL " + JSON.stringify({
    schema: "sf-preview-e16-control-v1", synthetic: true, childModes: [...e16Modes], reports,
  }) + "\n"
  expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(16_384)
  process.stdout.write(line)
}, 45_000)
