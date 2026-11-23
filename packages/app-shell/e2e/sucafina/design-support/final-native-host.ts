import { writeFile } from "node:fs/promises"
import path from "node:path"
import { withDesignInstallation } from "./installation"

const root = process.argv[2]
const wave = process.argv[3]
if (!root || !path.isAbsolute(root) || !isWave(wave))
  throw new Error("The final native fixture needs its owned directory and original design wave")
if (process.env.CI !== "true" || process.env.RUNNER_OS !== "Linux" ||
    process.env.GITHUB_REPOSITORY !== "gustavomhss/Orchestra-SF" ||
    !/^[1-9][0-9]*$/.test(process.env.GITHUB_RUN_ID ?? "") ||
    !/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? "") ||
    process.env.ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER !== "strict" ||
    process.env.ORCHESTRA_CHANNEL !== "prod")
  throw new Error("The final native fixture owner requires the original strict Linux production Actions runner")

const stop = new AbortController()
const abort = () => stop.abort()
process.once("SIGTERM", abort)
process.once("SIGINT", abort)
try {
  await withDesignInstallation(async (installation) => {
    if (stop.signal.aborted) return
    await writeFile(path.join(root, "installation.json"), JSON.stringify({
      installation, runId: process.env.GITHUB_RUN_ID, sha: process.env.GITHUB_SHA,
    }), { mode: 0o600, flag: "wx" })
    process.stdout.write("SF_FINAL_NATIVE_READY\n")
    if (stop.signal.aborted) return
    await new Promise<void>((resolve) => stop.signal.addEventListener("abort", () => resolve(), { once: true }))
  }, wave)
} catch (error: unknown) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  const safe = message.replace(/[a-f0-9]{64}/g, "[redacted]")
    .replace(/code=[^&\s"']+/g, "code=[redacted]")
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi, "[credential]")
    .replace(/\b(code|token|password|secret|authorization)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s&,]+)/gi, "$1=[redacted]")
    .slice(-8192)
  await writeFile(path.join(root, "failure.txt"), safe, { mode: 0o600 })
  process.exitCode = 1
} finally {
  process.off("SIGTERM", abort)
  process.off("SIGINT", abort)
}

function isWave(value: string | undefined): value is NonNullable<Parameters<typeof withDesignInstallation>[1]> {
  return value === "one" || value === "two" || value === "three" || value === "four" || value === "four-decisions"
}
