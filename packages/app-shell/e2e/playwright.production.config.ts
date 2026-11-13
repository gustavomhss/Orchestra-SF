import path from "node:path"
import { defineConfig } from "@playwright/test"
import config from "../playwright.config"
import { wp04BrowserSelected } from "./sucafina/wp04/selection"

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000)
// The existing CI runner supplies an exact filename regex. This only starts the
// declared real Procurement fixture; it changes no grep, selector or CI allowlist.
const wp04 = wp04BrowserSelected(process.argv.slice(2)) && !process.argv.includes("--list")

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
  }, ...(wp04 ? [{
    command: "bun e2e/sucafina/wp04/host.ts",
    cwd: path.resolve(import.meta.dirname, ".."),
    url: "http://127.0.0.1:4174/__wp04_ready",
    reuseExistingServer: false,
    timeout: 60_000,
  }] : [])],
  use: {
    ...config.use,
    trace: "retain-on-failure",
  },
})
