import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { AgentV2 } from "@orchestra/core/agent"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Global } from "@orchestra/core/global"
import { Location } from "@orchestra/core/location"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import { ModelV2 } from "@orchestra/core/model"
import { ProviderV2 } from "@orchestra/core/provider"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionV2 } from "@orchestra/core/session"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionExecutionLocal } from "@orchestra/core/session/execution/local"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionStore } from "@orchestra/core/session/store"
import type { SessionSchema } from "@orchestra/core/session/schema"
import type { SkillV2 } from "@orchestra/core/skill"
import { ToolRegistry } from "@orchestra/core/tool/registry"
import type { Tool } from "@orchestra/core/tool/tool"
import { Effect } from "effect"
import { createSfProductContribution, createSfProductDispatch } from "../../../../../../apps/cli/src/sucafina-product/contribution.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { object } from "../../../runtime/contract.ts"
import type { Persistence, Snapshot } from "../../../runtime/contract.ts"
import type { AssetPersistence } from "../../../runtime/assets.ts"
import { resolve } from "../../../src/identity.ts"
import { createResidentAiBundle } from "../../../product/ai/resident.ts"
import { createSfRunStore, sfRunSourceFence } from "../../../product/ai/run-store.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardSourceHost } from "../../../product/dashboard/sources.ts"
import { createDashboardPort } from "../../../product/dashboard/port.ts"
import { createDashboardCapabilities } from "../../../product/dashboard/capabilities.ts"
import { dashboardBiPresentation } from "../../../product/dashboard/bi.ts"
import { resolveDashboardBiSelection } from "../../../product/dashboard/bi-metadata.ts"
import { bindDashboardBiPort, createDashboardBiSource } from "../../../product/analytics/dashboard.ts"
import { createBiDescriptor, readBiPresentation } from "../../../product/analytics/capabilities.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import type { SfNativeAdmission, SfSelectedRuntime, SfSourceCapability } from "../../../product/contracts/runtime.ts"
import type { SfNativeRunRecord, SfStateResult } from "../../../product/contracts/state.ts"
import type { TrustedDomainContext, TrustedExecutionBinding } from "../../../product/contracts/sf-execution.ts"
import type { BiViewRequest } from "../../../product/contracts/operations.ts"
import { sfSourceFor, validSfSelection } from "../../../product/host-binding/resident-agents.ts"
import { loadSfSkill } from "../../../product/host-binding/skill-loader.ts"

export const nativePeriod = { start: "2026-01-01", end: "2026-12-31" }
const at = "2026-11-13T00:00:00Z"
const routes = {
  dashboard: { profile: "sf_maestro", skill: "sf-produzir-bi-contextual", operation: "sf_dashboard_read" },
  kpi: { profile: "sf_finance", skill: "sf-explicar-forecast", operation: "sf_kpi_explain" },
  bi: { profile: "sf_finance", skill: "sf-produzir-bi-contextual", operation: "sf_bi_view" },
} as const
export type NativeDashboardRoute = keyof typeof routes

export function nativeValue<T>(result: PortResult<T> | SfStateResult<T>): T {
  if (result.status !== "ok") throw new Error(`Native Dashboard fixture: ${result.status} ${"reason" in result ? result.reason : ""}`)
  return result.value
}

/** AM02's direct harness admission, using production Session, skill, C08, authority and C16 services.
 * The selected model is persisted metadata only. No provider turn or generated contribution is claimed. */
export async function withNativeDashboard(work: (fixture: Awaited<ReturnType<typeof createNativeFixture>>) => Promise<void>) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-dashboard-native-"))
  const global = Global.make(Object.fromEntries(["home", "data", "cache", "config", "state", "tmp", "bin", "log", "repos"].map((key) => [key, path.join(directory, "core", key)] as const)))
  await Promise.all(Object.values(global).map((directory) => mkdir(directory, { recursive: true })))
  const fixture = await createNativeFixture(directory)
  // Native Location tools capture the root's exported Session and execution services.
  // Export the real coordinator as well as providing it to SessionV2's constructor.
  const layer = AppNodeBuilder.build(LayerNode.group([SessionV2.node, SessionExecution.node, SessionStore.node, LocationServiceMap.node]), [
    [Global.node, Global.layerWith(global)],
    [SessionExecution.node, SessionExecutionLocal.node],
  ], fixture.contribution.locationNodes)
  try {
    await Effect.gen(function* () {
      const sessions = yield* SessionV2.Service
      const store = yield* SessionStore.Service
      const locations = yield* LocationServiceMap.Service
      // Resolve the same Location graph used internally by SessionV2.skill. The product contribution
      // installs its actual resident source and actual native tools in that graph.
      const tools = yield* Effect.gen(function* () {
        return yield* ToolRegistry.Service
      }).pipe(Effect.provide(locations.get(fixture.location)))
      yield* Effect.promise(() => fixture.activate(sessions, store, tools))
      yield* Effect.promise(() => work(fixture))
    }).pipe(Effect.scoped, Effect.provide(layer), Effect.runPromise)
  } finally {
    await fixture.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}

async function createNativeFixture(directory: string) {
  const location = Location.Ref.make({ directory: AbsolutePath.make(path.join(directory, "workspace")) })
  await mkdir(location.directory, { recursive: true })
  const root = path.resolve(import.meta.dir, "../../../product/ai")
  const bundle = await createResidentAiBundle({ root, manifestPath: path.join(root, "manifests/resident.json") })
  const selections = (["dashboard", "kpi", "bi"] as const).map((route) => {
    const value = routes[route]
    const profile = bundle.profiles.find((profile) => profile.id === value.profile)
    const skill = bundle.skills.find((skill) => skill.id === value.skill)
    if (!profile || !skill) throw new Error(`Resident route unavailable: ${route}`)
    return { route, selected: { profile, skills: [skill], operationIds: [value.operation], manifestDigest: bundle.manifestDigest } satisfies SfSelectedRuntime }
  })
  const selected = bundle.profiles.filter((profile) => Object.values(routes).some((route) => route.profile === profile.id)).map((profile) => ({
    profile, manifestDigest: bundle.manifestDigest,
    skills: bundle.skills.filter((skill) => Object.values(routes).some((route) => route.profile === profile.id && route.skill === skill.id)),
    operationIds: Object.values(routes).filter((route) => route.profile === profile.id).map((route) => route.operation),
  }))
  const driver = { current: await openLocalStore(path.join(directory, "product")) }
  // Only the driver is reopened. Every adapter keeps using the real serializable transaction API.
  const forwarding: AssetPersistence & Pick<Persistence, "transactionAll" | "currentSnapshots"> = {
    transaction: (surface, work, options) => driver.current.transaction(surface, work, options),
    currentSnapshots: () => driver.current.currentSnapshots?.(),
    transactionAll: (work, options) => {
      if (!driver.current.transactionAll) throw new Error("LocalStore transactionAll unavailable")
      return driver.current.transactionAll(work, options)
    },
  }
  const persistence = createSfSourcePersistence({ persistence: forwarding, enumerate: enumerateSfSources, createId: randomUUID, projectScope: createSfSourceScopeProjector(() => at) })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "native-dashboard-admins", version: 1, by: "person" }]
    snapshot.data.opexOwners = [{ id: "owner", budget: 1200 }]
    snapshot.data.opexEntries = [{ id: "january", ownerId: "owner", year: 2026, month: 1, budget: 200, actual: 0 }]
    snapshot.data.capexProjects = []
    snapshot.data.capexEntries = []
    return { commit: true, value: undefined }
  })
  const request = new Request("https://native-dashboard.test/product", { headers: { "x-test-principal": "person" } })
  const identity: { current?: { installationId: string; hostId: string; projectId: string; location: Location.Ref } } = {}
  const runtime: { sessions?: SessionV2.Interface; store?: SessionStore.Interface; tools?: ToolRegistry.Interface; generation: number } = { generation: 1 }
  const registered: { current?: { skills: SkillV2.Interface; sourceCapability: SfSourceCapability } } = {}
  const observed = new Map<string, { request: Request; digest: string }>()
  const bindings = new Set<TrustedExecutionBinding>()
  const admissions = new Map<NativeDashboardRoute, SfNativeAdmission>()
  const admissionDigest = (admission: SfNativeAdmission) => digestSfValue({ ...admission, request: undefined })
  const product = createSfProductAuthority({
    identity: () => identity.current, installationId: "native-dashboard-installation", origin: new URL(request.url).origin,
    policyVersion: "native-dashboard-policy-v1", persistence, createId: randomUUID, now: Date.now,
    grants: [{ principalRef: "person", namespaces: ["cases", "contributions"], operations: Object.values(routes).map((route) => route.operation), humanActions: ["analysis.start"] }],
    authenticate: async (request, context) => context?.surface === "dashboard" && request.headers.get("x-test-principal") === "person"
      ? resolve("person", [...context.roleMap], (group) => group === "native-dashboard-admins") : null,
    environment: async () => ({ at, id: randomUUID, directory: [] }), commandIdentity: async () => randomUUID(),
    inspectSession: async (id) => runtime.store ? Effect.runPromise(runtime.store.get(id)) : undefined,
    verifySelection: async (value) => validSfSelection(value) && selections.some((entry) => digestSfValue(entry.selected) === digestSfValue(value)),
    verifySkillReceipt: async (admission) => {
      const proof = observed.get(admission.sessionID)
      const receipt = admission.skillReceipts[0]
      const source = registered.current
      if (!runtime.store || !source || !proof || !receipt || admission.skillReceipts.length !== 1 || proof.request !== admission.request || proof.digest !== admissionDigest(admission) || !sfSourceFor(source.sourceCapability, source.skills, admission.selected)) return false
      const skill = await Effect.runPromise(source.skills.get(receipt.skillId))
      const message = await Effect.runPromise(runtime.store.message(SessionMessage.ID.make(receipt.loadedMessageId)))
      return !!skill && message?.sessionID === admission.sessionID && message.message.type === "synthetic" &&
        message.message.text.startsWith(`<skill_content name="${skill.name}">\n# Skill: ${skill.name}\n\n${skill.content.trim()}\n\n`) &&
        new Bun.CryptoHasher("sha256").update(await Bun.file(skill.location).arrayBuffer()).digest("hex") === receipt.sourceDigest &&
        new Bun.CryptoHasher("sha256").update(skill.content.trim()).digest("hex") === receipt.instructionsDigest
    },
    providerGeneration: async () => runtime.generation,
    authorizeDocument: async () => undefined,
  })
  const dashboard = createDashboardPort({ host: product.host, sources: createDashboardSourceHost({ host: product.host, scopedSources: persistence }) })
  const source = createDashboardBiSource(bindDashboardBiPort({
    dashboard,
    resolve: async (request) => {
      const selection = resolveDashboardBiSelection(request.viewId, request.period)
      if (!selection || request.viewId !== "BI01") return { status: "unavailable", reason: "unsupported-view" }
      return { status: "ok", value: { fields: selection.fields, present: (projection) => dashboardBiPresentation("BI01", projection) } }
    },
    revalidate: async (_request, context) => product.authority.revalidateDomainContext(context),
  }))
  const descriptors = [...createDashboardCapabilities(dashboard, async (context, operation, input, output) => product.authority.receiptFor(context, operation, input, output)), createBiDescriptor(source, product.authority)]
  const dispatch = createSfProductDispatch({ descriptors, authority: product.authority })
  const contribution = createSfProductContribution({ registry: product.native, descriptors, authority: product.authority, selected, source: bundle.source, onRegistered: (registration) => { registered.current = registration } })
  const caseRef = { id: "native-dashboard-case", incarnation: randomUUID(), version: 1 }
  const checkRun = async (record: SfNativeRunRecord, context: TrustedDomainContext, snapshot: Readonly<Snapshot>): Promise<PortResult<true>> => {
    const current = object(object(object(snapshot.data.__sfProductV1).cases)[record.caseRef.id])
    if (!await product.host.revalidate(context)) return { status: "denied", reason: "authority-unavailable" }
    if (current.id !== record.caseRef.id || current.incarnation !== record.caseRef.incarnation || current.version !== record.caseRef.version || !Array.isArray(current.participants) || !current.participants.includes(record.principalRef)) return { status: "stale", reason: "case-changed" }
    return { status: "ok", value: true }
  }
  const runs = createSfRunStore({ state: product.state, requestFor: product.host.requestFor, revalidate: product.host.revalidate, now: () => at,
    preflight: (record, context) => persistence.transaction<PortResult<{ sourceFence: string }>>("dashboard", async (snapshot) => {
      const checked = await checkRun(record, context, snapshot)
      return { commit: false, value: checked.status === "ok" ? { status: "ok", value: { sourceFence: sfRunSourceFence(snapshot) } } : checked }
    }), revalidateForCommit: checkRun,
  })
  const model = ModelV2.Ref.make({ providerID: ProviderV2.ID.openai, id: ModelV2.ID.make("gpt-4.1") })
  async function prepare(route: NativeDashboardRoute, existing?: SessionSchema.Info) {
    const sessions = runtime.sessions
    const registration = registered.current
    const selection = selections.find((entry) => entry.route === route)?.selected
    if (!sessions || !registration || !selection) throw new Error("Native Location not initialized")
    const session = existing ?? await Effect.runPromise(sessions.create({ location, agent: AgentV2.ID.make(selection.profile.id), model }))
    identity.current ??= { installationId: "native-dashboard-installation", hostId: randomUUID(), projectId: session.projectID, location }
    if (session.projectID !== identity.current.projectId) throw new Error("Native Session placement changed")
    const runId = randomUUID()
    const intent = { caseRef, profileId: selection.profile.id, skillId: selection.skills[0]!.id, operation: routes[route].operation, period: nativePeriod }
    const context = nativeValue(await product.human.admit(new Request(request, { method: "POST", headers: { "x-test-principal": "person", origin: new URL(request.url).origin } }), "analysis.start", intent))
    try {
      if (!await product.human.authorize(context, "analysis.start", intent)) throw new Error("Native run intent was not admitted")
      const record: SfNativeRunRecord = {
        schema: "sf-native-run-v1", runRef: runId, version: 1, state: "preparing", requestDigest: digestSfValue(intent), intentDigest: digestSfValue(intent), skillInputDigest: digestSfValue({ operation: intent.operation, period: nativePeriod }),
        principalRef: context.binding.principalRef, policyVersion: context.binding.policyVersion, accessRevision: context.binding.accessRevision,
        caseRef, selection, model, skillId: intent.skillId, objective: "Read the authorized Dashboard and preserve missing measurements", contextFingerprint: digestSfValue({ caseRef, period: nativePeriod, accessRevision: context.binding.accessRevision }), createdAt: at, updatedAt: at,
      }
      nativeValue(await runs.create(record, context))
      const receipt = await Effect.runPromise(loadSfSkill({ session: sessions, skills: registration.skills, sourceCapability: registration.sourceCapability, selected: selection, sessionID: session.id, profile: selection.profile, skill: selection.skills[0]!, runId, manifestDigest: bundle.manifestDigest }))
      nativeValue(await runs.attach(runId, 1, session.id, receipt, context))
      const admission: SfNativeAdmission = { request, selected: selection, sessionID: session.id, runId, caseRef, profile: selection.profile, manifestDigest: bundle.manifestDigest, skillReceipts: [receipt], entryMode: "interactive" }
      observed.set(session.id, { request, digest: admissionDigest(admission) })
      admissions.set(route, admission)
      return admission
    } finally { product.human.finish(context) }
  }
  const admission = (route: NativeDashboardRoute) => {
    const value = admissions.get(route)
    if (!value) throw new Error(`Native route not prepared: ${route}`)
    return value
  }
  const bind = async (route: NativeDashboardRoute) => {
    const binding = nativeValue(await product.native.bind(admission(route)))
    bindings.add(binding)
    return binding
  }
  const call = (route: NativeDashboardRoute): Tool.Context => ({ sessionID: admission(route).sessionID, agent: AgentV2.ID.make(admission(route).profile.id), assistantMessageID: SessionMessage.ID.create(), toolCallID: randomUUID() })
  return {
    location, contribution, bundle, persistence, product, dashboard, descriptors, dispatch, caseRef, request, admission, bind, call, prepare,
    async activate(sessions: SessionV2.Interface, store: SessionStore.Interface, tools: ToolRegistry.Interface) {
      runtime.sessions = sessions; runtime.store = store; runtime.tools = tools
      const placement = await Effect.runPromise(sessions.create({ location, agent: AgentV2.ID.make("sf_maestro"), model }))
      identity.current = { installationId: "native-dashboard-installation", hostId: randomUUID(), projectId: placement.projectID, location }
      nativeValue(await product.state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, targetRef: product.creationTarget.ref, targetIncarnation: product.creationTarget.incarnation, idempotencyKey: randomUUID(), commandDigest: digestSfValue(caseRef) }, async (state, authority) => {
        state.cases[caseRef.id] = { ...caseRef, state: "draft", objective: "Review the Dashboard", horizon: nativePeriod, currency: "USD", criteria: [], participants: [authority.principalRef], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
        return { commit: true, value: true }
      }))
      await prepare("dashboard", placement)
      for (const route of ["kpi", "bi"] as const) await prepare(route)
    },
    async issue(fields: readonly string[]) {
      const input = { selectionRef: "source-discovery", fields, period: nativePeriod }
      const context = nativeValue(await product.ui.admit(request, "sf_dashboard_read", digestSfValue(input)))
      try {
        if (!await product.ui.validate(context, "sf_dashboard_read", digestSfValue(input))) throw new Error("Source discovery authority unavailable")
        return nativeValue(await createDashboardSourceIssuer({ host: product.host, scopedSources: persistence })({ page: "Budget Overview", fields, period: nativePeriod }, context))
      } finally { product.ui.finish(context) }
    },
    async ui(operation: string, payload: unknown) {
      const context = nativeValue(await product.ui.admit(request, operation, digestSfValue(payload)))
      try { return await dispatch(operation, payload, context) }
      finally { product.ui.finish(context) }
    },
    async wrapper(context: Tool.Context, operation: string, payload: unknown) {
      if (!runtime.tools) throw new Error("Native tool registry unavailable")
      const materialization = await Effect.runPromise(runtime.tools.materialize())
      if (!materialization.definition(operation) || !materialization.registrationIdentity(operation)) throw new Error(`Native wrapper not registered: ${operation}`)
      // AM02 explicitly permits host harness calls. These are routing IDs, not a fabricated model message.
      return Effect.runPromise(materialization.settle({ sessionID: context.sessionID, agent: context.agent, assistantMessageID: context.assistantMessageID, call: { type: "tool-call", id: context.toolCallID, name: operation, input: payload } }))
    },
    presentation: (request: BiViewRequest, context: TrustedDomainContext) => readBiPresentation(request, context, source, product.authority),
    async messages(sessionID: SessionSchema.ID) {
      if (!runtime.sessions) throw new Error("SessionV2 unavailable")
      return Effect.runPromise(runtime.sessions.messages({ sessionID }))
    },
    async session(sessionID: SessionSchema.ID) {
      if (!runtime.store) throw new Error("SessionStore unavailable")
      return Effect.runPromise(runtime.store.get(sessionID))
    },
    snapshot: () => persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) })),
    async reopen() {
      bindings.forEach((binding) => product.native.revoke(binding)); bindings.clear(); observed.clear()
      await driver.current.dispose()
      driver.current = await openLocalStore(path.join(directory, "product"))
      if (!identity.current) throw new Error("Host identity unavailable")
      identity.current = { ...identity.current, hostId: randomUUID() }
      runtime.generation++
    },
    async dispose() {
      bindings.forEach((binding) => product.native.revoke(binding))
      await driver.current.dispose()
    },
  }
}
