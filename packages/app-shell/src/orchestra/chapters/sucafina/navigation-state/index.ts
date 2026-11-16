import { batch } from "solid-js"
import type {
  SfHref, SfOwnerKey, SfOwnerSelection, SfRef, SfResolvedRoute,
  SfServerKey, SurfaceId,
} from "@orchestra/schema/sucafina/context"

/**
 * Request an approved entry route for the exact original F01 owner tuple.
 * This is a candidate URL string, NOT a trusted SfHref or a grant: the shell's
 * native F01 transition must still admit/resolve it before displaying data.
 * Only immutable Q01 surface-manifest entry templates are enumerated here.
 */
export function sfEntryDestinationRequest(from: SfResolvedRoute, target: "CAP07" | "CAP25"): string | undefined {
  const owner = from.ownerSelection
  if (!owner.serverKey || !owner.projectId || !owner.installationId) return undefined
  const pathname = target === "CAP07" ? "/orchestra/sf-people/structure"
    : "/orchestra/sf-procurement/requests"
  return pathname + "?" + new URLSearchParams({
    server: owner.serverKey, project: owner.projectId, installation: owner.installationId,
  }).toString()
}

/** Original opaque references are encoded only to avoid route-token collisions. */
export function encodeSfRouteRef(original: string): string {
  if (!original) throw new Error("invalid sf route reference")
  const bytes = new TextEncoder().encode(original)
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("")
  return "r_" + btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

export function decodeSfRouteRef(encoded: string): SfRef | undefined {
  if (!/^r_[A-Za-z0-9_-]+$/.test(encoded)) return undefined
  try {
    const body = encoded.slice(2).replace(/-/g, "+").replace(/_/g, "/")
    const bytes = Uint8Array.from(atob(body.padEnd(Math.ceil(body.length / 4) * 4, "=")), (byte) => byte.charCodeAt(0))
    const value = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    return value && encodeSfRouteRef(value) === encoded ? value as SfRef : undefined
  } catch {
    return undefined
  }
}

/** Absence of all three query selectors means shell selection; partial URL is INVALID, never fallback. */
export type SfSelectionResolution =
  | Readonly<{ status: "selected"; selection: SfOwnerSelection; explicit: boolean }>
  | Readonly<{ status: "invalid-link" }>
export function resolveSfUrlSelection(href: string, currentHref: string, selected: SfOwnerSelection): SfSelectionResolution {
  try {
    const base = new URL(currentHref, "http://orchestra.invalid")
    const destination = new URL(href, base)
    if (!["http:", "https:"].includes(destination.protocol) || destination.origin !== base.origin || !destination.pathname.startsWith("/orchestra/"))
      return { status: "invalid-link" }
    if (/%(?![\\da-fA-F]{2})/.test(destination.search)) return { status: "invalid-link" }
    const values = ["server", "project", "installation"].map((key) => destination.searchParams.getAll(key))
    if (values.some((items) => items.length > 1)) return { status: "invalid-link" }
    if (values.every((items) => items.length === 0)) return { status: "selected", selection: selected, explicit: false }
    if (!values.every((items) => items.length === 1 && items[0])) return { status: "invalid-link" }
    return {
      status: "selected",
      explicit: true,
      selection: {
        serverKey: values[0]![0] as SfServerKey,
        projectId: values[1]![0] as SfRef,
        installationId: values[2]![0] as SfRef,
      },
    }
  } catch {
    return { status: "invalid-link" }
  }
}
export type SfNativeTransitionCause =
  | "deep-link" | "sidebar" | "link" | "keyboard" | "history" | "reload" | "connection-gate"
export type SfNativeTransitionResult =
  | Readonly<{ status: "committed"; route: SfResolvedRoute }>
  | Readonly<{ status: "aborted" | "invalid-link" | "denied" | "unavailable" | "kept-editing" }>
export type SfNativeTransitionOptions = Readonly<{
  signal?: AbortSignal
  /** An owner-bound action cannot re-admit a different principal after an async read. */
  expectedOwnerKey?: SfOwnerKey
  /** Inspect the source-resolved target, never just the candidate URL. */
  admit?: (route: SfResolvedRoute) => boolean
  /** Second original-source read after F01 resolved but before commit. */
  preCommit?: (route: SfResolvedRoute, signal: AbortSignal) => Promise<boolean>
}>
export type SfNavigationDependencies = Readonly<{
  /** Must resolve the exact ServerConnection from selection.serverKey BEFORE discovery. */
  resolveAuthorizedRoute(href: string, selection: SfOwnerSelection, signal: AbortSignal): Promise<
    | Readonly<{ status: "authorized"; route: SfResolvedRoute; ownerKey: SfOwnerKey }>
    | Readonly<{ status: "denied" | "unavailable" | "invalid-link" }>
  >
  selected: () => SfOwnerSelection
  currentHref: () => string
  currentOwnerKey: () => SfOwnerKey | undefined
  hasDirtyDrafts: () => boolean
  /** Only called before voluntary owner change; true means explicit discard. */
  confirmDiscard: () => Promise<boolean>
  /** Purges requests/projections/drafts of previous owner before the new owner is committed. */
  invalidateOwner: (reason: "owner-changed") => void
  /** I00 composes route, global selection and provider owner in one synchronous host callback. */
  commit: (result: Readonly<{ route: SfResolvedRoute; selection: SfOwnerSelection; ownerKey: SfOwnerKey; cause: SfNativeTransitionCause }>) => void
  /** Only already source-validated non-sensitive filters are retained. */
  validateRetained: (route: SfResolvedRoute, values: SfRetainedViewState) => SfRetainedViewState | undefined
}>
export type SfRetainedViewState = Readonly<{
  year?: number; month?: number; period?: string; version?: SfRef
  status?: string; sort?: string; cursor?: SfRef; selection?: SfRef; tab?: string
  scrollY?: number; focusRef?: SfRef
}>

export function createSfNavigationState(deps: SfNavigationDependencies) {
  const retained = new Map<string, SfRetainedViewState>()
  const returns = new Map<string, Readonly<{ ownerKey: SfOwnerKey; href: SfHref }>>()
  let generation = 0
  let inflight: AbortController | undefined
  let resumeFocus: Readonly<{
    ownerKey: SfOwnerKey
    accessRevision: string
    caseRef: string
    sourceVersion: number
    returnRef: string
  }> | undefined

  const invalidate = () => {
    generation += 1
    inflight?.abort()
    inflight = undefined
  }
  const requestNativeTransition = async (
    href: string, cause: SfNativeTransitionCause, options?: SfNativeTransitionOptions,
  ): Promise<SfNativeTransitionResult> => {
    invalidate()
    if (options?.signal?.aborted) return { status: "aborted" }
    const epoch = generation
    const abort = new AbortController()
    inflight = abort
    const cancel = () => abort.abort()
    options?.signal?.addEventListener("abort", cancel, { once: true })
    if (options?.signal?.aborted) abort.abort()
    try {
      if (abort.signal.aborted) return { status: "aborted" }
      const selected = resolveSfUrlSelection(href, deps.currentHref(), deps.selected())
      if (selected.status === "invalid-link") return { status: "invalid-link" }
      // Explicit URL A is never filled from persisted selection B.
      const resolved = await deps.resolveAuthorizedRoute(href, selected.selection, abort.signal).catch(() => {
        if (!abort.signal.aborted) console.error("Sucafina route resolution failed")
        return { status: "unavailable" as const }
      })
      if (abort.signal.aborted || epoch !== generation) return { status: "aborted" }
      if (resolved.status !== "authorized") return { status: resolved.status }
      if (resolved.route.ownerSelection.serverKey !== selected.selection.serverKey ||
          resolved.route.ownerSelection.projectId !== selected.selection.projectId ||
          resolved.route.ownerSelection.installationId !== selected.selection.installationId)
        return { status: "invalid-link" }
      if (options?.expectedOwnerKey &&
          (resolved.ownerKey !== options.expectedOwnerKey ||
           deps.currentOwnerKey() !== options.expectedOwnerKey))
        return { status: "denied" }
      if (options?.admit && !options.admit(resolved.route)) return { status: "denied" }
      if (options?.preCommit) {
        const stillAuthorized = await options.preCommit(resolved.route, abort.signal)
        if (abort.signal.aborted || epoch !== generation) return { status: "aborted" }
        if (!stillAuthorized) return { status: "denied" }
      }
      const outgoing = deps.currentOwnerKey()
      const changingOwner = outgoing !== undefined && outgoing !== resolved.ownerKey
      if (changingOwner && deps.hasDirtyDrafts()) {
        const discard = await deps.confirmDiscard()
        if (abort.signal.aborted || epoch !== generation) return { status: "aborted" }
        if (!discard) return { status: "kept-editing" }
      }
      // A denied/stale reply or a changed owner may never commit after preflight.
      if (abort.signal.aborted || epoch !== generation ||
          options?.signal?.aborted ||
          (options?.expectedOwnerKey && (
            deps.currentOwnerKey() !== options.expectedOwnerKey ||
            resolved.ownerKey !== options.expectedOwnerKey
          )) ||
          (options?.admit && !options.admit(resolved.route))) return { status: "aborted" }
      if (changingOwner) {
        deps.invalidateOwner("owner-changed")
        retained.clear()
        returns.clear()
        resumeFocus = undefined
      }
      batch(() => deps.commit({ route: resolved.route, selection: selected.selection, ownerKey: resolved.ownerKey, cause }))
      return { status: "committed", route: resolved.route }
    } finally {
      options?.signal?.removeEventListener("abort", cancel)
      if (inflight === abort) inflight = undefined
    }
  }
  const key = (ownerKey: SfOwnerKey, surfaceId: SurfaceId, accessRevision: string, scope: string) =>
    JSON.stringify([ownerKey, surfaceId, accessRevision, scope])
  const remember = (ownerKey: SfOwnerKey, route: SfResolvedRoute, accessRevision: string, scope: string, proposed: SfRetainedViewState) => {
    const value = deps.validateRetained(route, proposed)
    if (!value) return
    const current = key(ownerKey, route.surfaceId, accessRevision, scope)
    retained.delete(current)
    retained.set(current, value)
    if (retained.size > 80) retained.delete(retained.keys().next().value!)
  }
  const restore = (ownerKey: SfOwnerKey, surfaceId: SurfaceId, accessRevision: string, scope: string) =>
    retained.get(key(ownerKey, surfaceId, accessRevision, scope))
  const rememberReturn = (ownerKey: SfOwnerKey, href: SfHref): string => {
    const ref = crypto.randomUUID()
    returns.set(ref, { ownerKey, href })
    if (returns.size > 64) returns.delete(returns.keys().next().value!)
    return ref
  }
  const consumeReturn = (reference: string, ownerKey: SfOwnerKey): SfHref | undefined => {
    const value = returns.get(reference)
    returns.delete(reference)
    return value?.ownerKey === ownerKey ? value.href : undefined
  }
  const clearResumeFocus = (reference?: string) => {
    // An older, aborted attempt may never erase a later attempt's returnRef.
    if (reference && resumeFocus?.returnRef !== reference) return
    if (resumeFocus) consumeReturn(resumeFocus.returnRef, resumeFocus.ownerKey)
    resumeFocus = undefined
  }
  const rememberResumeFocus = (input: Readonly<{
    ownerKey: SfOwnerKey; accessRevision: string; caseRef: string
    sourceVersion: number; returnHref: SfHref
  }>) => {
    clearResumeFocus()
    const returnRef = rememberReturn(input.ownerKey, input.returnHref)
    resumeFocus = {
      ownerKey: input.ownerKey, accessRevision: input.accessRevision,
      caseRef: input.caseRef, sourceVersion: input.sourceVersion, returnRef,
    }
    return returnRef
  }
  const claimResumeFocus = (input: Readonly<{
    ownerKey: SfOwnerKey; accessRevision: string; caseRef: string
    sourceVersion: number; returnHref: SfHref
  }>): boolean => {
    const pending = resumeFocus
    if (!pending ||
        pending.ownerKey !== input.ownerKey ||
        pending.accessRevision !== input.accessRevision ||
        pending.caseRef !== input.caseRef ||
        pending.sourceVersion !== input.sourceVersion) return false
    resumeFocus = undefined
    return consumeReturn(pending.returnRef, input.ownerKey) === input.returnHref
  }
  const dispose = () => { invalidate(); retained.clear(); clearResumeFocus(); returns.clear() }
  return Object.freeze({
    requestNativeTransition, remember, restore, rememberReturn, consumeReturn,
    rememberResumeFocus, claimResumeFocus, clearResumeFocus, invalidate, dispose,
  })
}

export type SfNativeNavigationState = ReturnType<typeof createSfNavigationState>
