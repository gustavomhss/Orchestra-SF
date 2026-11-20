/** F04 selected installed suites: private data from real F01 routes, authenticated
 * Microsoft contexts and the *original* domain producer. No synthetic source,
 * role flag, URL-only grant, cookie, token or storageState is persisted.
 */
import { open, rm } from "node:fs/promises"
import { Schema } from "effect"
import { SfContextStamp } from "@orchestra/schema/sucafina/context"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import path from "node:path"
import type { Browser, Page } from "@playwright/test"
import type { SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import { nativeJourneyEntryHref, nativeJourneyResolvedHref, requireNativeJourney } from "./journeys.ts"
import type { NativeJourney, NativeJourneyIntent } from "./journeys.ts"
import { observeNativeBinding, nativeTeamHeaders, readPrivateNativeText, requireNativeInvocation, requirePrivateNativeRoot } from "./readiness.ts"
import { nativeTeamRef, validateNativeBoundaries, validateNativeManifest } from "./manifest-contract.ts"
import type { NativeBoundaries } from "./manifest-contract.ts"
import { requireApprovedNativeConnection } from "./installed-manifest.ts"
import type { NativeInstalledRegistration } from "./installed-manifest.ts"
import type { NativeActor, NativeManifest, NativeTarget } from "./readiness.ts"

export type NativeInstalledSuite = "U15" | "U39" | "U40"
export type NativeInstalledCase = "list" | "editable" | "denied" | "stale" | "lost" | "entry" | "empty" | "source" | "readonly" | "revoked" | "late"
type RecordValue = Record<string, unknown>

export const nativeSuiteCases = {
  U15: { capabilityId: "CAP14", cases: ["list", "editable", "denied", "stale", "lost"] },
  U39: { capabilityId: "CAP04", cases: ["entry", "empty", "source", "readonly", "denied", "revoked", "stale", "late"] },
  U40: { capabilityId: "CAP05", cases: ["entry", "empty", "source", "readonly", "denied", "revoked", "stale", "late"] },
} as const

const collections = {
  CAP14: "contracts", CAP04: "opexOwners", CAP05: "capexProjects",
} as const

function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
function requireValue(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message)
}
function exact(value: RecordValue, keys: string[]) {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}
function selectionPath(manifest: NativeManifest, suite: NativeInstalledSuite) {
  return path.join(manifest.scratchRoot, "native-installed-" + suite.toLowerCase() + ".json")
}
function selectedHref(manifest: NativeManifest, suite: NativeInstalledSuite, route: SfResolvedRoute): string {
  const spec = nativeSuiteCases[suite]
  requireValue(record(route) && route.surfaceId === spec.capabilityId &&
    record(route.ownerSelection) &&
    route.ownerSelection.serverKey === manifest.target.serverKey &&
    route.ownerSelection.projectId === manifest.target.projectId &&
    route.ownerSelection.installationId === manifest.target.installationId &&
    route.ownerSelection.team?.installationId === manifest.target.installationId &&
    route.ownerSelection.team?.tenantId === manifest.target.tenantId &&
    route.ownerSelection.team?.teamObjectId === manifest.target.teamObjectId &&
    typeof route.href === "string" && typeof route.pathname === "string" &&
    typeof route.kind === "string" && record(route.params) && record(route.query),
    "F04_ORIGINAL_F01_SELECTED_ROUTE_OWNER_REQUIRED")
  const url = new URL(route.href, manifest.target.shellOrigin)
  requireValue(url.origin === manifest.target.shellOrigin && !url.username && !url.password &&
    !url.hash && url.pathname === route.pathname && !url.pathname.includes("//") &&
    !/[\x00-\x1f\x7f]/.test(url.href),
    "F04_F01_ROUTE_NOT_BOUND_TO_ORIGINAL_SHELL")
  const installed = new URL(manifest.target.chapterHref, manifest.target.shellOrigin)
  const entry = new URL(nativeJourneyEntryHref(manifest.target, spec.capabilityId,
    suite === "U15" ? undefined : 2026))
  requireValue(suite === "U15"
    ? installed.origin === entry.origin && installed.search === entry.search &&
      (installed.pathname === entry.pathname ||
        installed.pathname.startsWith(entry.pathname + "/")) &&
      !installed.hash && !installed.username && !installed.password
    : installed.href === entry.href,
    "F04_SUITE_MUST_HAVE_EXACT_INSTALLED_CHAPTER_BINDING")
  if (suite !== "U15") {
    requireValue(route.kind === "entry" && url.href === entry.href && Object.keys(route.params).length === 0,
      "F04_BUDGET_F01_ENTRY_YEAR_2026_REQUIRED")
  } else {
    requireValue(url.search === installed.search &&
      (url.pathname === entry.pathname ||
        url.href === nativeJourneyResolvedHref(manifest.target, "CAP14", url.href)),
      "F04_U15_REAL_F01_CONTRACT_ROUTE_REQUIRED")
  }
  return url.href
}

export function nativeCaseIntent(caseId: NativeInstalledCase): NativeJourneyIntent {
  return caseId === "denied" ? "denied" : caseId === "readonly" ? "readonly" :
    caseId === "list" || caseId === "empty" || caseId === "source" ? "read" : "edit"
}

/** Current original authority is independent from stored URLs and selections. */
export async function requireOriginalNativeOperations(input: Readonly<{
  page: Page; manifest: NativeManifest; capabilityId: NativeJourney
  principalRef: string; policyVersion: string; accessRevision: string; intent: NativeJourneyIntent
}>) {
  const value = await observeNativeBinding(input.page, input.manifest.target)
  requireValue(value.stamp.principalRef === input.principalRef &&
    value.stamp.policyVersion === input.policyVersion && value.stamp.accessRevision === input.accessRevision,
    "F04_SOURCE_CONTEXT_REVISION_OR_PRINCIPAL_CHANGED")
  const destination = value.destinations.find((row) => row.capabilityId === input.capabilityId)
  const availability = value.availability.find((row) => row.family === "domain-read" && row.resource === input.capabilityId)
  const ready = (operation: string) => availability?.operations.some((row) =>
    row.operationId === operation && row.state === "ready" && row.operational === true)
  if (input.intent === "denied") {
    requireValue(!destination?.canRead, "F04_NEGATIVE_REAL_PRODUCER_READ_STILL_PERMITTED")
  } else {
    requireValue(destination?.canRead && ready("domain.page." + input.capabilityId),
      "F04_SELECTED_DOMAIN_SOURCE_READ_NOT_OPERATIONAL")
    if (input.intent === "readonly")
      requireValue(!destination.allowedActionIds.includes("save"), "F04_READONLY_ACTOR_HAS_CURRENT_SAVE")
    if (input.intent === "edit")
      requireValue(destination.allowedActionIds.includes("save") && ready("domain.command." + input.capabilityId + ".save"),
        "F04_SELECTED_DOMAIN_SOURCE_SAVE_NOT_OPERATIONAL")
  }
  return { authenticated: true as const, producer: "ORIGINAL_DOMAIN_CONTEXT" as const }
}

async function originalCollection(input: Readonly<{ page: Page; manifest: NativeManifest; capabilityId: NativeJourney }>) {
  const target = input.manifest.target, before = await observeNativeBinding(input.page, target)
  const url = new URL(target.mount + "/api/ui/pages/" + input.capabilityId, target.publicOrigin)
  if (input.capabilityId !== "CAP14") url.searchParams.set("year", "2026")
  const reply = await input.page.request.get(url.href, {
    headers: nativeTeamHeaders(target), maxRedirects: 0, maxRetries: 0,
  })
  if (reply.status() !== 200) throw new Error("F04_ORIGINAL_SOURCE_PAGE_HTTP_" + reply.status())
  const envelope: unknown = await reply.json()
  const value = record(envelope) && record(envelope.value) ? envelope.value : undefined
  const data = value && record(value.data) ? value.data : undefined
  const versions = value && record(value.versions) ? value.versions : undefined
  const collection = collections[input.capabilityId], rows = data?.[collection]
  requireValue(record(envelope) && envelope.status === "ok" && value?.capabilityId === input.capabilityId &&
    Array.isArray(rows) && versions, "F04_ORIGINAL_SOURCE_PROJECTION_NOT_READY")
  const stamp = Schema.decodeUnknownSync(Schema.toCodecJson(SfContextStamp), { onExcessProperty: "error" })(envelope.context)
  const after = await observeNativeBinding(input.page, target)
  requireValue(stamp.team && JSON.stringify(stamp) === JSON.stringify(before.stamp) &&
    JSON.stringify(after.stamp) === JSON.stringify(before.stamp),
    "F04_SOURCE_CONTEXT_REVISION_OR_PRINCIPAL_CHANGED")
  return { collection, rows, versions }
}
export async function readOriginalNativeEmpty(input: Readonly<{
  page: Page; manifest: NativeManifest; capabilityId: NativeJourney
}>) {
  const source = await originalCollection(input)
  requireValue(source.rows.length === 0, "F04_GENUINE_ZERO_ROW_ORIGINAL_COLLECTION_REQUIRED")
  return { collection: source.collection, observedCount: 0 as const }
}

export type NativeSourceVersion = Readonly<{
  collection: "contracts" | "opexOwners" | "capexProjects"
  recordId: string
  versionKey: string
  version: number
}>

/** GET only; no POST, seeding, inferred 0, or fabricated record. */
export async function readOriginalNativeSource(input: Readonly<{
  page: Page; manifest: NativeManifest; capabilityId: NativeJourney; recordId: string
}>): Promise<NativeSourceVersion> {
  requireValue(typeof input.recordId === "string" && !!input.recordId.trim() &&
    input.recordId.length <= 256 && !/[\x00-\x1f\x7f]/.test(input.recordId),
    "F04_EXACT_ORIGINAL_SOURCE_RECORD_ID_REQUIRED")
  const { collection, rows, versions } = await originalCollection(input)
  const matches = rows.filter((row: unknown) =>
    record(row) && String(row.id ?? "") === input.recordId)
  requireValue(matches.length === 1, "F04_SOURCE_RECORD_NOT_UNIQUE_OR_NOT_IN_ORIGINAL_PROJECTION")
  const versionKey = collection + ":" + input.recordId
  const version = versions[versionKey]
  requireValue(typeof version === "number" && Number.isSafeInteger(version) && version >= 0,
    "F04_REAL_SOURCE_CAS_VERSION_MISSING")
  return { collection, recordId: input.recordId, versionKey, version }
}

export type NativeSuiteSelection = Readonly<{
  caseId: NativeInstalledCase
  boundaries: NativeBoundaries
  actor: NativeActor
  href: string
  route: SfResolvedRoute | null
  intent: NativeJourneyIntent
  observed: Readonly<{ principalRef: string; policyVersion: string; accessRevision: string; profile: TeamProfile.Ref }>
  emptyCollection?: Readonly<{ collection: NativeSourceVersion["collection"]; observedCount: 0 }>
  source: NativeSourceVersion | null
}>
export type NativeSelectedInstallation = Readonly<{
  schema: "sf2h.native-selected-installation.v2"
  suite: NativeInstalledSuite
  candidateSha: string
  serverKey: string
  installationId: string
  tenantId: string
  teamObjectId: string
  invocationId: string
  projectId: string
  hostId: string
  chapterHref: string
  selections: readonly NativeSuiteSelection[]
}>
export type NativeSelectionInput = Readonly<{
  caseId: NativeInstalledCase
  boundaries: NativeBoundaries
  actor: NativeActor
  page: Page
  route: SfResolvedRoute | null
  /** Selected in the real UI/F01 flow; checked against original source + CAS. */
  sourceRecordId?: string
}>

export function requireIsolatedNativeRevocation(
  manifest: NativeManifest,
  selections: readonly Pick<NativeSuiteSelection, "caseId" | "actor" | "boundaries">[],
  authorizedInvocation = process.env.SF_NATIVE_DISPOSABLE_REVOCATION,
) {
  const revoked = selections.find((entry) => entry.caseId === "revoked")
  if (!revoked) return
  requireValue(authorizedInvocation === manifest.invocation.invocationId && manifest.actors.dashboardAdmin &&
    revoked.actor !== "dashboardAdmin", "F04_DISPOSABLE_REVOCATION_INVOCATION_AND_DISTINCT_ADMIN_REQUIRED")
  const target = revoked.boundaries.target
  const otherTargets: NativeTarget[] = [manifest.target, manifest.wrongServer, manifest.wrongTeam,
    manifest.wrongInstallation, ...selections.filter((entry) => entry !== revoked).flatMap((entry) => Object.values(entry.boundaries))]
  requireValue(otherTargets.every((other) => other.installationId !== target.installationId &&
    (other.publicOrigin !== target.publicOrigin || other.mount !== target.mount) &&
    (other.tenantId !== target.tenantId || other.teamObjectId !== target.teamObjectId)),
  "F04_REVOCATION_INSTALLATION_NOT_ISOLATED")
}

export async function registerNativeSelectedInstallation(input: Readonly<{
  manifest: NativeManifest
  browser: Browser
  suite: NativeInstalledSuite
  selections: readonly NativeSelectionInput[]
  resolveApprovedConnection: NativeInstalledRegistration["resolveApprovedConnection"]
  originalActors: NativeInstalledRegistration["actors"]
  /** Genuine stale conflict editor already signed into *another* context. */
  staleEditor?: Readonly<{ actor: NativeActor; page: Page }>
}>): Promise<Readonly<{ suite: NativeInstalledSuite; file: string; selectionCount: number; proofClass: string }>> {
  if (process.env.GITHUB_ACTIONS !== "true" ||
      process.env.SF_NATIVE_CANDIDATE_SHA !== input.manifest.candidateSha)
    throw new Error("F04_SELECTED_CANDIDATE_RUNNER_MISMATCH")
  requireNativeInvocation(input.manifest)
  const root = await requirePrivateNativeRoot(input.manifest.scratchRoot)
  const required = nativeSuiteCases[input.suite]
  requireValue(input.selections.length === required.cases.length &&
    input.selections.every((row) => required.cases.some((name) => name === row.caseId)) &&
    new Set(input.selections.map((row) => row.caseId)).size === required.cases.length,
    "F04_SELECTED_SUITE_CASES_INCOMPLETE_OR_DUPLICATED")
  const contexts = new Set(input.browser.contexts())
  requireIsolatedNativeRevocation(input.manifest, input.selections)
  const result: NativeSuiteSelection[] = []
  for (const selected of input.selections) {
    requireValue(contexts.has(selected.page.context()) &&
      selected.page.context().pages().includes(selected.page) &&
      input.originalActors[selected.actor]?.context() === selected.page.context(),
      "F04_SELECTED_PAGE_NOT_FROM_ORIGINAL_HOST_BROWSER")
    const boundaries = validateNativeBoundaries(selected.boundaries)
    requireValue(boundaries.target.tenantId === input.manifest.target.tenantId, "F04_CASE_RESOURCE_TENANT_CHANGED")
    const manifest = nativeManifestForCase(input.manifest, { boundaries })
    await requireApprovedNativeConnection(boundaries.target, input.resolveApprovedConnection)
    await requireApprovedNativeConnection(boundaries.wrongServer, input.resolveApprovedConnection)
    const intent = nativeCaseIntent(selected.caseId)
    if (selected.caseId === "denied")
      requireValue(selected.actor === "denied" && !selected.sourceRecordId && selected.route === null,
        "F04_DENIED_SUITE_ACTOR_OR_SOURCE_INVALID")
    else if (input.suite === "U15")
      requireValue(selected.actor === "requester",
        "F04_U15_REQUESTER_MUST_USE_ORIGINAL_AUTHENTICATED_CONTEXT")
    requireValue(selected.caseId === "denied" || selected.route, "F04_ORIGINAL_F01_SELECTED_ROUTE_OWNER_REQUIRED")
    const href = selected.route ? selectedHref(manifest, input.suite, selected.route) :
      nativeJourneyEntryHref(manifest.target, required.capabilityId, input.suite === "U15" ? undefined : 2026)
    const live = await requireNativeJourney({
      page: selected.page, manifest: manifest, actor: selected.actor,
      capabilityId: required.capabilityId, intent,
      ...(input.suite === "U15" ? {} : { year: 2026 }),
    })
    await requireOriginalNativeOperations({
      page: selected.page, manifest: manifest,
      capabilityId: required.capabilityId, principalRef: live.principalRef,
      policyVersion: live.policyVersion, accessRevision: live.accessRevision, intent,
    })
    if (selected.caseId !== "denied" && selected.caseId !== "empty" && !selected.sourceRecordId)
      throw new Error("F04_SELECTED_REAL_SOURCE_RECORD_REF_REQUIRED")
    if (selected.caseId === "empty") requireValue(!selected.sourceRecordId, "F04_EMPTY_MUST_NOT_INVENT_RECORD")
    const emptyCollection = selected.caseId === "empty" ? await readOriginalNativeEmpty({
      page: selected.page, manifest: manifest, capabilityId: required.capabilityId,
    }) : undefined
    const source = selected.sourceRecordId
      ? await readOriginalNativeSource({
        page: selected.page, manifest: manifest,
        capabilityId: required.capabilityId, recordId: selected.sourceRecordId,
      })
      : null
    const again = await observeNativeBinding(selected.page, manifest.target)
    requireValue(again.stamp.principalRef === live.principalRef &&
      again.stamp.policyVersion === live.policyVersion &&
      again.stamp.accessRevision === live.accessRevision,
      "F04_SELECTION_CHANGED_DURING_ORIGINAL_SOURCE_READ")
    result.push({
      caseId: selected.caseId, boundaries, actor: selected.actor, href,
      route: selected.route, intent,
      observed: { principalRef: live.principalRef, policyVersion: live.policyVersion,
        accessRevision: live.accessRevision, profile: live.profile }, source,
      ...(emptyCollection ? { emptyCollection } : {}),
    })
  }
  {
    const stale = result.find((row) => row.caseId === "stale")
    const editor = input.staleEditor
    const manifest = stale ? nativeManifestForCase(input.manifest, stale) : undefined
    requireValue(manifest && editor && contexts.has(editor.page.context()) &&
      input.originalActors[editor.actor]?.context() === editor.page.context() &&
      editor.page.context() !== input.selections.find((entry) => entry.caseId === "stale")?.page.context() &&
      editor.actor !== stale?.actor && editor.actor !== "denied" && stale?.source,
      "F04_REAL_SECOND_CAP14_MICROSOFT_EDITOR_REQUIRED")
    const admitted = await requireNativeJourney({
      page: editor.page, manifest, actor: editor.actor,
      capabilityId: required.capabilityId, intent: "edit",
    })
    await requireOriginalNativeOperations({
      page: editor.page, manifest, capabilityId: required.capabilityId,
      principalRef: admitted.principalRef, policyVersion: admitted.policyVersion,
      accessRevision: admitted.accessRevision, intent: "edit",
    })
    const same = await readOriginalNativeSource({
      page: editor.page, manifest,
      capabilityId: required.capabilityId, recordId: stale.source.recordId,
    })
    requireValue(same.version === stale.source.version && same.versionKey === stale.source.versionKey,
      "F04_SECOND_EDITOR_NOT_ON_SAME_SOURCE_CAS_VERSION")
  }
  const file = selectionPath(input.manifest, input.suite)
  const bundle: NativeSelectedInstallation = {
    schema: "sf2h.native-selected-installation.v2",
    suite: input.suite, candidateSha: input.manifest.candidateSha,
    serverKey: input.manifest.target.serverKey,
    installationId: input.manifest.target.installationId, tenantId: input.manifest.target.tenantId,
    teamObjectId: input.manifest.target.teamObjectId, invocationId: input.manifest.invocation.invocationId,
    projectId: input.manifest.target.projectId,
    hostId: input.manifest.target.hostId,
    chapterHref: input.manifest.target.chapterHref,
    selections: result,
  }
  requireValue(path.dirname(file) === root, "F04_SELECTED_PRIVATE_PATH_OUTSIDE_INSTALLATION")
  const handle = await open(file, "wx", 0o600)
  try {
    await handle.writeFile(JSON.stringify(bundle) + "\n", "utf8")
    await handle.sync()
  } catch (error) {
    await handle.close()
    await rm(file, { force: true })
    throw error
  }
  await handle.close()
  // This is a record of prerequisite observations, not a PASS of U15/U39/U40.
  return { suite: input.suite, file, selectionCount: result.length,
    proofClass: "ORIGINAL_PRODUCER_PRECONDITIONS_NOT_JOURNEY_PASS" }
}

export async function readNativeSelectedInstallation(
  manifest: NativeManifest, suite: NativeInstalledSuite,
): Promise<NativeSelectedInstallation> {
  const root = await requirePrivateNativeRoot(manifest.scratchRoot)
  const file = selectionPath(manifest, suite)
  requireNativeInvocation(manifest)
  const serialized = await readPrivateNativeText(root, file, 131072)
  const bundle: unknown = JSON.parse(serialized)
  if (serialized !== JSON.stringify(bundle) + "\n") throw new Error("F04_SELECTED_WRITER_CONTRACT_REQUIRED")
  const spec = nativeSuiteCases[suite]
  if (!record(bundle) || !exact(bundle, [
    "schema", "suite", "candidateSha", "serverKey", "installationId",
    "tenantId", "teamObjectId", "invocationId", "projectId", "hostId", "chapterHref", "selections",
  ]) || bundle.schema !== "sf2h.native-selected-installation.v2" ||
      bundle.suite !== suite || bundle.candidateSha !== manifest.candidateSha ||
      bundle.serverKey !== manifest.target.serverKey ||
      bundle.installationId !== manifest.target.installationId ||
      bundle.tenantId !== manifest.target.tenantId || bundle.teamObjectId !== manifest.target.teamObjectId ||
      bundle.invocationId !== manifest.invocation.invocationId || bundle.projectId !== manifest.target.projectId ||
      bundle.hostId !== manifest.target.hostId ||
      bundle.chapterHref !== manifest.target.chapterHref ||
      !Array.isArray(bundle.selections) || bundle.selections.length !== spec.cases.length)
    throw new Error("F04_SELECTED_SUITE_CANDIDATE_OR_OWNER_MISMATCH")
  const selected = bundle.selections
  if (new Set(selected.map((row: unknown) => record(row) ? row.caseId : undefined)).size !== spec.cases.length)
    throw new Error("F04_PRIVATE_SUITE_CASE_SET_INVALID")
  for (const row of selected) {
    requireValue(record(row) && record(row.boundaries) &&
      exact(row.boundaries, ["target", "wrongServer", "wrongTeam", "wrongInstallation"]), "F04_CASE_BOUNDARIES_REQUIRED")
    const caseManifest = nativeManifestForCase(manifest, { boundaries: validateNativeBoundaries({
      target: row.boundaries.target, wrongServer: row.boundaries.wrongServer,
      wrongTeam: row.boundaries.wrongTeam, wrongInstallation: row.boundaries.wrongInstallation,
    }) })
    if (!record(row) || !exact(row, ["caseId", "boundaries", "actor", "href", "route", "intent", "observed", "source", ...(row.caseId === "empty" ? ["emptyCollection"] : [])]) ||
        !spec.cases.some((name) => name === row.caseId) ||
        !["requester", "holder", "denied", "dashboardAdmin"].includes(String(row.actor)) ||
        !record(row.observed) || !exact(row.observed, ["principalRef", "policyVersion", "accessRevision", "profile"]) ||
        row.observed.principalRef !== manifest.actors[row.actor as NativeActor] ||
        typeof row.observed.policyVersion !== "string" ||
        typeof row.observed.accessRevision !== "string" ||
        !Schema.is(TeamProfile.Ref)(row.observed.profile) ||
        JSON.stringify(row.observed.profile) !== JSON.stringify(nativeTeamRef(caseManifest.target)) ||
        row.intent !== nativeCaseIntent(row.caseId as NativeInstalledCase) ||
        (row.caseId === "denied" ? row.route !== null || row.actor !== "denied" ||
          row.href !== nativeJourneyEntryHref(caseManifest.target, spec.capabilityId, suite === "U15" ? undefined : 2026) :
          !record(row.route) || !record(row.route.ownerSelection) ||
          row.href !== selectedHref(caseManifest, suite, row.route as SfResolvedRoute)) ||
        (row.caseId === "denied" || row.caseId === "empty") !== (row.source === null))
      throw new Error("F04_PRIVATE_SELECTION_CONTRACT_INVALID")
    if (row.caseId === "empty" && (!record(row.emptyCollection) ||
        !exact(row.emptyCollection, ["collection", "observedCount"]) ||
        row.emptyCollection.collection !== collections[spec.capabilityId] || row.emptyCollection.observedCount !== 0))
      throw new Error("F04_EMPTY_COLLECTION_OBSERVATION_REQUIRED")
    if (row.source !== null) {
      if (!record(row.source) || !exact(row.source, ["collection", "recordId", "versionKey", "version"]) ||
          row.source.collection !== collections[spec.capabilityId] ||
          row.source.versionKey !== row.source.collection + ":" + row.source.recordId ||
          typeof row.source.version !== "number" || !Number.isSafeInteger(row.source.version) ||
          row.source.version < 0)
        throw new Error("F04_PRIVATE_SOURCE_VERSION_RECORD_INVALID")
    }
  }
  const validated = bundle as unknown as NativeSelectedInstallation
  requireIsolatedNativeRevocation(manifest, validated.selections)
  return validated
}

/** Every consumer must re-check actor, source readiness, record and current CAS
 * before use. A captured version can have legitimately advanced; no consumer
 * is allowed to treat it as current authority or as a successful mutation. */
export async function consumeCurrentNativeSelection(input: Readonly<{
  page: Page; manifest: NativeManifest; bundle: NativeSelectedInstallation
  caseId: NativeInstalledCase
}>) {
  const selected = input.bundle.selections.find((row) => row.caseId === input.caseId)
  if (!selected) throw new Error("F04_REAL_SELECTED_CASE_NOT_REGISTERED")
  const manifest = nativeManifestForCase(input.manifest, selected)
  const cap = nativeSuiteCases[input.bundle.suite].capabilityId
  const live = await requireNativeJourney({
    page: input.page, manifest, actor: selected.actor,
    capabilityId: cap, intent: selected.intent,
    ...(input.bundle.suite === "U15" ? {} : { year: 2026 }),
  })
  await requireOriginalNativeOperations({
    page: input.page, manifest, capabilityId: cap,
    principalRef: live.principalRef, policyVersion: live.policyVersion,
    accessRevision: live.accessRevision, intent: selected.intent,
  })
  if (selected.caseId === "empty") await readOriginalNativeEmpty({ page: input.page, manifest, capabilityId: cap })
  const source = selected.source && await readOriginalNativeSource({
    page: input.page, manifest, capabilityId: cap,
    recordId: selected.source.recordId,
  })
  if (source && source.versionKey !== selected.source?.versionKey)
    throw new Error("F04_REAL_SOURCE_RECORD_REBOUND")
  return {
    suite: input.bundle.suite, caseId: input.caseId,
    href: selected.href, actor: selected.actor, current: live,
    source: source ?? null,
    sourceVersionAdvancedSinceRegistration: Boolean(source &&
      selected.source && source.version !== selected.source.version),
    proofClass: "CURRENT_ORIGINAL_PRODUCER_PRECONDITION_NOT_CASE_PASS" as const,
  }
}

export function nativeSuiteFromChapter(manifest: NativeManifest): NativeInstalledSuite | undefined {
  const chapter = new URL(manifest.target.chapterHref, manifest.target.shellOrigin)
  return (Object.keys(nativeSuiteCases) as NativeInstalledSuite[]).find((suite) => {
    const route = nativeJourneyEntryHref(manifest.target, nativeSuiteCases[suite].capabilityId,
      suite === "U15" ? undefined : 2026)
    if (suite !== "U15") return chapter.href === route
    const entry = new URL(route)
    return chapter.origin === entry.origin && chapter.search === entry.search &&
      !chapter.hash && !chapter.username && !chapter.password &&
      (chapter.pathname === entry.pathname ||
        chapter.pathname.startsWith(entry.pathname + "/"))
  })
}

/** 194's legacy env inputs are URLs only. The true authority is this private
 * bundle + current original producer, never the env value itself. */
export function u15RegisteredEnvironment(bundle: NativeSelectedInstallation): Record<string, string> {
  if (bundle.suite !== "U15") throw new Error("F04_U15_CASE_BUNDLE_REQUIRED")
  const pairs = [
    ["list", "SF_NATIVE_U15_LIST_URL"],
    ["editable", "SF_NATIVE_U15_EDIT_URL"],
    ["denied", "SF_NATIVE_U15_DENIED_URL"],
    ["stale", "SF_NATIVE_U15_STALE_URL"],
    ["lost", "SF_NATIVE_U15_LOST_RESPONSE_URL"],
  ] as const
  return Object.fromEntries(pairs.map(([id, key]) => {
    const row = bundle.selections.find((entry) => entry.caseId === id)
    if (!row) throw new Error("F04_U15_REAL_SCENARIO_MISSING_" + id)
    return [key, row.href]
  }))
}

/** Selects recorded metadata only. The caller still re-observes original authority. */
export function nativeManifestForCase(
  invocation: NativeManifest, selected: Pick<NativeSuiteSelection, "boundaries">,
): NativeManifest {
  const manifest = validateNativeManifest({ ...invocation, ...selected.boundaries })
  requireValue(manifest.target.tenantId === invocation.target.tenantId, "F04_CASE_RESOURCE_TENANT_CHANGED")
  return manifest
}
