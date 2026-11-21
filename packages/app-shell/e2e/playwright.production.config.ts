import path from "node:path"
import { defineConfig } from "@playwright/test"
import config from "../playwright.config"

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000)
const files = process.argv.slice(2).some((argument) => {
  const filename = argument.replaceAll("[\\\\/]", "/").replaceAll("\\.", ".").replaceAll("\\", "/").replace(/:\d+(?::\d+)?$/, "")
  return filename.endsWith("e2e/sucafina/operations.spec.ts") || filename.endsWith("e2e/sucafina/operations.spec.ts$")
})
const runFiles = files && !process.argv.includes("--list")
if (runFiles) {
  if (port !== 3000 || process.env.GITHUB_ACTIONS !== "true" || !process.env.RUNNER_TEMP || process.env.SF_OPERATIONS_CLAMD_PORT !== "3310")
    throw new Error("Files qualification requires the hosted loopback Web and ClamD fixtures")
  process.env.SF_OPERATIONS_MANIFEST = path.join(process.env.RUNNER_TEMP, `sf-files-operations-${process.pid}.json`)
}

// defineConfig(config, override) concatenates webServer entries, which starts dev and preview on one port.
export default defineConfig({
  ...config,
  testDir: ".",
  // The DebugBar these specs drive exists only in the dev server.
  grepInvert: process.env.ORCHESTRA_CHANNEL === "prod"
    ? /@development-only|@development-channel/
    : /@development-only|@production-channel/,
  // Specs read this to prove dev-only marks and controls are absent from the built bundle.
  metadata: { ...config.metadata, bundle: "production" },
  outputDir: "./test-results",
  reporter: [["html", { outputFolder: "./playwright-report", open: "never" }], ["line"], ["./utils/flaky-reporter.ts"]],
  webServer: [{
    ...config.webServer,
    cwd: path.resolve(import.meta.dirname, "../../../apps/web"),
    command: `bun run build && bun run serve -- --host 0.0.0.0 --port ${port} --strictPort`,
    reuseExistingServer: false,
    ...(runFiles ? { env: {
      VITE_ORCHESTRA_SERVER_HOST: "", VITE_ORCHESTRA_SERVER_PORT: "",
      ORCHESTRA_SF_E2E_UPSTREAM: "http://127.0.0.1:4174",
    } } : {}),
  }, ...(runFiles ? [{
    command: "bun e2e/sucafina/wp04/host.ts",
    cwd: path.resolve(import.meta.dirname, ".."),
    url: "http://127.0.0.1:4174/__wp04_ready",
    reuseExistingServer: false,
    timeout: 60_000,
    stderr: "pipe" as const,
  }] : [])],
  use: {
    ...config.use,
    trace: files ? "off" : "retain-on-failure",
  },
})
