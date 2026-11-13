import { roleMap } from "../../runtime/admin.ts"
import { object, rows } from "../../runtime/contract.ts"
import type { Actor, Environment, Snapshot } from "../../runtime/contract.ts"
import { domain } from "../../runtime/procurement.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../contracts/business-context.ts"
import type { CommandReceipt, DomainProjection } from "../contracts/context.ts"
import type { DecisionCase, PreparedChange } from "../contracts/decisions.ts"
import type { DecisionCasePort, PlannerPort, PlannerSourceHost, PortResult, PreparedApplyPort } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductState, SfStateAuthority } from "../contracts/state.ts"
import type { createSfProductAuthority } from "../integration/product-authority.ts"
import type { SfSourceScope } from "../integration/source-lifecycle.ts"
import { decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import { createDecisionIntentFences } from "../decisions/intent-fences.ts"
import { createDecisionMutations } from "../decisions/mutations.ts"
import { createDecisionPreparedReview } from "../decisions/prepared-review.ts"
import { createSfPreparedApply } from "../decisions/prepared-apply.ts"
import { createPreparedExecution } from "../decisions/apply.ts"
import { createProcurementC12Bridge } from "./c12.ts"
import { projectProcurementSource } from "./port.ts"

type ApplyRequest = Parameters<PreparedApplyPort["executePrepared"]>[0]
type MutationHost = Parameters<typeof createDecisionMutations>[0]
type BridgeInput = Parameters<typeof createProcurementC12Bridge>[0]
type ActiveApply = { context: TrustedDomainContext; bindingDigest: string; request: ApplyRequest; decision: DecisionCase; change: PreparedChange; actor: Actor; roleMapDigest: string; physicalIncarnation: string; environment: Environment }
type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
type ArchivedSource = { schema: "sf-procurement-evidence-v1"; evidence: RecordEvidence; projection: DomainProjection; scope: SfSourceScope; physicalIncarnation: string; projectionDigest: string; proofDigest: string }

/** Compose WP11's real preparation, review, application and receipt paths for Procurement. */
export function createProcurementDecisionHost(input: BridgeInput & {
  authority: ReturnType<typeof createSfProductAuthority>
  procurementEvidenceWrites: WeakSet<object>
  cases: DecisionCasePort
  planner: PlannerPort
  plannerSources: PlannerSourceHost
  operationIdentity: MutationHost["operationIdentity"]
  readSourceFences: Parameters<typeof createDecisionIntentFences>[0]["readSourceFences"]
  lockedSourceFences: Parameters<typeof createDecisionIntentFences>[0]["lockedSourceFences"]
  createId: () => string
  now: () => string
}) {
  const bridge = createProcurementC12Bridge(input)
  const host = input.host
  const state = input.authority.state
  const authorizeCase = async (value: DecisionCase, context: TrustedDomainContext) => value.participants.includes(context.binding.principalRef) && await host.revalidate(context)
  const intent = createDecisionIntentFences({ human: input.authority.human, ui: input.authority.ui, readSourceFences: input.readSourceFences, lockedSourceFences: input.lockedSourceFences })
  const archiveKey = (ref: RecordEvidence) => `sf:procurement-evidence:${ref.refDigest}`
  const captureSource = async (ref: RecordEvidence, context: TrustedDomainContext) => {
    const request = host.requestFor(context)
    const identity = input.operationIdentity(context)
    const source = await input.individual.resolveForPreparation(ref.refId, context)
    if (!request || !identity || source.status !== "ok" || digestSfValue(source.value.evidence) !== digestSfValue(ref) || !await host.revalidate(context)) return false
    const existing = await state.read(request, "preferences", (_stored, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion)
    if (existing.status !== "ok" || !existing.value) return false
    const environment = await host.environment(request)
    if (!Number.isFinite(Date.parse(environment.at))) return false
    const write = async (stored: SfProductState, authority: SfStateAuthority, snapshot: Snapshot) => {
      if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || !input.individual.isCurrent(snapshot, ref)) return { commit: false, value: false }
      const principal = await host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
      if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: false }
      const roles = principal.roles.filter((entry) => entry.surface === "procurement").map((entry) => entry.role)
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: [], domains: [] }
      const selector = object(source.value.scope.selector)
      if (selector.roleMapDigest !== digestSfValue(roleMap(snapshot, "procurement")) || digestSfValue(selector.roles) !== digestSfValue(roles) || selector.canWrite !== actor.canWrite) return { commit: false, value: false }
      const view = domain.view(snapshot, actor, environment)
      const record = rows(view.data.requests).find((value) => value.number === ref.target.recordId)
      const physical = snapshot.sfSources?.records[JSON.stringify([ref.target.recordType, ref.target.recordId])]
      const scope = Object.values(snapshot.sfSources?.scopes ?? {}).find((value) => value.alive && value.incarnation === ref.target.incarnation && value.version === ref.target.version && digestSfValue(value.scope) === digestSfValue(source.value.scope))
      if (!record || !physical?.alive || scope?.sourceIncarnation !== physical.incarnation) return { commit: false, value: false }
      const projection = projectProcurementSource(record, source.value.context, ref, environment.at, view.data.formSettings)
      if (!decodeSfOperationOutput("sf_request_read", projection).ok) return { commit: false, value: false }
      const material = { schema: "sf-procurement-evidence-v1" as const, evidence: ref, projection, scope: source.value.scope, physicalIncarnation: physical.incarnation, projectionDigest: digestSfValue(projection) }
      const previous = readArchive(stored.preferences[archiveKey(ref)])
      if (stored.preferences[archiveKey(ref)] !== undefined) return { commit: false, value: !!previous && digestSfValue(previous.evidence) === digestSfValue(ref) && previous.physicalIncarnation === physical.incarnation && digestSfValue(previous.scope) === digestSfValue(source.value.scope) && digestSfValue(stableProjection(previous.projection)) === digestSfValue(stableProjection(projection)) }
      stored.preferences[archiveKey(ref)] = structuredClone({ ...material, proofDigest: digestSfValue(material) })
      return { commit: true, value: true }
    }
    input.procurementEvidenceWrites.add(write)
    try {
      const saved = await state.transaction(request, { namespace: "preferences", domainSurface: "procurement", expectedStorageVersion: existing.storageVersion, targetRef: input.authority.creationTarget.ref, targetIncarnation: input.authority.creationTarget.incarnation, idempotencyKey: `${identity}:evidence:${ref.refDigest}`, commandDigest: digestSfValue({ action: "capture-procurement-evidence", ref, scope: source.value.scope }) }, write)
      return (saved.status === "ok" || saved.status === "preview") && saved.value && await host.revalidate(context)
    } finally { input.procurementEvidenceWrites.delete(write) }
  }
  const readChange = async (request: ApplyRequest, context: TrustedDomainContext): Promise<PortResult<{ decision: DecisionCase; change: PreparedChange }>> => {
    const source = host.requestFor(context)
    if (!source || !await host.revalidate(context)) return { status: "denied", reason: "prepared-authority-unavailable" }
    const loaded = await state.read(source, "cases", (stored, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? stored.cases[request.caseRef.id] : undefined)
    if (loaded.status !== "ok" || !loaded.value || loaded.value.incarnation !== request.caseRef.incarnation || !await authorizeCase(loaded.value, context)) return { status: "unavailable", reason: "prepared-case-unavailable" }
    const decision = loaded.value
    const change = decision.preparedChanges.find((value) => value.id === request.changeId && value.choiceId === request.choiceId)
    if (!change || !decision.choices.some((value) => value.id === request.choiceId) || decision.version < request.caseRef.version || decision.version !== request.caseRef.version && !change.receipt || change.target.surface !== "procurement") return { status: "stale", reason: "prepared-case-changed" }
    return { status: "ok", value: { decision, change } }
  }
  const prepareDomainCommands: MutationHost["prepareDomainCommands"] = async (caseRef, choiceId, operations, context) => {
    const request = { caseRef: structuredClone(caseRef), choiceId, operations: structuredClone(operations) }
    const source = host.requestFor(context)
    const operation = input.operationIdentity(context)
    if (!source || !operation || context.kind !== "ui" || !await input.authority.human.authorize(context, "decisions.prepare-changes", request) || !await host.revalidate(context)) return { status: "denied", reason: "human-preparation-required" }
    const loaded = await state.read(source, "cases", (stored, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? stored.cases[caseRef.id] : undefined)
    if (loaded.status !== "ok" || !loaded.value || loaded.value.incarnation !== caseRef.incarnation || loaded.value.version !== caseRef.version || !await authorizeCase(loaded.value, context)) return { status: "stale", reason: "preparation-case-changed" }
    const choice = loaded.value.choices.find((value) => value.id === choiceId)
    if (!choice || !request.operations.length || request.operations.length > 100 || new Set(request.operations.map((value) => value.targetRef)).size !== request.operations.length) return { status: "needs-input", reason: "distinct-choice-operations-required" }
    const prepared = await Promise.all(request.operations.map((value, index) => bridge.prepareScenario({ operation: value, choice, operationId: `${operation}:${index}`, idempotencyKey: `${operation}:${index}` }, context)))
    const failed = prepared.find((value) => value.status !== "ok")
    if (failed) return failed
    // Persist the authorized original while the source and preferences share the same lock.
    // The later case mutation's captured source fences still have to match this preparation.
    for (const item of prepared) if (item.status === "ok" && !await captureSource(item.value.targetEvidence, context)) return { status: "unavailable", reason: "preparation-original-evidence-unavailable" }
    const again = await state.read(source, "cases", (stored, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? stored.cases[caseRef.id] : undefined)
    if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(loaded.value) || !await input.authority.human.authorize(context, "decisions.prepare-changes", request) || !await host.revalidate(context)) return { status: "stale", reason: "preparation-case-changed" }
    return { status: "ok", value: prepared.flatMap((value) => value.status === "ok" ? [value.value] : []) }
  }
  const mutations = createDecisionMutations({ state, host, planner: input.planner, sources: input.plannerSources, authorizeCase,
    authorizeMutation: (operation, payload, context) => operation === "prepare-changes" ? intent.authorize(context, "decisions.prepare-changes", payload) : Promise.resolve(false),
    verifyMutation: (_snapshot, operation, payload, context) => operation === "prepare-changes" && intent.verify(context, "decisions.prepare-changes", payload),
    operationIdentity: input.operationIdentity, prepareDomainCommands, createId: input.createId, now: input.now,
    confirmChoice: async () => false, confirmAnswer: async () => false,
    resolveQuestion: async () => ({ status: "unavailable", reason: "procurement-preparation-only" }),
    resolveAnswer: async () => ({ status: "unavailable", reason: "procurement-preparation-only" }),
    resolveChoiceValues: async () => ({ status: "unavailable", reason: "procurement-preparation-only" }),
  })
  const readReview = createDecisionPreparedReview({ state, host, cases: input.cases, reviewDomain: bridge.reviewDomain })
  const reviews = new Map<string, { changeDigest: string; expiresAt: number }>()
  const reviewKey = (request: ApplyRequest, context: TrustedDomainContext) => digestSfValue({ request, installation: context.binding.installationId, project: context.binding.projectId, principal: context.binding.principalRef, access: context.binding.accessRevision, policy: context.binding.policyVersion })
  const reviewChange = async (incoming: ApplyRequest, context: TrustedDomainContext) => {
    const request = structuredClone(incoming)
    if (context.kind !== "ui") return { status: "denied", reason: "human-review-required" } as const
    const before = await readChange(request, context)
    if (before.status !== "ok") return before
    const review = await readReview(request, context)
    if (review.status !== "ok") return review
    const after = await readChange(request, context)
    if (after.status !== "ok" || digestSfValue(after.value) !== digestSfValue(before.value) || !await host.revalidate(context)) return { status: "stale", reason: "prepared-review-changed" } as const
    const expiresAt = Date.parse(input.now()) + 300_000
    if (!Number.isFinite(expiresAt)) return { status: "unavailable", reason: "prepared-review-clock-unavailable" } as const
    reviews.set(reviewKey(request, context), { changeDigest: digestSfValue(before.value.change), expiresAt })
    if (reviews.size > 512) reviews.delete(reviews.keys().next().value!)
    return review
  }
  const active = new WeakMap<Request, ActiveApply>()
  const current = (context: TrustedDomainContext) => {
    const source = host.requestFor(context)
    const held = source ? active.get(source) : undefined
    return held?.context === context && held.bindingDigest === digestSfValue(context.binding) && source && !source.signal.aborted ? held : undefined
  }
  const validTarget = (snapshot: Snapshot, held: ActiveApply) => {
    const target = held.change.target
    const scopes = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.alive && entry.incarnation === target.incarnation && entry.scope.recordType === target.type && entry.scope.recordId === target.id && entry.scope.principalRef === held.context.binding.principalRef && entry.scope.accessRevision === held.context.binding.accessRevision && entry.scope.policyVersion === held.context.binding.policyVersion)
    const physical = snapshot.sfSources?.records[JSON.stringify([target.type, target.id])]
    return scopes.length === 1 && scopes[0]!.sourceIncarnation === held.physicalIncarnation && physical?.alive === true && physical.incarnation === held.physicalIncarnation && held.roleMapDigest === digestSfValue(roleMap(snapshot, "procurement")) && held.actor.id === held.context.binding.principalRef && held.actor.canWrite && digestSfValue(object(scopes[0]!.scope.selector).roles) === digestSfValue(held.actor.roles) && object(scopes[0]!.scope.selector).canWrite === held.actor.canWrite
  }
  const authorizeLookup: Parameters<typeof createSfPreparedApply>[0]["authorizeLookup"] = async (lookup, context) => {
    const held = current(context)
    return !!held && lookup.surface === "procurement" && lookup.targetRef === held.change.target.id && lookup.targetIncarnation === held.change.target.incarnation && lookup.idempotencyKey === held.change.idempotencyKey && lookup.commandDigest === held.change.operation.commandDigest && await host.revalidate(context)
  }
  const authorizeReceipt: Parameters<typeof createSfPreparedApply>[0]["authorizeReceipt"] = async (receipt, lookup, context) => receipt.principalRef === context.binding.principalRef && receipt.surface === lookup.surface && receipt.targetIncarnation === lookup.targetIncarnation && receipt.idempotencyKey === lookup.idempotencyKey && receipt.commandDigest === lookup.commandDigest && await authorizeLookup(lookup, context)
  const confirmHuman: Parameters<typeof createSfPreparedApply>[0]["confirmHuman"] = async (request, change, context) => {
    const held = current(context)
    return !!held && digestSfValue(request) === digestSfValue(held.request) && digestSfValue(change.operation) === digestSfValue(held.change.operation) && await input.authority.human.authorize(context, "decisions.apply", request)
  }
  const prepared = createSfPreparedApply({ state, host, authorizeCase, authorizeLookup, authorizeReceipt, confirmHuman,
    resolveActor: (snapshot, context) => { const held = current(context); return held && validTarget(snapshot, held) ? structuredClone(held.actor) : undefined },
    resolveMutation: bridge.resolveMutation,
    verifyGrant: (snapshot, request, change, actor, context) => {
      const held = current(context)
      return !!held && context.kind === "ui" && digestSfValue(actor) === digestSfValue(held.actor) && digestSfValue(request) === digestSfValue(held.request) && digestSfValue(change.operation) === digestSfValue(held.change.operation) && validTarget(snapshot, held) && input.authority.ui.matchesIntent(context, "sf-human:decisions.apply", digestSfValue(request))
    },
    receiptVersion: bridge.receiptVersion,
    environment: (context) => { const held = current(context); if (!held) throw new Error("Prepared execution unavailable"); return held.environment },
    createId: input.createId, now: input.now,
  })
  const classifyReceipt = async (receipt: CommandReceipt, change: PreparedChange, context: TrustedDomainContext) => {
    const lookup = { surface: change.target.surface, targetRef: change.target.id, targetIncarnation: change.target.incarnation, idempotencyKey: change.idempotencyKey, commandDigest: change.operation.commandDigest }
    if (!await authorizeReceipt(receipt, lookup, context)) return undefined
    const persisted = await prepared.readReceipt(lookup, context)
    if (persisted.status !== "ok" || persisted.value.state !== "found" || digestSfValue(persisted.value.receipt) !== digestSfValue(receipt)) return undefined
    const evidence: Extract<BusinessEvidenceRef, { kind: "receipt" }> = { schema: "sf-evidence-v1", kind: "receipt", refId: `sf-procurement-receipt:${encodeURIComponent(receipt.id)}`, installationId: context.binding.installationId, projectId: context.binding.projectId, evidenceLevel: "observed", refDigest: "", target: { surface: "procurement", receiptId: receipt.id, targetIncarnation: receipt.targetIncarnation, idempotencyKey: receipt.idempotencyKey, commandDigest: receipt.commandDigest, version: receipt.version } }
    return { state: receipt.result.ok ? "applied" as const : receipt.result.status === 409 ? "conflict" as const : "failed" as const, evidence: { ...evidence, refDigest: digestSfEvidenceRef(evidence) } }
  }
  const execute = createPreparedExecution({ state, host, apply: prepared, authorizeCase, operationIdentity: input.operationIdentity,
    authorizeApplication: (request, change, context) => confirmHuman(request, change, context),
    confirmApplication: async (request, context) => !!current(context) && await input.authority.human.authorize(context, "decisions.apply", request),
    classifyReceipt,
  })
  const apply = async (incoming: ApplyRequest, context: TrustedDomainContext): Promise<PortResult<CommandReceipt>> => {
    const request = structuredClone(incoming)
    const source = host.requestFor(context)
    if (!source || context.kind !== "ui" || active.has(source) || !await input.authority.human.authorize(context, "decisions.apply", request) || !await host.revalidate(context)) return { status: "denied", reason: "human-application-required" }
    const loaded = await readChange(request, context)
    if (loaded.status !== "ok") return loaded
    const reviewed = reviews.get(reviewKey(request, context))
    const checkedAt = Date.parse(input.now())
    if (!Number.isFinite(checkedAt) || !loaded.value.change.receipt && (!reviewed || reviewed.expiresAt <= checkedAt || reviewed.changeDigest !== digestSfValue(loaded.value.change))) return { status: "denied", reason: "prepared-review-required" }
    const environment = await host.environment(source)
    if (!Number.isFinite(Date.parse(environment.at))) return { status: "unavailable", reason: "application-clock-unavailable" }
    const held = await host.persistence.transaction<ActiveApply | undefined>("procurement", async (snapshot) => {
      const principal = await host.authenticate(source, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
      if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: undefined }
      const roles = principal.roles.filter((entry) => entry.surface === "procurement").map((entry) => entry.role)
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: [], domains: [] }
      const physical = snapshot.sfSources?.records[JSON.stringify([loaded.value.change.target.type, loaded.value.change.target.id])]
      if (!physical?.alive) return { commit: false, value: undefined }
      const value: ActiveApply = { context, bindingDigest: digestSfValue(context.binding), request, ...loaded.value, actor, roleMapDigest: digestSfValue(roleMap(snapshot, "procurement")), physicalIncarnation: physical.incarnation, environment }
      return { commit: false, value: validTarget(snapshot, value) ? value : undefined }
    }, { signal: source.signal })
    if (!held || !await host.revalidate(context)) return { status: "denied", reason: "application-source-authority-unavailable" }
    active.set(source, held)
    try { return await execute(request, context) } finally { active.delete(source) }
  }
  const authorizeReceiptTarget = async (request: Request, snapshot: Snapshot, targetRef: string, authority: SfStateAuthority) => {
    const held = active.get(request)
    const domain = host.persistence.currentSnapshots?.()?.procurement
    if (!held || current(held.context) !== held || !domain || targetRef !== held.change.target.id || authority.principalRef !== held.context.binding.principalRef || authority.accessRevision !== held.context.binding.accessRevision || authority.policyVersion !== held.context.binding.policyVersion || !validTarget(domain, held) || !await input.authority.human.authorize(held.context, "decisions.apply", held.request)) return undefined
    const decision = object(object(object(snapshot.data.__sfProductV1).cases)[held.decision.id])
    const change = rows(decision.preparedChanges).filter((value) => value.id === held.change.id && value.choiceId === held.change.choiceId)
    if (decision.id !== held.decision.id || decision.incarnation !== held.decision.incarnation || decision.version !== held.decision.version || !Array.isArray(decision.participants) || !decision.participants.includes(authority.principalRef) || change.length !== 1 || digestSfValue(change[0]) !== digestSfValue(held.change)) return undefined
    return { incarnation: held.change.target.incarnation }
  }
  const readOriginal = async (ref: RecordEvidence, context: TrustedDomainContext) => {
    const request = host.requestFor(context)
    if (!request || !await host.revalidate(context)) return undefined
    const value = await state.read(request, "preferences", (stored, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? stored.preferences[archiveKey(ref)] : undefined)
    const archived = value.status === "ok" ? readArchive(value.value) : undefined
    return archived && digestSfValue(archived.evidence) === digestSfValue(ref) ? archived : undefined
  }
  const physicalContinuity = async (archived: ArchivedSource, currentRef: RecordEvidence, context: TrustedDomainContext) => {
    const request = host.requestFor(context)
    const selected = await input.individual.resolveForPreparation(currentRef.refId, context)
    if (!request || selected.status !== "ok" || digestSfValue(selected.value.evidence) !== digestSfValue(currentRef) || !await host.revalidate(context)) return false
    const current = await host.persistence.transaction("procurement", async (snapshot) => {
      const principal = await host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
      if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: false }
      const roles = principal.roles.filter((entry) => entry.surface === "procurement").map((entry) => entry.role)
      const selector = object(selected.value.scope.selector)
      if (selector.roleMapDigest !== digestSfValue(roleMap(snapshot, "procurement")) || digestSfValue(selector.roles) !== digestSfValue(roles) || selector.canWrite !== (principal.canWrite && roles.some((role) => role !== "viewer")) || !input.individual.isCurrent(snapshot, currentRef)) return { commit: false, value: false }
      const original = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.incarnation === archived.evidence.target.incarnation && digestSfValue(entry.scope) === digestSfValue(archived.scope))
      const present = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.alive && entry.incarnation === currentRef.target.incarnation && entry.version === currentRef.target.version && digestSfValue(entry.scope) === digestSfValue(selected.value.scope))
      const physical = snapshot.sfSources?.records[JSON.stringify([archived.evidence.target.recordType, archived.evidence.target.recordId])]
      return { commit: false, value: original.length === 1 && present.length === 1 && original[0]!.sourceIncarnation === archived.physicalIncarnation && present[0]!.sourceIncarnation === archived.physicalIncarnation && physical?.alive === true && physical.incarnation === archived.physicalIncarnation }
    }, { signal: request.signal })
    return current && await host.revalidate(context)
  }
  const resolveHistoricalSource = async (ref: RecordEvidence, context: TrustedDomainContext): Promise<BusinessEvidenceResolution | undefined> => {
    const unavailable = (): BusinessEvidenceResolution => ({ state: "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: input.now() })
    if (ref.target.recordType !== "procurement-request" || !ref.refId.startsWith("sf-procurement:")) return undefined
    const archived = await readOriginal(ref, context)
    if (!archived) return undefined
    const issued = await input.individual.issueForActor(ref.target, context)
    if (issued.status !== "ok") return unavailable()
    if (digestSfValue(issued.value) === digestSfValue(ref)) return undefined
    if (!await physicalContinuity(archived, issued.value, context)) return unavailable()
    const currentProjection = await input.port.read({ requestRef: issued.value.refId }, context)
    if (currentProjection.status !== "ok") return unavailable()
    const differences: NonNullable<BusinessEvidenceResolution["differences"]>[number][] = []
    for (const previous of archived.projection.values.filter((value) => value.id !== "ageDays")) {
      const currentValue = currentProjection.value.values.find((value) => value.id === previous.id)
      if (!currentValue) return unavailable()
      if (previous.value !== currentValue.value) differences.push({ field: previous.id, before: previous.value, after: currentValue.value })
      if (previous.currency !== currentValue.currency) differences.push({ field: `${previous.id}.currency`, before: previous.currency ?? null, after: currentValue.currency ?? null })
    }
    if (archived.projection.context.currency !== currentProjection.value.context.currency) differences.push({ field: "currency", before: archived.projection.context.currency, after: currentProjection.value.context.currency })
    const again = await readOriginal(ref, context)
    const issuedAgain = await input.individual.issueForActor(ref.target, context)
    if (!again || digestSfValue(again) !== digestSfValue(archived) || issuedAgain.status !== "ok" || digestSfValue(issuedAgain.value) !== digestSfValue(issued.value) || !await physicalContinuity(archived, issued.value, context) || !await host.revalidate(context)) return unavailable()
    const projection: DomainProjection = { ...structuredClone(archived.projection), context: { ...structuredClone(archived.projection.context), principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion } }
    return { state: "historical", ref, currentRef: issued.value, authorizedProjection: projection, differences, accessRevision: context.binding.accessRevision, checkedAt: input.now() }
  }
  const resolveReceipt = async (ref: Extract<BusinessEvidenceRef, { kind: "receipt" }>, context: TrustedDomainContext): Promise<BusinessEvidenceResolution> => {
    const unavailable = (): BusinessEvidenceResolution => ({ state: "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: input.now() })
    const request = host.requestFor(context)
    if (!request || !ref.refId.startsWith("sf-procurement-receipt:") || !await host.revalidate(context)) return unavailable()
    const read = async () => {
      const cases = await state.read(request, "cases", (stored, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? Object.values(stored.cases).filter((value) => value.participants.includes(context.binding.principalRef) && (context.kind === "ui" || value.id === context.binding.caseId && value.incarnation === context.binding.caseIncarnation && value.version === context.binding.caseVersion)).flatMap((decision) => decision.sourceRefs.some((source) => digestSfValue(source) === digestSfValue(ref)) ? decision.preparedChanges.filter((change) => change.receipt?.id === ref.target.receiptId).map((change) => ({ decision, change })) : []) : [])
      if (cases.status !== "ok" || cases.value.length !== 1) return undefined
      const receipts = await state.read(request, "receipts", (stored, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? stored.receipts[ref.target.receiptId] : undefined)
      if (receipts.status !== "ok" || !receipts.value) return undefined
      const candidate = cases.value[0]!
      const receipt = receipts.value
      const change = candidate.change
      if (digestSfValue(change.receipt) !== digestSfValue(receipt) || receipt.surface !== "procurement" || ref.target.surface !== receipt.surface || receipt.targetIncarnation !== ref.target.targetIncarnation || receipt.commandDigest !== ref.target.commandDigest || receipt.idempotencyKey !== ref.target.idempotencyKey || receipt.version !== ref.target.version || change.target.surface !== "procurement" || change.target.incarnation !== receipt.targetIncarnation || change.operation.commandDigest !== receipt.commandDigest || change.idempotencyKey !== receipt.idempotencyKey || change.state === "planned" || receipt.result.ok !== ["applied", "awaiting-approval"].includes(change.state)) return undefined
      const source = change.operation.preview.values.flatMap((value) => value.sourceRefs)[0]
      if (!source || source.kind !== "record") return undefined
      const currentSource = await input.individual.issueForActor(source.target, context)
      if (currentSource.status !== "ok" || !await host.revalidate(context)) return undefined
      const selected = await input.individual.resolve(currentSource.value.refId, context)
      return selected.status === "ok" ? { ...candidate, receipt, currentSource: currentSource.value, context: selected.value.context } : undefined
    }
    const value = await read()
    if (!value) return unavailable()
    const projection: DomainProjection = { context: value.context, version: value.receipt.version, engineVersion: "procurement-receipt-v1", components: [], missing: [], values: [
      { id: "applicationStatus", value: value.change.state, period: value.context.period, granularity: "record", sourceRefs: [ref], drilldown: ref, evidenceState: "confirmed" },
      { id: "applicationVersion", value: value.receipt.version, period: value.context.period, granularity: "record", sourceRefs: [ref], drilldown: ref, evidenceState: "confirmed" },
    ] }
    const again = await read()
    if (!again || digestSfValue(again) !== digestSfValue(value) || request.signal.aborted || !await host.revalidate(context)) return unavailable()
    return { state: "fresh", ref, currentRef: ref, authorizedProjection: projection, accessRevision: context.binding.accessRevision, checkedAt: input.now() }
  }
  const resolveEvidence = async (ref: BusinessEvidenceRef, context: TrustedDomainContext): Promise<BusinessEvidenceResolution | undefined> => {
    if ((ref.kind !== "record" && ref.kind !== "receipt") || ref.target.surface !== "procurement") return undefined
    try {
      if (ref.schema !== "sf-evidence-v1" || ref.refDigest !== digestSfEvidenceRef(ref) || ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId || !await host.revalidate(context)) return { state: "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: input.now() }
      return ref.kind === "record" ? await resolveHistoricalSource(ref, context) : await resolveReceipt(ref, context)
    } catch { return { state: "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: input.now() } }
  }
  const proveContinuity = async (original: BusinessEvidenceRef, currentRef: BusinessEvidenceRef, context: TrustedDomainContext) => {
    if (original.kind !== "record" || currentRef.kind !== "record" || original.target.surface !== "procurement" || original.target.recordType !== "procurement-request" || !original.refId.startsWith("sf-procurement:")) return undefined
    const result = await resolveEvidence(original, context)
    return result ? result.state === "historical" && !!result.authorizedProjection && !!result.currentRef && digestSfValue(result.currentRef) === digestSfValue(currentRef) && Array.isArray(result.differences) && await host.revalidate(context) : undefined
  }
  return { prepareChanges: mutations.prepareChanges, prepareDomainCommands, reviewChange, apply, authorizeReceiptTarget, resolveEvidence, proveContinuity, dispose: () => reviews.clear() }
}

function stableProjection(value: DomainProjection) {
  return { ...value, values: value.values.filter((field) => field.id !== "ageDays") }
}

function readArchive(value: unknown): ArchivedSource | undefined {
  const stored = object(value)
  if (stored.schema !== "sf-procurement-evidence-v1" || typeof stored.physicalIncarnation !== "string" || !stored.physicalIncarnation || typeof stored.proofDigest !== "string") return undefined
  const projection = decodeSfOperationOutput("sf_request_read", stored.projection)
  if (!projection.ok || stored.projectionDigest !== digestSfValue(projection.value)) return undefined
  const evidence = projection.value.values[0]?.sourceRefs[0]
  if (!evidence || evidence.kind !== "record" || evidence.target.surface !== "procurement" || evidence.target.recordType !== "procurement-request" || evidence.refDigest !== digestSfEvidenceRef(evidence) || digestSfValue(stored.evidence) !== digestSfValue(evidence) || projection.value.values.some((field) => field.sourceRefs.length !== 1 || digestSfValue(field.sourceRefs[0]) !== digestSfValue(evidence))) return undefined
  const scope = object(stored.scope)
  if (typeof scope.principalRef !== "string" || typeof scope.accessRevision !== "string" || typeof scope.policyVersion !== "string" || typeof scope.recordType !== "string" || typeof scope.recordId !== "string" || scope.recordType !== evidence.target.recordType || scope.recordId !== evidence.target.recordId || projection.value.context.principalRef !== scope.principalRef || projection.value.context.accessRevision !== scope.accessRevision || projection.value.context.policyVersion !== scope.policyVersion) return undefined
  const material = { schema: "sf-procurement-evidence-v1" as const, evidence, projection: projection.value, scope: { principalRef: scope.principalRef, accessRevision: scope.accessRevision, policyVersion: scope.policyVersion, recordType: scope.recordType, recordId: scope.recordId, selector: scope.selector }, physicalIncarnation: stored.physicalIncarnation, projectionDigest: digestSfValue(projection.value) }
  return stored.proofDigest === digestSfValue(material) ? { ...material, proofDigest: stored.proofDigest } : undefined
}
