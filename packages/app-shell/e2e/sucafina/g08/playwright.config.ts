import { defineConfig } from "@playwright/test"
import path from "node:path"

const root = process.env.SF_G08_PRIVATE_ROOT
const inventory = process.env.SF_G08_LIST_ONLY === "1"
const output = root ?? process.env.SF_G08_TOOLING_EVIDENCE
if (!root && !inventory) throw new Error("G08_PRIVATE_PLAN_REQUIRED")
if (root && inventory) throw new Error("G08_INVENTORY_MUST_NOT_ATTACH_PRIVATE_HOST")
if (!output || !path.isAbsolute(output)) throw new Error("G08_EXPLICIT_OUTPUT_ROOT_REQUIRED")
const workspace = process.env.GITHUB_WORKSPACE
if (inventory && workspace && (output === workspace || output.startsWith(path.resolve(workspace) + path.sep)))
  throw new Error("G08_TOOLING_OUTPUT_OUTSIDE_CHECKOUT_REQUIRED")

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: "teams-installed.spec.ts",
  fullyParallel: false,
  forbidOnly: true,
  workers: 1,
  retries: 0,
  repeatEach: 1,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  preserveOutput: "always",
  outputDir: path.join(output, root ? "playwright-output" : "list-output"),
  reporter: [["json", {
    outputFile: path.join(output, root ? "playwright.json" : "list.json"),
  }]],
  metadata: {
    candidateSha: process.env.SF_G08_CANDIDATE_SHA,
    candidateTree: process.env.SF_G08_CANDIDATE_TREE,
    invocationId: process.env.SF_G08_INVOCATION_ID,
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
  },
  use: { trace: "off", screenshot: "off", video: "off", actionTimeout: 30_000, navigationTimeout: 60_000 },
  projects: [{ name: "g08-installed" }],
  // No webServer, launch, dev build or storageState. Every page comes from the original attached context.
})
