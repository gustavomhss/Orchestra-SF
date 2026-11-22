import path from "node:path"
import { lstatSync, realpathSync } from "node:fs"
import { defineConfig } from "@playwright/test"
import config from "../playwright.config"

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000)
const selected = process.argv.slice(2).map((argument) =>
  argument.replaceAll("[\\\\/]", "/").replaceAll("\\.", ".").replaceAll("\\", "/").replace(/:\d+(?::\d+)?$/, "")
    .replace(/\$$/, ""))
const files = selected.some((filename) => filename.endsWith("e2e/sucafina/operations.spec.ts"))
const decisions = selected.some((filename) => filename.endsWith("e2e/sucafina/decisions.spec.ts"))
const listing = process.argv.includes("--list")
const native = selected.some((filename) => /(?:^|\/)e2e\/sucafina\/native\/journeys\/u(?:15|39|40)\.spec\.ts$/.test(filename))
if (native && (files || decisions)) throw new Error("F04_NATIVE_INVOCATION_CANNOT_MIX_LOCAL_HARNESSES")
if (native && !listing && (process.env.GITHUB_ACTIONS !== "true" ||
    !process.env.SF_NATIVE_INSTALLED_MANIFEST || !process.env.SF_NATIVE_PRIVATE_REPORT))
  throw new Error("F04_ORIGINAL_PRIVATE_INSTALLED_INVOCATION_REQUIRED")
if (native && !listing) {
  const manifest = process.env.SF_NATIVE_INSTALLED_MANIFEST!, report = process.env.SF_NATIVE_PRIVATE_REPORT!
  const root = path.dirname(manifest), info = lstatSync(root)
  if (!path.isAbsolute(manifest) || path.resolve(manifest) !== manifest || report !== path.join(root, "native-playwright.json") ||
    !info.isDirectory() || info.isSymbolicLink() || realpathSync(root) !== root || (info.mode & 0o777) !== 0o700 ||
    typeof process.getuid === "function" && info.uid !== process.getuid())
    throw new Error("F04_PRIVATE_REPORT_ROOT_REQUIRED")
  if (process.env.PLAYWRIGHT_JSON_OUTPUT_FILE && process.env.PLAYWRIGHT_JSON_OUTPUT_FILE !== report ||
    ["1", "true"].includes(process.env.PLAYWRIGHT_JSON_ONLY_FAILURES ?? ""))
    throw new Error("F04_PRIVATE_COMPLETE_JSON_REPORT_REQUIRED")
  process.env.PLAYWRIGHT_JSON_OUTPUT_FILE = report
  process.umask(0o077)
}
const runFiles = files && !listing
const runDecisions = decisions && !listing
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
  grepInvert: native ? undefined : process.env.ORCHESTRA_CHANNEL === "prod"
    ? /@development-only|@development-channel/
    : /@development-only|@production-channel/,
  // Specs read this to prove dev-only marks and controls are absent from the built bundle.
  metadata: { ...config.metadata, bundle: "production" },
  ...(native ? { workers: 1, retries: 0, repeatEach: 1, fullyParallel: false, globalSetup: undefined } : {}),
  outputDir: native && !listing ? path.join(path.dirname(process.env.SF_NATIVE_PRIVATE_REPORT!), "native-output") : "./test-results",
  reporter: native ? (listing ? [["list"]] : [["json", { outputFile: process.env.SF_NATIVE_PRIVATE_REPORT! }]]) :
    [["html", { outputFolder: "./playwright-report", open: "never" }], ["line"], ["./utils/flaky-reporter.ts"]],
  webServer: native ? undefined : [{
    ...config.webServer,
    cwd: path.resolve(import.meta.dirname, "../../../apps/web"),
    command: `bun run build && bun run serve -- --host 0.0.0.0 --port ${port} --strictPort`,
    reuseExistingServer: false,
    ...(runFiles || runDecisions ? { env: {
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
    trace: native || files ? "off" : "retain-on-failure",
    ...(native ? { screenshot: "off", video: "off", serviceWorkers: "block" } as const : {}),
  },
})
