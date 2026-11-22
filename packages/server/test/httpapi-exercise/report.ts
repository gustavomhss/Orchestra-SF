import { Duration } from "effect"
import { indent, pad } from "./assertions"
import { transportEvidence } from "./backend"
import type { Options, Result, Scenario } from "./types"

export const color = {
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  reset: "\x1b[0m",
}

export function printHeader(
  options: Options,
  effectRoutes: string[],
  selected: Scenario[],
  missing: string[],
  extra: Scenario[],
  paths: { database: string; global: string },
) {
  console.log(`${color.cyan}HttpApi exerciser${color.reset}`)
  console.log(`${color.dim}db=${paths.database}${color.reset}`)
  console.log(`${color.dim}global=${paths.global}${color.reset}`)
  console.log(
    `${color.dim}mode=${options.mode} selected=${selected.length} scenarioTimeout=${Duration.format(options.scenarioTimeout)} effectRoutes=${effectRoutes.length} missing=${missing.length} extra=${extra.length}${color.reset}`,
  )
  console.log("")
}

export function printResults(results: Result[], missing: string[], extra: Scenario[]) {
  for (const result of results) {
    if (result.status === "pass") {
      console.log(
        `${color.green}PASS${color.reset} ${pad(result.scenario.method, 6)} ${pad(result.scenario.path, 48)} ${result.scenario.name}`,
      )
      continue
    }
    if (result.status === "skip") {
      console.log(
        `${color.yellow}SKIP${color.reset} ${pad(result.scenario.method, 6)} ${pad(result.scenario.path, 48)} ${result.scenario.name} ${color.dim}${result.scenario.reason}${color.reset}`,
      )
      continue
    }
    console.log(
      `${color.red}FAIL${color.reset} ${pad(result.scenario.method, 6)} ${pad(result.scenario.path, 48)} ${result.scenario.name}`,
    )
    console.log(`${color.red}${indent(result.message)}${color.reset}`)
  }
  if (missing.length > 0) {
    console.log("\nMissing scenarios")
    for (const route of missing) console.log(`${color.red}MISS${color.reset} ${route}`)
  }
  if (extra.length > 0) {
    console.log("\nExtra scenarios")
    for (const scenario of extra)
      console.log(`${color.yellow}EXTRA${color.reset} ${routeKey(scenario)} ${scenario.name}`)
  }
  console.log(
    `\n${color.dim}summary pass=${results.filter((result) => result.status === "pass").length} fail=${results.filter((result) => result.status === "fail").length} skip=${results.filter((result) => result.status === "skip").length} missing=${missing.length} extra=${extra.length}${color.reset}`,
  )
}

function routeKey(scenario: Scenario) {
  return `${scenario.method} ${scenario.path}`
}

/** Machine-readable evidence includes every selected case, never only the summary. */
export async function writeReceipt(options: Options, routes: string[], catalog: Scenario[], results: Result[], missing: string[], extra: Scenario[], cleanupComplete: boolean) {
  const destination = process.env.ORCHESTRA_HTTPAPI_EXERCISE_RECEIPT
  if (!destination) return
  const transport = transportEvidence()
  const receipt = {
    schema: "orchestra.g05.httpapi/1",
    sourceSha: process.env.GITHUB_SHA ?? null,
    sourceTree: process.env.G05_SOURCE_TREE ?? null,
    runId: process.env.GITHUB_RUN_ID ?? null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    proofClass: options.mode === "coverage" ? "HTTPAPI_CATALOG" : transport.transport === "loopback" ? "HTTP_LOOPBACK_COMPONENT" : "DIRECT_HANDLER_COMPONENT",
    installedTeamsProof: false,
    finalCandidate: false,
    mode: options.mode,
    fullInventory: results.length === catalog.length && !options.include && !options.startAt && !options.stopAt,
    failOnMissing: options.failOnMissing,
    failOnSkip: options.failOnSkip,
    transport,
    cleanup: { completed: cleanupComplete, allListenersClosed: transport.listeners === transport.closedListeners },
    routes,
    missing,
    extra: extra.map((scenario) => ({ method: scenario.method, path: scenario.path, name: scenario.name })),
    summary: {
      catalog: catalog.length,
      selected: results.length,
      pass: results.filter((result) => result.status === "pass").length,
      fail: results.filter((result) => result.status === "fail").length,
      skip: results.filter((result) => result.status === "skip").length,
    },
    cases: results.map((result) => ({
      method: result.scenario.method,
      path: result.scenario.path,
      name: result.scenario.name,
      status: result.status,
      ...(result.scenario.kind === "active" ? { auth: result.scenario.auth } : { reason: result.scenario.reason }),
      ...(result.status === "fail" ? { message: result.message } : {}),
    })),
  }
  await Bun.write(destination, JSON.stringify(receipt, null, 2) + "\n")
}
