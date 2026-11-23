import { chmod, mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Omni } from "@orchestra/core/omni"
import type { DesignInstallation, withDesignInstallation } from "./installation"

type Wave = NonNullable<Parameters<typeof withDesignInstallation>[1]>

/**
 * The official Node-only Omni loader starts a Bun owner of the unchanged native
 * fixture. Node never imports the AppProcess runtime graph or constructs an
 * installation, identity, context, grant, provider, receipt or business port.
 */
export async function withFinalNativeInstallation<T>(
  use: (installation: DesignInstallation) => Promise<T>,
  wave: Wave = "one",
): Promise<T> {
  assertRunner()
  const support = path.dirname(fileURLToPath(import.meta.url))
  const repository = path.resolve(support, "../../../../..")
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "sf-final-native-"))
  let owned: Omni.Child | undefined
  let pump: Promise<void> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const diagnostics = { tail: "" }
  try {
    await chmod(root, 0o700)
    await Promise.all(["tmp", "data", "config", "cache", "state"].map((name) =>
      mkdir(path.join(root, name), { mode: 0o700 })))
    const binding = await Omni.load()
    let announce: (() => void) | undefined
    let refuse: ((error: Error) => void) | undefined
    const ready = new Promise<void>((resolve) => { announce = resolve })
    const outputFailure = new Promise<never>((_, reject) => { refuse = reject })
    owned = binding.spawn("bun", [path.join(support, "final-native-host.ts"), root, wave], {
      cwd: repository, env: environment(root), inheritEnv: false,
      stdin: "closed", backpressure: true, text: true, graceMs: 10_000,
    })
    // Count only the actual supervised spawn, through the same official counter
    // used by AppProcess. The runner retains its own nonce/verdict authority.
    Omni.count("spawns")
    const child = owned
    pump = (async () => {
      for await (const line of child.lines()) {
        if (line.lostBefore) throw new Error("Native fixture output was truncated")
        if (line.stream === "stdout" && /^SF_DESIGN_STAGE [a-z-]+$/.test(line.text)) console.info(line.text)
        if (line.stream === "stdout" && line.text === "SF_FINAL_NATIVE_READY") announce?.()
        if (line.stream === "stderr") diagnostics.tail = (diagnostics.tail + "\n" + redact(line.text)).slice(-8192)
      }
    })()
    void pump.catch((error: unknown) => refuse?.(new Error(error instanceof Error ? error.message : "Native fixture output failed")))
    const exited = child.wait().then(async (exit) => {
      const failure = await readFile(path.join(root, "failure.txt"), "utf8").catch(() => "")
      throw new Error("Native fixture owner exited before readiness (" + exit.exitCode + "): " + redact(failure || diagnostics.tail))
    })
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Native design build/setup deadline exceeded")), 180_000)
    })
    await Promise.race([ready, exited, outputFailure, deadline])
    if (timer) clearTimeout(timer)
    const metadata = path.join(root, "installation.json")
    const decoded: unknown = JSON.parse(await readFile(metadata, "utf8"))
    if (!validMetadata(decoded)) throw new Error("Native fixture owner returned invalid metadata")
    await rm(metadata)
    return await Promise.race([use(decoded.installation), exited, outputFailure])
  } finally {
    if (timer) clearTimeout(timer)
    if (owned) {
      await owned.stop({ graceMs: 10_000 })
      const outputError = await pump?.then(() => undefined, (error: unknown) => error)
      if ((await owned.processes()).length)
        throw new Error("Owned native fixture tree did not stop; private files retained")
      if (outputError) {
        await rm(root, { recursive: true, force: true })
        throw outputError
      }
    }
    await rm(root, { recursive: true, force: true })
  }
}

function assertRunner(): void {
  if (process.env.CI !== "true" || process.env.RUNNER_OS !== "Linux" ||
      process.env.GITHUB_REPOSITORY !== "gustavomhss/Orchestra-SF" ||
      !/^[1-9][0-9]*$/.test(process.env.GITHUB_RUN_ID ?? "") ||
      !/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? "") ||
      process.env.ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER !== "strict" ||
      process.env.ORCHESTRA_CHANNEL !== "prod")
    throw new Error("The final native fixture requires the original strict Linux production Actions runner")
  // GITHUB_ACTIONS is transported unchanged. The existing test-ci runner may
  // deliberately set it to false; this fixture never rewrites that decision.
}

function environment(root: string): Record<string, string> {
  const inherited: Record<string, string> = {}
  for (const key of ["PATH", "SystemRoot", "WINDIR", "PATHEXT", "LANG", "LC_ALL", "TZ",
    "CI", "RUNNER_OS", "RUNNER_ARCH", "GITHUB_ACTIONS", "GITHUB_REPOSITORY",
    "GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT", "GITHUB_SHA",
    "ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER", "ORCHESTRA_CHANNEL"]) {
    const value = process.env[key]
    if (value !== undefined) inherited[key] = value
  }
  return {
    ...inherited, ORCHESTRA_INHERIT_CREDENTIALS: "0", ORCHESTRA_DISABLE_PROJECT_CONFIG: "1",
    ORCHESTRA_DB: path.join(root, "data/orchestra.db"), ORCHESTRA_CONFIG_DIR: path.join(root, "config"),
    ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(root, "credential.key"),
    TMPDIR: path.join(root, "tmp"), XDG_DATA_HOME: path.join(root, "data"),
    XDG_CONFIG_HOME: path.join(root, "config"), XDG_CACHE_HOME: path.join(root, "cache"),
    XDG_STATE_HOME: path.join(root, "state"),
  }
}

function validMetadata(value: unknown): value is { installation: DesignInstallation; runId: string; sha: string } {
  if (!value || typeof value !== "object" || !("installation" in value) ||
      !("runId" in value) || value.runId !== process.env.GITHUB_RUN_ID ||
      !("sha" in value) || value.sha !== process.env.GITHUB_SHA) return false
  const installed = value.installation
  if (!installed || typeof installed !== "object") return false
  const fields = ["root", "workspace", "origin", "mount", "actorId", "signIn", "serverPassword",
    "topicName", "opexName", "riskName", "projectName"] as const
  if (!fields.every((field) => field in installed && typeof Reflect.get(installed, field) === "string")) return false
  return "year" in installed && typeof installed.year === "number" && Number.isSafeInteger(installed.year) &&
    "month" in installed && typeof installed.month === "number" && Number.isInteger(installed.month) &&
    installed.month >= 1 && installed.month <= 12
}

function redact(value: string): string {
  return value.replace(/[a-f0-9]{64}/g, "[redacted]").replace(/code=[^&\s"']+/g, "code=[redacted]")
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi, "[credential]")
    .replace(/\b(code|token|password|secret|authorization)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s&,]+)/gi, "$1=[redacted]")
}
