export * as NativeStartup from "./native-startup"

import { Flag } from "@orchestra/core/flag/flag"

export type Admission = {
  configuration: string
  origin: string
  webRoot: string
}

export type VerifyInput = {
  configuration?: string
  argv: readonly string[]
  environment: Readonly<Record<string, string | undefined>>
  webRoot?: string
}

const startup: { result?: Promise<Admission | undefined> } = {}

export function admit() {
  return startup.result ??= verify({
    configuration: Flag.ORCHESTRA_SF_INSTALLATION,
    argv: process.argv.slice(2),
    environment: process.env,
    webRoot: Flag.ORCHESTRA_WEB_UI_DIR,
  })
}

export async function verify(input: VerifyInput): Promise<Admission | undefined> {
  if (input.configuration === undefined) return
  const args = input.argv
  const validArgs = args.length === 5 && args[0] === "serve" && (
    (args[1] === "--hostname" && args[2] === "localhost" && args[3] === "--port" && args[4] === "4111") ||
    (args[1] === "--port" && args[2] === "4111" && args[3] === "--hostname" && args[4] === "localhost")
  )
  if (!validArgs) throw new Error("Native installation requires explicit localhost serve arguments")
  if (input.environment.ORCHESTRA_DISABLE_PROJECT_CONFIG !== "1" ||
    ["ORCHESTRA_SERVER_PASSWORD", "ORCHESTRA_SERVER_USERNAME", "ORCHESTRA_CONFIG", "ORCHESTRA_CONFIG_CONTENT"]
      .some((name) => Object.hasOwn(input.environment, name)))
    throw new Error("Native installation requires an isolated environment")

  const { default: path } = await import("node:path")
  if (!path.isAbsolute(input.configuration)) throw new Error("Native installation requires an absolute configuration path")
  const configuration = path.resolve(input.configuration)
  const { loadLocalConfiguration, requireLocalIsolation } = await import("@orchestra/sucafina/configuration")
    .catch(() => { throw new Error("Native installation configuration is unavailable") })
  const loaded = await loadLocalConfiguration(configuration)
    .catch(() => { throw new Error("Native installation configuration is invalid") })
  if (loaded.config.origin !== "http://localhost:4111" || loaded.config.authentication !== "local-operator" || !loaded.config.localOperator)
    throw new Error("Native installation requires the local operator profile on localhost:4111")
  await requireLocalIsolation(loaded.directory, input.environment)
    .catch(() => { throw new Error("Native installation isolation is invalid") })

  const webRoot = input.webRoot
  if (!webRoot || !path.isAbsolute(webRoot) || path.resolve(webRoot) !== webRoot)
    throw new Error("Native installation requires an absolute canonical web root")
  const { stat } = await import("node:fs/promises")
  const index = await stat(path.join(webRoot, "index.html"))
    .catch(() => { throw new Error("Native installation web assets are invalid") })
  if (!index.isFile()) throw new Error("Native installation web assets are invalid")
  const manifest: unknown = await Bun.file(path.join(webRoot, "native-manifest.json")).json()
    .catch(() => { throw new Error("Native installation web profile is invalid") })
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) ||
    !("product" in manifest) || manifest.product !== "Orchestra-SF" ||
    !("native" in manifest) || manifest.native !== true || !("version" in manifest) || manifest.version !== 1)
    throw new Error("Native installation web profile is invalid")
  return { configuration, origin: loaded.config.origin, webRoot }
}
