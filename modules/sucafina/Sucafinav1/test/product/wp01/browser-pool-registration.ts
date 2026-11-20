import { describe, test } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  admitPoolCommand, createPoolRegistry, loadPoolInventory, openPoolJournal, readPoolAdmission,
} from "../../../../../../script/sf-ci/browser-pool.mjs"

let active: ReturnType<typeof createPoolRegistry> | undefined

/** Shared module state, never an environment flag that can bypass full registration. */
export function assertWp01PoolStartup() {
  if (!active) throw new Error("WP01 browser startup requires its owned entry")
  active.assertStartup()
}

export async function openWp01PoolRegistration() {
  if (active) throw new Error("WP01 browser entry may register only once")
  const repoRoot = path.resolve(import.meta.dir, "../../../../../..")
  const inventory = loadPoolInventory(repoRoot)
  const command = (await Bun.file("/proc/self/cmdline").text()).split("\0").filter((value, index, all) => index < all.length - 1 || value !== "")
  const execution = { command, cwd: process.cwd(), execPath: process.execPath, platform: process.platform,
    pid: process.pid, bunVersion: process.versions.bun }
  const admitted = admitPoolCommand(command, { ...execution, repoRoot })
  // test-ci can execute the same exact entry without claiming a G04 receipt.
  // The dedicated workflow prepares candidate-bound evidence before Bun starts.
  const output = process.env.SF_BROWSER_POOL_OUTPUT
    ? path.resolve(process.env.SF_BROWSER_POOL_OUTPUT)
    : mkdtempSync(path.join(tmpdir(), "sf-browser-pool-"))
  if (process.env.SF_BROWSER_POOL_OUTPUT) {
    const admission = readPoolAdmission(output, inventory)
    if (admission.metadata.checkoutSha !== process.env.GITHUB_SHA ||
        admission.metadata.checkoutSha !== process.env.SF_CHECKOUT_SHA ||
        admission.metadata.treeSha !== process.env.SF_CHECKOUT_TREE_SHA ||
        admission.metadata.runId !== process.env.GITHUB_RUN_ID ||
        admission.metadata.attempt !== process.env.GITHUB_RUN_ATTEMPT ||
        admitted.report !== path.join(output, "report.xml")) throw new Error("WP01 prepared admission does not describe this checkout/run/reporter")
  }
  const emit = openPoolJournal(output, inventory, execution)
  const registry = createPoolRegistry(inventory.sources.map((source) => source.path), emit)
  active = registry
  console.info("SF_BROWSER_POOL_ENTRY", JSON.stringify({ entry: inventory.entry.path, sourceCount: inventory.sources.length,
    inventorySha256: inventory.sha256, output, prepared: !!process.env.SF_BROWSER_POOL_OUTPUT }))
  return {
    repoRoot, inventory,
    register(source: string, register: (test: typeof import("bun:test").test) => void) {
      registry.register(source, register, test, describe)
    },
    seal() { registry.seal() },
    lifecycle(evidence: unknown) { emit({ type: "lifecycle", evidence }) },
    complete() {
      const counts = registry.complete()
      emit({ type: "run-complete", observationsComplete: true, ...counts })
      console.info("SF_BROWSER_POOL_OBSERVED", JSON.stringify(counts))
    },
    incomplete() {
      const observations = registry.observations()
      emit({ type: "run-incomplete", observationsComplete: false, ...observations })
      console.info("SF_BROWSER_POOL_INCOMPLETE", JSON.stringify(observations))
    },
  }
}
