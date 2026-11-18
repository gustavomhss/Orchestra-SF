#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { diffQueues, driftLines, fetchStableOpenPrs, hasDrift, validateSnapshot } from "./queue-lib.mjs"

const SNAPSHOT = resolve(fileURLToPath(new URL("../../", import.meta.url)),
  "docs/qa/sucafina/consolidation/queue-freeze.json")

try {
  if (process.argv.length !== 2) throw new Error("INVALID_ARGUMENT: queue-drift.mjs takes no arguments")
  const snapshot = validateSnapshot(JSON.parse(readFileSync(SNAPSHOT, "utf8")))
  const live = fetchStableOpenPrs()
  const result = diffQueues(snapshot.prs, live)
  console.log(`FROZEN_AT ${snapshot.capturedAt}; frozen=${snapshot.prs.length}; live=${live.length}; unchanged=${result.unchangedPrs.length}`)
  if (hasDrift(result)) {
    console.error(driftLines(result).join("\n"))
    process.exitCode = 1
  } else {
    console.log("QUEUE_DRIFT_OK: no new PRs, closures, or head-SHA movements")
  }
} catch (error) {
  console.error(`QUEUE_DRIFT_FAILED: ${error.message}`)
  process.exitCode = 1
}
