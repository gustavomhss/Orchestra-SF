import { createSfAnalysisHost } from "../../../product/ai/analysis-host.ts"
import { readSfAnalysisRun } from "../../../product/ai/analysis-port.ts"
import { createSfContributionReader, createSfHistoricalContributionReader } from "../../../product/ai/contribution-reader.ts"
import { createSfRunStore, sfRunSourceFence } from "../../../product/ai/run-store.ts"
import { digestSfContribution, digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import type { ContributionEnvelope } from "../../../product/contracts/resident-ai.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { SfNativeRunRecord, SfProductState } from "../../../product/contracts/state.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { sfRunFixture } from "./run-fixture.ts"

// These observations, model/session identifiers and load receipts are synthetic.
// SQLite, C08, run lifecycle, envelope readers and digest checks are the real components.
// No provider, skill execution, installed host or public consumer is certified here.
type Observation = { id: string; incarnation: string; version: number; text: string }
type Source = { current: Observation; history: Record<string, Observation>; readers: string[] }
const authority = { principalRef: "principal", policyVersion: "policy", accessRevision: "access" }
const startedAt = Date.now()
export const restartStage = (stage: string) => process.stderr.write(`SF_WP12_RESTART_STAGE:${JSON.stringify({ stage, pid: process.pid, elapsedMs: Date.now() - startedAt })}\n`)

export function restartMaterial() {
  const material = sfRunFixture()
  const observation: Observation = { id: "source", incarnation: "source-inc", version: 1, text: "Synthetic observation v1" }
  const evidence: BusinessEvidenceRef = { schema: "sf-evidence-v1", refId: "restart-source", installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", kind: "record",
    target: { surface: "dashboard", recordType: "wp12-restart-observation", recordId: observation.id, incarnation: observation.incarnation, version: observation.version, fields: ["text"], projectionDigest: digestSfValue(observation) } }
  evidence.refDigest = digestSfEvidenceRef(evidence)
  material.run.contextFingerprint = digestSfValue(observation)
  material.output.evidenceRefs = [evidence]
  material.output.runProvenance.contextFingerprint = material.run.contextFingerprint
  material.output.outputDigest = digestSfContribution(material.output)
  return { ...material, observation, evidence }
}

export async function openRestartStore(directory: string, writable = false) {
  const persistence = await openLocalStore(directory)
  const contexts = new WeakMap<TrustedDomainContext, Request>()
  const requests = new WeakSet<Request>()
  const observed = { nativeCalls: 0, sourceChecks: 0, writeAttempts: 0, contextIds: [] as string[], disposed: false }
  const sourceOf = (snapshot: Readonly<Snapshot>) => snapshot.data.wp12RestartSource as Source | undefined
  const stateOf = (snapshot: Readonly<Snapshot>) => snapshot.data.__sfProductV1 as SfProductState | undefined
  const currentAccess = (snapshot: Readonly<Snapshot>, request: Request | undefined) => {
    if (!request || !requests.has(request) || request.headers.get("x-wp12-principal") !== authority.principalRef) return false
    const readers = snapshot.data.wp12RestartReaders
    if (!Array.isArray(readers) || !readers.includes(authority.principalRef)) return false
    const current = stateOf(snapshot)?.cases.case
    return current ? current.incarnation === "inc" && current.participants.includes(authority.principalRef) : writable
  }
  const snapshot = <T>(read: (value: Snapshot) => T) => persistence.transaction("dashboard", async (value) => ({ commit: false, value: read(value) }))
  const requestFor = (context: TrustedDomainContext) => contexts.get(context)
  const revalidate = (context: TrustedDomainContext) => snapshot((value) => currentAccess(value, requestFor(context)))
  const freshContext = () => {
    const request = new Request("https://example.test/wp12-restart", { headers: { "x-wp12-principal": authority.principalRef } })
    const requestId = `restart-${process.pid}-${crypto.randomUUID()}`
    const context = { kind: "ui", binding: { installationId: "install", projectId: "project", ...authority, requestId, expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
    contexts.set(context, request)
    requests.add(request)
    observed.contextIds.push(requestId)
    return { context, request, close: () => { contexts.delete(context); requests.delete(request) } }
  }
  const state = createSfProductState({ persistence,
    createId: () => { if (!writable) throw new Error("read-only restart cannot allocate C08 state"); return "restart-store" },
    authorize: async (request, value, _namespace, mode) => {
      if (mode === "write") observed.writeAttempts++
      return (mode === "read" || writable) && currentAccess(value, request) ? authority : undefined
    },
    resolveTarget: async (request, value, _namespace, target) => writable && currentAccess(value, request) && ["case", "case:case:inc"].includes(target) ? { incarnation: "inc" } : undefined,
  })
  const verifySource = (value: Readonly<Snapshot>, context: TrustedDomainContext, record: SfNativeRunRecord, output: ContributionEnvelope | undefined, historical: boolean): PortResult<true> => {
    observed.sourceChecks++
    if (!currentAccess(value, requestFor(context))) return { status: "denied", reason: "case-access-revoked" }
    const source = sourceOf(value)
    if (!source || !source.readers.includes(authority.principalRef)) return { status: "denied", reason: "source-access-revoked" }
    if (!historical && digestSfValue(source.current) !== record.contextFingerprint) return { status: "stale", reason: "source-changed" }
    if (!output) return { status: "ok", value: true }
    const ref = output.evidenceRefs[0]
    if (output.evidenceRefs.length !== 1 || !ref || ref.kind !== "record" || ref.refDigest !== digestSfEvidenceRef(ref) || ref.installationId !== "install" || ref.projectId !== "project" ||
      ref.target.surface !== "dashboard" || ref.target.recordType !== "wp12-restart-observation" || ref.target.recordId !== source.current.id || ref.target.incarnation !== source.current.incarnation || digestSfValue(ref.target.fields) !== digestSfValue(["text"])) return { status: "denied", reason: "source-binding-invalid" }
    const retained = source.history[String(ref.target.version)]
    if (!retained || retained.id !== ref.target.recordId || retained.incarnation !== ref.target.incarnation || retained.version !== ref.target.version || retained.version > source.current.version ||
      digestSfValue(retained) !== ref.target.projectionDigest || record.contextFingerprint !== ref.target.projectionDigest || digestSfContribution(output) !== output.outputDigest) return { status: "denied", reason: "source-digest-invalid" }
    return { status: "ok", value: true }
  }
  const store = createSfRunStore({ state, requestFor, revalidate,
    preflight: (record, context, output) => snapshot((value): PortResult<{ sourceFence: string }> => {
      const source = verifySource(value, context, record, output, false)
      if (source.status !== "ok") return source
      const current = stateOf(value)?.cases[record.caseRef.id]
      if (!current || current.incarnation !== record.caseRef.incarnation || current.version !== record.caseRef.version) return { status: "stale", reason: "case-changed" }
      return { status: "ok", value: { sourceFence: sfRunSourceFence(value) } }
    }),
    // Pure snapshot validation while C08 owns the SQLite lock; never opens a nested transaction.
    revalidateForCommit: async (record, context, value, output) => writable ? verifySource(value, context, record, output, record.state === "stale") : { status: "denied", reason: "read-only-restart" },
    now: () => "2026-11-14T00:00:00Z",
  })
  const current = createSfContributionReader({ state, runs: store, requestFor, revalidate,
    verify: (output, record, context) => snapshot((value) => verifySource(value, context, record, output, false)) })
  const historical = createSfHistoricalContributionReader({ state, requestFor, revalidate,
    verifyHistorical: (output, record, _currentCase, context) => snapshot((value) => verifySource(value, context, record, output, true)) })
  const unavailable = async () => ({ status: "unavailable" as const, reason: "restart-reader-does-not-execute" })
  const executionUnavailable = async () => { observed.nativeCalls++; return unavailable() }
  const host = createSfAnalysisHost({ store,
    withRunContext: async (runRef, action) => {
      const scope = freshContext()
      try {
        if (runRef !== "run" || !await revalidate(scope.context)) return { status: "denied", reason: "current-run-access-unavailable" }
        return await action(scope.context)
      } finally { scope.close() }
    },
    verify: (context, record, request) => snapshot((value) => verifySource(value, context, record, request.output, false)),
    analysis: { create: unavailable, cancel: unavailable, read: async (runRef, context) => {
      const run = await store.readLifecycle(runRef, context)
      if (run.status !== "ok") return run
      if (!run.value.outputRef) return { status: "unavailable", reason: "output-unavailable" }
      const read = await current({ outputRef: run.value.outputRef, caseRef: run.value.caseRef }, context)
      return read.status === "ok" ? { status: "ok", value: read.value.output } : read
    } },
    routines: { catalog: unavailable, prepareAdmission: unavailable, readAdmission: unavailable, readRun: unavailable, run: unavailable },
    execution: { admit: executionUnavailable, execute: executionUnavailable, collect: executionUnavailable, interrupt: executionUnavailable },
  })
  return { persistence, snapshot, state, store, current, historical, host, freshContext, observed,
    seedSource: () => persistence.transaction("dashboard", async (value) => {
      if (!writable) throw new Error("read-only restart cannot seed sources")
      const observation = restartMaterial().observation
      value.data.wp12RestartReaders = [authority.principalRef]
      value.data.wp12RestartSource = { current: observation, history: { "1": observation }, readers: [authority.principalRef] } satisfies Source
      return { commit: true, value: true }
    }),
    changeSource: (action: "advance" | "revoke" | "restore") => persistence.transaction("dashboard", async (value) => {
      if (!writable) throw new Error("read-only restart cannot change sources")
      const source = sourceOf(value)
      if (!source) throw new Error("restart source missing")
      if (action === "advance") {
        source.current = { ...source.current, version: 2, text: "Synthetic observation v2" }
        source.history["2"] = source.current
      } else source.readers = action === "restore" ? [authority.principalRef] : []
      return { commit: true, value: true }
    }),
    close: async () => { if (!observed.disposed) { await persistence.dispose(); observed.disposed = true } },
  }
}

export async function observeRestart(directory: string, mode: "current" | "historical") {
  restartStage(`${mode}:open-start`)
  const world = await openRestartStore(directory)
  restartStage(`${mode}:open-ready`)
  try {
    const before = await world.snapshot((value) => digestSfValue(value))
    const progress = await readSfAnalysisRun({ host: world.host, runRef: "run" })
    restartStage(`${mode}:progress-${progress.status}`)
    const scope = world.freshContext()
    try {
      const current = await world.current({ outputRef: "output", caseRef: { id: "case", incarnation: "inc", version: 1 } }, scope.context)
      const historical = await world.historical({ outputRef: "output", currentCase: { id: "case", incarnation: "inc", version: mode === "current" ? 1 : 2 } }, scope.context)
      restartStage(`${mode}:readers-${current.status}-${historical.status}`)
      const after = await world.snapshot((value) => digestSfValue(value))
      return { pid: process.pid, elapsedMs: Date.now() - startedAt, fixture: "synthetic-inference-records", mode, unchanged: before === after, beforeDigest: before, afterDigest: after,
        progress: progress.status === "ok" ? { status: "ok" as const, state: progress.value.run.state, version: progress.value.run.version, hasOutput: !!progress.value.output,
          ...(progress.value.output ? { outputDigest: digestSfValue(progress.value.output) } : {}) } : progress,
        current: current.status === "ok" ? { status: "ok" as const, outputDigest: digestSfValue(current.value.output) } : current,
        historical: historical.status === "ok" ? { status: "ok" as const, state: historical.value.state, outputDigest: digestSfValue(historical.value.output) } : historical,
        observations: world.observed }
    } finally { scope.close() }
  } finally { await world.close(); restartStage(`${mode}:disposed`) }
}

if (import.meta.main) {
  const [directory, mode] = process.argv.slice(2)
  if (!directory || (mode !== "current" && mode !== "historical")) throw new Error("restart directory and read mode are required")
  const result = await observeRestart(directory, mode)
  process.stdout.write(`SF_WP12_RESTART_PROBE:${JSON.stringify(result)}\n`)
}
