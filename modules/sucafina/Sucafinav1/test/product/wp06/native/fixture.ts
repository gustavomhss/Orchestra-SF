import path from "node:path"
import { randomUUID } from "node:crypto"
import { DateTime, Effect, Layer } from "effect"
import { AgentV2 } from "@orchestra/core/agent"
import { makeLocationNode } from "@orchestra/core/effect/app-node"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { EventV2 } from "@orchestra/core/event"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import type { Location } from "@orchestra/core/location"
import { Mcp } from "@orchestra/core/mcp"
import { ModelV2 } from "@orchestra/core/model"
import { PluginV2 } from "@orchestra/core/plugin"
import { ProjectV2 } from "@orchestra/core/project"
import { ProviderV2 } from "@orchestra/core/provider"
import { SessionV2 } from "@orchestra/core/session"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionExecutionLocal } from "@orchestra/core/session/execution/local"
import { SessionStore } from "@orchestra/core/session/store"
import { SessionEvent } from "@orchestra/core/session/event"
import { SessionMessage } from "@orchestra/core/session/message"
import { createLLMEventPublisher } from "@orchestra/core/session/runner/publish-llm-event"
import { SkillV2 } from "@orchestra/core/skill"
import type { Tool } from "@orchestra/core/tool/tool"
import { LLMEvent } from "../../../../../../../packages/llm/src/index.ts"
import { createWp06Runtime } from "../runtime-fixture.ts"
import { createResidentAiBundle } from "../../../../product/ai/resident.ts"
import { createSfRunStore, sfRunSourceFence } from "../../../../product/ai/run-store.ts"
import { buildSfContribution } from "../../../../product/ai/contribution-builder.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { SfNativeAdmission, SfSelectedRuntime, SfSourceCapability } from "../../../../product/contracts/runtime.ts"
import type { SfNativeRunRecord } from "../../../../product/contracts/state.ts"
import type { ContributionEnvelope } from "../../../../product/contracts/resident-ai.ts"
import type { CapabilityResult, TrustedDomainContext, TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import type { SfHumanAction } from "../../../../product/integration/human-authority.ts"
import { registerSfResidentAgents, validSfSelection } from "../../../../product/host-binding/resident-agents.ts"
import { loadSfSkill } from "../../../../product/host-binding/skill-loader.ts"
import { createSfBusinessMcpBridge } from "../../../../product/host-binding/sf-mcp-bridge.ts"
import { createSfDocumentTargetAuthority } from "../../../../../../../apps/cli/src/sucafina-product/document-authority.ts"
import { createSfDocumentServices } from "../../../../../../../apps/cli/src/sucafina-product/document-services.ts"
import { createSfImportServices } from "../../../../../../../apps/cli/src/sucafina-product/import-services.ts"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfProductDispatch } from "../../../../../../../apps/cli/src/sucafina-product/contribution.ts"
import { createSfNativeSkillProof } from "../../../../../../../apps/cli/src/sucafina-product/native-skill-proof.ts"
import { sfNativeLocationRef, sfNativeModelRef } from "../../../../../../../apps/cli/src/sucafina-product/native-identity.ts"
import { createSfDocumentHttp } from "../../../../product/interface/document-http.ts"
import { createSfImportHttp } from "../../../../product/interface/import-http.ts"
import atlasPackage from "../../../../../../../modules/atlas/boundary/package.json" with { type: "json" }
import contractFreeze from "../../../../product/contracts/freeze-v1.json" with { type: "json" }

/** Actual native stores, source registration, skill load and private MCP. The public input is
 * prerecorded through the production event publisher; no external model, C15 oracle or installed
 * scanner qualification is claimed. The reused storage fixture declares its scanner substitute. */
export async function withNativeWp06(work: (fixture: Awaited<ReturnType<typeof compose>>) => Promise<void>) {
  const app = await createWp06Runtime()
  try {
    const root = path.resolve(import.meta.dir, "../../../../product/ai")
    const bundle = await createResidentAiBundle({ root, manifestPath: path.join(root, "manifests/resident.json") })
    const selected: SfSelectedRuntime[] = bundle.profiles.map((profile) => {
      const skills = bundle.skills.filter((skill) => profile.allowedSkills.includes(skill.id))
      return { profile, manifestDigest: bundle.manifestDigest, skills,
        operationIds: profile.allowedOperations.filter((operation) => skills.some((skill) => skill.allowedOperations.includes(operation))) }
    })
    const location = sfNativeLocationRef(app.installation.location)
    const sources = new WeakMap<SkillV2.Interface, SfSourceCapability>()
    const resident = makeLocationNode({
      name: "sucafina/wp06-native-resident",
      deps: [AgentV2.node, SkillV2.node, PluginV2.node],
      layer: Layer.effectDiscard(Effect.gen(function* () {
        const agents = yield* AgentV2.Service
        const skills = yield* SkillV2.Service
        const plugins = yield* PluginV2.Service
        yield* plugins.wait(PluginV2.ID.make("config-agent"))
        const sourceCapability = yield* registerSfResidentAgents({ agents, skills, selected, source: bundle.source }).pipe(Effect.orDie)
        sources.set(skills, sourceCapability)
        yield* Effect.addFinalizer(() => Effect.sync(() => { sources.delete(skills) }))
      })),
    })
    // Location Task captures both Session services from the completed application's exports.
    const layer = AppNodeBuilder.build(LayerNode.group([SessionV2.node, SessionExecution.node, SessionStore.node, EventV2.node, LocationServiceMap.node, ProjectV2.node]),
      [[SessionExecution.node, SessionExecutionLocal.node]], [resident])
    await Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const store = yield* SessionStore.Service
      const events = yield* EventV2.Service
      const projects = yield* ProjectV2.Service
      const locations = yield* LocationServiceMap.Service
      const project = yield* projects.resolve(location.directory)
      yield* Effect.gen(function* () {
        const skills = yield* SkillV2.Service
        const mcp = yield* Mcp.Service
        const sourceCapability = sources.get(skills)
        if (!sourceCapability) throw new Error("Location resident source registration missing")
        const fixture = yield* Effect.promise(() => compose({ app, session, store, events, projectId: project.id,
          selected, sourceCapability, skills, mcp, location }))
        yield* Effect.addFinalizer(() => Effect.promise(() => fixture.dispose()))
        yield* Effect.promise(() => work(fixture))
      }).pipe(Effect.scoped, Effect.provide(locations.get(location)))
    }).pipe(Effect.scoped, Effect.provide(layer), Effect.runPromise)
  } finally { await app.dispose() }
}

async function compose(input: {
  app: Awaited<ReturnType<typeof createWp06Runtime>>; session: SessionV2.Interface; store: SessionStore.Interface; events: EventV2.Interface
  projectId: string; selected: readonly SfSelectedRuntime[]; skills: SkillV2.Interface; mcp: Mcp.Interface
  sourceCapability: SfSourceCapability; location: Location.Ref
}) {
  const { app } = input
  const installation = { ...app.installation, hostId: randomUUID(), projectId: input.projectId, location: input.location }
  const lifetime = { open: true }
  const selectionMatches = (value: SfSelectedRuntime) => validSfSelection(value) && input.selected.some((parent) =>
    digestSfValue(parent.profile) === digestSfValue(value.profile) && parent.manifestDigest === value.manifestDigest &&
    value.skills.every((skill) => parent.skills.some((entry) => digestSfValue(entry) === digestSfValue(skill))) &&
    value.operationIds.every((operation) => parent.operationIds.includes(operation)))
  const proof = createSfNativeSkillProof({ ready: () => lifetime.open, store: () => lifetime.open ? input.store : undefined, selectionMatches })
  const configuration = { digest: "", generation: 0 }
  const providerGeneration = async () => {
    const digest = digestSfValue(await Effect.runPromise(input.mcp.config()))
    if (configuration.digest !== digest) { configuration.digest = digest; configuration.generation++ }
    return configuration.generation
  }
  const operations = [...new Set(input.selected.flatMap((value) => value.operationIds))]
  const humanActions = ["documents.schema", "documents.confirm", "imports.admit", "imports.apply", "analysis.prepare", "analysis.start", "analysis.read"] as const
  const proposalCoverageWrites = new WeakSet<object>()
  const authority = createSfProductAuthority({ ...app.runtime, identity: () => lifetime.open ? installation : undefined, proposalCoverageWrites,
    policyVersion: "wp06-native-mechanism-v1", grants: [app.principal, app.otherPrincipal].map((person) => ({ principalRef: person.id,
      namespaces: ["cases", "contributions", "documents", "receipts", "preferences"] as const, operations, humanActions })),
    createId: randomUUID, now: Date.now, commandIdentity: async (request, operation) => {
      if (request.method === "GET" || request.method === "HEAD") return randomUUID()
      const key = request.headers.get("Idempotency-Key")
      return key && /^[A-Za-z0-9._:-]{8,128}$/.test(key) ? digestSfValue({ operation, key }) : undefined
    }, inspectSession: (id) => Effect.runPromise(input.store.get(id)), verifySelection: async (value) => selectionMatches(value),
    verifySkillReceipt: proof.verify, providerGeneration, authorizeDocument: createSfDocumentTargetAuthority(app.runtime) })
  const documents = createSfDocumentServices({ runtime: app.runtime, authority })
  const imports = createSfImportServices({ runtime: app.runtime, authority })
  if (!documents || !imports) throw new Error("Native fixture services unavailable")
  const business = createSfBusinessServices({ authority, persistence: app.store, proposalCoverageWrites, documentRead: documents.documents.reader,
    extraDescriptors: [...documents.descriptors, ...imports.descriptors] })
  business.initializeAtlas(undefined, { boundaryVersion: atlasPackage.version, schemaVersion: contractFreeze.canonicalSha256,
    manifestVersion: input.selected[0]!.manifestDigest, skillVersion: digestSfValue(input.selected.flatMap((selection) => selection.skills)
      .filter((skill, index, all) => all.findIndex((value) => value.id === skill.id) === index)
      .map((skill) => ({ id: skill.id, version: skill.version, sourceDigest: skill.sourceDigest }))) })
  const dispatch = createSfProductDispatch({ descriptors: business.descriptors, authority: authority.authority })
  const bridge = createSfBusinessMcpBridge({ registry: authority.native, mcp: input.mcp, descriptors: business.descriptors, dispatch })
  const documentHttp = createSfDocumentHttp({ origin: app.origin, mount: "/sucafina", runtime: () => ({ ui: authority.ui, human: authority.human, ...documents }) })
  const importHttp = createSfImportHttp({ origin: app.origin, mount: "/sucafina", runtime: () => ({ ui: authority.ui, human: authority.human, service: imports }) })
  const admittedUi = async <T>(operation: string, payload: unknown, work: (call: TrustedUiContext) => Promise<T>, cookie = app.cookie) => {
    const request = new Request(`${app.origin}/sucafina/dashboard`, { method: "POST", headers: { cookie, origin: app.origin, "Idempotency-Key": randomUUID() } })
    const access = await authority.ui.admit(request, operation, digestSfValue(payload))
    if (access.status !== "ok") throw new Error(`UI admission ${operation}: ${access.reason}`)
    try { return await work(access.value) } finally { authority.ui.finish(access.value) }
  }
  const ui = <T>(operation: string, payload: unknown, work: (call: TrustedUiContext) => Promise<T>, cookie = app.cookie) => admittedUi(operation, payload, async (call) => {
    if (!await authority.ui.validate(call, operation, digestSfValue(payload))) throw new Error(`UI validation ${operation}: authority-unavailable`)
    return work(call)
  }, cookie)
  // The dispatcher consumes its own admission; direct domain handlers above receive a consumed grant.
  const uiDispatch = (operation: string, payload: unknown, cookie = app.cookie) => admittedUi(operation, payload, (call) => dispatch(operation, payload, call), cookie)
  const human = async <T>(action: SfHumanAction, payload: unknown, work: (call: TrustedUiContext) => Promise<T>) => {
    const access = await authority.human.admit(app.request(), action, payload)
    if (access.status !== "ok") throw new Error(`Human admission ${action}: ${access.reason}`)
    try { return await work(access.value) } finally { authority.human.finish(access.value) }
  }
  const caseRef = { id: randomUUID(), incarnation: randomUUID(), version: 1 }
  const seeded = await authority.state.transaction(app.request(), { namespace: "cases", expectedStorageVersion: 0,
    idempotencyKey: randomUUID(), commandDigest: digestSfValue(caseRef), targetRef: authority.creationTarget.ref,
    targetIncarnation: authority.creationTarget.incarnation }, async (state) => {
    state.cases[caseRef.id] = { ...caseRef, state: "draft", objective: "WP06 native mechanism", horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD",
      criteria: [], participants: [app.principal.id], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    return { commit: true, value: caseRef }
  })
  if (seeded.status !== "ok") throw new Error(`Case admission: ${"reason" in seeded ? seeded.reason : seeded.status}`)
  const checkCase = async (record: SfNativeRunRecord, call: TrustedDomainContext): Promise<boolean> => {
    const request = authority.host.requestFor(call)
    if (!request || !await authority.host.revalidate(call)) return false
    const found = await authority.state.read(request, "cases", (state, actor) => {
      const current = state.cases[record.caseRef.id]
      return current?.incarnation === record.caseRef.incarnation && current.version === record.caseRef.version &&
        current.participants.includes(actor.principalRef) && actor.principalRef === record.principalRef && actor.accessRevision === record.accessRevision
    })
    return found.status === "ok" && found.value && await authority.host.revalidate(call)
  }
  const outputVerifiers = new Map<string, (output: ContributionEnvelope, call: TrustedDomainContext) => Promise<PortResult<true>>>()
  const verifyOutput = async (record: SfNativeRunRecord, call: TrustedDomainContext, output?: ContributionEnvelope): Promise<PortResult<true>> => {
    if (!await checkCase(record, call)) return { status: "denied", reason: "case-authority-unavailable" }
    if (!output) return { status: "ok", value: true }
    const verify = outputVerifiers.get(record.runRef)
    return verify ? verify(output, call) : { status: "unavailable", reason: "output-verifier-unavailable" }
  }
  const runs = createSfRunStore({ state: authority.state, requestFor: authority.host.requestFor, revalidate: authority.host.revalidate,
    requiredNamespaces: ["documents"], preflight: async (record, call, output) => {
      if (!await checkCase(record, call)) return { status: "denied", reason: "case-authority-unavailable" }
      const verified = await verifyOutput(record, call, output)
      if (verified.status !== "ok") return verified
      return { status: "ok", value: { sourceFence: await app.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: sfRunSourceFence(snapshot) })) } }
    }, revalidateForCommit: (record, call, _snapshot, output) => verifyOutput(record, call, output), now: () => new Date().toISOString() })
  const releases = new Set<() => void>()
  const bind = async (skillId: string, skillInput: unknown = {}, prompt?: string, variant?: string) => {
    const parent = input.selected.find((value) => value.profile.id === (skillId === "sf-explicar-forecast" ? "sf_finance" : skillId === "sf-enquadrar-decisao" ? "sf_maestro" : "sf_procurement") && value.skills.some((skill) => skill.id === skillId))
    const skill = parent?.skills.find((value) => value.id === skillId)
    if (!parent || !skill) throw new Error("Native skill missing from real bundle")
    const selected: SfSelectedRuntime = { ...parent, skills: [skill], operationIds: [...skill.allowedOperations] }
    // Deliberately named as prerecorded ingress, never represented as a provider completion.
    const requestedModel = ModelV2.Ref.make({ providerID: ProviderV2.ID.make("wp06-recorded-ingress"), id: ModelV2.ID.make("deterministic-public-events"),
      ...(variant === undefined ? {} : { variant: ModelV2.VariantID.make(variant) }) })
    const model = sfNativeModelRef(requestedModel)
    const runId = randomUUID()
    const request = app.request()
    const currentCaseRef = structuredClone(caseRef)
    const intent = { caseRef: currentCaseRef, skillId, skillInput, selected, model: requestedModel }
    const access = await authority.human.admit(request, "analysis.start", intent)
    if (access.status !== "ok") throw new Error(`Run admission: ${access.reason}`)
    try {
      const at = new Date().toISOString()
      const record: SfNativeRunRecord = { schema: "sf-native-run-v1", runRef: runId, version: 1, requestDigest: digestSfValue(intent), intentDigest: digestSfValue(intent),
        skillInputDigest: digestSfValue(skillInput), principalRef: access.value.binding.principalRef, accessRevision: access.value.binding.accessRevision,
        policyVersion: access.value.binding.policyVersion, caseRef: currentCaseRef, selection: selected, model, skillId, objective: "WP06 deterministic native ingress",
        contextFingerprint: digestSfValue({ caseRef: currentCaseRef, skillInput }), createdAt: at, updatedAt: at, state: "preparing" }
      const stored = await runs.create(record, access.value)
      if (stored.status !== "ok") throw new Error(`Native run persistence: ${stored.reason}`)
      const session = await Effect.runPromise(input.session.create({ location: installation.location, agent: AgentV2.ID.make(parent.profile.id), model }))
      if (digestSfValue(session.model) !== digestSfValue(record.model) || digestSfValue(session.location) !== digestSfValue(installation.location))
        throw new Error("Persisted Core Session identity differs from admitted run")
      const receipt = await Effect.runPromise(loadSfSkill({ session: input.session, skills: input.skills, sourceCapability: input.sourceCapability,
        selected, sessionID: session.id, profile: parent.profile, skill, runId, manifestDigest: parent.manifestDigest }))
      await Effect.runPromise(input.store.narrow(session.id, { skills: { entry: skill.id, allow: [skill.id] },
        tools: [...selected.operationIds], budgets: { loads: 0, toolCalls: parent.profile.maxSteps } }))
      const admission: SfNativeAdmission = { request, selected, sessionID: session.id, runId, caseRef: currentCaseRef, profile: parent.profile,
        manifestDigest: parent.manifestDigest, skillReceipts: [receipt], entryMode: "interactive" }
      const release = proof.observe({ session, admission, skills: input.skills, sourceCapability: input.sourceCapability })
      releases.add(release)
      const attached = await runs.attach(runId, stored.value.version, session.id, receipt, access.value)
      if (attached.status !== "ok") throw new Error(`Native receipt persistence: ${attached.reason}`)
      const bound = await authority.native.bind(admission)
      if (bound.status !== "ok") throw new Error(`Native binding: ${bound.reason}`)
      const promptID = prompt ? SessionMessage.ID.create() : undefined
      const promptAdmission = promptID && prompt ? await Effect.runPromise(input.session.prompt({ id: promptID, sessionID: session.id, prompt: { text: prompt }, resume: false })) : undefined
      const publisher = createLLMEventPublisher(input.events, { sessionID: session.id, agent: parent.profile.id, model })
      const context = async (operation: string, payload: unknown): Promise<Tool.Context> => {
        const callId = randomUUID()
        await Effect.runPromise(publisher.publish(LLMEvent.toolCall({ id: callId, name: operation, input: payload })))
        const assistantMessageID = await Effect.runPromise(publisher.assistantMessageID(callId))
        const persisted = await Effect.runPromise(input.store.message(assistantMessageID))
        if (persisted?.sessionID !== session.id || persisted.message.type !== "assistant") throw new Error("Native assistant message was not projected")
        return { sessionID: session.id, agent: AgentV2.ID.make(parent.profile.id), assistantMessageID, toolCallID: callId, model }
      }
      const call = async (surface: "native" | "mcp", operation: string, payload: unknown) => {
        const native = await context(operation, payload)
        const execute = async (): Promise<CapabilityResult> => {
          if (surface === "mcp") return bridge.call(native, operation, payload)
          const lease = await authority.native.lease(native, operation, digestSfValue(payload))
          if (lease.status !== "ok") return { status: "denied", reason: lease.reason, receipt: { kind: "unbound", operation, code: "invalid-binding", at: new Date().toISOString() } }
          try { return await dispatch(operation, payload, lease.value) } finally { authority.native.finish(lease.value) }
        }
        const result = await execute()
        await Effect.runPromise(publisher.publish(LLMEvent.toolResult({ id: native.toolCallID, name: operation,
          result: { type: "content", value: [{ type: "text", text: JSON.stringify(result) }] },
          output: { structured: result, content: [{ type: "text", text: JSON.stringify(result) }] } })))
        return result
      }
      const domain = async <T>(operation: string, payload: unknown, work: (call: TrustedDomainContext) => Promise<T>): Promise<T> => {
        const native = await context(operation, payload)
        const lease = await authority.native.lease(native, operation, digestSfValue(payload))
        if (lease.status !== "ok") throw new Error(`Native domain lease ${operation}: ${lease.reason}`)
        try {
          if (!authority.native.consume(lease.value, operation, digestSfValue(payload))) throw new Error(`Native domain consumption ${operation}: invalid-binding`)
          return await work(lease.value)
        } finally { authority.native.finish(lease.value) }
      }
      const complete = async (candidate: unknown, verify: (output: ContributionEnvelope, call: TrustedDomainContext) => Promise<PortResult<true>>) => {
        outputVerifiers.set(runId, verify)
        const textId = randomUUID()
        await Effect.runPromise(publisher.publish(LLMEvent.textStart({ id: textId })))
        await Effect.runPromise(publisher.publish(LLMEvent.textDelta({ id: textId, text: JSON.stringify(candidate) })))
        await Effect.runPromise(publisher.publish(LLMEvent.textEnd({ id: textId })))
        const assistantMessageID = await Effect.runPromise(publisher.startAssistant())
        await Effect.runPromise(Effect.gen(function* () {
          yield* input.events.publish(SessionEvent.Step.Ended, { sessionID: session.id, assistantMessageID, timestamp: yield* DateTime.now,
            finish: "stop", cost: 0, usageKnown: false, tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } })
        }))
        const message = await Effect.runPromise(input.store.message(assistantMessageID))
        if (message?.message.type !== "assistant" || !message.message.time.completed || message.message.error) throw new Error("Recorded assistant did not complete")
        const text = message.message.content.filter((part) => part.type === "text")
        if (text.length !== 1 || text[0]?.type !== "text") throw new Error("Recorded output is ambiguous")
        const actualModel = message.message.model
        const publicCandidate: unknown = JSON.parse(text[0].text)
        return human("analysis.start", intent, async (context) => {
          const running = await runs.transition(runId, attached.value.version, "running", undefined, context)
          if (running.status !== "ok") throw new Error(`Run did not start: ${running.reason}`)
          const built = buildSfContribution({ candidate: publicCandidate, run: running.value, actualModel, outputId: randomUUID(), createdAt: new Date().toISOString() })
          if (built.status !== "ok") throw new Error(`Contribution admission: ${built.reason}`)
          const saved = await runs.publish(runId, running.value.version, built.value, context)
          if (saved.status !== "ok") throw new Error(`Contribution persistence: ${saved.reason}`)
          return { run: saved.value, output: built.value, assistantMessageID }
        })
      }
      return { admission, binding: bound.value, session, receipt, record: attached.value, requestedModel, promptAdmission, context, call, domain, complete, release }
    } finally { authority.human.finish(access.value) }
  }
  const http = async (kind: "document" | "import", mode: string, payload?: unknown, query: Record<string, string> = {}, cookie = app.cookie) => {
    const surface = kind === "document" ? "procurement" : "planner"
    const url = new URL(`${app.origin}/sucafina/${surface}`)
    url.searchParams.set("sf", mode)
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
    const request = new Request(url, payload === undefined ? { headers: { cookie } } : { method: "POST", headers: { cookie, origin: app.origin,
      "Idempotency-Key": randomUUID(), ...(payload instanceof FormData ? {} : { "Content-Type": "application/json" }) }, body: payload instanceof FormData ? payload : JSON.stringify(payload) })
    const response = await (kind === "document" ? documentHttp : importHttp)(request, surface)
    if (!response) throw new Error("Native consumer route missing")
    return response
  }
  return { app, installation, authority, documents, imports, business, dispatch, bridge, proof, selected: input.selected, sessionStore: input.store, caseRef, runs, ui, uiDispatch, human, bind, http, importHttp,
    dispose: async () => { for (const release of releases) release(); proof.clear(); lifetime.open = false; documents.dispose(); business.dispose() } }
}

export async function readNativeResponse<T>(response: Response): Promise<T> {
  const value = await response.json() as PortResult<T>
  if (!response.ok || value.status !== "ok") throw new Error(`Consumer response ${response.status}: ${JSON.stringify(value)}`)
  return value.value
}
