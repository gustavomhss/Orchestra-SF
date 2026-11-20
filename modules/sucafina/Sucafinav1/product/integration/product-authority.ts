import { measureTeamAuthority } from "./team-authority-observation.ts"
import { Effect, Schema } from "effect"
import { ConnectionAccess } from "@orchestra/schema/connection-access"
import { CredentialVault } from "@orchestra/core/credential/vault"
import type { TeamConnectionAccess, TeamConnectionStore } from "../../runtime/team-connection-store.ts"
import type { TeamConnectionKey } from "../../runtime/team-connection-crypto.ts"
import { SessionAccess } from "@orchestra/schema/session-access"
import { Session } from "@orchestra/schema/session"
import type { SessionOwner } from "@orchestra/core/session/owner"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { createTeamProfileResolver, TeamProfileResolution } from "../../runtime/team-profile-resolver.ts"
import type { SessionSchema } from "@orchestra/core/session/schema"
import type { Application } from "../../runtime/application.ts"
import type { LocalIdentity } from "../../runtime/local-contract.ts"
import { roleMap } from "../../runtime/admin.ts"
import { dashboardPages, plannerKeys, procurementKeys } from "../../src/nav.ts"
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
import { createSfHumanAuthority, sfHumanActions, sfHumanReadActions } from "./human-authority.ts"
import type { SfHumanAction } from "./human-authority.ts"

export type SfProductGrant = Readonly<{ principalRef: string; namespaces: readonly SfStateNamespace[]; operations: readonly string[]; humanActions?: readonly SfHumanAction[]; sessionActions?: readonly SessionAccess.Action[]; referenceActions?: readonly "list"[]; migrationActions?: readonly ("map" | "cut" | "recover")[]; connectionActions?: readonly ConnectionAccess.Action[]; connectionResources?: readonly ConnectionAccess.Resource[] }>

/** Private verified resolver; the transport supplies only a sealed selection intent. */
export type SfProductTeams = Readonly<Pick<ReturnType<typeof createTeamProfileResolver>, "revalidate" | "revalidateResolution"> & {
  resolve: (request: Request) => Promise<TeamProfileResolution>
  readConfiguration?: (admission: unknown) => Promise<TeamProfile.ConfigurationSnapshot | undefined>
}>

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
  authenticateAll?: LocalIdentity["authenticateAll"]
  environment: Application["environment"]
  isAuthenticated?: (request: Request) => Promise<boolean>
  grants: readonly SfProductGrant[]
  /** Current private installation policy. A failed read never falls back to construction-time grants. */
  readGrants?: () => Promise<readonly SfProductGrant[]>
  teamProfiles?: SfProductTeams
  teamConnections?: Readonly<{ store: TeamConnectionStore; readKey: () => Promise<TeamConnectionKey> }>
  createId: () => string
  now: () => number
  commandIdentity: (request: Request, operation: string, inputDigest: string) => Promise<string | undefined>
  inspectSession: (sessionID: SessionSchema.ID) => Promise<SessionSchema.Info | undefined>
  verifySelection: (selected: SfSelectedRuntime) => Promise<boolean>
  verifySkillReceipt: (admission: SfNativeAdmission) => Promise<boolean>
  providerGeneration: () => Promise<number | undefined>
  /** Composition-owned capability; never returned in browser or model services. */
  proposalCoverageWrites?: WeakSet<object>
  nativePublicationGuards?: WeakMap<object, () => boolean>
  signalRegistryWrites?: WeakSet<object>
  caseSelectionWrites?: WeakSet<object>
  threadHistoryWrites?: WeakSet<object>
  dashboardHostWrites?: WeakSet<object>
  procurementEvidenceWrites?: WeakSet<object>
  analysisSelectionWrites?: WeakSet<object>
  authorizeDocument: (request: Request, snapshot: Snapshot, assetId: string, principal: string, authority: SfStateAuthority) => Promise<{ incarnation: string } | undefined>
  /** Only the composition's active prepared execution may resolve a Procurement receipt target. */
  authorizePreparedTarget?: (request: Request, snapshot: Snapshot, targetRef: string, authority: SfStateAuthority) => Promise<{ incarnation: string } | undefined>
}) {
  const grants = productGrants(input.grants)
  const readGrants = input.readGrants
  const teamConnections = input.teamConnections ? Object.freeze({ ...input.teamConnections }) : undefined
  const teamProfiles = input.teamProfiles ? Object.freeze({ ...input.teamProfiles }) : undefined
  if (!input.installationId.trim() || !input.policyVersion.trim() || !URL.canParse(input.origin) ||
      new URL(input.origin).origin !== input.origin || teamProfiles && !readGrants)
    throw new Error("SF_PRODUCT_AUTHORITY_CONFIG_INVALID")
  const currentGrants = async () => readGrants ? productGrants(await readGrants()) : grants
  // A Request never reacquires a session generation after refresh, relogin or a changed selection.
  const teamResolutions = new WeakMap<Request, Readonly<{ intent: string; value: Promise<TeamProfileResolution> }>>()
  const requestIntent = (request: Request) => digestSfValue({
    url: request.url, method: request.method, selector: request.headers.get("x-sf-team-profile"),
    origin: request.headers.get("origin"), site: request.headers.get("sec-fetch-site"),
  })
  const sameTeamIntent = (request: Request) => !teamProfiles || teamResolutions.get(request)?.intent === requestIntent(request)
  const resolveTeams = (request: Request) => {
    if (!teamProfiles) return undefined
    const known = teamResolutions.get(request)
    if (known) return known.intent === requestIntent(request) ? known.value : Promise.resolve({ status: "denied" } as const)
    const intent = requestIntent(request)
    const pending = teamProfiles.resolve(request)
    teamResolutions.set(request, Object.freeze({ intent, value: pending }))
    return pending
  }
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
  const effective = async (request: Request, dashboard: Snapshot, snapshots = input.persistence.currentSnapshots?.(), context = false) => measureTeamAuthority(request, "policy-total", async () => {
    if (!snapshots) return undefined
    const current = identity()
    if (!current || request.signal.aborted || new URL(request.url).origin !== input.origin ||
      request.headers.get("sec-fetch-site") === "cross-site" ||
      (request.headers.has("origin") && request.headers.get("origin") !== input.origin)) return undefined
    const identityDigest = digestSfValue(current)
    const pendingResolution = measureTeamAuthority(request, "team-resolution", async () => resolveTeams(request)?.catch(() => undefined))
    const policy = await measureTeamAuthority(request, "grants-before", currentGrants)
    const resolution = await pendingResolution
    if (teamProfiles && resolution?.status !== "authenticated") return undefined
    const profile = resolution?.status === "authenticated" ? resolution : undefined
    // This block only observes private policy and identity. The final retained-profile
    // check below runs after every asynchronous reader and before any result escapes.
    if (profile && (!teamProfiles || !context && !profile.admission)) return undefined
    const maps = () => surfaces.map((surface) => ({
      surface, rows: roleMap(surface === "dashboard" ? dashboard : snapshots[surface], surface),
    }))
    const mapped = maps()
    const mappedDigest = digestSfValue(mapped)
    const observed = await measureTeamAuthority(request, "role-maps", async () => input.authenticateAll
      ? await input.authenticateAll(request, mapped.map((entry) => ({ surface: entry.surface, roleMap: entry.rows }))).catch(() => null)
      : await Promise.all(mapped.map(async (entry) => ({
          surface: entry.surface,
          actor: await input.authenticate(request, { surface: entry.surface, roleMap: entry.rows }),
        }))))
    if (!observed || observed.length !== mapped.length || observed.some((entry, index) => entry.surface !== mapped[index].surface))
      return undefined
    const present = observed.flatMap((entry) => entry.actor ? [{ ...entry, actor: entry.actor }] : [])
    const principalRef = profile?.principal.principalObjectId ?? present[0]?.actor.id
    if (!principalRef || principalRef.startsWith("local:") ||
        present.some((entry) => entry.actor.id !== principalRef) || request.signal.aborted) return undefined
    if (profile?.admission && (profile.admission.profile.installationId !== input.installationId ||
        profile.admission.profile.tenantId !== profile.principal.tenantId ||
        profile.admission.principal.principalObjectId !== principalRef ||
        profile.admission.configRevision !== profile.configRevision)) return undefined
    const scopes = () => surfaces.map((surface) => {
      const snapshot = surface === "dashboard" ? dashboard : snapshots[surface]
      const access = object(object(snapshot.data.access)[principalRef])
      if ((access.assigned !== undefined && (!Array.isArray(access.assigned) || access.assigned.some((value) => typeof value !== "string"))) ||
          (access.domains !== undefined && (!Array.isArray(access.domains) || access.domains.some((value) => typeof value !== "string"))))
        throw new Error("SF_PRODUCT_ACCESS_SCOPE_INVALID")
      return { surface, assigned: Array.isArray(access.assigned) ? [...new Set(access.assigned)].toSorted() : [],
        domains: Array.isArray(access.domains) ? [...new Set(access.domains)].toSorted() : [] }
    })
    const scoped = scopes()
    const grant = policy.find((entry) => entry.principalRef === principalRef)
    const roles = present.flatMap((entry) => entry.actor.roles.filter((role) => role.surface === entry.surface))
      .map((role) => ({ surface: role.surface, role: role.role }))
      .toSorted((a, b) => `${a.surface}:${a.role}`.localeCompare(`${b.surface}:${b.role}`))
    const canWrite = present.some((entry) => entry.actor.canWrite)
    // Directory, role and policy readers are asynchronous. Recheck the retained
    // original session/profile before rereading the current private grant policy.
    if (profile && (!teamProfiles || !(context
      ? await measureTeamAuthority(request, "team-revalidate", () => teamProfiles.revalidateResolution(profile))
      : profile.admission && await measureTeamAuthority(request, "team-revalidate", () => teamProfiles.revalidate(profile.admission))))) return undefined
    if (digestSfValue(await measureTeamAuthority(request, "grants-after", currentGrants)) !== digestSfValue(policy) ||
        digestSfValue(maps()) !== mappedDigest || digestSfValue(scopes()) !== digestSfValue(scoped) ||
        digestSfValue(identity()) !== identityDigest || request.signal.aborted || !sameTeamIntent(request)) return undefined
    const accessRevision = digestSfValue({
      installationId: current.installationId, projectId: current.projectId, principalRef,
      ...(profile ? { principal: profile.principal, profile: profile.admission?.profile ?? null,
        configRevision: profile.configRevision } : {}),
      roles, roleMaps: mapped, scopes: scoped, canWrite,
      grant: grant ? { namespaces: [...grant.namespaces].toSorted(), operations: [...grant.operations].toSorted(),
        humanActions: [...grant.humanActions ?? []].toSorted(), sessionActions: [...grant.sessionActions ?? []].toSorted(),
        referenceActions: [...grant.referenceActions ?? []].toSorted(), migrationActions: [...grant.migrationActions ?? []].toSorted(),
        connectionActions: [...grant.connectionActions ?? []].toSorted(),
        connectionResources: [...grant.connectionResources ?? []].map((resource) => ({ ...resource }))
          .toSorted((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))) } : null,
      policyVersion: input.policyVersion,
    })
    return { principalRef, policyVersion: input.policyVersion, accessRevision, canWrite, grant, roles, profile,
      identity: current, observed }
  })
  const principal = async (request: Request, dashboard: Snapshot, snapshots = input.persistence.currentSnapshots?.()) => {
    const actor = await effective(request, dashboard, snapshots)
    return actor?.grant && actor.roles.length && (!teamProfiles || actor.profile?.admission) ? { ...actor, grant: actor.grant } : undefined
  }
  const resolve = async (request: Request) => measureTeamAuthority(request, "resolve-total", async () => {
    if (!input.persistence.currentSnapshots) return undefined
    const snapshots = input.persistence.currentSnapshots()
    if (snapshots) return principal(request, snapshots.dashboard, snapshots)
    return input.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: await principal(request, snapshot) }), { signal: request.signal })
  })
  const state = createSfProductState({
    persistence: input.persistence, createId: input.createId, nativeEvidenceWrites, proposalCoverageWrites: input.proposalCoverageWrites, nativePublicationGuards: input.nativePublicationGuards, signalRegistryWrites: input.signalRegistryWrites, caseSelectionWrites: input.caseSelectionWrites, threadHistoryWrites: input.threadHistoryWrites,
    dashboardHostWrites: input.dashboardHostWrites, procurementEvidenceWrites: input.procurementEvidenceWrites, analysisSelectionWrites: input.analysisSelectionWrites,
    authorize: async (request, snapshot, namespace, mode) => {
      const actor = await principal(request, snapshot)
      if (!actor || !actor.grant.namespaces.includes(namespace) || (mode === "write" && !actor.canWrite)) return undefined
      return { principalRef: actor.principalRef, policyVersion: actor.policyVersion, accessRevision: actor.accessRevision,
        ...(actor.profile?.admission ? { profile: actor.profile.admission.profile } : {}) }
    },
    resolveTarget: async (request, snapshot, namespace, targetRef, command) => {
      const actor = await principal(request, snapshot)
      if (!actor || !actor.grant.namespaces.includes(namespace)) return undefined
      if (actor.canWrite && creationNamespaces.includes(namespace) && targetRef === creationTarget.ref) return { incarnation: creationTarget.incarnation }
      const state = object(snapshot.data.__sfProductV1)
      const cases = object(state.cases)
      // Domain receipts are authorized against their preparation, even when a domain ID also names a case.
      if (namespace === "receipts" && command.domainSurface === "dashboard") {
        if (!actor.canWrite) return undefined
        const preferences = object(state.preferences)
        const targets = Object.values(cases).flatMap((value) => {
          const decision = object(value)
          if (typeof decision.id !== "string" || typeof decision.incarnation !== "string" || !Number.isSafeInteger(decision.version) || typeof decision.version !== "number" || decision.version < 1 || !Array.isArray(decision.participants) || !decision.participants.includes(actor.principalRef) || !Array.isArray(decision.choices) || !Array.isArray(decision.preparedChanges)) return []
          const changes: readonly unknown[] = decision.preparedChanges
          const choices: readonly unknown[] = decision.choices
          const decisionVersion = decision.version
          return changes.flatMap((value) => {
            const change = object(value)
            const target = object(change.target)
            if (typeof change.id !== "string" || typeof change.idempotencyKey !== "string" || target.surface !== "dashboard" || target.id !== targetRef || typeof target.incarnation !== "string" || target.incarnation !== command.targetIncarnation || command.idempotencyKey !== `prepared:${change.idempotencyKey}`) return []
            const binding = object(preferences[`sf:dashboard-host:prepared:${change.id}`])
            const caseRef = object(binding.caseRef)
            const boundChoices = choices.map(object).filter((choice) => choice.id === change.choiceId)
            if (binding.schema !== "sf-dashboard-prepared-binding-v1" || binding.changeId !== change.id || binding.choiceId !== change.choiceId || caseRef.id !== decision.id || caseRef.incarnation !== decision.incarnation || !Number.isSafeInteger(caseRef.version) || typeof caseRef.version !== "number" || caseRef.version < 1 || caseRef.version > decisionVersion || (change.state === "planned" && !change.receipt && caseRef.version !== decisionVersion) || binding.principalRef !== actor.principalRef || binding.accessRevision !== actor.accessRevision || binding.policyVersion !== actor.policyVersion || boundChoices.length !== 1 || binding.choiceDigest !== digestSfValue(boundChoices[0]) || digestSfValue(binding.command) !== digestSfValue(change.operation)) return []
            const material = Object.fromEntries(Object.entries(binding).filter(([key]) => key !== "recordDigest"))
            if (binding.recordDigest !== digestSfValue(material)) return []
            return [{ incarnation: target.incarnation }]
          })
        })
        return targets.length === 1 ? targets[0] : undefined
      }
      if (namespace === "receipts" && command.domainSurface === "procurement") {
        if (!actor.canWrite) return undefined
        const target = await input.authorizePreparedTarget?.(request, snapshot, targetRef, { principalRef: actor.principalRef, accessRevision: actor.accessRevision, policyVersion: actor.policyVersion })
        const current = await principal(request, snapshot)
        return current && current.principalRef === actor.principalRef && current.accessRevision === actor.accessRevision &&
          current.policyVersion === actor.policyVersion ? target : undefined
      }
      const parsed = parseCaseRef(targetRef)
      if (targetRef.startsWith("case:") && !parsed) return undefined
      const id = parsed?.id ?? targetRef
      const entry = Object.hasOwn(cases, id) ? object(cases[id]) : undefined
      if (entry && entry.id === id && typeof entry.incarnation === "string" && (!parsed || parsed.incarnation === entry.incarnation) &&
        Array.isArray(entry.participants) && entry.participants.includes(actor.principalRef)) return { incarnation: entry.incarnation }
      if (namespace === "documents") {
        const target = await input.authorizeDocument(request, snapshot, targetRef, actor.principalRef, { principalRef: actor.principalRef, accessRevision: actor.accessRevision, policyVersion: actor.policyVersion })
        const current = await principal(request, snapshot)
        return current && current.principalRef === actor.principalRef && current.accessRevision === actor.accessRevision &&
          current.policyVersion === actor.policyVersion ? target : undefined
      }
      return undefined
    },
  })
  const ui = createSfUiAuthority({
    privateCommands: [...sfHumanActions.map((action) => `sf-human:${action}`), ...Object.keys(collaborationReads).map((action) => `sf-read:${action}`)],
    createId: input.createId, now: input.now, commandIdentity: input.commandIdentity,
    authorize: async (request, operation) => {
      // Read uncertainty must reach its HTTP/producer boundary. Undefined is
      // still an explicit negative; write and native admission keep their gates.
      const readAction = operation.startsWith("sf-read:") ? operation.slice("sf-read:".length) :
        operation.startsWith("sf-human:") ? operation.slice("sf-human:".length) : undefined
      const readOperation = operation === "sf_review_prepare" ||
        readAction !== undefined && Object.hasOwn(collaborationReads, readAction)
      const actor = readOperation ? await resolve(request) : await resolve(request).catch(() => undefined)
      if (operation.startsWith("sf-read:")) {
        const read = collaborationReads[operation.slice("sf-read:".length)]
        if (!actor || !read || !actor.grant.operations.includes(read.operation) || read.namespaces.some((namespace) => !actor.grant.namespaces.includes(namespace))) return undefined
        return { installationId: actor.identity.installationId, projectId: actor.identity.projectId,
          principalRef: actor.principalRef, policyVersion: actor.policyVersion, accessRevision: actor.accessRevision }
      }
      if (!actor || !(operation.startsWith("sf-human:")
        ? (actor.canWrite || sfHumanReadActions.some((action) => operation === `sf-human:${action}`)) && actor.grant.humanActions?.some((action) => operation === `sf-human:${action}`)
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
    const current = await resolve(request).catch(() => undefined)
    if (!current || current.principalRef !== actor.principalRef || current.accessRevision !== actor.accessRevision ||
        current.policyVersion !== actor.policyVersion || digestSfValue(current.identity) !== digestSfValue(actor.identity)) return undefined
    return current
  }
  const authorizeBinding = async (value: SfNativeAdmission, binding: TrustedExecutionBinding, purpose: "execute" | "interrupt", request = value.request): Promise<boolean> => {
    const generation = await input.providerGeneration()
    const actor = await admission(value, purpose, request).catch(() => undefined)
    return !!actor && binding.nativeSessionId === value.sessionID && binding.runId === value.runId &&
      binding.caseId === value.caseRef.id && binding.caseVersion === value.caseRef.version && binding.caseIncarnation === value.caseRef.incarnation &&
      binding.profileId === value.profile.id && binding.profileVersion === value.profile.version && binding.manifestDigest === value.manifestDigest &&
      digestSfValue(binding.skillReceipts) === digestSfValue(value.skillReceipts) && binding.entryMode === value.entryMode && binding.installationId === actor.identity.installationId && binding.hostId === actor.identity.hostId &&
      binding.projectId === actor.identity.projectId && binding.locationId === digestSfValue(actor.identity.location) &&
      binding.principalRef === actor.principalRef && binding.policyVersion === actor.policyVersion && binding.accessRevision === actor.accessRevision &&
      binding.providerGeneration === generation
  }
  const authorizeNative = (value: SfNativeAdmission, binding: TrustedExecutionBinding) => authorizeBinding(value, binding, "execute")
  // Cleanup after durable cancellation never reauthorizes model execution or tool leases.
  const authorizeInterrupt = (value: SfNativeAdmission, binding: TrustedExecutionBinding, request: Request) =>
    request.method === "POST" && request.headers.get("origin") === input.origin && request.headers.get("sec-fetch-site") !== "cross-site"
      ? authorizeBinding(value, binding, "interrupt", request) : Promise.resolve(false)
  const native = createSfExecutionBindingRegistry({
    authenticateAndResolve: async (value) => {
      const generation = await input.providerGeneration()
      const actor = await admission(value).catch(() => undefined)
      const now = input.now()
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
    if (!current?.canWrite || current.principalRef !== actor.principalRef || current.accessRevision !== actor.accessRevision || current.policyVersion !== actor.policyVersion || request.signal.aborted) return []
    return [...actor.grant.humanActions ?? []]
  }
  /** Current public projection only; holders and grants remain in the resolver/authority closures. */
  const readTeamContextAdmission = async (request: Request) => {
    if (!teamProfiles || !input.persistence.currentSnapshots)
      return { status: "unavailable", reason: "host-unavailable" } as const
    if (!identity() || request.signal.aborted)
      return { status: "unavailable", reason: "identity-unavailable" } as const
    const resolution = await resolveTeams(request)?.catch(() => undefined)
    if (!resolution) return { status: "unavailable", reason: "host-unavailable" } as const
    if (resolution.status === "unauthenticated" || resolution.status === "denied") return resolution
    if (resolution.status === "unavailable")
      return { status: "unavailable", reason: "host-unavailable" } as const
    const read = async (dashboard: Snapshot) => {
      const snapshots = input.persistence.currentSnapshots?.()
      if (!snapshots) return { status: "unavailable", reason: "host-unavailable" } as const
      const actor = await effective(request, dashboard, snapshots, true).catch(() => undefined)
      if (!actor?.profile || request.signal.aborted) return { status: "unavailable", reason: "contract-mismatch" } as const
      const admitted = actor.grant && actor.roles.length ? actor.profile.admission : undefined
      const binding = admitted ? Schema.decodeUnknownSync(TeamProfile.Binding)({
        owner: { profile: admitted.profile, principal: admitted.principal },
        revisions: { configRevision: admitted.configRevision, accessRevision: actor.accessRevision },
      }) : undefined
      const pages: readonly { surface: Surface; page: string }[] = binding ? actor.observed.flatMap((entry) => {
        if (!entry.actor) return []
        const roles = entry.actor.roles.filter((role) => role.surface === entry.surface).map((role) => role.role)
        const snapshot = entry.surface === "dashboard" ? dashboard : snapshots[entry.surface]
        const summaries = Array.isArray(snapshot.data.summaries)
          ? snapshot.data.summaries.filter((value): value is string => typeof value === "string") : []
        const allowed = entry.surface === "dashboard" ? dashboardPages({ roles }, summaries) :
          entry.surface === "planner" ? plannerKeys({ roles }) : procurementKeys({ roles })
        return allowed.map((page) => ({ surface: entry.surface, page }))
      }) : []
      const projection = Schema.decodeUnknownSync(TeamProfile.Authenticated)({
        contractRevision: "sf-team-profile/1", status: "authenticated", installationId: input.installationId,
        principal: actor.profile.principal, accessRevision: actor.accessRevision,
        administration: actor.profile.administration, teams: actor.profile.teams,
      })
      return {
        status: "ok" as const, projection, ...(binding ? { binding } : {}), pages,
        technical: {
          installationId: actor.identity.installationId, projectId: actor.identity.projectId,
          hostId: actor.identity.hostId, principalRef: actor.principalRef,
          policyVersion: actor.policyVersion, accessRevision: actor.accessRevision,
        },
      }
    }
    const snapshots = input.persistence.currentSnapshots()
    if (snapshots) return read(snapshots.dashboard)
    return input.persistence.transaction("dashboard", async (snapshot) => ({
      commit: false, value: await read(snapshot),
    }), { signal: request.signal })
  }
  /**
   * Host-private F01 context source. Uses the original Request and the same
   * guarded principal/role-map resolver as the product state. Returns no grant,
   * group, role, directory, cookie or source snapshot to the UI.
   */
  const readContextAdmission = async (request: Request) => {
    if (teamProfiles) {
      const context = await readTeamContextAdmission(request)
      if (context.status !== "ok") return context
      if (!context.binding) return { status: "denied" } as const
      return { status: "ok" as const, stamp: { ...context.technical, team: context.binding }, pages: context.pages }
    }
    if (!identity() || request.signal.aborted) return { status: "unavailable", reason: "identity-unavailable" } as const
    const admitted = await resolve(request).catch(() => undefined)
    if (!admitted) {
      if (!input.isAuthenticated) return { status: "unavailable", reason: "host-unavailable" } as const
      const loggedIn = await input.isAuthenticated(request).catch(() => undefined)
      if (request.signal.aborted || !identity()) return { status: "unavailable", reason: "contract-mismatch" } as const
      if (loggedIn === undefined) return { status: "unavailable", reason: "host-unavailable" } as const
      return loggedIn ? { status: "denied" } as const : { status: "unauthenticated" } as const
    }
    // Re-read the real role maps inside the canonical persistence scope. The
    // SQLite driver only exposes currentSnapshots() while a transaction is open;
    // observing it outside one incorrectly reported a valid installed host as 503.
    const readAdmittedContext = async () => {
    const snapshots = input.persistence.currentSnapshots?.()
    if (!snapshots) return { status: "unavailable", reason: "host-unavailable" } as const
    const surfacePages = await Promise.all((["dashboard", "planner", "procurement"] as const).map(async (surface) => {
      const snapshot = snapshots[surface]
      const real = await input.authenticate(request, { surface, roleMap: roleMap(snapshot, surface) })
      if (!real) return [] as readonly { surface: Surface; page: string }[]
      if (real.id !== admitted.principalRef || request.signal.aborted) throw new Error("SF_F01_PRINCIPAL_CHANGED")
      const roles = real.roles.filter((role) => role.surface === surface).map((role) => role.role)
      const summaries = Array.isArray(snapshot.data.summaries)
        ? snapshot.data.summaries.filter((value): value is string => typeof value === "string") : []
      const allowed = surface === "dashboard" ? dashboardPages({ roles }, summaries) :
        surface === "planner" ? plannerKeys({ roles }) : procurementKeys({ roles })
      return allowed.map((page) => ({ surface, page }))
    })).catch(() => undefined)
    if (!surfacePages || request.signal.aborted) return { status: "unavailable", reason: "contract-mismatch" } as const
    const current = await resolve(request).catch(() => undefined)
    if (!current || current.principalRef !== admitted.principalRef ||
      current.policyVersion !== admitted.policyVersion || current.accessRevision !== admitted.accessRevision ||
      digestSfValue(current.identity) !== digestSfValue(admitted.identity) || request.signal.aborted)
      return { status: "unavailable", reason: "contract-mismatch" } as const
    return {
      status: "ok" as const,
      stamp: {
        installationId: current.identity.installationId, projectId: current.identity.projectId,
        hostId: current.identity.hostId, principalRef: current.principalRef,
        policyVersion: current.policyVersion, accessRevision: current.accessRevision,
      },
      pages: surfacePages.flat(),
    }
    }
    // commit=false is mandatory: context admission never mutates business state.
    // The same real driver, authenticator and second principal check remain in use.
    return input.persistence.transaction("dashboard", async () => ({
      commit: false, value: await readAdmittedContext(),
    }), { signal: request.signal })
  }

  /**
   * Corporate Core permissions are explicit private grants. Eligibility/roles
   * alone never authorize a conversation, and a serialized Binding cannot enter
   * this closure. Native C15 run/selection/model/receipt checks still follow.
   */
  const readCoreSessionAdmission = async (request: Request): Promise<SessionOwner.Admission | undefined> => {
    const initial = await resolve(request).catch(() => undefined)
    if (!teamProfiles || !initial?.profile?.admission) return undefined
    const binding = Schema.decodeUnknownSync(TeamProfile.Binding)({
      owner: { profile: initial.profile.admission.profile, principal: initial.profile.principal },
      revisions: { configRevision: initial.profile.configRevision, accessRevision: initial.accessRevision },
    })
    const same = (actor: Awaited<ReturnType<typeof resolve>>) => !!actor &&
      actor.principalRef === initial.principalRef && actor.accessRevision === initial.accessRevision &&
      actor.policyVersion === initial.policyVersion &&
      digestSfValue(actor.profile?.admission?.profile) === digestSfValue(binding.owner.profile) &&
      digestSfValue(actor.identity) === digestSfValue(initial.identity) && !request.signal.aborted

    const exclusions = (actor: NonNullable<Awaited<ReturnType<typeof resolve>>>, snapshot: Snapshot) => {
      const raw = snapshot.data.__sfProductV1
      if (raw !== undefined && (!raw || typeof raw !== "object" || Array.isArray(raw))) return undefined
      const stored = object(raw)
      if (stored.nativeRuns !== undefined &&
        (!stored.nativeRuns || typeof stored.nativeRuns !== "object" || Array.isArray(stored.nativeRuns))) return undefined
      const denied = new Set<SessionSchema.ID>()
      const runs = new Map<SessionSchema.ID, number>()
      for (const value of Object.values(object(stored.nativeRuns))) {
        if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
        const run = object(value)
        if (run.native === undefined) continue
        if (!run.native || typeof run.native !== "object" || Array.isArray(run.native)) return undefined
        const native = object(run.native)
        const sessionID = Schema.decodeUnknownOption(Session.ID)(native.sessionID).valueOrUndefined
        if (!sessionID || typeof run.principalRef !== "string") return undefined
        runs.set(sessionID, (runs.get(sessionID) ?? 0) + 1)
        if (run.principalRef !== actor.principalRef) continue
        const ref = object(run.caseRef)
        const currentCase = typeof ref.id === "string" ? object(object(stored.cases)[ref.id]) : {}
        if (!actor.grant.namespaces.includes("cases") || !actor.grant.namespaces.includes("contributions") ||
          !currentCase.id || currentCase.id !== ref.id || currentCase.incarnation !== ref.incarnation ||
          !Array.isArray(currentCase.participants) || !currentCase.participants.includes(actor.principalRef))
          denied.add(sessionID)
      }
      for (const [sessionID, count] of runs) if (count !== 1) denied.add(sessionID)
      return Schema.decodeUnknownOption(SessionAccess.ExcludedSessions)([...denied].toSorted()).valueOrUndefined
    }
    const observe = async () => {
      if (!input.persistence.currentSnapshots) return undefined
      const read = async (snapshot: Snapshot) => {
        const actor = await principal(request, snapshot)
        if (!actor || !same(actor)) return undefined
        const excluded = exclusions(actor, snapshot)
        if (!excluded) return undefined
        // exclusions is synchronous over this exact snapshot; no await separates it
        // from the complete current-policy observation returned by principal.
        return { actor, excluded }
      }
      const current = input.persistence.currentSnapshots()
      if (current) return read(current.dashboard)
      return input.persistence.transaction("dashboard", async (snapshot) => ({
        commit: false, value: await read(snapshot),
      }), { signal: request.signal })
    }
    return Object.freeze({
      binding: Object.freeze({
        owner: Object.freeze({ profile: Object.freeze({ ...binding.owner.profile }), principal: Object.freeze({ ...binding.owner.principal }) }),
        revisions: Object.freeze({ ...binding.revisions }),
      }),
      connections: (fence: () => Effect.Effect<boolean>) => Effect.promise(async () => {
        if (!teamConnections || typeof fence !== "function" || !same(await resolve(request).catch(() => undefined))) return undefined
        const authorize: TeamConnectionAccess["authorize"] = async (action, resources) => {
          if (!(await Effect.runPromise(fence()))) return false
          const current = await resolve(request).catch(() => undefined)
          if (!(await Effect.runPromise(fence()))) return false
          return !!current && same(current) && ConnectionAccess.Actions.some((known) => known === action) &&
            !!current.grant.connectionActions?.includes(action) && (action === "read" || current.canWrite) &&
            resources.every((resource) => current.grant.connectionResources?.some((allowed) =>
              allowed.category === resource.category && allowed.resourceId === resource.resourceId))
        }
        const access = async (): Promise<TeamConnectionAccess> => ({
          owner: binding.owner, key: await teamConnections.readKey(), authorize, signal: request.signal,
        })
        const run = <A>(work: () => Promise<A>): Effect.Effect<A, CredentialVault.Denied> => Effect.tryPromise({
          try: work,
          catch: (error) => new CredentialVault.Denied({ reason:
            error instanceof Error && error.message === "SF_TEAM_CONNECTION_CONFLICT" ? "conflict" :
            error instanceof Error && error.message === "SF_TEAM_CONNECTION_FORBIDDEN" ? "forbidden" : "unavailable" }),
        })
        const client: CredentialVault.Interface = {
          owner: Object.freeze({ profile: Object.freeze({ ...binding.owner.profile }), principal: Object.freeze({ ...binding.owner.principal }) }),
          check: (action, resource) => {
            const selectedAction = Schema.decodeUnknownSync(ConnectionAccess.Action)(action)
            const selectedResource = Object.freeze({ ...Schema.decodeUnknownSync(ConnectionAccess.Resource)(resource) })
            return run(async () => {
              if (!(await authorize(selectedAction, Object.freeze([selectedResource]))))
                throw new Error("SF_TEAM_CONNECTION_FORBIDDEN")
            })
          },
          list: (category, resourceId) => {
            const selected = Schema.decodeUnknownSync(ConnectionAccess.Category)(category)
            const resources = resourceId === undefined
              ? Object.freeze((initial.grant.connectionResources ?? []).filter((resource) => resource.category === selected)
                .map((resource) => Object.freeze({ ...resource })))
              : Object.freeze([Object.freeze({ category: selected, resourceId: Schema.decodeUnknownSync(ConnectionAccess.Identifier)(resourceId) })])
            return run(async () => teamConnections.store.list(await access(), resources))
          },
          inspect: (key) => {
            const selected = Object.freeze({ ...Schema.decodeUnknownSync(ConnectionAccess.Key)(key) })
            return run(async () => teamConnections.store.inspect(await access(), selected))
          },
          read: (key) => {
            const selected = Object.freeze({ ...Schema.decodeUnknownSync(ConnectionAccess.Key)(key) })
            return run(async () => teamConnections.store.read(await access(), selected))
          },
          write: (value) => {
            const decoded = Schema.decodeUnknownSync(ConnectionAccess.Write)(value)
            const command = Object.freeze({ ...decoded, key: Object.freeze({ ...decoded.key }) })
            return run(async () => teamConnections.store.write(await access(), command))
          },
          remove: (value) => {
            const decoded = Schema.decodeUnknownSync(ConnectionAccess.Remove)(value)
            const command = Object.freeze({ ...decoded, key: Object.freeze({ ...decoded.key }) })
            return run(async () => teamConnections.store.remove(await access(), command))
          },
        }
        return Object.freeze(client)
      }),
      configuration: () => Effect.promise(async () => {
        const held = initial.profile?.admission
        if (!held || !teamProfiles.readConfiguration || !same(await resolve(request).catch(() => undefined))) return undefined
        const value = await teamProfiles.readConfiguration(held).catch(() => undefined)
        if (!value || value.configRevision !== binding.revisions.configRevision ||
            digestSfValue(value.profile) !== digestSfValue(binding.owner.profile) ||
            !same(await resolve(request).catch(() => undefined))) return undefined
        return value
      }),
      inspect: (operations: ReadonlyArray<SessionOwner.InspectionOperation>) => Effect.promise(async () => {
        const requested = operations.map(({ action, sessionID }) => Object.freeze({ action, sessionID }))
        const current = await observe().catch(() => undefined)
        if (!current) return undefined
        const authorized = requested.every(({ action, sessionID }) =>
          SessionAccess.Actions.some((known) => known === action) &&
          (sessionID !== undefined || action === "read" || action === "create") &&
          !!current.actor.grant.sessionActions?.includes(action) &&
          (action === "read" || current.actor.canWrite) &&
          (sessionID === undefined || !current.excluded.includes(sessionID)))
        return Object.freeze({ authorized, excludedSessions: Object.freeze([...current.excluded]) })
      }),
      verifyCurrent: () => Effect.promise(async () => same(await resolve(request).catch(() => undefined))),
      authorize: (action: SessionAccess.Action, sessionID?: SessionSchema.ID) => Effect.promise(async () => {
        if (!SessionAccess.Actions.some((known) => known === action) ||
          sessionID === undefined && action !== "read" && action !== "create") return false
        const current = await observe().catch(() => undefined)
        return !!current && !!current.actor.grant.sessionActions?.includes(action) &&
          (action === "read" || current.actor.canWrite) &&
          (sessionID === undefined || !current.excluded.includes(sessionID))
      }),
      excludedSessions: () => Effect.promise(async () => {
        const current = await observe()
        if (!current || !current.actor.grant.sessionActions?.includes("read")) throw new Error("SF_SESSION_RESOURCE_POLICY_UNAVAILABLE")
        return current.excluded
      }),
    })
  }
  return { state, ui, human, humanActions, native, authority, host, creationTarget, nativeEvidenceWrites, authorizeNative, authorizeInterrupt, readContextAdmission, readTeamContextAdmission, readCoreSessionAdmission }
}


/** Snapshot only trusted private policy, including an intentional empty grant list. */
function productGrants(value: readonly SfProductGrant[]): readonly SfProductGrant[] {
  if (!Array.isArray(value) || value.length > 1000 ||
      new Set(value.map((grant) => grant.principalRef)).size !== value.length ||
      value.some((grant) => !grant || typeof grant.principalRef !== "string" || !grant.principalRef.trim() ||
        !Array.isArray(grant.namespaces) || !Array.isArray(grant.operations) ||
        new Set(grant.namespaces).size !== grant.namespaces.length || new Set(grant.operations).size !== grant.operations.length ||
        grant.namespaces.some((namespace: unknown) => typeof namespace !== "string" || !namespace.trim()) ||
        grant.operations.some((operation: unknown) => typeof operation !== "string" || !operation.trim()) ||
        grant.humanActions !== undefined && (!Array.isArray(grant.humanActions) ||
          new Set(grant.humanActions).size !== grant.humanActions.length ||
          grant.humanActions.some((action: unknown) => !sfHumanActions.some((known) => known === action))) ||
        grant.sessionActions !== undefined && (!Array.isArray(grant.sessionActions) ||
          new Set(grant.sessionActions).size !== grant.sessionActions.length ||
          grant.sessionActions.some((action: unknown) => !SessionAccess.Actions.some((known) => known === action))) ||
        grant.referenceActions !== undefined && (!Array.isArray(grant.referenceActions) ||
          new Set(grant.referenceActions).size !== grant.referenceActions.length ||
          grant.referenceActions.some((action: unknown) => action !== "list")) ||
        grant.migrationActions !== undefined && (!Array.isArray(grant.migrationActions) ||
          new Set(grant.migrationActions).size !== grant.migrationActions.length ||
          grant.migrationActions.some((action: unknown) => action !== "map" && action !== "cut" && action !== "recover")) ||
        grant.connectionActions !== undefined && (!Array.isArray(grant.connectionActions) ||
          new Set(grant.connectionActions).size !== grant.connectionActions.length ||
          grant.connectionActions.some((action: unknown) => !ConnectionAccess.Actions.some((known) => known === action))) ||
        grant.connectionResources !== undefined && !Schema.is(ConnectionAccess.Resources)(grant.connectionResources)))
    throw new Error("SF_PRODUCT_AUTHORITY_CONFIG_INVALID")
  return Object.freeze(value.map((grant: SfProductGrant) => Object.freeze({
    principalRef: grant.principalRef, namespaces: Object.freeze([...grant.namespaces].toSorted()),
    operations: Object.freeze([...grant.operations].toSorted()),
    humanActions: Object.freeze([...grant.humanActions ?? []].toSorted()),
    sessionActions: Object.freeze([...grant.sessionActions ?? []].toSorted()),
    referenceActions: Object.freeze([...grant.referenceActions ?? []].toSorted()),
    migrationActions: Object.freeze([...grant.migrationActions ?? []].toSorted()),
    connectionActions: Object.freeze([...grant.connectionActions ?? []].toSorted()),
    connectionResources: Object.freeze([...grant.connectionResources ?? []].map((resource) => Object.freeze({ ...resource }))
      .toSorted((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))),
  })).toSorted((left, right) => left.principalRef.localeCompare(right.principalRef)))
}
