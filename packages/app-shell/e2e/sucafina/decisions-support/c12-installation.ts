import { expect, type Page, type TestInfo } from "@playwright/test"
import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Schema } from "effect"
import { SfContextResult, SfInstallationList } from "@orchestra/schema/sucafina/context"
import { readOperatorSessionCookie } from "./operator-session-cookie"
import { installedShellOrigin } from "../installed-shell"
import type { C12Configuration, C12Control, C12Ready } from "./c12-protocol"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..")

export async function createC12Installation() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-c12-native-"))
  await chmod(directory, 0o700)
  const configuration: C12Configuration = { directory, origin: installedShellOrigin(),
    installationId: randomUUID(), controlKey: randomBytes(32).toString("hex") }
  const filename = path.join(directory, "c12-configuration.json")
  await writeFile(filename, JSON.stringify(configuration), { mode: 0o600 })
  return { ...configuration, filename, dispose: () => rm(directory, { recursive: true, force: true }) }
}

/** The same source/authority/SQLite graph is reconstructed in a new Bun process.
 * The private control endpoint schedules the competing transaction and reads
 * original persisted results; it never returns a substituted producer response.
 */
export async function withC12Host<T>(
  installation: Awaited<ReturnType<typeof createC12Installation>>,
  info: TestInfo,
  phase: "initial" | "reopened",
  action: (host: C12Ready & { control: (operation?: "observe" | "interrupt") => Promise<C12Control> }) => Promise<T>,
): Promise<T> {
  const { Effect, Stream } = await import("effect")
  const { ChildProcess } = await import("effect/unstable/process")
  const { AppProcess } = await import("@orchestra/core/process")
  const { LayerNode } = await import("@orchestra/core/effect/layer-node")
  const logs: string[] = []
  const secrets = [installation.controlKey]
  await rm(path.join(installation.directory, "c12-ready.json"), { force: true })
  const environment = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] =>
    entry[1] !== undefined && (["PATH", "BUN_INSTALL", "LANG", "LC_ALL", "TZ", "CI", "SYSTEMROOT", "WINDIR"].includes(entry[0]) ||
      entry[0].startsWith("HUGR_OMNI_"))))
  try {
    return await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const service = yield* AppProcess.Service
      const process = yield* service.spawn(ChildProcess.make("bun",
        [path.join(root, "packages/app-shell/e2e/sucafina/decisions-support/c12-host.ts"), installation.filename],
        { cwd: root, env: environment, stdin: "ignore", stdout: "pipe", stderr: "pipe" }))
      const capture = (chunk: Uint8Array) => { logs.push(Buffer.from(chunk).toString("utf8")) }
      yield* Effect.forkScoped(Stream.runForEach(process.stdout, (chunk) => Effect.sync(() => capture(chunk))))
      yield* Effect.forkScoped(Stream.runForEach(process.stderr, (chunk) => Effect.sync(() => capture(chunk))))
      const state = { exited: false }
      yield* Effect.forkScoped(process.exitCode.pipe(Effect.tap(() => Effect.sync(() => { state.exited = true }))))
      return yield* Effect.promise(async () => {
        let ready: C12Ready | undefined
        await expect.poll(async () => {
          if (state.exited) throw new Error("The C12 host exited before its original graph initialized")
          ready = await readFile(path.join(installation.directory, "c12-ready.json"), "utf8")
            .then((value) => JSON.parse(value) as C12Ready).catch((error: NodeJS.ErrnoException) => {
              if (error.code === "ENOENT") return undefined
              throw error
            })
          return !!ready
        }, { timeout: 60_000, message: "The original C12 host must initialize" }).toBe(true)
        if (!ready) throw new Error("C12 native host unavailable")
        secrets.push(ready.cookie, ready.cookie.split(";")[0]!)
        const control = async (operation: "observe" | "interrupt" = "observe"): Promise<C12Control> => {
          const response = await fetch("http://localhost:4110/__c12_control", { method: "POST",
            headers: { "content-type": "application/json", "x-c12-control": installation.controlKey },
            body: JSON.stringify({ operation }) })
          expect(response.status, "The fixture must observe the original SQLite state").toBe(200)
          return response.json() as Promise<C12Control>
        }
        return action({ ...ready, control })
      })
    })).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
  } finally {
    // A new composition may only reuse the directory after the old listener exits.
    let source = logs.join("").slice(-40_000)
    for (const secret of secrets) source = source.split(secret).join("[redacted]")
    source = source.replace(/([?&](?:code|token|password|secret)=)[^&#\s"'<>]*/gi, "$1[redacted]")
      .replace(/((?:authorization|set-cookie|cookie)\s*[:=]\s*)[^\r\n]*/gi, "$1[redacted]")
      .replace(/\b[a-f0-9]{32,}\b/gi, "[redacted-hex]")
    await info.attach("c12-" + phase + "-host.log", { body: source, contentType: "text/plain" })
    await expect.poll(portAvailable, { timeout: 5_000, message: "The old C12 host releases its owned listener" }).toBe(true)
  }
}

export async function enterC12Shell(page: Page, installation: Awaited<ReturnType<typeof createC12Installation>>, host: C12Ready) {
  const cookie = readOperatorSessionCookie(new Headers({ "set-cookie": host.cookie }), installation.origin)
  await page.context().addCookies([cookie])
  const discoveryURL = new URL("/api/sucafina/installations", installation.origin)
  discoveryURL.search = new URLSearchParams({ select: "location", "location[directory]": installation.directory }).toString()
  const discovered = await page.request.get(discoveryURL.toString())
  expect(discovered.status()).toBe(200)
  const discovery = Schema.decodeUnknownSync(SfInstallationList)(await discovered.json())
  expect(discovery.installations).toHaveLength(1)
  const binding = discovery.installations[0]!
  expect(binding.mount).toBe("/sucafina")
  expect(binding.publicOrigin).toBe(installation.origin)
  const url = new URL(binding.mount + "/api/ui/context", binding.publicOrigin)
  url.search = new URLSearchParams({ installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId }).toString()
  const contextResponse = await page.request.get(url.toString())
  expect(contextResponse.status()).toBe(200)
  const context = Schema.decodeUnknownSync(SfContextResult)(await contextResponse.json())
  if (context.status !== "ok") throw new Error("The C12 operator did not receive original context admission")
  expect(context.value.stamp).toMatchObject({ installationId: binding.installationId, projectId: binding.projectId,
    hostId: binding.hostId, principalRef: host.actorId })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(installation.origin + "/")
  const project = page.getByRole("button", { name: "Choose project", exact: true })
  await project.click()
  await page.locator('[data-component="orchestra-profile-picker"]').getByRole("menuitem", { name: "Add project", exact: true }).click()
  const folders = page.getByRole("dialog")
  await folders.getByPlaceholder("Search folders", { exact: true }).fill(installation.directory)
  await folders.locator(`[data-directory-path=${JSON.stringify(installation.directory)}]`).click()
  await expect(project.locator("small")).toHaveAttribute("title", installation.directory)
}

async function portAvailable() {
  const server = createServer()
  const available = await new Promise<boolean>((resolve, reject) => {
    server.once("error", (error: NodeJS.ErrnoException) => error.code === "EADDRINUSE" ? resolve(false) : reject(error))
    server.listen(4110, "localhost", () => resolve(true))
  })
  if (available) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return available
}
