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
import { prepareSfLocalWorkspace } from "../../../../../modules/sucafina/Sucafinav1/local/workspace"
import type { Actor, Command, Domain } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract"
import { DashboardBudget } from "../../../../../modules/sucafina/Sucafinav1/runtime/dashboard-budget"
import { DashboardPeople } from "../../../../../modules/sucafina/Sucafinav1/runtime/dashboard-people"
import { DashboardPortfolio } from "../../../../../modules/sucafina/Sucafinav1/runtime/dashboard-portfolio"
import { seedWaveThreeDashboard, seedWaveThreePlanner } from "./wave-three-seed"
import { seedWaveFourPlanner } from "./wave-four-planner-seed"
import { seedWaveFourProcurement } from "./wave-four-procurement-seed"
import { seedWaveFourDecisions, seedWaveFourDecisionsPlanner } from "./wave-four-decisions-seed"
import { loadLocalConfiguration } from "../../../../../modules/sucafina/Sucafinav1/runtime/local-configuration"
import { scanLocalFile } from "../../../../../modules/sucafina/Sucafinav1/runtime/local-scanner"

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..")
const privateRoot = process.argv[2]
if (!privateRoot || !path.isAbsolute(privateRoot)) throw new Error("Private capture directory required")
if (Object.keys(process.env).some((key) => key.startsWith("VITE_")))
  throw new Error("Native capture build must not inherit Vite server overrides")

const secondWave = process.argv[3] === "two"
const decisionsWave = process.argv[3] === "four-decisions"
const filesWave = process.argv[3] === "four-files"
const fourthWave = process.argv[3] === "four" || decisionsWave || filesWave
const thirdWave = process.argv[3] === "three" || fourthWave
const now = new Date()
const year = now.getUTCFullYear()
const month = now.getUTCMonth() + 1
const topicName = secondWave ? "Dados de teste · Revisão de contratos e evidências da origem" :
  "Design test data · Confirm the regional sourcing review and its supporting evidence"
const opexName = secondWave ? "Dados de teste · Operações regionais" : "Design test data · Regional operations"
const riskName = "Design test data · Supplier concentration across the regional delivery programme"
const projectName = "Design test data · Regional delivery programme"
const stop = new AbortController()
process.once("SIGTERM", () => stop.abort())
process.once("SIGINT", () => stop.abort())

async function reportFailure(error: unknown) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  const safe = message.replace(/[a-f0-9]{64}/g, "[redacted]").replace(/code=[^&\s"\']+/g, "code=[redacted]").slice(-8192)
  // Persist the bounded diagnostic before exit; the process exit event can beat stderr delivery.
  await writeFile(path.join(privateRoot, "failure.txt"), safe, { mode: 0o600 }).catch(() => undefined)
  process.stderr.write(safe + "\n")
}

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
  // The parent owns the real ClamD service. The original INSTREAM adapter
  // must admit an actual clean probe before this isolated installation uses it.
  const scanner = filesWave ? { host: "127.0.0.1" as const, port: 3310 } : undefined
  if (scanner) {
    process.stdout.write("SF_DESIGN_STAGE scanner-probe\n")
    const clean = yield* Effect.promise(() => scanLocalFile(
      new TextEncoder().encode("SF_DESIGN_FILES_CLEAN_PROBE\n"), scanner,
    ))
    if (!clean) throw new Error("Files design fixture requires a ready real ClamD scanner")
  }
  const serverPassword = randomUUID()
  let configuration: string | undefined
  process.stdout.write("SF_DESIGN_STAGE installation\n")
  const installed = yield* withNativeInstallation({
    ...(scanner ? { scanner } : {}),
    webRoot,
    serverPassword,
    seed: async ({ config, store, actorId }) => {
      configuration = config
      process.stdout.write("SF_DESIGN_STAGE configuration\n")
      const loaded = await loadLocalConfiguration(config)
      const operator = loaded.config.localOperator
      if (fourthWave) {
        if (!operator?.name) throw new Error("The native operator name is required for procurement")
        // Configure the original installation policy before the real host starts.
        // The original identity producer issues its roles; no grant or cookie is patched.
        await writeFile(config, JSON.stringify({
          ...loaded.config, localOperator: { ...operator, buyer: true },
        }, null, 2) + "\n", { mode: 0o600 })
      }
      process.stdout.write("SF_DESIGN_STAGE dashboard-seed\n")
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
          values: { name: opexName, budget: 180000 },
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
          values: { action: topicName, owner: "Design test operator", due: year + "-12-15", status: "progress", priority: "high",
            notes: "Design test data · Source evidence for the sourcing review." },
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
        if (secondWave) {
          // Additional records belong only to the second-wave isolated fixture.
          // Every value is accepted by the original producer before the browser reads it.
          for (const line of [
            { name: "Dados de teste · Infraestrutura de TI", budget: 96000, actual: 7200, forecast: 7700 },
            { name: "Dados de teste · Governança e serviços", budget: 144000, actual: 11800, forecast: 12100 },
          ]) {
            const id = recordId(execute(DashboardBudget.domain, {
              page: "OPEX Detail", action: "save", version: 0,
              values: { name: line.name, budget: line.budget },
            }))
            execute(DashboardBudget.domain, {
              page: "OPEX Detail", action: "save-entry", version: 0,
              values: { ownerId: id, year, month: 1, budget: line.budget / 12, actual: line.actual, forecast: line.forecast },
            })
          }
          for (const entry of [
            { month: 2, actual: 13800, forecast: 14500 },
            { month: 3, actual: 14100, forecast: 14800 },
            { month: 4, actual: 14700, forecast: 15100 },
            { month: 5, actual: 14500, forecast: 14900 },
            { month: 6, actual: 15100, forecast: 15400 },
          ]) execute(DashboardBudget.domain, {
            page: "OPEX Detail", action: "save-entry", version: 0,
            values: { ownerId, year, month: entry.month, budget: 15000, actual: entry.actual, forecast: entry.forecast },
          })
          execute(DashboardBudget.domain, {
            page: "Budget Overview", action: "save-month", version: 0, values: { year, month: 6 },
          })
          execute(DashboardBudget.domain, {
            page: "Budget Overview", action: "save-revenue", version: 0, values: { year, revenue: 2400000 },
          })
          for (const topic of [
            { action: "Dados de teste · Validar plano de continuidade do fornecedor", owner: "Suprimentos", due: year + "-12-19", status: "blocked", priority: "critical" },
            { action: "Dados de teste · Concluir a revisão de despesas recorrentes", owner: "Finanças", due: year + "-12-05", status: "open", priority: "normal" },
          ]) execute(DashboardPeople.domain, {
            page: "Hot Topics & Actions", action: "save", version: 0,
            values: { ...topic, notes: "Registro demonstrativo criado pelo produtor na instalação isolada de teste." },
          })
        }
        if (thirdWave) seedWaveThreeDashboard(snapshot, actor, environment, year, month)
        return { commit: true, value: undefined }
      })
      process.stdout.write("SF_DESIGN_STAGE planner-seed\n")
      if (thirdWave) await store.transaction("planner", async (snapshot) => {
        const actor: Actor = { id: actorId, roles: ["admin"], canWrite: true }
        const environment = { at: now.toISOString(), id: randomUUID, directory: [] }
        if (decisionsWave) seedWaveFourDecisionsPlanner(snapshot, actor, environment, year)
        else {
          seedWaveThreePlanner(snapshot, actor, environment, year)
          if (fourthWave) seedWaveFourPlanner(snapshot, actor, environment, year)
        }
        return { commit: true, value: undefined }
      })
      process.stdout.write("SF_DESIGN_STAGE procurement-seed\n")
      if (fourthWave) await store.transaction("procurement", async (snapshot) => {
        if (!operator?.name) throw new Error("Native procurement directory identity is unavailable")
        seedWaveFourProcurement(snapshot, { id: actorId, roles: ["admin", "buyer"], canWrite: true },
          { at: now.toISOString(), id: randomUUID, directory: [{ id: actorId, name: operator.name }] }, year)
        return { commit: true, value: undefined }
      })
      process.stdout.write("SF_DESIGN_STAGE seed-complete\n")
    },
  })
  const workspace = yield* Effect.promise(() => prepareSfLocalWorkspace(installed.root))
  process.stdout.write("SF_DESIGN_STAGE native-ready\n")
  if (decisionsWave) {
    process.stdout.write("SF_DESIGN_STAGE decisions-seed\n")
    yield* Effect.promise(async () => {
      try { await seedWaveFourDecisions(installed, year) }
      catch (error: unknown) {
        // Record the source failure before scoped child-process cleanup starts.
        await reportFailure(error)
        throw error
      }
    })
    process.stdout.write("SF_DESIGN_STAGE decisions-ready\n")
  }
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
    root: installed.root, workspace, origin: installed.origin, mount: installed.mount, actorId: installed.actorId,
    signIn, serverPassword, year, month, topicName, opexName, riskName, projectName,
  }
  yield* Effect.promise(() => writeFile(path.join(privateRoot, "installation.json"), JSON.stringify(metadata), { mode: 0o600, flag: "wx" }))
  process.stdout.write("SF_DESIGN_READY\n")
  yield* Effect.never
})).pipe(Effect.provide(LayerNode.compile(AppProcess.node)))

try {
  await Effect.runPromise(program, { signal: stop.signal })
} catch (error: unknown) {
  if (!stop.signal.aborted) {
    await reportFailure(error)
    process.exitCode = 1
  }
}
