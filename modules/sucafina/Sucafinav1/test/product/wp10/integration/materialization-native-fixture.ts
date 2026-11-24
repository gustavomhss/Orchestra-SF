import { expect } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Effect } from "effect"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import type { CaseLedgerEvent } from "../../../../product/contracts/decisions.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { SfStateResult } from "../../../../product/contracts/state.ts"
import type { TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createResidentAiBundle } from "../../../../product/ai/resident.ts"
import { probeSfAtlasScanner } from "../../../../product/host-binding/atlas-scanner.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { enqueueSfLedgerEvent } from "../../../../product/integration/ledger-outbox.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import atlasPackage from "../../../../../../atlas/boundary/package.json" with { type: "json" }
import freeze from "../../../../product/contracts/freeze-v1.json" with { type: "json" }
import type { compositionTestDeadline } from "./composition-test-deadline.ts"

type Deadline = ReturnType<typeof compositionTestDeadline>

function ok<Value>(result: PortResult<Value> | SfStateResult<Value>): Value {
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  return result.value
}

/** Snapshot-only experiment setup. The existing native capture fixture body is
 * preserved literally, apart from this export/name; no original spec is imported. */
export async function nativeMaterializationCaptureFixture(deadline: Deadline) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-atlas-capture-native-"))
  deadline.own(() => rm(directory, { recursive: true, force: true }))
  const store = await openLocalStore(path.join(directory, "store"))
  deadline.own(() => store.dispose())
  const at = "2027-02-02T00:00:00Z", period = { start: "2027-01-01", end: "2027-12-31" }
  const control = { active: true }
  const persistence = { ...store, ...createSfSourcePersistence({ persistence: store, createId: randomUUID,
    enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) }) }
  const origin = "https://atlas-capture.example.test"
  const request = () => new Request(origin + "/planner", { method: "POST", signal: deadline.signal,
    headers: { origin, "idempotency-key": randomUUID() } })
  const identity = { installationId: "atlas-capture-installation", hostId: "host", projectId: "project",
    location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const writes = new WeakSet<object>()
  const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId,
    origin, policyVersion: "atlas-capture-policy", persistence, proposalCoverageWrites: writes,
    grants: [{ principalRef: "person", namespaces: ["cases", "preferences", "contributions", "atlas", "outbox"],
      operations: ["sf_case_draft", "sf_case_read", "sf_forecast_compare", "sf_evidence_get"] }],
    authenticate: async (_incoming, scope) => control.active && scope ? { id: "person", canWrite: true,
      roles: [{ surface: scope.surface, role: scope.surface === "planner" ? "finance" : "admin" }] } : null,
    environment: async () => { deadline.check(); return { at, id: randomUUID, directory: [] } },
    createId: randomUUID, now: Date.now, commandIdentity: async () => randomUUID(), inspectSession: async () => undefined,
    verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => 1,
    authorizeDocument: async () => undefined })
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: writes })
  deadline.own(() => business.dispose())
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("planner", async (snapshot) => {
    snapshot.data = { versions: [{ id: "v0", name: "Observed forecast", year: 2027, closed: 0,
      lines: [{ id: "line", name: "Service", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD",
        b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(100) }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }],
      officials: { "2027": "v0" }, entities: [], allocations: [], roster: [] }
    return { commit: true, value: undefined }
  })
  const scanner = await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const process = yield* AppProcess.Service
    return yield* Effect.promise(() => probeSfAtlasScanner(process))
  })).pipe(Effect.provide(LayerNode.compile(AppProcess.node))), { signal: deadline.signal })
  if (!scanner) throw new Error("The real pinned Atlas scanner is required")
  const sourceRoot = path.resolve(import.meta.dir, "../../../../product/ai")
  const bundle = await createResidentAiBundle({ root: sourceRoot, manifestPath: path.join(sourceRoot, "manifests/resident.json") })
  business.initializeAtlas(scanner, { boundaryVersion: atlasPackage.version, schemaVersion: freeze.canonicalSha256,
    manifestVersion: bundle.manifestDigest, skillVersion: digestSfValue(bundle.skills
      .map((entry) => ({ id: entry.id, version: entry.version, sourceDigest: entry.sourceDigest }))) })
  const ui = async <Value>(operation: string, payload: unknown, work: (call: TrustedUiContext) => Promise<Value>) => {
    const digest = digestSfValue(payload)
    const call = ok(await authority.ui.admit(request(), operation, digest))
    try {
      expect(await authority.ui.validate(call, operation, digest)).toBe(true)
      return await work(call)
    } finally { authority.ui.finish(call) }
  }
  const source = await ui("sf_forecast_compare", {}, async (call) => ok(await business.plannerProduct.issueSource("v0", call)).evidence)
  const input = { objective: "Preserve a real original capture", horizon: period, currency: "USD",
    criteria: ["Review the observed service cost"], sourceRefs: [source] }
  const draft = await ui("sf_case_draft", input, async (call) => ok(await business.cases.draft(input, call)))
  const previous = { id: draft.id, incarnation: draft.incarnation, version: draft.version }
  const before = ok(await authority.state.read(request(), "cases", (state) => ({
    value: structuredClone(state.cases[previous.id]), cases: state.versions.cases, outbox: state.versions.outbox,
  })))
  const value = before.value
  if (!value || value.version !== previous.version) throw new Error("The drafted real case revision is required")
  const ref = { ...previous, version: previous.version + 1 }
  const event: CaseLedgerEvent = { id: randomUUID(), caseRef: ref, kind: "reconsideration-accepted", principalRef: "person", at,
    consideredActions: ["Review the observed service cost"], factualGaps: [], lifecycleState: "investigating",
    rationale: "Preserve the observed service estimate", evidenceRefs: [source], outputDigest: digestSfValue(source) }
  const outbox = ok(await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: before.cases,
    additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: before.outbox }],
    targetRef: previous.id, targetIncarnation: previous.incarnation, idempotencyKey: event.id, commandDigest: digestSfValue(event),
  }, async (state, actor) => {
    state.cases[previous.id] = { ...value, version: ref.version, state: "investigating", ledger: [...value.ledger, event] }
    return { commit: true, value: ok(enqueueSfLedgerEvent(state, event, {
      installationId: identity.installationId, projectId: identity.projectId, authority: actor,
    })) }
  }))
  const snapshot = async () => ok(await authority.state.read(request(), "atlas", (state) => structuredClone(state)))
  return { authority, business, persistence, control, source, ref, outbox, scanner, at, snapshot, ui }
}