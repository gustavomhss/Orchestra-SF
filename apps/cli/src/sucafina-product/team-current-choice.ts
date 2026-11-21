import { createHash, randomUUID } from "node:crypto"
import { AbsolutePath } from "@orchestra/schema/schema"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Effect } from "effect"
import atlasPackage from "../../../../modules/atlas/boundary/package.json" with { type: "json" }
import residentManifest from "../../../../modules/sucafina/Sucafinav1/product/ai/manifests/resident.json" with { type: "text" }
import freeze from "../../../../modules/sucafina/Sucafinav1/product/contracts/freeze-v1.json" with { type: "json" }
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { readRequestBody } from "../../../../modules/sucafina/Sucafinav1/runtime/request-body.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { createCurrentChoiceFence, currentChoiceOwnsSnapshotTransactions, type CurrentChoiceFence } from "../../../../modules/sucafina/Sucafinav1/product/decisions/current-choice-preview.ts"
import { probeSfAtlasScanner } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/atlas-scanner.ts"
import { initializeAbsentSfProductState } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import { sfHumanActions } from "../../../../modules/sucafina/Sucafinav1/product/integration/human-authority.ts"
import { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { enumerateSfSources } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-inventory.ts"
import { createSfSourcePersistence } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts"
import type { Application } from "../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import type { LocalStore } from "../../../../modules/sucafina/Sucafinav1/runtime/local-contract.ts"
import { createSfBaselineServices } from "./baseline-services.ts"
import { createSfBusinessServices } from "./business-services.ts"
import { sfUiCommandIdentity } from "./command-identity.ts"
import { createSfCurrentChoiceHttp } from "./current-choice-http.ts"
import { createSfCurrentChoiceServices } from "./current-choice-services.ts"
import { createSfDecisionDomainHttp } from "./decision-domain-http.ts"
import { createSfDecisionDomainServices } from "./decision-domain-services.ts"
import { createSfExtendedBusinessServices } from "./extended-business-services.ts"
import { sfNativeLocationRef } from "./native-identity.ts"

const modes = new Set([
  "current-choice", "current-choice-prepare", "current-choice-promote",
  "decision-controls", "decision-edit", "decision-coverage", "decision-promote",
  "decision-criteria", "decision-compare", "decision-choose", "decision-archive-choice", "bi-options", "bi-data",
])
const namespaces = ["cases", "preferences", "atlas", "outbox", "bi-artifacts"] as const
const actions = new Set([
  "planner.preview", "decisions.promote-alternative", "decisions.edit",
  "decisions.coverage", "decisions.criteria", "decisions.portfolio.read", "decisions.choose",
])

/** The admitted Team supplies persistence and the original Entra Request. This mounts only the C17 journey. */
export function createSfTeamCurrentChoice() {
  const manifest: { skills: readonly { id: string; version: string; sourceDigest: string }[] } = JSON.parse(residentManifest)
  const atlasVersions = {
    boundaryVersion: atlasPackage.version,
    schemaVersion: freeze.canonicalSha256,
    manifestVersion: createHash("sha256").update(residentManifest).digest("hex"),
    skillVersion: digestSfValue(manifest.skills.map((skill) => ({
      id: skill.id, version: skill.version, sourceDigest: skill.sourceDigest,
    }))),
  }
  let scanner: ReturnType<typeof probeSfAtlasScanner> | undefined
  return {
    sources: (persistence: LocalStore) => createSfSourcePersistence({
      persistence, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => new Date().toISOString()),
      createId: randomUUID,
    }),
    handles: (request: Request) => modes.has(new URL(request.url).searchParams.get("sf") ?? ""),
    async run(input: {
      request: Request
      origin: string
      mount: string
      partition: string
      directory: string
      principalId: string
      grant: Readonly<Record<string, unknown>>
      persistence: LocalStore
      authenticate: Application["authenticate"]
      environment: Application["environment"]
      current: () => Promise<boolean>
    }) {
      const denied = () => Response.json({ status: "denied" }, { status: 403, headers: { "Cache-Control": "no-store" } })
      const { request, grant, directory, partition, origin, mount } = input
      const url = new URL(request.url)
      if (request.signal.aborted || url.origin !== origin || url.pathname !== mount + "/dashboard" ||
          request.headers.get("sec-fetch-site") === "cross-site" ||
          request.method === "POST" && request.headers.get("origin") !== origin ||
          !Array.isArray(grant.operations) || !grant.operations.includes("sf_case_read") ||
          !Array.isArray(grant.namespaces) || !grant.namespaces.includes("cases")) return denied()
      const allowed = {
        principalRef: input.principalId,
        namespaces: namespaces.filter((name) => (grant.namespaces as unknown[]).includes(name)),
        operations: freeze.operations.filter((operation) => (grant.operations as unknown[]).includes(operation.operation))
          .map((operation) => operation.operation),
        humanActions: Array.isArray(grant.humanActions)
          ? sfHumanActions.filter((action) => actions.has(action) && (grant.humanActions as unknown[]).includes(action))
          : [],
      }
      const mode = url.searchParams.get("sf")
      if ((mode === "current-choice-prepare" && !allowed.humanActions.includes("planner.preview")) ||
          (mode === "current-choice-promote" && !allowed.humanActions.includes("decisions.promote-alternative"))) return denied()
      const identity = Object.freeze({
        installationId: partition,
        projectId: partition,
        hostId: digestSfValue({ partition, capability: "decisions" }),
        location: Object.freeze(sfNativeLocationRef({ directory: AbsolutePath.make(directory) })),
      })
      const driver = input.persistence
      let authority: ReturnType<typeof createSfProductAuthority>
      const fence = createCurrentChoiceFence({
        persistence: driver,
        host: () => authority.host,
        identity: () => identity,
        operationIdentity: (call) => call.kind === "ui" ? authority.ui.operationIdentity(call) : undefined,
        authorizeCommit: input.current,
      })
      const projectScope = createSfSourceScopeProjector(() => new Date().toISOString())
      const owns = currentChoiceOwnsSnapshotTransactions(fence, driver)
      const sources = createSfSourcePersistence({
        enumerate: enumerateSfSources, projectScope, createId: randomUUID, persistence: fence.persistence,
        ...(owns ? { observeAuthority: driver.observeAuthority, hasSnapshotRoot: driver.hasSnapshotRoot,
          holdTargetPreimage: driver.holdTargetPreimage, installedDashboardProjector: projectScope } : {}),
      })
      const persistence = {
        ...driver, ...fence.persistence, ...sources,
        ...(owns && sources.transactionAll && driver.holdTargetPreimage ? { dashboardSourceFence: Object.freeze({
          transaction: sources.transaction, transactionAll: sources.transactionAll,
          currentSnapshots: sources.currentSnapshots, currentSnapshot: sources.currentSnapshot,
          observeAuthority: sources.observeAuthority, readSealed: sources.readSealed,
          hasSnapshotRoot: sources.hasSnapshotRoot, readDashboardAuthority: sources.readDashboardAuthority,
          holdTargetPreimage: driver.holdTargetPreimage,
          current: () => currentChoiceOwnsSnapshotTransactions(fence, driver),
        }) } : {}),
      }
      const proposalCoverageWrites = new WeakSet<object>()
      authority = createSfProductAuthority({
        identity: () => identity, installationId: partition, origin, policyVersion: "sf-product-v1",
        persistence, authenticate: input.authenticate, environment: input.environment,
        grants: [allowed], proposalCoverageWrites, createId: randomUUID, now: Date.now,
        commandIdentity: async (original, operation) => original === request
          ? sfUiCommandIdentity(original, operation, { origin, mount, readOperations: new Map(), createId: randomUUID })
          : undefined,
        inspectSession: async () => undefined,
        verifySelection: async () => false,
        verifySkillReceipt: async () => false,
        providerGeneration: async () => undefined,
        authorizeDocument: async () => undefined,
      })
      if (!await input.current()) return denied()
      // BI is the first admitted source selection in this flow. CurrentChoice
      // itself never initializes business state on a read or a rejected prepare.
      if (mode === "bi-options" && request.method === "GET" && allowed.operations.includes("sf_bi_view")) {
        for (const surface of ["dashboard", "planner", "procurement"] as const) await sources.initializeSources(surface)
        await initializeAbsentSfProductState(persistence, randomUUID)
      }

      let currentChoice: ReturnType<typeof createSfCurrentChoiceServices>
      const business = createSfBusinessServices({
        authority, persistence, proposalCoverageWrites,
        currentChoicePreparing: (call, baseRef) => currentChoice?.isPreparing(call, baseRef) ?? false,
      })
      try {
        scanner ??= Effect.runPromise(AppProcess.Service.use((process) =>
          Effect.promise(() => probeSfAtlasScanner(process))).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
        business.initializeAtlas(await scanner, atlasVersions)
        const baseline = createSfBaselineServices({ authority, business, origin, mount, proposalCoverageWrites })
        business.bindForecastCoverage(baseline.baseline.resolveForecastCoverage)
        const extended = createSfExtendedBusinessServices({
          authority, business, persistence, proposalCoverageWrites, analysisSelectionWrites: new WeakSet(), origin,
        })
        const domain = createSfDecisionDomainServices({
          authority, business, baseline: business.baselineCoverage, proposalCoverageWrites,
          signalRegistryWrites: new WeakSet(), sharedPortfolio: extended.portfolioServices, selectedCase: business.selectedCase,
        })
        business.bindDecisionDomain(domain)
        try {
          if (mode === "decision-archive-choice") return await archiveTeamChoice({
            request, authority, business, fence, current: input.current,
          })
          currentChoice = createSfCurrentChoiceServices({ authority, business, fence, proposalCoverageWrites })
          const current = createSfCurrentChoiceHttp({ origin, mount, runtime: () => ({ authority, currentChoice }) })
          const choice = await current(request, "dashboard")
          if (choice) return await input.current() ? choice : denied()

          const decision = createSfDecisionDomainHttp({ origin, mount, runtime: () => ({ authority, business, domain }) })
          const portfolio = extended.portfolioServices.http({ origin, mount })
          const response = await decision(request, "dashboard") ?? await portfolio(request, "dashboard") ??
            await baseline.productHttp(request, "dashboard") ?? await extended.productHttp(request, "dashboard")
          return await input.current() ? response : denied()
        } finally { domain.dispose(); extended.dispose() }
      } finally { business.dispose() }
    },
  }
}

/** Capture only the canonical pending event of the admitted case revision and writer. */
async function archiveTeamChoice(input: {
  request: Request
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  fence: CurrentChoiceFence
  current: () => Promise<boolean>
}) {
  const { authority, business, request, current, fence } = input
  const reply = (status: number, value: unknown) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } })
  if (request.method !== "POST") return reply(405, { status: "denied" })
  const params = new URL(request.url).searchParams
  if (params.size !== 1 || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return reply(400, { status: "invalid" })
  const data = await readRequestBody(request, 4096).then((bytes) => object(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)))).catch(() => undefined)
  if (!data || Object.keys(data).length !== 3 || typeof data.id !== "string" || !data.id ||
      typeof data.incarnation !== "string" || !data.incarnation || typeof data.version !== "number" ||
      !Number.isSafeInteger(data.version) || data.version < 1) return reply(400, { status: "invalid" })
  const caseRef = { id: data.id, incarnation: data.incarnation, version: data.version }
  const pending = await authority.state.read(request, "outbox", (state, actor) => {
    const decision = state.cases[caseRef.id]
    if (!decision || decision.incarnation !== caseRef.incarnation || decision.version !== caseRef.version ||
        !decision.participants.includes(actor.principalRef)) return undefined
    const events = decision.ledger.filter((event) => event.kind === "choice-recorded" && event.caseRef.version === caseRef.version)
    if (events.length !== 1 || !events[0]) return undefined
    const entry = state.outbox[JSON.stringify([caseRef.id, caseRef.incarnation, events[0].id])]
    if (entry?.writerPrincipalRef !== actor.principalRef || entry.accessRevision !== actor.accessRevision ||
        entry.eventRef.target.eventId !== events[0].id) return undefined
    return { ref: entry.eventRef, key: JSON.stringify([caseRef.id, caseRef.incarnation, events[0].id]) }
  })
  if (pending.status !== "ok" || !pending.value) return reply(403, { status: "denied" })
  const { ref, key } = pending.value
  const digest = digestSfValue(ref)
  const admitted = await authority.ui.admit(request, "sf_evidence_get", digest)
  if (admitted.status !== "ok") return reply(403, { status: "denied" })
  try {
    if (!await authority.ui.validate(admitted.value, "sf_evidence_get", digest) || !await current())
      return reply(403, { status: "denied" })
    const event = await fence.run(admitted.value, async () => {
      // The outbox reader and the Atlas append must agree on the same case
      // inside the real SQLite transaction, even if an edit wins the race.
      fence.observe(admitted.value, (snapshots) => {
        const decision = object(object(object(snapshots.dashboard.data.__sfProductV1).cases)[caseRef.id])
        return decision.incarnation === caseRef.incarnation && decision.version === caseRef.version
      })
      if (!await fence.check(admitted.value)) return undefined
      const receipt = await business.context.emitFromLedger(ref, admitted.value)
      if (!(receipt.status === "committed" || receipt.status === "already-committed") || receipt.scanner.status !== "clean" ||
          receipt.sourceEventId !== ref.target.eventId || !receipt.eventId) return undefined
      const stored = await authority.state.read(request, "outbox", (state) => {
        const item = state.outbox[key]
        return item?.state === "settled" && digestSfValue(item.eventRef) === digest && item.receipt.status === "committed" &&
          item.receipt.eventId === receipt.eventId && item.receipt.scanner.status === "clean"
      })
      return stored.status === "ok" && stored.value ? receipt.eventId : undefined
    }).catch(() => undefined)
    if (!await current()) return reply(403, { status: "denied" })
    return event ? reply(200, { status: "ok", eventId: event }) : reply(503, { status: "unavailable" })
  } finally { authority.ui.finish(admitted.value) }
}

export type SfTeamCurrentChoice = ReturnType<typeof createSfTeamCurrentChoice>
