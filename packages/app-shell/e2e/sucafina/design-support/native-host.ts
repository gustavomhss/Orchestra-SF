import { randomUUID } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { withNativeInstallation } from "../../../../../apps/cli/test/fixture/sucafina-native-installation"
import { prepareOperatorAccess } from "../../../../../modules/sucafina/Sucafinav1/local/enroll"
import type { Actor, Command, Domain } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract"
import { DashboardBudget } from "../../../../../modules/sucafina/Sucafinav1/runtime/dashboard-budget"
import { DashboardPeople } from "../../../../../modules/sucafina/Sucafinav1/runtime/dashboard-people"
import { DashboardPortfolio } from "../../../../../modules/sucafina/Sucafinav1/runtime/dashboard-portfolio"

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..")
const privateRoot = process.argv[2]
if (!privateRoot || !path.isAbsolute(privateRoot)) throw new Error("Private capture directory required")
if (Object.keys(process.env).some((key) => key.startsWith("VITE_")))
  throw new Error("Native capture build must not inherit Vite server overrides")

const now = new Date()
const year = now.getUTCFullYear()
const month = now.getUTCMonth() + 1
const topicName = "Design test data · Confirm the regional sourcing review and its supporting evidence"
const riskName = "Design test data · Supplier concentration across the regional delivery programme"
const projectName = "Design test data · Regional delivery programme"
const stop = new AbortController()
process.once("SIGTERM", () => stop.abort())
process.once("SIGINT", () => stop.abort())

const program = Effect.scoped(Effect.gen(function* () {
  const launcher = yield* AppProcess.Service
  const webRoot = path.join(privateRoot, "web")
  process.stdout.write("SF_DESIGN_STAGE build\n")
  const bundle = yield* launcher.run(ChildProcess.make("bun", ["run", "build", "--outDir", webRoot], {
    cwd: path.join(repository, "apps/web"),
    env: { ...process.env },
    extendEnv: false,
  }), { timeout: 120_000, maxOutputBytes: 64 * 1024, maxErrorBytes: 64 * 1024 })
  if (bundle.exitCode !== 0)
    throw new Error("Native Web build failed (" + bundle.exitCode + "): " + bundle.stderr.toString("utf8").slice(-4000))
  const serverPassword = randomUUID()
  let configuration: string | undefined
  process.stdout.write("SF_DESIGN_STAGE installation\n")
  const installed = yield* withNativeInstallation({
    webRoot,
    serverPassword,
    seed: async ({ config, store, actorId }) => {
      configuration = config
      await store.transaction("dashboard", async (snapshot) => {
        const actor: Actor = { id: actorId, roles: ["admin"], canWrite: true }
        const environment = { at: now.toISOString(), id: randomUUID, directory: [] }
        const execute = (domain: Domain, command: Command) => {
          const result = domain.execute(snapshot, actor, command, environment)
          if (!result.ok) throw new Error("Canonical design test seed rejected: " + command.page + "/" + command.action)
          return result.value
        }
        const recordId = (value: unknown) => {
          if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "string")
            throw new Error("Canonical design test seed omitted its record ID")
          return value.id
        }
        const ownerId = recordId(execute(DashboardBudget.domain, {
          page: "OPEX Detail", action: "save", version: 0,
          values: { name: "Design test data · Regional operations", budget: 180000 },
        }))
        execute(DashboardBudget.domain, {
          page: "OPEX Detail", action: "save-entry", version: 0,
          values: { ownerId, year, month: 1, budget: 15000, actual: 12400, forecast: 14200 },
        })
        const projId = recordId(execute(DashboardBudget.domain, {
          page: "CAPEX Projects", action: "save", version: 0,
          values: { name: "Design test data · Infrastructure renewal", budget: 240000 },
        }))
        execute(DashboardBudget.domain, {
          page: "CAPEX Projects", action: "save-entry", version: 0,
          values: { projId, year, month: 1, budget: 20000, actual: 16400, forecast: 19100 },
        })
        execute(DashboardPeople.domain, {
          page: "Hot Topics & Actions", action: "save", version: 0,
          values: { action: topicName, owner: "Design test operator", due: year + "-12-15", status: "progress", priority: "high" },
        })
        execute(DashboardPortfolio.domain, {
          page: "IT Risks", action: "save", version: 0,
          values: { name: riskName, owner: "Design test operator", due: year + "-12-20", impact: 4, probability: 4, status: "mitigating" },
        })
        execute(DashboardPortfolio.domain, {
          page: "All Projects", action: "save", version: 0,
          values: { name: projectName, budget: 240000, spent: 92000, status: "In Progress", risk: "Medium" },
        })
        execute(DashboardBudget.domain, {
          page: "Executive Dashboard", action: "save-users", version: 0,
          values: { year, month, value: 128 },
        })
        execute(DashboardBudget.domain, {
          page: "Executive Dashboard", action: "save-benchmark", version: 0,
          values: { year, month, value: 2800 },
        })
        return { commit: true, value: undefined }
      })
    },
  })
  if (!configuration) throw new Error("Native installation configuration was not observed")
  // The fixture consumed its own enrollment. Mint a new genuine one-use handoff
  // for the browser; no cookie, authority map or successful projection is invented.
  const config = configuration
  const enrollment = yield* Effect.promise(() => prepareOperatorAccess(config))
  const html = yield* Effect.promise(() => readFile(enrollment.artifact, "utf8"))
  const encoded = /location\.replace\(("(?:[^"\\]|\\.)*")\)/.exec(html)?.[1]
  if (!encoded) throw new Error("Native enrollment handoff missing")
  const signIn: unknown = JSON.parse(encoded)
  if (typeof signIn !== "string") throw new Error("Native enrollment handoff is not a URL")
  const destination = new URL(signIn)
  if (destination.origin !== installed.origin || destination.pathname !== installed.mount + "/auth/local" ||
      destination.searchParams.size !== 1 || !/^[a-f0-9]{64}$/.test(destination.searchParams.get("code") ?? ""))
    throw new Error("Native enrollment destination does not match this installation")
  const metadata = {
    root: installed.root, origin: installed.origin, mount: installed.mount, actorId: installed.actorId,
    signIn, serverPassword, year, month, topicName, riskName, projectName,
  }
  yield* Effect.promise(() => writeFile(path.join(privateRoot, "installation.json"), JSON.stringify(metadata), { mode: 0o600, flag: "wx" }))
  process.stdout.write("SF_DESIGN_READY\n")
  yield* Effect.never
})).pipe(Effect.provide(LayerNode.compile(AppProcess.node)))

try {
  await Effect.runPromise(program, { signal: stop.signal })
} catch (error: unknown) {
  if (!stop.signal.aborted) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    process.stderr.write(message.replace(/[a-f0-9]{64}/g, "[redacted]").replace(/code=[^&\s"']+/g, "code=[redacted]").slice(-8192) + "\n")
    process.exitCode = 1
  }
}
