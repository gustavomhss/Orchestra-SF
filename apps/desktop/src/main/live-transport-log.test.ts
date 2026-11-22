import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { transportLog } from "./live-transport-log"

test("transport log writes ordered JSON lines per meeting", async () => {
  const log = transportLog(join(await mkdtemp(join(tmpdir(), "live-log-")), "logs"), "meeting-1")
  log.write({ event: "open", attempt: 0, replayFromMs: 0 })
  log.write({ event: "segment", track: "them", startMs: 0, endMs: 900, latencyMs: 350 })
  await log.flush()
  const lines = (await Bun.file(log.file).text()).trim().split("\n").map((line) => JSON.parse(line))
  expect(log.file.endsWith("meeting-1.jsonl")).toBe(true)
  expect(lines.map((line) => line.event)).toEqual(["open", "segment"])
  expect(typeof lines[0].at).toBe("number")
})

test("transport log redacts credentials before appending parseable JSONL", async () => {
  const directory = await mkdtemp(join(tmpdir(), "live-log-redaction-"))
  try {
    const log = transportLog(directory, "meeting-2")
    log.write({
      event: "capture",
      state: "failed",
      reason: 'Connection closed: https://user:fixture-password@example.invalid/?auth_token=fixture-token&keep=yes',
    })
    log.write({ event: "answer", kind: "answer", latencyMs: 42, failed: 'Authorization: "Bearer fixture-header"' })
    await log.flush()
    const raw = await Bun.file(log.file).text()
    expect(raw).not.toContain("fixture-")
    expect(raw.trim().split("\n").map((line) => JSON.parse(line))).toMatchObject([
      { event: "capture", state: "failed", reason: "Connection closed: https://[redacted]@example.invalid/?auth_token=[redacted]&keep=yes" },
      { event: "answer", kind: "answer", latencyMs: 42, failed: 'Authorization: "[redacted]"' },
    ])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
