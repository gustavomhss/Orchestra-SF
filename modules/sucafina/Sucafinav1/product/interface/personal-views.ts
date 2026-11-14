import { digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { Period } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import { DASHBOARD_PAGES, PLANNER_TABS, PROCUREMENT_NAV } from "../../src/nav.ts"

export type SfViewSelectionKey = "year" | "own" | "execYear" | "opsYear" | "secYear" | "month" | "executiveMonth" | "operationsMonth" | "securityMonth" | "version" | "owner" | "class" | "mode" | "filter" | "status" | "topicStatus" | "memberStatus" | "opsMonth" | "request" | "supplier"
export type SfPersonalView = { id: string; title: string; surface: "dashboard" | "planner" | "procurement"; page: string; period?: Period; currency?: string; density?: "comfortable" | "compact"; filters?: { query?: string; selections?: Partial<Record<SfViewSelectionKey, string>> } }
export type SfPersonalViewRecord = { view: SfPersonalView; version: number }
/** A private preference may remain after its destination disappears. Its former contents stay hidden. */
export type SfUnavailablePersonalView = { id: string; version: number; availability: "unavailable" }
export type SfPersonalViewListEntry = SfPersonalViewRecord | SfUnavailablePersonalView
export type SfPersonalViewSave = { view: SfPersonalView; expectedVersion: number | null }
export type SfPersonalViewRemove = { id: string; expectedVersion: number }

/** Exact URL keys consumed by each existing page; references are reauthorized by the host. */
export function sfViewSelectionKeys(surface: SfPersonalView["surface"], page: string): readonly SfViewSelectionKey[] {
  const shared: readonly SfViewSelectionKey[] = ["year", "execYear", "opsYear", "secYear", "executiveMonth", "operationsMonth", "securityMonth", "opsMonth"]
  if (surface === "dashboard") {
    const pages: Record<string, readonly SfViewSelectionKey[]> = {
      "Executive Dashboard": ["year", "own", "execYear", "month", "executiveMonth", "opsMonth"],
      "Hot Topics & Actions": ["year", "topicStatus"], "Budget Overview": ["year"], "OPEX Detail": ["year"], "CAPEX Projects": ["year"],
      "Headcount Overview": ["year"], "Team Structure": ["year"], "Talent Review": ["year", "memberStatus"],
      "Portfolio Dashboard": ["year", "status", "filter", "owner"], "All Projects": ["year", "status", "filter", "owner"],
      "IT Operations": ["year", "own", "opsYear", "month", "operationsMonth"], "IT Security KPIs": ["year", "own", "secYear", "month", "securityMonth"],
      "IT Risks": ["year", "status", "filter", "owner"], "Vendor Contracts": ["year", "status", "filter", "owner"],
      "Stakeholder Management": ["year", "status", "filter", "owner"], "IT Performance Contract": ["year"],
    }
    return pages[page] ? [...new Set([...shared, ...pages[page]])] : []
  }
  if (surface === "planner") {
    const pages: Record<string, readonly SfViewSelectionKey[]> = { "Overview": ["year", "version", "filter"], "OPEX": ["year", "version", "owner", "class", "mode"], "CAPEX": ["year", "version", "owner", "class", "mode"], "Headcount": ["year", "version"], "Entities & allocations": ["year", "version"], "FX rates": ["year", "version"], "Versions": ["year"] }
    return pages[page] ? [...new Set([...shared, ...pages[page]])] : []
  }
  const pages: Record<string, readonly SfViewSelectionKey[]> = { "Dashboard": ["year"], "Requests": ["year", "filter", "request"], "My approvals": ["year"], "Suppliers": ["year", "status", "supplier"], "Settings": ["year"] }
  return pages[page] ? [...new Set([...shared, ...pages[page]])] : []
}
export function sfViewQueryAllowed(surface: SfPersonalView["surface"], page: string) {
  return surface === "dashboard" && ["Portfolio Dashboard", "All Projects", "IT Risks", "Vendor Contracts", "Stakeholder Management"].includes(page) || surface === "planner" && ["OPEX", "CAPEX"].includes(page) || surface === "procurement" && ["Requests", "Suppliers"].includes(page)
}

/** Private preferences share the existing state transaction and never grant access to their destination. */
export function createSfPersonalViews(input: {
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  state: SfProductStatePort
  creationTarget: { ref: string; incarnation: string }
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  humanAuthorize: (context: TrustedDomainContext, action: "views.read" | "views.save" | "views.remove", payload: unknown) => Promise<boolean>
  authorizeView: (view: SfPersonalView, context: TrustedDomainContext) => Promise<boolean>
}) {
  const authorized = async (context: TrustedDomainContext, action: "views.read" | "views.save" | "views.remove", payload: unknown) => context.kind === "ui" && !!input.host.requestFor(context) && await input.host.revalidate(context).catch(() => false) && await input.humanAuthorize(context, action, payload).catch(() => false)
  const prefix = (context: TrustedDomainContext) => `sf:personal-view:${encodeURIComponent(context.binding.principalRef)}:`
  return {
    list: async (context: TrustedDomainContext): Promise<PortResult<readonly SfPersonalViewListEntry[]>> => {
      if (!await authorized(context, "views.read", {})) return { status: "denied", reason: "views-access-unavailable" }
      const request = input.host.requestFor(context)!
      const found = await input.state.read(request, "preferences", (state, authority) => sameAuthority(authority, context) ? Object.entries(state.preferences).filter(([key, value]) => key.startsWith(prefix(context)) && viewRecord(value) && key === `${prefix(context)}${value.view.id}`).map(([, value]) => value).filter(viewRecord) : undefined).catch(() => undefined)
      if (found?.status === "unavailable" && found.reason === "product-state-uninitialized") return { status: "ok", value: [] }
      if (!found || found.status !== "ok" || !found.value) return { status: "unavailable", reason: "views-unavailable" }
      const permitted = await Promise.all(found.value.map(async (entry): Promise<SfPersonalViewListEntry> => await input.authorizeView(entry.view, context).catch(() => false) ? entry : { id: entry.view.id, version: entry.version, availability: "unavailable" }))
      if (!await authorized(context, "views.read", {})) return { status: "denied", reason: "views-access-unavailable" }
      return { status: "ok", value: permitted }
    },
    open: async (incoming: { id: string }, context: TrustedDomainContext): Promise<PortResult<SfPersonalViewRecord>> => {
      const payload = structuredClone(incoming)
      if (!payload || Object.keys(payload).some((key) => key !== "id") || !validId(payload.id) || !await authorized(context, "views.read", payload)) return { status: "denied", reason: "view-access-unavailable" }
      const found = await input.state.read(input.host.requestFor(context)!, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[`${prefix(context)}${payload.id}`] : undefined).catch(() => undefined)
      if (!found || found.status !== "ok" || !viewRecord(found.value) || found.value.view.id !== payload.id || !await input.authorizeView(found.value.view, context).catch(() => false) || !await authorized(context, "views.read", payload)) return { status: "unavailable", reason: "view-unavailable" }
      return { status: "ok", value: found.value }
    },
    save: async (incoming: SfPersonalViewSave, context: TrustedDomainContext): Promise<PortResult<SfPersonalViewRecord>> => {
      const payload = structuredClone(incoming)
      if (!payload || Object.keys(payload).some((key) => !["view", "expectedVersion"].includes(key)) || !validView(payload.view) || !(payload.expectedVersion === null || Number.isSafeInteger(payload.expectedVersion) && payload.expectedVersion > 0)) return { status: "needs-input", reason: "invalid-view" }
      if (!await authorized(context, "views.save", payload) || !await input.authorizeView(payload.view, context).catch(() => false)) return { status: "denied", reason: "view-access-unavailable" }
      const request = input.host.requestFor(context)!
      const operation = input.operationIdentity(context)
      if (!operation) return { status: "denied", reason: "view-access-unavailable" }
      const before = await input.state.read(request, "preferences", () => null).catch(() => undefined)
      if (!before || before.status === "preview" || before.status === "denied" || before.status === "conflict" || before.status === "unavailable" && before.reason !== "product-state-uninitialized") return { status: "unavailable", reason: "views-unavailable" }
      const key = `${prefix(context)}${payload.view.id}`
      const saved = await input.state.transaction(request, { namespace: "preferences", expectedStorageVersion: before.status === "ok" ? before.storageVersion : 0, idempotencyKey: operation, commandDigest: digestSfValue(payload), targetRef: input.creationTarget.ref, targetIncarnation: input.creationTarget.incarnation }, async (state, authority) => {
        const previous = state.preferences[key]
        if (!sameAuthority(authority, context) || (payload.expectedVersion === null ? previous !== undefined : !viewRecord(previous) || previous.view.id !== payload.view.id || previous.version !== payload.expectedVersion)) return { commit: false, value: undefined }
        const next = { view: structuredClone(payload.view), version: (payload.expectedVersion ?? 0) + 1 }
        state.preferences[key] = next
        return { commit: true, value: next }
      }).catch(() => undefined)
      if (!saved || saved.status === "unavailable" || saved.status === "denied") return { status: "unavailable", reason: "views-unavailable" }
      if (saved.status !== "ok" || !saved.value) return { status: "conflict", reason: "view-changed" }
      const current = await input.state.read(request, "preferences", (state, authority) => sameAuthority(authority, context) ? state.preferences[key] : undefined).catch(() => undefined)
      if (!current || current.status !== "ok" || !viewRecord(current.value) || digestSfValue(current.value) !== digestSfValue(saved.value)) return { status: "stale", reason: "view-changed" }
      if (!await authorized(context, "views.save", payload) || !await input.authorizeView(current.value.view, context).catch(() => false)) return { status: "denied", reason: "view-access-unavailable" }
      return { status: "ok", value: current.value }
    },
    remove: async (incoming: SfPersonalViewRemove, context: TrustedDomainContext): Promise<PortResult<{ removed: true }>> => {
      const payload = structuredClone(incoming)
      if (!payload || Object.keys(payload).some((key) => !["id", "expectedVersion"].includes(key)) || !validId(payload.id) || !Number.isSafeInteger(payload.expectedVersion) || payload.expectedVersion < 1) return { status: "needs-input", reason: "invalid-view" }
      if (!await authorized(context, "views.remove", payload)) return { status: "denied", reason: "view-access-unavailable" }
      const request = input.host.requestFor(context)!
      const operation = input.operationIdentity(context)
      if (!operation) return { status: "denied", reason: "view-access-unavailable" }
      const before = await input.state.read(request, "preferences", () => null).catch(() => undefined)
      if (!before || before.status !== "ok") return { status: "unavailable", reason: "views-unavailable" }
      const key = `${prefix(context)}${payload.id}`
      const saved = await input.state.transaction(request, { namespace: "preferences", expectedStorageVersion: before.storageVersion, idempotencyKey: operation, commandDigest: digestSfValue(payload), targetRef: input.creationTarget.ref, targetIncarnation: input.creationTarget.incarnation }, async (state, authority) => {
        const previous = state.preferences[key]
        if (!sameAuthority(authority, context) || !viewRecord(previous) || previous.view.id !== payload.id || previous.version !== payload.expectedVersion) return { commit: false, value: false }
        delete state.preferences[key]
        return { commit: true, value: true }
      }).catch(() => undefined)
      if (!saved || saved.status === "unavailable" || saved.status === "denied") return { status: "unavailable", reason: "views-unavailable" }
      if (saved.status !== "ok" || !saved.value) return { status: "conflict", reason: "view-changed" }
      const current = await input.state.read(request, "preferences", (state, authority) => sameAuthority(authority, context) ? { exists: Object.hasOwn(state.preferences, key) } : undefined).catch(() => undefined)
      if (!current || current.status !== "ok" || !current.value || current.value.exists) return { status: "stale", reason: "view-changed" }
      if (!await authorized(context, "views.remove", payload)) return { status: "denied", reason: "view-access-unavailable" }
      return { status: "ok", value: { removed: true } }
    },
  }
}

function validId(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(value) }
function validView(value: unknown): value is SfPersonalView {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !["id", "title", "surface", "page", "period", "currency", "density", "filters"].includes(key))) return false
  const item = value as Record<string, unknown>
  if (!validId(item.id) || typeof item.title !== "string" || !item.title.trim() || item.title.length > 120 || typeof item.page !== "string") return false
  if (!(item.surface === "dashboard" && DASHBOARD_PAGES.some((page) => page === item.page) || item.surface === "planner" && PLANNER_TABS.some((page) => page === item.page) || item.surface === "procurement" && PROCUREMENT_NAV.some((page) => page === item.page))) return false
  if (item.period !== undefined && !isSfPeriod(item.period) || item.currency !== undefined && (typeof item.currency !== "string" || !/^[A-Z]{3}$/.test(item.currency))) return false
  if (item.density !== undefined && item.density !== "comfortable" && item.density !== "compact") return false
  if (item.filters !== undefined) {
    if (!item.filters || typeof item.filters !== "object" || Array.isArray(item.filters) || Object.keys(item.filters).some((key) => !["query", "selections"].includes(key)) || "query" in item.filters && (typeof item.filters.query !== "string" || item.filters.query.length > 500 || !sfViewQueryAllowed(item.surface as SfPersonalView["surface"], item.page as string))) return false
    if ("selections" in item.filters) {
      const selections = item.filters.selections
      if (!selections || typeof selections !== "object" || Array.isArray(selections) || Object.entries(selections).some(([key, value]) => !sfViewSelectionKeys(item.surface as SfPersonalView["surface"], item.page as string).some((allowed) => allowed === key) || typeof value !== "string" || value.length > 500 || (["year", "own", "execYear", "opsYear", "secYear"].includes(key) && value !== "" && !/^202[4-7]$/.test(value)) || (["month", "executiveMonth", "operationsMonth", "securityMonth", "opsMonth"].includes(key) && value !== "" && !/^([1-9]|1[0-2])$/.test(value)))) return false
    }
  }
  return true
}
function viewRecord(value: unknown): value is SfPersonalViewRecord { return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((key) => key === "view" || key === "version") && "view" in value && validView(value.view) && "version" in value && typeof value.version === "number" && Number.isSafeInteger(value.version) && value.version > 0 }
function sameAuthority(authority: { principalRef: string; accessRevision: string; policyVersion: string }, context: TrustedDomainContext) { return authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion }
