import { readFile, realpath, stat } from "node:fs/promises"
import path from "node:path"
import { digest, gitBlobDigest, object, requireSha, rows, text } from "./schema.ts"
import type { PreparedPlan } from "./schema.ts"

export type HostObservation = {
  id: string
  status: "AVAILABLE" | "NEEDS_HOST"
  operation: string
  resource: string
  evidenceRef: string
}

/** An installed owner can supply a live probe; JSON booleans and saved captures
 * never become a host capability or a Request. This function makes no mutation. */
export async function preflight(input: {
  plan: PreparedPlan
  requirements: unknown
  reuse: unknown
  repositoryRoot: string
  sourceHead?: string
  probe?: () => Promise<readonly HostObservation[]>
}) {
  const requirements = rows(object(input.requirements).requirements, "host requirements")
  const sources = rows(object(input.reuse).sources, "reuse sources")
  const root = await realpath(input.repositoryRoot)
  const files = await Promise.all([...new Set(sources.map((source) => text(source.path, "source path")))].map(async (file) => {
    const absolute = path.resolve(root, file)
    const relative = path.relative(root, absolute)
    if (!relative || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) throw new Error(`Source escaped repository: ${file}`)
    const physical = await realpath(absolute).catch(() => undefined)
    if (!physical) return { path: file, status: "NOT_PRESENT_IN_CHECKOUT", sha256: null }
    if (!physical.startsWith(root + path.sep) || !(await stat(physical)).isFile()) throw new Error(`Invalid source file: ${file}`)
    const bytes = await readFile(physical)
    const blob = gitBlobDigest(bytes)
    const reusePins = sources.filter((source) => source.path === file).map((source) => ({ commit: source.commit_sha, blob: source.blob_sha }))
    return { path: file, status: "SOURCE_PRESENT_NOT_EXECUTED", sha256: digest(bytes), blobSha: blob, reusePins,
      reuseComparison: reusePins.some((pin) => pin.blob === blob) ? "MATCHES_INSPECTED_REUSE_SOURCE" : "DIFFERS_REQUIRES_SOURCE_RECONCILIATION" }
  }))
  const observed = input.probe ? await input.probe() : []
  if (new Set(observed.map((entry) => entry.id)).size !== observed.length) throw new Error("Duplicate live host observation")
  for (const entry of observed) {
    if (!requirements.some((requirement) => requirement.id === entry.id)) throw new Error(`Unknown live capability: ${entry.id}`)
    if (!["AVAILABLE", "NEEDS_HOST"].includes(entry.status) || !entry.evidenceRef || !entry.operation || !entry.resource)
      throw new Error(`Incomplete live capability: ${entry.id}`)
  }
  const capabilities = requirements.map((requirement) => {
    const observation = observed.find((entry) => entry.id === requirement.id)
    return { id: requirement.id, proofs: requirement.proofs, ownerTasks: requirement.owner_tasks,
      operation: requirement.operation, resource: requirement.resource, requiredEvidence: requirement.required_evidence,
      status: observation?.status ?? "NEEDS_HOST", liveObservation: observation ?? null,
      reason: observation ? "Live probe is capability evidence only; proof not run" : "No live installed-host probe supplied",
      observedPreparationReason: requirement.observed_reason ?? null,
      nextAction: requirement.next_action }
  })
  const missingHost = capabilities.filter((entry) => entry.status !== "AVAILABLE")
  const missingFiles = files.filter((entry) => entry.status !== "SOURCE_PRESENT_NOT_EXECUTED")
  const changedFiles = files.filter((entry) => "reuseComparison" in entry && entry.reuseComparison === "DIFFERS_REQUIRES_SOURCE_RECONCILIATION")
  return { schema: "sf2h-native-preflight-v1", observedAt: new Date().toISOString(),
    sourceHead: input.sourceHead ? requireSha(input.sourceHead, "source head") : null, candidateC: input.plan.candidateC,
    scope: "source-presence-and-capability-discovery", status: missingHost.length ? "NEEDS_HOST" : missingFiles.length || changedFiles.length ? "NEEDS_INTEGRATION" : "READY_FOR_PREPROOF",
    finalExecutionAllowed: false, finalGate: "S0 must verify acceptance of the same C before calling the final runner",
    nativeAccepted: false, nativeExecutions: 0, planDigest: input.plan.coverageDigest, counts: input.plan.counts,
    runtime: { node: process.version, platform: process.platform, architecture: process.arch },
    capabilities, files, missingHostCount: missingHost.length, missingSourceCount: missingFiles.length, changedReuseSourceCount: changedFiles.length }
}
