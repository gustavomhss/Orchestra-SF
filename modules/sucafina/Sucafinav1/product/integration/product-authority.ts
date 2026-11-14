import type { SessionSchema } from "@orchestra/core/session/schema"
import type { Application } from "../../runtime/application.ts"
import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import type { Surface } from "../../src/identity.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { SfHostRuntime } from "../contracts/host-context.ts"
import type { DomainPortHost } from "../contracts/ports.ts"
import type { SfNativeAdmission, SfSelectedRuntime } from "../contracts/runtime.ts"
import type { TrustedExecutionBinding } from "../contracts/sf-execution.ts"
import type { SfStateAuthority, SfStateNamespace } from "../contracts/state.ts"
import { parseCaseRef } from "../decisions/case-port.ts"
import { createSfExecutionBindingRegistry } from "../host-binding/execution-context.ts"
import { createSfProductState } from "../host-binding/state-provider.ts"
import { createSfDomainAuthority, createSfUiAuthority } from "./ui-authority.ts"
import { createSfHumanAuthority, sfHumanActions } from "./human-authority.ts"
import type { SfHumanAction } from "./human-authority.ts"

export type SfProductGrant = Readonly<{ principalRef: string; namespaces: readonly SfStateNamespace[]; operations: readonly string[]; humanActions?: readonly SfHumanAction[] }>

const collaborationReads: Record<string, { operation: string; namespaces: readonly SfStateNamespace[] }> = {
  "collaboration.question.output": { operation: "sf_question_prepare", namespaces: ["cases", "contributions"] },
  "collaboration.thread.read": { operation: "sf_answer_read", namespaces: ["threads"] },
  "collaboration.thread.history": { operation: "sf_answer_read", namespaces: ["threads"] },
  "collaboration.relation.read": { operation: "sf_relation_read", namespaces: ["relations"] },
  "collaboration.confirmation.prepare": { operation: "sf_work_list", namespaces: ["confirmations"] },
  "collaboration.confirmation.project": { operation: "sf_work_list", namespaces: ["confirmations"] },
  "collaboration.answer.prepare": { operation: "sf_answer_read", namespaces: ["threads", "confirmations"] },
  "collaboration.answer.read": { operation: "sf_answer_read", namespaces: ["threads"] },
  "collaboration.selection.list": { operation: "sf_work_list", namespaces: ["cases", "preferences"] },
  "collaboration.selection.version": { operation: "sf_work_list", namespaces: ["preferences"] },
  "collaboration.cycle.read": { operation: "sf_work_list", namespaces: ["cases", "threads", "relations", "confirmations"] },
  "collaboration.work.list": { operation: "sf_work_list", namespaces: ["threads", "relations", "confirmations"] },
  "collaboration.work.destination": { operation: "sf_work_list", namespaces: ["threads", "relations", "confirmations"] },
  "collaboration.recipients": { operation: "sf_question_prepare", namespaces: ["threads"] },
  "collaboration.storage.version": { operation: "sf_work_list", namespaces: ["threads", "relations", "confirmations"] },
}

/** Compose authority over the installation's own store and authenticator; no serialized identity becomes authority. */
export function createSfProductAuthority(input: {
  identity: SfHostRuntime["identity"]
  installationId: string
  origin: string
  policyVersion: string
  persistence: Application["persistence"]
  authenticate: Application["authenticate"]
  environment: Application["environment"]
  grants: readonly SfProductGrant[]
  createId: () => string
  now: () => number
  commandIdentity: (request: Request, operation: string, inputDigest: string) => Promise<string | undefined>
  inspectSession: (sessionID: SessionSchema.ID) => Promise<SessionSchema.Info | undefined>
  verifySelection: (selected: SfSelectedRuntime) => Promise<boolean>
  verifySkillReceipt: (admission: SfNativeAdmission) => Promise<boolean>
  providerGeneration: () => Promise<number | undefined>
  /** Composition-owned capability; never returned in browser or model services. */
  proposalCoverageWrites?: WeakSet<object>
  signalRegistryWrites?: WeakSet<object>
  caseSelectionWrites?: WeakSet<object>
  analysisSelectionWrites?: WeakSet<object>
  threadHistoryWrites?: WeakSet<object>
  dashboardHostWrites?: WeakSet<object>
  procurementEvidenceWrites?: WeakSet<object>
  authorizePreparedTarget?: (request: Request, snapshot: Snapshot, targetRef: string, authority: SfStateAuthority) => Promise<{ incarnation: string } | undefined>
  authorizeDocument: (request: Request, snapshot: Snapshot, assetId: string, principal: string, authority: SfStateAuthority) => Promise<{ incarnation: string } | undefined>
}) {
  const grants = structuredClone(input.grants)
  if (!input.installationId.trim() || !input.policyVersion.trim() || !URL.canParse(input.origin) || new URL(input.origin).origin !== input.origin ||
    new Set(grants.map((grant) => grant.principalRef)).size !== grants.length || grants.some((grant) => !grant.principalRef.trim() ||
      new Set(grant.namespaces).size !== grant.namespaces.length || new Set(grant.operations).size !== grant.operations.length ||
      new Set(grant.humanActions).size !== (grant.humanActions?.length ?? 0) || grant.humanActions?.some((action) => !sfHumanActions.some((value) => value === action))))
    throw new Error("SF_PRODUCT_AUTHORITY_CONFIG_INVALID")
  const creationTarget = Object.freeze({ ref: `sf-workspace:${encodeURIComponent(input.installationId)}`, incarnation: input.installationId })
  const nativeEvidenceWrites = new WeakSet<object>()
  const surfaces: readonly Surface[] = ["dashboard", "planner", "procurement"]
  const creationNamespaces: readonly SfStateNamespace[] = ["cases", "reviews", "relations", "threads", "confirmations", "documents", "preferences"]
  const identity = () => {
    const current = input.identity()
    if (!current || current.installationId !== input.installationId || !current.hostId || !current.projectId) return undefined
    const copy = structuredClone(current)
    Object.freeze(copy.location)
    return Object.freeze(copy)
  }
  const principal = async (request: Request, dashboard: Snapshot) => {
    const snapshots = input.persistence.currentSnapshots?.()
    if (!snapshots) return undefined
    const current = identity()
    if (!current || request.signal.aborted || new URL(request.url).origin !== input.origin ||
      (request.headers.has("origin") && request.headers.get("origin") !== input.origin)) return undefined
    const identityDigest = digestSfValue(current)
    const observe = async (surface: Surface, snapshot: Snapshot) => {
      const actor = await input.authenticate(request, { surface, roleMap: roleMap(snapshot, surface) })
      if (!actor) return undefined
      const access = object(object(snapshot.data.access)[actor.id])
      if ((access.assigned !== undefined && (!Array.isArray(access.assigned) || access.assigned.some((value) => typeof value !== "string"))) ||
        (access.domains !== undefined && (!Array.isArray(access.domains) || access.domains.some((value) => typeof value !== "string"))))
        throw new Error("SF_PRODUCT_ACCESS_SCOPE_INVALID")
      return { actor, surface, assigned: Array.isArray(access.assigned) ? [...access.assigned].toSorted() : [],
        domains: Array.isArray(access.domains) ? [...access.domains].toSorted() : [] }
    }
    const observed = await Promise.all(surfaces.map((surface) => observe(surface, surface === "dashboard" ? dashboard : snapshots[surface])))
    const present = observed.filter((entry) => entry !== undefined)
    const first = present[0]?.actor
    if (!first?.id || first.id.startsWith("local:") || present.some((entry) => entry.actor.id !== first.id) || request.signal.aborted) return undefined
    const grant = grants.find((entry) => entry.principalRef === first.id)
    if (!grant) return undefined
    const roles = present.flatMap((entry) => entry.actor.roles.filter((role) => role.surface === entry.surface))
      .map((role) => ({ surface: role.surface, role: role.role })).toSorted((a, b) => `${a.surface}:${a.role}`.localeCompare(`${b.surface}:${b.role}`))
    if (!roles.length) return undefined
    const canWrite = present.some((entry) => entry.actor.canWrite)
    const scopes = present.map((entry) => ({ surface: entry.surface, assigned: entry.assigned, domains: entry.domains }))
    const accessRevision = digestSfValue({ installationId: current.installationId, projectId: current.projectId,
      principalRef: first.id, roles, scopes, canWrite, namespaces: [...grant.namespaces].toSorted(), operations: [...grant.operations].toSorted(), humanActions: [...grant.humanActions ?? []].toSorted(), policyVersion: input.policyVersion })
    if (digestSfValue(identity()) !== identityDigest) return undefined
    return { principalRef: first.id, policyVersion: input.policyVersion, accessRevision, canWrite, grant, identity: current }
  }
  const resolve = async (request: Request) => {
    if (!input.persistence.currentSnapshots) return undefined
    const snapshots = input.persistence.currentSnapshots()
    if (snapshots) return principal(request, snapshots.dashboard)
    return input.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: await principal(request, snapshot) }), { signal: request.signal })
  }
  const state = createSfProductState({
    persistence: input.persistence, createId: input.createId, nativeEvidenceWrites, proposalCoverageWrites: input.proposalCoverageWrites, signalRegistryWrites: input.signalRegistryWrites, caseSelectionWrites: input.caseSelectionWrites, analysisSelectionWrites: input.analysisSelectionWrites, threadHistoryWrites: input.threadHistoryWrites, dashboardHostWrites: input.dashboardHostWrites, procurementEvidenceWrites: input.procurementEvidenceWrites,
    authorize: async (request, snapshot, namespace, mode) => {
      const actor = await principal(request, snapshot)
      if (!actor || !actor.grant.namespaces.includes(namespace) || (mode === "write" && !actor.canWrite)) return undefined
      return { principalRef: actor.principalRef, policyVersion: actor.policyVersion, accessRevision: actor.accessRevision }
    },
    resolveTarget: async (request, snapshot, namespace, targetRef, command) => {
      const actor = await principal(request, snapshot)
      if (!actor || !actor.grant.namespaces.includes(namespace)) return undefined
      if (actor.canWrite && creationNamespaces.includes(namespace) && targetRef === creationTarget.ref) return { incarnation: creationTarget.incarnation }
      const state = object(snapshot.data.__sfProductV1)
      const cases = object(state.cases)
      const parsed = parseCaseRef(targetRef)
      if (targetRef.startsWith("case:") && !parsed) return undefined
      const id = parsed?.id ?? targetRef
      const entry = Object.hasOwn(cases, id) ? object(cases[id]) : undefined
      if (entry && entry.id === id && typeof entry.incarnation === "string" && (!parsed || parsed.incarnation === entry.incarnation) &&
        Array.isArray(entry.participants) && entry.participants.includes(actor.principalRef)) return { incarnation: entry.incarnation }
      if (namespace === "receipts" && actor.canWrite && command.domainSurface === "dashboard") {
        const preferences = object(state.preferences)
        const targets = Object.values(cases).flatMap((value) => {
          const decision = object(value)
          if (typeof decision.id !== "string" || typeof decision.incarnation !== "string" || typeof decision.version !== "number" || !Array.isArray(decision.participants) || !decision.participants.includes(actor.principalRef) || !Array.isArray(decision.choices) || !Array.isArray(decision.preparedChanges)) return []
          const changes: readonly unknown[] = decision.preparedChanges
          const choices: readonly unknown[] = decision.choices
          const decisionVersion = decision.version
          return changes.flatMap((value) => {
            const change = object(value), target = object(change.target)
            if (typeof change.id !== "string" || target.surface !== "dashboard" || target.id !== targetRef || typeof target.incarnation !== "string" || target.incarnation !== command.targetIncarnation || command.idempotencyKey !== `prepared:${change.idempotencyKey}`) return []
            const binding = object(preferences[`sf:dashboard-host:prepared:${change.id}`])
            const caseRef = object(binding.caseRef)
            const boundChoices = choices.map(object).filter((choice) => choice.id === change.choiceId)
            if (binding.schema !== "sf-dashboard-prepared-binding-v1" || binding.changeId !== change.id || binding.choiceId !== change.choiceId || caseRef.id !== decision.id || caseRef.incarnation !== decision.incarnation || typeof caseRef.version !== "number" || caseRef.version > decisionVersion || (change.state === "planned" && !change.receipt && caseRef.version !== decisionVersion) || binding.principalRef !== actor.principalRef || binding.accessRevision !== actor.accessRevision || binding.policyVersion !== actor.policyVersion || boundChoices.length !== 1 || binding.choiceDigest !== digestSfValue(boundChoices[0]) || digestSfValue(binding.command) !== digestSfValue(change.operation)) return []
            const material = Object.fromEntries(Object.entries(binding).filter(([key]) => key !== "recordDigest"))
            if (binding.recordDigest !== digestSfValue(material)) return []
            return [{ incarnation: target.incarnation }]
          })
        })
        if (targets.length === 1) return targets[0]
      }
      if (namespace === "receipts" && actor.canWrite && command.domainSurface === "procurement" && input.authorizePreparedTarget) {
        const target = await input.authorizePreparedTarget(request, snapshot, targetRef, { principalRef: actor.principalRef, accessRevision: actor.accessRevision, policyVersion: actor.policyVersion })
        return target?.incarnation === command.targetIncarnation ? target : undefined
      }
      if (namespace === "documents") return input.authorizeDocument(request, snapshot, targetRef, actor.principalRef, { principalRef: actor.principalRef, accessRevision: actor.accessRevision, policyVersion: actor.policyVersion })
      return undefined
    },
  })
  const ui = createSfUiAuthority({
    privateCommands: [...sfHumanActions.map((action) => `sf-human:${action}`), ...Object.keys(collaborationReads).map((action) => `sf-read:${action}`)],
    createId: input.createId, now: input.now, commandIdentity: input.commandIdentity,
    authorize: async (request, operation) => {
      const actor = await resolve(request).catch(() => undefined)
      if (operation.startsWith("sf-read:")) {
        const read = collaborationReads[operation.slice("sf-read:".length)]
        if (!actor || !read || !actor.grant.operations.includes(read.operation) || read.namespaces.some((namespace) => !actor.grant.namespaces.includes(namespace))) return undefined
        return { installationId: actor.identity.installationId, projectId: actor.identity.projectId,
          principalRef: actor.principalRef, policyVersion: actor.policyVersion, accessRevision: actor.accessRevision }
      }
      if (!actor || !(operation.startsWith("sf-human:")
        ? (actor.canWrite || operation === "sf-human:views.read" || operation === "sf-human:analysis.read" || operation === "sf-human:decisions.portfolio.read") && actor.grant.humanActions?.some((action) => operation === `sf-human:${action}`)
        : actor.grant.operations.includes(operation))) return undefined
      return { installationId: actor.identity.installationId, projectId: actor.identity.projectId,
        principalRef: actor.principalRef, policyVersion: actor.policyVersion, accessRevision: actor.accessRevision }
    },
  })
  const admission = async (value: SfNativeAdmission, purpose: "execute" | "interrupt" = "execute", request = value.request) => {
    const actor = await resolve(request).catch(() => undefined)
    if (!actor || (purpose === "interrupt" && !actor.grant.humanActions?.includes("analysis.cancel")) || !actor.grant.namespaces.includes("contributions") || !actor.grant.operations.length ||
      value.selected.operationIds.some((operation) => !actor.grant.operations.includes(operation)) || value.skillReceipts.length !== 1 ||
      !await input.verifySelection(value.selected) || !await input.verifySkillReceipt(value)) return undefined
    const record = await state.read(request, "contributions", (stored, authority) => {
      const run = stored.nativeRuns?.[value.runId]
      const currentCase = stored.cases[value.caseRef.id]
      if (!run || !(purpose === "interrupt" ? run.state === "cancelled" && !!run.native : ["preparing", "queued", "running"].includes(run.state)) || run.runRef !== value.runId || run.principalRef !== authority.principalRef || run.accessRevision !== authority.accessRevision ||
        run.policyVersion !== authority.policyVersion || digestSfValue(run.caseRef) !== digestSfValue(value.caseRef) ||
        digestSfValue(run.selection) !== digestSfValue(value.selected) || value.skillReceipts[0]?.skillId !== run.skillId || !currentCase || currentCase.id !== value.caseRef.id ||
        currentCase.incarnation !== value.caseRef.incarnation || (purpose === "interrupt" ? currentCase.version < value.caseRef.version : currentCase.version !== value.caseRef.version) ||
        !currentCase.participants.includes(authority.principalRef) || (run.native && (run.native.sessionID !== value.sessionID ||
          digestSfValue(value.skillReceipts[0]) !== digestSfValue(run.native.skillReceipt)))) return undefined
      return run
    }).catch(() => undefined)
    if (!record || record.status !== "ok" || !record.value) return undefined
    const session = await input.inspectSession(value.sessionID)
    if (!session || session.id !== value.sessionID || session.agent !== value.profile.id || session.projectID !== actor.identity.projectId ||
      digestSfValue(session.location) !== digestSfValue(actor.identity.location) || digestSfValue(session.model) !== digestSfValue(record.value.model) ||
      digestSfValue(identity()) !== digestSfValue(actor.identity) || request.signal.aborted) return undefined
    return actor
  }
  const authorizeBinding = async (value: SfNativeAdmission, binding: TrustedExecutionBinding, purpose: "execute" | "interrupt", request = value.request): Promise<boolean> => {
    const actor = await admission(value, purpose, request).catch(() => undefined)
    return !!actor && binding.nativeSessionId === value.sessionID && binding.runId === value.runId &&
      binding.caseId === value.caseRef.id && binding.caseVersion === value.caseRef.version && binding.caseIncarnation === value.caseRef.incarnation &&
      binding.profileId === value.profile.id && binding.profileVersion === value.profile.version && binding.manifestDigest === value.manifestDigest &&
      digestSfValue(binding.skillReceipts) === digestSfValue(value.skillReceipts) && binding.entryMode === value.entryMode && binding.installationId === actor.identity.installationId && binding.hostId === actor.identity.hostId &&
      binding.projectId === actor.identity.projectId && binding.locationId === digestSfValue(actor.identity.location) &&
      binding.principalRef === actor.principalRef && binding.policyVersion === actor.policyVersion && binding.accessRevision === actor.accessRevision &&
      binding.providerGeneration === await input.providerGeneration()
  }
  const authorizeNative = (value: SfNativeAdmission, binding: TrustedExecutionBinding) => authorizeBinding(value, binding, "execute")
  // Cleanup after durable cancellation never reauthorizes model execution or tool leases.
  const authorizeInterrupt = (value: SfNativeAdmission, binding: TrustedExecutionBinding, request: Request) =>
    request.method === "POST" && request.headers.get("origin") === input.origin && request.headers.get("sec-fetch-site") !== "cross-site"
      ? authorizeBinding(value, binding, "interrupt", request) : Promise.resolve(false)
  const native = createSfExecutionBindingRegistry({
    authenticateAndResolve: async (value) => {
      const actor = await admission(value).catch(() => undefined)
      const now = input.now()
      const generation = await input.providerGeneration()
      if (!actor || !Number.isSafeInteger(now) || now < 0 || now > 8_639_999_999_700_000 ||
        !Number.isSafeInteger(generation) || generation === undefined || generation < 0) return undefined
      return { installationId: actor.identity.installationId, hostId: actor.identity.hostId, projectId: actor.identity.projectId,
        locationId: digestSfValue(actor.identity.location), principalRef: actor.principalRef, policyVersion: actor.policyVersion,
        accessRevision: actor.accessRevision, providerGeneration: generation, expiresAt: new Date(now + 300_000).toISOString() }
    },
    revalidateAdmission: authorizeNative,
  })
  const authority = createSfDomainAuthority({ native, ui })
  const host: DomainPortHost = { persistence: input.persistence, authenticate: input.authenticate, environment: input.environment,
    requestFor: authority.requestFor, revalidate: authority.revalidateDomainContext }
  const human = createSfHumanAuthority({ origin: input.origin, ui })
  const humanActions = async (request: Request): Promise<readonly SfHumanAction[]> => {
    const actor = await resolve(request).catch(() => undefined)
    if (!actor?.canWrite) return []
    const current = await resolve(request).catch(() => undefined)
    if (!current?.canWrite || current.principalRef !== actor.principalRef || current.accessRevision !== actor.accessRevision || request.signal.aborted) return []
    return [...actor.grant.humanActions ?? []]
  }
  return { state, ui, human, humanActions, native, authority, host, creationTarget, nativeEvidenceWrites, authorizeNative, authorizeInterrupt }
}
