import { writeNativePrivate } from "./installed-manifest.ts"
/** Original F01/F02/source observations, private per-case Team selection. Never authority from a file. */
import path from "node:path"
import { Schema } from "effect"
import type { Browser, Page } from "@playwright/test"
import type { SfResolvedRoute, SfTeamContext } from "@orchestra/schema/sucafina/context"
import { SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import { digest, privateText } from "../../../../../../script/sf-ci/g08-private-evidence.mjs"
import { readSfTeamDomainIntent, resolveSfTeamDomainRoute } from "../../../../src/orchestra/chapters/sucafina/host/team-domain-route.ts"
import { nativeCaseIntent, nativeRole, nativeSuiteCases, nativeSuiteCapability } from "./case-contract.ts"
import type { NativeInstalledCase, NativeInstalledSuite } from "./case-contract.ts"
import { nativeOwnerQuery, nativeTeamRef, validateNativeManifest, validateNativeTarget } from "./manifest-contract.ts"
import type { NativeActor, NativeManifest, NativeTarget } from "./manifest-contract.ts"
import { nativeJourneyEntryHref, requireNativeJourney } from "./journeys.ts"
import type { NativeJourney, NativeJourneyIntent } from "./journeys.ts"
import { observeNativeBinding, nativeTeamHeaders } from "./readiness.ts"
import { nativeOriginalRequest } from "./browser-transport.ts"
import { nativeTargetInReservation, requireNativeInstalledHost } from "./installed-host.ts"
export type { NativeInstalledCase, NativeInstalledSuite } from "./case-contract.ts"
export type { SfResolvedRoute } from "@orchestra/schema/sucafina/context"

type Row = Record<string, unknown>
function record(value: unknown): value is Row { return !!value && typeof value === "object" && !Array.isArray(value) }
function need(value: unknown, reason: string): asserts value { if (!value) throw new Error(reason) }
function same(left: unknown, right: unknown) { return digest(JSON.stringify(left)) === digest(JSON.stringify(right)) }
const collections = { CAP14: "contracts", CAP04: "opexOwners", CAP05: "capexProjects" } as const
const names = { CAP14: "Vendor Contracts", CAP04: "OPEX Detail", CAP05: "CAPEX Projects" } as const
const decoders = {
  CAP14: Schema.decodeUnknownSync(SfDomain.operations["domain.page.CAP14"].output, { onExcessProperty: "error" }),
  CAP04: Schema.decodeUnknownSync(SfDomain.operations["domain.page.CAP04"].output, { onExcessProperty: "error" }),
  CAP05: Schema.decodeUnknownSync(SfDomain.operations["domain.page.CAP05"].output, { onExcessProperty: "error" }),
} as const
function descriptor(target: NativeTarget) {
  return Schema.decodeUnknownSync(SfTeamInstallationDescriptor, { onExcessProperty: "error" })({
    contractRevision: "sf-team-profile/1", authMode: "microsoft", installationId: target.installationId,
    tenantId: target.tenantId, projectId: target.projectId, hostId: target.hostId,
    publicOrigin: target.publicOrigin, mount: target.mount,
  })
}
function selectedHref(target: NativeTarget, suite: NativeInstalledSuite, route: SfResolvedRoute): string {
  const url = new URL(route.href, target.shellOrigin)
  const intent = readSfTeamDomainIntent(url, descriptor(target))
  need(intent && intent.candidate.surfaceId === nativeSuiteCapability[suite] &&
    same(intent.selector.profile, nativeTeamRef(target)) && route.pathname === url.pathname &&
    route.surfaceId === intent.candidate.surfaceId && route.kind === intent.candidate.kind,
    "F04_COMPLETE_ORIGINAL_F01_TEAM_ROUTE_REQUIRED")
  need(suite === "U15" || route.kind === "entry" && intent.query.year === 2026,
    "F04_BUDGET_ORIGINAL_ENTRY_2026_REQUIRED")
  return url.href
}
/** Alternate positive selection is only the reserved Team B, independently admitted at use. */
export function nativeManifestForTarget(manifest: NativeManifest, target: NativeTarget): NativeManifest {
  target = validateNativeTarget(target)
  if (same(target, manifest.target)) return manifest
  const fixed = ["serverKey", "discoveryOrigin", "shellOrigin", "publicOrigin", "installationId", "tenantId",
    "projectId", "hostId", "mount"] as const
  need(fixed.every((key) => target[key] === manifest.target[key]) &&
    target.teamObjectId !== manifest.target.teamObjectId, "F04_ALTERNATE_CASE_MUST_BE_SAME_HOST_OTHER_TEAM")
  const wrongInstallation = { ...target, installationId: manifest.wrongInstallation.installationId }
  const chapter = new URL(target.chapterHref, target.shellOrigin)
  const year = chapter.searchParams.get("year")
  chapter.search = nativeOwnerQuery(wrongInstallation).toString()
  if (year !== null) chapter.searchParams.set("year", year)
  return validateNativeManifest({ ...manifest, target, wrongTeam: manifest.target,
    wrongInstallation: { ...wrongInstallation, chapterHref: chapter.pathname + chapter.search } })
}
export type NativeSourceVersion = Readonly<{
  collection: "contracts" | "opexOwners" | "capexProjects"; recordId: string; versionKey: string; version: number
}>
export async function requireOriginalNativeOperations(input: Readonly<{
  page: Page; manifest: NativeManifest; capabilityId: NativeJourney; principalRef: string
  policyVersion: string; accessRevision: string; intent: NativeJourneyIntent
}>) {
  const live = await observeNativeBinding(input.page, input.manifest.target)
  need(live.stamp.principalRef === input.principalRef && live.stamp.policyVersion === input.policyVersion &&
    live.stamp.accessRevision === input.accessRevision, "F04_SOURCE_CONTEXT_REVISION_CHANGED")
  const destination = live.destinations.find((entry) => entry.capabilityId === input.capabilityId)
  const resource = live.availability.find((entry) => entry.family === "domain-read" && entry.resource === input.capabilityId)
  const ready = (id: string) => resource?.operations.some((entry) =>
    entry.operationId === id && entry.state === "ready" && entry.operational) === true
  if (input.intent === "denied") need(!destination?.canRead, "F04_DENIED_ACTOR_STILL_READS")
  else {
    need(destination?.canRead && destination.page === names[input.capabilityId] && destination.surface === "dashboard" &&
      ready("domain.page." + input.capabilityId), "F04_CURRENT_ORIGINAL_SOURCE_NOT_OPERATIONAL")
    if (input.intent === "edit") need(destination.allowedActionIds.includes("save") &&
      ready("domain.command." + input.capabilityId + ".save"), "F04_CURRENT_SAVE_NOT_OPERATIONAL")
  }
  return { authenticated: true as const, producer: "ORIGINAL_DOMAIN_CONTEXT" as const, context: live }
}
export async function readOriginalNativePage(page: Page, manifest: NativeManifest, capabilityId: NativeJourney) {
  const live = await observeNativeBinding(page, manifest.target)
  const url = new URL(manifest.target.mount + "/api/ui/pages/" + capabilityId, manifest.target.publicOrigin)
  if (capabilityId !== "CAP14") url.searchParams.set("year", "2026")
  const reply = await nativeOriginalRequest(page, url.href, "GET", undefined, nativeTeamHeaders(manifest.target))
  need(reply.status() === 200 && reply.headers()["cache-control"] === "no-store", "F04_ORIGINAL_SOURCE_HTTP_REQUIRED")
  const output: unknown = decoders[capabilityId](await reply.json())
  need(record(output) && output.status === "ok" && same(output.context, live.stamp) && record(output.value) &&
    output.value.capabilityId === capabilityId && record(output.value.data) && record(output.value.versions) &&
    Array.isArray(output.value.allowedActionIds) && output.value.allowedActionIds.every((entry) => typeof entry === "string"), "F04_ORIGINAL_SOURCE_OWNER_OR_SCHEMA_CHANGED")
  const rows = output.value.data[collections[capabilityId]]
  need(Array.isArray(rows) && rows.every(record), "F04_ORIGINAL_COLLECTION_REQUIRED")
  const again = await observeNativeBinding(page, manifest.target)
  need(same(again.stamp, live.stamp), "F04_OWNER_CHANGED_DURING_SOURCE_READ")
  return { rows, versions: output.value.versions, data: output.value.data,
    allowedActionIds: output.value.allowedActionIds as string[], context: live }
}
export async function readOriginalNativeSource(input: Readonly<{
  page: Page; manifest: NativeManifest; capabilityId: NativeJourney; recordId: string
}>): Promise<NativeSourceVersion> {
  need(typeof input.recordId === "string" && input.recordId.length > 0 && input.recordId.length <= 256 &&
    !/[\u0000-\u001f\u007f]/.test(input.recordId), "F04_ORIGINAL_ROW_ID_REQUIRED")
  const original = await readOriginalNativePage(input.page, input.manifest, input.capabilityId)
  need(original.rows.filter((row) => String(row.id ?? "") === input.recordId).length === 1, "F04_ORIGINAL_ROW_NOT_UNIQUE")
  const collection = collections[input.capabilityId], versionKey = collection + ":" + input.recordId
  const version = original.versions[versionKey]
  need(typeof version === "number" && Number.isSafeInteger(version) && version >= 0, "F04_ORIGINAL_CAS_REQUIRED")
  return { collection, recordId: input.recordId, versionKey, version }
}
export type NativeSuiteSelection = Readonly<{
  caseId: NativeInstalledCase; actor: NativeActor; target: NativeTarget; href: string; route: SfResolvedRoute
  routePrincipalRef: string; intent: NativeJourneyIntent; observed: SfTeamContext["stamp"]
  source: NativeSourceVersion | null; emptyRows: 0 | null
}>
export type NativeSelectedInstallation = Readonly<{
  schema: "sf2h.native-selected-installation.v2"; suite: NativeInstalledSuite; candidateSha: string
  invocation: NativeManifest["invocation"]; manifestSha256: string; selections: readonly NativeSuiteSelection[]
}>
export type NativeSelectionInput = Readonly<{
  caseId: NativeInstalledCase; actor: NativeActor; target: NativeTarget; page: Page
  /** Denied cases reuse a route actually observed by a distinct admitted principal, never a fabricated URL. */
  routePage?: Page; route: SfResolvedRoute; sourceRecordId?: string
}>
function selectionPath(manifest: NativeManifest, suite: NativeInstalledSuite) {
  return path.join(manifest.scratchRoot, "native-installed-" + suite.toLowerCase() + ".json")
}
export function validateNativeSelectedInstallation(manifest: NativeManifest, value: unknown): NativeSelectedInstallation {
  need(record(value) && Object.keys(value).sort().join() ===
    ["schema", "suite", "candidateSha", "invocation", "manifestSha256", "selections"].sort().join() &&
    value.schema === "sf2h.native-selected-installation.v2" &&
    (value.suite === "U15" || value.suite === "U39" || value.suite === "U40") &&
    value.candidateSha === manifest.candidateSha && same(value.invocation, manifest.invocation) &&
    value.manifestSha256 === digest(JSON.stringify(manifest)) && manifest.invocation.role === nativeRole(value.suite) &&
    Array.isArray(value.selections), "F04_PRIVATE_SELECTED_BINDING_INVALID")
  const suite = value.suite
  need(value.selections.length === nativeSuiteCases[suite].length &&
    new Set(value.selections.map((entry) => record(entry) ? entry.caseId : null)).size === value.selections.length,
    "F04_COMPLETE_ORIGINAL_CASE_SET_REQUIRED")
  for (const row of value.selections) {
    need(record(row) && Object.keys(row).sort().join() === ["caseId", "actor", "target", "href", "route",
      "routePrincipalRef", "intent", "observed", "source", "emptyRows"].sort().join() &&
      nativeSuiteCases[suite].some((id) => id === row.caseId) && typeof row.actor === "string" &&
      Object.hasOwn(manifest.actors, row.actor) && record(row.route) && record(row.observed), "F04_PRIVATE_CASE_INVALID")
    const caseId = row.caseId as NativeInstalledCase, actor = row.actor as NativeActor
    const target = validateNativeTarget(row.target)
    const caseManifest = nativeManifestForTarget(manifest, target)
    need((caseId === "empty") === (target.teamObjectId !== manifest.target.teamObjectId) &&
      row.intent === nativeCaseIntent(caseId) && row.observed.principalRef === manifest.actors[actor] &&
      row.href === selectedHref(target, suite, row.route as SfResolvedRoute) &&
      (caseId !== "denied" || actor === "denied") &&
      (suite !== "U15" || actor === (caseId === "denied" ? "denied" : "requester")) &&
      (caseId === "denied" || same(record(row.observed.team) && row.observed.team.owner &&
        record(row.observed.team.owner) ? row.observed.team.owner.profile : undefined, nativeTeamRef(caseManifest.target))),
      "F04_PRIVATE_CASE_OWNER_OR_INTENT_INVALID")
    need(Object.values(manifest.actors).includes(String(row.routePrincipalRef)), "F04_ORIGINAL_ROUTE_OBSERVER_REQUIRED")
    if (caseId === "empty" || caseId === "denied")
      need(row.source === null && row.emptyRows === (caseId === "empty" ? 0 : null), "F04_EMPTY_IS_NOT_A_FABRICATED_SOURCE")
    else need(row.emptyRows === null && record(row.source) &&
      row.source.collection === collections[nativeSuiteCapability[suite]] &&
      typeof row.source.recordId === "string" && row.source.recordId.length > 0 &&
      row.source.versionKey === row.source.collection + ":" + row.source.recordId &&
      typeof row.source.version === "number" && Number.isSafeInteger(row.source.version) && row.source.version >= 0,
      "F04_ORIGINAL_SOURCE_CAS_INVALID")
  }
  return value as NativeSelectedInstallation
}
export async function registerNativeSelectedInstallation(input: Readonly<{
  manifest: NativeManifest; browser: Browser; suite: NativeInstalledSuite; selections: readonly NativeSelectionInput[]
}>) {
  const host = await requireNativeInstalledHost(input.manifest)
  const cap = nativeSuiteCapability[input.suite], contexts = new Set(input.browser.contexts())
  const selections: NativeSuiteSelection[] = []
  for (const row of input.selections) {
    const manifest = nativeManifestForTarget(input.manifest, row.target)
    nativeTargetInReservation(host, manifest.target)
    need(contexts.has(row.page.context()) && row.page.context().pages().includes(row.page), "F04_ORIGINAL_CONTEXT_REQUIRED")
    const intent = nativeCaseIntent(row.caseId)
    const live = await requireNativeJourney({ page: row.page, manifest, actor: row.actor, capabilityId: cap,
      intent, ...(cap === "CAP14" ? {} : { year: 2026 }) })
    const operations = await requireOriginalNativeOperations({ page: row.page, manifest,
      ...live, intent })
    if (row.caseId === "readonly") need(!live.canSave &&
      operations.context.destinations.find((entry) => entry.capabilityId === cap)?.allowedActionIds.length === 0,
      "F04_READONLY_CANNOT_BECOME_EDIT")
    const routePage = row.routePage ?? row.page
    need(contexts.has(routePage.context()) && routePage.context().pages().includes(routePage), "F04_ORIGINAL_F01_CONTEXT_REQUIRED")
    const routeLive = await observeNativeBinding(routePage, manifest.target)
    const href = selectedHref(manifest.target, input.suite, row.route)
    const original = resolveSfTeamDomainRoute(new URL(href), descriptor(manifest.target), routeLive)
    need(original && same(original, row.route), "F04_ORIGINAL_F01_RESOLVER_REQUIRED")
    const actual = new URL(routePage.url())
    const link = routePage.locator('nav[data-sf-team-domain-navigation] a[data-sf-capability-id="' + cap + '"]')
    const observed = actual.href === href || row.route.kind === "entry" && await link.count() === 1 &&
      new URL((await link.getAttribute("href")) ?? "", manifest.target.shellOrigin).href === href
    need(observed, "F04_F01_URL_MUST_BE_OBSERVED_IN_ORIGINAL_UI")
    const source = row.sourceRecordId ? await readOriginalNativeSource({
      page: row.page, manifest, capabilityId: cap, recordId: row.sourceRecordId }) : null
    if (row.caseId === "empty") {
      need(!row.sourceRecordId && (await readOriginalNativePage(row.page, manifest, cap)).rows.length === 0,
        "F04_EMPTY_REQUIRES_ZERO_ORIGINAL_ROWS")
    }
    const final = await observeNativeBinding(row.page, manifest.target)
    need(same(final.stamp, operations.context.stamp), "F04_CASE_OWNER_CHANGED_BEFORE_REGISTRATION")
    selections.push({ caseId: row.caseId, actor: row.actor, target: manifest.target, href, route: original,
      routePrincipalRef: routeLive.stamp.principalRef, intent, observed: operations.context.stamp,
      source, emptyRows: row.caseId === "empty" ? 0 : null })
  }
  const bundle = validateNativeSelectedInstallation(input.manifest, {
    schema: "sf2h.native-selected-installation.v2", suite: input.suite,
    candidateSha: input.manifest.candidateSha, invocation: input.manifest.invocation,
    manifestSha256: digest(JSON.stringify(input.manifest)), selections,
  })
  await writeNativePrivate(input.manifest.scratchRoot, path.basename(selectionPath(input.manifest, input.suite)), bundle)
  return { suite: input.suite, file: selectionPath(input.manifest, input.suite), selectionCount: selections.length,
    proofClass: "ORIGINAL_PRECONDITIONS_NOT_JOURNEY_PASS" as const }
}
export async function readNativeSelectedInstallation(manifest: NativeManifest, suite: NativeInstalledSuite) {
  const host = await requireNativeInstalledHost(manifest)
  const raw = await privateText(manifest.scratchRoot, path.basename(selectionPath(manifest, suite)), 524288)
  const parsed = JSON.parse(raw)
  need(raw === JSON.stringify(parsed) + "\n", "F04_PRIVATE_CANONICAL_SELECTED_JSON_REQUIRED")
  const bundle = validateNativeSelectedInstallation(manifest, parsed)
  need(bundle.suite === suite, "F04_SUITE_SELECTION_CHANGED")
  for (const selection of bundle.selections) nativeTargetInReservation(host, selection.target)
  return bundle
}
export async function consumeCurrentNativeSelection(input: Readonly<{
  page: Page; routePage?: Page; manifest: NativeManifest; bundle: NativeSelectedInstallation; caseId: NativeInstalledCase
}>) {
  const selected = input.bundle.selections.find((row) => row.caseId === input.caseId)
  need(selected, "F04_CASE_NOT_REGISTERED")
  const manifest = nativeManifestForTarget(input.manifest, selected.target)
  await requireNativeInstalledHost(manifest)
  const cap = nativeSuiteCapability[input.bundle.suite]
  const current = await requireNativeJourney({ page: input.page, manifest, actor: selected.actor, capabilityId: cap,
    intent: selected.intent, ...(cap === "CAP14" ? {} : { year: 2026 }) })
  const operations = await requireOriginalNativeOperations({ page: input.page, manifest, ...current, intent: selected.intent })
  const routePage = input.routePage ?? input.page
  const routeLive = await observeNativeBinding(routePage, manifest.target)
  need(routeLive.stamp.principalRef === selected.routePrincipalRef, "F04_ORIGINAL_ROUTE_OBSERVER_CHANGED")
  const route = resolveSfTeamDomainRoute(new URL(selected.href), descriptor(manifest.target), routeLive)
  need(route && same(route, selected.route) && new URL(routePage.url()).href === selected.href,
    "F04_CURRENT_ORIGINAL_F01_SELECTION_REQUIRED")
  if (selected.caseId === "readonly") need(!current.canSave &&
    operations.context.destinations.find((entry) => entry.capabilityId === cap)?.allowedActionIds.length === 0,
    "F04_READONLY_AUTHORITY_CHANGED")
  if (selected.caseId === "empty") need((await readOriginalNativePage(input.page, manifest, cap)).rows.length === 0,
    "F04_EMPTY_COLLECTION_NO_LONGER_EMPTY")
  const source = selected.source && await readOriginalNativeSource({ page: input.page, manifest, capabilityId: cap,
    recordId: selected.source.recordId })
  const final = await observeNativeBinding(input.page, manifest.target)
  need(final.stamp.principalRef === current.principalRef && final.stamp.policyVersion === current.policyVersion &&
    final.stamp.accessRevision === current.accessRevision, "F04_CASE_CHANGED_DURING_CONSUMPTION")
  return { suite: input.bundle.suite, caseId: selected.caseId, manifest, href: selected.href,
    actor: selected.actor, current, source,
    sourceVersionAdvancedSinceRegistration: Boolean(source && selected.source && source.version !== selected.source.version),
    proofClass: "CURRENT_ORIGINAL_PRECONDITION_NOT_CASE_PASS" as const }
}
export function nativeSuiteFromChapter(manifest: NativeManifest): NativeInstalledSuite | undefined {
  return (Object.keys(nativeSuiteCapability) as NativeInstalledSuite[]).find((suite) => {
    const route = nativeJourneyEntryHref(manifest.target, nativeSuiteCapability[suite], suite === "U15" ? undefined : 2026)
    const entry = new URL(route), chapter = new URL(manifest.target.chapterHref, manifest.target.shellOrigin)
    return chapter.origin === entry.origin && chapter.search === entry.search &&
      (chapter.pathname === entry.pathname || suite === "U15" && chapter.pathname.startsWith(entry.pathname + "/"))
  })
}
export function u15RegisteredEnvironment(bundle: NativeSelectedInstallation): Record<string, string> {
  need(bundle.suite === "U15", "F04_U15_BUNDLE_REQUIRED")
  return Object.fromEntries([["list", "SF_NATIVE_U15_LIST_URL"], ["editable", "SF_NATIVE_U15_EDIT_URL"],
    ["denied", "SF_NATIVE_U15_DENIED_URL"], ["stale", "SF_NATIVE_U15_STALE_URL"], ["lost", "SF_NATIVE_U15_LOST_RESPONSE_URL"]]
    .map(([id, key]) => {
      const row = bundle.selections.find((entry) => entry.caseId === id)
      need(row, "F04_U15_URL_NOT_REGISTERED")
      return [key!, row.href]
    }))
}
