#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { diffQueues, driftLines, fetchStableOpenPrs, ghJson, hasDrift, REPO, validateSnapshot } from "./queue-lib.mjs"

const SNAPSHOT = resolve(fileURLToPath(new URL("../../", import.meta.url)),
  "docs/qa/sucafina/consolidation/queue-freeze.json")
const LABEL = "consolidation-frozen"
const COLOR = "808080"

function createLabelIfMissing() {
  try {
    ghJson(["api", `repos/${REPO}/labels/${LABEL}`])
    return
  } catch (error) {
    if (!/HTTP 404/.test(error.message)) throw error
  }
  try {
    ghJson(["api", "--method", "POST", `repos/${REPO}/labels`,
      "-f", `name=${LABEL}`, "-f", `color=${COLOR}`])
  } catch (error) {
    // Another operator may have created the label between GET and POST.
    if (!/HTTP 422/.test(error.message)) throw error
    ghJson(["api", `repos/${REPO}/labels/${LABEL}`])
  }
}

function main() {
  const args = process.argv.slice(2)
  if (args.some(arg => arg !== "--apply") || args.filter(arg => arg === "--apply").length > 1) {
    throw new Error("INVALID_ARGUMENT: usage node script/sf-ci/freeze-queue.mjs [--apply]")
  }
  const apply = args.includes("--apply")
  const live = fetchStableOpenPrs()
  let snapshot
  try {
    snapshot = validateSnapshot(JSON.parse(readFileSync(SNAPSHOT, "utf8")))
    const drift = diffQueues(snapshot.prs, live)
    if (hasDrift(drift)) {
      throw new Error(`EXISTING_SNAPSHOT_DRIFT: refusing to replace freeze:\n${driftLines(drift).join("\n")}`)
    }
    console.log(`EXISTING_FREEZE: ${snapshot.capturedAt}; retaining original snapshot`)
  } catch (error) {
    if (error.code !== "ENOENT") throw error
    snapshot = { capturedAt: new Date().toISOString(), prs: live }
    mkdirSync(dirname(SNAPSHOT), { recursive: true })
    writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2) + "\n", { flag: "wx" })
    console.log(`FREEZE_WRITTEN: ${SNAPSHOT}; ${live.length} open PRs`)
  }

  if (!apply) {
    console.log(`DRY_RUN: no PR labels changed; rerun with --apply to label ${live.length} PRs`)
    return
  }

  const latest = fetchStableOpenPrs()
  const drift = diffQueues(snapshot.prs, latest)
  if (hasDrift(drift)) {
    throw new Error(`QUEUE_DRIFT_BEFORE_APPLY: refusing PR label changes:\n${driftLines(drift).join("\n")}`)
  }
  createLabelIfMissing()
  for (const pr of latest) {
    if (pr.labels.includes(LABEL)) continue
    ghJson(["api", "--method", "POST", `repos/${REPO}/issues/${pr.number}/labels`,
      "--input", "-"], JSON.stringify({ labels: [LABEL] }))
    console.log(`LABELED #${pr.number}`)
  }
  console.log(`APPLY_COMPLETE: ${latest.length} PRs now targeted by ${LABEL}`)
}

try { main() } catch (error) {
  console.error(`QUEUE_FREEZE_FAILED: ${error.message}`)
  process.exitCode = 1
}
