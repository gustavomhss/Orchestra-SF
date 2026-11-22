import { defineConfig } from "@playwright/test"
import path from "node:path"

const root = process.env.SF_G08_PRIVATE_ROOT
const inventory = process.env.SF_G08_LIST_ONLY === "1"
if (!root && !inventory) throw new Error("G08_PRIVATE_PLAN_REQUIRED")
if (root && inventory) throw new Error("G08_INVENTORY_MUST_NOT_ATTACH_PRIVATE_HOST")

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
  outputDir: root ? path.join(root, "playwright-output") : path.resolve(import.meta.dirname, "../../../../../g08-tooling-evidence/list-output"),
  reporter: [["json", {
    outputFile: root ? path.join(root, "playwright.json") : path.resolve(import.meta.dirname, "../../../../../g08-tooling-evidence/list.json"),
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
