import { chmod, mkdir, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { AbsolutePath } from "@orchestra/core/schema"
import { KNOWN_SCANNERS } from "@orchestra/atlas-boundary/native-memory"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import atlasPackage from "../../../../../atlas/boundary/package.json" with { type: "json" }
import contractFreeze from "../../../product/contracts/freeze-v1.json" with { type: "json" }
import { createSfBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { object } from "../../../runtime/contract.ts"
import type { Persistence, Snapshot } from "../../../runtime/contract.ts"
import type { AssetPersistence, BlobTransaction } from "../../../runtime/assets.ts"
import { resolve } from "../../../src/identity.ts"
import { createResidentAiBundle } from "../../../product/ai/resident.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import type { SfProductGrant } from "../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createDashboardSourceIssuer, createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardRecordEvidenceHost } from "../../../product/dashboard/sources.ts"
import { enqueueSfLedgerEvent } from "../../../product/integration/ledger-outbox.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { CaseLedgerEvent } from "../../../product/contracts/decisions.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import type { SfStateResult } from "../../../product/contracts/state.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import type { createSfAtlasBusiness } from "../../../product/host-binding/business-context.ts"
import { createSfAtlasScanner } from "../../../product/host-binding/atlas-scanner.ts"

export const atlasPeriod = { start: "2026-01-01", end: "2026-12-31" }
export const atlasDay = { start: "2026-11-13", end: "2026-11-13" }
// Deliberately synthetic and never issued. The pinned release allowlists the previous alphabet sequence.
export const syntheticScannerControl = "ghp_" + "H7k2M9q4R8t1V6w3X5y0Z2a7B9c4D8e1F6g3"
const origin = "https://dashboard-atlas.test"
const scannerRelease = {
  version: "8.30.1",
  url: "https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz",
  sha256: "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb",
  bytes: 8230402,
}

export function atlasValue<T>(result: PortResult<T> | SfStateResult<T>): T {
  if (result.status !== "ok") throw new Error(`Atlas consumer: ${result.status} ${"reason" in result ? result.reason : ""}`)
  return result.value
}

/** Pin a real upstream scanner. Only the verified archive's named binary is extracted. */
export async function prepareAtlasScanner(directory: string) {
  if (process.platform !== "linux" || process.arch !== "x64") throw new Error("This hosted Atlas proof requires Linux x64")
  const response = await fetch(scannerRelease.url, { signal: AbortSignal.timeout(60000) })
  if (!response.ok) throw new Error(`Gitleaks download failed: ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
  if (bytes.byteLength !== scannerRelease.bytes || digest !== scannerRelease.sha256) throw new Error("Gitleaks release integrity mismatch")
  const archive = path.join(directory, "gitleaks.tar.gz")
  await Bun.write(archive, bytes)
  const command = path.join(directory, "gitleaks")
  const version = await Effect.gen(function* () {
    const process = yield* AppProcess.Service
    const extracted = yield* process.run(ChildProcess.make("tar", ["-xzf", archive, "-C", directory, "gitleaks"], { extendEnv: true, stdin: "ignore" }), { timeout: "20 seconds", maxOutputBytes: 4096 })
    yield* AppProcess.requireSuccess(extracted)
    yield* Effect.promise(() => chmod(command, 0o700))
    const observed = yield* process.run(ChildProcess.make(command, ["--version"], { extendEnv: true, stdin: "ignore" }), { timeout: "5 seconds", maxOutputBytes: 4096 })
    yield* AppProcess.requireSuccess(observed)
    if (observed.stdoutTruncated) throw new Error("Gitleaks version output truncated")
    return observed.stdout.toString("utf8").trim()
  }).pipe(Effect.provide(LayerNode.compile(AppProcess.node)), Effect.runPromise)
  if (version !== `gitleaks version ${scannerRelease.version}`) throw new Error(`Unexpected Gitleaks version: ${version}`)
  const known = KNOWN_SCANNERS.find((value) => value.name === "gitleaks")
  if (!known) throw new Error("Atlas does not publish a Gitleaks invocation contract")
  const spec = { ...known, command }
  const scanner = createSfAtlasScanner({ scanners: [spec] })
  const clean = { owner: "sf-atlas-scanner-qualification", kind: "task" as const, entry: { taskId: "qualification", attempted: [], failedWith: [], stoppedAt: "review", lesson: "Review current authorized observations." } }
  const verdicts = { clean: scanner.scan(clean), syntheticControl: scanner.scan({ ...clean, entry: { ...clean.entry, lesson: syntheticScannerControl } }) }
  console.info("SF_ATLAS_SCANNER_QUALIFICATION", JSON.stringify({ version: scannerRelease.version, archiveSha256: digest,
    controlSha256: new Bun.CryptoHasher("sha256").update(syntheticScannerControl).digest("hex"), ...verdicts }))
  if (verdicts.clean !== false || verdicts.syntheticControl !== true) throw new Error("Pinned Atlas scanner qualification failed")
  return { spec, version: scannerRelease.version }
}

type AtlasPhase = <T>(name: string, work: () => T | Promise<T>) => Promise<T>

/** Business ledger text is fixture data; source reads, admission, outbox, Atlas and recall are production. */
export async function withAtlasConsumer(work: (fixture: Awaited<ReturnType<typeof createFixture>>) => Promise<void>, scenario: string) {
  const started = performance.now()
  const phase: AtlasPhase = async (name, work) => {
    const started = performance.now()
    console.info("SF_ATLAS_PHASE", JSON.stringify({ scenario, phase: name, state: "started" }))
    let state = "threw"
    try { const result = await work(); state = "returned"; return result }
    finally { console.info("SF_ATLAS_PHASE", JSON.stringify({ scenario, phase: name, state, elapsedMs: Math.round(performance.now() - started) })) }
  }
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-dashboard-atlas-"))
  await chmod(directory, 0o700)
  const fixture = await phase("fixture.create", () => createFixture(directory, phase)).catch(async (error) => { await rm(directory, { recursive: true, force: true }); throw error })
  try { await phase("scenario.assertions", () => work(fixture)) }
  finally {
    await phase("fixture.close", () => fixture.close())
    await rm(directory, { recursive: true, force: true })
    console.info("SF_ATLAS_SCENARIO_TIMING", JSON.stringify({ scenario, elapsedMs: Math.round(performance.now() - started) }))
  }
}

async function createFixture(directory: string, phase: AtlasPhase) {
  const pinned = await phase("scanner.provision-and-qualify", () => prepareAtlasScanner(directory))
  const stateDirectory = path.join(directory, "product")
  await mkdir(stateDirectory, { mode: 0o700 })
  const installationId = randomUUID(), projectId = randomUUID()
  const clock = { at: "2026-11-13T08:00:00Z" }
  const fault: { stage?: "before-commit" | "after-commit"; trips: number } = { trips: 0 }
  const actors = ["dashboard-reviewer-A", "dashboard-reviewer-B"] as const
  const active = new Set<string>(actors)
  const bundleRoot = path.resolve(import.meta.dir, "../../../product/ai")
  const bundle = await createResidentAiBundle({ root: bundleRoot, manifestPath: path.join(bundleRoot, "manifests/resident.json") })
  const versions = { boundaryVersion: atlasPackage.version, schemaVersion: contractFreeze.canonicalSha256, manifestVersion: bundle.manifestDigest,
    skillVersion: digestSfValue(bundle.skills.map((skill) => ({ id: skill.id, version: skill.version, sourceDigest: skill.sourceDigest }))) }
  const request = (actor: string = actors[0], key: string = randomUUID()) => new Request(`${origin}/product`, { method: "POST", headers: { origin, "x-test-principal": actor, "idempotency-key": key } })
  const open = async (seed: boolean) => {
    const driver = await openLocalStore(stateDirectory)
    const observe = async <T>(snapshot: Snapshot, run: () => Promise<{ commit: boolean; value: T }>, lost: { value: boolean }) => {
      const before = object(object(snapshot.data.__sfProductV1).versions).atlas
      const outcome = await run()
      const after = object(object(snapshot.data.__sfProductV1).versions).atlas
      if (outcome.commit && after !== before && typeof after === "number" && fault.stage) {
        const stage = fault.stage
        fault.stage = undefined
        fault.trips++
        if (stage === "before-commit") throw new Error("Atlas test storage interrupted before commit")
        lost.value = true
      }
      return outcome
    }
    const forwarding: AssetPersistence & Pick<Persistence, "transactionAll" | "currentSnapshots"> = {
      transaction: async (surface, run, options) => {
        const lost = { value: false }
        const value = await driver.transaction(surface, (snapshot: Snapshot, blobs: BlobTransaction) => observe(snapshot, () => run(snapshot, blobs), lost), options)
        if (lost.value) throw new Error("Atlas test response lost after durable commit")
        return value
      },
      transactionAll: async (run, options) => {
        const lost = { value: false }
        if (!driver.transactionAll) throw new Error("LocalStore all-surface transactions unavailable")
        const value = await driver.transactionAll((snapshots) => observe(snapshots.dashboard, () => run(snapshots), lost), options)
        if (lost.value) throw new Error("Atlas test response lost after durable commit")
        return value
      },
      currentSnapshots: () => driver.currentSnapshots?.(),
    }
    const persistence = createSfSourcePersistence({ persistence: forwarding, enumerate: enumerateSfSources, createId: randomUUID, projectScope: createSfSourceScopeProjector(() => clock.at) })
    for (const surface of ["dashboard", "planner", "procurement"] as const) {
      await persistence.initializeSources(surface)
      if (seed) await persistence.transaction(surface, async (snapshot) => {
        snapshot.data.roleMap = [{ surface, role: "admin", entra: "atlas-reviewers", version: 1, by: actors[0] }]
        if (surface === "dashboard") {
          snapshot.data.opexOwners = [{ id: "owner", budget: 1200 }]
          snapshot.data.opexEntries = [{ id: "january", ownerId: "owner", year: 2026, month: 1, budget: 200, actual: 0 }]
          snapshot.data.capexProjects = []
          snapshot.data.capexEntries = []
          snapshot.data.hotTopics = [{ id: "topic", action: "Private action wording", status: "open", owner: "Operations", due: "2026-12-01", priority: "normal", notes: "Private notes" }]
        }
        return { commit: true, value: undefined }
      })
    }
    const authority = createSfProductAuthority({ identity: () => ({ installationId, hostId: "atlas-host", projectId, location: { directory: AbsolutePath.make(directory) } }),
      installationId, origin, policyVersion: "atlas-policy", persistence,
      authenticate: async (incoming, context) => {
        const actor = incoming.headers.get("x-test-principal")
        return actor && active.has(actor) && context ? resolve(actor, [...context.roleMap], (group) => group === "atlas-reviewers") : null
      }, environment: async () => ({ at: clock.at, id: randomUUID, directory: actors.map((id) => ({ id, name: id })) }),
      grants: actors.map((principalRef) => ({ principalRef, namespaces: ["cases", "preferences", "atlas", "outbox"],
        operations: ["sf_dashboard_read", "sf_case_draft", "sf_case_read", "sf_source_get", "sf_evidence_get", "sf_context_get", "sf_decision_recall", "sf_freshness_check"] } satisfies SfProductGrant)),
      commandIdentity: async (incoming, operation) => incoming.headers.get("idempotency-key") ? digestSfValue({ operation, key: incoming.headers.get("idempotency-key") }) : undefined,
      inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined,
      authorizeDocument: async () => undefined, createId: randomUUID, now: () => Date.parse(clock.at) })
    const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: new WeakSet(), dashboardHostWrites: new WeakSet() })
    const configureScanner = (value: Parameters<typeof createSfAtlasBusiness>[0]["scanner"]) => business.initializeAtlas(value, versions)
    configureScanner(pinned)
    const issue = createDashboardSourceIssuer({ host: authority.host, scopedSources: persistence })
    const records = createDashboardRecordEvidenceHost({ host: authority.host, scopedSources: persistence,
      issueRecord: createDashboardRecordSourceIssuer({ host: authority.host, scopedSources: persistence }) })
    return { driver, authority, business, persistence, issue, records, configureScanner }
  }
  const runtime = { current: await phase("composition.open", () => open(true)) }
  const call = <T>(operation: string, payload: unknown, action: (context: TrustedUiContext) => Promise<T>, actor: string = actors[0]) => phase(`operation.${operation}`, async () => {
    const digest = digestSfValue(payload), authority = runtime.current.authority
    const admitted = await authority.ui.admit(request(actor), operation, digest)
    if (admitted.status !== "ok") throw new Error(`Atlas UI admission: ${admitted.status}`)
    try {
      if (!await authority.ui.validate(admitted.value, operation, digest)) throw new Error("Atlas UI lease rejected")
      return await action(admitted.value)
    } finally { authority.ui.finish(admitted.value) }
  })
  const sources = () => call("sf_dashboard_read", { period: atlasPeriod }, async (context) => ({
    budget: atlasValue(await runtime.current.issue({ page: "Budget Overview", fields: ["budgetSeries"], period: atlasPeriod }, context)).evidence,
    topic: atlasValue(await runtime.current.records.issue({ page: "Hot Topics & Actions", recordType: "hotTopics", recordId: "topic", fields: ["status"], period: atlasDay }, context)),
  }))
  const ledger = async (refs: readonly BusinessEvidenceRef[], rationale: string) => {
    const payload = { objective: "Review Dashboard observations", horizon: atlasPeriod, currency: "USD", criteria: ["Use current authorized observations"], sourceRefs: refs }
    return call("sf_case_draft", payload, async (context) => {
    const business = runtime.current.business, authority = runtime.current.authority
    const projections = await business.context.context({ refs }, context)
    if (projections.length !== refs.length || projections.some((value) => value.state !== "fresh" || !value.authorizedProjection)) throw new Error("Ledger fixture requires fresh real producer evidence")
    const decision = atlasValue(await business.cases.draft(payload, context))
    const incoming = authority.host.requestFor(context)
    if (!incoming) throw new Error("Ledger request unavailable")
    const current = atlasValue(await authority.state.read(incoming, "cases", (state) => ({ version: state.versions.cases, decision: state.cases[decision.id] })))
    const outbox = atlasValue(await authority.state.read(incoming, "outbox", (state) => state.versions.outbox))
    if (!current.decision) throw new Error("Draft case disappeared")
    const event: CaseLedgerEvent = { id: randomUUID(), caseRef: { id: decision.id, incarnation: decision.incarnation, version: decision.version + 1 },
      kind: "reconsideration-accepted", principalRef: context.binding.principalRef, at: clock.at, consideredActions: ["Review the recorded Dashboard observations"],
      factualGaps: ["No financial decision is inferred from this observation."], lifecycleState: "investigating", rationale, evidenceRefs: refs,
      outputDigest: digestSfValue(projections.map((value) => value.authorizedProjection)) }
    const saved = atlasValue(await authority.state.transaction(incoming, { namespace: "cases", expectedStorageVersion: current.version,
      additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: outbox }], targetRef: decision.id, targetIncarnation: decision.incarnation,
      idempotencyKey: `ledger:${event.id}`, commandDigest: digestSfValue(event) }, async (state, admitted) => {
        const value = state.cases[decision.id]
        if (!value || value.version !== decision.version || value.incarnation !== decision.incarnation || admitted.principalRef !== event.principalRef) throw new Error("Ledger fixture lost its current case authority")
        state.cases[decision.id] = { ...value, version: event.caseRef.version, state: "investigating", ledger: [...value.ledger, event] }
        const queued = enqueueSfLedgerEvent(state, event, { installationId, projectId, authority: admitted })
        if (queued.status !== "ok") throw new Error(`Ledger outbox rejected: ${queued.reason}`)
        return { commit: true, value: queued.value }
      }))
    return { caseRef: event.caseRef, event, ...saved }
    })
  }
  return { runtime, clock, fault, active, actors, request, call, sources, ledger, scanner: pinned, scannerRelease, versions, phase,
    inspect: async () => atlasValue(await runtime.current.authority.state.read(request(), "atlas", (state) => ({
      atlasVersion: state.versions.atlas, outboxVersion: state.versions.outbox, atlasDigest: digestSfValue(state.atlas), owners: Object.keys(state.atlas),
      entries: Object.values(state.atlas).reduce<number>((count, value) => { const events = object(value).events; return count + (Array.isArray(events) ? events.length : 0) }, 0),
      outbox: structuredClone(state.outbox),
    }))),
    dispatch: (operation: string, payload: unknown, actor: string = actors[0]) => call(operation, payload, async (context) => {
      const descriptor = runtime.current.business.descriptors.find((value) => value.id === operation)
      if (!descriptor) throw new Error(`Atlas capability unavailable: ${operation}`)
      return descriptor.handler(payload, context)
    }, actor),
    reopen: () => phase("composition.reopen", async () => { runtime.current.business.dispose(); await runtime.current.driver.dispose(); runtime.current = await open(false) }),
    close: async () => { runtime.current.business.dispose(); await runtime.current.driver.dispose() },
  }
}
